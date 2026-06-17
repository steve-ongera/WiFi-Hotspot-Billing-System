"""
core/management/commands/seed_data.py

Usage:
    python manage.py seed_data           # seed everything (idempotent)
    python manage.py seed_data --flush   # wipe & re-seed from scratch
"""

import random
import string
import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import (
    BandwidthUsage,
    HotspotUser,
    Package,
    Payment,
    Session,
    TransactionLog,
    Voucher,
)

User = get_user_model()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def random_phone():
    """Random Kenyan MSISDN in Daraja format: 2547XXXXXXXX or 2541XXXXXXXX."""
    prefix = random.choice(["2547", "2541"])
    suffix = "".join(random.choices(string.digits, k=8))
    return f"{prefix}{suffix}"


def random_mac():
    parts = [f"{random.randint(0, 255):02X}" for _ in range(6)]
    return ":".join(parts)


def random_ip():
    return f"192.168.{random.randint(1, 10)}.{random.randint(2, 254)}"


def random_mpesa_receipt():
    prefix = random.choice(["QFH", "QGH", "RBH", "QJT", "RMN"])
    return prefix + "".join(random.choices(string.ascii_uppercase + string.digits, k=7))


def generate_voucher_code():
    groups = ["".join(random.choices(string.ascii_uppercase + string.digits, k=4)) for _ in range(3)]
    return "-".join(groups)


# ---------------------------------------------------------------------------
# Seed blocks
# ---------------------------------------------------------------------------

PACKAGES = [
    # Personal plans
    dict(
        name="30 Min Trial",
        description="Quick browsing trial — 1 device",
        price="10.00",
        duration_value=30,
        duration_unit="minutes",
        device_limit=1,
        speed_limit_up=2,
        speed_limit_down=5,
        data_limit_mb=200,
    ),
    dict(
        name="1 Hour Personal",
        description="1-hour personal plan — 1 device",
        price="20.00",
        duration_value=1,
        duration_unit="hours",
        device_limit=1,
        speed_limit_up=5,
        speed_limit_down=10,
        data_limit_mb=None,
    ),
    dict(
        name="3 Hour Personal",
        description="3-hour personal plan — 1 device",
        price="50.00",
        duration_value=3,
        duration_unit="hours",
        device_limit=1,
        speed_limit_up=5,
        speed_limit_down=10,
        data_limit_mb=None,
    ),
    dict(
        name="Daily Personal",
        description="24-hour personal plan — 1 device",
        price="100.00",
        duration_value=1,
        duration_unit="days",
        device_limit=1,
        speed_limit_up=5,
        speed_limit_down=20,
        data_limit_mb=None,
    ),
    dict(
        name="Weekly Personal",
        description="7-day personal plan — 1 device",
        price="500.00",
        duration_value=7,
        duration_unit="days",
        device_limit=1,
        speed_limit_up=10,
        speed_limit_down=20,
        data_limit_mb=None,
    ),
    dict(
        name="Monthly Personal",
        description="30-day personal plan — 1 device",
        price="1500.00",
        duration_value=30,
        duration_unit="days",
        device_limit=1,
        speed_limit_up=10,
        speed_limit_down=30,
        data_limit_mb=None,
    ),
    # Shared/Hotspot plans
    dict(
        name="Hourly Shared (3 Devices)",
        description="1-hour hotspot — up to 3 devices",
        price="60.00",
        duration_value=1,
        duration_unit="hours",
        device_limit=3,
        speed_limit_up=5,
        speed_limit_down=10,
        data_limit_mb=None,
    ),
    dict(
        name="Daily Shared (5 Devices)",
        description="24-hour hotspot — up to 5 devices",
        price="300.00",
        duration_value=1,
        duration_unit="days",
        device_limit=5,
        speed_limit_up=10,
        speed_limit_down=20,
        data_limit_mb=None,
    ),
    dict(
        name="Weekly Office (8 Devices)",
        description="7-day office hotspot — up to 8 devices",
        price="1200.00",
        duration_value=7,
        duration_unit="days",
        device_limit=8,
        speed_limit_up=20,
        speed_limit_down=50,
        data_limit_mb=None,
    ),
    dict(
        name="Monthly Business (8 Devices)",
        description="30-day business plan — up to 8 devices",
        price="3500.00",
        duration_value=30,
        duration_unit="days",
        device_limit=8,
        speed_limit_up=20,
        speed_limit_down=50,
        data_limit_mb=None,
    ),
]

