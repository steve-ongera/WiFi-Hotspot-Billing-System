"""
tasks/payment_tasks.py

WifiBill — Celery tasks for payment verification and lifecycle management.

Tasks:
    poll_pending_payments      Beat: query Daraja for payments stuck in 'pending'
    cancel_stale_payments      Beat: mark very old pending payments as cancelled
    send_payment_confirmation  On-demand: notify customer after a successful payment
"""

import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# poll_pending_payments  (beat: every 3 minutes)
# ---------------------------------------------------------------------------

@shared_task(name="tasks.payment_tasks.poll_pending_payments")
def poll_pending_payments() -> dict:
    """
    For any Payment stuck in 'pending' or 'processing' for more than
    2 minutes (callback may have been missed), query Daraja's STK status
    endpoint directly.

    - If Daraja confirms success  → mark completed, fire activate_hotspot_user
    - If Daraja confirms failure  → mark failed
    - If Daraja still processing  → leave alone (will be checked again next run)
    - If payment is > 30 minutes old and still unresolved → cancel it
    """
    from core.models import Payment, TransactionLog
    from services.mpesa import MpesaService, MpesaError
    from tasks.hotspot_tasks import activate_hotspot_user

    now = timezone.now()
    cutoff_pending = now - timedelta(minutes=2)     # old enough to re-check
    cutoff_cancel = now - timedelta(minutes=30)     # too old — cancel

    # Only poll payments that have a CheckoutRequestID (STK was sent)
    pending_qs = Payment.objects.filter(
        status__in=["pending", "processing"],
        checkout_request_id__isnull=False,
        created_at__lte=cutoff_pending,
    ).exclude(checkout_request_id="")

    if not pending_qs.exists():
        return {"polled": 0}

    mpesa = MpesaService()
    completed = 0
    failed = 0
    cancelled = 0
    errors = []

    for payment in pending_qs.select_related("package"):
        # Auto-cancel very stale payments
        if payment.created_at <= cutoff_cancel:
            payment.status = "cancelled"
            payment.result_desc = "Automatically cancelled after 30 minutes."
            payment.save(update_fields=["status", "result_desc"])
            cancelled += 1
            logger.info("Payment %s auto-cancelled (stale).", payment.id)
            continue

        try:
            result = mpesa.query_stk_status(payment.checkout_request_id)
            result_code = result.get("ResultCode")

            TransactionLog.objects.create(
                payment=payment,
                event_type="stk_callback",
                raw_response={"source": "poll", **result},
            )

            if str(result_code) == "0":
                # Confirmed success
                payment.status = "completed"
                payment.paid_at = timezone.now()
                payment.result_code = str(result_code)
                payment.result_desc = result.get("ResultDesc", "")
                payment.save(update_fields=[
                    "status", "paid_at", "result_code", "result_desc"
                ])
                activate_hotspot_user.delay(payment.id)
                completed += 1
                logger.info("Payment %s confirmed via polling.", payment.id)

            elif result_code is not None and str(result_code) != "0":
                # Definitive failure
                payment.status = "failed"
                payment.result_code = str(result_code)
                payment.result_desc = result.get("ResultDesc", "")
                payment.save(update_fields=["status", "result_code", "result_desc"])
                failed += 1
                logger.info(
                    "Payment %s failed (ResultCode=%s): %s",
                    payment.id, result_code, payment.result_desc,
                )
            # else: result_code is None or still processing — leave in pending

        except MpesaError as exc:
            errors.append({"payment_id": payment.id, "error": str(exc)})
            logger.error("poll_pending_payments: Daraja error for Payment %s: %s", payment.id, exc)

    return {
        "polled": pending_qs.count(),
        "completed": completed,
        "failed": failed,
        "cancelled": cancelled,
        "errors": errors,
    }


# ---------------------------------------------------------------------------
# cancel_stale_payments  (beat: once per hour)
# ---------------------------------------------------------------------------

@shared_task(name="tasks.payment_tasks.cancel_stale_payments")
def cancel_stale_payments() -> dict:
    """
    Hard-cancel any payment that has been pending/processing for over 1 hour
    AND has no CheckoutRequestID (STK push was never sent successfully).
    """
    from core.models import Payment

    cutoff = timezone.now() - timedelta(hours=1)
    stale = Payment.objects.filter(
        status__in=["pending", "processing"],
        created_at__lte=cutoff,
        checkout_request_id="",
    )
    count = stale.count()
    stale.update(
        status="cancelled",
        result_desc="Automatically cancelled — no STK push was sent.",
    )
    logger.info("cancel_stale_payments: cancelled %d stale payments.", count)
    return {"cancelled": count}


# ---------------------------------------------------------------------------
# send_payment_confirmation  (on-demand)
# ---------------------------------------------------------------------------

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    name="tasks.payment_tasks.send_payment_confirmation",
)
def send_payment_confirmation(self, payment_id: int) -> dict:
    """
    Send an SMS or email receipt to the customer after a successful payment.

    Wire up to Africa's Talking or an email backend in settings.
    This task is dispatched from activate_hotspot_user once the
    MikroTik provisioning succeeds.
    """
    from core.models import HotspotUser, Payment

    try:
        payment = Payment.objects.select_related(
            "user", "package", "hotspot_user"
        ).get(pk=payment_id, status="completed")
    except Payment.DoesNotExist:
        logger.error("send_payment_confirmation: Payment %s not found.", payment_id)
        return {"error": "Payment not found."}

    try:
        hotspot_user = payment.hotspot_user
    except HotspotUser.DoesNotExist:
        hotspot_user = None

    message = _build_sms(payment, hotspot_user)

    try:
        _send_sms(payment.phone_number, message)
        logger.info("SMS sent to %s for Payment %s.", payment.phone_number, payment_id)
        return {"sms_sent": True, "to": payment.phone_number}
    except Exception as exc:
        logger.error("SMS send failed for Payment %s: %s", payment_id, exc)
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            return {"sms_sent": False, "error": str(exc)}


def _build_sms(payment, hotspot_user=None) -> str:
    """Build an SMS receipt message."""
    lines = [
        f"WifiBill - Payment Confirmed",
        f"Package: {payment.package.name}",
        f"Amount: KES {payment.amount}",
        f"Receipt: {payment.mpesa_receipt_number}",
    ]
    if hotspot_user:
        lines += [
            f"Username: {hotspot_user.username}",
            f"Password: {hotspot_user.password}",
            f"Expires: {hotspot_user.expires_at.strftime('%d %b %Y %H:%M') if hotspot_user.expires_at else 'N/A'}",
        ]
    lines.append("Thank you for using WifiBill!")
    return "\n".join(lines)


def _send_sms(phone_number: str, message: str) -> None:
    """
    Send SMS via Africa's Talking.
    Install:  pip install africastalking
    Settings: AT_USERNAME, AT_API_KEY in backend/.env
    """
    from django.conf import settings

    at_username = getattr(settings, "AT_USERNAME", None)
    at_api_key = getattr(settings, "AT_API_KEY", None)

    if not at_username or not at_api_key:
        logger.warning("Africa's Talking credentials not configured. SMS skipped.")
        return

    import africastalking  # pip install africastalking
    africastalking.initialize(at_username, at_api_key)
    sms = africastalking.SMS
    response = sms.send(message, [f"+{phone_number}"])
    logger.debug("AT SMS response: %s", response)