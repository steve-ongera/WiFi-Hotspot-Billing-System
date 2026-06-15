"""
core/views.py

WifiBill — all API views for the single "core" app.

Covers:
  - Auth    (register, login, refresh, logout, profile, change-password)
  - Packages (list, create, retrieve, update, delete)
  - Payments (initiate STK push, M-Pesa callback, status poll, history,
               receipt, admin all-payments, voucher redeem)
  - Hotspot  (my-session, online-users, disconnect, suspend, activate)
  - Customers (admin CRUD)
  - Vouchers  (admin list, generate bulk, delete)
  - Reports   (revenue, bandwidth, active-users, dashboard-stats)
"""

import logging
from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

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
from .permissions import IsAdmin, IsAdminOrOwner
from .serializers import (
    AdminUserSerializer,
    BandwidthUsageSerializer,
    ChangePasswordSerializer,
    HotspotUserSerializer,
    InitiatePaymentSerializer,
    LoginSerializer,
    MpesaCallbackSerializer,
    PackageSerializer,
    PaymentSerializer,
    RegisterSerializer,
    RedeemVoucherSerializer,
    SessionSerializer,
    TransactionLogSerializer,
    UserSerializer,
    VoucherSerializer,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def success(data=None, message="Success", status_code=status.HTTP_200_OK):
    return Response(
        {"success": True, "message": message, "data": data, "errors": None},
        status=status_code,
    )


def error(message="Error", errors=None, status_code=status.HTTP_400_BAD_REQUEST):
    return Response(
        {"success": False, "message": message, "data": None, "errors": errors},
        status=status_code,
    )


# ---------------------------------------------------------------------------
# Auth Views   /api/auth/
# ---------------------------------------------------------------------------

class RegisterView(APIView):
    """POST /api/auth/register/ — public"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            user = serializer.save()
            return success(
                data=RegisterSerializer(user, context={"request": request}).data,
                message="Account created successfully.",
                status_code=status.HTTP_201_CREATED,
            )
        return error("Registration failed.", serializer.errors)


class LoginView(APIView):
    """POST /api/auth/login/ — public"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            user = serializer.validated_data["user"]
            refresh = RefreshToken.for_user(user)
            return success(
                data={
                    "user": UserSerializer(user).data,
                    "tokens": {
                        "refresh": str(refresh),
                        "access": str(refresh.access_token),
                    },
                },
                message="Logged in successfully.",
            )
        return error("Login failed.", serializer.errors, status.HTTP_401_UNAUTHORIZED)


class LogoutView(APIView):
    """POST /api/auth/logout/ — blacklists refresh token"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return error("Refresh token is required.")
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return success(message="Logged out successfully.")
        except Exception as exc:
            return error(str(exc))


class ProfileView(APIView):
    """GET / PATCH /api/auth/profile/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return success(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(
            request.user, data=request.data, partial=True, context={"request": request}
        )
        if serializer.is_valid():
            serializer.save()
            return success(serializer.data, "Profile updated.")
        return error("Update failed.", serializer.errors)


class ChangePasswordView(APIView):
    """POST /api/auth/change-password/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            serializer.save()
            return success(message="Password changed successfully.")
        return error("Password change failed.", serializer.errors)


# ---------------------------------------------------------------------------
# Package Views   /api/packages/
# ---------------------------------------------------------------------------

class PackageListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/packages/  — public (active only)
    POST /api/packages/  — admin only
    """
    serializer_class = PackageSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAdmin()]
        return [AllowAny()]

    def get_queryset(self):
        qs = Package.objects.all()
        if not (self.request.user.is_authenticated and self.request.user.is_admin):
            qs = qs.filter(is_active=True)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return success(serializer.data, "Package created.", status.HTTP_201_CREATED)
        return error("Validation failed.", serializer.errors)

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        serializer = self.get_serializer(qs, many=True)
        return success(serializer.data)


class PackageDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/packages/{id}/  — public
    PUT    /api/packages/{id}/  — admin
    PATCH  /api/packages/{id}/  — admin
    DELETE /api/packages/{id}/  — admin
    """
    queryset = Package.objects.all()
    serializer_class = PackageSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAdmin()]

    def retrieve(self, request, *args, **kwargs):
        return success(self.get_serializer(self.get_object()).data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return success(serializer.data, "Package updated.")
        return error("Validation failed.", serializer.errors)

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return success(message="Package deleted.")


# ---------------------------------------------------------------------------
# Payment Views   /api/payments/
# ---------------------------------------------------------------------------

class InitiatePaymentView(APIView):
    """POST /api/payments/initiate/ — authenticated customer"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = InitiatePaymentSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return error("Validation failed.", serializer.errors)

        package = serializer.validated_data["package"]
        phone_number = serializer.validated_data["phone_number"]
        mac_address = serializer.validated_data.get("mac_address", "")

        # Create pending payment record
        payment = Payment.objects.create(
            user=request.user,
            package=package,
            amount=package.price,
            phone_number=phone_number,
            mac_address=mac_address,
            payment_method="mpesa",
            status="pending",
        )

        # Import here to avoid circular imports with services/
        try:
            from services.mpesa import MpesaService

            mpesa = MpesaService()
            result = mpesa.initiate_stk_push(
                phone=phone_number,
                amount=int(package.price),
                reference=f"WB{payment.id}",
            )

            payment.merchant_request_id = result.get("MerchantRequestID", "")
            payment.checkout_request_id = result.get("CheckoutRequestID", "")
            payment.status = "processing"
            payment.save(update_fields=[
                "merchant_request_id", "checkout_request_id", "status"
            ])

            TransactionLog.objects.create(
                payment=payment,
                event_type="stk_push",
                raw_response=result,
            )

            return success(
                data={
                    "payment_id": payment.id,
                    "checkout_request_id": payment.checkout_request_id,
                    "message": "STK push sent. Enter your M-Pesa PIN.",
                },
                message="Payment initiated.",
                status_code=status.HTTP_201_CREATED,
            )

        except Exception as exc:
            logger.error("STK push error: %s", exc)
            payment.status = "failed"
            payment.save(update_fields=["status"])
            TransactionLog.objects.create(
                payment=payment,
                event_type="error",
                raw_response={"error": str(exc)},
            )
            return error("Failed to initiate M-Pesa payment. Try again.", status_code=status.HTTP_502_BAD_GATEWAY)


class MpesaCallbackView(APIView):
    """
    POST /api/payments/mpesa/callback/
    Safaricom Daraja posts here after the customer enters their PIN.
    This endpoint is public (no auth) but should be IP-whitelisted in production.
    """
    permission_classes = [AllowAny]
    authentication_classes = []  # Safaricom doesn't send JWT

    def post(self, request):
        serializer = MpesaCallbackSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning("Invalid M-Pesa callback payload: %s", request.data)
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        stk_callback = request.data["Body"]["stkCallback"]
        result_code = stk_callback.get("ResultCode")
        checkout_request_id = stk_callback.get("CheckoutRequestID")

        try:
            payment = Payment.objects.get(checkout_request_id=checkout_request_id)
        except Payment.DoesNotExist:
            logger.warning("Callback for unknown checkout ID: %s", checkout_request_id)
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        TransactionLog.objects.create(
            payment=payment,
            event_type="stk_callback",
            raw_response=stk_callback,
        )

        if result_code == 0:
            # Payment successful — extract M-Pesa metadata
            items = {
                item["Name"]: item.get("Value")
                for item in stk_callback.get("CallbackMetadata", {}).get("Item", [])
            }
            payment.mpesa_receipt_number = str(items.get("MpesaReceiptNumber", ""))
            payment.amount = Decimal(str(items.get("Amount", payment.amount)))
            payment.status = "completed"
            payment.paid_at = timezone.now()
            payment.result_code = str(result_code)
            payment.result_desc = stk_callback.get("ResultDesc", "")
            payment.save()

            # Provision hotspot account via Celery
            try:
                from tasks.hotspot_tasks import activate_hotspot_user
                activate_hotspot_user.delay(payment.id)
            except Exception as exc:
                logger.error("Celery task dispatch failed: %s", exc)
                # Fallback: activate inline if Celery is unavailable
                _activate_hotspot_inline(payment)
        else:
            payment.status = "failed"
            payment.result_code = str(result_code)
            payment.result_desc = stk_callback.get("ResultDesc", "")
            payment.save(update_fields=["status", "result_code", "result_desc"])

        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


def _activate_hotspot_inline(payment: Payment):
    """Fallback hotspot activation when Celery is not available."""
    try:
        hotspot_user = HotspotUser.objects.create(
            user=payment.user,
            package=payment.package,
            payment=payment,
            mac_address=payment.mac_address,
        )
        hotspot_user.activate()
        TransactionLog.objects.create(
            payment=payment,
            event_type="activation",
            raw_response={"username": hotspot_user.username, "inline": True},
        )
    except Exception as exc:
        logger.error("Inline activation error: %s", exc)


class PaymentStatusView(APIView):
    """GET /api/payments/status/{checkout_id}/ — poll payment status"""
    permission_classes = [IsAuthenticated]

    def get(self, request, checkout_id):
        payment = get_object_or_404(
            Payment, checkout_request_id=checkout_id, user=request.user
        )
        data = PaymentSerializer(payment).data
        # Include hotspot credentials if activated
        if hasattr(payment, "hotspot_user"):
            data["hotspot"] = HotspotUserSerializer(payment.hotspot_user).data
        return success(data)


class PaymentHistoryView(generics.ListAPIView):
    """GET /api/payments/history/ — customer's own payments"""
    permission_classes = [IsAuthenticated]
    serializer_class = PaymentSerializer

    def get_queryset(self):
        return Payment.objects.filter(user=self.request.user).select_related("package")

    def list(self, request, *args, **kwargs):
        return success(self.get_serializer(self.get_queryset(), many=True).data)


class PaymentReceiptView(APIView):
    """GET /api/payments/receipt/{id}/ — PDF receipt download"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        payment = get_object_or_404(Payment, pk=pk, user=request.user, status="completed")
        # PDF generation via WeasyPrint lives in a separate utility;
        # return JSON summary here — wire up PDF in a later milestone.
        return success(PaymentSerializer(payment).data, "Receipt data.")


class AllPaymentsView(generics.ListAPIView):
    """GET /api/payments/ — admin: all payments"""
    permission_classes = [IsAdmin]
    serializer_class = PaymentSerializer

    def get_queryset(self):
        qs = Payment.objects.select_related("user", "package").all()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def list(self, request, *args, **kwargs):
        return success(self.get_serializer(self.get_queryset(), many=True).data)


class RedeemVoucherView(APIView):
    """POST /api/payments/voucher/redeem/ — customer redeems a voucher code"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = RedeemVoucherSerializer(data=request.data)
        if serializer.is_valid():
            hotspot_user = serializer.save(user=request.user)
            return success(
                HotspotUserSerializer(hotspot_user).data,
                "Voucher redeemed. You are now connected.",
                status.HTTP_201_CREATED,
            )
        return error("Voucher redemption failed.", serializer.errors)


# ---------------------------------------------------------------------------
# Hotspot Views   /api/hotspot/
# ---------------------------------------------------------------------------

class MySessionView(APIView):
    """GET /api/hotspot/my-session/ — customer's active hotspot session"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        hotspot_user = (
            HotspotUser.objects.filter(user=request.user, is_active=True)
            .select_related("package")
            .first()
        )
        if not hotspot_user:
            return error("No active session found.", status_code=status.HTTP_404_NOT_FOUND)
        data = HotspotUserSerializer(hotspot_user).data
        # Latest session bandwidth
        latest_session = hotspot_user.sessions.first()
        if latest_session:
            data["current_session"] = SessionSerializer(latest_session).data
        return success(data)


class OnlineUsersView(generics.ListAPIView):
    """GET /api/hotspot/online-users/ — admin: currently online users"""
    permission_classes = [IsAdmin]
    serializer_class = HotspotUserSerializer

    def get_queryset(self):
        return HotspotUser.objects.filter(is_active=True).select_related("user", "package")

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        # Optionally enrich with live MikroTik data
        try:
            from services.mikrotik import MikroTikService
            mk = MikroTikService()
            mk.connect()
            online = {u["name"]: u for u in mk.get_online_users()}
            mk.disconnect()
        except Exception:
            online = {}

        data = self.get_serializer(qs, many=True).data
        for item in data:
            mk_data = online.get(item["username"], {})
            item["mikrotik_bytes_in"] = mk_data.get("bytes-in", 0)
            item["mikrotik_bytes_out"] = mk_data.get("bytes-out", 0)
        return success(data)


class DisconnectUserView(APIView):
    """POST /api/hotspot/disconnect/{id}/ — admin: disconnect active session"""
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        hotspot_user = get_object_or_404(HotspotUser, pk=pk)
        try:
            from services.mikrotik import MikroTikService
            mk = MikroTikService()
            mk.connect()
            mk.disconnect_active_session(hotspot_user.username)
            mk.disconnect()
        except Exception as exc:
            logger.warning("MikroTik disconnect error: %s", exc)

        hotspot_user.deactivate()
        return success(message=f"User {hotspot_user.username} disconnected.")


class SuspendUserView(APIView):
    """POST /api/hotspot/suspend/{id}/ — admin: suspend a customer account"""
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk, role="customer")
        user.is_suspended = True
        user.save(update_fields=["is_suspended"])
        # Deactivate all live hotspot accounts for this user
        HotspotUser.objects.filter(user=user, is_active=True).update(is_active=False)
        return success(message=f"Customer {user} suspended.")


class ActivateUserView(APIView):
    """POST /api/hotspot/activate/{id}/ — admin: lift suspension"""
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk, role="customer")
        user.is_suspended = False
        user.save(update_fields=["is_suspended"])
        return success(message=f"Customer {user} activated.")


# ---------------------------------------------------------------------------
# Customer Views   /api/customers/
# ---------------------------------------------------------------------------

class CustomerListView(generics.ListAPIView):
    """GET /api/customers/ — admin"""
    permission_classes = [IsAdmin]
    serializer_class = UserSerializer

    def get_queryset(self):
        qs = User.objects.filter(role="customer")
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(phone_number__icontains=search) | qs.filter(
                first_name__icontains=search
            ) | qs.filter(last_name__icontains=search)
        return qs

    def list(self, request, *args, **kwargs):
        return success(self.get_serializer(self.get_queryset(), many=True).data)


class CustomerDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/customers/{id}/ — admin
    PATCH  /api/customers/{id}/ — admin
    DELETE /api/customers/{id}/ — admin
    """
    permission_classes = [IsAdmin]
    queryset = User.objects.filter(role="customer")
    serializer_class = AdminUserSerializer

    def retrieve(self, request, *args, **kwargs):
        return success(self.get_serializer(self.get_object()).data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", True)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return success(serializer.data, "Customer updated.")
        return error("Validation failed.", serializer.errors)

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return success(message="Customer deleted.")


# ---------------------------------------------------------------------------
# Voucher Views   /api/vouchers/
# ---------------------------------------------------------------------------

class VoucherListView(generics.ListAPIView):
    """GET /api/vouchers/ — admin"""
    permission_classes = [IsAdmin]
    serializer_class = VoucherSerializer

    def get_queryset(self):
        qs = Voucher.objects.select_related("package").all()
        is_used = self.request.query_params.get("is_used")
        if is_used is not None:
            qs = qs.filter(is_used=is_used.lower() == "true")
        return qs

    def list(self, request, *args, **kwargs):
        return success(self.get_serializer(self.get_queryset(), many=True).data)


class GenerateVouchersView(APIView):
    """
    POST /api/vouchers/generate/
    Body: { package_id, quantity, expires_at (optional) }
    Generates up to 200 voucher codes in bulk.
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        import uuid

        package_id = request.data.get("package_id")
        quantity = int(request.data.get("quantity", 1))
        expires_at = request.data.get("expires_at")

        if not package_id:
            return error("package_id is required.")
        if quantity < 1 or quantity > 200:
            return error("quantity must be between 1 and 200.")

        package = get_object_or_404(Package, pk=package_id, is_active=True)

        vouchers = []
        for _ in range(quantity):
            code = uuid.uuid4().hex[:10].upper()
            vouchers.append(
                Voucher(package=package, code=code, expires_at=expires_at)
            )
        created = Voucher.objects.bulk_create(vouchers)
        return success(
            VoucherSerializer(created, many=True).data,
            f"{len(created)} voucher(s) generated.",
            status.HTTP_201_CREATED,
        )


class VoucherDeleteView(generics.DestroyAPIView):
    """DELETE /api/vouchers/{id}/ — admin"""
    permission_classes = [IsAdmin]
    queryset = Voucher.objects.all()

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.is_used:
            return error("Cannot delete a voucher that has already been used.")
        obj.delete()
        return success(message="Voucher deleted.")


# ---------------------------------------------------------------------------
# Report Views   /api/reports/
# ---------------------------------------------------------------------------

class RevenuReportView(APIView):
    """
    GET /api/reports/revenue/
    Query params: start_date, end_date (YYYY-MM-DD)
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = Payment.objects.filter(status="completed")
        start = request.query_params.get("start_date")
        end = request.query_params.get("end_date")
        if start:
            qs = qs.filter(paid_at__date__gte=start)
        if end:
            qs = qs.filter(paid_at__date__lte=end)

        by_day = (
            qs.annotate(day=TruncDate("paid_at"))
            .values("day")
            .annotate(total=Sum("amount"), count=Count("id"))
            .order_by("day")
        )

        total_revenue = qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        total_transactions = qs.count()

        return success(
            {
                "total_revenue": str(total_revenue),
                "total_transactions": total_transactions,
                "by_day": list(by_day),
            }
        )


class BandwidthReportView(generics.ListAPIView):
    """GET /api/reports/bandwidth/ — recent bandwidth usage snapshots"""
    permission_classes = [IsAdmin]
    serializer_class = BandwidthUsageSerializer

    def get_queryset(self):
        return BandwidthUsage.objects.select_related("hotspot_user").all()[:500]

    def list(self, request, *args, **kwargs):
        return success(self.get_serializer(self.get_queryset(), many=True).data)


class ActiveUsersReportView(APIView):
    """GET /api/reports/active-users/"""
    permission_classes = [IsAdmin]

    def get(self, request):
        now = timezone.now()
        active_count = HotspotUser.objects.filter(
            is_active=True, expires_at__gt=now
        ).count()
        expired_today = HotspotUser.objects.filter(
            expires_at__date=now.date()
        ).count()
        return success({"active_now": active_count, "expired_today": expired_today})


class DashboardStatsView(APIView):
    """GET /api/reports/dashboard-stats/ — admin dashboard summary"""
    permission_classes = [IsAdmin]

    def get(self, request):
        now = timezone.now()
        today = now.date()

        total_customers = User.objects.filter(role="customer").count()
        active_sessions = HotspotUser.objects.filter(
            is_active=True, expires_at__gt=now
        ).count()
        today_revenue = (
            Payment.objects.filter(status="completed", paid_at__date=today).aggregate(
                total=Sum("amount")
            )["total"]
            or Decimal("0.00")
        )
        total_revenue = (
            Payment.objects.filter(status="completed").aggregate(total=Sum("amount"))[
                "total"
            ]
            or Decimal("0.00")
        )
        pending_payments = Payment.objects.filter(status="pending").count()
        total_packages = Package.objects.filter(is_active=True).count()
        unused_vouchers = Voucher.objects.filter(is_used=False).count()

        return success(
            {
                "total_customers": total_customers,
                "active_sessions": active_sessions,
                "today_revenue": str(today_revenue),
                "total_revenue": str(total_revenue),
                "pending_payments": pending_payments,
                "total_packages": total_packages,
                "unused_vouchers": unused_vouchers,
            }
        )