"""
core/permissions.py

Custom DRF permissions for WifiBill.
"""

from rest_framework.permissions import BasePermission, IsAuthenticated


class IsAdmin(BasePermission):
    """Allow access only to users with role='admin' or is_superuser."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_admin
        )


class IsAdminOrOwner(BasePermission):
    """
    Allow admins full access.
    Allow authenticated users access only to their own objects.
    The view/serializer must expose an `owner` attribute or `user` field.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.user.is_admin:
            return True
        # Support objects that reference owner via .user or directly
        owner = getattr(obj, "user", obj)
        return owner == request.user