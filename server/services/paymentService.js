import crypto from 'crypto';
import { queryOne, execute, withTransaction } from '../db/database.js';
import { validateGuestToken } from './guestAccessService.js';
import { logAuditEvent } from './auditService.js';
import { isRazorpayPaymentAllowed, getRazorpayCredentials } from '../config/env.js';

/**
 * Creates a persistent test payment attempt for a validated guest booking.
 * Authoritative fare is extracted directly from the database; any client-provided amount is rejected.
 */
export async function createGuestPaymentOrder({ rawToken, idempotencyKey = null, ipAddress = null }) {
  const validation = await validateGuestToken(rawToken);
  if (!validation.valid) {
    const err = new Error(validation.message);
    err.statusCode = validation.status;
    err.code = validation.code;
    throw err;
  }

  const booking = validation.booking;

  if (booking.booking_status === 'CANCELLED') {
    const err = new Error('Cannot initiate payment for a cancelled booking.');
    err.statusCode = 400;
    err.code = 'BOOKING_CANCELLED';
    throw err;
  }

  if (booking.payment_status === 'PAID') {
    const err = new Error('This booking has already been fully paid.');
    err.statusCode = 400;
    err.code = 'BOOKING_ALREADY_PAID';
    throw err;
  }

  const rawFare = Number(booking.calculated_fare);
  if (!Number.isFinite(rawFare) || rawFare <= 0) {
    const err = new Error('Booking has an invalid or non-payable fare amount.');
    err.statusCode = 400;
    err.code = 'INVALID_FARE';
    throw err;
  }

  const normalizedAmount = Number(rawFare.toFixed(2));
  const amountInPaise = Math.round(normalizedAmount * 100);

  // Handle Idempotency
  if (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim()) {
    const trimmedKey = idempotencyKey.trim();
    const existingAttempt = await queryOne(
      'SELECT * FROM payment_attempts WHERE idempotency_key = ? AND booking_id = ?',
      [trimmedKey, booking.b_id]
    );

    if (existingAttempt) {
      if (existingAttempt.status === 'SUCCEEDED') {
        return {
          attemptId: existingAttempt.id,
          orderId: existingAttempt.order_id,
          amount: Number(existingAttempt.amount),
          amountInPaise: Math.round(Number(existingAttempt.amount) * 100),
          currency: existingAttempt.currency,
          bookingId: booking.b_id,
          status: existingAttempt.status,
          isPaid: true,
          alreadySucceeded: true
        };
      }

      if (existingAttempt.status === 'CREATED' || existingAttempt.status === 'PROCESSING' || existingAttempt.status === 'PENDING') {
        return {
          attemptId: existingAttempt.id,
          orderId: existingAttempt.order_id,
          amount: Number(existingAttempt.amount),
          amountInPaise: Math.round(Number(existingAttempt.amount) * 100),
          currency: existingAttempt.currency,
          bookingId: booking.b_id,
          status: existingAttempt.status,
          isPaid: false
        };
      }

      // Terminal state reuse (FAILED or CANCELLED) with same idempotency key is rejected
      const err = new Error('This idempotency key was already used for a terminal attempt. Please use a fresh idempotency key to retry.');
      err.statusCode = 400;
      err.code = 'IDEMPOTENCY_KEY_REUSE_AFTER_TERMINAL';
      throw err;
    }
  }

  const attemptId = 'PAY-ATT-' + Date.now() + '-' + crypto.randomBytes(6).toString('hex').toUpperCase();
  const orderId = 'order_test_' + crypto.randomBytes(12).toString('hex');
  const effectiveIdempotencyKey = (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim())
    ? idempotencyKey.trim()
    : null;

  await execute(`
    INSERT INTO payment_attempts (
      id, booking_id, token_id, order_id, amount, currency, status,
      idempotency_key, gateway_provider, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'INR', 'CREATED', ?, 'DUMMY_RAZORPAY_TEST', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [
    attemptId,
    booking.b_id,
    validation.tokenRecord.id,
    orderId,
    normalizedAmount,
    effectiveIdempotencyKey
  ]);

  return {
    attemptId,
    orderId,
    amount: normalizedAmount,
    amountInPaise,
    currency: 'INR',
    bookingId: booking.b_id,
    serviceName: booking.service_name,
    status: 'CREATED',
    isPaid: false
  };
}

/**
 * Simulates an explicit test checkout outcome (success, failure, timeout, cancel)
 * within a strictly verified database transaction with single-settlement protection.
 */
export async function simulateGuestPaymentOutcome({
  rawToken,
  attemptId,
  orderId,
  outcome,
  paymentMethod = 'simulated_upi',
  failureReason = 'DECLINED',
  ipAddress = null
}) {
  const validation = await validateGuestToken(rawToken);
  if (!validation.valid) {
    const err = new Error(validation.message);
    err.statusCode = validation.status;
    err.code = validation.code;
    throw err;
  }

  if (!attemptId || typeof attemptId !== 'string') {
    const err = new Error('Attempt ID is required.');
    err.statusCode = 400;
    err.code = 'INVALID_INPUT';
    throw err;
  }

  if (!orderId || typeof orderId !== 'string') {
    const err = new Error('Order ID is required.');
    err.statusCode = 400;
    err.code = 'INVALID_INPUT';
    throw err;
  }

  const attempt = await queryOne('SELECT * FROM payment_attempts WHERE id = ?', [attemptId.trim()]);
  if (!attempt) {
    const err = new Error('Payment attempt not found.');
    err.statusCode = 404;
    err.code = 'ATTEMPT_NOT_FOUND';
    throw err;
  }

  if (attempt.booking_id !== validation.booking.b_id) {
    const err = new Error('This payment attempt does not belong to the authenticated booking.');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ATTEMPT_MISMATCH';
    throw err;
  }

  if (attempt.order_id !== orderId.trim()) {
    const err = new Error('Order ID mismatch for this payment attempt.');
    err.statusCode = 400;
    err.code = 'ORDER_ID_MISMATCH';
    throw err;
  }

  // Terminal state immutability: SUCCEEDED attempts permanently stay SUCCEEDED
  if (attempt.status === 'SUCCEEDED') {
    return {
      status: 'SUCCEEDED',
      isPaid: true,
      alreadySucceeded: true,
      paymentId: attempt.gateway_payment_id || 'pay_test_already_succeeded',
      bookingId: validation.booking.b_id,
      amount: Number(attempt.amount),
      currency: attempt.currency,
      paidAt: attempt.updated_at
    };
  }

  // Terminal state immutability: FAILED or CANCELLED attempts cannot be transitioned again
  if (attempt.status === 'FAILED') {
    const err = new Error('This payment attempt has already failed. Please initiate a new payment attempt.');
    err.statusCode = 400;
    err.code = 'ATTEMPT_ALREADY_FAILED';
    throw err;
  }

  if (attempt.status === 'CANCELLED') {
    const err = new Error('This payment attempt was cancelled. Please initiate a new payment attempt.');
    err.statusCode = 400;
    err.code = 'ATTEMPT_ALREADY_CANCELLED';
    throw err;
  }

  // Handle Non-Success Simulated Outcomes
  if (outcome === 'failure') {
    await execute(`
      UPDATE payment_attempts
      SET status = 'FAILED',
          error_code = ?,
          error_description = ?,
          payment_method = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status IN ('CREATED', 'PROCESSING', 'PENDING')
    `, [
      failureReason || 'DECLINED',
      'Simulated bank decline or transaction failure',
      paymentMethod || 'simulated_card',
      attemptId
    ]);

    return {
      status: 'FAILED',
      isPaid: false,
      attemptId,
      orderId,
      errorCode: failureReason || 'DECLINED',
      errorDescription: 'Simulated bank decline or transaction failure'
    };
  }

  if (outcome === 'cancel') {
    await execute(`
      UPDATE payment_attempts
      SET status = 'CANCELLED',
          error_code = 'CUSTOMER_CANCELLED',
          error_description = 'Customer cancelled simulated payment session',
          payment_method = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status IN ('CREATED', 'PROCESSING', 'PENDING')
    `, [
      paymentMethod || 'simulated_upi',
      attemptId
    ]);

    return {
      status: 'CANCELLED',
      isPaid: false,
      attemptId,
      orderId
    };
  }

  if (outcome === 'timeout' || outcome === 'pending') {
    await execute(`
      UPDATE payment_attempts
      SET status = 'PENDING',
          error_code = 'PAYMENT_PENDING_TIMEOUT',
          error_description = 'Payment pending simulated bank confirmation',
          payment_method = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status IN ('CREATED', 'PROCESSING')
    `, [
      paymentMethod || 'simulated_upi',
      attemptId
    ]);

    return {
      status: 'PENDING',
      isPaid: false,
      attemptId,
      orderId,
      message: 'Payment simulation is pending bank response.'
    };
  }

  // Handle Success Simulation within Transaction
  if (outcome === 'success') {
    return await withTransaction(async (tx) => {
      // 1. Lock and check current booking state
      const currentBooking = await tx.queryOne(
        'SELECT id, calculated_fare, payment_status, status FROM bookings WHERE id = ?',
        [attempt.booking_id]
      );

      if (!currentBooking) {
        const err = new Error('Booking not found during settlement.');
        err.statusCode = 404;
        err.code = 'BOOKING_NOT_FOUND';
        throw err;
      }

      if (currentBooking.status === 'CANCELLED') {
        const err = new Error('Cannot settle a cancelled booking.');
        err.statusCode = 400;
        err.code = 'BOOKING_CANCELLED';
        throw err;
      }

      // Check if booking was already settled by another concurrent attempt
      if (currentBooking.payment_status === 'PAID') {
        // Reconcile this competing attempt to CANCELLED without touching the settled booking
        await tx.execute(`
          UPDATE payment_attempts
          SET status = 'CANCELLED',
              error_code = 'BOOKING_ALREADY_PAID',
              error_description = 'Booking was already settled by another transaction',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status IN ('CREATED', 'PROCESSING', 'PENDING')
        `, [attemptId]);

        return {
          status: 'CANCELLED',
          isPaid: true,
          alreadySettled: true,
          code: 'BOOKING_ALREADY_PAID',
          message: 'This booking has already been settled by another transaction.'
        };
      }

      // 2. Atomic conditional update to mark booking as PAID
      const bookingUpdateRes = await tx.execute(`
        UPDATE bookings
        SET payment_status = 'PAID',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND payment_status != 'PAID'
      `, [attempt.booking_id]);

      // If another concurrent transaction settled it between SELECT and UPDATE:
      if (bookingUpdateRes.affectedRows !== 1) {
        await tx.execute(`
          UPDATE payment_attempts
          SET status = 'CANCELLED',
              error_code = 'CONCURRENT_SETTLEMENT_CONFLICT',
              error_description = 'Concurrent transaction settled this booking first',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status IN ('CREATED', 'PROCESSING', 'PENDING')
        `, [attemptId]);

        return {
          status: 'CANCELLED',
          isPaid: true,
          alreadySettled: true,
          code: 'BOOKING_ALREADY_PAID',
          message: 'Concurrent transaction settled this booking first.'
        };
      }

      // 3. Mark attempt as SUCCEEDED
      const simulatedPaymentId = 'pay_test_' + crypto.randomBytes(8).toString('hex');
      const attemptUpdateRes = await tx.execute(`
        UPDATE payment_attempts
        SET status = 'SUCCEEDED',
            gateway_payment_id = ?,
            payment_method = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status IN ('CREATED', 'PROCESSING', 'PENDING')
      `, [simulatedPaymentId, paymentMethod || 'simulated_upi', attemptId]);

      if (attemptUpdateRes.affectedRows !== 1) {
        throw new Error('Failed to update attempt to SUCCEEDED. Rolling back settlement transaction.');
      }

      // 4. Log audit event
      await logAuditEvent({
        userId: null,
        action: 'GUEST_TEST_PAYMENT_SUCCEEDED',
        resourceType: 'booking',
        resourceId: currentBooking.id,
        details: {
          attemptId,
          orderId,
          amount: currentBooking.calculated_fare,
          simulatedPaymentId,
          paymentMethod: paymentMethod || 'simulated_upi'
        },
        ipAddress
      });

      return {
        status: 'SUCCEEDED',
        isPaid: true,
        paymentId: simulatedPaymentId,
        bookingId: currentBooking.id,
        amount: Number(Number(currentBooking.calculated_fare).toFixed(2)),
        currency: 'INR',
        paidAt: new Date().toISOString()
      };
    });
  }

  const err = new Error(`Unsupported simulated outcome: '${outcome}'`);
  err.statusCode = 400;
  err.code = 'INVALID_OUTCOME';
  throw err;
}

/**
 * Retrieves sanitized status of a specific payment attempt for a validated guest booking.
 */
export async function getGuestPaymentAttemptStatus({ rawToken, attemptId }) {
  const validation = await validateGuestToken(rawToken);
  if (!validation.valid) {
    const err = new Error(validation.message);
    err.statusCode = validation.status;
    err.code = validation.code;
    throw err;
  }

  if (!attemptId || typeof attemptId !== 'string') {
    const err = new Error('Attempt ID is required.');
    err.statusCode = 400;
    err.code = 'INVALID_INPUT';
    throw err;
  }

  const attempt = await queryOne(
    'SELECT * FROM payment_attempts WHERE id = ? AND booking_id = ?',
    [attemptId.trim(), validation.booking.b_id]
  );

  if (!attempt) {
    const err = new Error('Payment attempt not found.');
    err.statusCode = 404;
    err.code = 'ATTEMPT_NOT_FOUND';
    throw err;
  }

  return {
    attemptId: attempt.id,
    orderId: attempt.order_id,
    status: attempt.status,
    amount: Number(attempt.amount),
    currency: attempt.currency,
    isPaid: attempt.status === 'SUCCEEDED',
    paymentId: attempt.gateway_payment_id || null,
    errorCode: attempt.error_code || null,
    errorDescription: attempt.error_description || null,
    updatedAt: attempt.updated_at
  };
}

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

/**
 * Outbound HTTP client for Razorpay REST APIs using native fetch with Basic Auth and timeouts.
 * Never logs credentials or full sensitive payloads.
 */
async function callRazorpayApi(endpointPath, options = {}) {
  const creds = getRazorpayCredentials();
  if (!creds.keyId || !creds.keySecret) {
    const err = new Error('Razorpay credentials not configured.');
    err.statusCode = 503;
    err.code = 'GATEWAY_NOT_CONFIGURED';
    throw err;
  }

  const authHeader = 'Basic ' + Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');
  const timeoutMs = options.timeoutMs || 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${RAZORPAY_API_BASE}${endpointPath.startsWith('/') ? endpointPath : '/' + endpointPath}`;
  const headers = {
    'Authorization': authHeader,
    'Accept': 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  };

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
      signal: controller.signal
    });

    const isJson = (response.headers.get('content-type') || '').includes('application/json');
    let responseData = null;
    if (isJson) {
      try {
        responseData = await response.json();
      } catch (_) {}
    }

    if (!response.ok) {
      const description = responseData?.error?.description || `Gateway returned HTTP status ${response.status}`;
      const code = responseData?.error?.code || 'GATEWAY_ERROR';
      const err = new Error(`Payment gateway error: ${description}`);
      err.statusCode = response.status >= 500 ? 502 : response.status;
      err.code = code;
      err.providerStatus = response.status;
      throw err;
    }

    return responseData;
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('Payment gateway request timed out.');
      timeoutErr.statusCode = 504;
      timeoutErr.code = 'GATEWAY_TIMEOUT';
      throw timeoutErr;
    }
    if (err.code && err.statusCode) {
      throw err;
    }
    const networkErr = new Error('Network error connecting to payment gateway.');
    networkErr.statusCode = 502;
    networkErr.code = 'GATEWAY_NETWORK_ERROR';
    throw networkErr;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Creates a real Razorpay payment order for an authenticated guest booking.
 * Authoritative fare is extracted directly from the database; client amounts are strictly validated or ignored.
 */
