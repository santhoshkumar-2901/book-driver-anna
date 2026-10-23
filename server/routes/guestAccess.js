import { Router } from 'express';
import { lookupRateLimiter } from '../middleware/rateLimiter.js';
import { getSanitizedBookingSummary, validateGuestToken } from '../services/guestAccessService.js';
import { isDummyPaymentAllowed } from '../config/env.js';
import {
  createGuestPaymentOrder,
  simulateGuestPaymentOutcome,
  getGuestPaymentAttemptStatus
} from '../services/paymentService.js';

const router = Router();

// Apply lookup rate limiting to prevent token brute-forcing
router.use(lookupRateLimiter);

// Security headers middleware for all guest token endpoints
router.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  next();
});

/**
 * Strict fail-closed guard: permits dummy checkout simulation ONLY when
 * explicitly in development or test and IS_PRODUCTION is false.
 */
const requireDummyPaymentAllowed = (req, res, next) => {
  if (!isDummyPaymentAllowed()) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'TEST_MODE_DISABLED_IN_ENVIRONMENT',
        message: 'Payment simulation is strictly prohibited in this environment.'
      }
    });
  }
  next();
};

/**
 * POST /api/guest/booking-summary
 * Accepts rawToken in request body or X-Guest-Access-Token header.
 * Returns sanitized trip & payment summary.
 */
router.post('/booking-summary', async (req, res, next) => {
  try {
    const rawToken = req.body?.token || req.headers['x-guest-access-token'];

    if (!rawToken || typeof rawToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Access token is required in request body.'
        }
      });
    }

    const result = await getSanitizedBookingSummary(rawToken.trim());

    if (!result.success) {
      return res.status(result.status || 400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/guest/tokens/validate
 * Validates token format, status, revocation, and expiration without full summary payload.
 */
router.post('/tokens/validate', async (req, res, next) => {
  try {
    const rawToken = req.body?.token || req.headers['x-guest-access-token'];

    if (!rawToken || typeof rawToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Access token is required.'
        }
      });
    }

    const validation = await validateGuestToken(rawToken.trim());

    if (!validation.valid) {
      return res.status(validation.status || 400).json({
        success: false,
        error: {
          code: validation.code,
          message: validation.message
        }
      });
    }

    res.json({
      success: true,
      data: {
        valid: true,
        bookingId: validation.booking.b_id,
        bookingStatus: validation.booking.booking_status,
        paymentStatus: validation.booking.payment_status || 'UNPAID',
        expiresAt: validation.tokenRecord.expires_at
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/guest/payments/create-order
 * Creates a persistent test payment attempt with authoritative booking fare.
 */
router.post('/payments/create-order', requireDummyPaymentAllowed, async (req, res, next) => {
  try {
    const rawToken = req.body?.token || req.headers['x-guest-access-token'];
    const idempotencyKey = req.body?.idempotencyKey || req.headers['idempotency-key'] || null;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    if (!rawToken || typeof rawToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Access token is required.'
        }
      });
    }

    const orderData = await createGuestPaymentOrder({
      rawToken: rawToken.trim(),
      idempotencyKey,
      ipAddress
    });

    res.json({
      success: true,
      data: orderData
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/guest/payments/simulate-outcome
 * Simulates a test checkout outcome (success, failure, timeout, cancel) with single-settlement protection.
 */
router.post('/payments/simulate-outcome', requireDummyPaymentAllowed, async (req, res, next) => {
  try {
    const rawToken = req.body?.token || req.headers['x-guest-access-token'];
    const { attemptId, orderId, outcome, paymentMethod, failureReason } = req.body || {};
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    if (!rawToken || typeof rawToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Access token is required.'
        }
      });
    }

    const outcomeResult = await simulateGuestPaymentOutcome({
      rawToken: rawToken.trim(),
      attemptId,
      orderId,
      outcome,
      paymentMethod,
      failureReason,
      ipAddress
    });

    res.json({
      success: true,
      data: outcomeResult
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/guest/payments/status
 * Queries current sanitized status of a specific payment attempt.
 */
router.post('/payments/status', requireDummyPaymentAllowed, async (req, res, next) => {
  try {
    const rawToken = req.body?.token || req.headers['x-guest-access-token'];
    const attemptId = req.body?.attemptId;

    if (!rawToken || typeof rawToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Access token is required.'
        }
      });
    }

    const statusResult = await getGuestPaymentAttemptStatus({
      rawToken: rawToken.trim(),
      attemptId
    });

    res.json({
      success: true,
      data: statusResult
    });
  } catch (err) {
    next(err);
  }
});

export default router;
