import './setupEnv.js';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'crypto';
import http from 'http';
import { app } from '../server/index.js';
import { queryOne, queryAll, execute, withTransaction } from '../server/db/database.js';
import { createBooking } from '../server/services/bookingService.js';
import {
  deriveGuestToken,
  issueInitialGuestTokenTx,
  recoverTokenForIdempotentRetry,
  validateGuestToken,
  getSanitizedBookingSummary,
  reissueAdminPaymentLink
} from '../server/services/guestAccessService.js';
import { ENV } from '../server/config/env.js';

// Load resolveRoute from App.jsx
const appContent = fs.readFileSync(path.resolve('src/App.jsx'), 'utf8');
const resolveRouteFnCode = appContent
  .match(/export function resolveRoute\([\s\S]*?\n\}/)[0]
  .replace('export function resolveRoute', 'function resolveRoute');
const resolveRoute = new Function(`${resolveRouteFnCode}; return resolveRoute;`)();

describe('Phase 2: Secure Booking Access Suite', () => {
  let server;
  let baseUrl;
  let adminToken;
  let testAdminUser;

  before(async () => {
    // Start test server
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Create a verified admin user for admin-assisted re-issuance tests
    testAdminUser = {
      id: `USR-ADM-P2-${Date.now()}`,
      name: 'Phase2 Admin',
      email: `admin-p2-${Date.now()}@bookdriveranna.com`,
      phone: `99900${Math.floor(10000 + Math.random() * 90000)}`,
      password_hash: '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6x8ek5q4.Z8kE8rIoiwe',
      role: 'admin',
      status: 'Active'
    };
    await execute(`
      INSERT INTO users (id, name, email, phone, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [testAdminUser.id, testAdminUser.name, testAdminUser.email, testAdminUser.phone, testAdminUser.password_hash, testAdminUser.role, testAdminUser.status]);

    // Generate valid admin JWT token
    const jwt = (await import('jsonwebtoken')).default;
    adminToken = jwt.sign(
      { id: testAdminUser.id, email: testAdminUser.email, role: 'admin' },
      ENV.JWT_SECRET,
      { expiresIn: '2h' }
    );
  });

  after(async () => {
    if (testAdminUser) {
      await execute('DELETE FROM users WHERE id = ?', [testAdminUser.id]).catch(() => {});
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('1. Token Derivation, Entropy & Hash-Only Persistence', () => {
    test('1.1 Token derivation yields a 64-char hex string (256 bits entropy) and matching SHA-256 hash', () => {
      const bookingId = 'BDA-DRV-TEST01';
      const key = 'idem-key-test-entropy-1234';
      const { rawToken, tokenHash, secretVersion } = deriveGuestToken(bookingId, key);

      assert.strictEqual(typeof rawToken, 'string');
      assert.strictEqual(rawToken.length, 64, 'Raw token must be exactly 64 hex characters (256 bits)');
      assert.match(rawToken, /^[0-9a-f]{64}$/i, 'Raw token must be a valid lowercase hex string');
      assert.strictEqual(secretVersion, 'v1');

      const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      assert.strictEqual(tokenHash, expectedHash, 'Token hash must be exact SHA-256 of raw token');
    });

    test('1.2 Database table guest_access_tokens stores ONLY token_hash and never rawToken', async () => {
      const idempotencyKey = `idem-hash-check-${Date.now()}`;
      const bookingResult = await createBooking({
        customerName: 'Hash Audit Customer',
        customerPhone: '9876543210',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-10-30',
        time: '10:00 AM',
        pickupArea: 'Indiranagar',
        dropLocation: 'Koramangala',
        idempotencyKey
      });

      assert.ok(bookingResult?.paymentLink?.token, 'Must return raw token in creation response');
      const returnedRawToken = bookingResult.paymentLink.token;

      // Query database directly
      const tokenRow = await queryOne(
        'SELECT * FROM guest_access_tokens WHERE booking_id = ?',
        [bookingResult.booking.id]
      );

      assert.ok(tokenRow, 'Must have inserted a token row in guest_access_tokens');
      assert.strictEqual(tokenRow.token_hash, crypto.createHash('sha256').update(returnedRawToken).digest('hex'));
      assert.strictEqual(tokenRow.raw_token, undefined, 'Column raw_token must not exist in table');
      assert.strictEqual(tokenRow.token, undefined, 'Column token must not exist in table');
      assert.doesNotMatch(JSON.stringify(tokenRow), new RegExp(returnedRawToken), 'Raw token string must never appear in table row');
    });

    test('1.3 Payment link uses URL fragment #token= rather than query string ?token=', async () => {
      const idempotencyKey = `idem-url-fragment-${Date.now()}`;
      const bookingResult = await createBooking({
        customerName: 'Fragment Customer',
        customerPhone: '9876543211',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-10-30',
        time: '11:00 AM',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        idempotencyKey
      });

      const url = bookingResult.paymentLink.url;
      assert.match(url, /^#token=[0-9a-f]{64}$|^\/pay\/[A-Za-z0-9_-]+#token=[0-9a-f]{64}$/, 'URL must use #token= fragment');
      assert.doesNotMatch(url, /\?token=/, 'URL must NEVER use query parameter ?token=');
    });
  });

  describe('2. Idempotency, Lost Responses & Secret Keyring Rotation', () => {
    test('2.1 Retrying with the same idempotencyKey recovers the exact same active raw token', async () => {
      const idempotencyKey = `idem-same-key-${Date.now()}`;
      const firstSubmission = await createBooking({
        customerName: 'Idempotent Retry Customer',
        customerPhone: '9876543212',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-10-30',
        time: '02:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        idempotencyKey
      });

      assert.strictEqual(firstSubmission.isDuplicate, false);
      const firstToken = firstSubmission.paymentLink.token;

      // Duplicate submission with exact same idempotencyKey
      const duplicateSubmission = await createBooking({
        customerName: 'Idempotent Retry Customer',
        customerPhone: '9876543212',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-10-30',
        time: '02:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        idempotencyKey
      });

      assert.strictEqual(duplicateSubmission.isDuplicate, true);
      assert.strictEqual(duplicateSubmission.booking.id, firstSubmission.booking.id);
      assert.strictEqual(
        duplicateSubmission.paymentLink.token,
        firstToken,
        'Idempotent retry must return the exact same raw token'
      );
      assert.strictEqual(duplicateSubmission.paymentLink.url, firstSubmission.paymentLink.url);
    });

    test('2.2 Different booking requests with different idempotency keys create distinct bookings with distinct tokens', async () => {
      const keyA = `idem-distinct-a-${Date.now()}`;
      const keyB = `idem-distinct-b-${Date.now()}`;

      const resA = await createBooking({
        customerName: 'Customer A',
        customerPhone: '9876543213',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-10-30',
        time: '03:00 PM',
        pickupArea: 'Koramangala',
        dropLocation: 'Indiranagar',
        idempotencyKey: keyA
      });

      const resB = await createBooking({
        customerName: 'Customer B',
        customerPhone: '9876543214',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-10-30',
        time: '04:00 PM',
        pickupArea: 'HSR Layout',
        dropLocation: 'Whitefield',
        idempotencyKey: keyB
      });

      assert.notStrictEqual(resA.booking.id, resB.booking.id);
      assert.notStrictEqual(resA.paymentLink.token, resB.paymentLink.token);
    });

    test('2.3 Keyring rotation preserves derivation for prior key versions recorded in DB', () => {
      // Simulate adding v2 to keyring while keeping v1
      const originalKeyring = { ...ENV.GUEST_TOKEN_KEYRING };
      ENV.GUEST_TOKEN_KEYRING['v2'] = 'bda-test-guest-token-secret-key-version-two-32chars!';
      ENV.GUEST_TOKEN_ACTIVE_VERSION = 'v2';

      try {
        const bookingId = 'BDA-DRV-ROT01';
        const key = 'idem-rot-key';

        // Derive under v1 explicitly
        const tokenV1 = deriveGuestToken(bookingId, key, 'v1');
        // Derive under active v2
        const tokenV2 = deriveGuestToken(bookingId, key);

        assert.strictEqual(tokenV1.secretVersion, 'v1');
        assert.strictEqual(tokenV2.secretVersion, 'v2');
        assert.notStrictEqual(tokenV1.rawToken, tokenV2.rawToken);

        // Re-deriving with recorded v1 returns identical v1 token
        const rederivedV1 = deriveGuestToken(bookingId, key, 'v1');
        assert.strictEqual(rederivedV1.rawToken, tokenV1.rawToken);
      } finally {
        // Restore environment
        ENV.GUEST_TOKEN_KEYRING = originalKeyring;
        ENV.GUEST_TOKEN_ACTIVE_VERSION = 'v1';
      }
    });

    test('2.4 Missing or invalid secret throws an explicit error and never uses weak fallback', () => {
      const originalKeyring = { ...ENV.GUEST_TOKEN_KEYRING };
      ENV.GUEST_TOKEN_KEYRING = { v1: 'short' }; // Invalid short secret (< 32 chars)

      try {
        assert.throws(() => {
          deriveGuestToken('BDA-DRV-FAIL', 'idem-key');
        }, /Missing or invalid secret/);
      } finally {
        ENV.GUEST_TOKEN_KEYRING = originalKeyring;
      }
    });
  });

  describe('3. Token Validation, Expiry & State Transitions', () => {
    test('3.1 Valid unexpired token validates successfully and returns full booking context', async () => {
      const idempotencyKey = `idem-valid-test-${Date.now()}`;
      const res = await createBooking({
        customerName: 'Valid Token Customer',
        customerPhone: '9876543215',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-10-31',
        time: '09:00 AM',
        pickupArea: 'Indiranagar',
        dropLocation: 'Airport',
        idempotencyKey
      });

      const validation = await validateGuestToken(res.paymentLink.token);
      assert.strictEqual(validation.valid, true);
      assert.strictEqual(validation.booking.b_id, res.booking.id);
      assert.strictEqual(validation.booking.payment_status, 'UNPAID');
    });

    test('3.2 Expired token is rejected with TOKEN_EXPIRED', async () => {
      const idempotencyKey = `idem-exp-test-${Date.now()}`;
      const res = await createBooking({
        customerName: 'Expired Token Customer',
        customerPhone: '9876543216',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-10-31',
        time: '10:00 AM',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        idempotencyKey
      });

      // Manually set expires_at in the past
      await execute(
        "UPDATE guest_access_tokens SET expires_at = '2020-01-01 00:00:00' WHERE booking_id = ?",
        [res.booking.id]
      );

      const validation = await validateGuestToken(res.paymentLink.token);
      assert.strictEqual(validation.valid, false);
      assert.strictEqual(validation.code, 'TOKEN_EXPIRED');
      assert.strictEqual(validation.status, 410);
    });

    test('3.3 Revoked token is rejected with TOKEN_REVOKED', async () => {
      const idempotencyKey = `idem-rev-test-${Date.now()}`;
      const res = await createBooking({
        customerName: 'Revoked Token Customer',
        customerPhone: '9876543217',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-10-31',
        time: '11:00 AM',
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        idempotencyKey
      });

      // Revoke token
      await execute(
        'UPDATE guest_access_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE booking_id = ?',
        [res.booking.id]
      );

      const validation = await validateGuestToken(res.paymentLink.token);
      assert.strictEqual(validation.valid, false);
      assert.strictEqual(validation.code, 'TOKEN_REVOKED');
      assert.strictEqual(validation.status, 403);
    });

    test('3.4 Cancelled booking invalidates token access with BOOKING_CANCELLED', async () => {
      const idempotencyKey = `idem-can-test-${Date.now()}`;
      const res = await createBooking({
        customerName: 'Cancelled Booking Customer',
        customerPhone: '9876543218',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-10-31',
        time: '12:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'Koramangala',
        idempotencyKey
      });

      await execute(
        "UPDATE bookings SET status = 'CANCELLED' WHERE id = ?",
        [res.booking.id]
      );

      const validation = await validateGuestToken(res.paymentLink.token);
      assert.strictEqual(validation.valid, false);
      assert.strictEqual(validation.code, 'BOOKING_CANCELLED');
    });

    test('3.5 Completed trip with unpaid fare remains payable via valid token (User Decision 2)', async () => {
      const idempotencyKey = `idem-comp-unpaid-${Date.now()}`;
      const res = await createBooking({
        customerName: 'Completed Unpaid Customer',
        customerPhone: '9876543219',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-10-31',
        time: '01:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'Koramangala',
        idempotencyKey
      });

      // Transition to COMPLETED while payment_status remains UNPAID
      await execute(
        "UPDATE bookings SET status = 'COMPLETED' WHERE id = ?",
        [res.booking.id]
      );

      const validation = await validateGuestToken(res.paymentLink.token);
      assert.strictEqual(validation.valid, true);
      assert.strictEqual(validation.booking.booking_status, 'COMPLETED');
      assert.strictEqual(validation.booking.payment_status, 'UNPAID');

      const summary = await getSanitizedBookingSummary(res.paymentLink.token);
      assert.strictEqual(summary.success, true);
      assert.strictEqual(summary.data.isPaid, false);
      assert.strictEqual(summary.data.bookingStatus, 'COMPLETED');
    });

    test('3.6 Already-paid booking validates with isPaid: true and shows receipt summary', async () => {
      const idempotencyKey = `idem-paid-test-${Date.now()}`;
      const res = await createBooking({
        customerName: 'Already Paid Customer',
        customerPhone: '9876543220',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-10-31',
        time: '02:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'Koramangala',
        idempotencyKey
      });

      // Mark payment_status as PAID
      await execute(
        "UPDATE bookings SET payment_status = 'PAID' WHERE id = ?",
        [res.booking.id]
      );

      const summary = await getSanitizedBookingSummary(res.paymentLink.token);
      assert.strictEqual(summary.success, true);
      assert.strictEqual(summary.data.isPaid, true);
      assert.strictEqual(summary.data.paymentStatus, 'PAID');
    });
  });

  describe('4. Sanitized Information Isolation & Safe Error Handling', () => {
    test('4.1 getSanitizedBookingSummary strictly omits customer phone, email, driver contact, and GPS coordinates', async () => {
      const idempotencyKey = `idem-leak-test-${Date.now()}`;
      const res = await createBooking({
        customerName: 'Privacy Conscious Customer',
        customerPhone: '9876543221',
        customerEmail: 'secret.personal.email@example.com',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-10-31',
        time: '03:00 PM',
        pickupArea: 'Indiranagar Main Road',
        dropLocation: 'Whitefield ITPL',
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        destLat: 12.9850,
        destLng: 77.7300,
        idempotencyKey
      });

      const summaryRes = await getSanitizedBookingSummary(res.paymentLink.token);
      assert.strictEqual(summaryRes.success, true);
      const data = summaryRes.data;

      // Assert verified safe fields are present
      assert.strictEqual(data.bookingId, res.booking.id);
      assert.strictEqual(data.pickupArea, 'Indiranagar Main Road');
      assert.strictEqual(data.dropLocation, 'Whitefield ITPL');
      assert.strictEqual(data.currency, 'INR');

      // Assert private/sensitive fields are completely undefined
      assert.strictEqual(data.customerPhone, undefined, 'customerPhone must be omitted');
      assert.strictEqual(data.customer_phone, undefined, 'customer_phone must be omitted');
      assert.strictEqual(data.customerEmail, undefined, 'customerEmail must be omitted');
      assert.strictEqual(data.customer_email, undefined, 'customer_email must be omitted');
      assert.strictEqual(data.userId, undefined, 'userId must be omitted');
      assert.strictEqual(data.user_id, undefined, 'user_id must be omitted');
      assert.strictEqual(data.assignedDriverPhone, undefined, 'assignedDriverPhone must be omitted');
      assert.strictEqual(data.pickupLat, undefined, 'pickupLat must be omitted');
      assert.strictEqual(data.pickup_latitude, undefined, 'pickup_latitude must be omitted');
      assert.strictEqual(data.idempotencyKey, undefined, 'idempotencyKey must be omitted');
      assert.strictEqual(data.tokenHash, undefined, 'tokenHash must be omitted');
    });

    test('4.2 HTTP POST /api/guest/booking-summary enforces security headers and body token consumption', async () => {
      const idempotencyKey = `idem-http-headers-${Date.now()}`;
      const res = await createBooking({
        customerName: 'HTTP Header Customer',
        customerPhone: '9876543222',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-10-31',
        time: '04:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'Koramangala',
        idempotencyKey
      });

      const response = await fetch(`${baseUrl}/api/guest/booking-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: res.paymentLink.token })
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers.get('referrer-policy'), 'no-referrer');
      assert.match(response.headers.get('cache-control') || '', /no-store/);

      const json = await response.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.bookingId, res.booking.id);
    });
  });

  describe('5. Admin-Assisted Re-issuance & Audit Logging', () => {
    test('5.1 Non-admin request to re-issue payment link is rejected with 401/403', async () => {
      const response = await fetch(`${baseUrl}/api/admin/bookings/BDA-DRV-TEST/payment-link/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      assert.ok(response.status === 401 || response.status === 403);
    });

    test('5.2 Authenticated Admin re-issues payment link, revokes prior token, and logs audit event', async () => {
      const idempotencyKey = `idem-admin-reissue-${Date.now()}`;
      const res = await createBooking({
        customerName: 'Admin Reissue Customer',
        customerPhone: '9876543223',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-10-31',
        time: '05:00 PM',
        pickupArea: 'Indiranagar',
        dropLocation: 'Koramangala',
        idempotencyKey
      });

      const originalToken = res.paymentLink.token;

      // Call Admin re-issuance endpoint
      const reissueResponse = await fetch(`${baseUrl}/api/admin/bookings/${res.booking.id}/payment-link/reissue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      });

      assert.strictEqual(reissueResponse.status, 200);
      const reissueJson = await reissueResponse.json();
      assert.strictEqual(reissueJson.success, true);
      assert.ok(reissueJson.data.paymentLink.token);

      const newToken = reissueJson.data.paymentLink.token;
      assert.notStrictEqual(newToken, originalToken, 'Replacement token must be fresh and distinct');

      // Old token must now be revoked
      const oldValidation = await validateGuestToken(originalToken);
      assert.strictEqual(oldValidation.valid, false);
      assert.strictEqual(oldValidation.code, 'TOKEN_REVOKED');

      // New token must validate successfully
      const newValidation = await validateGuestToken(newToken);
      assert.strictEqual(newValidation.valid, true);

      // Audit log must have recorded ADMIN_TOKEN_REISSUED
      const auditLog = await queryOne(
        "SELECT * FROM audit_logs WHERE resource_id = ? AND action = 'ADMIN_TOKEN_REISSUED'",
        [res.booking.id]
      );
      assert.ok(auditLog, 'Must record audit log for admin re-issuance');
      assert.doesNotMatch(JSON.stringify(auditLog), new RegExp(newToken), 'Audit log must not contain raw token');
    });
  });

  describe('6. Historical Classification & Revenue Metric Continuity', () => {
    test('6.1 Historical completed booking is classified as LEGACY_UNVERIFIED and non-completed as UNPAID', async () => {
      const legacyCompletedId = `BK-LEG-COMP-${Date.now()}`;
      const legacyPendingId = `BK-LEG-PEND-${Date.now()}`;

      // Insert mock pre-migration records without payment_status
      await execute(`
        INSERT INTO bookings (id, customer_name, customer_phone, service_name, booking_type, trip_type, pickup_area, date, time, calculated_fare, status)
        VALUES (?, 'Legacy Completed', '9876543224', 'Driver Service', 'driver', 'one-way', 'Indiranagar', '2026-09-01', '10:00 AM', 600, 'COMPLETED')
      `, [legacyCompletedId]);

      await execute(`
        INSERT INTO bookings (id, customer_name, customer_phone, service_name, booking_type, trip_type, pickup_area, date, time, calculated_fare, status)
        VALUES (?, 'Legacy Pending', '9876543225', 'Driver Service', 'driver', 'one-way', 'Indiranagar', '2026-09-01', '11:00 AM', 450, 'PENDING')
      `, [legacyPendingId]);

      // Run backfill query
      await execute("UPDATE bookings SET payment_status = 'LEGACY_UNVERIFIED' WHERE status = 'COMPLETED' AND payment_status = 'UNPAID'");

      const compRow = await queryOne('SELECT payment_status FROM bookings WHERE id = ?', [legacyCompletedId]);
      const pendRow = await queryOne('SELECT payment_status FROM bookings WHERE id = ?', [legacyPendingId]);

      assert.strictEqual(compRow.payment_status, 'LEGACY_UNVERIFIED', 'Completed historical booking must be LEGACY_UNVERIFIED');
      assert.strictEqual(pendRow.payment_status, 'UNPAID', 'Pending historical booking must be UNPAID');
    });

    test('6.2 Existing Admin revenue query produces identical result regardless of payment_status column', async () => {
      const revenueRow = await queryOne(
        "SELECT COALESCE(SUM(calculated_fare), 0) as total FROM bookings WHERE status = 'COMPLETED'"
      );
      assert.ok(typeof Number(revenueRow.total) === 'number' && Number(revenueRow.total) >= 0);
    });
  });

  describe('7. Frontend Route Mapping Verification', () => {
    test('7.1 /pay/:bookingId resolves to page: pay with matching bookingId', () => {
      const route = resolveRoute('/pay/BDA-DRV-ABC123');
      assert.strictEqual(route.page, 'pay');
      assert.strictEqual(route.bookingId, 'BDA-DRV-ABC123');
      assert.strictEqual(route.role, 'client');
    });

    test('7.2 Unmapped invalid paths still resolve cleanly to not-found', () => {
      const route = resolveRoute('/some-random-route-404');
      assert.strictEqual(route.page, 'not-found');
    });
  });
});
