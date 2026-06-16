import { useEffect, useState } from "react";
import { authAPI, getErrorMessage } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import AlertMessage from "../../components/common/AlertMessage";
import { validatePhone, validatePassword, validatePasswordConfirm } from "../../utils/validators";
import { formatDate } from "../../utils/formatters";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm]       = useState({ first_name: "", last_name: "", email: "", phone_number: "" });
  const [pwForm, setPwForm]   = useState({ old_password: "", new_password: "", confirm: "" });
  const [errors, setErrors]   = useState({});
  const [pwErrors, setPwErrors] = useState({});
  const [alert, setAlert]     = useState(null);
  const [pwAlert, setPwAlert] = useState(null);
  const [saving, setSaving]   = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (user) setForm({ first_name: user.first_name || "", last_name: user.last_name || "", email: user.email || "", phone_number: user.phone_number || "" });
  }, [user]);

  const set  = (f) => (e) => { setForm((p) => ({ ...p, [f]: e.target.value })); setErrors((p) => ({ ...p, [f]: "" })); };
  const setPw = (f) => (e) => { setPwForm((p) => ({ ...p, [f]: e.target.value })); setPwErrors((p) => ({ ...p, [f]: "" })); };

  const handleProfile = async (e) => {
    e.preventDefault();
    const errs = {};
    const ph = validatePhone(form.phone_number); if (ph) errs.phone_number = ph;
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const updated = await authAPI.updateProfile(form);
      updateUser(updated);
      setAlert({ type: "success", msg: "Profile updated successfully." });
    } catch (ex) {
      setAlert({ type: "danger", msg: getErrorMessage(ex) });
    } finally { setSaving(false); }
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!pwForm.old_password) errs.old_password = "Current password is required.";
    const pw = validatePassword(pwForm.new_password); if (pw) errs.new_password = pw;
    const pc = validatePasswordConfirm(pwForm.new_password, pwForm.confirm); if (pc) errs.confirm = pc;
    if (Object.keys(errs).length) { setPwErrors(errs); return; }
    setSavingPw(true);
    try {
      await authAPI.changePassword({ old_password: pwForm.old_password, new_password: pwForm.new_password });
      setPwAlert({ type: "success", msg: "Password changed successfully." });
      setPwForm({ old_password: "", new_password: "", confirm: "" });
    } catch (ex) {
      setPwAlert({ type: "danger", msg: getErrorMessage(ex) });
    } finally { setSavingPw(false); }
  };

  return (
    <div>
      <div className="mb-4">
        <h3>My Profile</h3>
        <p className="text-muted">Manage your account details.</p>
      </div>

      <div className="row g-4">
        {/* Profile info */}
        <div className="col-lg-6">
          <div className="wb-card">
            <div className="wb-card-header"><span className="wb-card-title"><i className="bi bi-person me-2" />Personal Info</span></div>
            <AlertMessage type={alert?.type} message={alert?.msg} onClose={() => setAlert(null)} />
            <form onSubmit={handleProfile} noValidate>
              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label">First Name</label>
                  <input className="form-control" value={form.first_name} onChange={set("first_name")} />
                </div>
                <div className="col-6">
                  <label className="form-label">Last Name</label>
                  <input className="form-control" value={form.last_name} onChange={set("last_name")} />
                </div>
              </div>
              <div className="mb-3 mt-3">
                <label className="form-label">Phone Number *</label>
                <input className={`form-control ${errors.phone_number ? "is-invalid" : ""}`} value={form.phone_number} onChange={set("phone_number")} />
                {errors.phone_number && <div className="invalid-feedback">{errors.phone_number}</div>}
              </div>
              <div className="mb-4">
                <label className="form-label">Email (optional)</label>
                <input type="email" className="form-control" value={form.email} onChange={set("email")} />
              </div>
              <button type="submit" className="btn btn-wb-primary w-100" disabled={saving}>
                {saving ? <><span className="wb-spinner me-2" style={{ width: "1rem", height: "1rem" }} />Saving…</> : "Save Changes"}
              </button>
            </form>
          </div>
        </div>

        {/* Change password */}
        <div className="col-lg-6">
          <div className="wb-card">
            <div className="wb-card-header"><span className="wb-card-title"><i className="bi bi-lock me-2" />Change Password</span></div>
            <AlertMessage type={pwAlert?.type} message={pwAlert?.msg} onClose={() => setPwAlert(null)} />
            <form onSubmit={handlePassword} noValidate>
              {[["old_password","Current Password","current-password"],["new_password","New Password","new-password"],["confirm","Confirm Password","new-password"]].map(([field, label, ac]) => (
                <div className="mb-3" key={field}>
                  <label className="form-label">{label}</label>
                  <input type="password" className={`form-control ${pwErrors[field] ? "is-invalid" : ""}`} value={pwForm[field]} onChange={setPw(field)} autoComplete={ac} />
                  {pwErrors[field] && <div className="invalid-feedback">{pwErrors[field]}</div>}
                </div>
              ))}
              <button type="submit" className="btn btn-wb-primary w-100 mt-1" disabled={savingPw}>
                {savingPw ? <><span className="wb-spinner me-2" style={{ width: "1rem", height: "1rem" }} />Updating…</> : "Update Password"}
              </button>
            </form>
          </div>

          {/* Account info */}
          <div className="wb-card mt-4">
            <div className="wb-card-header"><span className="wb-card-title"><i className="bi bi-info-circle me-2" />Account Info</span></div>
            <div className="d-flex flex-column gap-3">
              {[["Role", user?.role], ["Member since", formatDate(user?.created_at)], ["Account status", user?.is_suspended ? "Suspended" : "Active"]].map(([label, val]) => (
                <div key={label} className="d-flex justify-content-between align-items-center">
                  <span className="text-muted small">{label}</span>
                  <span style={{ color: "var(--wb-text-primary)", fontSize: "0.875rem" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}