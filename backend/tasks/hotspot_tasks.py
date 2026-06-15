"""
tasks/hotspot_tasks.py

WifiBill — Celery tasks for hotspot account lifecycle.

Tasks:
    activate_hotspot_user     Called immediately after a confirmed payment.
    expire_hotspot_users      Beat task: deactivates accounts past their expiry.
    snapshot_bandwidth_usage  Beat task: snapshots per-user traffic from MikroTik.
    sync_mikrotik_users       Beat task: re-syncs all active DB users to MikroTik.
    deactivate_hotspot_user   On-demand: deactivate a single account.
"""

import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# activate_hotspot_user
# ---------------------------------------------------------------------------

@shared_task(
    bind=True,
    max_retries=5,
    default_retry_delay=30,   # 30 seconds between retries
    name="tasks.hotspot_tasks.activate_hotspot_user",
)
def activate_hotspot_user(self, payment_id: int) -> dict:
    """
    Create and activate a HotspotUser on MikroTik after a confirmed payment.

    Steps:
      1. Fetch the completed Payment from the DB.
      2. Create a HotspotUser record and call .activate() to start the countdown.
      3. Push the user to MikroTik via routeros-api.
      4. Create a user profile on MikroTik if the package has speed limits.
      5. Create a Simple Queue if an IP address is known.
      6. Log the activation event.

    Retries up to 5 times (MikroTik may be temporarily unreachable).
    """
    # Import models inside task to avoid app-registry issues at import time
    from core.models import HotspotUser, Payment, TransactionLog
    from services.mikrotik import MikroTikService, MikroTikError

    try:
        payment = Payment.objects.select_related("user", "package").get(pk=payment_id)
    except Payment.DoesNotExist:
        logger.error("activate_hotspot_user: Payment %s not found.", payment_id)
        return {"error": f"Payment {payment_id} not found."}

    if payment.status != "completed":
        logger.warning(
            "activate_hotspot_user: Payment %s status is '%s', expected 'completed'. Skipping.",
            payment_id,
            payment.status,
        )
        return {"skipped": True, "status": payment.status}

    # Idempotency check — don't create a second hotspot account
    if hasattr(payment, "hotspot_user"):
        logger.info(
            "activate_hotspot_user: HotspotUser already exists for Payment %s.", payment_id
        )
        return {"already_activated": True}

    # 1. Create & activate the DB record
    package = payment.package
    hotspot_user = HotspotUser.objects.create(
        user=payment.user,
        package=package,
        payment=payment,
        mac_address=payment.mac_address or "",
    )
    hotspot_user.activate()   # sets activated_at, expires_at, is_active=True
    logger.info(
        "HotspotUser %s created for Payment %s. Expires: %s",
        hotspot_user.username,
        payment_id,
        hotspot_user.expires_at,
    )

    # 2. Push to MikroTik
    try:
        with MikroTikService() as mk:
            # Ensure the profile exists (create if it doesn't — idempotent)
            profile_name = _get_or_create_profile(mk, package)

            mk.create_hotspot_user(
                username=hotspot_user.username,
                password=hotspot_user.password,
                profile=profile_name,
                mac_address=hotspot_user.mac_address,
                shared_users=hotspot_user.shared_users,
                comment=f"Payment#{payment_id}",
            )

        hotspot_user.mikrotik_synced = True
        hotspot_user.save(update_fields=["mikrotik_synced"])
        logger.info("MikroTik sync OK for HotspotUser %s", hotspot_user.username)

    except MikroTikError as exc:
        logger.error(
            "MikroTik provisioning failed for HotspotUser %s: %s",
            hotspot_user.username,
            exc,
        )
        # Retry — MikroTik may have been briefly unreachable
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            logger.critical(
                "Max retries exceeded for HotspotUser %s. Manual intervention required.",
                hotspot_user.username,
            )

    # 3. Log activation
    TransactionLog.objects.create(
        payment=payment,
        event_type="activation",
        raw_response={
            "hotspot_username": hotspot_user.username,
            "expires_at": hotspot_user.expires_at.isoformat(),
            "mikrotik_synced": hotspot_user.mikrotik_synced,
        },
    )

    return {
        "hotspot_user_id": hotspot_user.id,
        "username": hotspot_user.username,
        "expires_at": hotspot_user.expires_at.isoformat(),
        "mikrotik_synced": hotspot_user.mikrotik_synced,
    }


def _get_or_create_profile(mk, package) -> str:
    """
    Return a MikroTik profile name for the given package.
    Creates the profile if it doesn't already exist.
    Profile name pattern: wb-<package_id>-<rate>
    """
    from services.mikrotik import MikroTikError

    rate_limit = package.mikrotik_rate_limit   # e.g. "2M/5M"
    profile_name = f"wb-pkg{package.id}-{rate_limit.replace('/', '-')}"

    existing = mk.get_user_profiles()
    existing_names = {p.get("name") for p in existing}

    if profile_name not in existing_names:
        try:
            mk.create_user_profile(
                name=profile_name,
                rate_limit=rate_limit,
                shared_users=package.device_limit,
            )
        except MikroTikError as exc:
            logger.warning("Could not create profile '%s': %s. Using default.", profile_name, exc)
            return mk.default_profile

    return profile_name


# ---------------------------------------------------------------------------
# expire_hotspot_users  (beat: every 2 minutes)
# ---------------------------------------------------------------------------

