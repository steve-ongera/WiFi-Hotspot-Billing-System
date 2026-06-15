/**
 * components/common/ConfirmModal.jsx
 */
import { useEffect, useRef } from "react";

export default function ConfirmModal({
  show,
  title = "Confirm Action",
  message = "Are you sure?",
  confirmLabel = "Confirm",
  confirmVariant = "btn-wb-danger",
  loading = false,
  onConfirm,
  onCancel,
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!modalRef.current) return;
    const Modal = window.bootstrap?.Modal;
    if (!Modal) return;
    const modal = Modal.getOrCreateInstance(modalRef.current);
    show ? modal.show() : modal.hide();
  }, [show]);

  return (
    <div className="modal fade" ref={modalRef} tabIndex="-1" data-bs-backdrop="static">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-exclamation-triangle text-amber me-2" />
              {title}
            </h5>
            <button type="button" className="btn-close" onClick={onCancel} disabled={loading} />
          </div>
          <div className="modal-body">
            <p className="mb-0" style={{ color: "var(--wb-text-secondary)" }}>{message}</p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-wb-outline" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button className={`btn ${confirmVariant}`} onClick={onConfirm} disabled={loading}>
              {loading ? <><span className="wb-spinner me-2" style={{ width: "1rem", height: "1rem" }} /> Working…</> : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}