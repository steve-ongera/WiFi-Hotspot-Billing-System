"""
core/serializers.py

WifiBill — all serializers for the single "core" app.

Covers:
  - Auth (register, login, token refresh, password change)
  - User / profile
  - Package
  - Voucher (admin create + customer redeem)
  - Payment (initiate STK push, M-Pesa callback)
  - HotspotUser
  - Session & BandwidthUsage
"""

import re

from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    BandwidthUsage,
    HotspotUser,
    Package,
    Payment,
    Session,
    TransactionLog,
    User,
    Voucher,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalize_phone(raw: str) -> str:
    """
    Accepts 07xx, +2547xx, 2547xx and returns 2547XXXXXXXX (12 digits).
    """
    raw = raw.strip().replace(" ", "").replace("-", "")
    if raw.startswith("+"):
        raw = raw[1:]
    if raw.startswith("07") or raw.startswith("01"):
        raw = "254" + raw[1:]
    if re.match(r"^254(7|1)\d{8}$", raw):
        return raw
    raise serializers.ValidationError(
        "Invalid phone number. Use 07XXXXXXXX, 01XXXXXXXX, or 2547XXXXXXXX format."
    )


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True)
    tokens = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "phone_number", "email", "first_name", "last_name",
            "password", "password_confirm", "tokens",
        ]
        extra_kwargs = {
            "email": {"required": False, "allow_blank": True},
            "first_name": {"required": False, "allow_blank": True},
            "last_name": {"required": False, "allow_blank": True},
        }

    def validate_phone_number(self, value):
        return normalize_phone(value)

    def validate_email(self, value):
        if value and User.objects.filter(email=value).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value or None

    def validate(self, data):
        if data["password"] != data.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return data

    def create(self, validated_data):
        return User.objects.create_user(
            phone_number=validated_data["phone_number"],
            email=validated_data.get("email"),
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
        )

    def get_tokens(self, user):
        refresh = RefreshToken.for_user(user)
        return {"refresh": str(refresh), "access": str(refresh.access_token)}


class LoginSerializer(serializers.Serializer):
    """Accepts phone_number OR email as `identifier`."""

    identifier = serializers.CharField(help_text="Phone number or email address")
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        identifier = data["identifier"].strip()
        password = data["password"]
        user = None

        if "@" in identifier:
            try:
                user_obj = User.objects.get(email=identifier)
                user = authenticate(
                    request=self.context.get("request"),
                    phone_number=user_obj.phone_number,
                    password=password,
                )
            except User.DoesNotExist:
                pass
        else:
            try:
                phone = normalize_phone(identifier)
                user = authenticate(
                    request=self.context.get("request"),
                    phone_number=phone,
                    password=password,
                )
            except serializers.ValidationError:
                pass

        if not user:
            raise serializers.ValidationError(
                "Invalid credentials. Check your phone number / email and password."
            )
        if user.is_suspended:
            raise serializers.ValidationError("This account has been suspended.")

        data["user"] = user
        return data


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=6)

    def validate_old_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


# ---------------------------------------------------------------------------
# User / Profile
# ---------------------------------------------------------------------------

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "phone_number", "email", "first_name", "last_name",
            "role", "id_number", "mac_address", "is_suspended",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "role", "is_suspended", "created_at", "updated_at"]

    def validate_phone_number(self, value):
        return normalize_phone(value)


class AdminUserSerializer(UserSerializer):
    """Exposes role and is_suspended for admin writes."""

    class Meta(UserSerializer.Meta):
        read_only_fields = ["id", "created_at", "updated_at"]


# ---------------------------------------------------------------------------
# Package
# ---------------------------------------------------------------------------

class PackageSerializer(serializers.ModelSerializer):
    plan_category = serializers.ReadOnlyField()
    mikrotik_rate_limit = serializers.ReadOnlyField()

    class Meta:
        model = Package
        fields = [
            "id", "name", "description", "price",
            "duration_value", "duration_unit",
            "device_limit", "speed_limit_up", "speed_limit_down", "data_limit_mb",
            "is_active", "plan_category", "mikrotik_rate_limit",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# ---------------------------------------------------------------------------
# Voucher
# ---------------------------------------------------------------------------

class VoucherSerializer(serializers.ModelSerializer):
    package_name = serializers.ReadOnlyField(source="package.name")
    is_valid = serializers.ReadOnlyField()
    is_expired = serializers.ReadOnlyField()

    class Meta:
        model = Voucher
        fields = [
            "id", "package", "package_name", "code",
            "is_used", "used_by", "used_at", "expires_at",
            "is_valid", "is_expired", "created_at",
        ]
        read_only_fields = ["id", "is_used", "used_by", "used_at", "created_at"]


class RedeemVoucherSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=20)
    mac_address = serializers.CharField(max_length=17, required=False, allow_blank=True)

    def validate_code(self, value):
        try:
            voucher = Voucher.objects.select_related("package").get(code=value.upper())
        except Voucher.DoesNotExist:
            raise serializers.ValidationError("Voucher code not found.")
        if not voucher.is_valid:
            raise serializers.ValidationError("This voucher has already been used or has expired.")
        self._voucher = voucher
        return value

    def save(self, user):
        voucher = self._voucher
        voucher.is_used = True
        voucher.used_by = user
        voucher.used_at = timezone.now()
        voucher.save(update_fields=["is_used", "used_by", "used_at"])
        hotspot_user = HotspotUser.objects.create(
            user=user,
            package=voucher.package,
            voucher=voucher,
            mac_address=self.validated_data.get("mac_address", ""),
        )
        hotspot_user.activate()
        return hotspot_user


