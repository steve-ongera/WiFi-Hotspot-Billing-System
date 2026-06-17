/**
 * components/payments/ReceiptDownload.jsx
 *
 * Generates and downloads a printable HTML receipt in a new tab.
 * Falls back to a clean in-browser print sheet when the backend
 * PDF endpoint is not yet wired up.
 *
 * Usage:
 *   <ReceiptDownload payment={paymentObj} />
 */
import { useState } from "react";
import { paymentsAPI, getErrorMessage } from "../../services/api";
import { formatKES, formatDate } from "../../utils/formatters";

/**
 * Build a standalone HTML receipt page as a string.
 * Opened in a new tab so the browser's native print dialog handles PDF export.
 */
function buildReceiptHTML(payment) {
  const { id, package_name, amount, phone_number, mpesa_receipt_number, status, payment_method, created_at, paid_at } = payment;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>WifiBill Receipt #${id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 40px 20px; }
    .receipt { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden; }
    .receipt-header { background: #0a1628; color: #fff; padding: 28px 32px; text-align: center; }
    .receipt-header h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
    .receipt-header h1 span { color: #06b6d4; }
    .receipt-header p { color: #94a3b8; font-size: 0.875rem; margin-top: 4px; }
    .receipt-body { padding: 28px 32px; }
    .receipt-status { text-align: center; margin-bottom: 24px; }
    .receipt-status .badge { display: inline-block; padding: 6px 16px; border-radius: 999px; font-size: 0.8125rem; font-weight: 600; background: ${status === "completed" ? "#dcfce7" : "#fee2e2"}; color: ${status === "completed" ? "#15803d" : "#dc2626"}; }
    .receipt-amount { text-align: center; margin-bottom: 24px; padding: 20px; background: #f1f5f9; border-radius: 8px; }
    .receipt-amount .label { font-size: 0.8125rem; color: #64748b; margin-bottom: 4px; }
    .receipt-amount .amount { font-size: 2.25rem; font-weight: 700; color: #0a1628; }
    .receipt-rows { border-top: 1px solid #e2e8f0; }
    .receipt-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid #f1f5f9; gap: 16px; }
    .receipt-row .key { font-size: 0.8125rem; color: #64748b; flex-shrink: 0; }
    .receipt-row .val { font-size: 0.8125rem; font-weight: 600; color: #1e293b; text-align: right; word-break: break-all; }
    .receipt-row .val.mono { font-family: 'Courier New', monospace; color: #0284c7; }
    .receipt-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 32px; text-align: center; }
    .receipt-footer p { font-size: 0.8125rem; color: #64748b; }
    @media print {
      body { background: #fff; padding: 0; }
      .receipt { box-shadow: none; border-radius: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="receipt-header">
      <h1>Wifi<span>Bill</span></h1>
      <p>Payment Receipt</p>
    </div>
    <div class="receipt-body">
      <div class="receipt-status">
        <span class="badge">${status === "completed" ? "✓ PAID" : status.toUpperCase()}</span>
      </div>
      <div class="receipt-amount">
        <div class="label">Amount Paid</div>
        <div class="amount">${formatKES(amount)}</div>
      </div>
      <div class="receipt-rows">
        ${[
          ["Receipt #",      `#${id}`],
          ["Package",        package_name],
          ["Phone",          phone_number],
          ["Method",         payment_method === "mpesa" ? "M-Pesa" : payment_method],
          mpesa_receipt_number ? ["M-Pesa Receipt", mpesa_receipt_number] : null,
          ["Date",           formatDate(paid_at || created_at)],
          ["Status",         status.charAt(0).toUpperCase() + status.slice(1)],
        ].filter(Boolean).map(([k, v]) => `
          <div class="receipt-row">
            <span class="key">${k}</span>
            <span class="val ${k === "M-Pesa Receipt" ? "mono" : ""}">${v}</span>
          </div>`).join("")}
      </div>
    </div>
    <div class="receipt-footer">
      <p>Thank you for using WifiBill!</p>
      <p style="margin-top:4px">For support: 0757 790 687</p>
    </div>
  </div>
  <div class="no-print" style="text-align:center;margin-top:24px">
    <button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:0.9375rem;font-weight:600;cursor:pointer;">
      🖨 Print / Save as PDF
    </button>
  </div>
</body>
</html>`;
}

export default function ReceiptDownload({ payment, variant = "btn-wb-outline", size = "sm", label = "Receipt" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleDownload = async () => {
    setLoading(true);
    setError("");
    try {
      // Try the backend PDF endpoint first
      await paymentsAPI.receipt(payment.id);
    } catch {
      // Backend PDF not ready — fall back to client-side HTML receipt
    } finally {
      // Always open the client-side receipt (works without backend PDF)
      const html   = buildReceiptHTML(payment);
      const blob   = new Blob([html], { type: "text/html" });
      const url    = URL.createObjectURL(blob);
      const win    = window.open(url, "_blank");
      if (!win) {
        // Popup blocked — trigger download instead
        const a  = document.createElement("a");
        a.href   = url;
        a.download = `WifiBill-Receipt-${payment.id}.html`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className={`btn btn-${size} ${variant} d-inline-flex align-items-center gap-1`}
        onClick={handleDownload}
        disabled={loading || payment.status !== "completed"}
        title={payment.status !== "completed" ? "Receipt only available for completed payments" : "Download receipt"}
      >
        {loading
          ? <span className="wb-spinner" style={{ width: "0.875rem", height: "0.875rem" }} />
          : <i className="bi bi-download" />}
        {label}
      </button>
      {error && <div className="text-danger mt-1" style={{ fontSize: "0.75rem" }}>{error}</div>}
    </>
  );
}