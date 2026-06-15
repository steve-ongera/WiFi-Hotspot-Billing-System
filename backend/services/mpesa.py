"""
services/mpesa.py

WifiBill — Safaricom Daraja API service.

Handles:
  - OAuth access token retrieval (cached)
  - STK Push (Lipa Na M-Pesa Online)
  - Transaction status query
  - Callback payload parsing

Environment variables required (backend/.env):
    MPESA_ENVIRONMENT        sandbox | production
    MPESA_CONSUMER_KEY
    MPESA_CONSUMER_SECRET
    MPESA_SHORTCODE          e.g. 174379 (sandbox) or your paybill
    MPESA_PASSKEY            Lipa Na M-Pesa passkey
    MPESA_CALLBACK_URL       https://your-domain.com/api/payments/mpesa/callback/
    MPESA_TRANSACTION_TYPE   CustomerPayBillOnline | CustomerBuyGoodsOnline
"""

import base64
import logging
from datetime import datetime

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Base URLs
# ---------------------------------------------------------------------------

SANDBOX_BASE = "https://sandbox.safaricom.co.ke"
PRODUCTION_BASE = "https://api.safaricom.co.ke"


class MpesaError(Exception):
    """Raised when Daraja API returns an error response."""


class MpesaService:
    """
    Thin wrapper around Safaricom's Daraja REST API.
    One instance per request is fine — access tokens are short-lived (1 hour)
    so we do NOT cache them in-process; use Redis if you need caching.
    """

    def __init__(self):
        env = getattr(settings, "MPESA_ENVIRONMENT", "sandbox").lower()
        self.base_url = PRODUCTION_BASE if env == "production" else SANDBOX_BASE

        self.consumer_key = settings.MPESA_CONSUMER_KEY
        self.consumer_secret = settings.MPESA_CONSUMER_SECRET
        self.shortcode = settings.MPESA_SHORTCODE
        self.passkey = settings.MPESA_PASSKEY
        self.callback_url = settings.MPESA_CALLBACK_URL
        self.transaction_type = getattr(
            settings, "MPESA_TRANSACTION_TYPE", "CustomerPayBillOnline"
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _basic_auth_header(self) -> str:
        """Base64-encode consumer_key:consumer_secret for OAuth call."""
        raw = f"{self.consumer_key}:{self.consumer_secret}"
        return "Basic " + base64.b64encode(raw.encode()).decode()

    def get_access_token(self) -> str:
        """
        Fetch a short-lived OAuth bearer token from Daraja.
        Returns the token string.
        Raises MpesaError on failure.
        """
        url = f"{self.base_url}/oauth/v1/generate?grant_type=client_credentials"
        try:
            response = requests.get(
                url,
                headers={"Authorization": self._basic_auth_header()},
                timeout=15,
            )
            response.raise_for_status()
            data = response.json()
            token = data.get("access_token")
            if not token:
                raise MpesaError(f"No access_token in response: {data}")
            logger.debug("M-Pesa access token obtained.")
            return token
        except requests.RequestException as exc:
            raise MpesaError(f"Failed to get M-Pesa access token: {exc}") from exc

    def generate_password(self) -> tuple[str, str]:
        """
        Generate the STK Push password and timestamp.
        Password = Base64(shortcode + passkey + timestamp)
        Returns: (password_b64, timestamp_str)
        """
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        raw = f"{self.shortcode}{self.passkey}{timestamp}"
        password = base64.b64encode(raw.encode()).decode()
        return password, timestamp

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.get_access_token()}",
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def initiate_stk_push(
        self,
        phone: str,
        amount: int,
        reference: str,
        description: str = "WifiBill Package",
    ) -> dict:
        """
        Send an STK Push request to the customer's phone.

        Args:
            phone:       MSISDN in 2547XXXXXXXX format
            amount:      Integer KES amount (no decimals)
            reference:   Your internal reference (e.g. "WB123")
            description: Short description shown on the USSD prompt

        Returns:
            Daraja response dict containing MerchantRequestID,
            CheckoutRequestID, ResponseCode, ResponseDescription,
            CustomerMessage.

        Raises:
            MpesaError on HTTP or API-level failures.
        """
        password, timestamp = self.generate_password()
        url = f"{self.base_url}/mpesa/stkpush/v1/processrequest"

        payload = {
            "BusinessShortCode": self.shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": self.transaction_type,
            "Amount": amount,
            "PartyA": phone,
            "PartyB": self.shortcode,
            "PhoneNumber": phone,
            "CallBackURL": self.callback_url,
            "AccountReference": reference[:12],  # Daraja max 12 chars
            "TransactionDesc": description[:13],  # Daraja max 13 chars
        }

        try:
            response = requests.post(
                url, json=payload, headers=self._headers(), timeout=30
            )
            response.raise_for_status()
            data = response.json()
            logger.info(
                "STK Push sent to %s for KES %s | ref=%s | CheckoutID=%s",
                phone,
                amount,
                reference,
                data.get("CheckoutRequestID"),
            )
            if data.get("ResponseCode") != "0":
                raise MpesaError(
                    f"STK Push failed: {data.get('ResponseDescription', data)}"
                )
            return data
        except requests.RequestException as exc:
            raise MpesaError(f"STK Push HTTP error: {exc}") from exc

    def query_stk_status(self, checkout_request_id: str) -> dict:
        """
        Query the status of an STK Push transaction.
        Useful for polling when the callback hasn't arrived yet.

        Returns:
            Daraja status response dict.

        Raises:
            MpesaError on failure.
        """
        password, timestamp = self.generate_password()
        url = f"{self.base_url}/mpesa/stkpushquery/v1/query"

        payload = {
            "BusinessShortCode": self.shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "CheckoutRequestID": checkout_request_id,
        }

        try:
            response = requests.post(
                url, json=payload, headers=self._headers(), timeout=30
            )
            response.raise_for_status()
            data = response.json()
            logger.debug("STK status for %s: %s", checkout_request_id, data)
            return data
        except requests.RequestException as exc:
            raise MpesaError(f"STK status query error: {exc}") from exc

    def parse_callback(self, callback_data: dict) -> dict:
        """
        Extract useful fields from Daraja's STK callback payload.

        Returns a clean dict:
            {
                "result_code":       int,
                "result_desc":       str,
                "merchant_request_id": str,
                "checkout_request_id": str,
                "receipt_number":    str | None,
                "amount":            float | None,
                "phone_number":      str | None,
                "transaction_date":  str | None,
            }
        """
        stk = callback_data.get("Body", {}).get("stkCallback", {})
        result_code = stk.get("ResultCode")
        result_desc = stk.get("ResultDesc", "")

        parsed = {
            "result_code": result_code,
            "result_desc": result_desc,
            "merchant_request_id": stk.get("MerchantRequestID", ""),
            "checkout_request_id": stk.get("CheckoutRequestID", ""),
            "receipt_number": None,
            "amount": None,
            "phone_number": None,
            "transaction_date": None,
        }

        if result_code == 0:
            items = {
                item["Name"]: item.get("Value")
                for item in stk.get("CallbackMetadata", {}).get("Item", [])
            }
            parsed["receipt_number"] = str(items.get("MpesaReceiptNumber", ""))
            parsed["amount"] = float(items.get("Amount", 0))
            parsed["phone_number"] = str(items.get("PhoneNumber", ""))
            parsed["transaction_date"] = str(items.get("TransactionDate", ""))

        return parsed