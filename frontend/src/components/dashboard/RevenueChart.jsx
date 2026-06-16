/**
 * components/dashboard/RevenueChart.jsx
 * Simple bar chart using Chart.js via react-chartjs-2
 * Install: npm install chart.js react-chartjs-2
 */
import { useEffect, useRef } from "react";
import { formatKES } from "../../utils/formatters";

export default function RevenueChart({ data = [] }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;

    // Dynamically import Chart.js to keep the bundle lean
    import("chart.js/auto").then((mod) => {
      const Chart = mod.default;

      if (chartRef.current) chartRef.current.destroy();

      chartRef.current = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels: data.map((d) => d.day),
          datasets: [
            {
              label: "Revenue (KES)",
              data: data.map((d) => Number(d.total)),
              backgroundColor: "rgba(6, 182, 212, 0.3)",
              borderColor: "rgba(6, 182, 212, 1)",
              borderWidth: 2,
              borderRadius: 6,
              borderSkipped: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${formatKES(ctx.parsed.y)}`,
              },
              backgroundColor: "#162235",
              titleColor: "#f1f5f9",
              bodyColor: "#94a3b8",
              borderColor: "rgba(255,255,255,0.08)",
              borderWidth: 1,
            },
          },
          scales: {
            x: {
              grid: { color: "rgba(255,255,255,0.05)" },
              ticks: { color: "#64748b", font: { size: 11 } },
            },
            y: {
              grid: { color: "rgba(255,255,255,0.05)" },
              ticks: {
                color: "#64748b",
                font: { size: 11 },
                callback: (v) => `KES ${(v / 1000).toFixed(0)}k`,
              },
              beginAtZero: true,
            },
          },
        },
      });
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="wb-empty py-4">
        <i className="bi bi-bar-chart" />
        <p>No revenue data for this period.</p>
      </div>
    );
  }

  return (
    <div style={{ height: "260px", position: "relative" }}>
      <canvas ref={canvasRef} />
    </div>
  );
}