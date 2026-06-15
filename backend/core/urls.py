"""
core/urls.py

WifiBill — URL patterns for the "core" app.

Mount this file under /api/ in the project-level config/urls.py:

    path("api/", include("core.urls")),
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    # Auth
    RegisterView,
    LoginView,
    LogoutView,
    ProfileView,
    ChangePasswordView,
    # Packages
    PackageListCreateView,
    PackageDetailView,
    # Payments
    InitiatePaymentView,
    MpesaCallbackView,
    PaymentStatusView,
    PaymentHistoryView,
    PaymentReceiptView,
    AllPaymentsView,
    RedeemVoucherView,
    # Hotspot
    MySessionView,
    OnlineUsersView,
    DisconnectUserView,
    SuspendUserView,
    ActivateUserView,
    # Customers
    CustomerListView,
    CustomerDetailView,
    # Vouchers
    VoucherListView,
    GenerateVouchersView,
    VoucherDeleteView,
    # Reports
    RevenuReportView,
    BandwidthReportView,
    ActiveUsersReportView,
    DashboardStatsView,
)

# ── Auth ─────────────────────────────────────────────────────────────────────
auth_patterns = [
    path("register/",        RegisterView.as_view(),       name="auth-register"),
    path("login/",           LoginView.as_view(),          name="auth-login"),
    path("refresh/",         TokenRefreshView.as_view(),   name="auth-token-refresh"),
    path("logout/",          LogoutView.as_view(),         name="auth-logout"),
    path("profile/",         ProfileView.as_view(),        name="auth-profile"),
    path("change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
]

# ── Packages ─────────────────────────────────────────────────────────────────
package_patterns = [
    path("",        PackageListCreateView.as_view(), name="package-list-create"),
    path("<int:pk>/", PackageDetailView.as_view(),  name="package-detail"),
]

# ── Payments ─────────────────────────────────────────────────────────────────
payment_patterns = [
    path("",                               AllPaymentsView.as_view(),    name="payment-list"),
    path("initiate/",                      InitiatePaymentView.as_view(), name="payment-initiate"),
    path("mpesa/callback/",               MpesaCallbackView.as_view(),  name="payment-mpesa-callback"),
    path("status/<str:checkout_id>/",     PaymentStatusView.as_view(),  name="payment-status"),
    path("history/",                      PaymentHistoryView.as_view(), name="payment-history"),
    path("receipt/<int:pk>/",             PaymentReceiptView.as_view(), name="payment-receipt"),
    path("voucher/redeem/",               RedeemVoucherView.as_view(),  name="voucher-redeem"),
]

# ── Hotspot ───────────────────────────────────────────────────────────────────
hotspot_patterns = [
    path("my-session/",          MySessionView.as_view(),           name="hotspot-my-session"),
    path("online-users/",        OnlineUsersView.as_view(),         name="hotspot-online-users"),
    path("disconnect/<int:pk>/", DisconnectUserView.as_view(),      name="hotspot-disconnect"),
    path("suspend/<int:pk>/",    SuspendUserView.as_view(),         name="hotspot-suspend"),
    path("activate/<int:pk>/",   ActivateUserView.as_view(),        name="hotspot-activate"),
]

# ── Customers ────────────────────────────────────────────────────────────────
customer_patterns = [
    path("",          CustomerListView.as_view(),   name="customer-list"),
    path("<int:pk>/", CustomerDetailView.as_view(), name="customer-detail"),
]

# ── Vouchers ─────────────────────────────────────────────────────────────────
voucher_patterns = [
    path("",              VoucherListView.as_view(),      name="voucher-list"),
    path("generate/",     GenerateVouchersView.as_view(), name="voucher-generate"),
    path("<int:pk>/",     VoucherDeleteView.as_view(),    name="voucher-delete"),
]

# ── Reports ──────────────────────────────────────────────────────────────────
report_patterns = [
    path("revenue/",         RevenuReportView.as_view(),      name="report-revenue"),
    path("bandwidth/",       BandwidthReportView.as_view(),   name="report-bandwidth"),
    path("active-users/",    ActiveUsersReportView.as_view(), name="report-active-users"),
    path("dashboard-stats/", DashboardStatsView.as_view(),    name="report-dashboard-stats"),
]

# ── Root urlpatterns (prefixed by config/urls.py as /api/) ───────────────────
from django.urls import include

urlpatterns = [
    path("auth/",      include((auth_patterns,     "auth"))),
    path("packages/",  include((package_patterns,  "packages"))),
    path("payments/",  include((payment_patterns,  "payments"))),
    path("hotspot/",   include((hotspot_patterns,  "hotspot"))),
    path("customers/", include((customer_patterns, "customers"))),
    path("vouchers/",  include((voucher_patterns,  "vouchers"))),
    path("reports/",   include((report_patterns,   "reports"))),
]