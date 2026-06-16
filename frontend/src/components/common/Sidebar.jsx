import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const customerLinks = [
  { to: "/dashboard", icon: "bi-speedometer2", label: "Dashboard" },
  { to: "/packages",  icon: "bi-wifi",         label: "Packages"  },
  { to: "/payments",  icon: "bi-receipt",       label: "Payments"  },
  { to: "/profile",   icon: "bi-person",        label: "Profile"   },
];

const adminLinks = [
  { to: "/admin",                   icon: "bi-speedometer2",    label: "Dashboard"   },
  { to: "/admin/users",             icon: "bi-people",          label: "Customers"   },
  { to: "/admin/packages",          icon: "bi-wifi",            label: "Packages"    },
  { to: "/admin/vouchers",          icon: "bi-ticket-perforated", label: "Vouchers"  },
  { to: "/admin/payments",          icon: "bi-credit-card",     label: "Payments"    },
  { to: "/admin/reports/revenue",   icon: "bi-bar-chart-line",  label: "Revenue"     },
  { to: "/admin/reports/bandwidth", icon: "bi-activity",        label: "Bandwidth"   },
  { to: "/admin/settings",          icon: "bi-gear",            label: "Settings"    },
];

export default function Sidebar({ open, onClose }) {
  const { isAdmin, logout } = useAuth();
  const links = isAdmin ? adminLinks : customerLinks;

  return (
    <>
      {/* Mobile overlay */}
      {open && <div className="d-lg-none position-fixed top-0 start-0 w-100 h-100" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1039 }} onClick={onClose} />}

      <div className={`wb-sidebar ${open ? "open" : ""}`}>
        {/* Logo */}
        <div className="wb-sidebar-logo">
          <span className="wb-logo-text">Wifi<span>Bill</span></span>
        </div>

        {/* Nav links */}
        <nav className="wb-sidebar-nav">
          <div className="wb-nav-section-label">{isAdmin ? "Admin" : "Menu"}</div>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/admin" || link.to === "/dashboard"}
              className={({ isActive }) => `wb-nav-link ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <i className={`bi ${link.icon}`} />
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="wb-sidebar-footer">
          <button className="wb-nav-link w-100 text-danger" onClick={logout}>
            <i className="bi bi-box-arrow-right" />
            Logout
          </button>
        </div>
      </div>
    </>
  );
}