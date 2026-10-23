import { Router } from 'express';
import { lookupRateLimiter } from '../middleware/rateLimiter.js';
import { getSanitizedBookingSummary, validateGuestToken } from '../services/guestAccessService.js';

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

export default router;
