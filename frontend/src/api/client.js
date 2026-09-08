import axios from "axios";

const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("smbc_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function clearAuthAndRedirect() {
  localStorage.removeItem("smbc_access_token");
  localStorage.removeItem("smbc_refresh_token");
  localStorage.removeItem("smbc_user");
  if (window.location.pathname !== "/login") {
    window.location.href = "/login?expired=true";
  }
}

// Shared across every concurrent 401 so a burst of simultaneous requests
// (e.g. a dashboard firing several queries at once) triggers exactly one
// POST /auth/refresh, not one per failed request — every caller awaits the
// same in-flight promise instead of racing separate refresh attempts.
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("smbc_refresh_token");
  if (!refreshToken) throw new Error("No refresh token stored");
  // Deliberately a bare axios call, not `api` — going through `api` would
  // re-enter this same response interceptor if the refresh call itself
  // ever 401s, which is exactly the loop this exists to avoid.
  const { data } = await axios.post("/api/auth/refresh", { refreshToken });
  localStorage.setItem("smbc_access_token", data.accessToken);
  return data.accessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    // Not a 401, or no request to retry against (network error, etc.) —
    // nothing this interceptor can do.
    if (response?.status !== 401 || !config) {
      return Promise.reject(error);
    }

    // The refresh call itself failed (bad/expired/revoked refresh token) —
    // nothing left to retry with. Full logout.
    if (config.url?.includes("/auth/refresh")) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    // A failed LOGIN attempt (wrong username/password) is a normal,
    // expected 401 the Login page's own form needs to catch and display —
    // never treat it as "session expired" or try to refresh against it.
    if (config.url?.includes("/auth/login")) {
      return Promise.reject(error);
    }

    // Already retried this exact request once after a refresh and it STILL
    // 401'd — the fresh token is being rejected too, so stop here instead
    // of looping. Full logout.
    if (config._retriedAfterRefresh) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    try {
      refreshPromise = refreshPromise || refreshAccessToken();
      const newAccessToken = await refreshPromise;
      refreshPromise = null;

      config._retriedAfterRefresh = true;
      config.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(config); // retry the original request, once, with the fresh token
    } catch (refreshError) {
      refreshPromise = null;
      clearAuthAndRedirect();
      return Promise.reject(refreshError);
    }
  }
);

export default api;