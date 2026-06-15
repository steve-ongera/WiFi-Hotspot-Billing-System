/**
 * App.jsx
 *
 * WifiBill — Root component.
 * Provides:
 *   - AuthContext  (JWT tokens, user, login/logout helpers)
 *   - React Router v6 route tree
 *   - Role-based protected routes (customer / admin)
 *   - Lazy-loaded page components
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { authAPI, tokenStore } from "./services/api";

// ---------------------------------------------------------------------------
// Auth Context
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};

function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);   // true while we verify token on mount

  // On mount — restore session if access token exists
  useEffect(() => {
    const token = tokenStore.getAccess();
    if (token) {
      authAPI
        .getProfile()
        .then(setUser)
        .catch(() => tokenStore.clearTokens())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Listen for token expiry events dispatched by the Axios interceptor
  useEffect(() => {
    const handler = () => { setUser(null); };
    window.addEventListener("wb:session-expired", handler);
    return () => window.removeEventListener("wb:session-expired", handler);
  }, []);

  const login = useCallback(async (identifier, password) => {
    const result = await authAPI.login({ identifier, password });
    setUser(result.user);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await authAPI.logout();
    setUser(null);
  }, []);

  const updateUser = useCallback((partial) => {
    setUser((prev) => ({ ...prev, ...partial }));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      isAdmin: user?.role === "admin" || user?.is_superuser,
      isCustomer: user?.role === "customer",
      login,
      logout,
      updateUser,
    }),
    [user, loading, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Route Guards
// ---------------------------------------------------------------------------

/** Redirect unauthenticated users to /login */
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!isAuthenticated)
    return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

/** Redirect non-admin users to customer dashboard */
function RequireAdmin({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

/** Redirect already-authenticated users away from auth pages */
function RedirectIfAuth({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (isAuthenticated)
    return <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />;
  return children;
}

// ---------------------------------------------------------------------------
// Lazy-loaded pages
// ---------------------------------------------------------------------------

// Auth
const Login    = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));

// Customer
const CustomerDashboard = lazy(() => import("./pages/customer/CustomerDashboard"));
const Packages          = lazy(() => import("./pages/customer/Packages"));
const PurchasePackage   = lazy(() => import("./pages/customer/PurchasePackage"));
const PaymentHistory    = lazy(() => import("./pages/customer/PaymentHistory"));
const Profile           = lazy(() => import("./pages/customer/Profile"));

// Admin
const AdminDashboard   = lazy(() => import("./pages/admin/AdminDashboard"));
const ManageUsers      = lazy(() => import("./pages/admin/ManageUsers"));
const ManagePackages   = lazy(() => import("./pages/admin/ManagePackages"));
const ManageVouchers   = lazy(() => import("./pages/admin/ManageVouchers"));
const AllPayments      = lazy(() => import("./pages/admin/AllPayments"));
const BandwidthReports = lazy(() => import("./pages/admin/BandwidthReports"));
const RevenueReports   = lazy(() => import("./pages/admin/RevenueReports"));
const Settings         = lazy(() => import("./pages/admin/Settings"));

// Layouts
const CustomerLayout = lazy(() => import("./layouts/CustomerLayout"));
const AdminLayout    = lazy(() => import("./layouts/AdminLayout"));

// ---------------------------------------------------------------------------
// Full-screen page loader
// ---------------------------------------------------------------------------

function PageLoader() {
  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{ minHeight: "100vh", background: "var(--wb-surface-1)" }}
    >
      <div className="text-center">
        <div className="wb-spinner wb-spinner-lg mx-auto mb-3" />
        <p className="text-muted small mb-0">Loading WifiBill…</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suspense fallback
// ---------------------------------------------------------------------------

function SuspenseFallback() {
  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{ minHeight: "60vh" }}
    >
      <div className="wb-spinner" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 404 Not Found
// ---------------------------------------------------------------------------

function NotFound() {
  const { isAdmin } = useAuth();
  return (
    <div className="wb-empty" style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <i className="bi bi-wifi-off" style={{ fontSize: "4rem", color: "var(--wb-text-muted)", marginBottom: "1rem" }} />
      <h2 className="font-display mb-2">404 — Page not found</h2>
      <p className="mb-4">The page you're looking for doesn't exist.</p>
      <a
        href={isAdmin ? "/admin" : "/dashboard"}
        className="btn btn-wb-primary btn-lg"
      >
        <i className="bi bi-house" />
        Go home
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root redirect
// ---------------------------------------------------------------------------

function RootRedirect() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<SuspenseFallback />}>
          <Routes>
            {/* Root */}
            <Route path="/" element={<RootRedirect />} />

            {/* ── Auth (unauthenticated only) ── */}
            <Route
              path="/login"
              element={
                <RedirectIfAuth>
                  <Login />
                </RedirectIfAuth>
              }
            />
            <Route
              path="/register"
              element={
                <RedirectIfAuth>
                  <Register />
                </RedirectIfAuth>
              }
            />

            {/* ── Customer routes ── */}
            <Route
              element={
                <RequireAuth>
                  <CustomerLayout />
                </RequireAuth>
              }
            >
              <Route path="/dashboard"         element={<CustomerDashboard />} />
              <Route path="/packages"          element={<Packages />} />
              <Route path="/packages/:id/buy"  element={<PurchasePackage />} />
              <Route path="/payments"          element={<PaymentHistory />} />
              <Route path="/profile"           element={<Profile />} />
            </Route>

            {/* ── Admin routes ── */}
            <Route
              element={
                <RequireAdmin>
                  <AdminLayout />
                </RequireAdmin>
              }
            >
              <Route path="/admin"                    element={<AdminDashboard />} />
              <Route path="/admin/users"              element={<ManageUsers />} />
              <Route path="/admin/packages"           element={<ManagePackages />} />
              <Route path="/admin/vouchers"           element={<ManageVouchers />} />
              <Route path="/admin/payments"           element={<AllPayments />} />
              <Route path="/admin/reports/bandwidth"  element={<BandwidthReports />} />
              <Route path="/admin/reports/revenue"    element={<RevenueReports />} />
              <Route path="/admin/settings"           element={<Settings />} />
            </Route>

            {/* ── 404 ── */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

// Re-export AuthContext for use in hooks
export { AuthContext };