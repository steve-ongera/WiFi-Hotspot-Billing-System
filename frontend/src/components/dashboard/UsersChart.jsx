/**
 * components/dashboard/UsersChart.jsx
 * Doughnut chart showing active vs expired vs suspended users.
 * Uses Chart.js loaded dynamically.
 */
import { useEffect, useRef } from "react";

export default function UsersChart({ active = 0, expired = 0, suspended = 0 }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);
  const total     = active + expired + suspended;

  useEffect(() => {
    if (!canvasRef.current) return;

    import("chart.js/auto").then(({ default: Chart }) => {
      if (chartRef.current) chartRef.current.destroy();

      chartRef.current = new Chart(canvasRef.current, {
        type: "doughnut",
        data: {
          labels: ["Active", "Expired", "Suspended"],
          datasets: [
            {
              data: [active, expired, suspended],
              backgroundColor: [
                "rgba(16, 185, 129, 0.85)",   // green  — active
                "rgba(100, 116, 139, 0.6)",    // slate  — expired
                "rgba(239, 68, 68, 0.75)",     // red    — suspended
              ],
              borderColor: [
                "rgba(16, 185, 129, 1)",
                "rgba(100, 116, 139, 0.8)",
                "rgba(239, 68, 68, 1)",
              ],
              borderWidth: 2,
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "68%",
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: "#94a3b8",
                font: { size: 12, family: "'Inter', sans-serif" },
                padding: 16,
                usePointStyle: true,
                pointStyleWidth: 8,
              },
            },
            tooltip: {
              backgroundColor: "#162235",
              titleColor: "#f1f5f9",
              bodyColor: "#94a3b8",
              borderColor: "rgba(255,255,255,0.08)",
              borderWidth: 1,
              callbacks: {
                label: (ctx) => {
                  const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                  return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
                },
              },
            },
          },
        },
      });
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [active, expired, suspended]); // eslint-disable-line

  if (total === 0) {
    return (
      <div className="wb-empty py-4">
        <i className="bi bi-people" />
        <p>No user data available.</p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Centre label */}
      <div
        style={{
          position: "absolute",
          top: "42%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div style={{ fontFamily: "var(--font-display)", fontSize: "1.875rem", fontWeight: 700, color: "var(--wb-text-primary)", lineHeight: 1 }}>
          {total}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--wb-text-muted)", marginTop: 2 }}>Total</div>
      </div>

      <div style={{ height: 240 }}>
        <canvas ref={canvasRef} />
      </div>

      {/* Legend rows */}
      <div className="d-flex flex-column gap-2 mt-3">
        {[
          { label: "Active",    value: active,    color: "#10b981" },
          { label: "Expired",   value: expired,   color: "#64748b" },
          { label: "Suspended", value: suspended, color: "#ef4444" },
        ].map(({ label, value, color }) => (
          <div key={label} className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: "0.8125rem", color: "var(--wb-text-secondary)" }}>{label}</span>
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.875rem", color: "var(--wb-text-primary)" }}>
              {value}
              <span style={{ fontSize: "0.75rem", color: "var(--wb-text-muted)", marginLeft: 4 }}>
                ({total > 0 ? ((value / total) * 100).toFixed(0) : 0}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}