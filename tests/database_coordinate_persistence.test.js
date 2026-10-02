import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startTestServer } from './testHelper.js';
import { SCHEMA_SQL } from '../server/db/schema.js';
import { queryOne, queryAll, execute, normalizeRow } from '../server/db/database.js';
import { createBooking, cancelBooking, getUserBookings } from '../server/services/bookingService.js';
import { calculateAuthoritativeFare } from '../server/services/pricingService.js';
import { routingService } from '../server/services/routingService.js';
import { getTodayIST } from '../server/middleware/validate.js';

import { bootstrapAdmin } from '../server/scripts/bootstrapAdmin.js';

describe('Phase 8 — Database Coordinate Persistence Suite', () => {
  let server, baseUrl;
  let testCustomerToken, testCustomerId;
  let testAdminToken;
  let testDriverToken, testDriverId;
  let otherCustomerToken;

  const validPickupLat = 12.9715987;
  const validPickupLng = 77.5945627;
  const validDestLat = 13.1986348;
  const validDestLng = 77.7065928;

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    const adminEmail = `coord_admin_${Date.now()}@bookdriveranna.com`;
    const adminPassword = 'AdminPassword123!';
    const adminPhone = `95${Math.floor(10000000 + Math.random() * 90000000)}`;

    await bootstrapAdmin({
      email: adminEmail,
      password: adminPassword,
      name: 'Coord Admin',
      phone: adminPhone,
      area: 'Indiranagar'
    });

    const adminRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: adminEmail,
        password: adminPassword
      })
    });
    const adminData = await adminRes.json();
    testAdminToken = adminData.data?.token;

    // Register a test customer
    const custRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Coord Test Customer',
        email: `coord_cust_${Date.now()}@example.com`,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'Password123!',
        area: 'Indiranagar'
      })
    });
    const custData = await custRes.json();
    testCustomerToken = custData.data.token;
    testCustomerId = custData.data.user.id;

    // Register another customer for ownership / isolation tests
    const otherCustRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Other Customer',
        email: `coord_other_${Date.now()}@example.com`,
        phone: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'Password123!',
        area: 'Koramangala'
      })
    });
    const otherCustData = await otherCustRes.json();
    otherCustomerToken = otherCustData.data.token;

    // Register test driver
    const drvRes = await fetch(`${baseUrl}/api/auth/driver-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Coord Test Driver',
        email: `coord_drv_${Date.now()}@example.com`,
        phone: `96${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'Password123!',
        dlNumber: `DL-COORD-${Date.now()}`.slice(0, 16),
        area: 'Indiranagar'
      })
    });
    const drvData = await drvRes.json();
    testDriverToken = drvData.data?.token;
  });

  after(async () => {
    if (server) {
      await new Promise((res) => server.close(res));
    }
  });

  // =========================================================================
  // 1. Database Schema & Migration Idempotency Tests
  // =========================================================================
  describe('1. Database Schema & Dual-Engine Migration', () => {
    test('1. New coordinate columns exist in the active bookings table', async () => {
      // In SQLite, PRAGMA table_info returns columns
      const cols = await queryAll('PRAGMA table_info(bookings);');
      const colNames = cols.map(c => (c.name || c.NAME).toLowerCase());
      assert.ok(colNames.includes('pickup_latitude'), 'pickup_latitude column must exist');
      assert.ok(colNames.includes('pickup_longitude'), 'pickup_longitude column must exist');
      assert.ok(colNames.includes('destination_latitude'), 'destination_latitude column must exist');
      assert.ok(colNames.includes('destination_longitude'), 'destination_longitude column must exist');
    });

    test('2. Coordinate columns accept valid floating-point numbers without precision loss', async () => {
      const testId = `BDA-TEST-GEO-${Date.now()}`;
      await execute(`
        INSERT INTO bookings (
          id, customer_name, customer_phone, booking_type, trip_type, service_name,
          pickup_area, drop_location, pickup_latitude, pickup_longitude,
          destination_latitude, destination_longitude, date, time, calculated_fare
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        testId, 'Precision Tester', '9845012345', 'driver', 'one-way', 'Precision Test',
        'Indiranagar', 'Airport', 12.9715987, 77.5945627, 13.1986348, 77.7065928,
        getTodayIST(), '14:00', 899.0
      ]);

      const inserted = await queryOne('SELECT * FROM bookings WHERE id = ?', [testId]);
      assert.ok(inserted);
      assert.strictEqual(typeof inserted.pickup_latitude, 'number');
      assert.strictEqual(typeof inserted.pickup_longitude, 'number');
      assert.strictEqual(typeof inserted.destination_latitude, 'number');
      assert.strictEqual(typeof inserted.destination_longitude, 'number');

      // Verify exact precision preserved to 7 decimal places
      assert.ok(Math.abs(inserted.pickup_latitude - 12.9715987) < 0.000001, 'pickup_latitude precision preserved');
      assert.ok(Math.abs(inserted.pickup_longitude - 77.5945627) < 0.000001, 'pickup_longitude precision preserved');
      assert.ok(Math.abs(inserted.destination_latitude - 13.1986348) < 0.000001, 'destination_latitude precision preserved');
      assert.ok(Math.abs(inserted.destination_longitude - 77.7065928) < 0.000001, 'destination_longitude precision preserved');
    });

    test('3. Coordinate columns permit NULL for historical/legacy records', async () => {
      const testId = `BDA-LEGACY-${Date.now()}`;
      await execute(`
        INSERT INTO bookings (
          id, customer_name, customer_phone, booking_type, trip_type, service_name,
          pickup_area, drop_location, pickup_latitude, pickup_longitude,
          destination_latitude, destination_longitude, date, time, calculated_fare
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        testId, 'Legacy Customer', '9845012346', 'driver', 'one-way', 'Legacy Booking',
        'Indiranagar', 'MG Road', null, null, null, null,
        getTodayIST(), '15:00', 299.0
      ]);

      const legacy = await queryOne('SELECT * FROM bookings WHERE id = ?', [testId]);
      assert.ok(legacy);
      assert.strictEqual(legacy.pickup_latitude, null);
      assert.strictEqual(legacy.pickup_longitude, null);
      assert.strictEqual(legacy.destination_latitude, null);
      assert.strictEqual(legacy.destination_longitude, null);
    });

    test('4. Fresh database initialization creates coordinate columns', () => {
      // Test fresh SQLite instance with embedded SCHEMA_SQL
      const freshDb = new DatabaseSync(':memory:');
      freshDb.exec(SCHEMA_SQL);
      const cols = freshDb.prepare('PRAGMA table_info(bookings);').all();
      const colNames = cols.map(c => c.name.toLowerCase());
      assert.ok(colNames.includes('pickup_latitude'));
      assert.ok(colNames.includes('pickup_longitude'));
      assert.ok(colNames.includes('destination_latitude'));
      assert.ok(colNames.includes('destination_longitude'));
      freshDb.close();
    });

    test('5. Existing database upgrade safely applies ALTER TABLE migrations', () => {
      // Simulate an older database created WITHOUT coordinate columns
      const legacyDb = new DatabaseSync(':memory:');
      legacyDb.exec(`
        CREATE TABLE bookings (
          id TEXT PRIMARY KEY,
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          pickup_area TEXT NOT NULL,
          drop_location TEXT,
          calculated_fare REAL NOT NULL
        );
        INSERT INTO bookings VALUES ('OLD-1', 'Old User', '9999999999', 'Indiranagar', 'Airport', 899.0);
      `);

      // Run our idempotent migration statements
      try { legacyDb.exec('ALTER TABLE bookings ADD COLUMN pickup_latitude REAL;'); } catch (e) {}
      try { legacyDb.exec('ALTER TABLE bookings ADD COLUMN pickup_longitude REAL;'); } catch (e) {}
      try { legacyDb.exec('ALTER TABLE bookings ADD COLUMN destination_latitude REAL;'); } catch (e) {}
      try { legacyDb.exec('ALTER TABLE bookings ADD COLUMN destination_longitude REAL;'); } catch (e) {}

      // Verify existing row is safe and new columns are NULL
      const row = legacyDb.prepare('SELECT * FROM bookings WHERE id = ?').get('OLD-1');
      assert.strictEqual(row.customer_name, 'Old User');
      assert.strictEqual(row.pickup_latitude, null);
      assert.strictEqual(row.pickup_longitude, null);
      assert.strictEqual(row.destination_latitude, null);
      assert.strictEqual(row.destination_longitude, null);

      legacyDb.close();
    });

    test('6. Running schema initialization repeatedly is idempotent and does NOT destroy data', () => {
      const db = new DatabaseSync(':memory:');
      db.exec(SCHEMA_SQL);

      db.prepare(`
        INSERT INTO bookings (id, customer_name, customer_phone, booking_type, trip_type, service_name, pickup_area, date, time, calculated_fare, pickup_latitude, pickup_longitude, destination_latitude, destination_longitude)
        VALUES ('IDEMP-1', 'Tester', '9845012345', 'driver', 'one-way', 'Driver', 'Indiranagar', '2026-10-01', '10:00', 299, 12.97, 77.59, 13.20, 77.70)
      `).run();

      // Re-run schema statements and ALTER TABLE statements
      db.exec(SCHEMA_SQL);
      try { db.exec('ALTER TABLE bookings ADD COLUMN pickup_latitude REAL;'); } catch (e) {}
      try { db.exec('ALTER TABLE bookings ADD COLUMN pickup_longitude REAL;'); } catch (e) {}
      try { db.exec('ALTER TABLE bookings ADD COLUMN destination_latitude REAL;'); } catch (e) {}
      try { db.exec('ALTER TABLE bookings ADD COLUMN destination_longitude REAL;'); } catch (e) {}

      const check = db.prepare('SELECT * FROM bookings WHERE id = ?').get('IDEMP-1');
      assert.strictEqual(check.customer_name, 'Tester');
      assert.strictEqual(check.pickup_latitude, 12.97);

      db.close();
    });
  });

  // =========================================================================
  // 2. Coordinate Validation & Completeness Tests
  // =========================================================================
  describe('2. Coordinate Validation & Completeness Rules', () => {
    test('7. Valid latitude and longitude coordinates are accepted', async () => {
      const res = await createBooking({
        customerName: 'Valid Coords',
        customerPhone: '9845012347',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        pickupLat: validPickupLat,
        pickupLng: validPickupLng,
        destLat: validDestLat,
        destLng: validDestLng,
        date: getTodayIST(),
        time: '12:00'
      });

      assert.ok(res.booking);
      assert.strictEqual(res.booking.pickup_latitude, validPickupLat);
      assert.strictEqual(res.booking.pickup_longitude, validPickupLng);
      assert.strictEqual(res.booking.destination_latitude, validDestLat);
      assert.strictEqual(res.booking.destination_longitude, validDestLng);
    });

    test('8. Latitude outside valid range (-90 to 90) is rejected with 400', async () => {
      await assert.rejects(async () => {
        await createBooking({
          customerName: 'Bad Lat',
          customerPhone: '9845012348',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          dropLocation: 'Airport',
          pickupLat: 95.0, // Invalid lat > 90
          pickupLng: validPickupLng,
          destLat: validDestLat,
          destLng: validDestLng,
          date: getTodayIST(),
          time: '13:00'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'INVALID_COORDINATES');
        return true;
      });
    });

    test('9. Longitude outside valid range (-180 to 180) is rejected with 400', async () => {
      await assert.rejects(async () => {
        await createBooking({
          customerName: 'Bad Lng',
          customerPhone: '9845012349',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          dropLocation: 'Airport',
          pickupLat: validPickupLat,
          pickupLng: 185.0, // Invalid lng > 180
          destLat: validDestLat,
          destLng: validDestLng,
          date: getTodayIST(),
          time: '14:00'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'INVALID_COORDINATES');
        return true;
      });
    });

    test('10. NaN coordinate value is rejected with 400', async () => {
      await assert.rejects(async () => {
        await createBooking({
          customerName: 'NaN Lat',
          customerPhone: '9845012350',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          dropLocation: 'Airport',
          pickupLat: NaN,
          pickupLng: validPickupLng,
          destLat: validDestLat,
          destLng: validDestLng,
          date: getTodayIST(),
          time: '15:00'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'INVALID_COORDINATES');
        return true;
      });
    });

    test('11. Infinity coordinate value is rejected with 400', async () => {
      await assert.rejects(async () => {
        await createBooking({
          customerName: 'Infinity Lng',
          customerPhone: '9845012351',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          dropLocation: 'Airport',
          pickupLat: validPickupLat,
          pickupLng: Infinity,
          destLat: validDestLat,
          destLng: validDestLng,
          date: getTodayIST(),
          time: '16:00'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'INVALID_COORDINATES');
        return true;
      });
    });

    test('12. Non-numeric string coordinate is rejected with 400', async () => {
      await assert.rejects(async () => {
        await createBooking({
          customerName: 'String Coord',
          customerPhone: '9845012352',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          dropLocation: 'Airport',
          pickupLat: 'not-a-number',
          pickupLng: validPickupLng,
          destLat: validDestLat,
          destLng: validDestLng,
          date: getTodayIST(),
          time: '17:00'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'INVALID_COORDINATES');
        return true;
      });
    });

    test('13. Partial coordinate set is rejected with 400 INVALID_COORDINATES', async () => {
      // Provide pickupLat & pickupLng, but omit destination coordinates
      await assert.rejects(async () => {
        await createBooking({
          customerName: 'Partial Coords',
          customerPhone: '9845012353',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          dropLocation: 'Airport',
          pickupLat: validPickupLat,
          pickupLng: validPickupLng,
          destLat: undefined,
          destLng: undefined,
          date: getTodayIST(),
          time: '18:00'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'INVALID_COORDINATES');
        assert.match(err.message, /Incomplete coordinate pair/);
        return true;
      });

      // Provide only pickupLat, leaving pickupLng null
      await assert.rejects(async () => {
        await createBooking({
          customerName: 'Missing Pickup Lng',
          customerPhone: '9845012354',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          dropLocation: 'Airport',
          pickupLat: validPickupLat,
          pickupLng: null,
          destLat: validDestLat,
          destLng: validDestLng,
          date: getTodayIST(),
          time: '19:00'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'INVALID_COORDINATES');
        return true;
      });
    });
  });

  // =========================================================================
  // 3. Booking Creation & Persistence Tests
  // =========================================================================
  describe('3. Booking Creation & Persistence', () => {
    test('14. Valid coordinates are persisted accurately via POST /api/bookings', async () => {
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testCustomerToken}`
        },
        body: JSON.stringify({
          customerName: 'Coord Test Customer',
          customerPhone: '9845012355',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar, Bengaluru',
          dropLocation: 'Kempegowda Intl Airport',
          pickupLat: validPickupLat,
          pickupLng: validPickupLng,
          destLat: validDestLat,
          destLng: validDestLng,
          date: getTodayIST(),
          time: '10:00'
        })
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      const booking = data.data.booking;

      assert.strictEqual(booking.pickup_latitude, validPickupLat);
      assert.strictEqual(booking.pickup_longitude, validPickupLng);
      assert.strictEqual(booking.destination_latitude, validDestLat);
      assert.strictEqual(booking.destination_longitude, validDestLng);

      // Verify direct database query matches
      const dbRow = await queryOne('SELECT * FROM bookings WHERE id = ?', [booking.id]);
      assert.strictEqual(dbRow.pickup_latitude, validPickupLat);
      assert.strictEqual(dbRow.pickup_longitude, validPickupLng);
      assert.strictEqual(dbRow.destination_latitude, validDestLat);
      assert.strictEqual(dbRow.destination_longitude, validDestLng);
    });

    test('15. Existing textual pickup/drop fields remain intact alongside coordinates', async () => {
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testCustomerToken}`
        },
        body: JSON.stringify({
          customerName: 'Textual Intact',
          customerPhone: '9845012356',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: '100ft Road, Indiranagar, Bengaluru',
          dropLocation: 'Terminal 1, BLR Airport, Devanahalli',
          pickupLat: validPickupLat,
          pickupLng: validPickupLng,
          destLat: validDestLat,
          destLng: validDestLng,
          date: getTodayIST(),
          time: '11:00'
        })
      });

      const data = await res.json();
      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.data.booking.pickup_area, '100ft Road, Indiranagar, Bengaluru');
      assert.strictEqual(data.data.booking.drop_location, 'Terminal 1, BLR Airport, Devanahalli');
      assert.strictEqual(data.data.booking.pickup_latitude, validPickupLat);
      assert.strictEqual(data.data.booking.destination_latitude, validDestLat);
    });

    test('16. Coordinate alias naming conventions (camelCase, snake_case) are accepted', async () => {
      // Test sending snake_case pickup_latitude
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testCustomerToken}`
        },
        body: JSON.stringify({
          customerName: 'Snake Case Tester',
          customerPhone: '9845012357',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          dropLocation: 'Airport',
          pickup_latitude: validPickupLat,
          pickup_longitude: validPickupLng,
          destination_latitude: validDestLat,
          destination_longitude: validDestLng,
          date: getTodayIST(),
          time: '12:00'
        })
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.data.booking.pickup_latitude, validPickupLat);
      assert.strictEqual(data.data.booking.destination_longitude, validDestLng);
    });

    test('17. Legacy bookings without coordinates remain completely valid and functional', async () => {
      // e.g. driving class or driver booking without coordinates
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testCustomerToken}`
        },
        body: JSON.stringify({
          customerName: 'No Coords Class',
          customerPhone: '9845012358',
          bookingCategory: 'class',
          selectedClassId: 'class-beginner',
          pickupArea: 'Indiranagar',
          date: getTodayIST(),
          time: '08:00'
        })
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.data.booking.pickup_latitude, null);
      assert.strictEqual(data.data.booking.pickup_longitude, null);
      assert.strictEqual(data.data.booking.destination_latitude, null);
      assert.strictEqual(data.data.booking.destination_longitude, null);
      assert.strictEqual(data.data.booking.booking_type, 'class');
    });
  });

  // =========================================================================
  // 4. Booking Retrieval & Authorization Tests
  // =========================================================================
  describe('4. Booking Retrieval & Strict Authorization', () => {
    let createdBookingId;
    const phone = '9845012359';

    before(async () => {
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testCustomerToken}`
        },
        body: JSON.stringify({
          customerName: 'Lookup Customer',
          customerPhone: phone,
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          dropLocation: 'Airport',
          pickupLat: validPickupLat,
          pickupLng: validPickupLng,
          destLat: validDestLat,
          destLng: validDestLng,
          date: getTodayIST(),
          time: '13:00'
        })
      });
      const data = await res.json();
      createdBookingId = data.data.booking.id;
    });

    test('18. Authorized customer retrieves own booking with coordinates via GET /api/bookings/:id', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/${createdBookingId}`, {
        headers: { 'Authorization': `Bearer ${testCustomerToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const b = data.data.booking;
      assert.strictEqual(b.pickup_latitude, validPickupLat);
      assert.strictEqual(b.pickup_longitude, validPickupLng);
      assert.strictEqual(b.destination_latitude, validDestLat);
      assert.strictEqual(b.destination_longitude, validDestLng);
    });

    test('19. Unauthorized customer is blocked (403) from retrieving another user booking', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/${createdBookingId}`, {
        headers: { 'Authorization': `Bearer ${otherCustomerToken}` }
      });
      assert.strictEqual(res.status, 403);
    });

    test('20. Unauthenticated request to GET /api/bookings/:id is blocked (401)', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/${createdBookingId}`);
      assert.strictEqual(res.status, 401);
    });

    test('21. Authorized lookup via POST /api/bookings/lookup includes coordinates when phone matches', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: createdBookingId,
          phone: phone
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const b = data.data.booking;
      assert.strictEqual(b.pickup_latitude, validPickupLat);
      assert.strictEqual(b.pickup_longitude, validPickupLng);
      assert.strictEqual(b.destination_latitude, validDestLat);
      assert.strictEqual(b.destination_longitude, validDestLng);
    });

    test('22. Lookup defense: Incorrect phone returns 404 and does not leak coordinates', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: createdBookingId,
          phone: '9999999999' // Mismatched phone
        })
      });
      assert.strictEqual(res.status, 404);
    });

    test('23. Admin retrieval includes coordinates via /api/admin/bookings', async () => {
      if (!testAdminToken) return;
      const res = await fetch(`${baseUrl}/api/admin/bookings`, {
        headers: { 'Authorization': `Bearer ${testAdminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const target = data.data.bookings.find(b => b.id === createdBookingId);
      assert.ok(target);
      assert.strictEqual(target.pickup_latitude, validPickupLat);
      assert.strictEqual(target.destination_longitude, validDestLng);
    });
  });

  // =========================================================================
  // 5. Security & Anti-Tampering Tests
  // =========================================================================
  describe('5. Security & Anti-Tampering Protection', () => {
    test('24. Malicious SQL injection in coordinate values is rejected via API validation', async () => {
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testCustomerToken}`
        },
        body: JSON.stringify({
          customerName: 'SQL Injector',
          customerPhone: '9845012360',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          dropLocation: 'Airport',
          pickupLat: "12.97; DROP TABLE bookings;--",
          pickupLng: validPickupLng,
          destLat: validDestLat,
          destLng: validDestLng,
          date: getTodayIST(),
          time: '14:00'
        })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_COORDINATES');

      // Verify table still exists and healthy
      const count = await queryOne('SELECT COUNT(*) as count FROM bookings');
      assert.ok(count.count > 0);
    });

    test('25. Extreme out-of-range coordinates are rejected via API', async () => {
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testCustomerToken}`
        },
        body: JSON.stringify({
          customerName: 'Extreme Coords',
          customerPhone: '9845012361',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          dropLocation: 'Airport',
          pickupLat: 999.0,
          pickupLng: 999.0,
          destLat: validDestLat,
          destLng: validDestLng,
          date: getTodayIST(),
          time: '15:00'
        })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_COORDINATES');
    });
  });

  // =========================================================================
  // 6. Regression & Boundary Invariants
  // =========================================================================
  describe('6. Regression & Boundary Invariants', () => {
    test('26. Existing fare calculation formulas remain untouched and frozen', () => {
      const fare1 = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        dropLocation: 'City Drop',
        distanceKm: 10
      });
      assert.strictEqual(fare1.basePrice, 299);
      assert.strictEqual(fare1.gst, 15);
      assert.strictEqual(fare1.totalFare, 314);

      const fareAirport = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        dropLocation: 'Kempegowda Intl Airport (BLR T1/T2)',
        distanceKm: 35
      });
      assert.strictEqual(fareAirport.basePrice, 899);
    });

    test('27. Strict Phase 8 Boundary: ZERO driver GPS or realtime tracking columns added', () => {
      const schemaPath = path.resolve('server/db/schema.js');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');

      // Required in Phase 8
      assert.ok(schemaContent.includes('pickup_latitude'), 'Schema must include pickup_latitude');
      assert.ok(schemaContent.includes('pickup_longitude'), 'Schema must include pickup_longitude');
      assert.ok(schemaContent.includes('destination_latitude'), 'Schema must include destination_latitude');
      assert.ok(schemaContent.includes('destination_longitude'), 'Schema must include destination_longitude');

      // Prohibited future phase features
      assert.ok(!schemaContent.includes('driver_latitude'), 'Must NOT include driver_latitude');
      assert.ok(!schemaContent.includes('driver_longitude'), 'Must NOT include driver_longitude');
      assert.ok(!schemaContent.includes('driver_gps'), 'Must NOT include driver_gps');
      assert.ok(!schemaContent.includes('live_tracking'), 'Must NOT include live_tracking');
      assert.ok(!schemaContent.includes('route_geometry'), 'Must NOT include route_geometry');
      assert.ok(!schemaContent.includes('socket_id'), 'Must NOT include socket_id');
    });
  });
});
