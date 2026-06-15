"""
config/urls.py

WifiBill — project-level URL configuration.

All application routes live under /api/ (handled by core/urls.py).
Django admin is served at /admin/.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Django admin panel
    path("admin/", admin.site.urls),

    # All WifiBill API endpoints
    path("api/", include("core.urls")),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

    # Optional: DRF browsable API login/logout (dev only)
    urlpatterns += [
        path("api-auth/", include("rest_framework.urls", namespace="rest_framework")),
    ]