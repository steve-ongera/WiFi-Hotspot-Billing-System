"""
core/models.py

WifiBill — single-app data model (one app: "core").

DESIGN DECISIONS
-----------------
1. ONE APP, ONE models.py
   Everything from the README's separate apps (accounts, packages,
   payments, hotspot, reports) lives here as model classes in a single
   "core" app. Remember to set:

       AUTH_USER_MODEL = "core.User"

   in settings.py, and add "core" to INSTALLED_APPS.

2. LOGIN BY EMAIL OR PHONE NUMBER
   `phone_number` is required + unique (every customer needs one for
   M-Pesa STK push) and is USERNAME_FIELD. `email` is optional + unique.
   The login serializer/view (added later) will accept an "identifier"
   field and look the user up by phone_number OR email, then check the
   password — so either works at login time.

3. PLAN TYPES VIA `device_limit`
   This is the field that distinguishes a "single user" plan from a
   "hotspot for many people" plan:
       device_limit = 1   -> Personal plan, one device at a time
       device_limit = 2-8 -> Shared/Hotspot plan, that many devices can
                              use the same username/password at once
   On MikroTik this maps directly to the hotspot user profile's
   `shared-users` setting.

4. TIME-BASED EXPIRY STARTS AT ACTIVATION
   A package only defines duration_value/duration_unit (e.g. "1 hour",
   "24 hours", "7 days"). The actual countdown (`expires_at`) is set on
   HotspotUser when `.activate()` is called — i.e. the moment payment is
   confirmed / the account is switched on. So "1 Hour" always means
   exactly 1 hour from that moment, regardless of when it was purchased.
"""

import uuid
from datetime import timedelta

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone


# ---------------------------------------------------------------------------
# Validators
# ---------------------------------------------------------------------------

# Daraja expects MSISDN in 2547XXXXXXXX / 2541XXXXXXXX format (12 digits).
# Normalisation of 07xx / +254 input happens in serializers, not here.
phone_validator = RegexValidator(
    regex=r"^254(7|1)\d{8}$",
    message="Phone number must be in the format 2547XXXXXXXX or 2541XXXXXXXX",
)

