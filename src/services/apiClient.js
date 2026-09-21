/**
 * Production-Grade API Client for Book Driver Anna
 * 
 * - Communicates with backend /api endpoints
 * - Handles HttpOnly credentials automatically (credentials: 'include')
 * - Normalizes responses and standard errors
 * - Graceful fallback handling
 */

const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api` 
  : '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // Attach role-scoped Bearer token to guarantee seamless multi-tab authentication
  if (!headers['Authorization']) {
    let tokenToUse = null;
    if (typeof localStorage !== 'undefined') {
      if (endpoint.startsWith('/admin')) {
        tokenToUse = localStorage.getItem('bda_admin_token') || localStorage.getItem('bda_jwt_token');
      } else if (endpoint.startsWith('/drivers')) {
        tokenToUse = localStorage.getItem('bda_driver_token') || localStorage.getItem('bda_jwt_token');
      } else {
        tokenToUse = localStorage.getItem('bda_client_token') || localStorage.getItem('bda_jwt_token');
      }
    }
    if (tokenToUse) {
      headers['Authorization'] = `Bearer ${tokenToUse}`;
    }
  }

  // Attach idempotency key if requested
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const config = {
    ...options,
    headers,
    credentials: 'include' // Sends & receives HttpOnly auth cookies
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, config);
    const contentType = res.headers.get('content-type') || '';
    
    let data = {};
    let rawText = '';
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => ({}));
    } else {
      rawText = await res.text().catch(() => '');
    }

    const isHtmlResponse = contentType.includes('text/html') || (typeof rawText === 'string' && (rawText.trim().startsWith('<!DOCTYPE') || rawText.trim().startsWith('<html')));

    // If an API request returns an HTML page with 200 OK (e.g. Vercel SPA rewrite to index.html), treat as unrouted/offline backend
    if (res.ok && isHtmlResponse) {
      console.warn(`[API CLIENT] API endpoint '${endpoint}' returned HTML (SPA rewrite). Backend server is offline or unrouted.`);
      const networkErr = new Error('Backend API service is not running or unrouted on this host. Operating in offline demo mode.');
      networkErr.code = 'NETWORK_ERROR';
      networkErr.status = 404;
      networkErr.data = {};
      throw networkErr;
    }

    if (!res.ok) {
      // Check if this is a static host 405/404, Vite proxy failure (ECONNREFUSED 500), or gateway 502/503/504
      const isProxyOrGatewayError = 
        (res.status === 404 || res.status === 405 || res.status === 502 || res.status === 503 || res.status === 504) ||
        isHtmlResponse ||
        (res.status === 500 && (!data.error || rawText.includes('ECONNREFUSED') || rawText.includes('proxy error') || rawText.includes('FUNCTION_INVOCATION') || rawText.includes('Fatal:')));

      if (isProxyOrGatewayError) {
        console.warn(`[API CLIENT] Backend server offline or proxy/route unavailable (HTTP ${res.status}). Falling back to local offline mode.`);
        const networkErr = new Error('Backend server is offline or unreachable on this host. Operating in offline demo mode.');
        networkErr.code = 'NETWORK_ERROR';
        networkErr.status = res.status;
        networkErr.data = data;
        networkErr.isServerError = true;
        throw networkErr;
      }

      const errorMsg = data.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      const err = new Error(errorMsg);
      err.code = data.error?.code || 'API_ERROR';
      err.status = res.status;
      err.data = data;
      err.isServerError = res.status >= 500;
      throw err;
    }

    return data;
  } catch (err) {
    // If server is unreachable (offline / static build without proxy), log and rethrow
    if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('NetworkError') || err.message.includes('Failed to fetch'))) {
      console.warn(`[API CLIENT] Backend server offline at ${url}. Falling back.`);
      const networkErr = new Error('Cannot connect to server. Please ensure the backend service is running on port 5000.');
      networkErr.code = 'NETWORK_ERROR';
      networkErr.status = 0;
      throw networkErr;
    }
    throw err;
  }
}

export const apiClient = {
  // 1. Auth Endpoints
  register: async (userData) => {
    const res = await request('/auth/register', { method: 'POST', body: userData });
    if (res?.data?.token) localStorage.setItem('bda_client_token', res.data.token);
    return res;
  },
  login: async (credentials) => {
    const res = await request('/auth/login', { method: 'POST', body: credentials });
    if (res?.data?.token) localStorage.setItem('bda_client_token', res.data.token);
    return res;
  },
  driverLogin: async (credentials) => {
    const res = await request('/auth/driver-login', { method: 'POST', body: credentials });
    if (res?.data?.token) localStorage.setItem('bda_driver_token', res.data.token);
    return res;
  },
  adminLogin: async (credentials) => {
    const res = await request('/auth/admin-login', { method: 'POST', body: credentials });
    if (res?.data?.token) localStorage.setItem('bda_admin_token', res.data.token);
    return res;
  },
  adminRegister: async (adminData) => {
    const res = await request('/auth/admin-register', { method: 'POST', body: adminData });
    if (res?.data?.token) localStorage.setItem('bda_admin_token', res.data.token);
    return res;
  },
  adminSession: async (payload = {}) => {
    const res = await request('/auth/admin-session', { method: 'POST', body: payload });
    if (res?.data?.token) localStorage.setItem('bda_admin_token', res.data.token);
    return res;
  },
  logout: () => {
    localStorage.removeItem('bda_client_token');
    localStorage.removeItem('bda_admin_token');
    localStorage.removeItem('bda_driver_token');
    return request('/auth/logout', { method: 'POST' });
  },
  getMe: () => request('/auth/me', { method: 'GET' }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  verifyResetToken: (token) => request(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`, { method: 'GET' }),
  resetPassword: ({ token, newPassword }) => request('/auth/reset-password', { method: 'POST', body: { token, newPassword } }),
  changePassword: ({ currentPassword, newPassword }) => request('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),

  // 2. Booking Endpoints
  createBooking: (bookingData, idempotencyKey = null) => 
    request('/bookings', { method: 'POST', body: bookingData, idempotencyKey }),
  getMyBookings: () => request('/bookings/my', { method: 'GET' }),
  lookupBooking: (bookingId, phone) => 
    request('/bookings/lookup', { method: 'POST', body: { bookingId, phone } }),
  cancelBooking: (bookingId, phone, reason) => 
    request(`/bookings/${bookingId}/cancel`, { method: 'POST', body: { phone, reason } }),
  getBookingById: (bookingId) => request(`/bookings/${bookingId}`, { method: 'GET' }),

  // 3. Driver Endpoints
  getDrivers: () => request('/drivers', { method: 'GET' }),
  getDriverDuties: () => request('/drivers/duties', { method: 'GET' }),
  updateDutyStatus: (bookingId, status) => 
    request(`/drivers/duties/${bookingId}/status`, { method: 'PATCH', body: { status } }),

  // 4. Admin Endpoints
  getAdminMetrics: () => request('/admin/metrics', { method: 'GET' }),
  getAdminBookings: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return request(`/admin/bookings${params ? `?${params}` : ''}`, { method: 'GET' });
  },
  updateAdminBooking: (bookingId, updates) => 
    request(`/admin/bookings/${bookingId}`, { method: 'PATCH', body: updates }),
  deleteAdminBooking: (bookingId) => 
    request(`/admin/bookings/${bookingId}`, { method: 'DELETE' }),
  getAdminUsers: () => request('/admin/users', { method: 'GET' }),
  createAdminUser: (userData) => request('/admin/users', { method: 'POST', body: userData }),
  deleteAdminUser: (userId) => request(`/admin/users/${userId}`, { method: 'DELETE' }),
  getAdminDrivers: () => request('/admin/drivers', { method: 'GET' }),
  createAdminDriver: (driverData) => request('/admin/drivers', { method: 'POST', body: driverData }),
  deleteAdminDriver: (driverId) => request(`/admin/drivers/${driverId}`, { method: 'DELETE' }),
  clearAllData: () => request('/admin/system/clear-data', { method: 'POST' }),

  // 5. Chatbot Endpoint
  sendChatMessage: (message, history = []) => 
    request('/chat', { method: 'POST', body: { message, history } })
};
