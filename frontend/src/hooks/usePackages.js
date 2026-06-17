/**
 * hooks/usePackages.js
 * Fetch and cache the active packages list.
 */
import { useCallback, useEffect, useState } from "react";
import { packagesAPI, getErrorMessage } from "../services/api";

export default function usePackages({ autoFetch = true } = {}) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const fetch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await packagesAPI.list();
      setPackages(Array.isArray(data) ? data : []);
    } catch (ex) {
      setError(getErrorMessage(ex));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (autoFetch) fetch(); }, [autoFetch, fetch]);

  const single = packages.filter((p) => p.device_limit === 1);
  const shared = packages.filter((p) => p.device_limit > 1);

  return { packages, single, shared, loading, error, refetch: fetch };
}