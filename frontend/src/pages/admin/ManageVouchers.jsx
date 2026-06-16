import { useEffect, useRef, useState } from "react";
import { vouchersAPI, packagesAPI, getErrorMessage } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import ConfirmModal from "../../components/common/ConfirmModal";
import Pagination from "../../components/common/Pagination";
import { formatDate } from "../../utils/formatters";

const PAGE_SIZE = 15;

export default function ManageVouchers() {
  const [vouchers, setVouchers]   = useState([]);
  const [packages, setPackages]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [alert, setAlert]         = useState(null);
  const [deleting, setDeleting]   = useState(null);
  const [working, setWorking]     = useState(false);
  const [filter, setFilter]       = useState("all");
  const [page, setPage]           = useState(1);
  const [genForm, setGenForm]     = useState({ package_id: "", quantity: 10, expires_at: "" });
  const [generating, setGenerating] = useState(false);
  const modalRef = useRef(null);
  const [showGen, setShowGen]     = useState(false);

  const load = (f = "all") => {
    setLoading(true);
    const isUsed = f === "used" ? true : f === "unused" ? false : null;
    vouchersAPI.list(isUsed)
      .then((d) => setVouchers(Array.isArray(d) ? d : []))
      .catch(() => setAlert({ type: "danger", msg: "Failed to load vouchers." }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    packagesAPI.list().then((d) => setPackages(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (!modalRef.current) return;
    const M = window.bootstrap?.Modal;
    if (!M) return;
    const modal = M.getOrCreateInstance(modalRef.current);
    showGen ? modal.show() : modal.hide();
  }, [showGen]);

  const handleFilter = (f) => { setFilter(f); setPage(1); load(f); };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!genForm.package_id) { setAlert({ type: "danger", msg: "Select a package." }); return; }
    setGenerating(true);
    try {
      const result = await vouchersAPI.generate({ package_id: genForm.package_id, quantity: genForm.quantity, expires_at: genForm.expires_at || undefined });
      setAlert({ type: "success", msg: `${Array.isArray(result) ? result.length : genForm.quantity} vouchers generated.` });
      setShowGen(false);
      load(filter);
    } catch (ex) {
      setAlert({ type: "danger", msg: getErrorMessage(ex) });
    } finally { setGenerating(false); }
  };

  const handleDelete = async () => {
    setWorking(true);
    try {
      await vouchersAPI.delete(deleting.id);
      setAlert({ type: "success", msg: "Voucher deleted." });
      load(filter);
    } catch (ex) {
      setAlert({ type: "danger", msg: getErrorMessage(ex) });
    } finally { setWorking(false); setDeleting(null); }
  };

  const totalPages = Math.ceil(vouchers.length / PAGE_SIZE);
  const paginated  = vouchers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div><h3>Vouchers</h3><p className="text-muted mb-0">{vouchers.length} vouchers</p></div>
        <button className="btn btn-wb-primary" onClick={() => setShowGen(true)}>
          <i className="bi bi-plus-lg me-2" />Generate Vouchers
        </button>
      </div>

      <AlertMessage type={alert?.type} message={alert?.msg} onClose={() => setAlert(null)} />

      {/* Filter tabs */}
      <div className="d-flex gap-2 mb-4">
        {["all","unused","used"].map((f) => (
          <button key={f} className={`btn btn-sm ${filter === f ? "btn-wb-primary" : "btn-wb-outline"}`} onClick={() => handleFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="wb-card">
        {loading ? <LoadingSpinner /> : paginated.length === 0 ? (
          <div className="wb-empty py-4"><i className="bi bi-ticket-perforated" /><p>No vouchers found.</p></div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="wb-table">
                <thead>
                  <tr><th>Code</th><th>Package</th><th>Status</th><th>Used By</th><th>Expires</th><th>Created</th><th></th></tr>
                </thead>
                <tbody>
                  {paginated.map((v) => (
                    <tr key={v.id}>
                      <td><span className="wb-mono" style={{ fontSize: "0.9375rem", letterSpacing: "0.08em" }}>{v.code}</span></td>
                      <td>{v.package_name}</td>
                      <td>
                        {v.is_used
                          ? <span className="wb-badge wb-badge-muted">Used</span>
                          : v.is_expired
                          ? <span className="wb-badge wb-badge-red">Expired</span>
                          : <span className="wb-badge wb-badge-green">Valid</span>}
                      </td>
                      <td style={{ fontSize: "0.8125rem", color: "var(--wb-text-muted)" }}>{v.used_by || "—"}</td>
                      <td style={{ fontSize: "0.8125rem", color: "var(--wb-text-muted)" }}>{v.expires_at ? formatDate(v.expires_at) : "Never"}</td>
                      <td style={{ fontSize: "0.8125rem", color: "var(--wb-text-muted)" }}>{formatDate(v.created_at)}</td>
                      <td>
                        {!v.is_used && (
                          <button className="btn btn-sm btn-wb-danger" onClick={() => setDeleting(v)} title="Delete"><i className="bi bi-trash" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4"><Pagination page={page} totalPages={totalPages} onChange={setPage} /></div>
          </>
        )}
      </div>

      {/* Generate Modal */}
      <div className="modal fade" ref={modalRef} tabIndex="-1" data-bs-backdrop="static">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title"><i className="bi bi-ticket-perforated me-2" />Generate Vouchers</h5>
              <button type="button" className="btn-close" onClick={() => setShowGen(false)} />
            </div>
            <form onSubmit={handleGenerate}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Package *</label>
                  <select className="form-select" value={genForm.package_id} onChange={(e) => setGenForm((p) => ({ ...p, package_id: e.target.value }))}>
                    <option value="">Select a package…</option>
                    {packages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Quantity (max 200)</label>
                  <input type="number" className="form-control" min="1" max="200" value={genForm.quantity} onChange={(e) => setGenForm((p) => ({ ...p, quantity: e.target.value }))} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Expiry Date (optional)</label>
                  <input type="datetime-local" className="form-control" value={genForm.expires_at} onChange={(e) => setGenForm((p) => ({ ...p, expires_at: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-wb-outline" onClick={() => setShowGen(false)}>Cancel</button>
                <button type="submit" className="btn btn-wb-primary" disabled={generating}>
                  {generating ? <><span className="wb-spinner me-2" style={{ width: "1rem", height: "1rem" }} />Generating…</> : `Generate ${genForm.quantity} Vouchers`}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <ConfirmModal
        show={!!deleting}
        title="Delete Voucher"
        message={`Delete voucher ${deleting?.code}?`}
        confirmLabel="Delete"
        confirmVariant="btn-wb-danger"
        loading={working}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}