CUSTOMERS = [
    dict(first_name="Amina",   last_name="Wanjiku",  phone_number="254712345601", email="amina.wanjiku@gmail.com"),
    dict(first_name="Brian",   last_name="Ochieng",  phone_number="254712345602", email="brian.ochieng@gmail.com"),
    dict(first_name="Cynthia", last_name="Njeri",    phone_number="254712345603", email="cynthia.njeri@outlook.com"),
    dict(first_name="David",   last_name="Kamau",    phone_number="254712345604", email="david.kamau@gmail.com"),
    dict(first_name="Esther",  last_name="Muthoni",  phone_number="254712345605", email="esther.muthoni@yahoo.com"),
    dict(first_name="Felix",   last_name="Onyango",  phone_number="254712345606", email="felix.onyango@gmail.com"),
    dict(first_name="Grace",   last_name="Adhiambo", phone_number="254712345607", email="grace.adhiambo@gmail.com"),
    dict(first_name="Hassan",  last_name="Mwangi",   phone_number="254712345608", email="hassan.mwangi@gmail.com"),
    dict(first_name="Irene",   last_name="Chebet",   phone_number="254712345609", email="irene.chebet@outlook.com"),
    dict(first_name="James",   last_name="Kiprotich",phone_number="254712345610", email="james.kiprotich@gmail.com"),
]


