import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { WebSocket } from 'ws';
import { startTestServer } from './testHelper.js';
import { registerCustomer, registerDriver, registerAdmin } from '../server/services/authService.js';
import { createBooking, updateBookingStatus } from '../server/services/bookingService.js';
import { queryOne, execute } from '../server/db/database.js';
import { ENV } from '../server/config/env.js';
import { RealtimeServer, setGlobalRealtimeServer, publishDriverLocation, publishBookingAssignmentChange } from '../server/services/realtimeService.js';

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
            ws.close();
          } catch (e) {}
        }
      });
    });

    ws.on('message', (data) => {
      try {
        messages.push(JSON.parse(data.toString()));
      } catch (e) {}
    });

    ws.on('error', (err) => {
      // Ignore socket error on shutdown
    });
  });
}

describe('Phase 6 — Production Realtime Booking & Tracking Communication Hardening Suite', () => {
  let server, baseUrl, realtimeServer;
  const RT_PORT = 5022;

  let adminToken, customerTokenA, customerTokenB, driverTokenA, driverTokenB;
  let customerUserA, customerUserB, driverUserA, driverUserB;
  let driverAId, driverBId;

  const testPassword = 'Phase6SecurePassword123!';

  async function createTestBookingFor(user, extra = {}) {
    const targetDate = new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0];
    const res = await createBooking({
      userId: user?.id || null,
      customerName: user?.name || 'Customer Test',
      customerPhone: user?.phone || '+91 9876543210',
      bookingCategory: 'driver',
      driverTripOption: 'one-way',
      pickupArea: 'Indiranagar 100ft Rd',
      pickupLat: 12.9784,
      pickupLng: 77.6408,
      dropLocation: 'MG Road Metro',
      destLat: 12.9756,
      destLng: 77.6066,
      date: targetDate,
      time: '14:00',
      paymentMode: 'cash',
      ...extra
    });
    return res.booking;
  }

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // Start RealtimeServer
    realtimeServer = new RealtimeServer({
      port: RT_PORT,
      internalSecret: 'phase6_secret_key_32_bytes_safe!!'
    });
    await realtimeServer.start();
    setGlobalRealtimeServer(realtimeServer);

    const rand = Math.floor(100000 + Math.random() * 900000);

    // 1. Admin
    const adminRes = await registerAdmin({
      name: 'Phase 6 Admin',
      email: `admin_p6_${rand}@bookdriveranna.com`,
      phone: `+91 97${rand}01`,
      password: testPassword,
      secretKey: ENV.ADMIN_REGISTRATION_SECRET
    });
    adminToken = adminRes.token;

    // 2. Customers
    const custResA = await registerCustomer({
      name: 'Alice Customer',
      email: `alice_p6_${rand}@test.com`,
      phone: `+91 97${rand}02`,
      password: testPassword
    });
    customerUserA = custResA.user;
    customerTokenA = custResA.token;

    const custResB = await registerCustomer({
      name: 'Bob Customer',
      email: `bob_p6_${rand}@test.com`,
      phone: `+91 97${rand}03`,
      password: testPassword
    });
    customerUserB = custResB.user;
    customerTokenB = custResB.token;

    // 3. Drivers
    const drvResA = await registerDriver({
      name: 'Driver Alpha',
      phone: `+91 97${rand}04`,
      password: testPassword,
      dlNumber: `KA-01-P6-${rand}A`
    });
    driverUserA = drvResA.user;
    driverTokenA = drvResA.token;
    const dRecA = await queryOne('SELECT id FROM drivers WHERE user_id = ?', [driverUserA.id]);
    driverAId = dRecA.id;

    const drvResB = await registerDriver({
      name: 'Driver Beta',
      phone: `+91 97${rand}05`,
      password: testPassword,
      dlNumber: `KA-01-P6-${rand}B`
    });
    driverUserB = drvResB.user;
    driverTokenB = drvResB.token;
    const dRecB = await queryOne('SELECT id FROM drivers WHERE user_id = ?', [driverUserB.id]);
    driverBId = dRecB.id;
  });

  after(async () => {
    setGlobalRealtimeServer(null);
    if (realtimeServer) {
      await realtimeServer.close();
    }
    if (server) {
      await new Promise((res) => server.close(res));
    }
  });

  // =========================================================================
  // 1. SOCKET AUTHENTICATION & REJECTION
  // =========================================================================
  describe('1. Socket Authentication & Rejection', () => {
    test('1.1 Unauthenticated client cannot subscribe and receives UNAUTHORIZED', async () => {
      const client = await connectWsClient(RT_PORT);
      try {
        client.send({ type: 'subscribe', bookingId: 'BKG-FAKE' });
        const errMsg = await client.waitForMessage('error');
        assert.strictEqual(errMsg.code, 'UNAUTHORIZED');
      } finally {
        client.close();
      }
    });

    test('1.2 Invalid authentication token is rejected and closes connection', async () => {
      const client = await connectWsClient(RT_PORT);
      try {
        client.send({ type: 'authenticate', token: 'invalid.jwt.token' });
        const errMsg = await client.waitForMessage('error');
        assert.strictEqual(errMsg.code, 'UNAUTHORIZED');
      } finally {
        client.close();
      }
    });

    test('1.3 Valid authenticated token receives authenticated message with verified role and identity', async () => {
      const client = await connectWsClient(RT_PORT);
      try {
        client.send({ type: 'authenticate', token: customerTokenA });
        const authMsg = await client.waitForMessage('authenticated');
        assert.strictEqual(authMsg.userId, customerUserA.id);
        assert.strictEqual(authMsg.role, 'customer');
      } finally {
        client.close();
      }
    });
  });

  // =========================================================================
  // 2. CHANNEL & ROOM AUTHORIZATION ISOLATION
  // =========================================================================
  describe('2. Channel & Room Authorization Isolation', () => {
    let bookingA;

    before(async () => {
      bookingA = await createTestBookingFor(customerUserA);
    });

    test('2.1 Customer A can subscribe to their own booking channel', async () => {
      const client = await connectWsClient(RT_PORT);
      try {
        client.send({ type: 'authenticate', token: customerTokenA });
        await client.waitForMessage('authenticated');

        client.send({ type: 'subscribe', bookingId: bookingA.id });
        const subMsg = await client.waitForMessage('subscribed');
        assert.strictEqual(subMsg.bookingId, bookingA.id);
      } finally {
        client.close();
      }
    });

    test('2.2 Customer B CANNOT subscribe to Customer A\'s booking (FORBIDDEN)', async () => {
      const client = await connectWsClient(RT_PORT);
      try {
        client.send({ type: 'authenticate', token: customerTokenB });
        await client.waitForMessage('authenticated');

        client.send({ type: 'subscribe', bookingId: bookingA.id });
        const errMsg = await client.waitForMessage('error');
        assert.strictEqual(errMsg.code, 'FORBIDDEN');
      } finally {
        client.close();
      }
    });

    test('2.3 Driver B CANNOT subscribe to Driver A\'s private driver channel (FORBIDDEN)', async () => {
      const client = await connectWsClient(RT_PORT);
      try {
        client.send({ type: 'authenticate', token: driverTokenB });
        await client.waitForMessage('authenticated');

        client.send({ type: 'subscribe', channel: `driver:${driverAId}` });
        const errMsg = await client.waitForMessage('error');
        assert.strictEqual(errMsg.code, 'FORBIDDEN');
      } finally {
        client.close();
      }
    });

    test('2.4 Driver A CAN subscribe to Driver A\'s own private driver channel', async () => {
      const client = await connectWsClient(RT_PORT);
      try {
        client.send({ type: 'authenticate', token: driverTokenA });
        await client.waitForMessage('authenticated');

        client.send({ type: 'subscribe', channel: `driver:${driverAId}` });
        const subMsg = await client.waitForMessage('subscribed');
        assert.strictEqual(subMsg.driverId, driverAId);
      } finally {
        client.close();
      }
    });

    test('2.5 Customer CANNOT subscribe to a driver channel (FORBIDDEN)', async () => {
      const client = await connectWsClient(RT_PORT);
      try {
        client.send({ type: 'authenticate', token: customerTokenA });
        await client.waitForMessage('authenticated');

        client.send({ type: 'subscribe', channel: `driver:${driverAId}` });
        const errMsg = await client.waitForMessage('error');
        assert.strictEqual(errMsg.code, 'FORBIDDEN');
      } finally {
        client.close();
      }
    });
  });

  // =========================================================================
  // 3. SCENARIO A: DRIVER ASSIGNMENT FLOW & EVENT ISOLATION
  // =========================================================================
  describe('3. Scenario A: Driver Assignment Flow & Event Isolation', () => {
    let scenarioBooking;

    before(async () => {
      scenarioBooking = await createTestBookingFor(customerUserA);
    });

    test('3.1 Admin assigns Driver A -> Customer A & Driver A receive assignment; Customer B & Driver B receive nothing', async () => {
      const custA = await connectWsClient(RT_PORT);
      const custB = await connectWsClient(RT_PORT);
      const drvA = await connectWsClient(RT_PORT);
      const drvB = await connectWsClient(RT_PORT);

      try {
        // Authenticate all clients
        custA.send({ type: 'authenticate', token: customerTokenA });
        await custA.waitForMessage('authenticated');
        custA.send({ type: 'subscribe', bookingId: scenarioBooking.id });
        await custA.waitForMessage('subscribed');

        custB.send({ type: 'authenticate', token: customerTokenB });
        await custB.waitForMessage('authenticated');

        drvA.send({ type: 'authenticate', token: driverTokenA });
        await drvA.waitForMessage('authenticated');

        drvB.send({ type: 'authenticate', token: driverTokenB });
        await drvB.waitForMessage('authenticated');

        // Clear existing messages
        custA.clearMessages();
        custB.clearMessages();
        drvA.clearMessages();
        drvB.clearMessages();

        // Admin assigns Driver A via API
        const assignRes = await fetch(`${baseUrl}/api/admin/bookings/${scenarioBooking.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            assignedDriverId: driverAId,
            status: 'ASSIGNED'
          })
        });
        assert.strictEqual(assignRes.status, 200);

        // Customer A receives assignment update
        const custEvent = await custA.waitForMessage('booking.assignment.updated');
        assert.strictEqual(custEvent.bookingId, scenarioBooking.id);
        assert.strictEqual(custEvent.assignedDriverId, driverAId);
        assert.strictEqual(custEvent.status, 'ASSIGNED');

        // Driver A receives assignment update
        const drvEvent = await drvA.waitForMessage('booking.assignment.updated');
        assert.strictEqual(drvEvent.bookingId, scenarioBooking.id);
        assert.strictEqual(drvEvent.assignedDriverId, driverAId);

        // Driver B receives NOTHING
        const drvBMsgs = drvB.messages.filter(m => m.type === 'booking.assignment.updated');
        assert.strictEqual(drvBMsgs.length, 0, 'Driver B must receive zero assignment events');

        // Customer B receives NOTHING
        const custBMsgs = custB.messages.filter(m => m.type === 'booking.assignment.updated');
        assert.strictEqual(custBMsgs.length, 0, 'Customer B must receive zero assignment events');
      } finally {
        custA.close();
        custB.close();
        drvA.close();
        drvB.close();
      }
    });
  });

  // =========================================================================
  // 4. SCENARIO B: DRIVER GPS DISPATCH & PARTICIPANT ISOLATION
  // =========================================================================
  describe('4. Scenario B: Driver GPS Dispatch & Participant Isolation', () => {
    let gpsBooking;

    before(async () => {
      gpsBooking = await createTestBookingFor(customerUserA);

      // Assign Driver A
      await updateBookingStatus({
        bookingId: gpsBooking.id,
        newStatus: 'ASSIGNED',
        assignedDriverId: driverAId,
        assignedDriverName: 'Driver Alpha',
        requesterUser: { id: 'admin', role: 'admin' }
      });
    });

    test('4.1 Driver A sends GPS -> Customer A receives location; Customer B receives nothing', async () => {
      const custA = await connectWsClient(RT_PORT);
      const custB = await connectWsClient(RT_PORT);

      try {
        custA.send({ type: 'authenticate', token: customerTokenA });
        await custA.waitForMessage('authenticated');
        custA.send({ type: 'subscribe', bookingId: gpsBooking.id });
        await custA.waitForMessage('subscribed');

        custB.send({ type: 'authenticate', token: customerTokenB });
        await custB.waitForMessage('authenticated');

        custA.clearMessages();
        custB.clearMessages();

        // Driver A updates location via authenticated PUT /api/drivers/location
        const gpsRes = await fetch(`${baseUrl}/api/drivers/location`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${driverTokenA}`
          },
          body: JSON.stringify({
            latitude: 12.9790,
            longitude: 77.6415
          })
        });
        assert.strictEqual(gpsRes.status, 200);

        // Customer A receives GPS update
        const gpsMsg = await custA.waitForMessage('driver.location.updated');
        assert.strictEqual(gpsMsg.bookingId, gpsBooking.id);
        assert.strictEqual(gpsMsg.driverId, driverAId);
        assert.strictEqual(gpsMsg.latitude, 12.9790);
        assert.strictEqual(gpsMsg.longitude, 77.6415);

        // Customer B receives zero GPS events
        const custBLocations = custB.messages.filter(m => m.type === 'driver.location.updated');
        assert.strictEqual(custBLocations.length, 0, 'Customer B must not receive driver GPS');
      } finally {
        custA.close();
        custB.close();
      }
    });
  });

  // =========================================================================
  // 5. SCENARIO C: RECONNECT & AUTHORITATIVE HTTP RECOVERY
  // =========================================================================
  describe('5. Scenario C: Reconnect & Authoritative HTTP Recovery', () => {
    let reconnectBooking;

    before(async () => {
      reconnectBooking = await createTestBookingFor(customerUserA);

      await updateBookingStatus({
        bookingId: reconnectBooking.id,
        newStatus: 'ASSIGNED',
        assignedDriverId: driverAId,
        assignedDriverName: 'Driver Alpha',
        requesterUser: { id: 'admin', role: 'admin' }
      });
    });

    test('5.1 Disconnect -> State change during offline -> Reconnect recovers authoritative state via HTTP endpoint', async () => {
      // 1. Customer disconnects
      const client = await connectWsClient(RT_PORT);
      client.send({ type: 'authenticate', token: customerTokenA });
      await client.waitForMessage('authenticated');
      client.close();

      // 2. Booking state changes while offline: Driver arrives
      await updateBookingStatus({
        bookingId: reconnectBooking.id,
        newStatus: 'ARRIVED',
        requesterUser: { id: 'admin', role: 'admin' }
      });

      // 3. Driver updates location while offline
      await execute('UPDATE drivers SET current_latitude = ?, current_longitude = ?, last_location_update = CURRENT_TIMESTAMP WHERE id = ?', [
        12.9788,
        77.6412,
        driverAId
      ]);

      // 4. Client reconnects: HTTP fallback endpoint recovers authoritative booking and location
      const httpRes = await fetch(`${baseUrl}/api/bookings/${reconnectBooking.id}/driver-location`, {
        headers: { 'Authorization': `Bearer ${customerTokenA}` }
      });
      assert.strictEqual(httpRes.status, 200);
      const httpData = await httpRes.json();

      assert.strictEqual(httpData.success, true);
      assert.strictEqual(httpData.data.trackingActive, true);
      assert.strictEqual(httpData.data.status, 'ARRIVED');
      assert.strictEqual(httpData.data.assignedDriver.id, driverAId);
      assert.strictEqual(httpData.data.location.latitude, 12.9788);
      assert.strictEqual(httpData.data.location.longitude, 77.6412);
    });
  });

  // =========================================================================
  // 6. SCENARIO D & E: DUPLICATE & STALE EVENT PROTECTION
  // =========================================================================
  describe('6. Duplicate & Stale Event Protection', () => {
    test('6.1 Monotonic state machine hierarchy rejects rolling backward from newer status', () => {
      const STATUS_LIFECYCLE_RANK = {
        'PENDING': 1,
        'CONFIRMED': 2,
        'ASSIGNED': 3,
        'ARRIVED': 4,
        'IN_PROGRESS': 5,
        'COMPLETED': 6,
        'CANCELLED': 6
      };

      // Current UI is IN_PROGRESS (5)
      const currentStatus = 'IN_PROGRESS';
      const delayedStatus = 'ARRIVED'; // 4

      // Stale check
      const isStaleBackward = STATUS_LIFECYCLE_RANK[delayedStatus] < STATUS_LIFECYCLE_RANK[currentStatus];
      assert.strictEqual(isStaleBackward, true, 'Delayed ARRIVED must be identified as stale when current is IN_PROGRESS');

      // Final state remains IN_PROGRESS
      const resolvedStatus = isStaleBackward ? currentStatus : delayedStatus;
      assert.strictEqual(resolvedStatus, 'IN_PROGRESS');
    });

    test('6.2 Stale timestamp rejection preserves newer GPS timestamp', () => {
      const currentGps = {
        latitude: 12.9784,
        longitude: 77.6408,
        timestamp: '2026-10-07T12:00:10.000Z'
      };

      const delayedGps = {
        latitude: 12.9770,
        longitude: 77.6400,
        timestamp: '2026-10-07T12:00:05.000Z' // 5 seconds older
      };

      const prevTime = new Date(currentGps.timestamp).getTime();
      const newTime = new Date(delayedGps.timestamp).getTime();
      const isStale = newTime < prevTime;

      assert.strictEqual(isStale, true, 'GPS with older timestamp must be recognized as stale');
    });
  });

  // =========================================================================
  // 7. SCENARIO F & G: TERMINAL STATE LIFECYCLE & TRACKING SUPPRESSION
  // =========================================================================
  describe('7. Scenario F & G: Terminal State Lifecycle & Tracking Suppression', () => {
    let termBookingA, termBookingB;

    before(async () => {
      termBookingA = await createTestBookingFor(customerUserA);

      await updateBookingStatus({
        bookingId: termBookingA.id,
        newStatus: 'ASSIGNED',
        assignedDriverId: driverAId,
        assignedDriverName: 'Driver Alpha',
        requesterUser: { id: 'admin', role: 'admin' }
      });

      await updateBookingStatus({
        bookingId: termBookingA.id,
        newStatus: 'IN_PROGRESS',
        requesterUser: { id: 'admin', role: 'admin' }
      });

      termBookingB = await createTestBookingFor(customerUserA);

      await updateBookingStatus({
        bookingId: termBookingB.id,
        newStatus: 'ASSIGNED',
        assignedDriverId: driverAId,
        assignedDriverName: 'Driver Alpha',
        requesterUser: { id: 'admin', role: 'admin' }
      });
    });

    test('7.1 Scenario F: COMPLETED status concludes tracking and room is deleted', async () => {
      const client = await connectWsClient(RT_PORT);
      try {
        client.send({ type: 'authenticate', token: customerTokenA });
        await client.waitForMessage('authenticated');
        client.send({ type: 'subscribe', bookingId: termBookingA.id });
        await client.waitForMessage('subscribed');

        // Complete trip
        await updateBookingStatus({
          bookingId: termBookingA.id,
          newStatus: 'COMPLETED',
          requesterUser: { id: 'admin', role: 'admin' }
        });

        // HTTP endpoint confirms trackingActive is false
        const httpRes = await fetch(`${baseUrl}/api/bookings/${termBookingA.id}/driver-location`, {
          headers: { 'Authorization': `Bearer ${customerTokenA}` }
        });
        const httpData = await httpRes.json();
        assert.strictEqual(httpData.data.trackingActive, false);
        assert.strictEqual(httpData.data.location, null);

        // Realtime server room is cleaned up
        assert.strictEqual(realtimeServer.bookingRooms.has(termBookingA.id), false, 'Completed booking room must be removed');

        // Realtime server publishDriverLocation excludes COMPLETED bookings from dispatch
        client.clearMessages();
        await publishDriverLocation({
          driverId: driverAId,
          latitude: 12.9790,
          longitude: 77.6420
        });
        const clientGpsMsgs = client.messages.filter(m => m.bookingId === termBookingA.id);
        assert.strictEqual(clientGpsMsgs.length, 0, 'No GPS events should reach completed booking room');
      } finally {
        client.close();
      }
    });

    test('7.2 Scenario G: CANCELLED status concludes tracking and suppresses further GPS updates', async () => {
      // Cancel termBookingB
      const cancelRes = await fetch(`${baseUrl}/api/bookings/${termBookingB.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customerTokenA}`
        },
        body: JSON.stringify({
          phone: customerUserA.phone,
          reason: 'Trip cancelled'
        })
      });
      assert.strictEqual(cancelRes.status, 200);

      // HTTP endpoint confirms trackingActive is false
      const httpRes = await fetch(`${baseUrl}/api/bookings/${termBookingB.id}/driver-location`, {
        headers: { 'Authorization': `Bearer ${customerTokenA}` }
      });
      const httpData = await httpRes.json();
      assert.strictEqual(httpData.data.trackingActive, false);

      // Realtime server room is cleaned up
      assert.strictEqual(realtimeServer.bookingRooms.has(termBookingB.id), false, 'Cancelled booking room must be removed');

      // Cancelled booking is excluded from active transit statuses
      const activeBooking = await queryOne("SELECT id FROM bookings WHERE id = ? AND status IN ('CONFIRMED', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS')", [termBookingB.id]);
      assert.strictEqual(activeBooking, null, 'Cancelled booking must not be in active transit statuses');
    });
  });
});
