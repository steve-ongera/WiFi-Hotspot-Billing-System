export default function StatCard({ icon, label, value, accentColor = "var(--wb-blue)", iconBg, iconColor }) {
  return (
    <div className="wb-stat-card" style={{ "--accent-color": accentColor, "--icon-bg": iconBg, "--icon-color": iconColor }}>
      <div className="stat-icon">
        <i className={`bi ${icon}`} />
      </div>
      <div className="stat-value">{value ?? "—"}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}