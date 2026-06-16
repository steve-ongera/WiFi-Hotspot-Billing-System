import { useEffect, useState } from "react";
import { paymentsAPI } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import Pagination from "../../components/common/Pagination";
import { formatKES, formatDate, paymentStatusBadge } from "../../utils/formatters";

const PAGE_SIZE = 10;

export default function PaymentHistory() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [page, setPage]         = useState(1);

  useEffect(() => {
    paymentsAPI.history()
      .then((data) => setPayments(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load payment history."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner fullPage />;

  const totalPages = Math.ceil(payments.length / PAGE_SIZE);
  const paginated  = payments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="mb-4">
        <h3>Payment History</h3>
        <p className="text-muted">All your M-Pesa transactions.</p>
      </div>

      <AlertMessage type="danger" message={error} onClose={() => setError("")} />

      <div className="wb-card">
        {payments.length === 0 ? (
          <div className="wb-empty py-4">
            <i className="bi bi-receipt" />
            <h6>No payments yet</h6>
            <p>Your payment history will appear here.</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="wb-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Package</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Receipt</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((p) => {
                    const { cls, label } = paymentStatusBadge(p.status);
                    return (
                      <tr key={p.id}>
                        <td><span className="text-muted" style={{ fontSize: "0.8125rem" }}>#{p.id}</span></td>
                        <td>{p.package_name}</td>
                        <td><strong style={{ color: "var(--wb-green)" }}>{formatKES(p.amount)}</strong></td>
                        <td>
                          <span className="wb-badge wb-badge-blue">
                            <i className={`bi ${p.payment_method === "mpesa" ? "bi-phone" : "bi-ticket-perforated"}`} />
                            {p.payment_method === "mpesa" ? "M-Pesa" : "Voucher"}
                          </span>
                        </td>
                        <td>
                          {p.mpesa_receipt_number
                            ? <span className="wb-mono">{p.mpesa_receipt_number}</span>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td><span className={`wb-badge ${cls}`}>{label}</span></td>
                        <td style={{ fontSize: "0.8125rem", color: "var(--wb-text-muted)" }}>
                          {formatDate(p.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}