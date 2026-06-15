"""
tasks/celery.py

WifiBill — Celery application instance.

Import this in your task modules via:
    from tasks.celery import app

Start workers with:
    celery -A tasks.celery worker --loglevel=info
    celery -A tasks.celery beat   --loglevel=info

Environment variables:
    CELERY_BROKER_URL       redis://localhost:6379/0
    CELERY_RESULT_BACKEND   redis://localhost:6379/1
"""

import os

from celery import Celery
from celery.schedules import crontab

# Tell Django which settings module to use before importing anything else
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("wifibill")

# Read CELERY_* settings from Django's settings.py
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in any installed app's tasks.py / tasks/ package
app.autodiscover_tasks()


# ---------------------------------------------------------------------------
# Periodic (beat) schedule
# ---------------------------------------------------------------------------

app.conf.beat_schedule = {
    # Deactivate expired hotspot accounts every 2 minutes
    "expire-hotspot-users-every-2min": {
        "task": "tasks.hotspot_tasks.expire_hotspot_users",
        "schedule": crontab(minute="*/2"),
    },
    # Snapshot bandwidth usage from MikroTik every 5 minutes
    "snapshot-bandwidth-every-5min": {
        "task": "tasks.hotspot_tasks.snapshot_bandwidth_usage",
        "schedule": crontab(minute="*/5"),
    },
    # Re-sync all active hotspot users to MikroTik every 30 minutes
    # (catches any users that were missed due to transient connectivity)
    "sync-mikrotik-every-30min": {
        "task": "tasks.hotspot_tasks.sync_mikrotik_users",
        "schedule": crontab(minute="*/30"),
    },
    # Poll pending payments that never received a callback (every 3 minutes)
    "poll-pending-payments-every-3min": {
        "task": "tasks.payment_tasks.poll_pending_payments",
        "schedule": crontab(minute="*/3"),
    },
}

app.conf.timezone = "Africa/Nairobi"


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Utility task for testing the worker connection."""
    print(f"Request: {self.request!r}")