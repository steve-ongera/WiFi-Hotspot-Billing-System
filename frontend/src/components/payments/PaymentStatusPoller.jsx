/**
 * components/payments/PaymentStatusPoller.jsx
 * Polls /payments/status/{checkoutId}/ every 4s until resolved or timed out.
 */
import { useEffect, useRef, useState } from "react";
import { paymentsAPI } from "../../services/api";

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS        = 30;   // 30 × 4s = 2 minutes max

export default function PaymentStatusPoller({ checkoutRequestId, onSuccess, onFailed }) {
  const [polls, setPolls]   = useState(0);
  const [status, setStatus] = useState("processing");
  const timerRef            = useRef(null);

  useEffect(() => {
    let count = 0;

    const poll = async () => {
      try {
        const data = await paymentsAPI.pollStatus(checkoutRequestId);
        setStatus(data.status);
        count++;
        setPolls(count);

        if (data.status === "completed") {
          clearInterval(timerRef.current);
          onSuccess && onSuccess(data.hotspot || null);
          return;
        }
        if (data.status === "failed" || data.status === "cancelled") {
          clearInterval(timerRef.current);
          onFailed && onFailed(data);
          return;
        }
        if (count >= MAX_POLLS) {
          clearInterval(timerRef.current);
          onFailed && onFailed({ status: "timeout" });
        }
      } catch {
        // network hiccup — keep polling
      }
    };

    poll();  // immediate first check
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [checkoutRequestId]); // eslint-disable-line

  return (
    <div className="text-center py-3">
      <div className="wb-status-dot online mx-auto mb-3" style={{ width: 16, height: 16 }} />
      <h6 style={{ color: "var(--wb-text-primary)" }}>Waiting for payment…</h6>
      <p className="mb-3" style={{ fontSize: "0.875rem", color: "var(--wb-text-muted)" }}>
        Enter your M-Pesa PIN on your phone to complete the payment.
      </p>
      <div className="wb-progress mb-2" style={{ maxWidth: 240, margin: "0 auto" }}>
        <div
          className="wb-progress-bar"
          style={{ width: `${Math.min((polls / MAX_POLLS) * 100, 95)}%`, transition: "width 4s linear" }}
        />
      </div>
      <small style={{ color: "var(--wb-text-muted)" }}>Status: {status} · Check {polls}/{MAX_POLLS}</small>
    </div>
  );
}