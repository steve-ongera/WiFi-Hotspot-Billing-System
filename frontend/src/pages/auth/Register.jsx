import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { authAPI, getErrorMessage } from "../../services/api";
import AlertMessage from "../../components/common/AlertMessage";
import { validatePhone, validatePassword, validatePasswordConfirm } from "../../utils/validators";

export default function Register() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [form, setForm]     = useState({ first_name: "", last_name: "", phone_number: "", email: "", password: "", password_confirm: "" });
  const [errors, setErrors] = useState({});
  const [alert, setAlert]   = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (f) => (e) => { setForm((p) => ({ ...p, [f]: e.target.value })); setErrors((p) => ({ ...p, [f]: "" })); };

  const validate = () => {
    const e = {};
    const ph = validatePhone(form.phone_number); if (ph) e.phone_number = ph;
    const pw = validatePassword(form.password); if (pw) e.password = pw;
    const pc = validatePasswordConfirm(form.password, form.password_confirm); if (pc) e.password_confirm = pc;
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      await authAPI.register(form);
      // Auto-login
      await login(form.phone_number, form.password);
      navigate("/dashboard", { replace: true });
    } catch (ex) {
      setAlert({ type: "danger", msg: getErrorMessage(ex) });
    } finally {
      setLoading(false);
    }
  };

  const F = ({ label, field, type = "text", placeholder, autoComplete }) => (
    <div className="mb-3">
      <label className="form-label">{label}</label>
      <input
        type={type}
        className={`form-control ${errors[field] ? "is-invalid" : ""}`}
        placeholder={placeholder}
        value={form[field]}
        onChange={set(field)}
        autoComplete={autoComplete}
      />
      {errors[field] && <div className="invalid-feedback">{errors[field]}</div>}
    </div>
  );

  return (
    <div className="wb-auth-layout">
      <div className="wb-auth-card" style={{ maxWidth: 500 }}>
        <div className="text-center mb-4">
          <h2 className="wb-logo-text fs-1 mb-1">Wifi<span>Bill</span></h2>
          <p className="text-muted small">Create your account</p>
        </div>

        <AlertMessage type={alert?.type} message={alert?.msg} onClose={() => setAlert(null)} />

        <form onSubmit={handleSubmit} noValidate>
          <div className="row g-3 mb-0">
            <div className="col-6"><F label="First Name" field="first_name" placeholder="John" autoComplete="given-name" /></div>
            <div className="col-6"><F label="Last Name" field="last_name" placeholder="Doe" autoComplete="family-name" /></div>
          </div>
          <F label="Phone Number *" field="phone_number" type="tel" placeholder="07XX XXX XXX" autoComplete="tel" />
          <F label="Email (optional)" field="email" type="email" placeholder="john@example.com" autoComplete="email" />
          <F label="Password *" field="password" type="password" placeholder="Min 6 characters" autoComplete="new-password" />
          <F label="Confirm Password *" field="password_confirm" type="password" placeholder="Repeat password" autoComplete="new-password" />

          <button type="submit" className="btn btn-wb-primary w-100 py-2 mt-1" disabled={loading}>
            {loading
              ? <><span className="wb-spinner me-2" style={{ width: "1rem", height: "1rem" }} />Creating account…</>
              : <><i className="bi bi-person-plus me-2" />Create Account</>}
          </button>
        </form>

        <p className="text-center mt-4 mb-0" style={{ fontSize: "0.875rem", color: "var(--wb-text-muted)" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--wb-cyan)" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}