@shared_task(name="tasks.hotspot_tasks.expire_hotspot_users")
def expire_hotspot_users() -> dict:
    """
    Deactivate all HotspotUser records whose expires_at has passed.
    Also removes the user from MikroTik to free up resources.
    """
    from core.models import HotspotUser
    from services.mikrotik import MikroTikService, MikroTikError

    now = timezone.now()
    expired_qs = HotspotUser.objects.filter(
        is_active=True,
        expires_at__lte=now,
    )

    count = expired_qs.count()
    if count == 0:
        return {"expired": 0}

    usernames = list(expired_qs.values_list("username", flat=True))

    # Bulk deactivate in DB
    expired_qs.update(is_active=False)
    logger.info("Deactivated %d expired hotspot users.", count)

    # Remove from MikroTik
    errors = []
    try:
        with MikroTikService() as mk:
            for username in usernames:
                try:
                    mk.delete_hotspot_user(username)
                except MikroTikError as exc:
                    errors.append({"username": username, "error": str(exc)})
                    logger.warning("Could not remove '%s' from MikroTik: %s", username, exc)
    except MikroTikError as exc:
        logger.error("MikroTik connection failed during expiry sweep: %s", exc)

    return {"expired": count, "usernames": usernames, "mikrotik_errors": errors}


# ---------------------------------------------------------------------------
# snapshot_bandwidth_usage  (beat: every 5 minutes)
# ---------------------------------------------------------------------------

@shared_task(name="tasks.hotspot_tasks.snapshot_bandwidth_usage")
def snapshot_bandwidth_usage() -> dict:
    """
    Pull live traffic counters from MikroTik for all active sessions
    and write a BandwidthUsage snapshot to the DB (for charts).
    """
    from core.models import BandwidthUsage, HotspotUser
    from services.mikrotik import MikroTikService, MikroTikError

    snapshots_created = 0
    try:
        with MikroTikService() as mk:
            online = mk.get_online_users()   # list of dicts from RouterOS

        # Build a lookup by username
        traffic_map = {u["name"]: u for u in online}

        if not traffic_map:
            return {"snapshots": 0, "reason": "no active sessions on MikroTik"}

        # Match DB HotspotUsers to live sessions
        active_users = HotspotUser.objects.filter(
            is_active=True, username__in=list(traffic_map.keys())
        )

        records = []
        for hu in active_users:
            mk_data = traffic_map.get(hu.username, {})
            records.append(
                BandwidthUsage(
                    hotspot_user=hu,
                    bytes_in=int(mk_data.get("bytes-in", 0)),
                    bytes_out=int(mk_data.get("bytes-out", 0)),
                )
            )

        if records:
            BandwidthUsage.objects.bulk_create(records)
            snapshots_created = len(records)

    except MikroTikError as exc:
        logger.error("snapshot_bandwidth_usage: MikroTik error: %s", exc)
        return {"error": str(exc)}

    logger.debug("Bandwidth snapshot: %d records created.", snapshots_created)
    return {"snapshots": snapshots_created}


# ---------------------------------------------------------------------------
# sync_mikrotik_users  (beat: every 30 minutes)
# ---------------------------------------------------------------------------

@shared_task(name="tasks.hotspot_tasks.sync_mikrotik_users")
def sync_mikrotik_users() -> dict:
    """
    Ensure every active HotspotUser in the DB exists on MikroTik.
    Handles cases where the router was rebooted or the previous
    activation task failed after max retries.
    """
    from core.models import HotspotUser
    from services.mikrotik import MikroTikService, MikroTikError

    active_users = HotspotUser.objects.filter(
        is_active=True, mikrotik_synced=False
    ).select_related("package")

    if not active_users.exists():
        return {"synced": 0}

    synced = 0
    failed = []

    try:
        with MikroTikService() as mk:
            # Fetch all existing MikroTik usernames in one call
            existing_mk_users = {u["name"] for u in mk._resource("/ip/hotspot/user").get()}

            for hu in active_users:
                try:
                    if hu.username not in existing_mk_users:
                        profile_name = _get_or_create_profile(mk, hu.package)
                        mk.create_hotspot_user(
                            username=hu.username,
                            password=hu.password,
                            profile=profile_name,
                            mac_address=hu.mac_address,
                            shared_users=hu.shared_users,
                            comment="WifiBill-resync",
                        )
                    hu.mikrotik_synced = True
                    hu.save(update_fields=["mikrotik_synced"])
                    synced += 1
                except MikroTikError as exc:
                    failed.append({"username": hu.username, "error": str(exc)})
                    logger.error("sync_mikrotik_users: failed for '%s': %s", hu.username, exc)

    except MikroTikError as exc:
        logger.error("sync_mikrotik_users: connection error: %s", exc)
        return {"error": str(exc)}

    return {"synced": synced, "failed": failed}


# ---------------------------------------------------------------------------
# deactivate_hotspot_user  (on-demand)
# ---------------------------------------------------------------------------

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=20,
    name="tasks.hotspot_tasks.deactivate_hotspot_user",
)
def deactivate_hotspot_user(self, hotspot_user_id: int) -> dict:
    """
    Manually deactivate a single HotspotUser — called from the admin
    disconnect/suspend views when immediate removal is needed.
    """
    from core.models import HotspotUser
    from services.mikrotik import MikroTikService, MikroTikError

    try:
        hu = HotspotUser.objects.get(pk=hotspot_user_id)
    except HotspotUser.DoesNotExist:
        return {"error": f"HotspotUser {hotspot_user_id} not found."}

    hu.deactivate()

    try:
        with MikroTikService() as mk:
            mk.disconnect_active_session(hu.username)
            mk.delete_hotspot_user(hu.username)
    except MikroTikError as exc:
        logger.error("deactivate_hotspot_user MikroTik error: %s", exc)
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            logger.critical("Max retries exceeded deactivating '%s'.", hu.username)

    return {"deactivated": hu.username}