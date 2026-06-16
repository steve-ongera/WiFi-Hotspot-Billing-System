import { useState } from "react";
import { authAPI, getErrorMessage } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import AlertMessage from "../../components/common/AlertMessage";
import { validatePassword, validatePasswordConfirm } from "../../utils/validators";

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile]   = useState({ first_name: user?.first_name || "", last_name: user?.last_name || "", email: user?.email || "" });
  const [pw, setPw]             = useState({ old_password: "", new_password: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState({});
  const [profileAlert, setProfileAlert] = useState(null);
  const [pwAlert, setPwAlert]   = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const setP  = (f) => (e) => setProfile((p) => ({ ...p, [f]: e.target.value }));
  const setPwF = (f) => (e) => { setPw((p) => ({ ...p, [f]: e.target.value })); setPwErrors((p) => ({ ...p, [f]: "" })); };

  const handleProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await authAPI.updateProfile(profile);
      updateUser(updated);
      setProfileAlert({ type: "success", msg: "Profile updated." });
    } catch (ex) {
      setProfileAlert({ type: "danger", msg: getErrorMessage(ex) });
    } finally { setSavingProfile(false); }
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!pw.old_password) errs.old_password = "Required.";
    const p1 = validatePassword(pw.new_password); if (p1) errs.new_password = p1;
    const p2 = validatePasswordConfirm(pw.new_password, pw.confirm); if (p2) errs.confirm = p2;
    if (Object.keys(errs).length) { setPwErrors(errs); return; }
    setSavingPw(true);
    try {
      await authAPI.changePassword({ old_password: pw.old_password, new_password: pw.new_password });
      setPwAlert({ type: "success", msg: "Password changed." });
      setPw({ old_password: "", new_password: "", confirm: "" });
    } catch (ex) {
      setPwAlert({ type: "danger", msg: getErrorMessage(ex) });
    } finally { setSavingPw(false); }
  };

  return (
    <div>
      <div className="mb-4"><h3>Settings</h3><p className="text-muted">Manage your admin account.</p></div>

      <div className="row g-4">
        {/* Admin profile */}
        <div className="col-lg-6">
          <div className="wb-card">
            <div className="wb-card-header"><span className="wb-card-title"><i className="bi bi-person-gear me-2" />Admin Profile</span></div>
            <AlertMessage type={profileAlert?.type} message={profileAlert?.msg} onClose={() => setProfileAlert(null)} />
            <form onSubmit={handleProfile}>
              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label">First Name</label>
                  <input className="form-control" value={profile.first_name} onChange={setP("first_name")} />
                </div>
                <div className="col-6">
                  <label className="form-label">Last Name</label>
                  <input className="form-control" value={profile.last_name} onChange={setP("last_name")} />
                </div>
              </div>
              <div className="mb-4 mt-3">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" value={profile.email} onChange={setP("email")} />
              </div>
              <div className="mb-3">
                <label className="form-label">Phone</label>
                <input className="form-control" value={user?.phone_number || ""} disabled />
                <div className="form-text" style={{ color: "var(--wb-text-muted)" }}>Phone cannot be changed here. Contact a superuser.</div>
              </div>
              <button type="submit" className="btn btn-wb-primary w-100" disabled={savingProfile}>
                {savingProfile ? <><span className="wb-spinner me-2" style={{ width: "1rem", height: "1rem" }} />Saving…</> : "Save Profile"}
              </button>
            </form>
          </div>
        </div>

        {/* Change password */}
        <div className="col-lg-6">
          <div className="wb-card">
            <div className="wb-card-header"><span className="wb-card-title"><i className="bi bi-shield-lock me-2" />Change Password</span></div>
            <AlertMessage type={pwAlert?.type} message={pwAlert?.msg} onClose={() => setPwAlert(null)} />
            <form onSubmit={handlePassword} noValidate>
              {[["old_password","Current Password","current-password"], ["new_password","New Password","new-password"], ["confirm","Confirm New Password","new-password"]].map(([field, label, ac]) => (
                <div className="mb-3" key={field}>
                  <label className="form-label">{label}</label>
                  <input type="password" className={`form-control ${pwErrors[field] ? "is-invalid" : ""}`} value={pw[field]} onChange={setPwF(field)} autoComplete={ac} />
                  {pwErrors[field] && <div className="invalid-feedback">{pwErrors[field]}</div>}
                </div>
              ))}
              <button type="submit" className="btn btn-wb-primary w-100 mt-1" disabled={savingPw}>
                {savingPw ? <><span className="wb-spinner me-2" style={{ width: "1rem", height: "1rem" }} />Updating…</> : "Update Password"}
              </button>
            </form>
          </div>

          {/* System info */}
          <div className="wb-card mt-4">
            <div className="wb-card-header"><span className="wb-card-title"><i className="bi bi-info-circle me-2" />System Info</span></div>
            <div className="d-flex flex-column gap-3">
              {[
                ["Role",        user?.role],
                ["Phone",       user?.phone_number],
                ["API Base URL", import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api"],
                ["App Version", "WifiBill v1.0"],
              ].map(([label, val]) => (
                <div key={label} className="d-flex justify-content-between align-items-center">
                  <span className="text-muted small">{label}</span>
                  <span className="wb-mono" style={{ fontSize: "0.8125rem" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}