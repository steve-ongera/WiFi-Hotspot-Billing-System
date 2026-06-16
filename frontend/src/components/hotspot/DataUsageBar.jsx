import { formatBytes } from "../../utils/formatters";

export default function DataUsageBar({ bytesIn = 0, bytesOut = 0, limitMB = null }) {
  const totalBytes = bytesIn + bytesOut;
  const limitBytes = limitMB ? limitMB * 1024 * 1024 : null;
  const pct        = limitBytes ? Math.min((totalBytes / limitBytes) * 100, 100) : 0;
  const danger     = pct > 80;

  return (
    <div>
      <div className="d-flex justify-content-between mb-1" style={{ fontSize: "0.8125rem", color: "var(--wb-text-muted)" }}>
        <span>Data used: <strong style={{ color: "var(--wb-text-primary)" }}>{formatBytes(totalBytes)}</strong></span>
        {limitBytes && <span>Limit: {formatBytes(limitBytes)}</span>}
      </div>
      {limitBytes && (
        <div className="wb-progress">
          <div className={`wb-progress-bar ${danger ? "danger" : ""}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="d-flex gap-3 mt-2" style={{ fontSize: "0.8125rem", color: "var(--wb-text-muted)" }}>
        <span><i className="bi bi-arrow-down me-1 text-cyan" />{formatBytes(bytesIn)} down</span>
        <span><i className="bi bi-arrow-up me-1 text-green" />{formatBytes(bytesOut)} up</span>
      </div>
    </div>
  );
}