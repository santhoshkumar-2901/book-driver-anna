import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { RealtimeServer, setGlobalRealtimeServer, publishDriverLocation } from '../server/services/realtimeService.js';
import { queryOne, execute } from '../server/db/database.js';
import { ENV } from '../server/config/env.js';

// Helper to create test JWT tokens
function makeToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name || 'Test User',
      email: user.email || 'test@example.com',
      phone: user.phone || '+91 9876543210',
      role: (user.role || 'customer').toLowerCase()
    },
    ENV.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Helper to connect and authenticate WebSocket client
function connectClient(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/realtime`);
    const messages = [];

    ws.on('open', () => {
      resolve({
        ws,
        messages,
        send(obj) {
          ws.send(JSON.stringify(obj));
        },
        async waitForMessage(type, timeout = 3000) {
          const start = Date.now();
          while (Date.now() - start < timeout) {
            const found = messages.find(m => m.type === type);
            if (found) return found;
            await new Promise(r => setTimeout(r, 20));
          }
          throw new Error(`Timeout waiting for message of type '${type}'. Received: ${JSON.stringify(messages)}`);
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
      // Don't reject if already open
    });
  });
}

describe('Phase 10 — Realtime Driver Location Transport Suite', () => {
  const TEST_PORT = 5499;
  const TEST_SECRET = 'test_internal_secret_32_chars_long!!';
  let server;

  let testCustomer1;
  let testCustomer2;
  let testDriverUser;
  let testDriverRecord;
  let testAdminUser;
  let testBooking1;
  let testBooking2;

  before(async () => {
    // 1. Start test Realtime Server
    server = new RealtimeServer({
      port: TEST_PORT,
      internalSecret: TEST_SECRET
    });
    await server.start();
    setGlobalRealtimeServer(server);

    // 2. Setup test users and drivers in SQLite test DB
    const uSuffix = Math.floor(Math.random() * 89999 + 10000);
    const dummyHash = '$2a$12$dummyHashForTest12345678901234567890123456789012345678901';

    testCustomer1 = {
      id: `USR-CUST1-${Date.now()}`,
      name: 'Customer One',
      email: `cust1_${Date.now()}_${uSuffix}@test.com`,
      phone: `+91 98${uSuffix}01`,
      role: 'customer',
      status: 'Active'
    };
    await execute(`
      INSERT INTO users (id, name, email, phone, role, status, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [testCustomer1.id, testCustomer1.name, testCustomer1.email, testCustomer1.phone, testCustomer1.role, testCustomer1.status, dummyHash]);

    testCustomer2 = {
      id: `USR-CUST2-${Date.now()}`,
      name: 'Customer Two',
      email: `cust2_${Date.now()}_${uSuffix}@test.com`,
      phone: `+91 98${uSuffix}02`,
      role: 'customer',
      status: 'Active'
    };
    await execute(`
      INSERT INTO users (id, name, email, phone, role, status, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [testCustomer2.id, testCustomer2.name, testCustomer2.email, testCustomer2.phone, testCustomer2.role, testCustomer2.status, dummyHash]);

    testAdminUser = {
      id: `USR-ADM-${Date.now()}`,
      name: 'Admin User',
      email: `admin_${Date.now()}_${uSuffix}@test.com`,
      phone: `+91 98${uSuffix}03`,
      role: 'admin',
      status: 'Active'
    };
    await execute(`
      INSERT INTO users (id, name, email, phone, role, status, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [testAdminUser.id, testAdminUser.name, testAdminUser.email, testAdminUser.phone, testAdminUser.role, testAdminUser.status, dummyHash]);

    testDriverUser = {
      id: `USR-DRV-${Date.now()}`,
      name: 'Driver Anna',
      email: `driver_${Date.now()}_${uSuffix}@test.com`,
      phone: `+91 98${uSuffix}04`,
      role: 'driver',
      status: 'Active'
    };
    await execute(`
      INSERT INTO users (id, name, email, phone, role, status, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [testDriverUser.id, testDriverUser.name, testDriverUser.email, testDriverUser.phone, testDriverUser.role, testDriverUser.status, dummyHash]);

    testDriverRecord = {
      id: `DRV-${Date.now()}`,
      user_id: testDriverUser.id,
      name: testDriverUser.name,
      phone: testDriverUser.phone,
      license_number: `DL-KA01-${Date.now()}`,
      hub_area: 'Indiranagar',
      status: 'Active',
      current_latitude: 12.9716,
      current_longitude: 77.5946
    };
    await execute(`
      INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, status, current_latitude, current_longitude, last_location_update)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [testDriverRecord.id, testDriverRecord.user_id, testDriverRecord.name, testDriverRecord.phone, testDriverRecord.license_number, testDriverRecord.hub_area, testDriverRecord.status, testDriverRecord.current_latitude, testDriverRecord.current_longitude]);

    // 3. Create test bookings
    testBooking1 = {
      id: `BDA-TEST-BK1-${Date.now()}`,
      user_id: testCustomer1.id,
      customer_name: testCustomer1.name,
      customer_phone: testCustomer1.phone,
      booking_type: 'driver',
      trip_type: 'one_way',
      service_name: 'Local Round Trip',
      pickup_area: 'Indiranagar',
      assigned_driver_id: testDriverRecord.id,
      status: 'ASSIGNED',
      date: '2026-10-15',
      time: '10:00 AM',
      calculated_fare: 450.0
    };
    await execute(`
      INSERT INTO bookings (id, user_id, customer_name, customer_phone, booking_type, trip_type, service_name, pickup_area, assigned_driver_id, status, date, time, calculated_fare)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [testBooking1.id, testBooking1.user_id, testBooking1.customer_name, testBooking1.customer_phone, testBooking1.booking_type, testBooking1.trip_type, testBooking1.service_name, testBooking1.pickup_area, testBooking1.assigned_driver_id, testBooking1.status, testBooking1.date, testBooking1.time, testBooking1.calculated_fare]);

    testBooking2 = {
      id: `BDA-TEST-BK2-${Date.now()}`,
      user_id: testCustomer2.id,
      customer_name: testCustomer2.name,
      customer_phone: testCustomer2.phone,
      booking_type: 'driver',
      trip_type: 'one_way',
      service_name: 'Airport Drop',
      pickup_area: 'Koramangala',
      assigned_driver_id: null, // No driver assigned yet
      status: 'PENDING',
      date: '2026-10-16',
      time: '11:00 AM',
      calculated_fare: 800.0
    };
    await execute(`
      INSERT INTO bookings (id, user_id, customer_name, customer_phone, booking_type, trip_type, service_name, pickup_area, assigned_driver_id, status, date, time, calculated_fare)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [testBooking2.id, testBooking2.user_id, testBooking2.customer_name, testBooking2.customer_phone, testBooking2.booking_type, testBooking2.trip_type, testBooking2.service_name, testBooking2.pickup_area, testBooking2.assigned_driver_id, testBooking2.status, testBooking2.date, testBooking2.time, testBooking2.calculated_fare]);
  });

  after(async () => {
    if (server) {
      await server.close();
      setGlobalRealtimeServer(null);
    }
  });

  describe('1. Realtime Connection & Authentication', () => {
    test('1. Valid authenticated connection receives confirmation', async () => {
      const client = await connectClient(TEST_PORT);
      const token = makeToken(testCustomer1);

      client.send({ type: 'authenticate', token });
      const authMsg = await client.waitForMessage('authenticated');

      assert.strictEqual(authMsg.type, 'authenticated');
      assert.strictEqual(authMsg.userId, testCustomer1.id);
      assert.strictEqual(authMsg.role, 'customer');

      client.close();
    });

    test('2. Invalid token is rejected and socket closed', async () => {
      const client = await connectClient(TEST_PORT);
      client.send({ type: 'authenticate', token: 'invalid_malformed_token' });

      const errMsg = await client.waitForMessage('error');
      assert.strictEqual(errMsg.code, 'UNAUTHORIZED');

      client.close();
    });

    test('3. Missing authentication token returns error', async () => {
      const client = await connectClient(TEST_PORT);
      client.send({ type: 'authenticate' });

      const errMsg = await client.waitForMessage('error');
      assert.strictEqual(errMsg.code, 'UNAUTHORIZED');

      client.close();
    });

    test('4. Ping message receives pong', async () => {
      const client = await connectClient(TEST_PORT);
      client.send({ type: 'ping' });

      const pongMsg = await client.waitForMessage('pong');
      assert.strictEqual(pongMsg.type, 'pong');

      client.close();
    });

    test('5. Malformed JSON message returns INVALID_JSON error', async () => {
      const client = await connectClient(TEST_PORT);
      client.ws.send('{ this is not json }');

      const errMsg = await client.waitForMessage('error');
      assert.strictEqual(errMsg.code, 'INVALID_JSON');

      client.close();
    });
  });

  describe('2. Booking-Scoped Authorization & Subscriptions', () => {
    test('6. Unauthenticated client cannot subscribe to location updates', async () => {
      const client = await connectClient(TEST_PORT);
      client.send({ type: 'subscribe', bookingId: testBooking1.id });

      const errMsg = await client.waitForMessage('error');
      assert.strictEqual(errMsg.code, 'UNAUTHORIZED');

      client.close();
    });

    test('7. Customer CAN subscribe to their own authorized booking', async () => {
      const client = await connectClient(TEST_PORT);
      client.send({ type: 'authenticate', token: makeToken(testCustomer1) });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: testBooking1.id });
      const subMsg = await client.waitForMessage('subscribed');
      assert.strictEqual(subMsg.bookingId, testBooking1.id);

      client.close();
    });

    test('8. Subscribed customer receives initial location immediately if driver has coordinates', async () => {
      const client = await connectClient(TEST_PORT);
      client.send({ type: 'authenticate', token: makeToken(testCustomer1) });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: testBooking1.id });
      await client.waitForMessage('subscribed');

      const initialMsg = await client.waitForMessage('driver.location.initial');
      assert.strictEqual(initialMsg.type, 'driver.location.initial');
      assert.strictEqual(initialMsg.bookingId, testBooking1.id);
      assert.strictEqual(initialMsg.driverId, testDriverRecord.id);
      assert.strictEqual(initialMsg.latitude, 12.9716);
      assert.strictEqual(initialMsg.longitude, 77.5946);

      client.close();
    });

    test('9. Customer CANNOT subscribe to another customer booking (FORBIDDEN)', async () => {
      const client = await connectClient(TEST_PORT);
      // Customer 2 tries to subscribe to Customer 1's booking
      client.send({ type: 'authenticate', token: makeToken(testCustomer2) });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: testBooking1.id });
      const errMsg = await client.waitForMessage('error');

      assert.strictEqual(errMsg.code, 'FORBIDDEN');
      assert.strictEqual(errMsg.bookingId, testBooking1.id);

      client.close();
    });

    test('10. Subscription to nonexistent booking returns BOOKING_NOT_FOUND', async () => {
      const client = await connectClient(TEST_PORT);
      client.send({ type: 'authenticate', token: makeToken(testCustomer1) });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: 'NONEXISTENT_BOOKING_99999' });
      const errMsg = await client.waitForMessage('error');

      assert.strictEqual(errMsg.code, 'BOOKING_NOT_FOUND');

      client.close();
    });

    test('11. Driver can subscribe to their assigned booking', async () => {
      const client = await connectClient(TEST_PORT);
      client.send({ type: 'authenticate', token: makeToken(testDriverUser) });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: testBooking1.id });
      const subMsg = await client.waitForMessage('subscribed');

      assert.strictEqual(subMsg.bookingId, testBooking1.id);

      client.close();
    });

    test('12. Driver CANNOT subscribe to a booking assigned to another driver', async () => {
      const client = await connectClient(TEST_PORT);
      client.send({ type: 'authenticate', token: makeToken(testDriverUser) });
      await client.waitForMessage('authenticated');

      // Booking 2 has no driver or different driver
      client.send({ type: 'subscribe', bookingId: testBooking2.id });
      const errMsg = await client.waitForMessage('error');

      assert.strictEqual(errMsg.code, 'FORBIDDEN');

      client.close();
    });

    test('13. Admin can subscribe to any booking', async () => {
      const client = await connectClient(TEST_PORT);
      client.send({ type: 'authenticate', token: makeToken(testAdminUser) });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: testBooking1.id });
      const subMsg = await client.waitForMessage('subscribed');

      assert.strictEqual(subMsg.bookingId, testBooking1.id);

      client.close();
    });

    test('14. Unsubscribe removes client from booking channel', async () => {
      const client = await connectClient(TEST_PORT);
      client.send({ type: 'authenticate', token: makeToken(testCustomer1) });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: testBooking1.id });
      await client.waitForMessage('subscribed');

      client.send({ type: 'unsubscribe', bookingId: testBooking1.id });
      const unsubMsg = await client.waitForMessage('unsubscribed');
      assert.strictEqual(unsubMsg.bookingId, testBooking1.id);

      client.close();
    });
  });

  describe('3. Location Publishing & Minimal Event Security', () => {
    test('15. Publishing valid location delivers driver.location.updated to authorized subscriber', async () => {
      const client = await connectClient(TEST_PORT);
      client.send({ type: 'authenticate', token: makeToken(testCustomer1) });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: testBooking1.id });
      await client.waitForMessage('subscribed');

      // Publish new location for assigned driver
      const result = await publishDriverLocation({
        driverId: testDriverRecord.id,
        latitude: 12.9750,
        longitude: 77.6000
      });

      assert.ok(result.success);
      assert.strictEqual(result.activeBookingsCount, 1);

      const updateMsg = await client.waitForMessage('driver.location.updated');
      assert.strictEqual(updateMsg.type, 'driver.location.updated');
      assert.strictEqual(updateMsg.bookingId, testBooking1.id);
      assert.strictEqual(updateMsg.driverId, testDriverRecord.id);
      assert.strictEqual(updateMsg.latitude, 12.9750);
      assert.strictEqual(updateMsg.longitude, 77.6000);
      assert.ok(updateMsg.timestamp);

      client.close();
    });

    test('16. Event payload does NOT expose sensitive driver or customer data', async () => {
      const client = await connectClient(TEST_PORT);
      client.send({ type: 'authenticate', token: makeToken(testCustomer1) });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: testBooking1.id });
      await client.waitForMessage('subscribed');

      await publishDriverLocation({
        driverId: testDriverRecord.id,
        latitude: 12.9800,
        longitude: 77.6100
      });

      const updateMsg = await client.waitForMessage('driver.location.updated');

      // Strict security assertions
      assert.strictEqual(updateMsg.password, undefined);
      assert.strictEqual(updateMsg.token, undefined);
      assert.strictEqual(updateMsg.jwt, undefined);
      assert.strictEqual(updateMsg.phone, undefined);
      assert.strictEqual(updateMsg.email, undefined);
      assert.strictEqual(updateMsg.earnings, undefined);
      assert.strictEqual(updateMsg.license_number, undefined);
      assert.strictEqual(updateMsg.customer_name, undefined);

      client.close();
    });

    test('17. Invalid coordinates are rejected by publisher', async () => {
      await assert.rejects(
        () => publishDriverLocation({ driverId: testDriverRecord.id, latitude: 195, longitude: 77 }),
        /Coordinates must be valid numbers within bounds/
      );

      await assert.rejects(
        () => publishDriverLocation({ driverId: testDriverRecord.id, latitude: NaN, longitude: 77 }),
        /Coordinates must be valid numbers within bounds/
      );
    });

    test('18. Unsubscribed customer does NOT receive further updates', async () => {
      const client = await connectClient(TEST_PORT);
      client.send({ type: 'authenticate', token: makeToken(testCustomer1) });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: testBooking1.id });
      await client.waitForMessage('subscribed');

      client.send({ type: 'unsubscribe', bookingId: testBooking1.id });
      await client.waitForMessage('unsubscribed');

      // Clear accumulated messages
      client.messages.length = 0;

      await publishDriverLocation({
        driverId: testDriverRecord.id,
        latitude: 12.9850,
        longitude: 77.6200
      });

      await new Promise(r => setTimeout(r, 100));
      const received = client.messages.some(m => m.type === 'driver.location.updated');
      assert.strictEqual(received, false, 'Client must not receive updates after unsubscribing');

      client.close();
    });
  });

  describe('4. Standalone Realtime Service HTTP Webhook', () => {
    test('19. GET /health returns service health status and metrics', async () => {
      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/health`);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.status, 'healthy');
      assert.strictEqual(data.service, 'Book Driver Anna Realtime Service');
      assert.strictEqual(typeof data.connections, 'number');
    });

    test('20. POST /internal/publish rejects requests without valid X-Internal-Secret', async () => {
      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/internal/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': 'wrong_secret'
        },
        body: JSON.stringify({
          driverId: testDriverRecord.id,
          latitude: 12.99,
          longitude: 77.63
        })
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('21. POST /internal/publish with valid secret publishes location to subscribers', async () => {
      const client = await connectClient(TEST_PORT);
      client.send({ type: 'authenticate', token: makeToken(testCustomer1) });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: testBooking1.id });
      await client.waitForMessage('subscribed');

      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/internal/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': TEST_SECRET
        },
        body: JSON.stringify({
          driverId: testDriverRecord.id,
          latitude: 12.9922,
          longitude: 77.6344
        })
      });

      assert.strictEqual(res.status, 200);
      const resData = await res.json();
      assert.strictEqual(resData.success, true);
      assert.strictEqual(resData.data.activeBookingsCount, 1);

      const eventMsg = await client.waitForMessage('driver.location.updated');
      assert.strictEqual(eventMsg.latitude, 12.9922);
      assert.strictEqual(eventMsg.longitude, 77.6344);

      client.close();
    });
  });

  describe('5. Client Hook & Infrastructure Verification', () => {
    test('22. useDriverRealtimeLocation hook exists and handles lifecycle', () => {
      const hookPath = path.resolve('src/utils/useDriverRealtimeLocation.js');
      assert.ok(fs.existsSync(hookPath), 'Hook file must exist');

      const content = fs.readFileSync(hookPath, 'utf8');
      assert.ok(content.includes('new WebSocket'), 'Hook must use native WebSocket');
      assert.ok(content.includes('type: \'authenticate\''), 'Hook must send authenticate message');
      assert.ok(content.includes('type: \'subscribe\''), 'Hook must send subscribe message');
      assert.ok(content.includes('socketRef.current.close(1000'), 'Hook must close socket cleanly on unmount');
      assert.ok(content.includes('reconnectTimeoutRef'), 'Hook must handle reconnection');
    });

    test('23. apiClient exports getRealtimeUrl helper', () => {
      const apiPath = path.resolve('src/services/apiClient.js');
      const content = fs.readFileSync(apiPath, 'utf8');
      assert.ok(content.includes('getRealtimeUrl'), 'apiClient must include getRealtimeUrl');
    });

    test('24. server/realtimeServer.js exists as standalone executable', () => {
      const serverPath = path.resolve('server/realtimeServer.js');
      assert.ok(fs.existsSync(serverPath), 'realtimeServer.js must exist');

      const content = fs.readFileSync(serverPath, 'utf8');
      assert.ok(content.includes('RealtimeServer'), 'Must instantiate RealtimeServer');
    });

    test('25. Environment variables documented in .env.example', () => {
      const envExPath = path.resolve('.env.example');
      const content = fs.readFileSync(envExPath, 'utf8');

      assert.ok(content.includes('REALTIME_PORT'), '.env.example must document REALTIME_PORT');
      assert.ok(content.includes('REALTIME_SERVICE_URL'), '.env.example must document REALTIME_SERVICE_URL');
      assert.ok(content.includes('REALTIME_INTERNAL_SECRET'), '.env.example must document REALTIME_INTERNAL_SECRET');
      assert.ok(content.includes('VITE_REALTIME_URL'), '.env.example must document VITE_REALTIME_URL');
    });
  });

  describe('6. Strict Phase 10 Boundaries & Invariance', () => {
    test('26. Strict Phase 10 Boundary: ZERO live driver marker, route line, or map integration in customer map', () => {
      const mapViewPath = path.resolve('src/components/map/MapView.jsx');
      const mapViewContent = fs.readFileSync(mapViewPath, 'utf8');

      assert.ok(!mapViewContent.includes('useDriverRealtimeLocation'), 'MapView must NOT consume useDriverRealtimeLocation yet (Phase 11)');
      assert.ok(!mapViewContent.includes('LiveDriverMarker'), 'MapView must NOT render LiveDriverMarker yet');
    });

    test('27. Phase 3 Customer GPS and Phase 9 Driver GPS remain isolated and intact', () => {
      const custHook = fs.readFileSync(path.resolve('src/components/map/useCurrentLocation.js'), 'utf8');
      assert.ok(custHook.includes('navigator.geolocation.getCurrentPosition'), 'Customer GPS uses getCurrentPosition');
      assert.ok(!custHook.includes('navigator.geolocation.watchPosition'), 'Customer GPS does not use navigator.geolocation.watchPosition');

      const drvHook = fs.readFileSync(path.resolve('src/utils/useDriverLocation.js'), 'utf8');
      assert.ok(drvHook.includes('navigator.geolocation.watchPosition'), 'Driver GPS uses watchPosition');
      assert.ok(!drvHook.includes('WebSocket'), 'Driver GPS hook does not use WebSocket');
    });

    test('28. Database schema remains unchanged (no duplicate tables or realtime columns added to DB)', async () => {
      const schemaJs = fs.readFileSync(path.resolve('server/db/schema.js'), 'utf8');
      assert.ok(!schemaJs.includes('CREATE TABLE IF NOT EXISTS realtime'), 'No new realtime table needed in DB');
    });
  });
});
