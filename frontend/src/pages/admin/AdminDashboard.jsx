import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { reportsAPI, paymentsAPI } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import StatCard from "../../components/dashboard/StatCard";
import RevenueChart from "../../components/dashboard/RevenueChart";
import RecentPayments from "../../components/dashboard/RecentPayments";
import { formatKES } from "../../utils/formatters";

export default function AdminDashboard() {
  const [stats, setStats]     = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    Promise.all([
      reportsAPI.dashboardStats(),
      reportsAPI.revenue(),
      paymentsAPI.listAll(),
    ]).then(([s, r, p]) => {
      setStats(s);
      setRevenue(Array.isArray(r?.by_day) ? r.by_day : []);
      setPayments(Array.isArray(p) ? p.slice(0, 8) : []);
    }).catch(() => setError("Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div><h3>Admin Dashboard</h3><p className="text-muted mb-0">System overview</p></div>
        <Link to="/admin/payments" className="btn btn-wb-outline btn-sm"><i className="bi bi-receipt me-2" />All Payments</Link>
      </div>

      <AlertMessage type="danger" message={error} onClose={() => setError("")} />

      {/* Stat cards */}
      <div className="row g-3 mb-4">
        {[
          { icon: "bi-people", label: "Total Customers",  value: stats?.total_customers,  color: "var(--wb-blue)",  iconBg: "rgba(37,99,235,0.15)",  iconColor: "var(--wb-blue-light)" },
          { icon: "bi-wifi",   label: "Active Sessions",  value: stats?.active_sessions,   color: "var(--wb-green)", iconBg: "rgba(16,185,129,0.15)", iconColor: "var(--wb-green)"      },
          { icon: "bi-cash",   label: "Today's Revenue",  value: formatKES(stats?.today_revenue), color: "var(--wb-cyan)", iconBg: "rgba(6,182,212,0.15)", iconColor: "var(--wb-cyan)" },
          { icon: "bi-graph-up", label: "Total Revenue",  value: formatKES(stats?.total_revenue),  color: "var(--wb-amber)", iconBg: "rgba(245,158,11,0.15)", iconColor: "var(--wb-amber)" },
          { icon: "bi-clock",  label: "Pending Payments", value: stats?.pending_payments,  color: "var(--wb-red)",   iconBg: "rgba(239,68,68,0.15)",  iconColor: "var(--wb-red)"        },
          { icon: "bi-ticket-perforated", label: "Unused Vouchers", value: stats?.unused_vouchers, color: "var(--wb-blue)", iconBg: "rgba(37,99,235,0.15)", iconColor: "var(--wb-blue-light)" },
        ].map((s) => (
          <div key={s.label} className="col-6 col-md-4 col-xl-2">
            <StatCard icon={s.icon} label={s.label} value={s.value} accentColor={s.color} iconBg={s.iconBg} iconColor={s.iconColor} />
          </div>
        ))}
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="wb-card">
            <div className="wb-card-header">
              <span className="wb-card-title"><i className="bi bi-bar-chart me-2" />Revenue (Last 30 Days)</span>
              <Link to="/admin/reports/revenue" className="btn btn-wb-ghost btn-sm">Full report <i className="bi bi-arrow-right" /></Link>
            </div>
            <RevenueChart data={revenue} />
          </div>
        </div>
        <div className="col-lg-5">
          <div className="wb-card">
            <div className="wb-card-header">
              <span className="wb-card-title"><i className="bi bi-receipt me-2" />Recent Payments</span>
            </div>
            <RecentPayments payments={payments} />
          </div>
        </div>
      </div>
    </div>
  );
}