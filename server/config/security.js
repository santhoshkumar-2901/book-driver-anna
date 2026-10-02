import { ENV } from './env.js';

export const ALLOWED_ORIGINS = Array.from(new Set([
  ...ENV.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean),
  ENV.FRONTEND_ORIGIN,
  ENV.APP_URL
].filter(Boolean)));

export const AUTH_COOKIE_NAME = 'bda_auth_token';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: ENV.IS_PRODUCTION,
  sameSite: ENV.IS_PRODUCTION ? 'strict' : 'lax',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/'
};

export const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: ENV.IS_PRODUCTION,
  sameSite: ENV.IS_PRODUCTION ? 'strict' : 'lax',
  path: '/'
};

export const RATE_LIMITS = {
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: ENV.IS_PRODUCTION ? 60 : 300, // 60 in production, 300 in development
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
  },
  CHAT: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // 20 chat messages per 5 minutes
    message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Chat rate limit reached. Please wait a few minutes before sending more messages.' } }
  },
  LOOKUP: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 lookups per 15 minutes
    message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many booking lookup attempts. Please try again later.' } }
  },
  LOCATION: {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute per IP
    message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Location search rate limit reached. Please wait a moment.' } }
  },
  LOCATION_ROUTE: {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute per IP
    message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Routing rate limit reached. Please wait a moment.' } }
  },
  DRIVER_LOCATION: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute per IP (1/sec max)
    message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Driver location update rate limit reached. Please slow down.' } }
  }
};
