/**
 * components/payments/MpesaModal.jsx
 * Shown after the customer picks a package. Collects phone, sends STK push,
 * then hands off to PaymentStatusPoller.
 */
import { useEffect, useRef, useState } from "react";
import { paymentsAPI, getErrorMessage } from "../../services/api";
import { validatePhone } from "../../utils/validators";
import { formatKES } from "../../utils/formatters";
import AlertMessage from "../common/AlertMessage";
import PaymentStatusPoller from "./PaymentStatusPoller";
import { useAuth } from "../../contexts/AuthContext";

export default function MpesaModal({ show, pkg, onClose, onSuccess }) {
  const { user } = useAuth();
  const modalRef = useRef(null);

  const [phone, setPhone]         = useState(user?.phone_number || "");
  const [phoneErr, setPhoneErr]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [alert, setAlert]         = useState(null);
  const [checkoutId, setCheckoutId] = useState(null);  // triggers poller

  // Bootstrap modal show/hide
  useEffect(() => {
    if (!modalRef.current) return;
    const Modal = window.bootstrap?.Modal;
    if (!Modal) return;
    const modal = Modal.getOrCreateInstance(modalRef.current);
    if (show) { modal.show(); } else { modal.hide(); reset(); }
  }, [show]);

  const reset = () => { setPhone(user?.phone_number || ""); setPhoneErr(""); setAlert(null); setCheckoutId(null); setLoading(false); };

  const handlePay = async () => {
    const err = validatePhone(phone);
    if (err) { setPhoneErr(err); return; }
    setLoading(true); setAlert(null);
    try {
      const result = await paymentsAPI.initiate({ package_id: pkg.id, phone_number: phone });
      setCheckoutId(result.checkout_request_id);
    } catch (ex) {
      setAlert({ type: "danger", msg: getErrorMessage(ex) });
    } finally {
      setLoading(false);
    }
  };

  if (!pkg) return null;

  return (
    <div className="modal fade" ref={modalRef} tabIndex="-1" data-bs-backdrop="static">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title"><i className="bi bi-phone me-2 text-cyan" />M-Pesa Payment</h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={loading} />
          </div>

          <div className="modal-body">
            {!checkoutId ? (
              <>
                {/* Package summary */}
                <div className="wb-card mb-4">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-semibold" style={{ color: "var(--wb-text-primary)" }}>{pkg.name}</div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--wb-text-muted)" }}>{pkg.duration_value} {pkg.duration_unit} · {pkg.device_limit} device(s)</div>
                    </div>
                    <div className="wb-package-price" style={{ fontSize: "1.5rem" }}>{formatKES(pkg.price)}</div>
                  </div>
                </div>

                <AlertMessage type={alert?.type} message={alert?.msg} onClose={() => setAlert(null)} />

                <div className="mb-3">
                  <label className="form-label">M-Pesa Phone Number</label>
                  <div className="input-group">
                    <span className="input-group-text"><i className="bi bi-phone" /></span>
                    <input
                      type="tel"
                      className={`form-control ${phoneErr ? "is-invalid" : ""}`}
                      placeholder="07XX XXX XXX"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setPhoneErr(""); }}
                    />
                    {phoneErr && <div className="invalid-feedback">{phoneErr}</div>}
                  </div>
                  <div className="form-text" style={{ color: "var(--wb-text-muted)" }}>You will receive an M-Pesa prompt on this number.</div>
                </div>
              </>
            ) : (
              <PaymentStatusPoller
                checkoutRequestId={checkoutId}
                onSuccess={(hotspot) => { onSuccess && onSuccess(hotspot); }}
                onFailed={() => { setCheckoutId(null); setAlert({ type: "danger", msg: "Payment failed or was cancelled. Please try again." }); }}
              />
            )}
          </div>

          {!checkoutId && (
            <div className="modal-footer">
              <button className="btn btn-wb-outline" onClick={onClose} disabled={loading}>Cancel</button>
              <button className="btn btn-wb-cyan" onClick={handlePay} disabled={loading}>
                {loading
                  ? <><span className="wb-spinner me-2" style={{ width: "1rem", height: "1rem" }} />Sending prompt…</>
                  : <><i className="bi bi-phone me-2" />Pay {formatKES(pkg.price)}</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}