import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from './testHelper.js';
import { registerCustomer, registerDriver, registerAdmin } from '../server/services/authService.js';
import { queryOne, queryAll, execute, withTransaction } from '../server/db/database.js';
import { resetServicePricing, updateServicePricing } from '../server/services/pricingService.js';
import { ENV } from '../server/config/env.js';

describe('Phase 3A Security & Business-Logic Hardening Suite', () => {
  let server, baseUrl;
  let adminToken, customerToken, driverToken;
  let customerUser, driverUser;
  let driverRecord;

  const testPassword = 'Phase3aTestPassword123!';

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // 1. Create Admin
    const adminEmail = `phase3a_admin_${Date.now()}@bookdriveranna.com`;
    const adminPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const adminRes = await registerAdmin({
      name: 'Phase 3A Admin',
      email: adminEmail,
      phone: adminPhone,
      password: testPassword,
      secretKey: ENV.ADMIN_REGISTRATION_SECRET
    });
    adminToken = adminRes.token;

    // 2. Create Customer
    const custEmail = `phase3a_cust_${Date.now()}@example.com`;
    const custPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const custRes = await registerCustomer({
      name: 'Customer Phase3',
      email: custEmail,
      phone: custPhone,
      password: testPassword
    });
    customerUser = custRes.user;
    customerToken = custRes.token;

    // 3. Create Driver
    const drvPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const dlNumber = `KA-03-${Date.now().toString().slice(-7)}`;
    const drvRes = await registerDriver({
      name: 'Driver Phase3',
      phone: drvPhone,
      dlNumber,
      password: testPassword,
      area: 'Koramangala',
      upiId: 'phase3.driver@okaxis'
    });
    driverUser = drvRes.user;
    driverToken = drvRes.token;
    driverRecord = await queryOne('SELECT * FROM drivers WHERE user_id = ?', [driverUser.id]);
  });

  after(async () => {
    if (server && server.close) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  // --------------------------------------------------------------------------
  // 1. Booking State Machine & Atomic Completion / Cancellation
  // --------------------------------------------------------------------------
  test('1.1 POST /api/bookings/:id/complete rejects PENDING booking with 400', async () => {
    // Create fresh PENDING booking
    const bookingRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        customerName: customerUser.name,
        customerPhone: customerUser.phone,
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: '10:00 AM'
      })
    });
    const { data: { booking } } = await bookingRes.json();
    assert.strictEqual(booking.status, 'PENDING');

    // Attempt completion by admin
    const completeRes = await fetch(`${baseUrl}/api/bookings/${booking.id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });

    assert.strictEqual(completeRes.status, 400, 'Completing PENDING booking must return 400');
    const body = await completeRes.json();
    assert.strictEqual(body.error.code, 'INVALID_STATE_TRANSITION');
  });

  test('1.2 POST /api/bookings/:id/complete rejects CANCELLED booking with 400', async () => {
    // Create and cancel booking
    const bookingRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        customerName: customerUser.name,
        customerPhone: customerUser.phone,
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: '11:00 AM'
      })
    });
    const { data: { booking } } = await bookingRes.json();

    await fetch(`${baseUrl}/api/bookings/${booking.id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({ reason: 'Test cancellation' })
    });

    const cancelled = await queryOne('SELECT status FROM bookings WHERE id = ?', [booking.id]);
    assert.strictEqual(cancelled.status, 'CANCELLED');

    // Attempt complete
    const completeRes = await fetch(`${baseUrl}/api/bookings/${booking.id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });

    assert.strictEqual(completeRes.status, 400, 'Completing CANCELLED booking must return 400');
  });

  test('1.3 POST /api/bookings/:id/complete rejects already COMPLETED booking with 400', async () => {
    // Create booking and set to CONFIRMED
    const bookingRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        customerName: customerUser.name,
        customerPhone: customerUser.phone,
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: '12:00 PM'
      })
    });
    const { data: { booking } } = await bookingRes.json();

    await execute("UPDATE bookings SET status = 'CONFIRMED' WHERE id = ?", [booking.id]);

    // First completion succeeds
    const firstRes = await fetch(`${baseUrl}/api/bookings/${booking.id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    assert.strictEqual(firstRes.status, 200);

    // Second completion on already COMPLETED booking must be rejected
    const repeatRes = await fetch(`${baseUrl}/api/bookings/${booking.id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    assert.strictEqual(repeatRes.status, 400, 'Repeated completion must return 400');
    const body = await repeatRes.json();
    assert.strictEqual(body.error.code, 'INVALID_STATE_TRANSITION');
  });

  test('1.4 POST /api/bookings/:id/complete allows legitimate completion from CONFIRMED and ASSIGNED', async () => {
    // Booking 1: CONFIRMED -> COMPLETED
    const b1 = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customerToken}` },
      body: JSON.stringify({
        customerName: customerUser.name,
        customerPhone: customerUser.phone,
        bookingCategory: 'driver',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: '01:00 PM'
      })
    });
    const { data: { booking: booking1 } } = await b1.json();
    await execute("UPDATE bookings SET status = 'CONFIRMED' WHERE id = ?", [booking1.id]);

    const comp1 = await fetch(`${baseUrl}/api/bookings/${booking1.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ paymentMode: 'upi' })
    });
    assert.strictEqual(comp1.status, 200);
    const row1 = await queryOne('SELECT status, payment_mode FROM bookings WHERE id = ?', [booking1.id]);
    assert.strictEqual(row1.status, 'COMPLETED');
    assert.strictEqual(row1.payment_mode, 'upi');
  });

  test('1.5 POST /api/bookings/:id/cancel rejects IN_PROGRESS booking with 400', async () => {
    const bookingRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customerToken}` },
      body: JSON.stringify({
        customerName: customerUser.name,
        customerPhone: customerUser.phone,
        bookingCategory: 'driver',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: '02:00 PM'
      })
    });
    const { data: { booking } } = await bookingRes.json();
    await execute("UPDATE bookings SET status = 'IN_PROGRESS' WHERE id = ?", [booking.id]);

    const cancelRes = await fetch(`${baseUrl}/api/bookings/${booking.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customerToken}` },
      body: JSON.stringify({ reason: 'Trip in progress cancel attempt' })
    });

    assert.strictEqual(cancelRes.status, 400, 'Cancelling IN_PROGRESS booking must return 400');
    const body = await cancelRes.json();
    assert.strictEqual(body.error.code, 'INVALID_STATE_TRANSITION');
  });

  test('1.6 PATCH /api/admin/bookings/:id rejects assigning driver to COMPLETED or CANCELLED bookings', async () => {
    // Setup 1 COMPLETED and 1 CANCELLED booking
    const b1 = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customerToken}` },
      body: JSON.stringify({
        customerName: customerUser.name,
        customerPhone: customerUser.phone,
        bookingCategory: 'driver',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: '03:00 PM'
      })
    });
    const { data: { booking } } = await b1.json();
    await execute("UPDATE bookings SET status = 'COMPLETED' WHERE id = ?", [booking.id]);

    // Admin attempts to reassign driver on COMPLETED booking
    const patchRes = await fetch(`${baseUrl}/api/admin/bookings/${booking.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ assignedDriverId: driverRecord.id })
    });

    assert.strictEqual(patchRes.status, 400, 'Assigning driver to COMPLETED booking must return 400');
    const row = await queryOne('SELECT status FROM bookings WHERE id = ?', [booking.id]);
    assert.strictEqual(row.status, 'COMPLETED', 'Status must not be mutated');
  });

  test('1.7 PATCH /api/drivers/duties/:id/status rejects driver transitioning to PENDING or COMPLETED', async () => {
    // Create booking and assign to driver
    const b = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customerToken}` },
      body: JSON.stringify({
        customerName: customerUser.name,
        customerPhone: customerUser.phone,
        bookingCategory: 'driver',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: '04:00 PM'
      })
    });
    const { data: { booking } } = await b.json();
    await execute("UPDATE bookings SET assigned_driver_id = ?, status = 'ASSIGNED' WHERE id = ?", [driverRecord.id, booking.id]);

    // Driver attempts to revert to PENDING
    const pendRes = await fetch(`${baseUrl}/api/drivers/duties/${booking.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${driverToken}` },
      body: JSON.stringify({ status: 'PENDING' })
    });
    assert.strictEqual(pendRes.status, 400, 'Reverting to PENDING must be rejected');

    // Driver attempts to set COMPLETED directly via duties status
    const compRes = await fetch(`${baseUrl}/api/drivers/duties/${booking.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${driverToken}` },
      body: JSON.stringify({ status: 'COMPLETED' })
    });
    assert.strictEqual(compRes.status, 400, 'Direct completion via duties status must be rejected');
  });

  // --------------------------------------------------------------------------
  // 2. Preferred Driver Validation
  // --------------------------------------------------------------------------
  test('2.1 Preferred driver validation rejects nonexistent driver with 400', async () => {
    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customerToken}` },
      body: JSON.stringify({
        customerName: customerUser.name,
        customerPhone: customerUser.phone,
        bookingCategory: 'driver',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: '05:00 PM',
        preferredDriverId: 'DRV-NONEXISTENT'
      })
    });

    assert.strictEqual(res.status, 400, 'Nonexistent preferred driver must return 400');
    const body = await res.json();
    assert.strictEqual(body.error.code, 'DRIVER_NOT_FOUND');
  });

  test('2.2 Preferred driver validation rejects inactive or suspended driver with 400', async () => {
    // Create inactive driver
    const inactivePhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const dlNumber = `KA-05-${Date.now().toString().slice(-7)}`;
    const regRes = await registerDriver({
      name: 'Suspended Driver',
      phone: inactivePhone,
      dlNumber,
      password: testPassword,
      area: 'HSR'
    });
    const inactiveDrv = await queryOne('SELECT id FROM drivers WHERE user_id = ?', [regRes.user.id]);
    await execute("UPDATE drivers SET status = 'Suspended' WHERE id = ?", [inactiveDrv.id]);

    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customerToken}` },
      body: JSON.stringify({
        customerName: customerUser.name,
        customerPhone: customerUser.phone,
        bookingCategory: 'driver',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: '06:00 PM',
        preferredDriverId: inactiveDrv.id
      })
    });

    assert.strictEqual(res.status, 400, 'Suspended preferred driver must return 400');
    const body = await res.json();
    assert.strictEqual(body.error.code, 'DRIVER_NOT_ACTIVE');
  });

  // --------------------------------------------------------------------------
  // 3. Production Clear-Data Protection
  // --------------------------------------------------------------------------
  test('3.1 POST /api/admin/system/clear-data returns 403 when IS_PRODUCTION is true', async () => {
    const origProd = ENV.IS_PRODUCTION;
    try {
      ENV.IS_PRODUCTION = true;

      const res = await fetch(`${baseUrl}/api/admin/system/clear-data`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      assert.strictEqual(res.status, 403, 'Production clear-data must return 403');
      const body = await res.json();
      assert.strictEqual(body.error.code, 'FORBIDDEN');
    } finally {
      ENV.IS_PRODUCTION = origProd;
    }
  });

  test('3.2 In development/test mode, clear-data does NOT delete audit logs', async () => {
    // Record test audit log
    await execute(`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
      VALUES (?, 'TEST_PRE_CLEAR', 'test', '123', 'pre-clear log')
    `, [adminToken]);

    const res = await fetch(`${baseUrl}/api/admin/system/clear-data`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);

    const logs = await queryAll("SELECT * FROM audit_logs WHERE action = 'TEST_PRE_CLEAR'");
    assert.ok(logs.length > 0, 'Audit logs must remain preserved after clear-data');
  });

  // --------------------------------------------------------------------------
  // 4. Pricing Numeric Validation & TiDB Syntax Compatibility
  // --------------------------------------------------------------------------
  test('4.1 updateServicePricing rejects NaN, Infinity, -Infinity, and negative numbers with 400', async () => {
    await assert.rejects(async () => {
      await updateServicePricing([{ id: 'driver_hourly_2hr', price: Infinity }]);
    }, (err) => err.statusCode === 400, 'Infinity must be rejected');

    await assert.rejects(async () => {
      await updateServicePricing([{ id: 'driver_hourly_2hr', price: -100 }]);
    }, (err) => err.statusCode === 400, 'Negative price must be rejected');

    await assert.rejects(async () => {
      await updateServicePricing([{ id: 'driver_hourly_2hr', price: NaN }]);
    }, (err) => err.statusCode === 400, 'NaN must be rejected');

    await assert.rejects(async () => {
      await updateServicePricing([{ id: 'driver_hourly_2hr', price: -Infinity }]);
    }, (err) => err.statusCode === 400, '-Infinity must be rejected');
  });

  test('4.2 resetServicePricing executes valid SQL and restores defaults without syntax error', async () => {
    const pricing = await resetServicePricing();
    assert.ok(pricing.list.length > 0, 'Must successfully return default pricing items');
    const hourly2hr = pricing.map['driver_hourly_2hr'];
    assert.strictEqual(hourly2hr.price, 199, 'Hourly 2hr must be restored to default 199');
  });

  // --------------------------------------------------------------------------
  // 5. Atomic Driver Registration
  // --------------------------------------------------------------------------
  test('5.1 registerDriver rolls back users table insertion if driver table insertion fails', async () => {
    const uniquePhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const dlNumber = `KA-06-${Date.now().toString().slice(-7)}`;

    // Create existing driver with identical license_number to force unique constraint failure on drivers table
    await registerDriver({
      name: 'Existing Driver',
      phone: uniquePhone,
      dlNumber,
      password: testPassword,
      area: 'Indiranagar'
    });

    const secondPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const secondEmail = `atomic_test_${Date.now()}@driveranna.com`;

    // Try registering with same DL number but different phone/email:
    // User check passes, but drivers table INSERT fails on duplicate DL.
    await assert.rejects(async () => {
      await registerDriver({
        name: 'Failing Driver',
        phone: secondPhone,
        dlNumber, // Duplicate DL triggers 409 or constraint error
        password: testPassword,
        customEmail: secondEmail,
        area: 'Indiranagar'
      });
    });

    // Verify secondEmail was NOT orphaned in the users table
    const orphanedUser = await queryOne('SELECT * FROM users WHERE email = ?', [secondEmail]);
    assert.strictEqual(orphanedUser, null, 'Orphaned user must not exist after registration failure');
  });

  // --------------------------------------------------------------------------
  // 6. Rate Limiting Protection on Routes and Aliases
  // --------------------------------------------------------------------------
  test('6.1 Alias paths and chat/lookup endpoints enforce rate limiting when enabled', async () => {
    // Test that x-test-rate-limit triggers 429 when max is exceeded on chat
    const chatResults = [];
    for (let i = 0; i < 22; i++) {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-rate-limit': 'true'
        },
        body: JSON.stringify({ message: 'Hello AI' })
      });
      chatResults.push(res.status);
    }

    assert.ok(chatResults.includes(429), 'Chat endpoint must enforce rate limit (429)');

    // Test that lookup endpoint triggers 429 when max is exceeded
    const lookupResults = [];
    for (let i = 0; i < 22; i++) {
      const res = await fetch(`${baseUrl}/api/bookings/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-rate-limit': 'true'
        },
        body: JSON.stringify({ bookingId: 'BDA-DRV-NONEXIST', phone: '9999999999' })
      });
      lookupResults.push(res.status);
    }

    assert.ok(lookupResults.includes(429), 'Booking lookup endpoint must enforce rate limit (429)');
  });

  // --------------------------------------------------------------------------
  // 7. Schema Defaults Verification
  // --------------------------------------------------------------------------
  test('7.1 DDL files contain no hardcoded anna.driver@oksbi default', () => {
    const schemaSql = fs.readFileSync(path.resolve('server/db/schema.sql'), 'utf8');
    const schemaJs = fs.readFileSync(path.resolve('server/db/schema.js'), 'utf8');
    const databaseJs = fs.readFileSync(path.resolve('server/db/database.js'), 'utf8');

    assert.ok(!schemaSql.includes("DEFAULT 'anna.driver@oksbi'"), 'schema.sql must not contain anna.driver@oksbi default');
    assert.ok(!schemaJs.includes("DEFAULT 'anna.driver@oksbi'"), 'schema.js must not contain anna.driver@oksbi default');
    assert.ok(!databaseJs.includes("DEFAULT 'anna.driver@oksbi'"), 'database.js must not contain anna.driver@oksbi default');
  });

});
