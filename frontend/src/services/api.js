/**
 * services/api.js
 *
 * WifiBill — Axios instance + all API calls.
 *
 * All functions return the `data` payload from the standard response shape:
 *   { success, message, data, errors }
 *
 * JWT tokens are read from localStorage and automatically attached.
 * On 401 the interceptor refreshes the access token once, then logs out.
 */

import axios from "axios";

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

const TOKEN_KEY   = "wb_access";
const REFRESH_KEY = "wb_refresh";

export const tokenStore = {
  getAccess:      ()        => localStorage.getItem(TOKEN_KEY),
  getRefresh:     ()        => localStorage.getItem(REFRESH_KEY),
  setTokens:      (a, r)    => { localStorage.setItem(TOKEN_KEY, a); localStorage.setItem(REFRESH_KEY, r); },
  clearTokens:    ()        => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY); },
};

// ---------------------------------------------------------------------------
// Request interceptor — attach Authorization header
// ---------------------------------------------------------------------------

api.interceptors.request.use(
  (config) => {
    const token = tokenStore.getAccess();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Response interceptor — handle 401, refresh token once
// ---------------------------------------------------------------------------

let _isRefreshing = false;
let _refreshQueue = [];   // callbacks waiting for the new token

const processQueue = (error, token = null) => {
  _refreshQueue.forEach((cb) => (error ? cb.reject(error) : cb.resolve(token)));
  _refreshQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (_isRefreshing) {
        // Queue the request until the token refresh completes
        return new Promise((resolve, reject) => {
          _refreshQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      _isRefreshing = true;

      try {
        const refreshToken = tokenStore.getRefresh();
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post(`${BASE_URL}/auth/refresh/`, {
          refresh: refreshToken,
        });

        const newAccess = data.access;
        tokenStore.setTokens(newAccess, refreshToken);
        api.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
        processQueue(null, newAccess);

        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        tokenStore.clearTokens();
        // Redirect to login — handled by React Router in AuthContext
        window.dispatchEvent(new Event("wb:session-expired"));
        return Promise.reject(refreshError);
      } finally {
        _isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// Helper — unwrap standard response
// ---------------------------------------------------------------------------

/**
 * Extract `.data.data` from successful responses.
 * Throws an error with the server's message on failure.
 */
const unwrap = (response) => response.data.data;

/**
 * Extract a readable error message from an Axios error.
 */
export const getErrorMessage = (error) => {
  if (error.response?.data) {
    const body = error.response.data;
    if (body.message) return body.message;
    if (body.errors) {
      // Flatten DRF field errors into a single string
      const msgs = Object.values(body.errors).flat();
      return msgs[0] || "An error occurred.";
    }
    if (body.detail) return body.detail;
  }
  return error.message || "Network error. Please try again.";
};

// ---------------------------------------------------------------------------
// ── AUTH ────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

export const authAPI = {
  /**
   * Register a new customer.
   * @param {{ phone_number, password, password_confirm, first_name?, last_name?, email? }} data
   */
  register: (data) =>
    api.post("/auth/register/", data).then(unwrap),

  /**
   * Login with phone number or email.
   * @param {{ identifier, password }} data
   * @returns {{ user, tokens: { access, refresh } }}
   */
  login: async (data) => {
    const result = await api.post("/auth/login/", data).then(unwrap);
    tokenStore.setTokens(result.tokens.access, result.tokens.refresh);
    return result;
  },

  /** Logout and blacklist the refresh token. */
  logout: async () => {
    const refresh = tokenStore.getRefresh();
    try {
      if (refresh) await api.post("/auth/logout/", { refresh });
    } finally {
      tokenStore.clearTokens();
    }
  },

  /** Get the authenticated user's profile. */
  getProfile: () =>
    api.get("/auth/profile/").then(unwrap),

  /**
   * Update the authenticated user's profile.
   * @param {object} data  Partial user fields
   */
  updateProfile: (data) =>
    api.patch("/auth/profile/", data).then(unwrap),

  /**
   * Change password.
   * @param {{ old_password, new_password }} data
   */
  changePassword: (data) =>
    api.post("/auth/change-password/", data).then(unwrap),
};

// ---------------------------------------------------------------------------
// ── PACKAGES ────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

export const packagesAPI = {
  /** List all active packages (public). */
  list: () =>
    api.get("/packages/").then(unwrap),

  /** Get a single package by ID. */
  get: (id) =>
    api.get(`/packages/${id}/`).then(unwrap),

  /** Create a package (admin). */
  create: (data) =>
    api.post("/packages/", data).then(unwrap),

  /** Update a package (admin). */
  update: (id, data) =>
    api.patch(`/packages/${id}/`, data).then(unwrap),

  /** Delete a package (admin). */
  delete: (id) =>
    api.delete(`/packages/${id}/`).then(unwrap),
};

// ---------------------------------------------------------------------------
// ── PAYMENTS ────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

export const paymentsAPI = {
  /**
   * Initiate an M-Pesa STK Push payment.
   * @param {{ package_id, phone_number?, mac_address? }} data
   * @returns {{ payment_id, checkout_request_id, message }}
   */
  initiate: (data) =>
    api.post("/payments/initiate/", data).then(unwrap),

  /**
   * Poll the payment status by checkout request ID.
   * @param {string} checkoutRequestId
   * @returns {Payment & { hotspot?: HotspotUser }}
   */
  pollStatus: (checkoutRequestId) =>
    api.get(`/payments/status/${checkoutRequestId}/`).then(unwrap),

  /** Get the authenticated customer's payment history. */
  history: () =>
    api.get("/payments/history/").then(unwrap),

  /** Get a payment receipt by payment ID. */
  receipt: (id) =>
    api.get(`/payments/receipt/${id}/`).then(unwrap),

  /** Admin: list all payments with optional status filter. */
  listAll: (status = "") =>
    api.get("/payments/", { params: status ? { status } : {} }).then(unwrap),

  /**
   * Redeem a voucher code.
   * @param {{ code, mac_address? }} data
   * @returns {HotspotUser}
   */
  redeemVoucher: (data) =>
    api.post("/payments/voucher/redeem/", data).then(unwrap),
};

// ---------------------------------------------------------------------------
// ── HOTSPOT ─────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

export const hotspotAPI = {
  /** Get the current customer's active hotspot session. */
  mySession: () =>
    api.get("/hotspot/my-session/").then(unwrap),

  /** Admin: list currently online users (enriched with MikroTik data). */
  onlineUsers: () =>
    api.get("/hotspot/online-users/").then(unwrap),

  /** Admin: force-disconnect a hotspot user. */
  disconnect: (id) =>
    api.post(`/hotspot/disconnect/${id}/`).then(unwrap),

  /** Admin: suspend a customer account. */
  suspend: (id) =>
    api.post(`/hotspot/suspend/${id}/`).then(unwrap),

  /** Admin: lift a customer suspension. */
  activate: (id) =>
    api.post(`/hotspot/activate/${id}/`).then(unwrap),
};

// ---------------------------------------------------------------------------
// ── CUSTOMERS ────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

export const customersAPI = {
  /** Admin: list all customers with optional search query. */
  list: (search = "") =>
    api.get("/customers/", { params: search ? { search } : {} }).then(unwrap),

  /** Admin: get a single customer by ID. */
  get: (id) =>
    api.get(`/customers/${id}/`).then(unwrap),

  /** Admin: update a customer. */
  update: (id, data) =>
    api.patch(`/customers/${id}/`, data).then(unwrap),

  /** Admin: delete a customer. */
  delete: (id) =>
    api.delete(`/customers/${id}/`).then(unwrap),
};

// ---------------------------------------------------------------------------
// ── VOUCHERS ────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

export const vouchersAPI = {
  /** Admin: list all vouchers. Optionally filter by is_used. */
  list: (isUsed = null) =>
    api
      .get("/vouchers/", { params: isUsed !== null ? { is_used: isUsed } : {} })
      .then(unwrap),

  /**
   * Admin: generate bulk voucher codes.
   * @param {{ package_id, quantity, expires_at? }} data
   */
  generate: (data) =>
    api.post("/vouchers/generate/", data).then(unwrap),

  /** Admin: delete an unused voucher. */
  delete: (id) =>
    api.delete(`/vouchers/${id}/`).then(unwrap),
};

// ---------------------------------------------------------------------------
// ── REPORTS ─────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

export const reportsAPI = {
  /**
   * Admin: revenue report.
   * @param {{ start_date?, end_date? }} params  Format: YYYY-MM-DD
   */
  revenue: (params = {}) =>
    api.get("/reports/revenue/", { params }).then(unwrap),

  /** Admin: bandwidth usage snapshots. */
  bandwidth: () =>
    api.get("/reports/bandwidth/").then(unwrap),

  /** Admin: active user count. */
  activeUsers: () =>
    api.get("/reports/active-users/").then(unwrap),

  /** Admin: dashboard summary stats. */
  dashboardStats: () =>
    api.get("/reports/dashboard-stats/").then(unwrap),
};

// ---------------------------------------------------------------------------
// Default export — the raw Axios instance (for one-off requests)
// ---------------------------------------------------------------------------

export default api;