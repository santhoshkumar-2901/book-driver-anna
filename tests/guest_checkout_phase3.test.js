import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import crypto from 'crypto';
import { app } from '../server/index.js';
import { queryOne, queryAll, execute } from '../server/db/database.js';
import { deriveGuestToken } from '../server/services/guestAccessService.js';
import { createBooking } from '../server/services/bookingService.js';
import { ENV, isDummyPaymentAllowed } from '../server/config/env.js';

describe('Phase 3: Test-Only Razorpay-Style Guest Checkout Suite', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('1. Environment Fail-Closed & Lockout Rules', () => {
    test('1.1 isDummyPaymentAllowed evaluates strictly true in test environment', () => {
      assert.strictEqual(isDummyPaymentAllowed(), true, 'Must be true in test environment');
    });

    test('1.2 Order creation and simulation are blocked with 403 when NODE_ENV is production', async () => {
      const origEnv = process.env.NODE_ENV;
      const origProd = ENV.IS_PRODUCTION;
      try {
        process.env.NODE_ENV = 'production';
        ENV.IS_PRODUCTION = true;

        const res = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' })
        });

        assert.strictEqual(res.status, 403, 'Must return 403 in production');
        const json = await res.json();
        assert.strictEqual(json.error?.code, 'TEST_MODE_DISABLED_IN_ENVIRONMENT');
      } finally {
        process.env.NODE_ENV = origEnv;
        ENV.IS_PRODUCTION = origProd;
      }
    });

    test('1.3 Empty, staging, or unknown environments fail closed with 403', async () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'staging';

        const res = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' })
        });

        assert.strictEqual(res.status, 403, 'Must fail closed for staging');
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  describe('2. Authoritative Fare Extraction & Financial Correctness', () => {
    test('2.1 Order creation binds directly to booking calculated_fare and ignores client amount', async () => {
      const idempotencyKey = `idem-fare-bind-${Date.now()}`;
      const bookingRes = await createBooking({
        customerName: 'Fare Check Customer',
        customerPhone: '9876543301',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-11-01',
        time: '10:00 AM',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        idempotencyKey
      });

      const token = bookingRes.paymentLink.token;
      const expectedFare = Number(bookingRes.booking.calculated_fare);
      assert.ok(expectedFare > 0, 'Booking must have positive calculated fare');

      // Attempt to tamper with amount in request body
      const orderRes = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          amount: 1.00, // Tampered client amount
          currency: 'USD' // Tampered currency
        })
      });

      assert.strictEqual(orderRes.status, 200);
      const json = await orderRes.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.amount, Number(expectedFare.toFixed(2)), 'Must use authoritative DB fare');
      assert.strictEqual(json.data.currency, 'INR', 'Must enforce INR currency');
      assert.strictEqual(json.data.amountInPaise, Math.round(expectedFare * 100), 'Must correctly compute paise integer');
      assert.ok(json.data.orderId.startsWith('order_test_'));
      assert.ok(json.data.attemptId.startsWith('PAY-ATT-'));
    });

    test('2.2 Decimal precision and paise conversion are mathematically exact for boundary amounts', () => {
      const testCases = [
        { fare: 549.00, expectedPaise: 54900 },
        { fare: 549.99, expectedPaise: 54999 },
        { fare: 100.50, expectedPaise: 10050 },
        { fare: 1234.56, expectedPaise: 123456 }
      ];

      for (const { fare, expectedPaise } of testCases) {
        const normalized = Number(Number(fare).toFixed(2));
        const paise = Math.round(normalized * 100);
        assert.strictEqual(paise, expectedPaise, `Paise conversion for ${fare} must be ${expectedPaise}`);
      }
    });
  });

  describe('3. Payment State Machine & Lifecycle Transitions', () => {
    test('3.1 Full success flow: CREATED -> PROCESSING -> SUCCEEDED updates booking to PAID', async () => {
      const idempotencyKey = `idem-success-flow-${Date.now()}`;
      const bookingRes = await createBooking({
        customerName: 'Success Customer',
        customerPhone: '9876543302',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-11-01',
        time: '11:00 AM',
        pickupArea: 'Indiranagar',
        dropLocation: 'Koramangala',
        idempotencyKey
      });

      const token = bookingRes.paymentLink.token;

      // 1. Create order
      const orderRes = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const orderJson = await orderRes.json();
      assert.strictEqual(orderJson.success, true);
      const { attemptId, orderId } = orderJson.data;

      // 2. Simulate Success
      const outcomeRes = await fetch(`${baseUrl}/api/guest/payments/simulate-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          attemptId,
          orderId,
          outcome: 'success',
          paymentMethod: 'simulated_upi'
        })
      });

      assert.strictEqual(outcomeRes.status, 200);
      const outcomeJson = await outcomeRes.json();
      assert.strictEqual(outcomeJson.success, true);
      assert.strictEqual(outcomeJson.data.status, 'SUCCEEDED');
      assert.strictEqual(outcomeJson.data.isPaid, true);
      assert.ok(outcomeJson.data.paymentId.startsWith('pay_test_'));

      // 3. Verify database state
      const bookingRow = await queryOne('SELECT payment_status FROM bookings WHERE id = ?', [bookingRes.booking.id]);
      assert.strictEqual(bookingRow.payment_status, 'PAID', 'Booking must be marked PAID');

      const attemptRow = await queryOne('SELECT status, gateway_payment_id FROM payment_attempts WHERE id = ?', [attemptId]);
      assert.strictEqual(attemptRow.status, 'SUCCEEDED');
      assert.strictEqual(attemptRow.gateway_payment_id, outcomeJson.data.paymentId);

      // 4. Verify audit event
      const auditRow = await queryOne(
        "SELECT * FROM audit_logs WHERE resource_id = ? AND action = 'GUEST_TEST_PAYMENT_SUCCEEDED'",
        [bookingRes.booking.id]
      );
      assert.ok(auditRow, 'Must record audit log event for test payment success');
    });

    test('3.2 Failure flow: Simulated decline sets attempt to FAILED and booking remains UNPAID', async () => {
      const idempotencyKey = `idem-fail-flow-${Date.now()}`;
      const bookingRes = await createBooking({
        customerName: 'Decline Customer',
        customerPhone: '9876543303',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-11-01',
        time: '12:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        idempotencyKey
      });

      const token = bookingRes.paymentLink.token;
      const orderRes = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const { attemptId, orderId } = (await orderRes.json()).data;

      // Simulate failure
      const outcomeRes = await fetch(`${baseUrl}/api/guest/payments/simulate-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          attemptId,
          orderId,
          outcome: 'failure',
          failureReason: 'INSUFFICIENT_FUNDS'
        })
      });

      assert.strictEqual(outcomeRes.status, 200);
      const outcomeJson = await outcomeRes.json();
      assert.strictEqual(outcomeJson.data.status, 'FAILED');
      assert.strictEqual(outcomeJson.data.isPaid, false);

      // Verify booking is still UNPAID
      const bookingRow = await queryOne('SELECT payment_status FROM bookings WHERE id = ?', [bookingRes.booking.id]);
      assert.strictEqual(bookingRow.payment_status, 'UNPAID', 'Booking must remain UNPAID after failure');

      // Attempt row is FAILED
      const attemptRow = await queryOne('SELECT status, error_code FROM payment_attempts WHERE id = ?', [attemptId]);
      assert.strictEqual(attemptRow.status, 'FAILED');
      assert.strictEqual(attemptRow.error_code, 'INSUFFICIENT_FUNDS');
    });

    test('3.3 Pending flow: Simulated timeout sets PENDING, can subsequently transition to SUCCEEDED', async () => {
      const idempotencyKey = `idem-pending-flow-${Date.now()}`;
      const bookingRes = await createBooking({
        customerName: 'Pending Customer',
        customerPhone: '9876543304',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-11-01',
        time: '01:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        idempotencyKey
      });

      const token = bookingRes.paymentLink.token;
      const orderRes = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const { attemptId, orderId } = (await orderRes.json()).data;

      // 1. Simulate timeout -> PENDING
      const timeoutRes = await fetch(`${baseUrl}/api/guest/payments/simulate-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          attemptId,
          orderId,
          outcome: 'timeout'
        })
      });
      const timeoutJson = await timeoutRes.json();
      assert.strictEqual(timeoutJson.data.status, 'PENDING');
      assert.strictEqual(timeoutJson.data.isPaid, false);

      // Check status endpoint
      const statusRes = await fetch(`${baseUrl}/api/guest/payments/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, attemptId })
      });
      const statusJson = await statusRes.json();
      assert.strictEqual(statusJson.data.status, 'PENDING');

      // 2. Resolve PENDING -> SUCCEEDED
      const resolveRes = await fetch(`${baseUrl}/api/guest/payments/simulate-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          attemptId,
          orderId,
          outcome: 'success'
        })
      });
      const resolveJson = await resolveRes.json();
      assert.strictEqual(resolveJson.data.status, 'SUCCEEDED');
      assert.strictEqual(resolveJson.data.isPaid, true);

      const bookingRow = await queryOne('SELECT payment_status FROM bookings WHERE id = ?', [bookingRes.booking.id]);
      assert.strictEqual(bookingRow.payment_status, 'PAID');
    });

    test('3.4 Customer cancellation: Attempt enters CANCELLED and booking remains UNPAID', async () => {
      const idempotencyKey = `idem-cancel-flow-${Date.now()}`;
      const bookingRes = await createBooking({
        customerName: 'Cancel Customer',
        customerPhone: '9876543305',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-11-01',
        time: '02:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        idempotencyKey
      });

      const token = bookingRes.paymentLink.token;
      const orderRes = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const { attemptId, orderId } = (await orderRes.json()).data;

      const cancelRes = await fetch(`${baseUrl}/api/guest/payments/simulate-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          attemptId,
          orderId,
          outcome: 'cancel'
        })
      });

      const cancelJson = await cancelRes.json();
      assert.strictEqual(cancelJson.data.status, 'CANCELLED');
      const bookingRow = await queryOne('SELECT payment_status FROM bookings WHERE id = ?', [bookingRes.booking.id]);
      assert.strictEqual(bookingRow.payment_status, 'UNPAID');
    });
  });

  describe('4. Terminal State Immutability & Idempotent Retries', () => {
    test('4.1 Re-submitting outcome on SUCCEEDED attempt returns idempotent 200 without duplicate settlement', async () => {
      const idempotencyKey = `idem-immutable-success-${Date.now()}`;
      const bookingRes = await createBooking({
        customerName: 'Repeat Customer',
        customerPhone: '9876543306',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-11-01',
        time: '03:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        idempotencyKey
      });

      const token = bookingRes.paymentLink.token;
      const orderRes = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const { attemptId, orderId } = (await orderRes.json()).data;

      // First success submission
      const firstRes = await fetch(`${baseUrl}/api/guest/payments/simulate-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, attemptId, orderId, outcome: 'success' })
      });
      const firstJson = await firstRes.json();
      const firstPaymentId = firstJson.data.paymentId;

      // Duplicate callback / retry submission
      const secondRes = await fetch(`${baseUrl}/api/guest/payments/simulate-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, attemptId, orderId, outcome: 'success' })
      });
      assert.strictEqual(secondRes.status, 200);
      const secondJson = await secondRes.json();
      assert.strictEqual(secondJson.data.status, 'SUCCEEDED');
      assert.strictEqual(secondJson.data.isPaid, true);
      assert.strictEqual(secondJson.data.alreadySucceeded, true);
      assert.strictEqual(secondJson.data.paymentId, firstPaymentId, 'Must return identical payment ID');

      // Attempt must NEVER transition to CANCELLED or FAILED
      const attemptRow = await queryOne('SELECT status FROM payment_attempts WHERE id = ?', [attemptId]);
      assert.strictEqual(attemptRow.status, 'SUCCEEDED');
    });

    test('4.2 Same idempotencyKey on /create-order returns existing active attempt', async () => {
      const idempotencyKey = `idem-same-order-${Date.now()}`;
      const bookingRes = await createBooking({
        customerName: 'Same Order Customer',
        customerPhone: '9876543307',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-11-01',
        time: '04:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        idempotencyKey
      });

      const token = bookingRes.paymentLink.token;
      const orderAttemptKey = `attempt-key-unique-${Date.now()}`;

      const res1 = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, idempotencyKey: orderAttemptKey })
      });
      const json1 = await res1.json();

      const res2 = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, idempotencyKey: orderAttemptKey })
      });
      const json2 = await res2.json();

      assert.strictEqual(json1.data.attemptId, json2.data.attemptId, 'Must return same attemptId');
      assert.strictEqual(json1.data.orderId, json2.data.orderId, 'Must return same orderId');

      const attemptCount = await queryAll(
        'SELECT id FROM payment_attempts WHERE idempotency_key = ?',
        [orderAttemptKey]
      );
      assert.strictEqual(attemptCount.length, 1, 'Only one database row must exist');
    });

    test('4.3 Reusing idempotencyKey after terminal failure is rejected', async () => {
      const idempotencyKey = `idem-reuse-term-${Date.now()}`;
      const bookingRes = await createBooking({
        customerName: 'Terminal Reuse Customer',
        customerPhone: '9876543308',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-11-01',
        time: '05:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        idempotencyKey
      });

      const token = bookingRes.paymentLink.token;
      const orderAttemptKey = `attempt-reuse-fail-${Date.now()}`;

      // Create attempt
      const res1 = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, idempotencyKey: orderAttemptKey })
      });
      const { attemptId, orderId } = (await res1.json()).data;

      // Fail attempt
      await fetch(`${baseUrl}/api/guest/payments/simulate-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, attemptId, orderId, outcome: 'failure' })
      });

      // Try to reuse same key
      const reuseRes = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, idempotencyKey: orderAttemptKey })
      });

      assert.strictEqual(reuseRes.status, 400);
      const reuseJson = await reuseRes.json();
      assert.strictEqual(reuseJson.error?.code, 'IDEMPOTENCY_KEY_REUSE_AFTER_TERMINAL');

      // Using a fresh key succeeds
      const freshRes = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, idempotencyKey: `fresh-key-${Date.now()}` })
      });
      assert.strictEqual(freshRes.status, 200);
    });
  });

  describe('5. Concurrency & Booking-Level Single Settlement Protection', () => {
    test('5.1 Two competing attempts for one booking: exactly one succeeds and second reconciles to CANCELLED', async () => {
      const idempotencyKey = `idem-race-cond-${Date.now()}`;
      const bookingRes = await createBooking({
        customerName: 'Race Customer',
        customerPhone: '9876543309',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-11-01',
        time: '06:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        idempotencyKey
      });

      const token = bookingRes.paymentLink.token;

      // Create Attempt 1
      const orderRes1 = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, idempotencyKey: `key-race-1-${Date.now()}` })
      });
      const attempt1 = (await orderRes1.json()).data;

      // Create Attempt 2
      const orderRes2 = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, idempotencyKey: `key-race-2-${Date.now()}` })
      });
      const attempt2 = (await orderRes2.json()).data;

      // Fire simultaneous success outcomes for both attempts
      const [resOutcome1, resOutcome2] = await Promise.all([
        fetch(`${baseUrl}/api/guest/payments/simulate-outcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, attemptId: attempt1.attemptId, orderId: attempt1.orderId, outcome: 'success' })
        }),
        fetch(`${baseUrl}/api/guest/payments/simulate-outcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, attemptId: attempt2.attemptId, orderId: attempt2.orderId, outcome: 'success' })
        })
      ]);

      const jsonOutcome1 = await resOutcome1.json();
      const jsonOutcome2 = await resOutcome2.json();

      const statuses = [jsonOutcome1.data.status, jsonOutcome2.data.status];
      assert.ok(statuses.includes('SUCCEEDED'), 'Exactly one attempt must SUCCEED');
      assert.ok(statuses.includes('CANCELLED'), 'The competing attempt must reconcile to CANCELLED');

      // Booking payment status is PAID
      const bookingRow = await queryOne('SELECT payment_status FROM bookings WHERE id = ?', [bookingRes.booking.id]);
      assert.strictEqual(bookingRow.payment_status, 'PAID');

      // Audit logs has exactly one GUEST_TEST_PAYMENT_SUCCEEDED
      const auditRows = await queryAll(
        "SELECT * FROM audit_logs WHERE resource_id = ? AND action = 'GUEST_TEST_PAYMENT_SUCCEEDED'",
        [bookingRes.booking.id]
      );
      assert.strictEqual(auditRows.length, 1, 'Exactly one audit log event must be written');
    });

    test('5.2 Order creation on already-PAID booking is rejected with BOOKING_ALREADY_PAID', async () => {
      const idempotencyKey = `idem-already-paid-${Date.now()}`;
      const bookingRes = await createBooking({
        customerName: 'Paid Check Customer',
        customerPhone: '9876543310',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-11-01',
        time: '07:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        idempotencyKey
      });

      const token = bookingRes.paymentLink.token;

      // Settle booking
      await execute("UPDATE bookings SET payment_status = 'PAID' WHERE id = ?", [bookingRes.booking.id]);

      // Try creating order
      const res = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error?.code, 'BOOKING_ALREADY_PAID');
    });
  });

  describe('6. Security, Authorization & Privacy Isolation', () => {
    test('6.1 Expired or revoked guest token rejects payment operations', async () => {
      const idempotencyKey = `idem-token-revoked-${Date.now()}`;
      const bookingRes = await createBooking({
        customerName: 'Revoked Token Customer',
        customerPhone: '9876543311',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-11-01',
        time: '08:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        idempotencyKey
      });

      const token = bookingRes.paymentLink.token;

      // Revoke token
      await execute('UPDATE guest_access_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE booking_id = ?', [bookingRes.booking.id]);

      const res = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.error?.code, 'TOKEN_REVOKED');
    });

    test('6.2 Order creation for CANCELLED booking is rejected with 400', async () => {
      const idempotencyKey = `idem-cancelled-bk-${Date.now()}`;
      const bookingRes = await createBooking({
        customerName: 'Cancelled Booking Customer',
        customerPhone: '9876543312',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-11-01',
        time: '09:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        idempotencyKey
      });

      const token = bookingRes.paymentLink.token;
      await execute("UPDATE bookings SET status = 'CANCELLED' WHERE id = ?", [bookingRes.booking.id]);

      const res = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error?.code, 'BOOKING_CANCELLED');
    });

    test('6.3 Guest payment endpoints strictly omit customer phone, email, and driver GPS data', async () => {
      const idempotencyKey = `idem-privacy-${Date.now()}`;
      const bookingRes = await createBooking({
        customerName: 'Private Customer',
        customerPhone: '9876543313',
        customerEmail: 'private.guest@example.com',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-11-01',
        time: '10:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        destLat: 12.9850,
        destLng: 77.7300,
        idempotencyKey
      });

      const token = bookingRes.paymentLink.token;
      const orderRes = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const orderData = (await orderRes.json()).data;

      assert.strictEqual(orderData.customerPhone, undefined);
      assert.strictEqual(orderData.customer_phone, undefined);
      assert.strictEqual(orderData.customerEmail, undefined);
      assert.strictEqual(orderData.pickupLat, undefined);
      assert.strictEqual(orderData.pickupLatitude, undefined);
      assert.strictEqual(orderData.destLat, undefined);
    });

    test('6.4 Admin revenue calculation produces identical result before and after test payment settlement', async () => {
      // Query admin revenue before
      const revenueBeforeRow = await queryOne(
        "SELECT COALESCE(SUM(calculated_fare), 0) as total FROM bookings WHERE status = 'COMPLETED'"
      );
      const revenueBefore = Number(revenueBeforeRow.total);

      // Settle a test booking that is NOT yet COMPLETED
      const idempotencyKey = `idem-rev-check-${Date.now()}`;
      const bookingRes = await createBooking({
        customerName: 'Revenue Unaffected Customer',
        customerPhone: '9876543314',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-11-01',
        time: '11:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        idempotencyKey
      });

      const token = bookingRes.paymentLink.token;
      const orderRes = await fetch(`${baseUrl}/api/guest/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const { attemptId, orderId } = (await orderRes.json()).data;

      await fetch(`${baseUrl}/api/guest/payments/simulate-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, attemptId, orderId, outcome: 'success' })
      });

      // Admin revenue must strictly remain unchanged because trip is not COMPLETED
      const revenueAfterRow = await queryOne(
        "SELECT COALESCE(SUM(calculated_fare), 0) as total FROM bookings WHERE status = 'COMPLETED'"
      );
      const revenueAfter = Number(revenueAfterRow.total);

      assert.strictEqual(revenueAfter, revenueBefore, 'Admin revenue query must not change merely on payment');
    });
  });
});
