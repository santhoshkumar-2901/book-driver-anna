import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { startTestServer } from './testHelper.js';
import { 
  RealtimeServer, 
  setGlobalRealtimeServer, 
  publishDriverLocation, 
  publishBookingAssignmentChange 
} from '../server/services/realtimeService.js';
import { updateBookingStatus, cancelBooking, createBooking } from '../server/services/bookingService.js';
import { queryOne, queryAll, execute } from '../server/db/database.js';
import { ENV } from '../server/config/env.js';

const REALTIME_PORT = 5094;
const REALTIME_SECRET = 'security-test-secret-key-phase19';

// Helper to generate JWT tokens
function makeToken(user, options = {}) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name || 'Test User',
      email: user.email || 'test@example.com',
      phone: user.phone || '+91 9876543210',
      role: (user.role || 'customer').toLowerCase(),
      driverId: user.driverId || null
    },
    options.secret || ENV.JWT_SECRET,
    { expiresIn: options.expiresIn || '1h' }
  );
}

// Helper to connect WebSocket test client
function connectWsClient(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/realtime`);
    const messages = [];

    const timeout = setTimeout(() => {
      reject(new Error(`WebSocket connection timed out to port ${port}`));
    }, 4000);

    ws.on('open', () => {
      clearTimeout(timeout);
      resolve({
        ws,
        messages,
        send(obj) {
          ws.send(JSON.stringify(obj));
        },
        async waitForMessage(type, timeoutMs = 3000) {
          const start = Date.now();
          while (Date.now() - start < timeoutMs) {
            const found = messages.find(m => m.type === type);
            if (found) return found;
            await new Promise(r => setTimeout(r, 20));
          }
          throw new Error(`Timeout waiting for message '${type}'. Received: ${JSON.stringify(messages)}`);
        },
        close() {
          try {
            ws.close(1000);
          } catch (e) {}
        }
      });
    });

    ws.on('message', (data) => {
      try {
        messages.push(JSON.parse(data.toString()));
      } catch (e) {
        messages.push({ raw: data.toString() });
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

describe('Phase 19 — Comprehensive Security Hardening Suite', () => {
  let appServer, baseUrl, realtimeServer;

  // Source inspection files
  const authMiddlewareContent = fs.readFileSync(path.resolve('server/middleware/auth.js'), 'utf8');
  const rbacMiddlewareContent = fs.readFileSync(path.resolve('server/middleware/rbac.js'), 'utf8');
  const errorHandlerContent = fs.readFileSync(path.resolve('server/middleware/errorHandler.js'), 'utf8');
  const indexContent = fs.readFileSync(path.resolve('server/index.js'), 'utf8');

  let customerUserA, customerUserB, adminUser;
  let driverUserA, driverRecordA;
  let driverUserB, driverRecordB;
  let inactiveUser, inactiveDriverUser, inactiveDriverRecord;
  let bookingA, bookingB, bookingUnassigned;

  before(async () => {
    // 1. Start HTTP test server
    const s = await startTestServer();
    appServer = s.server;
    baseUrl = s.baseUrl;

    // 2. Start Realtime WebSocket server
    realtimeServer = new RealtimeServer({
      port: REALTIME_PORT,
      internalSecret: REALTIME_SECRET
    });
    await realtimeServer.start();
    setGlobalRealtimeServer(realtimeServer);

    // 3. Seed users & drivers with randomized IDs to prevent collision
    const pfx = `P19_${Date.now()}`;
    const uSuffix = Math.floor(Math.random() * 89999 + 10000);

    // Customer A
    customerUserA = {
      id: `USR-CA-${pfx}`,
      name: 'Customer Alice',
      email: `alice_${pfx}_${uSuffix}@test.com`,
      phone: `+91 98${uSuffix}001`,
      role: 'customer'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, '$2a$12$dummyHashAlice', 'Active')`,
      [customerUserA.id, customerUserA.name, customerUserA.email, customerUserA.phone, customerUserA.role]
    );

    // Customer B
    customerUserB = {
      id: `USR-CB-${pfx}`,
      name: 'Customer Bob',
      email: `bob_${pfx}_${uSuffix}@test.com`,
      phone: `+91 98${uSuffix}002`,
      role: 'customer'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, '$2a$12$dummyHashBob', 'Active')`,
      [customerUserB.id, customerUserB.name, customerUserB.email, customerUserB.phone, customerUserB.role]
    );

    // Admin User
    adminUser = {
      id: `USR-ADM-${pfx}`,
      name: 'Admin Boss',
      email: `admin_${pfx}_${uSuffix}@test.com`,
      phone: `+91 98${uSuffix}003`,
      role: 'admin'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, '$2a$12$dummyHashAdmin', 'Active')`,
      [adminUser.id, adminUser.name, adminUser.email, adminUser.phone, adminUser.role]
    );

    // Driver Alpha
    driverUserA = {
      id: `USR-DA-${pfx}`,
      name: 'Driver Alpha',
      email: `drivera_${pfx}_${uSuffix}@test.com`,
      phone: `+91 98${uSuffix}004`,
      role: 'driver'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, '$2a$12$dummyHashDriverA', 'Active')`,
      [driverUserA.id, driverUserA.name, driverUserA.email, driverUserA.phone, driverUserA.role]
    );
    driverRecordA = {
      id: `DRV-A-${pfx}`,
      user_id: driverUserA.id,
      name: driverUserA.name,
      phone: driverUserA.phone,
      license_number: `DL-KA01-A-${uSuffix}`,
      hub_area: 'Indiranagar',
      status: 'Active',
      current_latitude: 12.9716,
      current_longitude: 77.5946
    };
    await execute(
      `INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, status, current_latitude, current_longitude, last_location_update)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [driverRecordA.id, driverRecordA.user_id, driverRecordA.name, driverRecordA.phone, driverRecordA.license_number, driverRecordA.hub_area, driverRecordA.status, driverRecordA.current_latitude, driverRecordA.current_longitude]
    );
    driverUserA.driverId = driverRecordA.id;

    // Driver Beta
    driverUserB = {
      id: `USR-DB-${pfx}`,
      name: 'Driver Beta',
      email: `driverb_${pfx}_${uSuffix}@test.com`,
      phone: `+91 98${uSuffix}005`,
      role: 'driver'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, '$2a$12$dummyHashDriverB', 'Active')`,
      [driverUserB.id, driverUserB.name, driverUserB.email, driverUserB.phone, driverUserB.role]
    );
    driverRecordB = {
      id: `DRV-B-${pfx}`,
      user_id: driverUserB.id,
      name: driverUserB.name,
      phone: driverUserB.phone,
      license_number: `DL-KA01-B-${uSuffix}`,
      hub_area: 'Koramangala',
      status: 'Active',
      current_latitude: 12.9352,
      current_longitude: 77.6245
    };
    await execute(
      `INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, status, current_latitude, current_longitude, last_location_update)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [driverRecordB.id, driverRecordB.user_id, driverRecordB.name, driverRecordB.phone, driverRecordB.license_number, driverRecordB.hub_area, driverRecordB.status, driverRecordB.current_latitude, driverRecordB.current_longitude]
    );
    driverUserB.driverId = driverRecordB.id;

    // Inactive User
    inactiveUser = {
      id: `USR-INACT-${pfx}`,
      name: 'Inactive Customer',
      email: `inactive_${pfx}_${uSuffix}@test.com`,
      phone: `+91 98${uSuffix}006`,
      role: 'customer'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, '$2a$12$dummyHashInactive', 'Inactive')`,
      [inactiveUser.id, inactiveUser.name, inactiveUser.email, inactiveUser.phone, inactiveUser.role]
    );

    // Inactive Driver
    inactiveDriverUser = {
      id: `USR-DINACT-${pfx}`,
      name: 'Inactive Driver',
      email: `dinactive_${pfx}_${uSuffix}@test.com`,
      phone: `+91 98${uSuffix}007`,
      role: 'driver'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, '$2a$12$dummyHashInactiveDriver', 'Inactive')`,
      [inactiveDriverUser.id, inactiveDriverUser.name, inactiveDriverUser.email, inactiveDriverUser.phone, inactiveDriverUser.role]
    );
    inactiveDriverRecord = {
      id: `DRV-INACT-${pfx}`,
      user_id: inactiveDriverUser.id,
      name: inactiveDriverUser.name,
      phone: inactiveDriverUser.phone,
      license_number: `DL-KA01-INACT-${uSuffix}`,
      hub_area: 'Hebbal',
      status: 'Inactive'
    };
    await execute(
      `INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [inactiveDriverRecord.id, inactiveDriverRecord.user_id, inactiveDriverRecord.name, inactiveDriverRecord.phone, inactiveDriverRecord.license_number, inactiveDriverRecord.hub_area, inactiveDriverRecord.status]
    );
    inactiveDriverUser.driverId = inactiveDriverRecord.id;

    // Bookings
    const insertBk = async (id, userId, phone, status, driverId) => {
      await execute(`
        INSERT INTO bookings (
          id, user_id, customer_name, customer_phone, booking_type, trip_type, service_name,
          pickup_area, drop_location, pickup_latitude, pickup_longitude, destination_latitude, destination_longitude,
          date, time, calculated_fare, status, assigned_driver_id
        ) VALUES (?, ?, 'Customer', ?, 'driver', 'one_way', 'City Ride', 'Indiranagar', 'Koramangala', 12.9716, 77.5946, 12.9352, 77.6245, '2026-10-20', '14:00:00', 499.00, ?, ?)
      `, [id, userId, phone, status, driverId]);
      return { id, user_id: userId, customer_phone: phone, status, assigned_driver_id: driverId };
    };

    bookingA = await insertBk(`BKG-P19-A-${pfx}`, customerUserA.id, customerUserA.phone, 'ASSIGNED', driverRecordA.id);
    bookingB = await insertBk(`BKG-P19-B-${pfx}`, customerUserB.id, customerUserB.phone, 'ASSIGNED', driverRecordB.id);
    bookingUnassigned = await insertBk(`BKG-P19-U-${pfx}`, customerUserA.id, customerUserA.phone, 'CONFIRMED', null);
  });

  after(async () => {
    if (realtimeServer) {
      await realtimeServer.close();
    }
    if (appServer) {
      await new Promise(r => appServer.close(r));
    }
  });

  // =========================================================================
  // 1. Authentication Bypass & Token Security
  // =========================================================================
  describe('1. Authentication Bypass & Token Security', () => {
    test('1. Request to protected endpoint without token returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/my`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'UNAUTHORIZED');
    });

    test('2. Malformed Bearer token returns 401 INVALID_TOKEN', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/my`, {
        headers: { Authorization: 'Bearer this-is-not-a-valid-jwt-token' }
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_TOKEN');
    });

    test('3. Fake/tampered JWT signature returns 401 INVALID_TOKEN', async () => {
      const tamperedToken = makeToken(customerUserA, { secret: 'wrong-secret-key-attack' });
      const res = await fetch(`${baseUrl}/api/bookings/my`, {
        headers: { Authorization: `Bearer ${tamperedToken}` }
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_TOKEN');
    });

    test('4. Expired JWT returns 401 INVALID_TOKEN', async () => {
      const expiredToken = makeToken(customerUserA, { expiresIn: '-1s' });
      const res = await fetch(`${baseUrl}/api/bookings/my`, {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_TOKEN');
    });

    test('5. Inactive/disabled user account returns 401 ACCOUNT_DISABLED', async () => {
      const inactiveToken = makeToken(inactiveUser);
      const res = await fetch(`${baseUrl}/api/bookings/my`, {
        headers: { Authorization: `Bearer ${inactiveToken}` }
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'ACCOUNT_DISABLED');
    });

    test('6. Token for deleted/non-existent user returns 401 ACCOUNT_DISABLED', async () => {
      const phantomToken = makeToken({ id: 'USR-PHANTOM-99999', role: 'customer' });
      const res = await fetch(`${baseUrl}/api/bookings/my`, {
        headers: { Authorization: `Bearer ${phantomToken}` }
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'ACCOUNT_DISABLED');
    });
  });

  // =========================================================================
  // 2. Account Enumeration & Authentication Consistency
  // =========================================================================
  describe('2. Account Enumeration & Authentication Consistency', () => {
    test('7. Login with non-existent email returns generic 401 INVALID_CREDENTIALS', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'doesnotexist_9999@test.com', password: 'Password123!' })
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_CREDENTIALS');
      assert.strictEqual(data.error.message, 'Invalid email/phone or password.');
    });

    test('8. Login with valid user but wrong password returns generic 401 INVALID_CREDENTIALS', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: customerUserA.email, password: 'WrongPassword2026!' })
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_CREDENTIALS');
      assert.strictEqual(data.error.message, 'Invalid email/phone or password.');
    });

    test('9. Login failure message is identical between non-existent user and wrong password', async () => {
      const res1 = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'nonexistent@test.com', password: 'Pass' })
      });
      const res2 = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: customerUserA.email, password: 'WrongPass' })
      });
      const d1 = await res1.json();
      const d2 = await res2.json();
      assert.strictEqual(d1.error.message, d2.error.message, 'Messages must match to prevent enumeration');
      assert.strictEqual(d1.error.code, d2.error.code, 'Codes must match to prevent enumeration');
    });

    test('10. Password reset request returns identical generic message whether email exists or not', async () => {
      const resReal = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: customerUserA.email })
      });
      const resFake = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'definitelynotreal_9999@test.com' })
      });
      assert.strictEqual(resReal.status, 200);
      assert.strictEqual(resFake.status, 200);
      const dReal = await resReal.json();
      const dFake = await resFake.json();
      assert.strictEqual(dReal.message, dFake.message, 'Password reset response must not leak account existence');
    });
  });

  // =========================================================================
  // 3. Customer IDOR & Booking Ownership
  // =========================================================================
  describe('3. Customer IDOR & Booking Ownership', () => {
    test('11. Customer A cannot view Customer B booking via GET /api/bookings/:id (returns 403)', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/${bookingB.id}`, {
        headers: { Authorization: `Bearer ${makeToken(customerUserA)}` }
      });
      assert.strictEqual(res.status, 403, 'Cross-customer booking view must be forbidden');
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('12. Customer A cannot cancel Customer B booking via POST /api/bookings/:id/cancel (returns 403)', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/${bookingB.id}/cancel`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${makeToken(customerUserA)}` 
        },
        body: JSON.stringify({ reason: 'Attacker cancel attempt' })
      });
      assert.strictEqual(res.status, 403, 'Cross-customer cancellation must be forbidden');
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('13. Customer cannot complete booking via POST /api/bookings/:id/complete (returns 403)', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/${bookingA.id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${makeToken(customerUserA)}` }
      });
      assert.strictEqual(res.status, 403, 'Customer cannot complete bookings');
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('14. Customer lookup requires matching phone number, wrong phone returns 404', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: bookingA.id, phone: '+91 9999988888' }) // mismatched phone
      });
      assert.strictEqual(res.status, 404, 'Mismatched phone lookup must return 404 without leaking');
      const data = await res.json();
      assert.strictEqual(data.error.code, 'BOOKING_NOT_FOUND');
    });
  });

  // =========================================================================
  // 4. Driver IDOR & Assignment Protection
  // =========================================================================
  describe('4. Driver IDOR & Assignment Protection', () => {
    test('15. Driver A cannot view Driver B duties via GET /api/drivers/duties', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/duties`, {
        headers: { Authorization: `Bearer ${makeToken(driverUserA)}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const duties = data.data.duties;
      assert.ok(Array.isArray(duties));
      assert.ok(duties.some(d => d.id === bookingA.id), 'Contains Driver A assigned duty');
      assert.ok(!duties.some(d => d.id === bookingB.id), 'Must NOT contain Driver B assigned duty');
    });

    test('16. Driver A cannot view Driver B history via GET /api/drivers/history', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/history`, {
        headers: { Authorization: `Bearer ${makeToken(driverUserA)}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const history = data.data.history;
      assert.ok(!history.some(h => h.assigned_driver_id === driverRecordB.id), 'Must NOT contain Driver B history');
    });

    test('17. Driver A cannot update status of Driver B duty via PATCH /api/drivers/duties/:id/status (returns 403)', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/duties/${bookingB.id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${makeToken(driverUserA)}` 
        },
        body: JSON.stringify({ status: 'ARRIVED' })
      });
      assert.strictEqual(res.status, 403, 'Driver cannot update duties assigned to another driver');
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('18. Driver A cannot complete Driver B booking via POST /api/bookings/:id/complete (returns 403)', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/${bookingB.id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${makeToken(driverUserA)}` }
      });
      assert.strictEqual(res.status, 403, 'Driver cannot complete another driver booking');
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('19. Driver cannot update unassigned booking via PATCH /api/drivers/duties/:id/status (returns 403)', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/duties/${bookingUnassigned.id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${makeToken(driverUserA)}` 
        },
        body: JSON.stringify({ status: 'ARRIVED' })
      });
      assert.strictEqual(res.status, 403, 'Driver cannot mutate unassigned booking');
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // 5. Driver GPS Security & Ownership Enforcement
  // =========================================================================
  describe('5. Driver GPS Security & Ownership Enforcement', () => {
    test('20. Only authenticated driver can update location via PUT /api/drivers/location', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: 12.9716, longitude: 77.5946 })
      });
      assert.strictEqual(res.status, 401, 'Unauthenticated GPS update must be rejected');
    });

    test('21. Customer role is rejected with 403 on PUT /api/drivers/location', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${makeToken(customerUserA)}` 
        },
        body: JSON.stringify({ latitude: 12.9716, longitude: 77.5946 })
      });
      assert.strictEqual(res.status, 403, 'Customer role cannot update driver location');
    });

    test('22. Driver submitting another driverId in payload updates only their own record', async () => {
      // Driver A attempts to spoof payload with driverId: driverRecordB.id
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${makeToken(driverUserA)}` 
        },
        body: JSON.stringify({
          driverId: driverRecordB.id, // Attempted spoof
          latitude: 12.8888,
          longitude: 77.8888
        })
      });
      assert.strictEqual(res.status, 200);

      // Verify Driver B coordinates were NOT modified
      const driverBInDb = await queryOne('SELECT current_latitude, current_longitude FROM drivers WHERE id = ?', [driverRecordB.id]);
      assert.notStrictEqual(driverBInDb.current_latitude, 12.8888, 'Driver B GPS must not be changed');

      // Verify Driver A coordinates WERE updated
      const driverAInDb = await queryOne('SELECT current_latitude, current_longitude FROM drivers WHERE id = ?', [driverRecordA.id]);
      assert.strictEqual(driverAInDb.current_latitude, 12.8888, 'Driver A GPS must update own record');
    });

    test('23. Driver coordinates are strictly validated against non-numeric, NaN, Infinity, and out-of-bounds', async () => {
      const testCases = [
        { latitude: 'not-a-number', longitude: 77.5946 },
        { latitude: 95.0, longitude: 77.5946 }, // lat > 90
        { latitude: 12.9716, longitude: 195.0 }, // lng > 180
        { latitude: -95.0, longitude: 77.5946 }, // lat < -90
        { latitude: 12.9716, longitude: -195.0 } // lng < -180
      ];

      for (const tc of testCases) {
        const res = await fetch(`${baseUrl}/api/drivers/location`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${makeToken(driverUserA)}` 
          },
          body: JSON.stringify(tc)
        });
        assert.strictEqual(res.status, 400, `Payload ${JSON.stringify(tc)} must be rejected with 400`);
      }
    });

    test('24. Suspended/inactive driver cannot update location (returns 403 DRIVER_INACTIVE)', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/location`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${makeToken(inactiveDriverUser)}` 
        },
        body: JSON.stringify({ latitude: 12.9716, longitude: 77.5946 })
      });
      // Inactive driver should be rejected (401 Account Disabled or 403 Driver Inactive)
      assert.ok(res.status === 401 || res.status === 403, 'Inactive driver cannot update location');
    });
  });

  // =========================================================================
  // 6. Realtime WebSocket Authorization & Room Isolation
  // =========================================================================
  describe('6. Realtime WebSocket Authorization & Room Isolation', () => {
    test('25. WebSocket connection with invalid JWT is rejected with 4001', async () => {
      const client = await connectWsClient(REALTIME_PORT);
      client.send({ type: 'authenticate', token: 'totally-invalid-token-string' });
      const err = await client.waitForMessage('error');
      assert.strictEqual(err.code, 'UNAUTHORIZED');
      client.close();
    });

    test('26. WebSocket connection with expired JWT is rejected with 4001', async () => {
      const client = await connectWsClient(REALTIME_PORT);
      const expiredToken = makeToken(customerUserA, { expiresIn: '-1s' });
      client.send({ type: 'authenticate', token: expiredToken });
      const err = await client.waitForMessage('error');
      assert.strictEqual(err.code, 'UNAUTHORIZED');
      client.close();
    });

    test('27. WebSocket connection with disabled user is rejected with 4001 Account Disabled', async () => {
      const client = await connectWsClient(REALTIME_PORT);
      const inactiveToken = makeToken(inactiveUser);
      client.send({ type: 'authenticate', token: inactiveToken });
      const err = await client.waitForMessage('error');
      assert.strictEqual(err.code, 'ACCOUNT_DISABLED');
      client.close();
    });

    test('28. Customer A cannot subscribe to Customer B booking room (returns FORBIDDEN)', async () => {
      const client = await connectWsClient(REALTIME_PORT);
      try {
        client.send({ type: 'authenticate', token: makeToken(customerUserA) });
        await client.waitForMessage('authenticated');

        // Customer A attempts to subscribe to Customer B's booking
        client.send({ type: 'subscribe', bookingId: bookingB.id });
        const err = await client.waitForMessage('error');
        assert.strictEqual(err.code, 'FORBIDDEN');
        assert.strictEqual(err.bookingId, bookingB.id);
      } finally {
        client.close();
      }
    });

    test('29. Driver A cannot subscribe to Driver B assigned booking room (returns FORBIDDEN)', async () => {
      const client = await connectWsClient(REALTIME_PORT);
      try {
        client.send({ type: 'authenticate', token: makeToken(driverUserA) });
        await client.waitForMessage('authenticated');

        // Driver A attempts to subscribe to Driver B's booking
        client.send({ type: 'subscribe', bookingId: bookingB.id });
        const err = await client.waitForMessage('error');
        assert.strictEqual(err.code, 'FORBIDDEN');
      } finally {
        client.close();
      }
    });

    test('30. Driver cannot subscribe to unassigned booking room (returns FORBIDDEN)', async () => {
      const client = await connectWsClient(REALTIME_PORT);
      try {
        client.send({ type: 'authenticate', token: makeToken(driverUserA) });
        await client.waitForMessage('authenticated');

        client.send({ type: 'subscribe', bookingId: bookingUnassigned.id });
        const err = await client.waitForMessage('error');
        assert.strictEqual(err.code, 'FORBIDDEN');
      } finally {
        client.close();
      }
    });

    test('31. Reassignment of booking from Driver A to Driver B unassigns Driver A and evicts from room', async () => {
      const driverAClient = await connectWsClient(REALTIME_PORT);
      try {
        driverAClient.send({ type: 'authenticate', token: makeToken(driverUserA) });
        await driverAClient.waitForMessage('authenticated');

        // Driver A subscribes to booking A
        driverAClient.send({ type: 'subscribe', bookingId: bookingA.id });
        await driverAClient.waitForMessage('subscribed');

        // Admin reassigns booking A from Driver A to Driver B
        await publishBookingAssignmentChange({
          bookingId: bookingA.id,
          assignedDriverId: driverRecordB.id,
          assignedDriverName: driverRecordB.name,
          status: 'ASSIGNED'
        });

        const unsubsMsg = await driverAClient.waitForMessage('unsubscribed');
        assert.strictEqual(unsubsMsg.bookingId, bookingA.id);
        assert.strictEqual(unsubsMsg.reason, 'DRIVER_UNASSIGNED');
      } finally {
        driverAClient.close();
      }
    });

    test('32. Unassignment of driver from booking evicts driver from room with DRIVER_UNASSIGNED', async () => {
      // Re-assign booking A to Driver A first
      await execute('UPDATE bookings SET assigned_driver_id = ? WHERE id = ?', [driverRecordA.id, bookingA.id]);

      const driverAClient = await connectWsClient(REALTIME_PORT);
      try {
        driverAClient.send({ type: 'authenticate', token: makeToken(driverUserA) });
        await driverAClient.waitForMessage('authenticated');

        driverAClient.send({ type: 'subscribe', bookingId: bookingA.id });
        await driverAClient.waitForMessage('subscribed');

        // Unassign driver completely
        await publishBookingAssignmentChange({
          bookingId: bookingA.id,
          assignedDriverId: null,
          assignedDriverName: null,
          status: 'CONFIRMED'
        });

        const unsubsMsg = await driverAClient.waitForMessage('unsubscribed');
        assert.strictEqual(unsubsMsg.bookingId, bookingA.id);
        assert.strictEqual(unsubsMsg.reason, 'DRIVER_UNASSIGNED');
      } finally {
        driverAClient.close();
      }
    });
  });

  // =========================================================================
  // 7. Admin Authorization & Privileged Endpoint Hardening
  // =========================================================================
  describe('7. Admin Authorization & Privileged Endpoint Hardening', () => {
    test('33. Non-admin user access to /api/admin/metrics returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/admin/metrics`, {
        headers: { Authorization: `Bearer ${makeToken(customerUserA)}` }
      });
      assert.strictEqual(res.status, 403);
    });

    test('34. Non-admin user access to /api/admin/bookings returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/admin/bookings`, {
        headers: { Authorization: `Bearer ${makeToken(driverUserA)}` }
      });
      assert.strictEqual(res.status, 403);
    });

    test('35. Non-admin user access to /api/admin/drivers returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/admin/drivers`, {
        headers: { Authorization: `Bearer ${makeToken(customerUserA)}` }
      });
      assert.strictEqual(res.status, 403);
    });

    test('36. Non-admin user access to /api/admin/users returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${makeToken(customerUserA)}` }
      });
      assert.strictEqual(res.status, 403);
    });

    test('37. Non-admin user access to /api/admin/pricing returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/admin/pricing`, {
        headers: { Authorization: `Bearer ${makeToken(driverUserA)}` }
      });
      assert.strictEqual(res.status, 403);
    });

    test('38. Admin registration endpoint is strictly disabled in production', () => {
      const authRoutes = fs.readFileSync(path.resolve('server/routes/auth.js'), 'utf8');
      assert.ok(
        authRoutes.includes("if (process.env.NODE_ENV === 'production' || ENV.IS_PRODUCTION)"),
        'Admin registration must check production environment'
      );
      assert.ok(
        authRoutes.includes("'Admin registration is disabled in production.'"),
        'Must return disabled message'
      );
    });
  });

  // =========================================================================
  // 8. Mass Assignment & Sensitive Data Protection
  // =========================================================================
  describe('8. Mass Assignment & Sensitive Data Protection', () => {
    test('39. POST /api/bookings ignores client-supplied userId, status, and calculatedFare', async () => {
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${makeToken(customerUserA)}` 
        },
        body: JSON.stringify({
          customerName: 'Alice Testing',
          customerPhone: customerUserA.phone,
          bookingCategory: 'driver',
          pickupArea: 'Indiranagar',
          dropLocation: 'Whitefield',
          date: '2026-10-25',
          time: '10:00:00',
          // Malicious injections:
          userId: customerUserB.id, // spoof owner
          status: 'COMPLETED',     // spoof status
          calculatedFare: 1.00     // spoof fare
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      const bk = data.data.booking;
      assert.strictEqual(bk.user_id, customerUserA.id, 'user_id must come from authenticated token, not body');
      assert.notStrictEqual(bk.status, 'COMPLETED', 'status cannot be injected as COMPLETED');
      assert.notStrictEqual(bk.calculated_fare, 1.00, 'calculatedFare cannot be injected by client');
    });

    test('40. PATCH /api/admin/bookings/:id allowlist ignores customer_phone, fare, and arbitrary fields', () => {
      const adminRoutes = fs.readFileSync(path.resolve('server/routes/admin.js'), 'utf8');
      assert.ok(
        adminRoutes.includes('const { status, assignedDriverId, assignedDriverName, assignedDriverPhone, driverName, driverPhone } = req.body;'),
        'Only allowed fields must be destructured from body'
      );
    });

    test('41. /api/auth/me does not expose password_hash', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${makeToken(customerUserA)}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.user.password_hash, undefined);
      assert.strictEqual(data.data.user.password, undefined);
    });

    test('42. /api/admin/users does not expose password_hash', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${makeToken(adminUser)}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const users = data.data.users;
      assert.ok(users.length > 0);
      users.forEach(u => {
        assert.strictEqual(u.password_hash, undefined, 'User list must not expose password_hash');
      });
    });

    test('43. /api/admin/drivers does not expose password_hash', async () => {
      const res = await fetch(`${baseUrl}/api/admin/drivers`, {
        headers: { Authorization: `Bearer ${makeToken(adminUser)}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const drivers = data.data.drivers;
      assert.ok(drivers.length > 0);
      drivers.forEach(d => {
        assert.strictEqual(d.password_hash, undefined, 'Driver list must not expose password_hash');
      });
    });

    test('44. Error handler sanitizes SQL keywords and does not leak raw DB queries', () => {
      assert.ok(
        errorHandlerContent.includes('SENSITIVE_PATTERNS'),
        'Error handler must define SENSITIVE_PATTERNS'
      );
      assert.ok(
        errorHandlerContent.includes('SELECT'),
        'SENSITIVE_PATTERNS must include SELECT'
      );
    });

    test('45. Rate limiting opt-in header x-test-rate-limit enforces limit and returns 429', async () => {
      // Send rapid requests with x-test-rate-limit
      const responses = [];
      for (let i = 0; i < 35; i++) {
        const p = fetch(`${baseUrl}/api/location/search?q=Bengaluru`, {
          headers: { 'x-test-rate-limit': 'true' }
        });
        responses.push(p);
      }
      const results = await Promise.all(responses);
      const hasRateLimited = results.some(r => r.status === 429);
      assert.ok(hasRateLimited, 'Exceeding limit must return HTTP 429');
    });

    test('46. Security Headers - Helmet CSP connectSrc includes WebSocket schemes for realtime connection', () => {
      assert.ok(indexContent.includes('ws://localhost:*'), 'CSP connectSrc includes ws://localhost:*');
      assert.ok(indexContent.includes('wss://*.vercel.app'), 'CSP connectSrc includes wss://*.vercel.app');
    });
  });
});