# ---------------------------------------------------------------------------
# Payment
# ---------------------------------------------------------------------------

class InitiatePaymentSerializer(serializers.Serializer):
    package_id = serializers.PrimaryKeyRelatedField(
        queryset=Package.objects.filter(is_active=True), source="package"
    )
    phone_number = serializers.CharField(required=False, allow_blank=True)
    mac_address = serializers.CharField(max_length=17, required=False, allow_blank=True)

    def validate_phone_number(self, value):
        return normalize_phone(value) if value else value

    def validate(self, data):
        if not data.get("phone_number"):
            data["phone_number"] = self.context["request"].user.phone_number
        return data


class PaymentSerializer(serializers.ModelSerializer):
    package_name = serializers.ReadOnlyField(source="package.name")
    package_price = serializers.ReadOnlyField(source="package.price")

    class Meta:
        model = Payment
        fields = [
            "id", "user", "package", "package_name", "package_price",
            "amount", "phone_number", "mac_address",
            "merchant_request_id", "checkout_request_id", "mpesa_receipt_number",
            "status", "payment_method", "result_code", "result_desc",
            "created_at", "paid_at",
        ]
        read_only_fields = [
            "id", "user", "package", "package_name", "package_price",
            "amount", "phone_number", "mac_address",
            "merchant_request_id", "checkout_request_id", "mpesa_receipt_number",
            "status", "payment_method", "result_code", "result_desc",
            "created_at", "paid_at",
        ]


class MpesaCallbackSerializer(serializers.Serializer):
    Body = serializers.DictField()

    def validate_Body(self, value):
        stk = value.get("stkCallback")
        if not stk:
            raise serializers.ValidationError("Missing stkCallback in Body.")
        if "MerchantRequestID" not in stk or "CheckoutRequestID" not in stk:
            raise serializers.ValidationError("Missing required STK callback fields.")
        return value


class TransactionLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionLog
        fields = ["id", "payment", "event_type", "raw_response", "created_at"]
        read_only_fields = ["id", "payment", "event_type", "raw_response", "created_at"]


# ---------------------------------------------------------------------------
# HotspotUser
# ---------------------------------------------------------------------------

class HotspotUserSerializer(serializers.ModelSerializer):
    package_name = serializers.ReadOnlyField(source="package.name")
    is_expired = serializers.ReadOnlyField()
    is_currently_active = serializers.ReadOnlyField()
    time_remaining_seconds = serializers.SerializerMethodField()

    class Meta:
        model = HotspotUser
        fields = [
            "id", "user", "package", "package_name", "payment", "voucher",
            "username", "mac_address", "ip_address", "shared_users",
            "is_active", "mikrotik_synced",
            "activated_at", "expires_at", "created_at",
            "is_expired", "is_currently_active", "time_remaining_seconds",
        ]
        read_only_fields = [f for f in fields if f != "mac_address"]

    def get_time_remaining_seconds(self, obj):
        return int(obj.time_remaining.total_seconds())


# ---------------------------------------------------------------------------
# Session & Bandwidth
# ---------------------------------------------------------------------------

class SessionSerializer(serializers.ModelSerializer):
    duration_seconds = serializers.SerializerMethodField()
    total_bytes = serializers.ReadOnlyField()

    class Meta:
        model = Session
        fields = [
            "id", "hotspot_user", "session_id", "ip_address", "mac_address",
            "bytes_in", "bytes_out", "total_bytes",
            "started_at", "ended_at", "duration_seconds",
        ]
        read_only_fields = [
            "id", "hotspot_user", "session_id", "ip_address", "mac_address",
            "bytes_in", "bytes_out", "total_bytes",
            "started_at", "ended_at", "duration_seconds",
        ]

    def get_duration_seconds(self, obj):
        return int(obj.duration.total_seconds())


class BandwidthUsageSerializer(serializers.ModelSerializer):
    class Meta:
        model = BandwidthUsage
        fields = ["id", "hotspot_user", "bytes_in", "bytes_out", "recorded_at"]
        read_only_fields = ["id", "hotspot_user", "bytes_in", "bytes_out", "recorded_at"]