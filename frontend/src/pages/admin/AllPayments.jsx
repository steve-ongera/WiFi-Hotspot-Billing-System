import { useEffect, useState } from "react";
import { paymentsAPI } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import Pagination from "../../components/common/Pagination";
import { formatKES, formatDate, paymentStatusBadge, formatPhone } from "../../utils/formatters";

const PAGE_SIZE = 15;
const STATUSES  = ["", "completed", "pending", "processing", "failed", "cancelled"];

export default function AllPayments() {
  const [payments, setPayments]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [alert, setAlert]         = useState(null);
  const [statusFilter, setStatus] = useState("");
  const [page, setPage]           = useState(1);

  const load = (s = "") => {
    setLoading(true);
    paymentsAPI.listAll(s)
      .then((d) => setPayments(Array.isArray(d) ? d : []))
      .catch(() => setAlert({ type: "danger", msg: "Failed to load payments." }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleFilter = (s) => { setStatus(s); setPage(1); load(s); };

  const totalRevenue = payments.filter((p) => p.status === "completed").reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPages   = Math.ceil(payments.length / PAGE_SIZE);
  const paginated    = payments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div><h3>All Payments</h3><p className="text-muted mb-0">{payments.length} records · Revenue: <strong style={{ color: "var(--wb-green)" }}>{formatKES(totalRevenue)}</strong></p></div>
      </div>

      <AlertMessage type={alert?.type} message={alert?.msg} onClose={() => setAlert(null)} />

      {/* Status filter */}
      <div className="d-flex gap-2 flex-wrap mb-4">
        {STATUSES.map((s) => (
          <button key={s} className={`btn btn-sm ${statusFilter === s ? "btn-wb-primary" : "btn-wb-outline"}`} onClick={() => handleFilter(s)}>
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="wb-card">
        {loading ? <LoadingSpinner /> : paginated.length === 0 ? (
          <div className="wb-empty py-4"><i className="bi bi-credit-card" /><p>No payments found.</p></div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="wb-table">
                <thead>
                  <tr><th>#</th><th>Phone</th><th>Package</th><th>Amount</th><th>Method</th><th>Receipt</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {paginated.map((p) => {
                    const { cls, label } = paymentStatusBadge(p.status);
                    return (
                      <tr key={p.id}>
                        <td><span className="text-muted" style={{ fontSize: "0.8125rem" }}>#{p.id}</span></td>
                        <td><span className="wb-mono">{formatPhone(p.phone_number)}</span></td>
                        <td>{p.package_name}</td>
                        <td><strong style={{ color: "var(--wb-green)" }}>{formatKES(p.amount)}</strong></td>
                        <td>
                          <span className="wb-badge wb-badge-blue">
                            <i className={`bi ${p.payment_method === "mpesa" ? "bi-phone" : "bi-ticket-perforated"}`} />
                            {p.payment_method}
                          </span>
                        </td>
                        <td>{p.mpesa_receipt_number ? <span className="wb-mono" style={{ fontSize: "0.8125rem" }}>{p.mpesa_receipt_number}</span> : <span className="text-muted">—</span>}</td>
                        <td><span className={`wb-badge ${cls}`}>{label}</span></td>
                        <td style={{ fontSize: "0.8125rem", color: "var(--wb-text-muted)" }}>{formatDate(p.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4"><Pagination page={page} totalPages={totalPages} onChange={setPage} /></div>
          </>
        )}
      </div>
    </div>
  );
}