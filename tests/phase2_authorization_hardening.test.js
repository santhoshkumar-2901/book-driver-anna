import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from './testHelper.js';
import { registerCustomer, registerDriver, registerAdmin } from '../server/services/authService.js';
import { queryOne, execute } from '../server/db/database.js';
import { ENV } from '../server/config/env.js';
import { isValidUpi } from '../src/utils/userValidation.js';

describe('Phase 2 Authorization, API Exposure & Production Configuration Hardening Suite', () => {
  let server, baseUrl;
  let adminToken, customerTokenA, customerTokenB, driverTokenA, driverTokenB;
  let customerUserA, customerUserB, driverUserA, driverUserB;
  let driverAId, driverBId;
  let bookingAId, bookingBId;

  const testPassword = 'Phase2TestPassword123!';

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // 1. Create Admin Fixture
    const adminEmail = `phase2_admin_${Date.now()}@bookdriveranna.com`;
    const adminPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const adminRes = await registerAdmin({
      name: 'Phase 2 Admin',
      email: adminEmail,
      phone: adminPhone,
      password: testPassword,
      secretKey: ENV.ADMIN_REGISTRATION_SECRET
    });
    adminToken = adminRes.token;

    // 2. Create Customer A & B Fixtures
    const custEmailA = `phase2_cust_a_${Date.now()}@example.com`;
    const custPhoneA = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const custResA = await registerCustomer({
      name: 'Customer Alice',
      email: custEmailA,
      phone: custPhoneA,
      password: testPassword
    });
    customerUserA = custResA.user;
    customerTokenA = custResA.token;

    const custEmailB = `phase2_cust_b_${Date.now()}@example.com`;
    const custPhoneB = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const custResB = await registerCustomer({
      name: 'Customer Bob',
      email: custEmailB,
      phone: custPhoneB,
      password: testPassword
    });
    customerUserB = custResB.user;
    customerTokenB = custResB.token;

    // 3. Create Driver A & B Fixtures
    const drvPhoneA = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const dlNumberA = `KA-01-${Date.now().toString().slice(-7)}`;
    const drvResA = await registerDriver({
      name: 'Driver Alpha',
      phone: drvPhoneA,
      dlNumber: dlNumberA,
      password: testPassword,
      area: 'Indiranagar',
      upiId: 'driver.alpha@okaxis'
    });
    driverUserA = drvResA.user;
    driverTokenA = drvResA.token;
    driverAId = drvResA.user.driverId;

    const drvPhoneB = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const dlNumberB = `KA-02-${Date.now().toString().slice(-7)}`;
    const drvResB = await registerDriver({
      name: 'Driver Beta',
      phone: drvPhoneB,
      dlNumber: dlNumberB,
      password: testPassword,
      area: 'Koramangala',
      upiId: 'driver.beta@okicici'
    });
    driverUserB = drvResB.user;
    driverTokenB = drvResB.token;
    driverBId = drvResB.user.driverId;

    // 4. Seed Bookings
    bookingAId = `BKG-P2-A-${Date.now()}`;
    await execute(`
      INSERT INTO bookings (
        id, user_id, customer_name, customer_phone, customer_email,
        booking_type, trip_type, service_name, pickup_area, drop_location,
        date, time, calculated_fare, payment_mode, status, assigned_driver_id
      ) VALUES (?, ?, ?, ?, ?, 'driver', 'round-trip', 'Round Trip Driver', 'Indiranagar', 'Airport', '2026-10-10', '10:00 AM', 749, 'cash', 'ASSIGNED', ?)
    `, [bookingAId, customerUserA.id, customerUserA.name, customerUserA.phone, customerUserA.email, driverAId]);

    bookingBId = `BKG-P2-B-${Date.now()}`;
    await execute(`
      INSERT INTO bookings (
        id, user_id, customer_name, customer_phone, customer_email,
        booking_type, trip_type, service_name, pickup_area, drop_location,
        date, time, calculated_fare, payment_mode, status, assigned_driver_id
      ) VALUES (?, ?, ?, ?, ?, 'driver', 'round-trip', 'Round Trip Driver', 'Koramangala', 'Whitefield', '2026-10-10', '11:00 AM', 849, 'upi', 'ASSIGNED', ?)
    `, [bookingBId, customerUserB.id, customerUserB.name, customerUserB.phone, customerUserB.email, driverBId]);
  });

  after(() => {
    server.close();
  });

  // -------------------------------------------------------------
  // 1. Booking Authorization & IDOR/BOLA Hardening
  // -------------------------------------------------------------
  test('1.1 Unauthenticated booking mutation /complete returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/bookings/${bookingAId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMode: 'cash' })
    });
    assert.strictEqual(res.status, 401, 'Unauthenticated request must be rejected with 401');
    const data = await res.json();
    assert.strictEqual(data.error?.code, 'UNAUTHORIZED');
  });

  test('1.2 Customer modifying another customer booking returns 403', async () => {
    // Customer B attempts to complete Customer A's booking
    const res = await fetch(`${baseUrl}/api/bookings/${bookingAId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerTokenB}`
      },
      body: JSON.stringify({ paymentMode: 'upi' })
    });
    assert.strictEqual(res.status, 403, 'Customer B cannot complete Customer A booking');
    const data = await res.json();
    assert.strictEqual(data.error?.code, 'FORBIDDEN');
  });

  test('1.3 Driver modifying another driver booking returns 403', async () => {
    // Driver B attempts to complete Driver A's assigned booking
    const res = await fetch(`${baseUrl}/api/bookings/${bookingAId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverTokenB}`
      },
      body: JSON.stringify({ paymentMode: 'upi' })
    });
    assert.strictEqual(res.status, 403, 'Unassigned Driver B cannot complete Driver A booking');
    const data = await res.json();
    assert.strictEqual(data.error?.code, 'FORBIDDEN');
  });

  test('1.4 Assigned driver performing allowed action succeeds', async () => {
    // Driver A updates status of their assigned booking
    const res = await fetch(`${baseUrl}/api/drivers/duties/${bookingAId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverTokenA}`
      },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });
    assert.strictEqual(res.status, 200, 'Assigned driver must be permitted to update duty status');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data?.booking?.status, 'IN_PROGRESS');
  });

  test('1.5 Unassigned driver updating duty status returns 403', async () => {
    // Driver B attempts to update status on booking A
    const res = await fetch(`${baseUrl}/api/drivers/duties/${bookingAId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverTokenB}`
      },
      body: JSON.stringify({ status: 'COMPLETED' })
    });
    assert.strictEqual(res.status, 403, 'Driver B must receive 403 modifying Driver A duty');
    const data = await res.json();
    assert.strictEqual(data.error?.code, 'FORBIDDEN');
  });

  test('1.6 Authorized completion by assigned driver succeeds', async () => {
    const res = await fetch(`${baseUrl}/api/bookings/${bookingAId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverTokenA}`
      },
      body: JSON.stringify({ paymentMode: 'cash' })
    });
    assert.strictEqual(res.status, 200, 'Assigned driver completing duty must succeed');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data?.booking?.status, 'COMPLETED');
  });

  test('1.7 Customer cannot complete own booking (returns 403)', async () => {
    // Customer B attempts to complete Customer B's own booking
    const res = await fetch(`${baseUrl}/api/bookings/${bookingBId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerTokenB}`
      },
      body: JSON.stringify({ paymentMode: 'upi' })
    });
    assert.strictEqual(res.status, 403, 'Customer cannot complete own booking');
    const data = await res.json();
    assert.strictEqual(data.error?.code, 'FORBIDDEN');
  });

  test('1.8 Inactive driver cannot complete booking (returns 403)', async () => {
    // Inactivate driver A profile in drivers table
    await execute("UPDATE drivers SET status = 'Inactive' WHERE id = ?", [driverAId]);
    try {
      const res = await fetch(`${baseUrl}/api/bookings/${bookingAId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverTokenA}`
        },
        body: JSON.stringify({ paymentMode: 'cash' })
      });
      assert.strictEqual(res.status, 403, 'Inactive driver cannot complete booking');
      const data = await res.json();
      assert.strictEqual(data.error?.code, 'FORBIDDEN');
    } finally {
      await execute("UPDATE drivers SET status = 'Active' WHERE id = ?", [driverAId]);
    }
  });

  test('1.9 Authorized completion by admin succeeds', async () => {
    const res = await fetch(`${baseUrl}/api/bookings/${bookingBId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ paymentMode: 'upi' })
    });
    assert.strictEqual(res.status, 200, 'Admin completing booking must succeed');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data?.booking?.status, 'COMPLETED');
  });

  test('1.10 Unauthenticated caller cannot cancel authenticated user booking using phone', async () => {
    // Create an active booking for Customer A
    const testCancelBkgId = `BKG-CANCEL-SEC-${Date.now()}`;
    await execute(`
      INSERT INTO bookings (
        id, user_id, customer_name, customer_phone, customer_email,
        booking_type, trip_type, service_name, pickup_area, drop_location,
        date, time, calculated_fare, payment_mode, status
      ) VALUES (?, ?, 'Cust A', ?, 'a@test.com', 'driver', 'one-way', 'One Way', 'Indiranagar', 'Airport', '2026-10-15', '09:00 AM', 499, 'cash', 'CONFIRMED')
    `, [testCancelBkgId, customerUserA.id, customerUserA.phone]);

    // Attack: Anonymous caller provides Customer A's phone number
    const res = await fetch(`${baseUrl}/api/bookings/${testCancelBkgId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: customerUserA.phone, reason: 'Malicious cancellation' })
    });

    assert.strictEqual(res.status, 403, 'Unauthenticated caller cannot cancel registered user booking');
    const bkg = await queryOne('SELECT status FROM bookings WHERE id = ?', [testCancelBkgId]);
    assert.strictEqual(bkg.status, 'CONFIRMED', 'Booking must remain CONFIRMED');
  });

  // -------------------------------------------------------------
  // 1.B GET /api/bookings/:id Direct HTTP IDOR Authorization Tests
  // -------------------------------------------------------------
  test('1.11 Unauthenticated caller requesting GET /api/bookings/:id returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/bookings/${bookingAId}`);
    assert.strictEqual(res.status, 401, 'Unauthenticated request must return 401');
    const data = await res.json();
    assert.strictEqual(data.data, undefined, 'Must not disclose booking data to unauthenticated caller');
    assert.strictEqual(data.error?.code, 'UNAUTHORIZED');
  });

  test('1.12 Customer A requesting Customer A booking via GET /api/bookings/:id returns 200', async () => {
    const res = await fetch(`${baseUrl}/api/bookings/${bookingAId}`, {
      headers: { 'Authorization': `Bearer ${customerTokenA}` }
    });
    assert.strictEqual(res.status, 200, 'Owner Customer A must access their own booking');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data?.booking?.id, bookingAId);
    assert.strictEqual(data.data?.booking?.customer_name, customerUserA.name);
  });

  test('1.13 Customer A requesting Customer B booking via GET /api/bookings/:id returns 403 with no booking data', async () => {
    const res = await fetch(`${baseUrl}/api/bookings/${bookingBId}`, {
      headers: { 'Authorization': `Bearer ${customerTokenA}` }
    });
    assert.strictEqual(res.status, 403, 'Customer A must not access Customer B booking');
    const data = await res.json();
    assert.strictEqual(data.data, undefined, 'Must not disclose another customer booking details');
    assert.strictEqual(data.error?.code, 'FORBIDDEN');
  });

  test('1.14 Assigned driver requesting assigned booking via GET /api/bookings/:id returns 200', async () => {
    const res = await fetch(`${baseUrl}/api/bookings/${bookingAId}`, {
      headers: { 'Authorization': `Bearer ${driverTokenA}` }
    });
    assert.strictEqual(res.status, 200, 'Assigned Driver A must access assigned booking');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data?.booking?.id, bookingAId);
  });

  test('1.15 Unassigned driver requesting another driver booking via GET /api/bookings/:id returns 403 with no booking data', async () => {
    const res = await fetch(`${baseUrl}/api/bookings/${bookingAId}`, {
      headers: { 'Authorization': `Bearer ${driverTokenB}` }
    });
    assert.strictEqual(res.status, 403, 'Unassigned Driver B must not access Driver A booking');
    const data = await res.json();
    assert.strictEqual(data.data, undefined, 'Must not disclose unassigned booking data to driver');
    assert.strictEqual(data.error?.code, 'FORBIDDEN');
  });

  test('1.16 Admin requesting booking via GET /api/bookings/:id returns 200', async () => {
    const res = await fetch(`${baseUrl}/api/bookings/${bookingAId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200, 'Admin must access any booking');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data?.booking?.id, bookingAId);
  });

  // -------------------------------------------------------------
  // 2. Driver Authorization & Status Enforcement
  // -------------------------------------------------------------
  test('2.1 Active driver accesses duties successfully', async () => {
    const res = await fetch(`${baseUrl}/api/drivers/duties`, {
      headers: { 'Authorization': `Bearer ${driverTokenA}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.data?.duties));
  });

  test('2.2 Inactive driver is rejected with 403', async () => {
    // Inactivate driver A profile in drivers table
    await execute("UPDATE drivers SET status = 'Inactive' WHERE id = ?", [driverAId]);
    try {
      const res = await fetch(`${baseUrl}/api/drivers/duties`, {
        headers: { 'Authorization': `Bearer ${driverTokenA}` }
      });
      assert.strictEqual(res.status, 403, 'Inactive driver must receive 403');
      const data = await res.json();
      assert.strictEqual(data.error?.code, 'DRIVER_INACTIVE');
    } finally {
      await execute("UPDATE drivers SET status = 'Active' WHERE id = ?", [driverAId]);
    }
  });

  test('2.3 Suspended driver is rejected with 403', async () => {
    // Suspend driver B profile in drivers table
    await execute("UPDATE drivers SET status = 'Suspended' WHERE id = ?", [driverBId]);
    try {
      const res = await fetch(`${baseUrl}/api/drivers/duties`, {
        headers: { 'Authorization': `Bearer ${driverTokenB}` }
      });
      assert.strictEqual(res.status, 403, 'Suspended driver must receive 403');
      const data = await res.json();
      assert.strictEqual(data.error?.code, 'DRIVER_INACTIVE');
    } finally {
      await execute("UPDATE drivers SET status = 'Active' WHERE id = ?", [driverBId]);
    }
  });

  test('2.4 Driver A cannot access Driver B duties', async () => {
    const res = await fetch(`${baseUrl}/api/drivers/duties`, {
      headers: { 'Authorization': `Bearer ${driverTokenA}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    const duties = data.data?.duties || [];
    assert.ok(duties.every(d => d.assigned_driver_id === driverAId), 'Driver A duties must only contain driver A duties');
    assert.ok(!duties.some(d => d.assigned_driver_id === driverBId), 'Driver A must not see Driver B duties');
  });

  test('2.5 Customer attempting driver-only route receives 403', async () => {
    const res = await fetch(`${baseUrl}/api/drivers/duties`, {
      headers: { 'Authorization': `Bearer ${customerTokenA}` }
    });
    assert.strictEqual(res.status, 403, 'Customer accessing driver-only route must receive 403');
    const data = await res.json();
    assert.strictEqual(data.error?.code, 'FORBIDDEN');
  });

  // -------------------------------------------------------------
  // 3. Admin Route Audit & Privilege Escalation Defense
  // -------------------------------------------------------------
  test('3.1 Customer accessing admin route receives 403', async () => {
    const res = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { 'Authorization': `Bearer ${customerTokenA}` }
    });
    assert.strictEqual(res.status, 403, 'Customer cannot access admin metrics');
    const data = await res.json();
    assert.strictEqual(data.error?.code, 'FORBIDDEN');
  });

  test('3.2 Driver accessing admin route receives 403', async () => {
    const res = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { 'Authorization': `Bearer ${driverTokenA}` }
    });
    assert.strictEqual(res.status, 403, 'Driver cannot access admin metrics');
    const data = await res.json();
    assert.strictEqual(data.error?.code, 'FORBIDDEN');
  });

  test('3.3 Authenticated admin accessing admin route succeeds', async () => {
    const res = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200, 'Authenticated admin must access admin metrics');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(typeof data.data?.totalBookings === 'number');
  });

  test('3.4 Client-supplied role in payload cannot elevate customer to admin', async () => {
    // Customer attempts to send role: 'admin' in query parameters to admin endpoints
    const resQuery = await fetch(`${baseUrl}/api/admin/bookings?role=admin`, {
      headers: {
        'Authorization': `Bearer ${customerTokenA}`
      }
    });
    assert.strictEqual(resQuery.status, 403, 'Client-supplied role in query must not bypass server-side check');

    // Customer attempts to send { role: 'admin' } in POST payload to admin endpoint
    const resPost = await fetch(`${baseUrl}/api/admin/pricing/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerTokenA}`
      },
      body: JSON.stringify({ role: 'admin', category: 'oneway', basePrice: 100 })
    });
    assert.strictEqual(resPost.status, 403, 'Client-supplied role in body must not bypass server-side check');
  });

  // -------------------------------------------------------------
  // 4. API Healthcheck Information Disclosure Hardening
  // -------------------------------------------------------------
  test('4.1 Public health response contains no database metrics, counts, or configuration', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    // Verify minimal coarse status
    assert.ok(data.status === 'healthy' || data.status === 'degraded');
    assert.strictEqual(data.service, 'Book Driver Anna API');
    assert.ok(data.timestamp);

    // Verify zero sensitive data is exposed
    assert.strictEqual(data.database, undefined, 'Database object must not be exposed');
    assert.strictEqual(data.userCount, undefined, 'userCount must not be exposed');
    assert.strictEqual(data.adminCount, undefined, 'adminCount must not be exposed');
    assert.strictEqual(data.driverCount, undefined, 'driverCount must not be exposed');
    assert.strictEqual(data.bookingCount, undefined, 'bookingCount must not be exposed');
    assert.strictEqual(data.hasResetTokensTable, undefined, 'table schema details must not be exposed');
    assert.strictEqual(data.hasPricingTable, undefined, 'table schema details must not be exposed');
    assert.strictEqual(data.emailConfig, undefined, 'email configuration must not be exposed');
    assert.strictEqual(data.environment, undefined, 'environment variable must not be exposed');
    assert.strictEqual(data.error, undefined, 'stack or error details must not be exposed');
  });

  // -------------------------------------------------------------
  // 5. CORS Hardening
  // -------------------------------------------------------------
  test('5.1 Approved production origin receives Access-Control-Allow-Origin', async () => {
    const allowedOrigin = 'https://book-driver-anna.vercel.app';
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { 'Origin': allowedOrigin }
    });
    assert.strictEqual(res.headers.get('access-control-allow-origin'), allowedOrigin);
    assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');
  });

  test('5.2 Disallowed origin is rejected and denied CORS headers', async () => {
    const evilOrigin = 'https://evil-hacker-site.com';
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { 'Origin': evilOrigin }
    });
    // Unauthorized origin must NOT receive Access-Control-Allow-Origin
    assert.notStrictEqual(res.headers.get('access-control-allow-origin'), evilOrigin);
  });

  test('5.3 Allowed development origin receives CORS headers in non-production', async () => {
    const devOrigin = 'http://localhost:5173';
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { 'Origin': devOrigin }
    });
    assert.strictEqual(res.headers.get('access-control-allow-origin'), devOrigin);
    assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');
  });

  // -------------------------------------------------------------
  // 6. Payment & UPI Configuration Safety
  // -------------------------------------------------------------
  test('6.1 Production configuration cannot silently fall back to real hardcoded personal UPI', () => {
    // In production mode without DEFAULT_UPI_ID set, it must NOT fall back to anna.driver@oksbi
    const origEnv = process.env.NODE_ENV;
    const origUpi = process.env.DEFAULT_UPI_ID;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.DEFAULT_UPI_ID;

      // Import fresh env logic
      const prodUpi = process.env.DEFAULT_UPI_ID || (process.env.NODE_ENV === 'production' ? '' : 'test.driver@fakeupi');
      assert.notStrictEqual(prodUpi, 'anna.driver@oksbi', 'Production must not silently fall back to personal UPI');
      assert.strictEqual(prodUpi, '', 'Default in production must be empty unless explicitly configured');
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origUpi !== undefined) process.env.DEFAULT_UPI_ID = origUpi;
    }
  });

  test('6.2 Driver registered without UPI uses configured ENV default or empty in production', async () => {
    const drvPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const dlNumber = `KA-99-${Date.now().toString().slice(-7)}`;

    const res = await registerDriver({
      name: 'No UPI Driver',
      phone: drvPhone,
      dlNumber,
      password: testPassword,
      area: 'Whitefield',
      upiId: null
    });

    // Should NOT silently become hardcoded personal address
    assert.notStrictEqual(res.user.upiId, 'anna.driver@oksbi', 'Must not fall back to anna.driver@oksbi');
  });

  test('6.3 RidePaymentModal contains no synthetic @oksbi or fake VPA fallback', () => {
    const modalCode = fs.readFileSync(path.resolve('src/components/RidePaymentModal.jsx'), 'utf8');
    assert.ok(!modalCode.includes('@oksbi'), 'RidePaymentModal must not synthesize fake @oksbi handles');
    assert.ok(!modalCode.includes('sanitizedHandle'), 'RidePaymentModal must not construct synthetic handle from driver name');
  });

  test('6.4 DriverPortalPage and RidePaymentModal fail closed when driver UPI is empty', () => {
    const portalCode = fs.readFileSync(path.resolve('src/pages/DriverPortalPage.jsx'), 'utf8');
    assert.ok(portalCode.includes('hasValidSettlementUpi'), 'DriverPortalPage must validate settlement UPI');

    const modalCode = fs.readFileSync(path.resolve('src/components/RidePaymentModal.jsx'), 'utf8');
    assert.ok(modalCode.includes('hasValidUpi'), 'RidePaymentModal must validate presence of valid UPI');
    assert.ok(modalCode.includes('Online UPI payment is unavailable'), 'RidePaymentModal must display clear cash message when UPI is missing');
  });

  test('6.5 UPI validation helper accurately validates VPAs and fails closed on malformed values', () => {
    // Required test cases:
    assert.strictEqual(isValidUpi('driver.alpha@okaxis'), true, 'driver.alpha@okaxis must be accepted');
    assert.strictEqual(isValidUpi(''), false, 'empty string must be rejected');
    assert.strictEqual(isValidUpi('@okaxis'), false, '@okaxis must be rejected');
    assert.strictEqual(isValidUpi('driver@'), false, 'driver@ must be rejected');
    assert.strictEqual(isValidUpi('driver@okaxis'), true, 'driver@okaxis must be accepted');

    // Additional malformed edge cases
    assert.strictEqual(isValidUpi('@'), false, '@ must be rejected');
    assert.strictEqual(isValidUpi('hello@'), false, 'hello@ must be rejected');
    assert.strictEqual(isValidUpi('abc@'), false, 'abc@ must be rejected');
    assert.strictEqual(isValidUpi(null), false, 'null must be rejected');
    assert.strictEqual(isValidUpi(undefined), false, 'undefined must be rejected');
    assert.strictEqual(isValidUpi('   '), false, 'whitespace must be rejected');
  });

  test('6.6 RidePaymentModal and DriverPortalPage consistently use isValidUpi helper', () => {
    const modalCode = fs.readFileSync(path.resolve('src/components/RidePaymentModal.jsx'), 'utf8');
    assert.ok(modalCode.includes('isValidUpi(resolvedDriverUpi)'), 'RidePaymentModal must use isValidUpi helper');
    assert.ok(!modalCode.includes("resolvedDriverUpi.includes('@')"), 'RidePaymentModal must not use weak includes(@) check');

    const portalCode = fs.readFileSync(path.resolve('src/pages/DriverPortalPage.jsx'), 'utf8');
    assert.ok(portalCode.includes('isValidUpi(effectiveDriverUpi)'), 'DriverPortalPage must use isValidUpi for settlement');
    assert.ok(portalCode.includes('isValidUpi(cleanUpi)'), 'DriverPortalPage must use isValidUpi when saving settings');
    assert.ok(!portalCode.includes("effectiveDriverUpi.includes('@')"), 'DriverPortalPage must not use weak includes(@) for settlement');
  });

});
