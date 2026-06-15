/**
 * components/common/AlertMessage.jsx
 */
export default function AlertMessage({ type = "info", message, onClose }) {
  if (!message) return null;

  const typeMap = {
    success: { cls: "wb-alert-success", icon: "bi-check-circle-fill" },
    danger:  { cls: "wb-alert-danger",  icon: "bi-exclamation-triangle-fill" },
    warning: { cls: "wb-alert-warning", icon: "bi-exclamation-circle-fill" },
    info:    { cls: "wb-alert-info",    icon: "bi-info-circle-fill" },
  };
  const { cls, icon } = typeMap[type] || typeMap.info;

  return (
    <div className={`wb-alert ${cls} mb-3`} role="alert">
      <i className={`bi ${icon} flex-shrink-0`} />
      <span className="flex-grow-1">{message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="btn-wb-ghost btn btn-sm p-0 ms-2"
          aria-label="Close"
        >
          <i className="bi bi-x-lg" style={{ fontSize: "0.75rem" }} />
        </button>
      )}
    </div>
  );
}