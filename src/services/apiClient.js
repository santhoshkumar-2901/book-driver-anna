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

    if (!res.ok) {
      // Check if this is a proxy failure (e.g. Vite proxy ECONNREFUSED 127.0.0.1:5000 or gateway 502/503/504)
      const isProxyOrGatewayError = 
        (res.status === 502 || res.status === 503 || res.status === 504) ||
        (res.status === 500 && (!data.error || rawText.includes('ECONNREFUSED') || rawText.includes('proxy error')));

      if (isProxyOrGatewayError) {
        console.warn(`[API CLIENT] Backend server offline or proxy failed (HTTP ${res.status}). Falling back to local offline mode.`);
        const networkErr = new Error('Backend server is offline. Please start the backend service on port 5000.');
        networkErr.code = 'NETWORK_ERROR';
        networkErr.status = res.status;
        networkErr.data = data;
        throw networkErr;
      }

      const errorMsg = data.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      const err = new Error(errorMsg);
      err.code = data.error?.code || 'API_ERROR';
      err.status = res.status;
      err.data = data;
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
  register: (userData) => request('/auth/register', { method: 'POST', body: userData }),
  login: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
  driverLogin: (credentials) => request('/auth/driver-login', { method: 'POST', body: credentials }),
  adminLogin: (credentials) => request('/auth/admin-login', { method: 'POST', body: credentials }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getMe: () => request('/auth/me', { method: 'GET' }),

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

  // 5. Chatbot Endpoint
  sendChatMessage: (message, history = []) => 
    request('/chat', { method: 'POST', body: { message, history } })
};
