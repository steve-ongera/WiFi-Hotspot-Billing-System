import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { hotspotAPI, paymentsAPI } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import SessionTimer from "../../components/hotspot/SessionTimer";
import DataUsageBar from "../../components/hotspot/DataUsageBar";
import { formatDate, paymentStatusBadge, formatKES } from "../../utils/formatters";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [session, setSession]   = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  useEffect(() => {
    Promise.all([
      hotspotAPI.mySession().catch(() => null),
      paymentsAPI.history().catch(() => []),
    ]).then(([sess, pays]) => {
      setSession(sess);
      setPayments(Array.isArray(pays) ? pays.slice(0, 5) : []);
    }).catch(() => setError("Failed to load dashboard data."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div>
      <div className="mb-4">
        <h3>Welcome back, {user?.first_name || "Customer"} 👋</h3>
        <p className="text-muted">Here's your connection overview.</p>
      </div>

      <AlertMessage type="danger" message={error} onClose={() => setError("")} />

      {/* Active session card */}
      <div className="wb-card mb-4">
        <div className="wb-card-header">
          <span className="wb-card-title"><i className="bi bi-wifi me-2 text-cyan" />Active Session</span>
          <span className={`wb-badge ${session ? "wb-badge-green" : "wb-badge-muted"}`}>
            <span className={`wb-status-dot ${session ? "online" : "offline"}`} />
            {session ? "Connected" : "Offline"}
          </span>
        </div>

        {session ? (
          <div className="row g-4">
            <div className="col-md-4 text-center">
              <SessionTimer secondsRemaining={session.time_remaining_seconds} />
            </div>
            <div className="col-md-8">
              <div className="mb-3">
                <div className="form-label">Package</div>
                <div style={{ color: "var(--wb-text-primary)", fontWeight: 600 }}>{session.package_name}</div>
              </div>
              <div className="mb-3">
                <div className="form-label">Credentials</div>
                <div><span className="wb-mono">{session.username}</span> / <span className="wb-mono">{session.password}</span></div>
              </div>
              <DataUsageBar
                bytesIn={session.current_session?.bytes_in || 0}
                bytesOut={session.current_session?.bytes_out || 0}
                limitMB={null}
              />
            </div>
          </div>
        ) : (
          <div className="wb-empty py-3">
            <i className="bi bi-wifi-off" />
            <h6>No active session</h6>
            <p>Purchase a package to get connected.</p>
            <Link to="/packages" className="btn btn-wb-cyan btn-sm"><i className="bi bi-wifi me-2" />Buy a Package</Link>
          </div>
        )}
      </div>

      {/* Recent payments */}
      <div className="wb-card">
        <div className="wb-card-header">
          <span className="wb-card-title"><i className="bi bi-receipt me-2" />Recent Payments</span>
          <Link to="/payments" className="btn btn-wb-ghost btn-sm">View all <i className="bi bi-arrow-right" /></Link>
        </div>
        {payments.length === 0 ? (
          <div className="wb-empty py-3">
            <i className="bi bi-receipt" />
            <p>No payments yet.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="wb-table">
              <thead><tr><th>Package</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {payments.map((p) => {
                  const { cls, label } = paymentStatusBadge(p.status);
                  return (
                    <tr key={p.id}>
                      <td>{p.package_name}</td>
                      <td>{formatKES(p.amount)}</td>
                      <td><span className={`wb-badge ${cls}`}>{label}</span></td>
                      <td style={{ fontSize: "0.8125rem" }}>{formatDate(p.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}