/**
 * utils/formatters.js — WifiBill display helpers
 */

/** Format a number as KES currency */
export const formatKES = (amount) => {
  if (amount == null) return "KES 0.00";
  return `KES ${Number(amount).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/** Format bytes to human-readable (KB / MB / GB) */
export const formatBytes = (bytes = 0) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

/** Format seconds to hh:mm:ss */
export const formatDuration = (totalSeconds = 0) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
};

/** Format a date string to "12 Jan 2025, 14:30" */
export const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Format date only "12 Jan 2025" */
export const formatDateOnly = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/** "5 minutes ago", "2 days ago" */
export const formatRelative = (dateStr) => {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

/** Format package duration: 1 hours → "1 Hour", 7 days → "7 Days" */
export const formatDurationLabel = (value, unit) => {
  const label = unit.replace(/s$/, "");
  return `${value} ${value === 1 ? label.charAt(0).toUpperCase() + label.slice(1) : label.charAt(0).toUpperCase() + label.slice(1) + "s"}`;
};

/** Normalize phone to display format: 2547XXXXXXXX → 0712 345 678 */
export const formatPhone = (phone = "") => {
  const p = String(phone);
  if (p.startsWith("254") && p.length === 12) {
    const local = "0" + p.slice(3);
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  return p;
};

/** Payment status → badge class + label */
export const paymentStatusBadge = (status) => {
  const map = {
    completed:  { cls: "wb-badge-green",  label: "Completed" },
    pending:    { cls: "wb-badge-amber",  label: "Pending"   },
    processing: { cls: "wb-badge-blue",   label: "Processing"},
    failed:     { cls: "wb-badge-red",    label: "Failed"    },
    cancelled:  { cls: "wb-badge-muted",  label: "Cancelled" },
  };
  return map[status] || { cls: "wb-badge-muted", label: status };
};

/** Mbps rate-limit display: "2M/5M" → "2 Mbps ↑ / 5 Mbps ↓" */
export const formatRateLimit = (rateStr = "") => {
  if (!rateStr || rateStr === "0/0") return "Unlimited";
  const [up, down] = rateStr.split("/");
  const clean = (v) => (v === "0" ? "∞" : v.replace("M", " Mbps"));
  return `${clean(up)} ↑ / ${clean(down)} ↓`;
};