import axios from "axios";

// ---------------------------------------------------------------------------
// Token + tenant storage helpers (localStorage-backed).
// ---------------------------------------------------------------------------
const ACCESS_KEY = "hh_access";
const REFRESH_KEY = "hh_refresh";
const TENANT_KEY = "hh_tenant";

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access, refresh) => {
    if (access) localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export const tenantStore = {
  get: () => localStorage.getItem(TENANT_KEY) || null,
  set: (slug) =>
    slug
      ? localStorage.setItem(TENANT_KEY, slug)
      : localStorage.removeItem(TENANT_KEY),
};

// ---------------------------------------------------------------------------
// Axios instance. Uses same-origin "/api" (Vite proxies it to Django in dev).
// ---------------------------------------------------------------------------
const api = axios.create({ baseURL: "/api" });

// Request interceptor: attach JWT and the active tenant slug header.
api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Per-request override wins; otherwise fall back to the stored tenant.
  const tenant = config.tenant ?? tenantStore.get();
  if (tenant) config.headers["X-Tenant-Slug"] = tenant;
  return config;
});

// Response interceptor: transparently refresh the access token on 401 once.
let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status === 401 && !original._retried && tokenStore.getRefresh()) {
      original._retried = true;
      try {
        // De-dupe concurrent refreshes into a single request.
        refreshing =
          refreshing ||
          axios
            .post("/api/auth/token/refresh/", {
              refresh: tokenStore.getRefresh(),
            })
            .finally(() => {
              refreshing = null;
            });
        const { data } = await refreshing;
        tokenStore.set(data.access, null);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch (e) {
        tokenStore.clear();
        // Bubble up so the AuthContext can redirect to login.
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