mac_address_validator = RegexValidator(
    regex=r"^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$",
    message="Enter a valid MAC address, e.g. AA:BB:CC:DD:EE:FF",
)


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class UserManager(BaseUserManager):
    """Custom manager — `username` is removed in favour of phone_number."""

    use_in_migrations = True

    def _create_user(self, phone_number, email, password, **extra_fields):
        if not phone_number:
            raise ValueError("Users must have a phone number")
        if email:
            email = self.normalize_email(email)
        user = self.model(phone_number=phone_number, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, phone_number, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", "customer")
        return self._create_user(phone_number, email, password, **extra_fields)

    def create_superuser(self, phone_number, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "admin")
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")
        return self._create_user(phone_number, email, password, **extra_fields)


class User(AbstractUser):
    """
    Custom user model covering both customers and admins (role field).
    Plays the role of README's separate `User` + `Customer` models —
    merged into one since this build uses a single app.
    """

    ROLE_CHOICES = [
        ("admin", "Admin"),
        ("customer", "Customer"),
    ]

    username = None  # not used — phone_number is the identifier
    first_name = models.CharField(max_length=60, blank=True)
    last_name = models.CharField(max_length=60, blank=True)

    email = models.EmailField(unique=True, null=True, blank=True)
    phone_number = models.CharField(
        max_length=12, unique=True, validators=[phone_validator]
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="customer")

    # Profile / account-holder fields
    id_number = models.CharField(max_length=20, blank=True)
    mac_address = models.CharField(
        max_length=17, blank=True, validators=[mac_address_validator],
        help_text="Optional: bind this account to a specific device",
    )
    is_suspended = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "phone_number"
    REQUIRED_FIELDS = []  # email is optional, validated separately if provided

    objects = UserManager()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        full_name = self.get_full_name().strip()
        return full_name or self.phone_number

    @property
    def is_admin(self):
        return self.role == "admin" or self.is_superuser


# ---------------------------------------------------------------------------
# Package (Plan)
# ---------------------------------------------------------------------------

class Package(models.Model):
    """
    A purchasable internet plan.

    Examples this model is meant to express:
      - "1 Hour Single Device" -> duration_value=1, duration_unit=hours,
                                   device_limit=1
      - "Daily Hotspot (5 devices)" -> duration_value=1, duration_unit=days,
                                        device_limit=5
      - "Weekly Office Hotspot (8 devices)" -> duration_value=7,
                                        duration_unit=days, device_limit=8
    """

    DURATION_UNIT_CHOICES = [
        ("minutes", "Minutes"),
        ("hours", "Hours"),
        ("days", "Days"),
    ]

    name = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    duration_value = models.PositiveIntegerField(help_text="e.g. 1, 24, 7")
    duration_unit = models.CharField(
        max_length=10, choices=DURATION_UNIT_CHOICES, default="hours"
    )

    device_limit = models.PositiveSmallIntegerField(
        default=1,
        help_text=(
            "Max simultaneous devices allowed on one login. "
            "1 = single-user plan, 2+ = shared/hotspot plan "
            "(maps to MikroTik 'shared-users')."
        ),
    )

    speed_limit_up = models.PositiveIntegerField(
        default=0, help_text="Upload limit in Mbps (0 = unlimited)"
    )
    speed_limit_down = models.PositiveIntegerField(
        default=0, help_text="Download limit in Mbps (0 = unlimited)"
    )
    data_limit_mb = models.PositiveBigIntegerField(
        null=True, blank=True, help_text="Data cap in MB (blank = unlimited)"
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["price"]

    def __str__(self):
        return f"{self.name} (KES {self.price})"

    @property
    def is_shared(self):
        return self.device_limit > 1

    @property
    def plan_category(self):
        return "Shared Hotspot" if self.is_shared else "Single User"

    @property
    def duration_timedelta(self):
        """Convert duration_value/duration_unit into a timedelta."""
        if self.duration_unit == "minutes":
            return timedelta(minutes=self.duration_value)
        if self.duration_unit == "hours":
            return timedelta(hours=self.duration_value)
        if self.duration_unit == "days":
            return timedelta(days=self.duration_value)
        return timedelta()

    @property
    def mikrotik_rate_limit(self):
        """MikroTik rate-limit string: 'upload/download', e.g. '2M/5M'."""
        up = f"{self.speed_limit_up}M" if self.speed_limit_up else "0"
        down = f"{self.speed_limit_down}M" if self.speed_limit_down else "0"
        return f"{up}/{down}"


# ---------------------------------------------------------------------------
# Voucher (offline / pre-paid codes)
# ---------------------------------------------------------------------------

class Voucher(models.Model):
    package = models.ForeignKey(
        Package, on_delete=models.CASCADE, related_name="vouchers"
    )
    code = models.CharField(max_length=20, unique=True)
    is_used = models.BooleanField(default=False)
    used_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="redeemed_vouchers",
    )
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.code

    @property
    def is_expired(self):
        return bool(self.expires_at and timezone.now() >= self.expires_at)

    @property
    def is_valid(self):
        return not self.is_used and not self.is_expired


# ---------------------------------------------------------------------------
# Payment (M-Pesa)
# ---------------------------------------------------------------------------

class Payment(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    ]
    METHOD_CHOICES = [
        ("mpesa", "M-Pesa"),
        ("voucher", "Voucher"),
        ("cash", "Cash"),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="payments",
        null=True, blank=True,
        help_text="Null for guest/anonymous purchases before account exists",
    )
    package = models.ForeignKey(
        Package, on_delete=models.PROTECT, related_name="payments"
    )

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    phone_number = models.CharField(max_length=12, validators=[phone_validator])
    mac_address = models.CharField(
        max_length=17, blank=True, validators=[mac_address_validator],
        help_text="Device MAC to activate on the hotspot once payment clears",
    )

    merchant_request_id = models.CharField(max_length=100, blank=True)
    checkout_request_id = models.CharField(max_length=100, blank=True, db_index=True)
    mpesa_receipt_number = models.CharField(max_length=50, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    payment_method = models.CharField(
        max_length=20, choices=METHOD_CHOICES, default="mpesa"
    )

    result_code = models.CharField(max_length=10, blank=True)
    result_desc = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.phone_number} -> {self.package.name} ({self.status})"


class TransactionLog(models.Model):
    """Raw audit trail of every STK push / callback / activation event."""

    EVENT_CHOICES = [
        ("stk_push", "STK Push Request"),
        ("stk_callback", "STK Push Callback"),
        ("activation", "Hotspot Activation"),
        ("error", "Error"),
    ]

    payment = models.ForeignKey(
        Payment, on_delete=models.CASCADE, related_name="logs",
        null=True, blank=True,
    )
    event_type = models.CharField(max_length=50, choices=EVENT_CHOICES)
    raw_response = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.event_type} @ {self.created_at:%Y-%m-%d %H:%M}"


