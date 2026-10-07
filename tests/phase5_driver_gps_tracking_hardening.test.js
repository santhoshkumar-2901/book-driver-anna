import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { startTestServer } from './testHelper.js';
import { registerCustomer, registerDriver, registerAdmin } from '../server/services/authService.js';
import { createBooking, updateBookingStatus } from '../server/services/bookingService.js';
import { queryOne, execute } from '../server/db/database.js';
import { ENV } from '../server/config/env.js';

describe('Phase 5 — Production Driver GPS & Live Trip Tracking Hardening Suite', () => {
  let server, baseUrl;
  let adminToken, customerTokenA, customerTokenB, driverTokenA, driverTokenB;
  let customerUserA, customerUserB, driverUserA, driverUserB;
  let driverAId, driverBId;

  const testPassword = 'Phase5SecurePassword123!';

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // 1. Admin
    const adminEmail = `phase5_admin_${Date.now()}@bookdriveranna.com`;
    const adminPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const adminRes = await registerAdmin({
      name: 'Phase 5 Admin',
      email: adminEmail,
      phone: adminPhone,
      password: testPassword,
      secretKey: ENV.ADMIN_REGISTRATION_SECRET
    });
    adminToken = adminRes.token;

    // 2. Customers
    const custPhoneA = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const custResA = await registerCustomer({
      name: 'Alice Customer',
      email: `alice_p5_${Date.now()}@test.com`,
      phone: custPhoneA,
      password: testPassword
    });
    customerUserA = custResA.user;
    customerTokenA = custResA.token;

    const custPhoneB = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const custResB = await registerCustomer({
      name: 'Bob Customer',
      email: `bob_p5_${Date.now()}@test.com`,
      phone: custPhoneB,
      password: testPassword
    });
    customerUserB = custResB.user;
    customerTokenB = custResB.token;

    // 3. Drivers
    const drvPhoneA = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const dlNumberA = `KA-01-${Date.now().toString().slice(-7)}`;
    const drvResA = await registerDriver({
      name: 'Driver Alpha',
      phone: drvPhoneA,
      dlNumber: dlNumberA,
      password: testPassword,
      area: 'Indiranagar'
    });
    driverUserA = drvResA.user;
    driverTokenA = drvResA.token;
    const dRecA = await queryOne('SELECT id FROM drivers WHERE user_id = ?', [driverUserA.id]);
    driverAId = dRecA.id;
    await execute("UPDATE drivers SET status = 'Active' WHERE id = ?", [driverAId]);

    const drvPhoneB = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const dlNumberB = `KA-02-${(Date.now() + 1).toString().slice(-7)}`;
    const drvResB = await registerDriver({
      name: 'Driver Beta',
      phone: drvPhoneB,
      dlNumber: dlNumberB,
      password: testPassword,
      area: 'Koramangala'
    });
    driverUserB = drvResB.user;
    driverTokenB = drvResB.token;
    const dRecB = await queryOne('SELECT id FROM drivers WHERE user_id = ?', [driverUserB.id]);
    driverBId = dRecB.id;
    await execute("UPDATE drivers SET status = 'Active' WHERE id = ?", [driverBId]);
  });

  after(async () => {
    if (server) {
      await new Promise((res) => server.close(res));
    }
  });

  async function createTestBookingFor(user, extra = {}) {
    const targetDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const res = await createBooking({
      userId: user?.id || null,
      customerName: user?.name || 'Guest User',
      customerPhone: user?.phone || '+91 9876543210',
      bookingCategory: 'driver',
      driverTripOption: 'one-way',
      pickupArea: 'Indiranagar, Bengaluru',
      dropLocation: 'Whitefield, Bengaluru',
      date: targetDate,
      time: '10:00 AM',
      paymentMode: 'cash',
      ...extra
    });
    return res.booking;
  }

  // =========================================================================
  // 1. DRIVER GPS AUTHORIZATION & IDENTITY INTEGRITY (OBJECTIVE 2)
  // =========================================================================
  describe('1. Driver GPS Authorization & Identity Integrity', () => {
    test('1.1 Unauthenticated location update is rejected with 401', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: 12.9716, longitude: 77.5946 })
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'UNAUTHORIZED');
    });

    test('1.2 Customer account is forbidden from updating driver location (403 FORBIDDEN)', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customerTokenA}`
        },
        body: JSON.stringify({ latitude: 12.9716, longitude: 77.5946 })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('1.3 Inactive or suspended driver cannot submit GPS coordinates (403 DRIVER_INACTIVE)', async () => {
      await execute("UPDATE drivers SET status = 'Suspended' WHERE id = ?", [driverAId]);
      try {
        const res = await fetch(`${baseUrl}/api/drivers/location`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${driverTokenA}`
          },
          body: JSON.stringify({ latitude: 12.9716, longitude: 77.5946 })
        });
        assert.strictEqual(res.status, 403);
        const data = await res.json();
        assert.strictEqual(data.error.code, 'DRIVER_INACTIVE');
      } finally {
        await execute("UPDATE drivers SET status = 'Active' WHERE id = ?", [driverAId]);
      }
    });

    test('1.4 Driver A cannot update Driver B coordinates even if driverId is supplied in body', async () => {
      const originalDriverB = await queryOne('SELECT current_latitude, current_longitude FROM drivers WHERE id = ?', [driverBId]);

      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverTokenA}`
        },
        body: JSON.stringify({
          driverId: driverBId,
          latitude: 13.0827,
          longitude: 80.2707
        })
      });
      assert.strictEqual(res.status, 200);

      // Verify Driver A's coordinates were updated, but Driver B was NOT modified
      const driverARec = await queryOne('SELECT current_latitude, current_longitude FROM drivers WHERE id = ?', [driverAId]);
      assert.strictEqual(Number(driverARec.current_latitude), 13.0827);
      assert.strictEqual(Number(driverARec.current_longitude), 80.2707);

      const driverBRec = await queryOne('SELECT current_latitude, current_longitude FROM drivers WHERE id = ?', [driverBId]);
      assert.strictEqual(driverBRec.current_latitude, originalDriverB.current_latitude);
      assert.strictEqual(driverBRec.current_longitude, originalDriverB.current_longitude);
    });
  });

  // =========================================================================
  // 2. COORDINATE VALIDATION RULES (OBJECTIVE 3)
  // =========================================================================
  describe('2. Coordinate Validation Rules', () => {
    test('2.1 Missing latitude or longitude is rejected with 400 INVALID_COORDINATES', async () => {
      const res1 = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverTokenA}`
        },
        body: JSON.stringify({ longitude: 77.5946 })
      });
      assert.strictEqual(res1.status, 400);

      const res2 = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverTokenA}`
        },
        body: JSON.stringify({ latitude: 12.9716 })
      });
      assert.strictEqual(res2.status, 400);
    });

    test('2.2 NaN, Infinity, -Infinity are rejected with 400 INVALID_COORDINATES', async () => {
      const invalidPayloads = [
        { latitude: 'NaN', longitude: 77.5946 },
        { latitude: 'Infinity', longitude: 77.5946 },
        { latitude: '-Infinity', longitude: 77.5946 },
        { latitude: 'random_text', longitude: 77.5946 }
      ];

      for (const payload of invalidPayloads) {
        const res = await fetch(`${baseUrl}/api/drivers/location`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${driverTokenA}`
          },
          body: JSON.stringify(payload)
        });
        assert.strictEqual(res.status, 400);
        const data = await res.json();
        assert.strictEqual(data.error.code, 'INVALID_COORDINATES');
      }
    });

    test('2.3 Out of range geographic bounds are rejected with 400 INVALID_COORDINATES', async () => {
      const outOfBounds = [
        { latitude: 90.0001, longitude: 77.5946 },
        { latitude: -90.0001, longitude: 77.5946 },
        { latitude: 12.9716, longitude: 180.0001 },
        { latitude: 12.9716, longitude: -180.0001 }
      ];

      for (const payload of outOfBounds) {
        const res = await fetch(`${baseUrl}/api/drivers/location`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${driverTokenA}`
          },
          body: JSON.stringify(payload)
        });
        assert.strictEqual(res.status, 400);
        const data = await res.json();
        assert.strictEqual(data.error.code, 'INVALID_COORDINATES');
      }
    });
  });

  // =========================================================================
  // 3. SERVER TIMESTAMP & FRESHNESS INTEGRITY (OBJECTIVE 4, 5 & 20)
  // =========================================================================
  describe('3. Server Timestamp & Freshness Integrity', () => {
    test('3.1 Server authoritative timestamp is recorded upon location update', async () => {
      const beforeTime = new Date(Date.now() - 2000);

      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverTokenA}`
        },
        body: JSON.stringify({
          latitude: 12.9750,
          longitude: 77.6000,
          timestamp: '2010-01-01T00:00:00.000Z' // Spoofed client timestamp
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.data.updatedAt, 'Response must return updatedAt');

      const driver = await queryOne('SELECT last_location_update FROM drivers WHERE id = ?', [driverAId]);
      const rawDateStr = String(driver.last_location_update);
      const isoStr = (rawDateStr.includes('T') ? rawDateStr : rawDateStr.replace(' ', 'T')) + (rawDateStr.endsWith('Z') ? '' : 'Z');
      const updateDate = new Date(isoStr);
      assert.ok(updateDate >= beforeTime, 'Timestamp must use server clock, not client spoofed date');
    });

    test('3.2 Location returned exposes freshness correctly in booking tracking endpoint', async () => {
      // 1. Fresh location (within 45s)
      await execute("UPDATE drivers SET current_latitude = 12.9716, current_longitude = 77.5946, last_location_update = CURRENT_TIMESTAMP WHERE id = ?", [driverAId]);

      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE bookings SET status = 'ASSIGNED', assigned_driver_id = ? WHERE id = ?", [driverAId, bkg.id]);

      const resFresh = await fetch(`${baseUrl}/api/bookings/${bkg.id}/driver-location`, {
        headers: { 'Authorization': `Bearer ${customerTokenA}` }
      });
      assert.strictEqual(resFresh.status, 200);
      const dataFresh = await resFresh.json();
      assert.strictEqual(dataFresh.data.freshness, 'LIVE');
      assert.strictEqual(dataFresh.data.location.isLive, true);

      // 2. Stale location (older than 45s)
      const staleTime = new Date(Date.now() - 90000).toISOString();
      await execute("UPDATE drivers SET last_location_update = ? WHERE id = ?", [staleTime, driverAId]);

      const resStale = await fetch(`${baseUrl}/api/bookings/${bkg.id}/driver-location`, {
        headers: { 'Authorization': `Bearer ${customerTokenA}` }
      });
      assert.strictEqual(resStale.status, 200);
      const dataStale = await resStale.json();
      assert.strictEqual(dataStale.data.freshness, 'STALE');
      assert.strictEqual(dataStale.data.location.isStale, true);
    });
  });

  // =========================================================================
  // 4. BOOKING-SCOPED CUSTOMER TRACKING & PRIVACY (OBJECTIVE 10, 11 & 13)
  // =========================================================================
  describe('4. Booking-Scoped Customer Tracking & Privacy', () => {
    test('4.1 Customer A cannot track Customer B booking via GET /api/bookings/:id/driver-location (403)', async () => {
      const bkgB = await createTestBookingFor(customerUserB);
      await execute("UPDATE bookings SET status = 'ASSIGNED', assigned_driver_id = ? WHERE id = ?", [driverAId, bkgB.id]);

      const res = await fetch(`${baseUrl}/api/bookings/${bkgB.id}/driver-location`, {
        headers: { 'Authorization': `Bearer ${customerTokenA}` }
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('4.2 Unassigned booking safely reports trackingActive: false with null location', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE bookings SET status = 'CONFIRMED', assigned_driver_id = NULL WHERE id = ?", [bkg.id]);

      const res = await fetch(`${baseUrl}/api/bookings/${bkg.id}/driver-location`, {
        headers: { 'Authorization': `Bearer ${customerTokenA}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.trackingActive, false);
      assert.strictEqual(data.data.assignedDriver, null);
      assert.strictEqual(data.data.location, null);
    });

    test('4.3 Completed trip terminates live tracking (trackingActive: false, location: null)', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE bookings SET status = 'COMPLETED', assigned_driver_id = ? WHERE id = ?", [driverAId, bkg.id]);

      const res = await fetch(`${baseUrl}/api/bookings/${bkg.id}/driver-location`, {
        headers: { 'Authorization': `Bearer ${customerTokenA}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.trackingActive, false);
      assert.strictEqual(data.data.location, null);
    });

    test('4.4 Cancelled trip terminates live tracking (trackingActive: false, location: null)', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE bookings SET status = 'CANCELLED', assigned_driver_id = ? WHERE id = ?", [driverAId, bkg.id]);

      const res = await fetch(`${baseUrl}/api/bookings/${bkg.id}/driver-location`, {
        headers: { 'Authorization': `Bearer ${customerTokenA}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.trackingActive, false);
      assert.strictEqual(data.data.location, null);
    });

    test('4.5 Public/arbitrary driver tracking endpoint does NOT exist (404)', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location/${driverAId}`, {
        headers: { 'Authorization': `Bearer ${customerTokenA}` }
      });
      assert.strictEqual(res.status, 404);
    });

    test('4.6 Admin retains authorized visibility into any booking tracking', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE drivers SET current_latitude = 12.9352, current_longitude = 77.6245, last_location_update = CURRENT_TIMESTAMP WHERE id = ?", [driverAId]);
      await execute("UPDATE bookings SET status = 'IN_PROGRESS', assigned_driver_id = ? WHERE id = ?", [driverAId, bkg.id]);

      const res = await fetch(`${baseUrl}/api/bookings/${bkg.id}/driver-location`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.trackingActive, true);
      assert.strictEqual(Number(data.data.location.latitude), 12.9352);
    });
  });

  // =========================================================================
  // 5. DRIVER PROFILE INVARIANCE (OBJECTIVE 19)
  // =========================================================================
  describe('5. Driver Profile Invariance', () => {
    test('5.1 GPS location updates leave driver name, phone, DL, status, and earnings untouched', async () => {
      const beforeDriver = await queryOne('SELECT * FROM drivers WHERE id = ?', [driverAId]);

      await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverTokenA}`
        },
        body: JSON.stringify({ latitude: 12.9900, longitude: 77.5800 })
      });

      const afterDriver = await queryOne('SELECT * FROM drivers WHERE id = ?', [driverAId]);
      assert.strictEqual(afterDriver.name, beforeDriver.name);
      assert.strictEqual(afterDriver.phone, beforeDriver.phone);
      assert.strictEqual(afterDriver.dl_number, beforeDriver.dl_number);
      assert.strictEqual(afterDriver.status, beforeDriver.status);
      assert.strictEqual(afterDriver.earnings_today, beforeDriver.earnings_today);
      assert.strictEqual(afterDriver.trips_completed, beforeDriver.trips_completed);
      assert.strictEqual(Number(afterDriver.current_latitude), 12.9900);
      assert.strictEqual(Number(afterDriver.current_longitude), 77.5800);
    });
  });
});
