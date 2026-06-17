/**
 * hooks/usePayments.js
 * Initiate payments, poll status, and fetch history.
 */
import { useCallback, useEffect, useState } from "react";
import { paymentsAPI, getErrorMessage } from "../services/api";

export default function usePayments({ autoFetch = false } = {}) {
  const [payments, setPayments]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [error, setError]           = useState("");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await paymentsAPI.history();
      setPayments(Array.isArray(data) ? data : []);
    } catch (ex) {
      setError(getErrorMessage(ex));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (autoFetch) fetchHistory(); }, [autoFetch, fetchHistory]);

  /**
   * Initiate an M-Pesa STK push.
   * @param {{ package_id, phone_number?, mac_address? }} payload
   * @returns {{ payment_id, checkout_request_id }}
   */
  const initiate = useCallback(async (payload) => {
    setInitiating(true);
    setError("");
    try {
      const result = await paymentsAPI.initiate(payload);
      return result;
    } catch (ex) {
      const msg = getErrorMessage(ex);
      setError(msg);
      throw new Error(msg);
    } finally {
      setInitiating(false);
    }
  }, []);

  /**
   * Poll payment status until resolved or maxAttempts reached.
   * @param {string} checkoutRequestId
   * @param {{ intervalMs?, maxAttempts?, onSuccess?, onFailed? }} opts
   */
  const pollStatus = useCallback((checkoutRequestId, { intervalMs = 4000, maxAttempts = 30, onSuccess, onFailed } = {}) => {
    let attempts = 0;

    const timer = setInterval(async () => {
      attempts++;
      try {
        const data = await paymentsAPI.pollStatus(checkoutRequestId);
        if (data.status === "completed") {
          clearInterval(timer);
          onSuccess && onSuccess(data);
        } else if (data.status === "failed" || data.status === "cancelled") {
          clearInterval(timer);
          onFailed && onFailed(data);
        } else if (attempts >= maxAttempts) {
          clearInterval(timer);
          onFailed && onFailed({ status: "timeout" });
        }
      } catch {
        if (attempts >= maxAttempts) {
          clearInterval(timer);
          onFailed && onFailed({ status: "timeout" });
        }
      }
    }, intervalMs);

    return () => clearInterval(timer);   // cleanup function
  }, []);

  return { payments, loading, initiating, error, fetchHistory, initiate, pollStatus };
}