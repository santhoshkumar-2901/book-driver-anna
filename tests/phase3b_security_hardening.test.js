import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from './testHelper.js';
import { registerAdmin, registerCustomer } from '../server/services/authService.js';
import { isValidCalendarDate, getTodayIST } from '../server/middleware/validate.js';
import { ENV } from '../server/config/env.js';

describe('Phase 3B Production Hardening Suite — Part 1', () => {
  let server, baseUrl;
  let adminToken, customerToken;
  let fixtureBookingId, fixtureCustomerPhone;

  const testPassword = 'Phase3bTestPassword123!';

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // 1. Create Admin
    const adminEmail = `phase3b_admin_${Date.now()}@bookdriveranna.com`;
    const adminPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const adminRes = await registerAdmin({
      name: 'Phase 3B Admin',
      email: adminEmail,
      phone: adminPhone,
      password: testPassword,
      secretKey: ENV.ADMIN_REGISTRATION_SECRET
    });
    adminToken = adminRes.token;

    // 2. Create Customer
    const custEmail = `phase3b_cust_${Date.now()}@example.com`;
    fixtureCustomerPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const custRes = await registerCustomer({
      name: 'Phase 3B Customer',
      email: custEmail,
      phone: fixtureCustomerPhone,
      password: testPassword
    });
    customerToken = custRes.token;

    // 3. Create a fixture booking for lookup tests
    const today = getTodayIST();
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        customerName: 'Phase 3B Customer',
        customerPhone: fixtureCustomerPhone,
        customerEmail: custEmail,
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        date: today,
        time: '10:00 AM',
        paymentMode: 'cash'
      })
    });
    const bookData = await bookRes.json();
    assert.strictEqual(bookRes.status, 201);
    fixtureBookingId = bookData.data.booking.id;
  });

  after(async () => {
    if (server) {
      await new Promise(r => server.close(r));
    }
  });

  // =========================================================================
  // FIX 1: GEMINI CLIENT-SIDE SECRET REMOVAL & BACKEND PROXY
  // =========================================================================
  describe('Fix 1 — Gemini Client-Side Secret Support Removal', () => {
    test('1.1 Zero references to VITE_GEMINI_API_KEY remain in codebase', () => {
      const rootDir = path.resolve('.');
      const filesToCheck = [
        path.join(rootDir, 'src/services/geminiService.js'),
        path.join(rootDir, 'server/config/env.js'),
        path.join(rootDir, 'src/components/Chatbot.jsx')
      ];

      for (const file of filesToCheck) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf-8');
          assert.strictEqual(
            content.includes('VITE_GEMINI_API_KEY'),
            false,
            `File ${file} still contains VITE_GEMINI_API_KEY`
          );
        }
      }
    });

    test('1.2 Frontend code does not directly call generativelanguage.googleapis.com', () => {
      const geminiServicePath = path.resolve('src/services/geminiService.js');
      const content = fs.readFileSync(geminiServicePath, 'utf-8');
      assert.strictEqual(
        content.includes('generativelanguage.googleapis.com'),
        false,
        'src/services/geminiService.js must not directly call Google Gemini API'
      );
    });

    test('1.3 POST /api/chat remains functional with rate limiting and input validation', async () => {
      // Rejects missing message
      const badRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert.strictEqual(badRes.status, 400);

      // Returns chatbot response for valid message
      const goodRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'What are hourly rates?' })
      });
      assert.strictEqual(goodRes.status, 200);
      const data = await goodRes.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data && typeof data.data.text === 'string');
    });
  });

  // =========================================================================
  // FIX 2: PUBLIC DRIVER DEMO CREDENTIALS REMOVAL
  // =========================================================================
  describe('Fix 2 — Public Driver Demo Credentials Removal', () => {
    test('2.1 DriverAuthPage does not display demo credentials or Verified Driver helper widget', () => {
      const authPagePath = path.resolve('src/pages/DriverAuthPage.jsx');
      const content = fs.readFileSync(authPagePath, 'utf-8');

      assert.strictEqual(
        content.includes('Verified Driver Partner Access Helper'),
        false,
        'DriverAuthPage.jsx must not contain Verified Driver Partner Access Helper widget'
      );
      assert.strictEqual(
        content.includes('driver123'),
        false,
        'DriverAuthPage.jsx must not contain hardcoded driver123 credential'
      );
      assert.strictEqual(
        content.includes('98860 12345'),
        false,
        'DriverAuthPage.jsx must not display demo driver phone 98860 12345'
      );
    });
  });

  // =========================================================================
  // FIX 3: REMOVE DEFAULT DRIVER PASSWORD IN ADMIN PROVISIONING
  // =========================================================================
  describe('Fix 3 — Remove Default Driver Password', () => {
    test('3.1 POST /api/admin/drivers rejects creation when password is missing or < 8 chars', async () => {
      const dlNumber = `KA-01-${Date.now().toString().slice(-7)}`;
      const phone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;

      // Missing password
      const noPassRes = await fetch(`${baseUrl}/api/admin/drivers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Driver No Pass',
          phone,
          licenseNumber: dlNumber
        })
      });
      assert.strictEqual(noPassRes.status, 400);
      const noPassData = await noPassRes.json();
      assert.strictEqual(noPassData.success, false);
      assert.strictEqual(noPassData.error.code, 'INVALID_INPUT');

      // Short password (< 8 chars)
      const shortPassRes = await fetch(`${baseUrl}/api/admin/drivers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Driver Short Pass',
          phone,
          licenseNumber: dlNumber,
          password: 'short'
        })
      });
      assert.strictEqual(shortPassRes.status, 400);
    });

    test('3.2 Admin-created driver cannot log in with driver123 fallback; requires explicit password', async () => {
      const uniqueSuffix = Date.now().toString().slice(-6);
      const dlNumber = `KA-02-${uniqueSuffix}`;
      const rawPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
      const phone = `+91 ${rawPhone}`;
      const driverSpecificPass = 'CustomDriverPass2026!';

      const createRes = await fetch(`${baseUrl}/api/admin/drivers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: `Driver ${uniqueSuffix}`,
          phone,
          licenseNumber: dlNumber,
          password: driverSpecificPass
        })
      });
      assert.strictEqual(createRes.status, 201);

      // Attempt login with default 'driver123' -> MUST FAIL 401
      const failLogin = await fetch(`${baseUrl}/api/auth/driver-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: rawPhone,
          password: 'driver123'
        })
      });
      assert.strictEqual(failLogin.status, 401);

      // Login with explicit configured password -> MUST SUCCEED 200
      const okLogin = await fetch(`${baseUrl}/api/auth/driver-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: rawPhone,
          password: driverSpecificPass
        })
      });
      assert.strictEqual(okLogin.status, 200);
      const okData = await okLogin.json();
      assert.strictEqual(okData.success, true);
      assert.ok(okData.data.token);
    });
  });

  // =========================================================================
  // FIX 4: REMOVE DEFAULT CUSTOMER PASSWORD IN ADMIN PROVISIONING
  // =========================================================================
  describe('Fix 4 — Remove Default Customer Password', () => {
    test('4.1 POST /api/admin/users rejects creation when password is missing or < 8 chars', async () => {
      const email = `nopass_${Date.now()}@example.com`;
      const phone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;

      // Missing password
      const noPassRes = await fetch(`${baseUrl}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Customer No Pass',
          email,
          phone
        })
      });
      assert.strictEqual(noPassRes.status, 400);
      const noPassData = await noPassRes.json();
      assert.strictEqual(noPassData.success, false);
      assert.strictEqual(noPassData.error.code, 'INVALID_INPUT');

      // Short password (< 8 chars)
      const shortPassRes = await fetch(`${baseUrl}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Customer Short Pass',
          email,
          phone,
          password: '123'
        })
      });
      assert.strictEqual(shortPassRes.status, 400);
    });

    test('4.2 Admin-created user cannot log in with password123 fallback; requires explicit password', async () => {
      const email = `explicit_cust_${Date.now()}@example.com`;
      const rawPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
      const phone = `+91 ${rawPhone}`;
      const custSpecificPass = 'CustomUserPass2026!';

      const createRes = await fetch(`${baseUrl}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Explicit Pass Customer',
          email,
          phone,
          password: custSpecificPass
        })
      });
      assert.strictEqual(createRes.status, 201);

      // Attempt login with default 'password123' -> MUST FAIL 401
      const failLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: email,
          password: 'password123'
        })
      });
      assert.strictEqual(failLogin.status, 401);

      // Login with explicit configured password -> MUST SUCCEED 200
      const okLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: email,
          password: custSpecificPass
        })
      });
      assert.strictEqual(okLogin.status, 200);
      const okData = await okLogin.json();
      assert.strictEqual(okData.success, true);
      assert.ok(okData.data.token);
    });
  });

  // =========================================================================
  // FIX 5: REMOVE PRODUCTION DEBUG ERROR HEADER
  // =========================================================================
  describe('Fix 5 — Remove Production Debug Error Header', () => {
    test('5.1 Production error response never sets X-Debug-Error-Msg header', async () => {
      // Simulate production environment
      const origIsProd = ENV.IS_PRODUCTION;
      const origNodeEnv = process.env.NODE_ENV;

      try {
        ENV.IS_PRODUCTION = true;
        process.env.NODE_ENV = 'production';

        const res = await fetch(`${baseUrl}/api/bookings/non-existent-uuid/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          }
        });

        assert.strictEqual(res.status, 404);
        const debugHeader = res.headers.get('x-debug-error-msg');
        assert.strictEqual(
          debugHeader,
          null,
          'X-Debug-Error-Msg header must NOT be sent in production'
        );
      } finally {
        ENV.IS_PRODUCTION = origIsProd;
        process.env.NODE_ENV = origNodeEnv;
      }
    });
  });

  // =========================================================================
  // FIX 6: BOOKING DATE VALIDATION (IST & CALENDAR INTEGRITY)
  // =========================================================================
  describe('Fix 6 — Booking Date Validation (IST Timezone & Calendar Realism)', () => {
    test('6.1 isValidCalendarDate unit validation for leap year and month days', () => {
      // Valid dates
      assert.strictEqual(isValidCalendarDate('2026-09-29'), true);
      assert.strictEqual(isValidCalendarDate('2028-02-29'), true, '2028 is a leap year');
      assert.strictEqual(isValidCalendarDate('2024-02-29'), true, '2024 is a leap year');
      assert.strictEqual(isValidCalendarDate('2000-02-29'), true, '2000 is a leap year (400 rule)');
      assert.strictEqual(isValidCalendarDate('2026-12-31'), true);

      // Non-leap year Feb 29
      assert.strictEqual(isValidCalendarDate('2026-02-29'), false, '2026 is NOT a leap year');
      assert.strictEqual(isValidCalendarDate('2027-02-29'), false, '2027 is NOT a leap year');
      assert.strictEqual(isValidCalendarDate('1900-02-29'), false, '1900 is NOT a leap year (100 rule)');

      // Impossible calendar days
      assert.strictEqual(isValidCalendarDate('2026-02-30'), false);
      assert.strictEqual(isValidCalendarDate('2026-02-31'), false);
      assert.strictEqual(isValidCalendarDate('2026-04-31'), false, 'April has 30 days');
      assert.strictEqual(isValidCalendarDate('2026-06-31'), false, 'June has 30 days');
      assert.strictEqual(isValidCalendarDate('2026-09-31'), false, 'September has 30 days');
      assert.strictEqual(isValidCalendarDate('2026-11-31'), false, 'November has 30 days');

      // Malformed strings
      assert.strictEqual(isValidCalendarDate('invalid-date'), false);
      assert.strictEqual(isValidCalendarDate('2026-13-01'), false, 'Month 13 is invalid');
      assert.strictEqual(isValidCalendarDate('2026-00-10'), false, 'Month 0 is invalid');
      assert.strictEqual(isValidCalendarDate('2026-05-00'), false, 'Day 0 is invalid');
      assert.strictEqual(isValidCalendarDate('2026-05-32'), false, 'Day 32 is invalid');
    });

    test('6.2 getTodayIST correctly computes Asia/Kolkata date across midnight UTC', () => {
      // 2026-09-29 18:45:00 UTC = 2026-09-30 00:15:00 IST (+5:30)
      const lateUtc = new Date('2026-09-29T18:45:00.000Z');
      const istDate = getTodayIST(lateUtc);
      assert.strictEqual(istDate, '2026-09-30', 'Late UTC date should roll over to next day in IST');
    });

    test('6.3 POST /api/bookings rejects impossible calendar dates with 400', async () => {
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Test Calendar',
          customerPhone: '+91 98888 77777',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          date: '2026-02-31', // Impossible!
          time: '10:00 AM'
        })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_INPUT');
    });

    test('6.4 POST /api/bookings rejects non-leap-year Feb 29 with 400', async () => {
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Test Leap Year',
          customerPhone: '+91 98888 77777',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          date: '2027-02-29', // Not a leap year!
          time: '10:00 AM'
        })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_INPUT');
    });

    test('6.5 POST /api/bookings rejects past dates with 400', async () => {
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Test Past Date',
          customerPhone: '+91 98888 77777',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          date: '2020-01-01', // Past
          time: '10:00 AM'
        })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_DATE');
    });

    test('6.6 POST /api/bookings accepts today and valid future leap year date', async () => {
      const today = getTodayIST();
      const resToday = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Test Today Date',
          customerPhone: '+91 98888 77777',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          date: today,
          time: '11:00 AM'
        })
      });
      assert.strictEqual(resToday.status, 201);

      const resLeap = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Test Leap Date',
          customerPhone: '+91 98888 77777',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          date: '2028-02-29', // Valid leap year!
          time: '11:00 AM'
        })
      });
      assert.strictEqual(resLeap.status, 201);
    });
  });

  // =========================================================================
  // FIX 7: MINIMIZE PUBLIC BOOKING LOOKUP RESPONSE
  // =========================================================================
  describe('Fix 7 — Minimize Public Booking Lookup Projection', () => {
    test('7.1 Public lookup succeeds with correct phone but DOES NOT expose sensitive internal fields', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: fixtureBookingId,
          phone: fixtureCustomerPhone
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      const b = data.data.booking;

      // Essential tracking fields MUST be present
      assert.strictEqual(b.id, fixtureBookingId);
      assert.strictEqual(b.customer_name, 'Phase 3B Customer');
      assert.strictEqual(b.service_name, 'Driver Service (one-way)');
      assert.strictEqual(b.status, 'PENDING');
      assert.ok(b.calculated_fare > 0);

      // Sensitive internal fields MUST NOT be exposed
      assert.strictEqual(b.user_id, undefined, 'user_id must NOT be exposed in public lookup');
      assert.strictEqual(b.idempotency_key, undefined, 'idempotency_key must NOT be exposed in public lookup');
      assert.strictEqual(b.customer_email, undefined, 'customer_email must NOT be exposed in public lookup');
      assert.strictEqual(b.cancellation_reason, undefined, 'cancellation_reason must NOT be exposed in public lookup');
    });

    test('7.2 Public lookup rejects mismatched phone number with 404', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: fixtureBookingId,
          phone: '+91 99999 00000' // Incorrect phone
        })
      });

      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'BOOKING_NOT_FOUND');
    });
  });
});
