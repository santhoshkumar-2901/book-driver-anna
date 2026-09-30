import rateLimit from 'express-rate-limit';
import { RATE_LIMITS } from '../config/security.js';

/**
 * PRODUCTION RATE LIMITING ARCHITECTURAL NOTE (Phase 5B Review):
 *
 * 1. Current Mechanism:
 *    The limiters below use express-rate-limit with its default in-memory MemoryStore.
 *
 * 2. Multi-Instance / Serverless Limitation:
 *    In multi-container or serverless hosting environments (such as Vercel Lambdas),
 *    each instance maintains an isolated memory store. Rate limiting is enforced per-container,
 *    meaning traffic hitting multiple distinct instances does not share counter state.
 *
 * 3. Why No Ad-Hoc DB/Memory Hack Was Substituted:
 *    Writing rate-limit hits to TiDB/MySQL on every inbound request would degrade database
 *    connection pools, introduce write latency, and exacerbate denial-of-service vulnerability.
 *    No distributed cache (Redis / Upstash / Memcached) credentials currently exist in the environment.
 *
 * 4. Recommended Infrastructure Follow-up:
 *    When distributed rate limiting is provisioned, integrate `@upstash/ratelimit` or `rate-limit-redis`
 *    backed by Upstash Redis or Redis Cloud via dedicated environment variables (REDIS_URL / UPSTASH_REDIS_REST_TOKEN).
 *
 * 5. Test Mode:
 *    The skip condition is strictly restricted to automated tests (process.env.NODE_ENV === 'test')
 *    unless explicitly opt-in enabled with the 'x-test-rate-limit' header.
 */

export const authRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTH.windowMs,
  max: RATE_LIMITS.AUTH.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMITS.AUTH.message,
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']
});

export const bookingRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.BOOKINGS.windowMs,
  max: RATE_LIMITS.BOOKINGS.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMITS.BOOKINGS.message,
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']
});

export const generalRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.GENERAL.windowMs,
  max: RATE_LIMITS.GENERAL.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMITS.GENERAL.message,
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']
});

export const chatRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.CHAT?.windowMs || 5 * 60 * 1000,
  max: RATE_LIMITS.CHAT?.max || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMITS.CHAT?.message || { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Chat rate limit reached.' } },
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']
});

export const lookupRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.LOOKUP?.windowMs || 15 * 60 * 1000,
  max: RATE_LIMITS.LOOKUP?.max || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMITS.LOOKUP?.message || { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Lookup rate limit reached.' } },
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']
});

