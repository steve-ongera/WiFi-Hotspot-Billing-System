/**
 * components/common/LoadingSpinner.jsx
 */
export default function LoadingSpinner({ fullPage = false, text = "Loading…" }) {
  const inner = (
    <div className="text-center">
      <div className={`wb-spinner ${fullPage ? "wb-spinner-lg" : ""} mx-auto mb-2`} />
      {text && <p className="text-muted small mb-0">{text}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div
        className="d-flex align-items-center justify-content-center"
        style={{ minHeight: "60vh" }}
      >
        {inner}
      </div>
    );
  }
  return inner;
}