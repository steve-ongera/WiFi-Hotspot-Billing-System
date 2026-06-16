import { useAuth } from "../../contexts/AuthContext";

export default function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();

  return (
    <div className="wb-topbar">
      <button className="btn btn-wb-ghost d-lg-none" onClick={onToggleSidebar}>
        <i className="bi bi-list fs-5" />
      </button>
      <span className="wb-topbar-title d-none d-lg-block">WifiBill</span>
      <div className="d-flex align-items-center gap-3">
        <span className="text-muted small">{user?.phone_number}</span>
        <div className="dropdown">
          <button className="btn btn-wb-ghost dropdown-toggle d-flex align-items-center gap-2" data-bs-toggle="dropdown">
            <i className="bi bi-person-circle fs-5" />
            <span className="d-none d-md-inline">{user?.first_name || "Account"}</span>
          </button>
          <ul className="dropdown-menu dropdown-menu-end">
            <li><a className="dropdown-item" href="/profile"><i className="bi bi-person me-2" />Profile</a></li>
            <li><hr className="dropdown-divider" /></li>
            <li><button className="dropdown-item text-danger" onClick={logout}><i className="bi bi-box-arrow-right me-2" />Logout</button></li>
          </ul>
        </div>
      </div>
    </div>
  );
}