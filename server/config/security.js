import { ENV } from './env.js';

export const ALLOWED_ORIGINS = ENV.CORS_ORIGIN.split(',').map(o => o.trim());

export const AUTH_COOKIE_NAME = 'bda_auth_token';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: ENV.IS_PRODUCTION,
  sameSite: ENV.IS_PRODUCTION ? 'strict' : 'lax',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/'
};

export const RATE_LIMITS = {
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts
    message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many login or registration attempts. Please try again in 15 minutes.' } }
  },
  BOOKINGS: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 bookings per IP
    message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Booking creation rate limit reached. Please wait before creating more bookings.' } }
  },
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // 300 requests
    message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please slow down.' } }
  }
};
