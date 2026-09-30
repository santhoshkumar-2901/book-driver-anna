import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { startTestServer } from './testHelper.js';
import { execute, queryOne } from '../server/db/database.js';

describe('Production Authentication & Role Authorization Flow Hardening Suite', () => {
  let server, baseUrl;

  const testSuffix = Date.now().toString().slice(-6);
  const customerEmail = `auth_test_cust_${testSuffix}@example.com`;
  const customerPhoneRaw = `9845${testSuffix}`;
  const customerPhoneFormatted = `+91 ${customerPhoneRaw}`;
  const customerPassword = 'ValidCustPass2026!';

  const driverEmail = `auth_test_drv_${testSuffix}@driveranna.com`;
  const driverPhoneRaw = `9742${testSuffix}`;
  const driverPhoneFormatted = `+91 ${driverPhoneRaw}`;
  const driverDl = `KA-05-2026-${testSuffix}`;
  const driverPassword = 'ValidDriverPass2026!';

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // Clean up any test fixtures from database if exists
    await execute('DELETE FROM drivers WHERE license_number = ?', [driverDl]);
    await execute('DELETE FROM users WHERE email IN (?, ?)', [customerEmail, driverEmail]);
  });

  after(async () => {
    server.close();
    await execute('DELETE FROM drivers WHERE license_number = ?', [driverDl]);
    await execute('DELETE FROM users WHERE email IN (?, ?)', [customerEmail, driverEmail]);
  });

  // =========================================================================
  // 1. REGISTRATION BEHAVIOR & DUPLICATE PROTECTION
  // =========================================================================
  describe('1. Customer & Driver Registration Flow', () => {
    test('1.1 New customer registration succeeds with 201 and sanitized user', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Namma Customer',
          email: customerEmail,
          phone: customerPhoneRaw,
          password: customerPassword,
          area: 'Indiranagar'
        })
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.user.email, customerEmail.toLowerCase());
      assert.strictEqual(data.data.user.role, 'customer');
      assert.strictEqual(data.data.user.password, undefined);
      assert.strictEqual(data.data.user.password_hash, undefined);
      assert.ok(data.data.token, 'JWT token must be issued on registration');
    });

    test('1.2 Duplicate customer email is rejected with 409 and exact message', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Imposter Customer',
          email: customerEmail.toUpperCase(), // case-insensitive check
          phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
          password: 'AnotherPassword2026!'
        })
      });

      assert.strictEqual(res.status, 409);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'USER_ALREADY_EXISTS');
      assert.strictEqual(data.error.message, 'An account already exists with this email.');
      assert.strictEqual(data.message, 'An account already exists with this email.');
    });

    test('1.3 Duplicate customer phone is rejected with 409 and exact message', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Imposter Phone Customer',
          email: `different_email_${testSuffix}@example.com`,
          phone: customerPhoneFormatted, // formatted variant check
          password: 'AnotherPassword2026!'
        })
      });

      assert.strictEqual(res.status, 409);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'USER_ALREADY_EXISTS');
      assert.strictEqual(data.error.message, 'An account already exists with this phone number.');
      assert.strictEqual(data.message, 'An account already exists with this phone number.');
    });

    test('1.4 New driver registration succeeds with 201 and sanitized user', async () => {
      const res = await fetch(`${baseUrl}/api/auth/driver-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Shankar Anna',
          phone: driverPhoneRaw,
          dlNumber: driverDl,
          password: driverPassword,
          email: driverEmail,
          upiId: 'shankar.driver@oksbi',
          area: 'Koramangala'
        })
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.user.role, 'driver');
      assert.strictEqual(data.data.user.dlNumber, driverDl);
      assert.strictEqual(data.data.user.password, undefined);
      assert.strictEqual(data.data.user.password_hash, undefined);
      assert.ok(data.data.token, 'Driver JWT token must be issued');
    });

    test('1.5 Duplicate driver email is rejected with 409', async () => {
      const res = await fetch(`${baseUrl}/api/auth/driver-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate Driver Email',
          phone: `9999${testSuffix}`,
          dlNumber: `KA-01-9999-${testSuffix}`,
          password: 'DriverPassword2026!',
          email: driverEmail
        })
      });

      assert.strictEqual(res.status, 409);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'USER_ALREADY_EXISTS');
      assert.strictEqual(data.error.message, 'An account already exists with this email.');
    });

    test('1.6 Duplicate driver phone is rejected with 409', async () => {
      const res = await fetch(`${baseUrl}/api/auth/driver-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate Driver Phone',
          phone: driverPhoneFormatted,
          dlNumber: `KA-01-8888-${testSuffix}`,
          password: 'DriverPassword2026!',
          email: `unique_drv_${testSuffix}@driveranna.com`
        })
      });

      assert.strictEqual(res.status, 409);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'USER_ALREADY_EXISTS');
      assert.strictEqual(data.error.message, 'An account already exists with this phone number.');
    });
  });

  // =========================================================================
  // 2. LOGIN BEHAVIOR & UNIFIED GENERIC ERROR
  // =========================================================================
  describe('2. Unified Login Authentication & Generic Error Policy', () => {
    test('2.1 Customer can log in with registered email and password', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: customerEmail,
          password: customerPassword
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.user.email, customerEmail.toLowerCase());
      assert.ok(data.data.token);
    });

    test('2.2 Customer can log in with 10-digit phone and password', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: customerPhoneRaw,
          password: customerPassword
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.user.email, customerEmail.toLowerCase());
      assert.ok(data.data.token);
    });

    test('2.3 Driver can log in with 10-digit phone and password via /api/auth/driver-login', async () => {
      const res = await fetch(`${baseUrl}/api/auth/driver-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: driverPhoneRaw,
          password: driverPassword
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.user.role, 'driver');
      assert.ok(data.data.token);
    });

    test('2.4 Driver can log in with DL number and password via /api/auth/driver-login', async () => {
      const res = await fetch(`${baseUrl}/api/auth/driver-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: driverDl,
          password: driverPassword
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.user.role, 'driver');
    });

    test('2.5 Non-existent email returns 401 with generic error (no account enumeration)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'nonexistent_account_never_existed@example.com',
          password: 'SomeRandomPassword123!'
        })
      });

      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_CREDENTIALS');
      assert.strictEqual(data.error.message, 'Invalid email/phone or password.');
      assert.strictEqual(data.message, 'Invalid email/phone or password.');
      assert.strictEqual(data.data, undefined);
    });

    test('2.6 Non-existent phone returns 401 with identical generic error', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: '9111999999',
          password: 'SomeRandomPassword123!'
        })
      });

      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_CREDENTIALS');
      assert.strictEqual(data.error.message, 'Invalid email/phone or password.');
      assert.strictEqual(data.message, 'Invalid email/phone or password.');
    });

    test('2.7 Existing email + wrong password returns 401 with identical generic error', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: customerEmail,
          password: 'WrongPasswordGiven!'
        })
      });

      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_CREDENTIALS');
      assert.strictEqual(data.error.message, 'Invalid email/phone or password.');
      assert.strictEqual(data.message, 'Invalid email/phone or password.');
    });

    test('2.8 Existing phone + wrong password returns 401 with identical generic error', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: customerPhoneRaw,
          password: 'WrongPasswordGiven!'
        })
      });

      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_CREDENTIALS');
      assert.strictEqual(data.error.message, 'Invalid email/phone or password.');
      assert.strictEqual(data.message, 'Invalid email/phone or password.');
    });

    test('2.9 Driver login with non-existent identifier returns 401 with generic error', async () => {
      const res = await fetch(`${baseUrl}/api/auth/driver-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: '9999000011',
          password: 'AnyPassword123!'
        })
      });

      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_CREDENTIALS');
      assert.strictEqual(data.error.message, 'Invalid email/phone or password.');
    });

    test('2.10 Driver login with wrong password returns 401 with generic error', async () => {
      const res = await fetch(`${baseUrl}/api/auth/driver-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: driverPhoneRaw,
          password: 'WrongDriverPassword!'
        })
      });

      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_CREDENTIALS');
      assert.strictEqual(data.error.message, 'Invalid email/phone or password.');
    });

    test('2.11 Empty identifier returns 400 validation error', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: '  ',
          password: customerPassword
        })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_INPUT');
    });

    test('2.12 Empty password returns 400 validation error', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: customerEmail,
          password: ''
        })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_INPUT');
    });
  });

  // =========================================================================
  // 3. ROLE ISOLATION & AUTHORIZATION ENFORCEMENT
  // =========================================================================
  describe('3. Role Isolation & Endpoint Authorization', () => {
    let customerToken;
    let driverToken;

    before(async () => {
      const cRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: customerEmail, password: customerPassword })
      });
      const cData = await cRes.json();
      customerToken = cData.data.token;

      const dRes = await fetch(`${baseUrl}/api/auth/driver-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: driverPhoneRaw, password: driverPassword })
      });
      const dData = await dRes.json();
      driverToken = dData.data.token;
    });

    test('3.1 Customer credentials cannot log in to driver portal (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/driver-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: customerEmail,
          password: customerPassword
        })
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INSUFFICIENT_PRIVILEGES');
    });

    test('3.2 Customer credentials cannot log in to admin portal (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: customerEmail,
          password: customerPassword
        })
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INSUFFICIENT_PRIVILEGES');
    });

    test('3.3 Driver credentials cannot log in to admin portal (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: driverEmail,
          password: driverPassword
        })
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INSUFFICIENT_PRIVILEGES');
    });

    test('3.4 Customer token cannot access driver duties endpoint (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/duties`, {
        headers: { 'Authorization': `Bearer ${customerToken}` }
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('3.5 Customer token cannot access admin metrics endpoint (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/metrics`, {
        headers: { 'Authorization': `Bearer ${customerToken}` }
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('3.6 Driver token cannot access admin metrics endpoint (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/metrics`, {
        headers: { 'Authorization': `Bearer ${driverToken}` }
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('3.7 Unauthenticated request to /api/auth/me returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'UNAUTHORIZED');
    });

    test('3.8 Failed login does not issue cookie or JWT token', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: customerEmail,
          password: 'IncorrectPasswordAttempt'
        })
      });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.headers.get('set-cookie'), null);
      const data = await res.json();
      assert.strictEqual(data.data, undefined);
    });
  });
});
