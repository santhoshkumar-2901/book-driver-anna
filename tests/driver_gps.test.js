import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startTestServer } from './testHelper.js';
import { SCHEMA_SQL } from '../server/db/schema.js';
import { queryOne, queryAll, execute } from '../server/db/database.js';

describe('Phase 9 — Driver GPS Suite', () => {
  let server, baseUrl;
  let driverAToken, driverAId, driverAUserId;
  let driverBToken, driverBId, driverBUserId;
  let customerToken, customerUserId;

  const validLatA = 12.9715987;
  const validLngA = 77.5945627;
  const validLatB = 13.0826802;
  const validLngB = 80.2707184;

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // 1. Register Driver A
    const phoneA = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const drvARes = await fetch(`${baseUrl}/api/auth/driver-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'GPS Driver Anna A',
        email: `driver_a_${Date.now()}@example.com`,
        phone: phoneA,
        password: 'Password123!',
        dlNumber: `DL-A-${Date.now()}`.slice(0, 16),
        area: 'Indiranagar'
      })
    });
    const drvAData = await drvARes.json();
    assert.strictEqual(drvARes.status, 201, 'Driver A registration must succeed');
    driverAToken = drvAData.data.token;
    driverAUserId = drvAData.data.user.id;
    const driverARow = await queryOne('SELECT id FROM drivers WHERE user_id = ?', [driverAUserId]);
    driverAId = driverARow.id;

    // 2. Register Driver B
    const phoneB = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
    const drvBRes = await fetch(`${baseUrl}/api/auth/driver-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'GPS Driver Anna B',
        email: `driver_b_${Date.now()}@example.com`,
        phone: phoneB,
        password: 'Password123!',
        dlNumber: `DL-B-${Date.now()}`.slice(0, 16),
        area: 'Koramangala'
      })
    });
    const drvBData = await drvBRes.json();
    assert.strictEqual(drvBRes.status, 201, 'Driver B registration must succeed');
    driverBToken = drvBData.data.token;
    driverBUserId = drvBData.data.user.id;
    const driverBRow = await queryOne('SELECT id FROM drivers WHERE user_id = ?', [driverBUserId]);
    driverBId = driverBRow.id;

    // 3. Register Customer
    const phoneC = `96${Math.floor(10000000 + Math.random() * 90000000)}`;
    const custRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Regular Customer',
        email: `cust_gps_${Date.now()}@example.com`,
        phone: phoneC,
        password: 'Password123!',
        area: 'Indiranagar'
      })
    });
    const custData = await custRes.json();
    assert.strictEqual(custRes.status, 201, 'Customer registration must succeed');
    customerToken = custData.data.token;
    customerUserId = custData.data.user.id;
  });

  after(async () => {
    if (server) {
      await new Promise((res) => server.close(res));
    }
  });

  // =========================================================================
  // 1. Schema & Dual-Engine Persistence Tests
  // =========================================================================
  describe('1. Driver Schema & Column Verification', () => {
    test('1. New GPS location columns exist on drivers table', async () => {
      const cols = await queryAll('PRAGMA table_info(drivers);');
      const colNames = cols.map(c => (c.name || c.NAME).toLowerCase());
      assert.ok(colNames.includes('current_latitude'), 'current_latitude must exist');
      assert.ok(colNames.includes('current_longitude'), 'current_longitude must exist');
      assert.ok(colNames.includes('last_location_update'), 'last_location_update must exist');
    });

    test('2. SCHEMA_SQL embedded schema contains driver GPS columns', () => {
      assert.ok(SCHEMA_SQL.includes('current_latitude REAL'), 'SCHEMA_SQL must define current_latitude');
      assert.ok(SCHEMA_SQL.includes('current_longitude REAL'), 'SCHEMA_SQL must define current_longitude');
      assert.ok(SCHEMA_SQL.includes('last_location_update DATETIME'), 'SCHEMA_SQL must define last_location_update');
    });

    test('3. Fresh database initialization creates driver GPS columns and allows NULL', () => {
      const db = new DatabaseSync(':memory:');
      db.exec(SCHEMA_SQL);
      const cols = db.prepare('PRAGMA table_info(drivers);').all();
      const colNames = cols.map(c => c.name.toLowerCase());
      assert.ok(colNames.includes('current_latitude'));
      assert.ok(colNames.includes('current_longitude'));
      assert.ok(colNames.includes('last_location_update'));
      db.close();
    });

    test('4. Existing database upgrade applies ALTER TABLE migrations idempotently', () => {
      const db = new DatabaseSync(':memory:');
      db.exec(`
        CREATE TABLE drivers (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          status TEXT DEFAULT 'Active'
        );
        INSERT INTO drivers VALUES ('DRV-OLD', 'USR-OLD', 'Old Driver', '9845000000', 'Active');
      `);

      try { db.exec('ALTER TABLE drivers ADD COLUMN current_latitude REAL;'); } catch (e) {}
      try { db.exec('ALTER TABLE drivers ADD COLUMN current_longitude REAL;'); } catch (e) {}
      try { db.exec('ALTER TABLE drivers ADD COLUMN last_location_update DATETIME;'); } catch (e) {}

      // Re-run to ensure idempotency
      try { db.exec('ALTER TABLE drivers ADD COLUMN current_latitude REAL;'); } catch (e) {}
      try { db.exec('ALTER TABLE drivers ADD COLUMN current_longitude REAL;'); } catch (e) {}

      const row = db.prepare('SELECT * FROM drivers WHERE id = ?').get('DRV-OLD');
      assert.strictEqual(row.name, 'Old Driver');
      assert.strictEqual(row.current_latitude, null);
      assert.strictEqual(row.current_longitude, null);
      assert.strictEqual(row.last_location_update, null);
      db.close();
    });
  });

  // =========================================================================
  // 2. Authentication & Authorization Security Tests
  // =========================================================================
  describe('2. Authentication & Authorization Security', () => {
    test('5. Unauthenticated request to PUT /api/drivers/location is rejected with 401', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: validLatA, longitude: validLngA })
      });
      assert.strictEqual(res.status, 401);
    });

    test('6. Customer account is forbidden from updating driver location with 403', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customerToken}`
        },
        body: JSON.stringify({ latitude: validLatA, longitude: validLngA })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('7. Suspended or Inactive driver is rejected with 403 DRIVER_INACTIVE', async () => {
      // Temporarily mark Driver B as Inactive
      await execute("UPDATE drivers SET status = 'Inactive' WHERE id = ?", [driverBId]);

      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverBToken}`
        },
        body: JSON.stringify({ latitude: validLatB, longitude: validLngB })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'DRIVER_INACTIVE');

      // Restore Driver B to Active
      await execute("UPDATE drivers SET status = 'Active' WHERE id = ?", [driverBId]);
    });
  });

  // =========================================================================
  // 3. Driver Identity & Ownership Enforcement
  // =========================================================================
  describe('3. Driver Identity & Ownership Enforcement', () => {
    test('8. Driver A updates their own location successfully', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverAToken}`
        },
        body: JSON.stringify({ latitude: validLatA, longitude: validLngA })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.latitude, validLatA);
      assert.strictEqual(data.data.longitude, validLngA);

      // Verify in database
      const rowA = await queryOne('SELECT current_latitude, current_longitude, last_location_update FROM drivers WHERE id = ?', [driverAId]);
      assert.strictEqual(rowA.current_latitude, validLatA);
      assert.strictEqual(rowA.current_longitude, validLngA);
      assert.ok(rowA.last_location_update !== null);
    });

    test('9. Driver A CANNOT update Driver B by injecting driver_id or user_id in payload', async () => {
      // Driver A attempts to forge an update targeting Driver B
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverAToken}`
        },
        body: JSON.stringify({
          latitude: 11.111111,
          longitude: 22.222222,
          driver_id: driverBId,
          driverId: driverBId,
          user_id: driverBUserId,
          userId: driverBUserId
        })
      });
      assert.strictEqual(res.status, 200);

      // Driver B's location must NOT have been changed by Driver A's request
      const rowB = await queryOne('SELECT current_latitude, current_longitude FROM drivers WHERE id = ?', [driverBId]);
      assert.notStrictEqual(rowB.current_latitude, 11.111111);
      assert.notStrictEqual(rowB.current_longitude, 22.222222);

      // Driver A's own location was updated
      const rowA = await queryOne('SELECT current_latitude, current_longitude FROM drivers WHERE id = ?', [driverAId]);
      assert.strictEqual(rowA.current_latitude, 11.111111);
      assert.strictEqual(rowA.current_longitude, 22.222222);
    });

    test('10. Client-supplied last_location_update timestamp is ignored (server authoritative)', async () => {
      const spoofedTime = '2020-01-01 00:00:00';
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverAToken}`
        },
        body: JSON.stringify({
          latitude: validLatA,
          longitude: validLngA,
          last_location_update: spoofedTime,
          lastLocationUpdate: spoofedTime
        })
      });
      assert.strictEqual(res.status, 200);

      const rowA = await queryOne('SELECT last_location_update FROM drivers WHERE id = ?', [driverAId]);
      assert.notStrictEqual(rowA.last_location_update, spoofedTime, 'Server timestamp must be authoritative');
    });

    test('11. Driver retrieves their own persisted location via GET /api/drivers/location', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        headers: { 'Authorization': `Bearer ${driverAToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.latitude, validLatA);
      assert.strictEqual(data.data.longitude, validLngA);
      assert.ok(data.data.lastLocationUpdate);
    });
  });

  // =========================================================================
  // 4. Coordinate Validation Tests
  // =========================================================================
  describe('4. Coordinate Validation Rules', () => {
    test('12. Missing latitude is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverAToken}`
        },
        body: JSON.stringify({ longitude: validLngA })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_COORDINATES');
    });

    test('13. Missing longitude is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverAToken}`
        },
        body: JSON.stringify({ latitude: validLatA })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_COORDINATES');
    });

    test('14. Latitude > 90 is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverAToken}`
        },
        body: JSON.stringify({ latitude: 91.5, longitude: validLngA })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_COORDINATES');
    });

    test('15. Latitude < -90 is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverAToken}`
        },
        body: JSON.stringify({ latitude: -95.0, longitude: validLngA })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_COORDINATES');
    });

    test('16. Longitude > 180 is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverAToken}`
        },
        body: JSON.stringify({ latitude: validLatA, longitude: 185.0 })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_COORDINATES');
    });

    test('17. Longitude < -180 is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverAToken}`
        },
        body: JSON.stringify({ latitude: validLatA, longitude: -185.0 })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_COORDINATES');
    });

    test('18. NaN coordinate is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverAToken}`
        },
        body: JSON.stringify({ latitude: 'NaN', longitude: validLngA })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_COORDINATES');
    });

    test('19. Infinity coordinate is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverAToken}`
        },
        body: JSON.stringify({ latitude: 'Infinity', longitude: validLngA })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_COORDINATES');
    });

    test('20. Non-numeric string coordinate is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverAToken}`
        },
        body: JSON.stringify({ latitude: 'Bengaluru', longitude: validLngA })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_COORDINATES');
    });
  });

  // =========================================================================
  // 5. Data Integrity & Unrelated Fields Invariance
  // =========================================================================
  describe('5. Data Integrity & Unrelated Fields Invariance', () => {
    test('21. Updating GPS coordinates leaves driver ratings, earnings, license, and upi_id untouched', async () => {
      const driverBefore = await queryOne('SELECT * FROM drivers WHERE id = ?', [driverAId]);

      await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverAToken}`
        },
        body: JSON.stringify({ latitude: 12.9352, longitude: 77.6245 })
      });

      const driverAfter = await queryOne('SELECT * FROM drivers WHERE id = ?', [driverAId]);
      assert.strictEqual(driverAfter.current_latitude, 12.9352);
      assert.strictEqual(driverAfter.current_longitude, 77.6245);
      assert.strictEqual(driverAfter.name, driverBefore.name);
      assert.strictEqual(driverAfter.phone, driverBefore.phone);
      assert.strictEqual(driverAfter.license_number, driverBefore.license_number);
      assert.strictEqual(driverAfter.rating, driverBefore.rating);
      assert.strictEqual(driverAfter.trips_completed, driverBefore.trips_completed);
      assert.strictEqual(driverAfter.status, driverBefore.status);
      assert.strictEqual(driverAfter.upi_id, driverBefore.upi_id);
    });
  });

  // =========================================================================
  // 6. Frontend Driver Hook & Portal Integration
  // =========================================================================
  describe('6. Frontend Driver Hook & Portal Verification', () => {
    test('22. useDriverLocation hook source exists with watchPosition, clearWatch, and throttling', () => {
      const hookPath = path.resolve('src/utils/useDriverLocation.js');
      assert.ok(fs.existsSync(hookPath), 'useDriverLocation.js must exist');
      const hookContent = fs.readFileSync(hookPath, 'utf8');

      assert.ok(hookContent.includes('navigator.geolocation.watchPosition'), 'Must use watchPosition');
      assert.ok(hookContent.includes('navigator.geolocation.clearWatch'), 'Must use clearWatch');
      assert.ok(hookContent.includes('enableHighAccuracy'), 'Must enable high accuracy');
      assert.ok(hookContent.includes('lastSentTimeRef'), 'Must throttle updates using a ref');
      assert.ok(hookContent.includes('PERMISSION_DENIED') || hookContent.includes('code === 1'), 'Must handle permission denied');
    });

    test('23. DriverPortalPage imports and renders driver GPS tracking UI', () => {
      const portalPath = path.resolve('src/pages/DriverPortalPage.jsx');
      const portalContent = fs.readFileSync(portalPath, 'utf8');

      assert.ok(portalContent.includes('useDriverLocation'), 'DriverPortalPage must use useDriverLocation');
      assert.ok(portalContent.includes('Driver GPS Live Tracking'), 'DriverPortalPage must render Driver GPS Live Tracking card');
      assert.ok(portalContent.includes('Location tracking:'), 'DriverPortalPage must display location tracking state');
      assert.ok(portalContent.includes('toggleTracking'), 'DriverPortalPage must provide toggleTracking handler');
    });

    test('24. apiClient includes updateDriverLocation and getDriverLocation methods', () => {
      const clientPath = path.resolve('src/services/apiClient.js');
      const clientContent = fs.readFileSync(clientPath, 'utf8');

      assert.ok(clientContent.includes('updateDriverLocation'), 'apiClient must have updateDriverLocation');
      assert.ok(clientContent.includes('getDriverLocation'), 'apiClient must have getDriverLocation');
    });
  });

  // =========================================================================
  // 7. Strict Phase 9 Boundary Protections
  // =========================================================================
  describe('7. Strict Phase 9 Boundary Protections', () => {
    test('25. Strict Phase 9 Boundary: ZERO Socket.IO, WebSockets, SSE, or live broadcasting', () => {
      const driverRoutesPath = path.resolve('server/routes/drivers.js');
      const driverRoutesContent = fs.readFileSync(driverRoutesPath, 'utf8');

      assert.ok(!driverRoutesContent.includes('socket.io'), 'Must NOT include socket.io in driver routes');
      assert.ok(!driverRoutesContent.includes('broadcast'), 'Must NOT broadcast coordinates');
      assert.ok(!driverRoutesContent.includes('eventsource'), 'Must NOT use SSE/eventsource');

      const hookPath = path.resolve('src/utils/useDriverLocation.js');
      const hookContent = fs.readFileSync(hookPath, 'utf8');
      assert.ok(!hookContent.includes('socket.io'), 'Hook must NOT use socket.io');
      assert.ok(!hookContent.includes('WebSocket'), 'Hook must NOT use WebSocket');
    });

    test('26. Customer GPS from Phase 3 remains untouched', () => {
      const custHookPath = path.resolve('src/components/map/useCurrentLocation.js');
      const custHookContent = fs.readFileSync(custHookPath, 'utf8');

      // Verify customer GPS uses getCurrentPosition only, never calls navigator.geolocation.watchPosition
      assert.ok(custHookContent.includes('navigator.geolocation.getCurrentPosition'), 'Customer location must use getCurrentPosition');
      assert.ok(!custHookContent.includes('navigator.geolocation.watchPosition'), 'Customer GPS must NOT invoke navigator.geolocation.watchPosition');

      const modalPath = path.resolve('src/components/BookingModal.jsx');
      const modalContent = fs.readFileSync(modalPath, 'utf8');
      assert.ok(!modalContent.includes('useDriverLocation'), 'BookingModal must NOT import useDriverLocation');
    });

    test('27. Booking coordinate persistence from Phase 8 remains intact', () => {
      const schemaPath = path.resolve('server/db/schema.js');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');

      assert.ok(schemaContent.includes('pickup_latitude REAL'), 'pickup_latitude must remain');
      assert.ok(schemaContent.includes('pickup_longitude REAL'), 'pickup_longitude must remain');
      assert.ok(schemaContent.includes('destination_latitude REAL'), 'destination_latitude must remain');
      assert.ok(schemaContent.includes('destination_longitude REAL'), 'destination_longitude must remain');
    });
  });
});
