import { formatKES, formatRelative, paymentStatusBadge } from "../../utils/formatters";

export default function RecentPayments({ payments = [] }) {
  if (payments.length === 0) {
    return (
      <div className="wb-empty py-4">
        <i className="bi bi-receipt" />
        <p>No recent payments.</p>
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="wb-table">
        <thead>
          <tr>
            <th>Phone</th>
            <th>Package</th>
            <th>Amount</th>
            <th>Status</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => {
            const { cls, label } = paymentStatusBadge(p.status);
            return (
              <tr key={p.id}>
                <td><span className="wb-mono">{p.phone_number}</span></td>
                <td>{p.package_name}</td>
                <td><span className="wb-amount">{formatKES(p.amount)}</span></td>
                <td><span className={`wb-badge ${cls}`}>{label}</span></td>
                <td>{formatRelative(p.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}