# ---------------------------------------------------------------------------
# HotspotUser, Session, BandwidthUsage
# ---------------------------------------------------------------------------

def generate_hotspot_username():
    return f"WB{uuid.uuid4().hex[:8].upper()}"


def generate_hotspot_password():
    return uuid.uuid4().hex[:8]


class HotspotUser(models.Model):
    """
    The actual hotspot account provisioned on MikroTik for a customer's
    purchase. One of these is created per Payment (or per Voucher redeem).

    `expires_at` is ONLY set once, by `activate()`:

        expires_at = activated_at + package.duration_timedelta

    So a 1-hour package always expires exactly 1 hour after activation —
    not 1 hour after purchase, in case there's a delay before the user
    actually connects.
    """

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="hotspot_accounts",
        null=True, blank=True,
    )
    package = models.ForeignKey(
        Package, on_delete=models.PROTECT, related_name="hotspot_users"
    )
    payment = models.OneToOneField(
        Payment, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="hotspot_user",
    )
    voucher = models.OneToOneField(
        Voucher, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="hotspot_user",
    )

    username = models.CharField(
        max_length=100, unique=True, default=generate_hotspot_username
    )
    password = models.CharField(max_length=100, default=generate_hotspot_password)

    mac_address = models.CharField(
        max_length=17, blank=True, validators=[mac_address_validator]
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    # Snapshot of package.device_limit taken at activation time, so a later
    # change to the package definition doesn't retroactively affect a live
    # account.
    shared_users = models.PositiveSmallIntegerField(default=1)

    is_active = models.BooleanField(default=False)
    mikrotik_synced = models.BooleanField(default=False)

    activated_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.username} ({self.package.name})"

    @property
    def is_expired(self):
        return bool(self.expires_at and timezone.now() >= self.expires_at)

    @property
    def is_currently_active(self):
        """True only while the account is switched on AND not expired."""
        return self.is_active and not self.is_expired

    @property
    def time_remaining(self):
        if not self.expires_at:
            return timedelta(0)
        remaining = self.expires_at - timezone.now()
        return remaining if remaining.total_seconds() > 0 else timedelta(0)

    def activate(self, save=True):
        """
        Start the package's validity countdown NOW. Call this the moment
        payment is confirmed (Celery task / M-Pesa callback handler).
        """
        now = timezone.now()
        self.activated_at = now
        self.expires_at = now + self.package.duration_timedelta
        self.shared_users = self.package.device_limit
        self.is_active = True
        if save:
            self.save(update_fields=[
                "activated_at", "expires_at", "shared_users", "is_active",
            ])

    def deactivate(self, save=True):
        self.is_active = False
        if save:
            self.save(update_fields=["is_active"])


class Session(models.Model):
    """A single connect/disconnect window for a HotspotUser."""

    hotspot_user = models.ForeignKey(
        HotspotUser, on_delete=models.CASCADE, related_name="sessions"
    )
    session_id = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    mac_address = models.CharField(
        max_length=17, blank=True, validators=[mac_address_validator]
    )
    bytes_in = models.BigIntegerField(default=0)
    bytes_out = models.BigIntegerField(default=0)
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    @property
    def total_bytes(self):
        return self.bytes_in + self.bytes_out

    @property
    def duration(self):
        end = self.ended_at or timezone.now()
        return end - self.started_at


class BandwidthUsage(models.Model):
    """Periodic snapshot of a HotspotUser's cumulative usage (for charts)."""

    hotspot_user = models.ForeignKey(
        HotspotUser, on_delete=models.CASCADE, related_name="bandwidth_logs"
    )
    bytes_in = models.BigIntegerField(default=0)
    bytes_out = models.BigIntegerField(default=0)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-recorded_at"]

    def __str__(self):
        return f"{self.hotspot_user.username} @ {self.recorded_at:%Y-%m-%d %H:%M}"