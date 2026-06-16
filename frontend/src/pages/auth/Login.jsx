import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getErrorMessage } from "../../services/api";
import AlertMessage from "../../components/common/AlertMessage";

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || null;

  const [form, setForm]     = useState({ identifier: "", password: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const set = (f) => (e) => { setForm((p) => ({ ...p, [f]: e.target.value })); setError(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.identifier || !form.password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    try {
      const result = await login(form.identifier, form.password);
      const dest = from || (result.user.role === "admin" ? "/admin" : "/dashboard");
      navigate(dest, { replace: true });
    } catch (ex) {
      setError(getErrorMessage(ex));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wb-auth-layout">
      <div className="wb-auth-card">
        <div className="text-center mb-4">
          <h2 className="wb-logo-text fs-1 mb-1">Wifi<span>Bill</span></h2>
          <p className="text-muted small">Sign in to your account</p>
        </div>

        <AlertMessage type="danger" message={error} onClose={() => setError("")} />

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label className="form-label">Phone number or Email</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-person" /></span>
              <input
                type="text"
                className="form-control"
                placeholder="07XX XXX XXX or email@example.com"
                value={form.identifier}
                onChange={set("identifier")}
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label">Password</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-lock" /></span>
              <input
                type={showPw ? "text" : "password"}
                className="form-control"
                placeholder="Your password"
                value={form.password}
                onChange={set("password")}
                autoComplete="current-password"
              />
              <button type="button" className="input-group-text" style={{ cursor: "pointer" }} onClick={() => setShowPw((p) => !p)}>
                <i className={`bi ${showPw ? "bi-eye-slash" : "bi-eye"}`} />
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-wb-primary w-100 py-2" disabled={loading}>
            {loading
              ? <><span className="wb-spinner me-2" style={{ width: "1rem", height: "1rem" }} />Signing in…</>
              : <><i className="bi bi-box-arrow-in-right me-2" />Sign In</>}
          </button>
        </form>

        <p className="text-center mt-4 mb-0" style={{ fontSize: "0.875rem", color: "var(--wb-text-muted)" }}>
          Don't have an account?{" "}
          <Link to="/register" style={{ color: "var(--wb-cyan)" }}>Create one</Link>
        </p>
      </div>
    </div>
  );
}