export async function createRazorpayGuestOrder({
  rawToken,
  idempotencyKey = null,
  clientAmount = null,
  ipAddress = null
}) {
  if (!isRazorpayPaymentAllowed()) {
    const creds = getRazorpayCredentials();
    const isConfigured = Boolean(creds.keyId && creds.keySecret);
    const err = new Error(
      isConfigured
        ? 'Razorpay payment gateway is currently disabled.'
        : 'Razorpay gateway configuration is incomplete.'
    );
    err.statusCode = isConfigured ? 403 : 503;
    err.code = isConfigured ? 'GATEWAY_DISABLED' : 'GATEWAY_NOT_CONFIGURED';
    throw err;
  }

  const validation = await validateGuestToken(rawToken);
  if (!validation.valid) {
    const err = new Error(validation.message);
    err.statusCode = validation.status;
    err.code = validation.code;
    throw err;
  }

  const booking = validation.booking;

  if (booking.booking_status === 'CANCELLED') {
    const err = new Error('Cannot initiate payment for a cancelled booking.');
    err.statusCode = 400;
    err.code = 'BOOKING_CANCELLED';
    throw err;
  }

  if (booking.payment_status === 'PAID') {
    const err = new Error('This booking has already been fully paid.');
    err.statusCode = 400;
    err.code = 'BOOKING_ALREADY_PAID';
    throw err;
  }

  const rawFare = Number(booking.calculated_fare);
  if (!Number.isFinite(rawFare) || rawFare <= 0) {
    const err = new Error('Booking has an invalid or non-payable fare amount.');
    err.statusCode = 400;
    err.code = 'INVALID_FARE';
    throw err;
  }

  const normalizedAmount = Number(rawFare.toFixed(2));
  const amountInPaise = Math.round(normalizedAmount * 100);

  // Client-supplied amount tampering detection
  if (clientAmount !== undefined && clientAmount !== null) {
    const parsedClient = Number(clientAmount);
    if (!Number.isFinite(parsedClient) || Math.abs(parsedClient - normalizedAmount) > 0.009) {
      const err = new Error('Client-supplied amount does not match authoritative booking fare.');
      err.statusCode = 400;
      err.code = 'AMOUNT_TAMPERING_DETECTED';
      throw err;
    }
  }

  const creds = getRazorpayCredentials();

  // Idempotency check
  const effectiveIdempotencyKey = (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim())
    ? idempotencyKey.trim()
    : null;

  if (effectiveIdempotencyKey) {
    const existingAttempt = await queryOne(
      'SELECT * FROM payment_attempts WHERE idempotency_key = ? AND booking_id = ?',
      [effectiveIdempotencyKey, booking.b_id]
    );

    if (existingAttempt) {
      if (existingAttempt.status === 'SUCCEEDED') {
        return {
          attemptId: existingAttempt.id,
          orderId: existingAttempt.order_id,
          amount: Number(existingAttempt.amount),
          amountInPaise: Math.round(Number(existingAttempt.amount) * 100),
          currency: existingAttempt.currency,
          bookingId: booking.b_id,
          keyId: creds.keyId,
          status: existingAttempt.status,
          isPaid: true,
          alreadySucceeded: true
        };
      }

      if (existingAttempt.status === 'CREATED' || existingAttempt.status === 'PROCESSING' || existingAttempt.status === 'PENDING') {
        return {
          attemptId: existingAttempt.id,
          orderId: existingAttempt.order_id,
          amount: Number(existingAttempt.amount),
          amountInPaise: Math.round(Number(existingAttempt.amount) * 100),
          currency: existingAttempt.currency,
          bookingId: booking.b_id,
          keyId: creds.keyId,
          status: existingAttempt.status,
          isPaid: false
        };
      }

      const err = new Error('This idempotency key was already used for a terminal attempt. Please use a fresh idempotency key to retry.');
      err.statusCode = 400;
      err.code = 'IDEMPOTENCY_KEY_REUSE_AFTER_TERMINAL';
      throw err;
    }
  }

  const attemptId = 'PAY-ATT-' + Date.now() + '-' + crypto.randomBytes(6).toString('hex').toUpperCase();

  // Call Razorpay API to create order
  const orderResult = await callRazorpayApi('/orders', {
    method: 'POST',
    body: {
      amount: amountInPaise,
      currency: 'INR',
      receipt: attemptId,
      notes: {
        bookingId: String(booking.b_id),
        attemptId
      }
    }
  });

  if (!orderResult || !orderResult.id) {
    const err = new Error('Invalid response from payment gateway during order creation.');
    err.statusCode = 502;
    err.code = 'INVALID_GATEWAY_RESPONSE';
    throw err;
  }

  const providerOrderId = orderResult.id;

  // Insert payment attempt record
  await execute(`
    INSERT INTO payment_attempts (
      id, booking_id, token_id, order_id, amount, currency, status,
      idempotency_key, gateway_provider, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'INR', 'CREATED', ?, 'RAZORPAY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [
    attemptId,
    booking.b_id,
    validation.tokenRecord.id,
    providerOrderId,
    normalizedAmount,
    effectiveIdempotencyKey
  ]);

  // Log audit event
  await logAuditEvent({
    userId: null,
    action: 'RAZORPAY_ORDER_CREATED',
    resourceType: 'payment_attempt',
    resourceId: attemptId,
    details: {
      bookingId: booking.b_id,
      orderId: providerOrderId,
      amount: normalizedAmount,
      currency: 'INR'
    },
    ipAddress
  });

  return {
    attemptId,
    orderId: providerOrderId,
    amount: normalizedAmount,
    amountInPaise,
    currency: 'INR',
    bookingId: booking.b_id,
    keyId: creds.keyId,
    status: 'CREATED',
    isPaid: false
  };
}

/**
 * Verifies Razorpay Checkout callback signature and authoritative payment status before settling.
 */
export async function verifyRazorpayGuestSignature({
  rawToken,
  attemptId,
  orderId,
  paymentId,
  signature,
  ipAddress = null
}) {
  if (!isRazorpayPaymentAllowed()) {
    const creds = getRazorpayCredentials();
    const isConfigured = Boolean(creds.keyId && creds.keySecret);
    const err = new Error(
      isConfigured
        ? 'Razorpay payment gateway is currently disabled.'
        : 'Razorpay gateway configuration is incomplete.'
    );
    err.statusCode = isConfigured ? 403 : 503;
    err.code = isConfigured ? 'GATEWAY_DISABLED' : 'GATEWAY_NOT_CONFIGURED';
    throw err;
  }

  const validation = await validateGuestToken(rawToken);
  if (!validation.valid) {
    const err = new Error(validation.message);
    err.statusCode = validation.status;
    err.code = validation.code;
    throw err;
  }

  if (!attemptId || typeof attemptId !== 'string' || !attemptId.trim()) {
    const err = new Error('Payment attempt ID is required.');
    err.statusCode = 400;
    err.code = 'INVALID_INPUT';
    throw err;
  }

  if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
    const err = new Error('Provider order ID is required.');
    err.statusCode = 400;
    err.code = 'INVALID_INPUT';
    throw err;
  }

  if (!paymentId || typeof paymentId !== 'string' || !paymentId.trim()) {
    const err = new Error('Provider payment ID is required.');
    err.statusCode = 400;
    err.code = 'INVALID_INPUT';
    throw err;
  }

  if (!signature || typeof signature !== 'string' || !signature.trim()) {
    const err = new Error('Payment signature is required.');
    err.statusCode = 400;
    err.code = 'INVALID_INPUT';
    throw err;
  }

  const trimmedAttemptId = attemptId.trim();
  const trimmedOrderId = orderId.trim();
  const trimmedPaymentId = paymentId.trim();
  const trimmedSignature = signature.trim();

  const attempt = await queryOne('SELECT * FROM payment_attempts WHERE id = ?', [trimmedAttemptId]);
  if (!attempt) {
    const err = new Error('Payment attempt not found.');
    err.statusCode = 404;
    err.code = 'ATTEMPT_NOT_FOUND';
    throw err;
  }

  if (attempt.booking_id !== validation.booking.b_id) {
    const err = new Error('This payment attempt does not belong to the authenticated booking.');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ATTEMPT_MISMATCH';
    throw err;
  }

  if (attempt.order_id !== trimmedOrderId) {
    const err = new Error('Order ID mismatch for this payment attempt.');
    err.statusCode = 400;
    err.code = 'ORDER_ID_MISMATCH';
    throw err;
  }

  if (attempt.status === 'SUCCEEDED') {
    return {
      status: 'SUCCEEDED',
      isPaid: true,
      alreadySucceeded: true,
      paymentId: attempt.gateway_payment_id || trimmedPaymentId,
      bookingId: validation.booking.b_id,
      amount: Number(attempt.amount),
      currency: attempt.currency,
      paidAt: attempt.updated_at
    };
  }

  if (attempt.status === 'FAILED') {
    const err = new Error('This payment attempt has already failed. Please initiate a new payment attempt.');
    err.statusCode = 400;
    err.code = 'ATTEMPT_ALREADY_FAILED';
    throw err;
  }

  if (attempt.status === 'CANCELLED') {
    const err = new Error('This payment attempt was cancelled. Please initiate a new payment attempt.');
    err.statusCode = 400;
    err.code = 'ATTEMPT_ALREADY_CANCELLED';
    throw err;
  }

  const creds = getRazorpayCredentials();

  // HMAC-SHA256 signature verification (order_id + '|' + razorpay_payment_id)
  const expectedPayload = `${trimmedOrderId}|${trimmedPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', creds.keySecret)
    .update(expectedPayload)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const actualBuf = Buffer.from(trimmedSignature, 'utf8');

  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    const err = new Error('Payment signature verification failed.');
    err.statusCode = 400;
    err.code = 'INVALID_SIGNATURE';
    throw err;
  }

  // Authoritative provider check: fetch payment details from Razorpay API
  const paymentDetails = await callRazorpayApi(`/payments/${encodeURIComponent(trimmedPaymentId)}`);

  if (!paymentDetails || typeof paymentDetails !== 'object') {
    const err = new Error('Unable to verify authoritative payment status with payment gateway.');
    err.statusCode = 502;
    err.code = 'GATEWAY_VERIFICATION_FAILED';
    throw err;
  }

  if (paymentDetails.order_id !== trimmedOrderId) {
    const err = new Error('Provider payment is not associated with expected order.');
    err.statusCode = 400;
    err.code = 'PROVIDER_ORDER_MISMATCH';
    throw err;
  }

  const expectedPaise = Math.round(Number(attempt.amount) * 100);
  if (paymentDetails.amount !== expectedPaise) {
    const err = new Error('Provider payment amount does not match expected booking fare.');
    err.statusCode = 400;
    err.code = 'PROVIDER_AMOUNT_MISMATCH';
    throw err;
  }

  if (paymentDetails.currency !== 'INR') {
    const err = new Error(`Provider payment currency '${paymentDetails.currency}' is not supported.`);
    err.statusCode = 400;
    err.code = 'PROVIDER_CURRENCY_MISMATCH';
    throw err;
  }

  if (paymentDetails.status !== 'captured') {
    const err = new Error(`Provider payment is not captured (current status: '${paymentDetails.status}').`);
    err.statusCode = 400;
    err.code = 'PAYMENT_NOT_CAPTURED';
    throw err;
  }

  // Safe single-settlement transaction
  return await withTransaction(async (tx) => {
    const currentBooking = await tx.queryOne(
      'SELECT id, calculated_fare, payment_status, status FROM bookings WHERE id = ?',
      [attempt.booking_id]
    );

    if (!currentBooking) {
      const err = new Error('Booking not found during settlement.');
      err.statusCode = 404;
      err.code = 'BOOKING_NOT_FOUND';
      throw err;
    }

    if (currentBooking.status === 'CANCELLED') {
      const err = new Error('Cannot settle a cancelled booking.');
      err.statusCode = 400;
      err.code = 'BOOKING_CANCELLED';
      throw err;
    }

    if (currentBooking.payment_status === 'PAID') {
      // Reconcile attempt to SUCCEEDED idempotently without duplicate settlement
      await tx.execute(`
        UPDATE payment_attempts
        SET status = 'SUCCEEDED',
            gateway_payment_id = COALESCE(gateway_payment_id, ?),
            payment_method = COALESCE(payment_method, ?),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status IN ('CREATED', 'PROCESSING', 'PENDING')
      `, [trimmedPaymentId, paymentDetails.method || 'razorpay', trimmedAttemptId]);

      return {
        status: 'SUCCEEDED',
        isPaid: true,
        alreadySettled: true,
        bookingId: currentBooking.id,
        paymentId: trimmedPaymentId
      };
    }

    // Atomic conditional update to mark booking as PAID
    const bookingUpdateRes = await tx.execute(`
      UPDATE bookings
      SET payment_status = 'PAID',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND payment_status != 'PAID'
    `, [attempt.booking_id]);

    if (bookingUpdateRes.affectedRows !== 1) {
      // Concurrent transaction settled it between SELECT and UPDATE
      await tx.execute(`
        UPDATE payment_attempts
        SET status = 'SUCCEEDED',
            gateway_payment_id = COALESCE(gateway_payment_id, ?),
            payment_method = COALESCE(payment_method, ?),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status IN ('CREATED', 'PROCESSING', 'PENDING')
      `, [trimmedPaymentId, paymentDetails.method || 'razorpay', trimmedAttemptId]);

      return {
        status: 'SUCCEEDED',
        isPaid: true,
        alreadySettled: true,
        bookingId: currentBooking.id,
        paymentId: trimmedPaymentId
      };
    }

    // Mark attempt SUCCEEDED
    await tx.execute(`
      UPDATE payment_attempts
      SET status = 'SUCCEEDED',
          gateway_payment_id = ?,
          payment_method = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status IN ('CREATED', 'PROCESSING', 'PENDING')
    `, [trimmedPaymentId, paymentDetails.method || 'razorpay', trimmedAttemptId]);

    // Audit log
    await logAuditEvent({
      userId: null,
      action: 'RAZORPAY_PAYMENT_SUCCEEDED',
      resourceType: 'booking',
      resourceId: currentBooking.id,
      details: {
        attemptId: trimmedAttemptId,
        orderId: trimmedOrderId,
        paymentId: trimmedPaymentId,
        amount: currentBooking.calculated_fare,
        paymentMethod: paymentDetails.method || 'razorpay'
      },
      ipAddress
    });

    return {
      status: 'SUCCEEDED',
      isPaid: true,
      paymentId: trimmedPaymentId,
      bookingId: currentBooking.id,
      amount: Number(Number(currentBooking.calculated_fare).toFixed(2)),
      currency: 'INR',
      paidAt: new Date().toISOString()
    };
  });
}

/**
 * Validates raw-body webhook HMAC-SHA256 signature against RAZORPAY_WEBHOOK_SECRET.
 * Uses constant-time buffer comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!rawBody || (!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string')) {
    return false;
  }
  if (!signature || typeof signature !== 'string' || !signature.trim()) {
    return false;
  }
  if (!secret || typeof secret !== 'string' || !secret.trim()) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret.trim())
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const actualBuf = Buffer.from(signature.trim(), 'utf8');

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Idempotently processes a verified Razorpay webhook event with atomic claiming,
 * crash recovery, and single-settlement transaction guarantees.
 */
export async function processRazorpayWebhook({
  rawBody,
  signature,
  eventIdHeader = null,
  eventPayload = null,
  ipAddress = null
}) {
  if (!isRazorpayPaymentAllowed()) {
    const err = new Error('Razorpay gateway is currently disabled.');
    err.statusCode = 403;
    err.code = 'GATEWAY_DISABLED';
    throw err;
  }

  const creds = getRazorpayCredentials();
  if (!creds.webhookSecret) {
    const err = new Error('Razorpay webhook secret is not configured.');
    err.statusCode = 503;
    err.code = 'WEBHOOK_SECRET_NOT_CONFIGURED';
    throw err;
  }

  const isValidSig = verifyWebhookSignature(rawBody, signature, creds.webhookSecret);
  if (!isValidSig) {
    const err = new Error('Invalid webhook signature.');
    err.statusCode = 400;
    err.code = 'INVALID_WEBHOOK_SIGNATURE';
    throw err;
  }

  let eventId = eventIdHeader ? String(eventIdHeader).trim() : null;
  if (!eventId && eventPayload) {
    eventId = eventPayload.event_id || eventPayload.id || null;
  }
  if (!eventId) {
    const hashInput = `${eventPayload?.event || 'unknown'}:${eventPayload?.payload?.payment?.entity?.id || ''}:${eventPayload?.created_at || ''}`;
    eventId = 'evt_' + crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 32);
  }

  if (!/^[a-zA-Z0-9_\-.:]{1,128}$/.test(eventId)) {
    const err = new Error('Invalid webhook event ID format.');
    err.statusCode = 400;
    err.code = 'INVALID_EVENT_ID';
    throw err;
  }

  const eventType = eventPayload?.event || 'unknown';
  const paymentEntity = eventPayload?.payload?.payment?.entity || null;
  const orderEntity = eventPayload?.payload?.order?.entity || null;
  const orderId = paymentEntity?.order_id || orderEntity?.id || null;
  const paymentId = paymentEntity?.id || null;

  // Insert initial webhook record (deduplication boundary)
  try {
    await execute(`
      INSERT INTO payment_webhook_events (
        id, event_type, order_id, payment_id, status, attempts, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'RECEIVED', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [eventId, eventType, orderId, paymentId]);
  } catch (insertErr) {
    // If duplicate primary key, row already exists. Continue to claim step below.
  }

  // Atomic conditional claim with 5-minute stale lease recovery and ownership fencing
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
  const claimToken = crypto.randomUUID();

  const claimRes = await execute(`
    UPDATE payment_webhook_events
    SET status = 'PROCESSING',
        claim_token = ?,
        attempts = attempts + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND (
        status = 'RECEIVED'
        OR status = 'FAILED'
        OR (status = 'PROCESSING' AND updated_at < ?)
      )
  `, [claimToken, eventId, staleThreshold]);

  if (claimRes.affectedRows !== 1) {
    // Event is already owned or reached terminal state
    const existing = await queryOne(
      'SELECT status, attempts, error_message FROM payment_webhook_events WHERE id = ?',
      [eventId]
    );

    if (existing?.status === 'PROCESSED') {
      return { status: 'PROCESSED', duplicate: true, eventId, message: 'Event already processed' };
    }
    if (existing?.status === 'IGNORED') {
      return { status: 'IGNORED', duplicate: true, eventId, message: 'Event previously ignored' };
    }
    if (existing?.status === 'PROCESSING') {
      return { status: 'PROCESSING', duplicate: true, eventId, message: 'Event currently being processed by another worker' };
    }

    return { status: existing?.status || 'UNKNOWN', duplicate: true, eventId };
  }

  // Worker owns the claim
  try {
    const recognizedEvents = ['payment.captured', 'order.paid', 'payment.failed'];
    if (!recognizedEvents.includes(eventType)) {
      await execute(`
        UPDATE payment_webhook_events
        SET status = 'IGNORED',
            error_message = ?,
            processed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'PROCESSING' AND claim_token = ?
      `, [`Unsupported event type: ${eventType}`, eventId, claimToken]);

      return { status: 'IGNORED', eventId, eventType, message: `Ignored unsupported event type '${eventType}'` };
    }

    if (eventType === 'payment.failed') {
      if (orderId || paymentId) {
        const attempt = await queryOne(
          'SELECT * FROM payment_attempts WHERE order_id = ? OR gateway_payment_id = ?',
          [orderId, paymentId]
        );

        if (attempt) {
          const booking = await queryOne('SELECT payment_status FROM bookings WHERE id = ?', [attempt.booking_id]);
          if (booking?.payment_status === 'PAID' || attempt.status === 'SUCCEEDED') {
            await execute(`
              UPDATE payment_webhook_events
              SET status = 'PROCESSED',
                  error_message = 'Ignored failure event for already paid booking',
                  processed_at = CURRENT_TIMESTAMP,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND status = 'PROCESSING' AND claim_token = ?
            `, [eventId, claimToken]);

            return { status: 'PROCESSED', eventId, note: 'Payment already succeeded, failure ignored' };
          }

          // Verify ownership before failing attempt
          const ownershipCheck = await queryOne(
            'SELECT claim_token, status FROM payment_webhook_events WHERE id = ?',
            [eventId]
          );
          if (!ownershipCheck || ownershipCheck.claim_token !== claimToken || ownershipCheck.status !== 'PROCESSING') {
            const leaseErr = new Error(`Webhook event lease expired or reclaimed by another worker (event: ${eventId})`);
            leaseErr.code = 'LEASE_LOST';
            throw leaseErr;
          }

          await execute(`
            UPDATE payment_attempts
            SET status = 'FAILED',
                error_code = ?,
                error_description = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status IN ('CREATED', 'PROCESSING', 'PENDING')
          `, [
            paymentEntity?.error_code || 'GATEWAY_PAYMENT_FAILED',
            paymentEntity?.error_description || 'Payment failed at gateway',
            attempt.id
          ]);
        }
      }

      await execute(`
        UPDATE payment_webhook_events
        SET status = 'PROCESSED',
            processed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'PROCESSING' AND claim_token = ?
      `, [eventId, claimToken]);

      return { status: 'PROCESSED', eventId, eventType };
    }

    // payment.captured or order.paid
    if (!paymentEntity) {
      throw new Error(`Webhook payload missing payment entity for ${eventType}`);
    }

    if (!orderId) {
      throw new Error(`Webhook payment entity missing order_id for ${eventType}`);
    }

    const attempt = await queryOne('SELECT * FROM payment_attempts WHERE order_id = ?', [orderId]);
    if (!attempt) {
      throw new Error(`No payment attempt found matching Razorpay order_id: ${orderId}`);
    }

    const amountInPaise = Math.round(Number(attempt.amount) * 100);
    if (paymentEntity.amount !== amountInPaise) {
      throw new Error(`Webhook payment amount ${paymentEntity.amount} does not match expected attempt amount ${amountInPaise}`);
    }

    if (paymentEntity.currency !== 'INR') {
      throw new Error(`Webhook currency ${paymentEntity.currency} is not INR`);
    }

    if (paymentEntity.status !== 'captured') {
      throw new Error(`Webhook payment status is '${paymentEntity.status}', expected 'captured'`);
    }

    // Single-settlement transaction with lease fencing check
    await withTransaction(async (tx) => {
      // Fencing check: verify worker still owns the claim within the transaction
      const eventCheck = await tx.queryOne(
        'SELECT claim_token, status FROM payment_webhook_events WHERE id = ?',
        [eventId]
      );
      if (!eventCheck || eventCheck.claim_token !== claimToken || eventCheck.status !== 'PROCESSING') {
        const leaseErr = new Error(`Webhook event lease expired or reclaimed by another worker (event: ${eventId})`);
        leaseErr.code = 'LEASE_LOST';
        throw leaseErr;
      }

      const currentBooking = await tx.queryOne(
        'SELECT id, calculated_fare, payment_status, status FROM bookings WHERE id = ?',
        [attempt.booking_id]
      );

      if (!currentBooking) {
        throw new Error(`Booking ${attempt.booking_id} not found during settlement.`);
      }

      if (currentBooking.status === 'CANCELLED') {
        throw new Error(`Booking ${attempt.booking_id} is cancelled.`);
      }

      if (currentBooking.payment_status === 'PAID') {
        // Reconcile attempt
        await tx.execute(`
          UPDATE payment_attempts
          SET status = 'SUCCEEDED',
              gateway_payment_id = COALESCE(gateway_payment_id, ?),
              payment_method = COALESCE(payment_method, ?),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status IN ('CREATED', 'PROCESSING', 'PENDING')
        `, [paymentEntity.id, paymentEntity.method || 'razorpay', attempt.id]);

        return;
      }

      const bookingUpdateRes = await tx.execute(`
        UPDATE bookings
        SET payment_status = 'PAID',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND payment_status != 'PAID'
      `, [attempt.booking_id]);

      if (bookingUpdateRes.affectedRows !== 1) {
        // Concurrent settlement
        await tx.execute(`
          UPDATE payment_attempts
          SET status = 'SUCCEEDED',
              gateway_payment_id = COALESCE(gateway_payment_id, ?),
              payment_method = COALESCE(payment_method, ?),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status IN ('CREATED', 'PROCESSING', 'PENDING')
        `, [paymentEntity.id, paymentEntity.method || 'razorpay', attempt.id]);

        return;
      }

      await tx.execute(`
        UPDATE payment_attempts
        SET status = 'SUCCEEDED',
            gateway_payment_id = ?,
            payment_method = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status IN ('CREATED', 'PROCESSING', 'PENDING')
      `, [paymentEntity.id, paymentEntity.method || 'razorpay', attempt.id]);

      await logAuditEvent({
        userId: null,
        action: 'RAZORPAY_WEBHOOK_PAYMENT_SUCCEEDED',
        resourceType: 'booking',
        resourceId: currentBooking.id,
        details: {
          attemptId: attempt.id,
          orderId: attempt.order_id,
          paymentId: paymentEntity.id,
          amount: currentBooking.calculated_fare,
          paymentMethod: paymentEntity.method || 'razorpay'
        },
        ipAddress
      });
    });

    // Mark event PROCESSED guarded by claim_token
    await execute(`
      UPDATE payment_webhook_events
      SET status = 'PROCESSED',
          processed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'PROCESSING' AND claim_token = ?
    `, [eventId, claimToken]);

    return { status: 'PROCESSED', eventId, eventType, orderId, paymentId: paymentEntity.id };
  } catch (processErr) {
    if (processErr.code !== 'LEASE_LOST') {
      await execute(`
        UPDATE payment_webhook_events
        SET status = 'FAILED',
            error_message = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'PROCESSING' AND claim_token = ?
      `, [processErr.message?.substring(0, 500) || 'Unknown processing error', eventId, claimToken]).catch(() => {});
    }

    throw processErr;
  }
}
