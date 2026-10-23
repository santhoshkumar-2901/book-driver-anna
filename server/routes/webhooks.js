import { Router } from 'express';
import { isRazorpayPaymentAllowed } from '../config/env.js';
import { processRazorpayWebhook } from '../services/paymentService.js';

const router = Router();

// Strict fail-closed guard: reject all webhook processing if gateway is disabled
const requireRazorpayEnabled = (req, res, next) => {
  if (!isRazorpayPaymentAllowed()) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'GATEWAY_DISABLED',
        message: 'Razorpay webhook processing is currently disabled.'
      }
    });
  }
  next();
};

/**
 * POST /api/payments/razorpay/webhook
 * Receives authentic Razorpay event notifications.
 * Validates HMAC-SHA256 signature against req.rawBody and processes idempotently.
 */
router.post(['/', '/webhook'], requireRazorpayEnabled, async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const eventIdHeader = req.headers['x-razorpay-event-id'];
    const rawBody = req.rawBody;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    if (!signature || !rawBody) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_WEBHOOK_REQUEST',
          message: 'Missing webhook signature or raw payload.'
        }
      });
    }

    const result = await processRazorpayWebhook({
      rawBody,
      signature,
      eventIdHeader,
      eventPayload: req.body,
      ipAddress
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    if (err.code === 'INVALID_WEBHOOK_SIGNATURE' || err.code === 'INVALID_EVENT_ID') {
      return res.status(400).json({
        success: false,
        error: {
          code: err.code,
          message: err.message
        }
      });
    }

    // For retryable internal failures (e.g., transient DB failure), return 500 so provider retries
    next(err);
  }
});

export default router;