class Command(BaseCommand):
    help = "Seed the WifiBill database with packages, users, vouchers, and sample transactions."

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete all existing seed data before re-seeding",
        )

    def handle(self, *args, **options):
        if options["flush"]:
            self.stdout.write(self.style.WARNING("Flushing existing data..."))
            BandwidthUsage.objects.all().delete()
            Session.objects.all().delete()
            TransactionLog.objects.all().delete()
            HotspotUser.objects.all().delete()
            Payment.objects.all().delete()
            Voucher.objects.all().delete()
            Package.objects.all().delete()
            User.objects.filter(is_superuser=False).delete()
            self.stdout.write(self.style.SUCCESS("Flush complete.\n"))

        packages = self._seed_packages()
        self._seed_admin()
        customers = self._seed_customers()
        self._seed_vouchers(packages)
        self._seed_payments_and_hotspot_users(customers, packages)

        self.stdout.write(self.style.SUCCESS("\n✅  Seed complete."))

    # ------------------------------------------------------------------
    # Packages
    # ------------------------------------------------------------------

    def _seed_packages(self):
        self.stdout.write("Seeding packages...")
        created = []
        for data in PACKAGES:
            pkg, was_created = Package.objects.get_or_create(
                name=data["name"],
                defaults=data,
            )
            created.append(pkg)
            status = "created" if was_created else "exists"
            self.stdout.write(f"  [{status}] {pkg}")
        return created

    # ------------------------------------------------------------------
    # Admin
    # ------------------------------------------------------------------

    def _seed_admin(self):
        self.stdout.write("Seeding admin user...")
        phone = "254700000000"
        if not User.objects.filter(phone_number=phone).exists():
            User.objects.create_superuser(
                phone_number=phone,
                email="admin@wifibill.co.ke",
                password="admin1234",
                first_name="Super",
                last_name="Admin",
            )
            self.stdout.write(f"  [created] admin (phone: {phone}, pw: admin1234)")
        else:
            self.stdout.write(f"  [exists]  admin {phone}")

    # ------------------------------------------------------------------
    # Customers
    # ------------------------------------------------------------------

    def _seed_customers(self):
        self.stdout.write("Seeding customers...")
        users = []
        for data in CUSTOMERS:
            user, was_created = User.objects.get_or_create(
                phone_number=data["phone_number"],
                defaults={
                    **data,
                    "role": "customer",
                    "id_number": str(random.randint(20000000, 40000000)),
                    "mac_address": random_mac(),
                },
            )
            if was_created:
                user.set_password("customer1234")
                user.save()
            users.append(user)
            status = "created" if was_created else "exists"
            self.stdout.write(f"  [{status}] {user}")
        return users

    # ------------------------------------------------------------------
    # Vouchers
    # ------------------------------------------------------------------

    def _seed_vouchers(self, packages):
        self.stdout.write("Seeding vouchers...")

        # 5 unused vouchers across cheap plans
        cheap_plans = [p for p in packages if float(p.price) <= 100]
        for _ in range(5):
            pkg = random.choice(cheap_plans)
            Voucher.objects.get_or_create(
                code=generate_voucher_code(),
                defaults=dict(
                    package=pkg,
                    expires_at=timezone.now() + timedelta(days=30),
                ),
            )

        # 3 already-used vouchers
        used_plan = next(p for p in packages if p.device_limit == 1 and p.duration_unit == "hours" and p.duration_value == 1)
        for i in range(3):
            code = generate_voucher_code()
            v, created = Voucher.objects.get_or_create(
                code=code,
                defaults=dict(
                    package=used_plan,
                    is_used=True,
                    used_at=timezone.now() - timedelta(hours=random.randint(1, 48)),
                    expires_at=timezone.now() + timedelta(days=30),
                ),
            )
            if created:
                self.stdout.write(f"  [created] voucher {v.code} (used)")

        # 2 expired vouchers
        expired_plan = random.choice(cheap_plans)
        for _ in range(2):
            Voucher.objects.get_or_create(
                code=generate_voucher_code(),
                defaults=dict(
                    package=expired_plan,
                    expires_at=timezone.now() - timedelta(days=1),
                ),
            )

        self.stdout.write(f"  vouchers seeded.")

    # ------------------------------------------------------------------
    # Payments, HotspotUsers, Sessions, Bandwidth
    # ------------------------------------------------------------------

    def _seed_payments_and_hotspot_users(self, customers, packages):
        self.stdout.write("Seeding payments, hotspot accounts & sessions...")
        now = timezone.now()

        for customer in customers:
            # Give each customer 1–3 purchases
            num_purchases = random.randint(1, 3)
            for _ in range(num_purchases):
                pkg = random.choice(packages)
                purchased_at = now - timedelta(hours=random.randint(1, 720))

                # --- Payment ---
                receipt = random_mpesa_receipt()
                payment = Payment.objects.create(
                    user=customer,
                    package=pkg,
                    amount=pkg.price,
                    phone_number=customer.phone_number,
                    mac_address=customer.mac_address,
                    merchant_request_id=f"MR-{uuid.uuid4().hex[:12].upper()}",
                    checkout_request_id=f"ws_CO_{uuid.uuid4().hex[:16].upper()}",
                    mpesa_receipt_number=receipt,
                    status="completed",
                    payment_method="mpesa",
                    result_code="0",
                    result_desc="The service request is processed successfully.",
                    paid_at=purchased_at,
                    created_at=purchased_at,
                )

                # Backdate created_at (auto_now_add doesn't allow this via create)
                Payment.objects.filter(pk=payment.pk).update(created_at=purchased_at, paid_at=purchased_at)

                # --- TransactionLog: STK push + callback ---
                TransactionLog.objects.create(
                    payment=payment,
                    event_type="stk_push",
                    raw_response={
                        "MerchantRequestID": payment.merchant_request_id,
                        "CheckoutRequestID": payment.checkout_request_id,
                        "ResponseCode": "0",
                        "ResponseDescription": "Success. Request accepted for processing",
                        "CustomerMessage": "Success. Request accepted for processing",
                    },
                )
                TransactionLog.objects.create(
                    payment=payment,
                    event_type="stk_callback",
                    raw_response={
                        "MerchantRequestID": payment.merchant_request_id,
                        "CheckoutRequestID": payment.checkout_request_id,
                        "ResultCode": 0,
                        "ResultDesc": "The service request is processed successfully.",
                        "CallbackMetadata": {
                            "Item": [
                                {"Name": "Amount", "Value": float(pkg.price)},
                                {"Name": "MpesaReceiptNumber", "Value": receipt},
                                {"Name": "PhoneNumber", "Value": int(customer.phone_number)},
                            ]
                        },
                    },
                )

                # --- HotspotUser ---
                hotspot_user = HotspotUser.objects.create(
                    user=customer,
                    package=pkg,
                    payment=payment,
                    mac_address=customer.mac_address,
                    ip_address=random_ip(),
                    shared_users=pkg.device_limit,
                )

                # Activate — sets activated_at, expires_at
                activated_at = purchased_at + timedelta(minutes=random.randint(1, 10))
                hotspot_user.activated_at = activated_at
                hotspot_user.expires_at = activated_at + pkg.duration_timedelta
                hotspot_user.is_active = hotspot_user.expires_at > now
                hotspot_user.mikrotik_synced = True
                hotspot_user.save()

                TransactionLog.objects.create(
                    payment=payment,
                    event_type="activation",
                    raw_response={
                        "hotspot_username": hotspot_user.username,
                        "activated_at": activated_at.isoformat(),
                        "expires_at": hotspot_user.expires_at.isoformat(),
                        "mikrotik_synced": True,
                    },
                )

                # --- Sessions (1–3 per hotspot account) ---
                session_start = activated_at
                for _ in range(random.randint(1, 3)):
                    duration_secs = random.randint(60, int(pkg.duration_timedelta.total_seconds() * 0.8) or 3600)
                    session_end = session_start + timedelta(seconds=duration_secs)
                    if session_end > (hotspot_user.expires_at or now):
                        session_end = hotspot_user.expires_at or now

                    bytes_in = random.randint(1_000_000, 200_000_000)
                    bytes_out = random.randint(100_000, 20_000_000)

                    session = Session.objects.create(
                        hotspot_user=hotspot_user,
                        session_id=uuid.uuid4().hex,
                        ip_address=hotspot_user.ip_address,
                        mac_address=hotspot_user.mac_address,
                        bytes_in=bytes_in,
                        bytes_out=bytes_out,
                        started_at=session_start,
                        ended_at=session_end if not hotspot_user.is_active else None,
                    )

                    # Bandwidth snapshot
                    BandwidthUsage.objects.create(
                        hotspot_user=hotspot_user,
                        bytes_in=bytes_in,
                        bytes_out=bytes_out,
                    )

                    session_start = session_end + timedelta(minutes=random.randint(5, 60))
                    if session_start >= (hotspot_user.expires_at or now):
                        break

        self.stdout.write(f"  Payments & hotspot accounts seeded for {len(customers)} customers.")