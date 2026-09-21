import rateLimit from 'express-rate-limit';
import { RATE_LIMITS } from '../config/security.js';

export const authRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTH.windowMs,
  max: RATE_LIMITS.AUTH.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMITS.AUTH.message
});

export const forgotPasswordRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.FORGOT_PASSWORD.windowMs,
  max: RATE_LIMITS.FORGOT_PASSWORD.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMITS.FORGOT_PASSWORD.message
});

export const resetPasswordRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.RESET_PASSWORD.windowMs,
  max: RATE_LIMITS.RESET_PASSWORD.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMITS.RESET_PASSWORD.message
});

export const bookingRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.BOOKINGS.windowMs,
  max: RATE_LIMITS.BOOKINGS.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMITS.BOOKINGS.message
});

export const generalRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.GENERAL.windowMs,
  max: RATE_LIMITS.GENERAL.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMITS.GENERAL.message
});
