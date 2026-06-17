/**
 * hooks/useHotspot.js
 * Fetch the current customer's active session + admin online users.
 */
import { useCallback, useEffect, useState } from "react";
import { hotspotAPI, getErrorMessage } from "../services/api";

export default function useHotspot({ mode = "customer", autoFetch = true, refreshInterval = 0 } = {}) {
  const [session, setSession]       = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  const fetchSession = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await hotspotAPI.mySession();
      setSession(data);
    } catch (ex) {
      // 404 means no active session — not a real error
      if (ex?.response?.status === 404) { setSession(null); }
      else { setError(getErrorMessage(ex)); }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOnlineUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await hotspotAPI.onlineUsers();
      setOnlineUsers(Array.isArray(data) ? data : []);
    } catch (ex) {
      setError(getErrorMessage(ex));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetch = mode === "admin" ? fetchOnlineUsers : fetchSession;

  useEffect(() => {
    if (!autoFetch) return;
    fetch();
    if (refreshInterval > 0) {
      const t = setInterval(fetch, refreshInterval);
      return () => clearInterval(t);
    }
  }, [autoFetch, fetch, refreshInterval]);

  const disconnect = useCallback(async (userId) => {
    await hotspotAPI.disconnect(userId);
    await fetchOnlineUsers();
  }, [fetchOnlineUsers]);

  const suspend = useCallback(async (userId) => {
    await hotspotAPI.suspend(userId);
    await fetchOnlineUsers();
  }, [fetchOnlineUsers]);

  const activate = useCallback(async (userId) => {
    await hotspotAPI.activate(userId);
    await fetchOnlineUsers();
  }, [fetchOnlineUsers]);

  return {
    session,
    onlineUsers,
    loading,
    error,
    refetch: fetch,
    disconnect,
    suspend,
    activate,
  };
}