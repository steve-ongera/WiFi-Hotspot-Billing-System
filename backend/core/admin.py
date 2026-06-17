"""
core/admin.py

Colourful, information-dense Django admin for WifiBill.
Every model has search, filters, and useful list_display columns.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils import timezone
from django.utils.html import format_html

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

def green(text):
    return format_html('<span style="color:#16a34a;font-weight:600">{}</span>', text)

def red(text):
    return format_html('<span style="color:#dc2626;font-weight:600">{}</span>', text)

def amber(text):
    return format_html('<span style="color:#d97706;font-weight:600">{}</span>', text)

def badge(text, color):
    styles = (
        f"background:{color};color:#fff;padding:2px 8px;"
        "border-radius:4px;font-size:11px;font-weight:600;"
    )
    return format_html('<span style="{}">{}</span>', styles, text)


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["-created_at"]
    list_display = [
        "phone_number", "full_name", "email", "role_badge",
        "suspended_badge", "is_staff", "created_at",
    ]
    list_filter  = ["role", "is_suspended", "is_staff", "is_superuser"]
    search_fields = ["phone_number", "email", "first_name", "last_name", "id_number"]
    readonly_fields = ["created_at", "updated_at", "last_login", "date_joined"]

    fieldsets = (
        ("Identity", {"fields": ("phone_number", "email", "first_name", "last_name")}),
        ("Profile",  {"fields": ("role", "id_number", "mac_address", "is_suspended")}),
        ("Permissions", {
            "classes": ("collapse",),
            "fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions"),
        }),
        ("Timestamps", {"fields": ("created_at", "updated_at", "last_login", "date_joined")}),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("phone_number", "email", "first_name", "last_name", "role", "password1", "password2"),
        }),
    )

    @admin.display(description="Name")
    def full_name(self, obj):
        return obj.get_full_name() or "—"

    @admin.display(description="Role")
    def role_badge(self, obj):
        color = "#7c3aed" if obj.role == "admin" else "#0284c7"
        return badge(obj.get_role_display(), color)

    @admin.display(description="Suspended", boolean=False)
    def suspended_badge(self, obj):
        return red("Yes") if obj.is_suspended else green("No")


# ---------------------------------------------------------------------------
# Package
# ---------------------------------------------------------------------------

@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display  = [
        "name", "price_display", "duration_display", "device_limit",
        "plan_type_badge", "speed_display", "data_cap", "active_badge",
    ]
    list_filter   = ["is_active", "duration_unit", "device_limit"]
    search_fields = ["name", "description"]
    readonly_fields = ["created_at", "updated_at", "mikrotik_rate_limit_display"]

    fieldsets = (
        ("Plan Details", {"fields": ("name", "description", "price", "is_active")}),
        ("Duration",     {"fields": ("duration_value", "duration_unit")}),
        ("Devices",      {"fields": ("device_limit",)}),
        ("Bandwidth",    {"fields": ("speed_limit_up", "speed_limit_down", "data_limit_mb", "mikrotik_rate_limit_display")}),
        ("Timestamps",   {"fields": ("created_at", "updated_at")}),
    )

    @admin.display(description="Price")
    def price_display(self, obj):
        return format_html("KES <strong>{}</strong>", obj.price)

    @admin.display(description="Duration")
    def duration_display(self, obj):
        return f"{obj.duration_value} {obj.duration_unit}"

    @admin.display(description="Type")
    def plan_type_badge(self, obj):
        color = "#0891b2" if obj.is_shared else "#16a34a"
        return badge(obj.plan_category, color)

    @admin.display(description="Speed (Up/Down)")
    def speed_display(self, obj):
        up   = f"{obj.speed_limit_up} Mbps"   if obj.speed_limit_up   else "∞"
        down = f"{obj.speed_limit_down} Mbps"  if obj.speed_limit_down else "∞"
        return f"{up} / {down}"

    @admin.display(description="Data Cap")
    def data_cap(self, obj):
        if obj.data_limit_mb:
            return f"{obj.data_limit_mb:,} MB"
        return "Unlimited"

    @admin.display(description="Active")
    def active_badge(self, obj):
        return green("Yes") if obj.is_active else red("No")

    @admin.display(description="MikroTik Rate Limit")
    def mikrotik_rate_limit_display(self, obj):
        return obj.mikrotik_rate_limit


# ---------------------------------------------------------------------------
# Voucher
# ---------------------------------------------------------------------------

@admin.register(Voucher)
class VoucherAdmin(admin.ModelAdmin):
    list_display  = [
        "code", "package", "status_badge", "used_by",
        "used_at", "expires_at", "created_at",
    ]
    list_filter   = ["is_used", "package"]
    search_fields = ["code", "used_by__phone_number", "used_by__email"]
    readonly_fields = ["created_at"]
    raw_id_fields  = ["used_by"]

    @admin.display(description="Status")
    def status_badge(self, obj):
        if obj.is_used:
            return badge("Used", "#6b7280")
        if obj.is_expired:
            return badge("Expired", "#dc2626")
        return badge("Valid", "#16a34a")


# ---------------------------------------------------------------------------
# TransactionLog inline (used inside Payment)
# ---------------------------------------------------------------------------

class TransactionLogInline(admin.TabularInline):
    model  = TransactionLog
    extra  = 0
    fields = ["event_type", "raw_response", "created_at"]
    readonly_fields = ["event_type", "raw_response", "created_at"]
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


# ---------------------------------------------------------------------------
# Payment
# ---------------------------------------------------------------------------

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display  = [
        "id", "phone_number", "package", "amount_display",
        "payment_method", "status_badge", "mpesa_receipt_number", "paid_at",
    ]
    list_filter   = ["status", "payment_method", "package"]
    search_fields = [
        "phone_number", "mpesa_receipt_number",
        "checkout_request_id", "merchant_request_id",
        "user__phone_number", "user__email",
    ]
    readonly_fields = [
        "merchant_request_id", "checkout_request_id", "mpesa_receipt_number",
        "result_code", "result_desc", "created_at", "paid_at",
    ]
    raw_id_fields = ["user"]
    inlines = [TransactionLogInline]

    fieldsets = (
        ("Customer",    {"fields": ("user", "phone_number", "mac_address")}),
        ("Purchase",    {"fields": ("package", "amount", "payment_method")}),
        ("M-Pesa",      {"fields": ("merchant_request_id", "checkout_request_id", "mpesa_receipt_number")}),
        ("Status",      {"fields": ("status", "result_code", "result_desc")}),
        ("Timestamps",  {"fields": ("created_at", "paid_at")}),
    )

    @admin.display(description="Amount")
    def amount_display(self, obj):
        return format_html("KES <strong>{}</strong>", obj.amount)

    @admin.display(description="Status")
    def status_badge(self, obj):
        colors = {
            "pending":    "#d97706",
            "processing": "#0284c7",
            "completed":  "#16a34a",
            "failed":     "#dc2626",
            "cancelled":  "#6b7280",
        }
        return badge(obj.get_status_display(), colors.get(obj.status, "#6b7280"))


# ---------------------------------------------------------------------------
# TransactionLog
# ---------------------------------------------------------------------------

@admin.register(TransactionLog)
class TransactionLogAdmin(admin.ModelAdmin):
    list_display  = ["id", "payment", "event_type", "created_at"]
    list_filter   = ["event_type"]
    search_fields = ["payment__checkout_request_id", "payment__mpesa_receipt_number"]
    readonly_fields = ["payment", "event_type", "raw_response", "created_at"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


# ---------------------------------------------------------------------------
# Session inline (used inside HotspotUser)
# ---------------------------------------------------------------------------

class SessionInline(admin.TabularInline):
    model  = Session
    extra  = 0
    fields = ["session_id", "ip_address", "mac_address", "bytes_in", "bytes_out", "started_at", "ended_at"]
    readonly_fields = ["session_id", "ip_address", "mac_address", "bytes_in", "bytes_out", "started_at", "ended_at"]
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


# ---------------------------------------------------------------------------
# HotspotUser
# ---------------------------------------------------------------------------

@admin.register(HotspotUser)
class HotspotUserAdmin(admin.ModelAdmin):
    list_display  = [
        "username", "user", "package", "status_badge",
        "time_remaining_display", "shared_users",
        "mikrotik_synced", "expires_at",
    ]
    list_filter   = ["is_active", "mikrotik_synced", "package"]
    search_fields = [
        "username", "mac_address", "ip_address",
        "user__phone_number", "user__email",
    ]
    readonly_fields = [
        "username", "password", "activated_at", "expires_at",
        "created_at", "is_expired_display", "time_remaining_display",
    ]
    raw_id_fields = ["user", "payment", "voucher"]
    inlines = [SessionInline]

    fieldsets = (
        ("Account",     {"fields": ("user", "package", "payment", "voucher")}),
        ("Credentials", {"fields": ("username", "password")}),
        ("Network",     {"fields": ("mac_address", "ip_address", "shared_users")}),
        ("Status",      {"fields": ("is_active", "mikrotik_synced", "is_expired_display", "time_remaining_display")}),
        ("Timestamps",  {"fields": ("activated_at", "expires_at", "created_at")}),
    )

    actions = ["activate_accounts", "deactivate_accounts"]

    @admin.display(description="Status")
    def status_badge(self, obj):
        if obj.is_expired:
            return badge("Expired", "#dc2626")
        if obj.is_active:
            return badge("Active", "#16a34a")
        return badge("Inactive", "#6b7280")

    @admin.display(description="Time Remaining")
    def time_remaining_display(self, obj):
        remaining = obj.time_remaining
        total = int(remaining.total_seconds())
        if total <= 0:
            return red("Expired")
        hours, remainder = divmod(total, 3600)
        minutes = remainder // 60
        if hours:
            return green(f"{hours}h {minutes}m")
        return amber(f"{minutes}m")

    @admin.display(description="Expired")
    def is_expired_display(self, obj):
        return red("Yes") if obj.is_expired else green("No")

    @admin.action(description="Activate selected hotspot accounts")
    def activate_accounts(self, request, queryset):
        count = 0
        for obj in queryset.filter(is_active=False):
            obj.activate()
            count += 1
        self.message_user(request, f"{count} account(s) activated.")

    @admin.action(description="Deactivate selected hotspot accounts")
    def deactivate_accounts(self, request, queryset):
        count = queryset.filter(is_active=True).count()
        queryset.filter(is_active=True).update(is_active=False)
        self.message_user(request, f"{count} account(s) deactivated.")


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------

@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display  = [
        "id", "hotspot_user", "ip_address", "mac_address",
        "data_usage_display", "started_at", "ended_at", "duration_display",
    ]
    list_filter   = ["started_at"]
    search_fields = [
        "session_id", "ip_address", "mac_address",
        "hotspot_user__username",
    ]
    readonly_fields = ["started_at", "ended_at", "bytes_in", "bytes_out"]

    @admin.display(description="Data Usage")
    def data_usage_display(self, obj):
        total_mb = obj.total_bytes / (1024 * 1024)
        return f"{total_mb:.1f} MB"

    @admin.display(description="Duration")
    def duration_display(self, obj):
        total = int(obj.duration.total_seconds())
        hours, remainder = divmod(total, 3600)
        minutes = remainder // 60
        if hours:
            return f"{hours}h {minutes}m"
        return f"{minutes}m"


# ---------------------------------------------------------------------------
# BandwidthUsage
# ---------------------------------------------------------------------------

@admin.register(BandwidthUsage)
class BandwidthUsageAdmin(admin.ModelAdmin):
    list_display  = ["id", "hotspot_user", "bytes_in_display", "bytes_out_display", "total_display", "recorded_at"]
    list_filter   = ["recorded_at"]
    search_fields = ["hotspot_user__username"]
    readonly_fields = ["hotspot_user", "bytes_in", "bytes_out", "recorded_at"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    @admin.display(description="↓ Download")
    def bytes_in_display(self, obj):
        return f"{obj.bytes_in / (1024 * 1024):.1f} MB"

    @admin.display(description="↑ Upload")
    def bytes_out_display(self, obj):
        return f"{obj.bytes_out / (1024 * 1024):.1f} MB"

    @admin.display(description="Total")
    def total_display(self, obj):
        total_mb = (obj.bytes_in + obj.bytes_out) / (1024 * 1024)
        return format_html("<strong>{:.1f} MB</strong>", total_mb)


# ---------------------------------------------------------------------------
# Admin site branding
# ---------------------------------------------------------------------------

admin.site.site_header = "WifiBill Administration"
admin.site.site_title  = "WifiBill Admin"
admin.site.index_title = "Dashboard"