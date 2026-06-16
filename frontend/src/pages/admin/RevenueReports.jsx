import { useEffect, useState } from "react";
import { reportsAPI } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import RevenueChart from "../../components/dashboard/RevenueChart";
import { formatKES, formatDateOnly } from "../../utils/formatters";

export default function RevenueReports() {
  const today    = new Date().toISOString().split("T")[0];
  const thirtyAgo = new Date(Date.now() - 30 * 86400_000).toISOString().split("T")[0];

  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [alert, setAlert]       = useState(null);
  const [startDate, setStart]   = useState(thirtyAgo);
  const [endDate, setEnd]       = useState(today);

  const load = (s = startDate, e = endDate) => {
    setLoading(true);
    reportsAPI.revenue({ start_date: s, end_date: e })
      .then(setData)
      .catch(() => setAlert({ type: "danger", msg: "Failed to load revenue data." }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const handleFilter = (ev) => { ev.preventDefault(); load(); };

  return (
    <div>
      <div className="mb-4"><h3>Revenue Reports</h3><p className="text-muted">Detailed revenue breakdown by date.</p></div>

      <AlertMessage type={alert?.type} message={alert?.msg} onClose={() => setAlert(null)} />

      {/* Date filter */}
      <div className="wb-card mb-4">
        <form onSubmit={handleFilter} className="row g-3 align-items-end">
          <div className="col-md-4">
            <label className="form-label">From</label>
            <input type="date" className="form-control" value={startDate} max={endDate} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="col-md-4">
            <label className="form-label">To</label>
            <input type="date" className="form-control" value={endDate} min={startDate} max={today} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="col-md-4">
            <button type="submit" className="btn btn-wb-primary w-100">Apply Filter</button>
          </div>
        </form>
      </div>

      {loading ? <LoadingSpinner fullPage /> : (
        <>
          {/* Summary cards */}
          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <div className="wb-stat-card" style={{ "--accent-color": "var(--wb-green)" }}>
                <div className="stat-icon" style={{ "--icon-bg": "rgba(16,185,129,0.15)", "--icon-color": "var(--wb-green)" }}><i className="bi bi-cash-stack" /></div>
                <div className="stat-value">{formatKES(data?.total_revenue)}</div>
                <div className="stat-label">Total Revenue</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="wb-stat-card" style={{ "--accent-color": "var(--wb-cyan)" }}>
                <div className="stat-icon" style={{ "--icon-bg": "rgba(6,182,212,0.15)", "--icon-color": "var(--wb-cyan)" }}><i className="bi bi-receipt" /></div>
                <div className="stat-value">{data?.total_transactions ?? 0}</div>
                <div className="stat-label">Transactions</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="wb-stat-card" style={{ "--accent-color": "var(--wb-blue)" }}>
                <div className="stat-icon" style={{ "--icon-bg": "rgba(37,99,235,0.15)", "--icon-color": "var(--wb-blue-light)" }}><i className="bi bi-calculator" /></div>
                <div className="stat-value">
                  {data?.total_transactions ? formatKES(data.total_revenue / data.total_transactions) : "—"}
                </div>
                <div className="stat-label">Avg per Transaction</div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="wb-card mb-4">
            <div className="wb-card-header"><span className="wb-card-title"><i className="bi bi-bar-chart me-2" />Daily Revenue</span></div>
            <RevenueChart data={data?.by_day || []} />
          </div>

          {/* Daily breakdown table */}
          <div className="wb-card">
            <div className="wb-card-header"><span className="wb-card-title"><i className="bi bi-table me-2" />Daily Breakdown</span></div>
            {(data?.by_day || []).length === 0 ? (
              <div className="wb-empty py-4"><i className="bi bi-bar-chart" /><p>No revenue in this period.</p></div>
            ) : (
              <div className="table-responsive">
                <table className="wb-table">
                  <thead><tr><th>Date</th><th>Transactions</th><th>Revenue</th></tr></thead>
                  <tbody>
                    {[...(data?.by_day || [])].reverse().map((row) => (
                      <tr key={row.day}>
                        <td>{formatDateOnly(row.day)}</td>
                        <td>{row.count}</td>
                        <td><strong style={{ color: "var(--wb-green)" }}>{formatKES(row.total)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}