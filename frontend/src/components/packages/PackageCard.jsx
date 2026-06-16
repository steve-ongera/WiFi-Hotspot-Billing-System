import { formatKES, formatDurationLabel, formatRateLimit } from "../../utils/formatters";

export default function PackageCard({ pkg, selected, onSelect }) {
  return (
    <div
      className={`wb-package-card ${selected ? "selected" : ""}`}
      onClick={() => onSelect && onSelect(pkg)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect && onSelect(pkg)}
    >
      {pkg.device_limit > 1 && (
        <span className="wb-badge wb-badge-cyan mb-2">
          <i className="bi bi-people-fill" /> Shared — {pkg.device_limit} devices
        </span>
      )}
      <div className="wb-package-name">{pkg.name}</div>
      <div className="wb-package-price">
        {formatKES(pkg.price)} <span>/ {formatDurationLabel(pkg.duration_value, pkg.duration_unit)}</span>
      </div>
      {pkg.description && <p className="mt-2 mb-3" style={{ fontSize: "0.875rem", color: "var(--wb-text-muted)" }}>{pkg.description}</p>}
      <ul className="list-unstyled mt-3 mb-0" style={{ fontSize: "0.875rem", color: "var(--wb-text-secondary)" }}>
        <li><i className="bi bi-speedometer2 me-2 text-cyan" />{formatRateLimit(pkg.mikrotik_rate_limit)}</li>
        {pkg.data_limit_mb && <li><i className="bi bi-database me-2 text-cyan" />{(pkg.data_limit_mb / 1024).toFixed(1)} GB data cap</li>}
        <li><i className="bi bi-clock me-2 text-cyan" />{formatDurationLabel(pkg.duration_value, pkg.duration_unit)} validity</li>
      </ul>
      {selected && (
        <div className="mt-3 text-center">
          <span className="wb-badge wb-badge-cyan"><i className="bi bi-check-circle-fill" /> Selected</span>
        </div>
      )}
    </div>
  );
}