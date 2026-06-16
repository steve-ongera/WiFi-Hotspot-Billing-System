/**
 * components/packages/PackageForm.jsx
 * Used by admin ManagePackages page for create/edit.
 */
import { useState, useEffect } from "react";
import AlertMessage from "../common/AlertMessage";
import { validateRequired, validatePositiveNumber } from "../../utils/validators";
import { packagesAPI } from "../../services/api";
import { getErrorMessage } from "../../services/api";

const EMPTY = {
  name: "", description: "", price: "", duration_value: "", duration_unit: "hours",
  device_limit: 1, speed_limit_up: 0, speed_limit_down: 0, data_limit_mb: "", is_active: true,
};

export default function PackageForm({ pkg = null, onSuccess, onCancel }) {
  const [form, setForm]     = useState(pkg ? { ...pkg, data_limit_mb: pkg.data_limit_mb || "" } : EMPTY);
  const [errors, setErrors] = useState({});
  const [alert, setAlert]   = useState(null);
  const [loading, setLoading] = useState(false);
  const isEdit = !!pkg;

  useEffect(() => { if (pkg) setForm({ ...pkg, data_limit_mb: pkg.data_limit_mb || "" }); }, [pkg]);

  const set = (field) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [field]: val }));
    setErrors((p) => ({ ...p, [field]: "" }));
  };

  const validate = () => {
    const e = {};
    const r = validateRequired(form.name, "Name"); if (r) e.name = r;
    const p = validatePositiveNumber(form.price, "Price"); if (p) e.price = p;
    const d = validatePositiveNumber(form.duration_value, "Duration"); if (d) e.duration_value = d;
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const payload = { ...form, data_limit_mb: form.data_limit_mb || null };
      isEdit ? await packagesAPI.update(pkg.id, payload) : await packagesAPI.create(payload);
      onSuccess && onSuccess();
    } catch (err) {
      setAlert({ type: "danger", msg: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  const F = ({ label, field, type = "text", ...rest }) => (
    <div className="mb-3">
      <label className="form-label">{label}</label>
      <input
        type={type}
        className={`form-control ${errors[field] ? "is-invalid" : ""}`}
        value={form[field]}
        onChange={set(field)}
        {...rest}
      />
      {errors[field] && <div className="invalid-feedback">{errors[field]}</div>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      <AlertMessage type={alert?.type} message={alert?.msg} onClose={() => setAlert(null)} />
      <F label="Package Name *" field="name" placeholder="e.g. 1 Hour Hotspot" />
      <F label="Description" field="description" placeholder="Optional short description" />
      <div className="row g-3">
        <div className="col-6"><F label="Price (KES) *" field="price" type="number" min="0" step="0.01" /></div>
        <div className="col-3"><F label="Duration *" field="duration_value" type="number" min="1" /></div>
        <div className="col-3">
          <label className="form-label">Unit</label>
          <select className="form-select" value={form.duration_unit} onChange={set("duration_unit")}>
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-4">
          <label className="form-label">Max Devices</label>
          <input type="number" className="form-control" min="1" max="8" value={form.device_limit} onChange={set("device_limit")} />
        </div>
        <div className="col-4">
          <label className="form-label">Upload (Mbps)</label>
          <input type="number" className="form-control" min="0" value={form.speed_limit_up} onChange={set("speed_limit_up")} />
        </div>
        <div className="col-4">
          <label className="form-label">Download (Mbps)</label>
          <input type="number" className="form-control" min="0" value={form.speed_limit_down} onChange={set("speed_limit_down")} />
        </div>
      </div>
      <div className="mb-3 mt-3">
        <label className="form-label">Data Cap (MB) — blank = unlimited</label>
        <input type="number" className="form-control" min="0" value={form.data_limit_mb} onChange={set("data_limit_mb")} placeholder="Leave blank for unlimited" />
      </div>
      <div className="form-check mb-3">
        <input className="form-check-input" type="checkbox" id="is_active" checked={form.is_active} onChange={set("is_active")} />
        <label className="form-check-label text-secondary-wb" htmlFor="is_active">Active (visible to customers)</label>
      </div>
      <div className="d-flex gap-2 justify-content-end">
        <button type="button" className="btn btn-wb-outline" onClick={onCancel} disabled={loading}>Cancel</button>
        <button type="submit" className="btn btn-wb-primary" disabled={loading}>
          {loading ? <><span className="wb-spinner me-2" style={{ width: "1rem", height: "1rem" }} />Saving…</> : isEdit ? "Save Changes" : "Create Package"}
        </button>
      </div>
    </form>
  );
}