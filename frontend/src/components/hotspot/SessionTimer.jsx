/**
 * components/hotspot/SessionTimer.jsx
 * Counts down live from time_remaining_seconds.
 */
import { useEffect, useState } from "react";
import { formatDuration } from "../../utils/formatters";

export default function SessionTimer({ secondsRemaining = 0 }) {
  const [secs, setSecs] = useState(secondsRemaining);

  useEffect(() => { setSecs(secondsRemaining); }, [secondsRemaining]);

  useEffect(() => {
    if (secs <= 0) return;
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secs > 0]); // eslint-disable-line

  const expiring = secs > 0 && secs < 300;  // < 5 minutes

  return (
    <div className="text-center">
      <div className={`wb-timer ${expiring ? "expiring" : ""}`}>
        {secs > 0 ? formatDuration(secs) : "Expired"}
      </div>
      <div className="mt-1" style={{ fontSize: "0.8125rem", color: "var(--wb-text-muted)" }}>
        {secs > 0 ? (expiring ? "⚠ Expiring soon!" : "Time remaining") : "Session ended"}
      </div>
    </div>
  );
}