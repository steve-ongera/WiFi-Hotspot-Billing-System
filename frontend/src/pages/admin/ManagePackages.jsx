import { useEffect, useRef, useState } from "react";
import { packagesAPI, getErrorMessage } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import ConfirmModal from "../../components/common/ConfirmModal";
import PackageForm from "../../components/packages/PackageForm";
import { formatKES, formatDurationLabel, formatRateLimit } from "../../utils/formatters";

export default function ManagePackages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [alert, setAlert]       = useState(null);
  const [editing, setEditing]   = useState(null);  // null=closed, false=new, obj=edit
  const [deleting, setDeleting] = useState(null);
  const [working, setWorking]   = useState(false);
  const modalRef = useRef(null);

  const load = () => {
    setLoading(true);
    packagesAPI.list()
      .then((d) => setPackages(Array.isArray(d) ? d : []))
      .catch(() => setAlert({ type: "danger", msg: "Failed to load packages." }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Bootstrap modal show/hide
  useEffect(() => {
    if (!modalRef.current) return;
    const M = window.bootstrap?.Modal;
    if (!M) return;
    const modal = M.getOrCreateInstance(modalRef.current);
    editing !== null ? modal.show() : modal.hide();
  }, [editing]);

  const handleDelete = async () => {
    setWorking(true);
    try {
      await packagesAPI.delete(deleting.id);
      setAlert({ type: "success", msg: "Package deleted." });
      load();
    } catch (ex) {
      setAlert({ type: "danger", msg: getErrorMessage(ex) });
    } finally { setWorking(false); setDeleting(null); }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div><h3>Packages</h3><p className="text-muted mb-0">Manage internet plans</p></div>
        <button className="btn btn-wb-primary" onClick={() => setEditing(false)}>
          <i className="bi bi-plus-lg me-2" />New Package
        </button>
      </div>

      <AlertMessage type={alert?.type} message={alert?.msg} onClose={() => setAlert(null)} />

      <div className="wb-card">
        {loading ? <LoadingSpinner /> : packages.length === 0 ? (
          <div className="wb-empty py-4"><i className="bi bi-wifi" /><p>No packages yet. Create one to get started.</p></div>
        ) : (
          <div className="table-responsive">
            <table className="wb-table">
              <thead>
                <tr><th>Name</th><th>Price</th><th>Duration</th><th>Devices</th><th>Speed</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id}>
                    <td>{pkg.name}</td>
                    <td><strong style={{ color: "var(--wb-cyan)" }}>{formatKES(pkg.price)}</strong></td>
                    <td>{formatDurationLabel(pkg.duration_value, pkg.duration_unit)}</td>
                    <td>
                      <span className={`wb-badge ${pkg.device_limit > 1 ? "wb-badge-cyan" : "wb-badge-blue"}`}>
                        <i className={`bi ${pkg.device_limit > 1 ? "bi-people" : "bi-person"}`} /> {pkg.device_limit}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.8125rem" }}>{formatRateLimit(pkg.mikrotik_rate_limit)}</td>
                    <td>
                      <span className={`wb-badge ${pkg.is_active ? "wb-badge-green" : "wb-badge-muted"}`}>
                        {pkg.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <button className="btn btn-sm btn-wb-outline" onClick={() => setEditing(pkg)} title="Edit"><i className="bi bi-pencil" /></button>
                        <button className="btn btn-sm btn-wb-danger" onClick={() => setDeleting(pkg)} title="Delete"><i className="bi bi-trash" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <div className="modal fade" ref={modalRef} tabIndex="-1" data-bs-backdrop="static">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{editing ? "Edit Package" : "New Package"}</h5>
              <button type="button" className="btn-close" onClick={() => setEditing(null)} />
            </div>
            <div className="modal-body">
              {editing !== null && (
                <PackageForm
                  pkg={editing || null}
                  onSuccess={() => { setEditing(null); load(); setAlert({ type: "success", msg: `Package ${editing ? "updated" : "created"}.` }); }}
                  onCancel={() => setEditing(null)}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        show={!!deleting}
        title="Delete Package"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="btn-wb-danger"
        loading={working}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}