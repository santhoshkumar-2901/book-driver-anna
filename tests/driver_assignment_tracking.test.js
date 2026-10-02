import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { startTestServer } from './testHelper.js';
import { registerAdmin, registerCustomer, registerDriver } from '../server/services/authService.js';
import { createBooking, updateBookingStatus } from '../server/services/bookingService.js';
import { RealtimeServer, setGlobalRealtimeServer, publishDriverLocation, publishBookingAssignmentChange } from '../server/services/realtimeService.js';
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
function connectWsClient(port) {
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
        async waitForMessage(type, timeout = 3500) {
          const start = Date.now();
          while (Date.now() - start < timeout) {
            const found = messages.find(m => m.type === type);
            if (found) return found;
            await new Promise(r => setTimeout(r, 20));
          }
          throw new Error(`Timeout waiting for message type '${type}'. Received: ${JSON.stringify(messages)}`);
        },
        clearMessages() {
          messages.length = 0;
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
      // Ignore if socket closed
    });
  });
}

describe('Phase 12 — Driver Assignment & Live Tracking Integration Suite', () => {
  const TEST_RT_PORT = 5592;
  let testHttpServer;
  let baseUrl;
  let realtimeServer;

  let adminUser, adminToken;
  let customerUser1, customerToken1;
  let customerUser2, customerToken2;
  let driverUserA, driverTokenA, driverRecordA;
  let driverUserB, driverTokenB, driverRecordB;
  let unassignedDriverUser, unassignedDriverToken, unassignedDriverRecord;

  const testPassword = 'Phase12SecurePassword123!';

  before(async () => {
    // 1. Start HTTP test server
    const s = await startTestServer();
    testHttpServer = s.server;
    baseUrl = s.baseUrl;

    // 2. Start Realtime test server
    realtimeServer = new RealtimeServer({
      port: TEST_RT_PORT,
      internalSecret: 'phase12_secret_key_long_enough_32!!'
    });
    await realtimeServer.start();
    setGlobalRealtimeServer(realtimeServer);

    // 3. Register test actors
    const rand = Math.floor(Math.random() * 899999 + 100000); // 6 digits

    // Admin
    const adminRes = await registerAdmin({
      name: 'Super Admin Phase12',
      email: `admin_p12_${rand}@bookdriveranna.com`,
      phone: `+91 98${rand}01`,
      password: testPassword,
      secretKey: ENV.ADMIN_REGISTRATION_SECRET
    });
    adminUser = adminRes.user;
    adminToken = adminRes.token;

    // Customer 1
    const c1Res = await registerCustomer({
      name: 'Customer Phase12 One',
      email: `customer1_p12_${rand}@example.com`,
      phone: `+91 98${rand}02`,
      password: testPassword
    });
    customerUser1 = c1Res.user;
    customerToken1 = c1Res.token;

    // Customer 2
    const c2Res = await registerCustomer({
      name: 'Customer Phase12 Two',
      email: `customer2_p12_${rand}@example.com`,
      phone: `+91 98${rand}03`,
      password: testPassword
    });
    customerUser2 = c2Res.user;
    customerToken2 = c2Res.token;

    // Driver A
    const dAUserRes = await registerDriver({
      name: 'Driver Anna Alpha',
      email: `driver_a_p12_${rand}@bookdriveranna.com`,
      phone: `+91 98${rand}04`,
      password: testPassword,
      dlNumber: `KA-01-P12-${rand}A`,
      experienceYears: 6,
      hubArea: 'Indiranagar'
    });
    driverUserA = dAUserRes.user;
    driverTokenA = dAUserRes.token;
    driverRecordA = await queryOne('SELECT * FROM drivers WHERE user_id = ?', [driverUserA.id]);

    // Driver B
    const dBUserRes = await registerDriver({
      name: 'Driver Anna Beta',
      email: `driver_b_p12_${rand}@bookdriveranna.com`,
      phone: `+91 98${rand}05`,
      password: testPassword,
      dlNumber: `KA-01-P12-${rand}B`,
      experienceYears: 8,
      hubArea: 'Koramangala'
    });
    driverUserB = dBUserRes.user;
    driverTokenB = dBUserRes.token;
    driverRecordB = await queryOne('SELECT * FROM drivers WHERE user_id = ?', [driverUserB.id]);

    // Unassigned Driver C
    const dCUserRes = await registerDriver({
      name: 'Driver Anna Gamma',
      email: `driver_c_p12_${rand}@bookdriveranna.com`,
      phone: `+91 98${rand}06`,
      password: testPassword,
      dlNumber: `KA-01-P12-${rand}C`,
      experienceYears: 4,
      hubArea: 'Whitefield'
    });
    unassignedDriverUser = dCUserRes.user;
    unassignedDriverToken = dCUserRes.token;
    unassignedDriverRecord = await queryOne('SELECT * FROM drivers WHERE user_id = ?', [unassignedDriverUser.id]);
  });

  after(async () => {
    setGlobalRealtimeServer(null);
    if (realtimeServer) {
      await realtimeServer.close();
    }
    if (testHttpServer) {
      await new Promise(r => testHttpServer.close(r));
    }
  });

  // =========================================================================
  // 1. ASSIGNMENT PERSISTENCE
  // =========================================================================
  describe('1. Assignment Persistence & Authority', () => {
    let testBooking;

    before(async () => {
      const created = await createBooking({
        userId: customerUser1.id,
        customerName: 'Customer Phase12 One',
        customerPhone: customerUser1.phone,
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        date: '2026-10-15',
        time: '10:00',
        bookingCategory: 'driver',
        driverTripOption: 'one-way'
      });
      testBooking = created.booking;
    });

    test('1.1 Valid assignment persists correct assigned_driver_id in database', async () => {
      const res = await fetch(`${baseUrl}/api/admin/bookings/${testBooking.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          assignedDriverId: driverRecordA.id,
          driverName: driverRecordA.name,
          driverPhone: driverRecordA.phone
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.booking.assigned_driver_id, driverRecordA.id);
      assert.strictEqual(data.data.booking.status, 'ASSIGNED');

      // Verify DB persistence directly
      const dbRow = await queryOne('SELECT * FROM bookings WHERE id = ?', [testBooking.id]);
      assert.strictEqual(dbRow.assigned_driver_id, driverRecordA.id);
      assert.strictEqual(dbRow.status, 'ASSIGNED');
    });

    test('1.2 Unauthorized customer cannot assign a driver', async () => {
      const res = await fetch(`${baseUrl}/api/admin/bookings/${testBooking.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customerToken1}`
        },
        body: JSON.stringify({
          assignedDriverId: driverRecordB.id
        })
      });
      assert.strictEqual(res.status, 403, 'Customer must be rejected with 403 Forbidden');
      const data = await res.json();
      assert.strictEqual(data.success, false);

      // Verify DB was NOT modified
      const dbRow = await queryOne('SELECT assigned_driver_id FROM bookings WHERE id = ?', [testBooking.id]);
      assert.strictEqual(dbRow.assigned_driver_id, driverRecordA.id);
    });

    test('1.3 Unauthorized driver cannot assign themselves or reassign booking', async () => {
      const res = await fetch(`${baseUrl}/api/admin/bookings/${testBooking.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverTokenB}`
        },
        body: JSON.stringify({
          assignedDriverId: driverRecordB.id
        })
      });
      assert.strictEqual(res.status, 403, 'Driver must be rejected from admin assignment route with 403');
    });

    test('1.4 Customer cannot specify assigned_driver_id during booking creation', async () => {
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customerToken1}`
        },
        body: JSON.stringify({
          customerName: 'Customer One',
          customerPhone: customerUser1.phone,
          pickupArea: 'Indiranagar',
          dropLocation: 'Airport',
          date: '2026-10-16',
          time: '11:00',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          assigned_driver_id: driverRecordB.id,
          assignedDriverId: driverRecordB.id
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 201);
      // Server must NOT accept client-supplied assigned_driver_id
      assert.strictEqual(data.data.booking.assigned_driver_id, null);
      assert.strictEqual(data.data.booking.status, 'PENDING');
    });
  });

  // =========================================================================
  // 2. CUSTOMER VISIBILITY & SENSITIVE DATA PROTECTION
  // =========================================================================
  describe('2. Customer Visibility & Sensitive Data Protection', () => {
    let assignedBooking;

    before(async () => {
      const created = await createBooking({
        userId: customerUser1.id,
        customerName: 'Customer Phase12 One',
        customerPhone: customerUser1.phone,
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        date: '2026-10-17',
        time: '14:00',
        bookingCategory: 'driver',
        driverTripOption: 'one-way'
      });
      assignedBooking = created.booking;

      // Assign Driver A
      await updateBookingStatus({
        bookingId: assignedBooking.id,
        newStatus: 'ASSIGNED',
        assignedDriverId: driverRecordA.id,
        assignedDriverName: driverRecordA.name,
        assignedDriverPhone: driverRecordA.phone,
        requesterUser: adminUser
      });
    });

    test('2.1 Customer receives assignment information for their own booking via GET /api/bookings/:id', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/${assignedBooking.id}`, {
        headers: {
          'Authorization': `Bearer ${customerToken1}`
        }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.booking.assigned_driver_id, driverRecordA.id);
      assert.strictEqual(data.data.booking.assigned_driver_name, driverRecordA.name);
      assert.strictEqual(data.data.booking.status, 'ASSIGNED');
    });

    test('2.2 Customer receives assignment information via POST /api/bookings/lookup', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: assignedBooking.id,
          phone: customerUser1.phone
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.booking.assigned_driver_id, driverRecordA.id);
      assert.strictEqual(data.data.booking.assigned_driver_name, driverRecordA.name);
    });

    test('2.3 Customer CANNOT retrieve assignment information from another customer booking', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/${assignedBooking.id}`, {
        headers: {
          'Authorization': `Bearer ${customerToken2}`
        }
      });
      assert.strictEqual(res.status, 403, 'Unauthorized customer must receive 403 Forbidden');
    });

    test('2.4 Sensitive driver information is NOT exposed to customer', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/${assignedBooking.id}`, {
        headers: {
          'Authorization': `Bearer ${customerToken1}`
        }
      });
      const data = await res.json();
      const b = data.data.booking;

      // Sensitive fields that MUST NEVER be exposed:
      assert.strictEqual(b.license_number, undefined);
      assert.strictEqual(b.password_hash, undefined);
      assert.strictEqual(b.upi_id, undefined);
      assert.strictEqual(b.driver_earnings, undefined);
      assert.strictEqual(b.internal_token, undefined);
    });
  });

  // =========================================================================
  // 3. TRACKING ACTIVATION & INITIAL LOCATION
  // =========================================================================
  describe('3. Tracking Activation & Realtime Subscriptions', () => {
    let unassignedBooking;
    let gpsAssignedBooking;

    before(async () => {
      // 1. Create an unassigned booking
      const created1 = await createBooking({
        userId: customerUser1.id,
        customerName: 'Customer One',
        customerPhone: customerUser1.phone,
        pickupArea: 'Indiranagar',
        dropLocation: 'Airport',
        date: '2026-10-18',
        time: '09:00',
        bookingCategory: 'driver',
        driverTripOption: 'one-way'
      });
      unassignedBooking = created1.booking;

      // 2. Create an assigned booking with driver having known GPS coordinates
      await execute(`
        UPDATE drivers 
        SET current_latitude = 12.9716, current_longitude = 77.5946, last_location_update = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [driverRecordA.id]);

      const created2 = await createBooking({
        userId: customerUser1.id,
        customerName: 'Customer One',
        customerPhone: customerUser1.phone,
        pickupArea: 'Indiranagar',
        dropLocation: 'Koramangala',
        date: '2026-10-18',
        time: '12:00',
        bookingCategory: 'driver',
        driverTripOption: 'one-way'
      });
      gpsAssignedBooking = created2.booking;

      await updateBookingStatus({
        bookingId: gpsAssignedBooking.id,
        newStatus: 'ASSIGNED',
        assignedDriverId: driverRecordA.id,
        assignedDriverName: driverRecordA.name,
        requesterUser: adminUser
      });
    });

    test('3.1 Assigned driver with GPS transmits initial location immediately upon customer subscription', async () => {
      const client = await connectWsClient(TEST_RT_PORT);

      // Authenticate as Customer 1
      client.send({ type: 'authenticate', token: customerToken1 });
      await client.waitForMessage('authenticated');

      // Subscribe to gpsAssignedBooking
      client.send({ type: 'subscribe', bookingId: gpsAssignedBooking.id });
      await client.waitForMessage('subscribed');

      // Verify immediate initial location hydration
      const initialMsg = await client.waitForMessage('driver.location.initial');
      assert.strictEqual(initialMsg.bookingId, gpsAssignedBooking.id);
      assert.strictEqual(initialMsg.driverId, driverRecordA.id);
      assert.strictEqual(Number(initialMsg.latitude), 12.9716);
      assert.strictEqual(Number(initialMsg.longitude), 77.5946);

      client.close();
    });

    test('3.2 Assigned driver with NO GPS does NOT push initial location (Waiting for driver location)', async () => {
      // Create Driver with NULL coordinates
      await execute(`
        UPDATE drivers 
        SET current_latitude = NULL, current_longitude = NULL, last_location_update = NULL
        WHERE id = ?
      `, [driverRecordB.id]);

      const noGpsBookingRes = await createBooking({
        userId: customerUser1.id,
        customerName: 'Customer One',
        customerPhone: customerUser1.phone,
        pickupArea: 'Koramangala',
        dropLocation: 'Indiranagar',
        date: '2026-10-18',
        time: '15:00',
        bookingCategory: 'driver',
        driverTripOption: 'one-way'
      });
      const noGpsBooking = noGpsBookingRes.booking;

      await updateBookingStatus({
        bookingId: noGpsBooking.id,
        newStatus: 'ASSIGNED',
        assignedDriverId: driverRecordB.id,
        assignedDriverName: driverRecordB.name,
        requesterUser: adminUser
      });

      const client = await connectWsClient(TEST_RT_PORT);
      client.send({ type: 'authenticate', token: customerToken1 });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: noGpsBooking.id });
      await client.waitForMessage('subscribed');

      // Wait 300ms: no driver.location.initial should arrive
      await new Promise(r => setTimeout(r, 300));
      const hasInitial = client.messages.some(m => m.type === 'driver.location.initial');
      assert.strictEqual(hasInitial, false, 'Must not send initial location if driver has no GPS');

      client.close();
    });
  });

  // =========================================================================
  // 4. DRIVER UNASSIGNMENT
  // =========================================================================
  describe('4. Driver Unassignment Lifecycle', () => {
    let bookingToUnassign;

    before(async () => {
      // Ensure Driver A has coordinates
      await execute(`
        UPDATE drivers 
        SET current_latitude = 12.9750, current_longitude = 77.5950, last_location_update = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [driverRecordA.id]);

      const created = await createBooking({
        userId: customerUser1.id,
        customerName: 'Customer One',
        customerPhone: customerUser1.phone,
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        date: '2026-10-19',
        time: '10:00',
        bookingCategory: 'driver',
        driverTripOption: 'one-way'
      });
      bookingToUnassign = created.booking;

      await updateBookingStatus({
        bookingId: bookingToUnassign.id,
        newStatus: 'ASSIGNED',
        assignedDriverId: driverRecordA.id,
        assignedDriverName: driverRecordA.name,
        requesterUser: adminUser
      });
    });

    test('4.1 Removing assignment sets assigned_driver_id to null and status to CONFIRMED', async () => {
      const res = await fetch(`${baseUrl}/api/admin/bookings/${bookingToUnassign.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          assignedDriverId: null
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.booking.assigned_driver_id, null);
      assert.strictEqual(data.data.booking.assigned_driver_name, null);
      assert.strictEqual(data.data.booking.status, 'CONFIRMED');

      // Verify DB row
      const dbRow = await queryOne('SELECT * FROM bookings WHERE id = ?', [bookingToUnassign.id]);
      assert.strictEqual(dbRow.assigned_driver_id, null);
      assert.strictEqual(dbRow.status, 'CONFIRMED');
    });

    test('4.2 Unassigned driver location updates are NO LONGER delivered to customer', async () => {
      const client = await connectWsClient(TEST_RT_PORT);
      client.send({ type: 'authenticate', token: customerToken1 });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: bookingToUnassign.id });
      await client.waitForMessage('subscribed');

      client.clearMessages();

      // Driver A publishes GPS location
      await publishDriverLocation({
        driverId: driverRecordA.id,
        latitude: 12.9800,
        longitude: 77.6000
      });

      // Wait 300ms: customer must receive ZERO updates
      await new Promise(r => setTimeout(r, 300));
      const updates = client.messages.filter(m => m.type === 'driver.location.updated');
      assert.strictEqual(updates.length, 0, 'No location updates must be delivered for unassigned booking');

      client.close();
    });
  });

  // =========================================================================
  // 5. DRIVER REASSIGNMENT (DRIVER A -> DRIVER B)
  // =========================================================================
  describe('5. Driver Reassignment (Driver A -> Driver B Isolation)', () => {
    let reassignBooking;

    before(async () => {
      // Driver A starts at [12.9716, 77.5946]
      await execute(`
        UPDATE drivers 
        SET current_latitude = 12.9716, current_longitude = 77.5946, last_location_update = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [driverRecordA.id]);

      // Driver B starts at [12.9352, 77.6245]
      await execute(`
        UPDATE drivers 
        SET current_latitude = 12.9352, current_longitude = 77.6245, last_location_update = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [driverRecordB.id]);

      const created = await createBooking({
        userId: customerUser1.id,
        customerName: 'Customer One',
        customerPhone: customerUser1.phone,
        pickupArea: 'Indiranagar',
        dropLocation: 'Bellandur',
        date: '2026-10-20',
        time: '14:00',
        bookingCategory: 'driver',
        driverTripOption: 'one-way'
      });
      reassignBooking = created.booking;

      // Assign Driver A
      await updateBookingStatus({
        bookingId: reassignBooking.id,
        newStatus: 'ASSIGNED',
        assignedDriverId: driverRecordA.id,
        assignedDriverName: driverRecordA.name,
        requesterUser: adminUser
      });
    });

    test('5.1 Customer tracking receives Driver A initially', async () => {
      const client = await connectWsClient(TEST_RT_PORT);
      client.send({ type: 'authenticate', token: customerToken1 });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: reassignBooking.id });
      await client.waitForMessage('subscribed');

      // Receives Driver A initial location
      const init = await client.waitForMessage('driver.location.initial');
      assert.strictEqual(init.driverId, driverRecordA.id);

      client.clearMessages();

      // Driver A moves
      await publishDriverLocation({
        driverId: driverRecordA.id,
        latitude: 12.9720,
        longitude: 77.5950
      });

      const update = await client.waitForMessage('driver.location.updated');
      assert.strictEqual(update.driverId, driverRecordA.id);
      assert.strictEqual(Number(update.latitude), 12.9720);

      client.close();
    });

    test('5.2 Reassignment to Driver B: Customer receives assignment update and Driver B initial location', async () => {
      const client = await connectWsClient(TEST_RT_PORT);
      client.send({ type: 'authenticate', token: customerToken1 });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: reassignBooking.id });
      await client.waitForMessage('subscribed');
      client.clearMessages();

      // Admin reassigns booking from Driver A to Driver B
      const patchRes = await fetch(`${baseUrl}/api/admin/bookings/${reassignBooking.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          assignedDriverId: driverRecordB.id,
          driverName: driverRecordB.name,
          driverPhone: driverRecordB.phone
        })
      });
      assert.strictEqual(patchRes.status, 200);

      // Customer receives assignment update event over websocket
      const assignEvent = await client.waitForMessage('booking.assignment.updated');
      assert.strictEqual(assignEvent.bookingId, reassignBooking.id);
      assert.strictEqual(assignEvent.assignedDriverId, driverRecordB.id);

      // Customer receives Driver B's initial location
      const bInit = await client.waitForMessage('driver.location.initial');
      assert.strictEqual(bInit.driverId, driverRecordB.id);

      client.close();
    });

    test('5.3 Driver A subsequent GPS updates do NOT reach customer; Driver B updates DO reach customer', async () => {
      const client = await connectWsClient(TEST_RT_PORT);
      client.send({ type: 'authenticate', token: customerToken1 });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: reassignBooking.id });
      await client.waitForMessage('subscribed');
      client.clearMessages();

      // 1. Driver A (unassigned) transmits GPS
      await publishDriverLocation({
        driverId: driverRecordA.id,
        latitude: 12.9999,
        longitude: 77.9999
      });

      // Wait 300ms: verify NO message was received for Driver A
      await new Promise(r => setTimeout(r, 300));
      const driverAMessages = client.messages.filter(m => m.driverId === driverRecordA.id);
      assert.strictEqual(driverAMessages.length, 0, 'Driver A location updates must NOT reach the customer after reassignment');

      // 2. Driver B (currently assigned) transmits GPS
      await publishDriverLocation({
        driverId: driverRecordB.id,
        latitude: 12.9360,
        longitude: 77.6250
      });

      const bUpdate = await client.waitForMessage('driver.location.updated');
      assert.strictEqual(bUpdate.driverId, driverRecordB.id, 'Customer must receive Driver B updates');
      assert.strictEqual(Number(bUpdate.latitude), 12.9360);
      assert.strictEqual(Number(bUpdate.longitude), 77.6250);

      client.close();
    });
  });

  // =========================================================================
  // 6. REALTIME RBAC & AUTHORIZATION SECURITY
  // =========================================================================
  describe('6. Realtime RBAC & Authorization Enforcement', () => {
    let secureBooking;

    before(async () => {
      const created = await createBooking({
        userId: customerUser1.id,
        customerName: 'Customer One',
        customerPhone: customerUser1.phone,
        pickupArea: 'Indiranagar',
        dropLocation: 'Airport',
        date: '2026-10-21',
        time: '10:00',
        bookingCategory: 'driver',
        driverTripOption: 'one-way'
      });
      secureBooking = created.booking;

      await updateBookingStatus({
        bookingId: secureBooking.id,
        newStatus: 'ASSIGNED',
        assignedDriverId: driverRecordB.id,
        assignedDriverName: driverRecordB.name,
        requesterUser: adminUser
      });
    });

    test('6.1 Customer cannot subscribe to another customer booking', async () => {
      const client = await connectWsClient(TEST_RT_PORT);

      // Authenticate as Customer 2 (who does NOT own secureBooking)
      client.send({ type: 'authenticate', token: customerToken2 });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: secureBooking.id });
      const err = await client.waitForMessage('error');
      assert.strictEqual(err.code, 'FORBIDDEN', 'Customer 2 must be rejected with FORBIDDEN');

      client.close();
    });

    test('6.2 Unassigned driver cannot subscribe to the booking', async () => {
      const client = await connectWsClient(TEST_RT_PORT);

      // Authenticate as Unassigned Driver C
      client.send({ type: 'authenticate', token: unassignedDriverToken });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: secureBooking.id });
      const err = await client.waitForMessage('error');
      assert.strictEqual(err.code, 'FORBIDDEN', 'Unassigned Driver C must be rejected with FORBIDDEN');

      client.close();
    });

    test('6.3 Previous driver (Driver A) cannot subscribe to the booking after reassignment', async () => {
      const client = await connectWsClient(TEST_RT_PORT);

      // Authenticate as Driver A (who is no longer assigned to secureBooking)
      client.send({ type: 'authenticate', token: driverTokenA });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: secureBooking.id });
      const err = await client.waitForMessage('error');
      assert.strictEqual(err.code, 'FORBIDDEN', 'Previous Driver A must be rejected with FORBIDDEN');

      client.close();
    });

    test('6.4 Assigned driver (Driver B) CAN subscribe to their own assigned booking', async () => {
      const client = await connectWsClient(TEST_RT_PORT);

      // Authenticate as Driver B (currently assigned)
      client.send({ type: 'authenticate', token: driverTokenB });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: secureBooking.id });
      const sub = await client.waitForMessage('subscribed');
      assert.strictEqual(sub.bookingId, secureBooking.id);

      client.close();
    });

    test('6.5 Admin can observe booking location via realtime subscription', async () => {
      const client = await connectWsClient(TEST_RT_PORT);

      client.send({ type: 'authenticate', token: adminToken });
      await client.waitForMessage('authenticated');

      client.send({ type: 'subscribe', bookingId: secureBooking.id });
      const sub = await client.waitForMessage('subscribed');
      assert.strictEqual(sub.bookingId, secureBooking.id);

      client.close();
    });
  });

  // =========================================================================
  // 7. FRONTEND STATE & INTEGRATION CHECKS
  // =========================================================================
  describe('7. Frontend Integration & UI State Machine', () => {
    test('7.1 BookingSuccessModal correctly consumes assignedDriverId and manages tracking state', () => {
      const modalContent = fs.readFileSync(path.resolve('src/components/BookingSuccessModal.jsx'), 'utf8');

      assert.ok(modalContent.includes('assignedDriverId'), 'Must maintain assignedDriverId state');
      assert.ok(modalContent.includes('hasAssignedDriver'), 'Must compute hasAssignedDriver');
      assert.ok(modalContent.includes('Waiting for driver assignment'), 'Must display Waiting for driver assignment when unassigned');
      assert.ok(modalContent.includes('Driver assigned • Waiting for driver\'s location...'), 'Must distinguish driver assigned without GPS');
      assert.ok(modalContent.includes('Live GPS Active'), 'Must display Live GPS Active when location is received');
    });

    test('7.2 useDriverRealtimeLocation enforces driverId scoping and clears stale location', () => {
      const hookContent = fs.readFileSync(path.resolve('src/utils/useDriverRealtimeLocation.js'), 'utf8');

      assert.ok(hookContent.includes('driverId = null'), 'Hook must accept driverId parameter');
      assert.ok(hookContent.includes('msg.driverId !== driverId'), 'Hook must filter updates by driverId');
      assert.ok(hookContent.includes('booking.assignment.updated'), 'Hook must handle assignment update events');
      assert.ok(hookContent.includes('setLocation(null)'), 'Hook must reset location on disable, reassignment, or unassignment');
    });
  });
});
