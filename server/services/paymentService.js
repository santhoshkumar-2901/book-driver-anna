import crypto from 'crypto';
import { queryOne, execute, withTransaction } from '../db/database.js';
import { validateGuestToken } from './guestAccessService.js';
import { logAuditEvent } from './auditService.js';

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
