"""
services/mikrotik.py

WifiBill — MikroTik RouterOS API service.

Wraps routeros-api to manage hotspot users, sessions, and queues.

Environment variables required (backend/.env):
    MIKROTIK_HOST         e.g. 192.168.88.1
    MIKROTIK_PORT         8728 (plain) or 8729 (SSL)
    MIKROTIK_USERNAME     e.g. django-api
    MIKROTIK_PASSWORD
    HOTSPOT_DEFAULT_PROFILE  e.g. default
    HOTSPOT_SERVER_NAME      e.g. wifibill-hotspot

Install:
    pip install routeros-api
"""

import logging

import routeros_api
from django.conf import settings

logger = logging.getLogger(__name__)


class MikroTikError(Exception):
    """Raised for RouterOS API errors."""


class MikroTikService:
    """
    Context-manager-friendly RouterOS API client.

    Usage (preferred):
        with MikroTikService() as mk:
            mk.create_hotspot_user(...)

    Or manual:
        mk = MikroTikService()
        mk.connect()
        mk.create_hotspot_user(...)
        mk.disconnect()
    """

    def __init__(self):
        self.host = getattr(settings, "MIKROTIK_HOST", "192.168.88.1")
        self.port = int(getattr(settings, "MIKROTIK_PORT", 8728))
        self.username = getattr(settings, "MIKROTIK_USERNAME", "admin")
        self.password = getattr(settings, "MIKROTIK_PASSWORD", "")
        self.default_profile = getattr(settings, "HOTSPOT_DEFAULT_PROFILE", "default")
        self.server_name = getattr(settings, "HOTSPOT_SERVER_NAME", "hotspot1")
        self._connection = None
        self._api = None

    # ------------------------------------------------------------------
    # Connection management
    # ------------------------------------------------------------------

    def connect(self) -> None:
        """Open a connection to the RouterOS API."""
        try:
            self._connection = routeros_api.RouterOsApiPool(
                host=self.host,
                username=self.username,
                password=self.password,
                port=self.port,
                plaintext_login=True,   # routeros-api >= 0.17
            )
            self._api = self._connection.get_api()
            logger.debug("Connected to MikroTik at %s:%s", self.host, self.port)
        except Exception as exc:
            raise MikroTikError(f"Cannot connect to MikroTik: {exc}") from exc

    def disconnect(self) -> None:
        """Close the RouterOS API connection."""
        try:
            if self._connection:
                self._connection.disconnect()
                logger.debug("Disconnected from MikroTik.")
        except Exception:
            pass
        finally:
            self._connection = None
            self._api = None

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.disconnect()

    def _resource(self, path: str):
        """Return a routeros-api resource object for the given path."""
        if not self._api:
            raise MikroTikError("Not connected. Call connect() first.")
        return self._api.get_resource(path)

    # ------------------------------------------------------------------
    # Hotspot user management
    # ------------------------------------------------------------------

    def create_hotspot_user(
        self,
        username: str,
        password: str,
        profile: str | None = None,
        mac_address: str = "",
        shared_users: int = 1,
        comment: str = "WifiBill",
    ) -> bool:
        """
        Create a new hotspot user on MikroTik.

        Args:
            username:     Hotspot login name (e.g. WB3A9F12B4)
            password:     Plaintext password for the hotspot user
            profile:      Hotspot user profile name (falls back to default)
            mac_address:  Optional MAC to bind the login to one device
            shared_users: Max simultaneous logins (maps to shared-users)
            comment:      RouterOS comment field

        Returns:
            True on success.
        """
        profile = profile or self.default_profile
        resource = self._resource("/ip/hotspot/user")

        params = {
            "name": username,
            "password": password,
            "profile": profile,
            "comment": comment,
            "server": self.server_name,
        }
        if mac_address:
            params["mac-address"] = mac_address.upper()
        if shared_users > 1:
            params["shared-users"] = str(shared_users)

        try:
            resource.add(**params)
            logger.info("MikroTik: created hotspot user '%s'", username)
            return True
        except Exception as exc:
            raise MikroTikError(f"create_hotspot_user failed: {exc}") from exc

    def delete_hotspot_user(self, username: str) -> bool:
        """
        Delete a hotspot user by username.
        Returns True if deleted, False if the user was not found.
        """
        resource = self._resource("/ip/hotspot/user")
        try:
            users = resource.get(name=username)
            if not users:
                logger.warning("MikroTik: hotspot user '%s' not found for deletion.", username)
                return False
            resource.remove(id=users[0]["id"])
            logger.info("MikroTik: deleted hotspot user '%s'", username)
            return True
        except Exception as exc:
            raise MikroTikError(f"delete_hotspot_user failed: {exc}") from exc

    def enable_hotspot_user(self, username: str) -> bool:
        """Un-disable a hotspot user (set disabled=no)."""
        return self._set_disabled(username, disabled=False)

    def disable_hotspot_user(self, username: str) -> bool:
        """Disable a hotspot user without deleting it (set disabled=yes)."""
        return self._set_disabled(username, disabled=True)

    def _set_disabled(self, username: str, disabled: bool) -> bool:
        resource = self._resource("/ip/hotspot/user")
        try:
            users = resource.get(name=username)
            if not users:
                raise MikroTikError(f"Hotspot user '{username}' not found.")
            resource.set(
                id=users[0]["id"],
                disabled="yes" if disabled else "no",
            )
            state = "disabled" if disabled else "enabled"
            logger.info("MikroTik: %s hotspot user '%s'", state, username)
            return True
        except MikroTikError:
            raise
        except Exception as exc:
            raise MikroTikError(f"_set_disabled failed for '{username}': {exc}") from exc

    def set_user_profile(self, username: str, profile: str) -> bool:
        """Switch a hotspot user to a different profile (e.g. after upgrade)."""
        resource = self._resource("/ip/hotspot/user")
        try:
            users = resource.get(name=username)
            if not users:
                raise MikroTikError(f"Hotspot user '{username}' not found.")
            resource.set(id=users[0]["id"], profile=profile)
            logger.info("MikroTik: set profile '%s' on user '%s'", profile, username)
            return True
        except MikroTikError:
            raise
        except Exception as exc:
            raise MikroTikError(f"set_user_profile failed: {exc}") from exc

    # ------------------------------------------------------------------
    # Active sessions
    # ------------------------------------------------------------------

    def get_online_users(self) -> list[dict]:
        """
        Return a list of dicts describing currently active hotspot sessions.
        Each dict mirrors the RouterOS /ip/hotspot/active fields:
            name, address, mac-address, bytes-in, bytes-out,
            uptime, idle-time, session-time-left, server
        """
        resource = self._resource("/ip/hotspot/active")
        try:
            users = resource.get()
            logger.debug("MikroTik: %d active hotspot sessions", len(users))
            return users
        except Exception as exc:
            raise MikroTikError(f"get_online_users failed: {exc}") from exc

    def disconnect_active_session(self, username: str) -> bool:
        """
        Force-disconnect an active hotspot session by username.
        Returns True if a session was found and removed.
        """
        resource = self._resource("/ip/hotspot/active")
        try:
            sessions = resource.get(name=username)
            if not sessions:
                logger.warning(
                    "MikroTik: no active session for '%s' to disconnect.", username
                )
                return False
            resource.remove(id=sessions[0]["id"])
            logger.info("MikroTik: disconnected active session for '%s'", username)
            return True
        except Exception as exc:
            raise MikroTikError(f"disconnect_active_session failed: {exc}") from exc

    def get_user_traffic(self, username: str) -> dict:
        """
        Return bytes-in / bytes-out for a currently active user.
        Returns {"bytes_in": 0, "bytes_out": 0} if user is not online.
        """
        resource = self._resource("/ip/hotspot/active")
        try:
            sessions = resource.get(name=username)
            if not sessions:
                return {"bytes_in": 0, "bytes_out": 0}
            s = sessions[0]
            return {
                "bytes_in": int(s.get("bytes-in", 0)),
                "bytes_out": int(s.get("bytes-out", 0)),
                "uptime": s.get("uptime", ""),
                "idle_time": s.get("idle-time", ""),
                "session_time_left": s.get("session-time-left", ""),
            }
        except Exception as exc:
            raise MikroTikError(f"get_user_traffic failed: {exc}") from exc

    # ------------------------------------------------------------------
    # Hotspot user profiles
    # ------------------------------------------------------------------

    def create_user_profile(
        self,
        name: str,
        rate_limit: str = "0/0",
        shared_users: int = 1,
        session_timeout: str = "",
        idle_timeout: str = "10m",
    ) -> bool:
        """
        Create a hotspot user profile.

        Args:
            name:            Profile name (e.g. "1hour-5mbps")
            rate_limit:      MikroTik rate-limit string, e.g. "2M/5M"
            shared_users:    Max simultaneous logins
            session_timeout: e.g. "1h", "24h" (empty = unlimited)
            idle_timeout:    e.g. "10m"

        Returns:
            True on success.
        """
        resource = self._resource("/ip/hotspot/user/profile")
        params = {
            "name": name,
            "rate-limit": rate_limit,
            "shared-users": str(shared_users),
            "idle-timeout": idle_timeout,
        }
        if session_timeout:
            params["session-timeout"] = session_timeout

        try:
            resource.add(**params)
            logger.info("MikroTik: created hotspot user profile '%s'", name)
            return True
        except Exception as exc:
            raise MikroTikError(f"create_user_profile failed: {exc}") from exc

    def get_user_profiles(self) -> list[dict]:
        """Return all hotspot user profiles."""
        try:
            return self._resource("/ip/hotspot/user/profile").get()
        except Exception as exc:
            raise MikroTikError(f"get_user_profiles failed: {exc}") from exc

    # ------------------------------------------------------------------
    # Queue Trees (per-user speed limits)
    # ------------------------------------------------------------------

    def create_queue(
        self,
        name: str,
        target_ip: str,
        max_up_mbps: int,
        max_down_mbps: int,
    ) -> bool:
        """
        Create a Simple Queue entry to enforce upload/download speed limits
        for a specific IP address.

        Args:
            name:          Queue name, e.g. "WB3A9F12B4"
            target_ip:     Customer's assigned IP, e.g. "192.168.89.45"
            max_up_mbps:   Upload ceiling in Mbps (0 = unlimited)
            max_down_mbps: Download ceiling in Mbps (0 = unlimited)

        Returns:
            True on success.
        """
        resource = self._resource("/queue/simple")
        up = f"{max_up_mbps}M" if max_up_mbps else "0"
        down = f"{max_down_mbps}M" if max_down_mbps else "0"

        try:
            resource.add(
                name=name,
                target=f"{target_ip}/32",
                **{"max-limit": f"{up}/{down}"},
            )
            logger.info(
                "MikroTik: queue '%s' -> %s up=%s down=%s", name, target_ip, up, down
            )
            return True
        except Exception as exc:
            raise MikroTikError(f"create_queue failed: {exc}") from exc

    def delete_queue(self, name: str) -> bool:
        """Delete a Simple Queue entry by name."""
        resource = self._resource("/queue/simple")
        try:
            queues = resource.get(name=name)
            if not queues:
                return False
            resource.remove(id=queues[0]["id"])
            logger.info("MikroTik: deleted queue '%s'", name)
            return True
        except Exception as exc:
            raise MikroTikError(f"delete_queue failed: {exc}") from exc

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    def ping(self) -> bool:
        """
        Quick connectivity check.
        Returns True if the router responds to /system/identity/get.
        """
        try:
            identity = self._resource("/system/identity").get()
            logger.debug("MikroTik ping OK — identity: %s", identity)
            return True
        except Exception:
            return False

    def get_system_resource(self) -> dict:
        """Return /system/resource info (uptime, CPU, memory, etc.)."""
        try:
            result = self._resource("/system/resource").get()
            return result[0] if result else {}
        except Exception as exc:
            raise MikroTikError(f"get_system_resource failed: {exc}") from exc