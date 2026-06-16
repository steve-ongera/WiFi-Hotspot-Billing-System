import { useEffect, useState } from "react";
import { reportsAPI, hotspotAPI } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import DataUsageBar from "../../components/hotspot/DataUsageBar";
import { formatBytes, formatDate, formatPhone } from "../../utils/formatters";

export default function BandwidthReports() {
  const [onlineUsers, setOnlineUsers]   = useState([]);
  const [usageLog, setUsageLog]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [alert, setAlert]               = useState(null);
  const [refreshing, setRefreshing]     = useState(false);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    try {
      const [online, usage] = await Promise.all([
        hotspotAPI.onlineUsers().catch(() => []),
        reportsAPI.bandwidth().catch(() => []),
      ]);
      setOnlineUsers(Array.isArray(online) ? online : []);
      setUsageLog(Array.isArray(usage) ? usage : []);
    } catch {
      setAlert({ type: "danger", msg: "Failed to load bandwidth data." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalDown = onlineUsers.reduce((s, u) => s + (u.mikrotik_bytes_in || 0), 0);
  const totalUp   = onlineUsers.reduce((s, u) => s + (u.mikrotik_bytes_out || 0), 0);

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div><h3>Bandwidth Reports</h3><p className="text-muted mb-0">Live sessions and usage snapshots</p></div>
        <button className="btn btn-wb-outline btn-sm" onClick={() => load(true)} disabled={refreshing}>
          <i className={`bi bi-arrow-clockwise me-2 ${refreshing ? "spin" : ""}`} />Refresh
        </button>
      </div>

      <AlertMessage type={alert?.type} message={alert?.msg} onClose={() => setAlert(null)} />

      {/* Summary */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="wb-stat-card" style={{ "--accent-color": "var(--wb-green)" }}>
            <div className="stat-icon" style={{ "--icon-bg": "rgba(16,185,129,0.15)", "--icon-color": "var(--wb-green)" }}><i className="bi bi-wifi" /></div>
            <div className="stat-value">{onlineUsers.length}</div>
            <div className="stat-label">Online Right Now</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="wb-stat-card" style={{ "--accent-color": "var(--wb-cyan)" }}>
            <div className="stat-icon" style={{ "--icon-bg": "rgba(6,182,212,0.15)", "--icon-color": "var(--wb-cyan)" }}><i className="bi bi-arrow-down" /></div>
            <div className="stat-value">{formatBytes(totalDown)}</div>
            <div className="stat-label">Total Downloaded</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="wb-stat-card" style={{ "--accent-color": "var(--wb-blue)" }}>
            <div className="stat-icon" style={{ "--icon-bg": "rgba(37,99,235,0.15)", "--icon-color": "var(--wb-blue-light)" }}><i className="bi bi-arrow-up" /></div>
            <div className="stat-value">{formatBytes(totalUp)}</div>
            <div className="stat-label">Total Uploaded</div>
          </div>
        </div>
      </div>

      {/* Live sessions */}
      <div className="wb-card mb-4">
        <div className="wb-card-header"><span className="wb-card-title"><i className="bi bi-broadcast me-2 text-green" />Live Sessions</span></div>
        {onlineUsers.length === 0 ? (
          <div className="wb-empty py-4"><i className="bi bi-wifi-off" /><p>No active sessions.</p></div>
        ) : (
          <div className="table-responsive">
            <table className="wb-table">
              <thead><tr><th>Username</th><th>Package</th><th>IP</th><th>Downloaded</th><th>Uploaded</th><th>Expires</th></tr></thead>
              <tbody>
                {onlineUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="wb-status-dot online" />
                        <span className="wb-mono">{u.username}</span>
                      </div>
                    </td>
                    <td>{u.package_name}</td>
                    <td><span className="wb-mono" style={{ fontSize: "0.8125rem" }}>{u.ip_address || "—"}</span></td>
                    <td><span className="text-cyan">{formatBytes(u.mikrotik_bytes_in || 0)}</span></td>
                    <td><span className="text-green">{formatBytes(u.mikrotik_bytes_out || 0)}</span></td>
                    <td style={{ fontSize: "0.8125rem", color: "var(--wb-text-muted)" }}>{formatDate(u.expires_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Snapshot log */}
      <div className="wb-card">
        <div className="wb-card-header"><span className="wb-card-title"><i className="bi bi-clock-history me-2" />Usage Snapshot Log</span></div>
        {usageLog.length === 0 ? (
          <div className="wb-empty py-4"><i className="bi bi-activity" /><p>No snapshots yet. They are recorded every 5 minutes.</p></div>
        ) : (
          <div className="table-responsive">
            <table className="wb-table">
              <thead><tr><th>User</th><th>Downloaded</th><th>Uploaded</th><th>Total</th><th>Recorded</th></tr></thead>
              <tbody>
                {usageLog.slice(0, 100).map((log) => (
                  <tr key={log.id}>
                    <td><span className="wb-mono" style={{ fontSize: "0.8125rem" }}>{log.hotspot_user}</span></td>
                    <td>{formatBytes(log.bytes_in)}</td>
                    <td>{formatBytes(log.bytes_out)}</td>
                    <td><strong style={{ color: "var(--wb-cyan)" }}>{formatBytes(log.bytes_in + log.bytes_out)}</strong></td>
                    <td style={{ fontSize: "0.8125rem", color: "var(--wb-text-muted)" }}>{formatDate(log.recorded_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}