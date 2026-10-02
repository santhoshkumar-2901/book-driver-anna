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
import { updateBookingStatus, cancelBooking } from '../server/services/bookingService.js';
import { queryOne, queryAll, execute } from '../server/db/database.js';
import { ENV } from '../server/config/env.js';

const REALTIME_PORT = 5092;
const REALTIME_SECRET = 'admin-map-test-secret-key-12345';

// Helper to generate JWT tokens with specific roles
function makeToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name || 'Test User',
      email: user.email || 'test@example.com',
      phone: user.phone || '+91 9876543210',
      role: (user.role || 'customer').toLowerCase(),
      driverId: user.driverId || null
    },
    ENV.JWT_SECRET,
    { expiresIn: '1h' }
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

describe('Phase 18 — Admin Operational Map Suite', () => {
  let appServer, baseUrl, realtimeServer;

  // Source file inspection
  const mapTabPath = path.resolve('src/pages/admin/AdminOperationalMapTab.jsx');
  const mapTabContent = fs.readFileSync(mapTabPath, 'utf8');

  const adminPagePath = path.resolve('src/pages/AdminPage.jsx');
  const adminPageContent = fs.readFileSync(adminPagePath, 'utf8');

  const adminSidebarPath = path.resolve('src/pages/admin/AdminSidebar.jsx');
  const adminSidebarContent = fs.readFileSync(adminSidebarPath, 'utf8');

  const realtimeServicePath = path.resolve('server/services/realtimeService.js');
  const realtimeServiceContent = fs.readFileSync(realtimeServicePath, 'utf8');

  let adminUser, customerUser, driverUserA, driverRecordA, driverUserB, driverRecordB;
  let bookingAssigned, bookingArrived, bookingInProgress, bookingConfirmed, bookingCompleted, bookingCancelled;

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

    // 3. Seed users & drivers
    const pfx = `P18_${Date.now()}`;
    const uSuffix = Math.floor(Math.random() * 89999 + 10000);

    adminUser = {
      id: `USR-ADM-${pfx}`,
      name: 'Super Admin',
      email: `admin_${pfx}_${uSuffix}@test.com`,
      phone: `+91 98${uSuffix}00`,
      role: 'admin'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [adminUser.id, adminUser.name, adminUser.email, adminUser.phone, adminUser.role, '$2a$12$dummyHash']
    );

    customerUser = {
      id: `USR-CUST-${pfx}`,
      name: 'Customer User',
      email: `cust_${pfx}_${uSuffix}@test.com`,
      phone: `+91 98${uSuffix}11`,
      role: 'customer'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [customerUser.id, customerUser.name, customerUser.email, customerUser.phone, customerUser.role, '$2a$12$dummyHash']
    );

    driverUserA = {
      id: `USR-DRVA-${pfx}`,
      name: 'Driver Alpha',
      email: `driver_a_${pfx}_${uSuffix}@test.com`,
      phone: `+91 98${uSuffix}22`,
      role: 'driver'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [driverUserA.id, driverUserA.name, driverUserA.email, driverUserA.phone, driverUserA.role, '$2a$12$dummyHash']
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

    driverUserB = {
      id: `USR-DRVB-${pfx}`,
      name: 'Driver Beta',
      email: `driver_b_${pfx}_${uSuffix}@test.com`,
      phone: `+91 98${uSuffix}33`,
      role: 'driver'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [driverUserB.id, driverUserB.name, driverUserB.email, driverUserB.phone, driverUserB.role, '$2a$12$dummyHash']
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

    // 4. Seed active and terminal bookings
    const insertBooking = async (id, status, driverId, pLat, pLng, dLat, dLng) => {
      await execute(
        `INSERT INTO bookings (
          id, user_id, customer_name, customer_phone, booking_type, trip_type, service_name,
          pickup_area, drop_location, pickup_latitude, pickup_longitude, destination_latitude, destination_longitude,
          date, time, calculated_fare, status, assigned_driver_id
        ) VALUES (?, ?, ?, ?, 'driver', 'one_way', 'City Ride', 'MG Road', 'Whitefield', ?, ?, ?, ?, '2026-10-15', '10:00:00', 499.00, ?, ?)`,
        [id, customerUser.id, customerUser.name, customerUser.phone, pLat, pLng, dLat, dLng, status, driverId]
      );
      return { id, status, assigned_driver_id: driverId, pickup_latitude: pLat, pickup_longitude: pLng, destination_latitude: dLat, destination_longitude: dLng };
    };

    bookingAssigned = await insertBooking(`BKG-P18-ASSIGNED-${pfx}`, 'ASSIGNED', driverRecordA.id, 12.9750, 77.5990, 12.9350, 77.6250);
    bookingArrived = await insertBooking(`BKG-P18-ARRIVED-${pfx}`, 'ASSIGNED', driverRecordB.id, 12.9800, 77.6000, 12.9400, 77.6300);
    bookingInProgress = await insertBooking(`BKG-P18-PROG-${pfx}`, 'IN_PROGRESS', driverRecordA.id, 12.9750, 77.5990, 12.9350, 77.6250);
    bookingConfirmed = await insertBooking(`BKG-P18-CONF-${pfx}`, 'CONFIRMED', null, 12.9710, 77.5900, 12.9200, 77.6100);
    bookingCompleted = await insertBooking(`BKG-P18-COMP-${pfx}`, 'COMPLETED', driverRecordA.id, 12.9750, 77.5990, 12.9350, 77.6250);
    bookingCancelled = await insertBooking(`BKG-P18-CANC-${pfx}`, 'CANCELLED', null, 12.9710, 77.5900, 12.9200, 77.6100);
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
  // 1. Admin API & Realtime Authorization
  // =========================================================================
  describe('1. Admin API & Realtime Authorization', () => {
    test('1. Unauthenticated access to GET /api/admin/drivers returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/admin/drivers`);
      assert.strictEqual(res.status, 401, 'Should require authentication');
    });

    test('2. Unauthenticated access to GET /api/admin/bookings returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/admin/bookings`);
      assert.strictEqual(res.status, 401, 'Should require authentication');
    });

    test('3. Customer role access to GET /api/admin/drivers returns 403', async () => {
      const token = makeToken(customerUser);
      const res = await fetch(`${baseUrl}/api/admin/drivers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      assert.strictEqual(res.status, 403, 'Customer cannot access admin drivers');
    });

    test('4. Customer role access to GET /api/admin/bookings returns 403', async () => {
      const token = makeToken(customerUser);
      const res = await fetch(`${baseUrl}/api/admin/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      assert.strictEqual(res.status, 403, 'Customer cannot access admin bookings');
    });

    test('5. Driver role access to GET /api/admin/bookings returns 403', async () => {
      const token = makeToken(driverUserA);
      const res = await fetch(`${baseUrl}/api/admin/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      assert.strictEqual(res.status, 403, 'Driver cannot access admin bookings');
    });

    test('6. Authenticated admin user access to GET /api/admin/drivers returns 200 with drivers array', async () => {
      const token = makeToken(adminUser);
      const res = await fetch(`${baseUrl}/api/admin/drivers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data?.drivers), 'Should return drivers array');
      assert.ok(body.data.drivers.some(d => d.id === driverRecordA.id), 'Contains seeded Driver A');
    });

    test('7. Authenticated admin user access to GET /api/admin/bookings returns 200 with bookings array', async () => {
      const token = makeToken(adminUser);
      const res = await fetch(`${baseUrl}/api/admin/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data?.bookings), 'Should return bookings array');
      assert.ok(body.data.bookings.some(b => b.id === bookingAssigned.id), 'Contains seeded booking');
    });
  });

  // =========================================================================
  // 2. WebSocket Authentication & Realtime Dispatch
  // =========================================================================
  describe('2. WebSocket Authentication & Realtime Dispatch', () => {
    test('8. WebSocket auth with customer token does not join adminSockets', async () => {
      const client = await connectWsClient(REALTIME_PORT);
      client.send({ type: 'authenticate', token: makeToken(customerUser) });
      const authMsg = await client.waitForMessage('authenticated');
      assert.strictEqual(authMsg.role, 'customer');

      // Check RealtimeServer internal adminSockets count
      assert.strictEqual(realtimeServer.adminSockets.size, 0, 'Customer ws should not be in adminSockets');
      client.close();
    });

    test('9. WebSocket auth with admin token successfully authenticates and registers in adminSockets', async () => {
      const client = await connectWsClient(REALTIME_PORT);
      client.send({ type: 'authenticate', token: makeToken(adminUser) });
      const authMsg = await client.waitForMessage('authenticated');
      assert.strictEqual(authMsg.role, 'admin');

      assert.strictEqual(realtimeServer.adminSockets.size, 1, 'Admin ws should be in adminSockets');
      client.close();
    });

    test('10. Live driver location update via publishDriverLocation is broadcast to connected adminSockets', async () => {
      const adminClient = await connectWsClient(REALTIME_PORT);
      adminClient.send({ type: 'authenticate', token: makeToken(adminUser) });
      await adminClient.waitForMessage('authenticated');

      // Publish location for assigned Driver A
      const testLat = 12.9733;
      const testLng = 77.5966;
      await publishDriverLocation({
        driverId: driverRecordA.id,
        latitude: testLat,
        longitude: testLng
      });

      const locMsg = await adminClient.waitForMessage('driver.location.updated');
      assert.strictEqual(locMsg.driverId, driverRecordA.id);
      assert.strictEqual(locMsg.latitude, testLat);
      assert.strictEqual(locMsg.longitude, testLng);
      adminClient.close();
    });

    test('11. Unassigned driver location update is broadcast to adminSockets with bookingId: null', async () => {
      const adminClient = await connectWsClient(REALTIME_PORT);
      try {
        adminClient.send({ type: 'authenticate', token: makeToken(adminUser) });
        await adminClient.waitForMessage('authenticated');

        // Create a dedicated unassigned roaming driver
        const rSfx = Math.floor(Math.random() * 89999 + 10000);
        const roamingUserId = `USR-ROAM-${Date.now()}-${rSfx}`;
        const roamingUserPhone = `+91 97${rSfx}88`;
        const roamingDriverPhone = `+91 96${rSfx}99`;
        await execute(
          `INSERT INTO users (id, name, email, phone, role, password_hash, status)
           VALUES (?, 'Roaming User', ?, ?, 'driver', '$2a$12$dummyHash', 'Active')`,
          [roamingUserId, `roam_${Date.now()}_${rSfx}@test.com`, roamingUserPhone]
        );

        const roamingDriverId = `DRV-ROAM-${Date.now()}-${rSfx}`;
        await execute(
          `INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, status, current_latitude, current_longitude)
           VALUES (?, ?, 'Roaming Driver', ?, ?, 'Koramangala', 'Active', 12.9300, 77.6200)`,
          [roamingDriverId, roamingUserId, roamingDriverPhone, `DL-ROAM-${rSfx}`]
        );

        await publishDriverLocation({
          driverId: roamingDriverId,
          latitude: 12.9315,
          longitude: 77.6215
        });

        const locMsg = await adminClient.waitForMessage('driver.location.updated');
        assert.strictEqual(locMsg.driverId, roamingDriverId);
        assert.strictEqual(locMsg.latitude, 12.9315);
        assert.strictEqual(locMsg.longitude, 77.6215);
        assert.strictEqual(locMsg.bookingId, null, 'Unassigned driver should broadcast with bookingId null');
      } finally {
        await new Promise(r => {
          adminClient.ws.on('close', r);
          adminClient.close();
        });
      }
    });

    test('12. WebSocket disconnect cleanly unregisters admin socket from adminSockets', async () => {
      const initialSize = realtimeServer.adminSockets.size;
      const client = await connectWsClient(REALTIME_PORT);
      client.send({ type: 'authenticate', token: makeToken(adminUser) });
      await client.waitForMessage('authenticated');
      assert.strictEqual(realtimeServer.adminSockets.size, initialSize + 1);

      await new Promise(r => {
        client.ws.on('close', r);
        client.close();
      });
      await new Promise(r => setTimeout(r, 80));
      assert.strictEqual(realtimeServer.adminSockets.size, initialSize, 'adminSockets decremented on disconnect');
    });
  });

  // =========================================================================
  // 3. Driver Marker Rendering & State Invariants
  // =========================================================================
  describe('3. Driver Marker Rendering & State Invariants', () => {
    test('13. Driver with valid coordinates is mapped to marker position [lat, lng]', () => {
      assert.ok(mapTabContent.includes('getDriverCoords'), 'Component defines coordinate helper');
      assert.ok(mapTabContent.includes('DriverLocationMarker'), 'Component renders DriverLocationMarker');
      assert.ok(mapTabContent.includes('isValidCoord'), 'Component validates coordinate bounds');
    });

    test('14. Driver marker displays name, safe identifier, and omits sensitive password hash', () => {
      assert.ok(mapTabContent.includes('driver.name'), 'Displays driver name');
      assert.ok(!mapTabContent.includes('password_hash'), 'Does not render password hash');
      assert.ok(!mapTabContent.includes('driver.password'), 'Does not expose driver password');
    });

    test('15. Driver duty/online state (Active vs Inactive) is properly exposed for marker badge', () => {
      assert.ok(mapTabContent.includes("driver.status === 'Active'"), 'Differentiates Active status');
      assert.ok(mapTabContent.includes("'Off Duty'"), 'Shows Off Duty for inactive drivers');
    });

    test('16. Driver assigned to active booking references active booking ID and status', () => {
      assert.ok(mapTabContent.includes('driverAssignmentMap'), 'Tracks driver active booking assignment');
      assert.ok(mapTabContent.includes('Assigned: #'), 'Includes assigned booking identifier');
    });

    test('17. Last location update timestamp is parsed and preserved on driver object', () => {
      assert.ok(mapTabContent.includes('last_location_update'), 'Preserves last_location_update timestamp');
      assert.ok(mapTabContent.includes('timestamp: driver.last_location_update'), 'Passes timestamp to marker');
    });
  });

  // =========================================================================
  // 4. Active Booking Objects & Terminal Exclusion
  // =========================================================================
  describe('4. Active Booking Objects & Terminal Exclusion', () => {
    test('18. Active booking statuses (CONFIRMED, ASSIGNED, ARRIVED, IN_PROGRESS) are retained in map state', () => {
      assert.ok(mapTabContent.includes("'CONFIRMED'"), 'Includes CONFIRMED');
      assert.ok(mapTabContent.includes("'ASSIGNED'"), 'Includes ASSIGNED');
      assert.ok(mapTabContent.includes("'ARRIVED'"), 'Includes ARRIVED');
      assert.ok(mapTabContent.includes("'IN_PROGRESS'"), 'Includes IN_PROGRESS');
      assert.ok(mapTabContent.includes('ACTIVE_BOOKING_STATUSES'), 'Uses ACTIVE_BOOKING_STATUSES set');
    });

    test('19. Pickup coordinates render pickup marker with coordinates and label', () => {
      assert.ok(mapTabContent.includes('PickupMarker'), 'Imports and renders PickupMarker');
      assert.ok(mapTabContent.includes('bCoords.pickup'), 'Extracts pickup coordinates');
    });

    test('20. Destination coordinates render destination marker with coordinates and label', () => {
      assert.ok(mapTabContent.includes('DestinationMarker'), 'Imports and renders DestinationMarker');
      assert.ok(mapTabContent.includes('bCoords.destination'), 'Extracts destination coordinates');
    });

    test('21. Assigned driver name and phone are properly bound to active booking object', () => {
      assert.ok(mapTabContent.includes('b.assigned_driver_name'), 'Displays assigned driver name');
      assert.ok(mapTabContent.includes('assignedDriver?.name'), 'Resolves driver profile name');
    });

    test('22. COMPLETED bookings are strictly excluded from operational map', () => {
      assert.ok(mapTabContent.includes('TERMINAL_STATUSES'), 'Defines TERMINAL_STATUSES');
      assert.ok(mapTabContent.includes("'COMPLETED'"), 'Identifies COMPLETED as terminal');
      assert.ok(
        mapTabContent.includes('ACTIVE_BOOKING_STATUSES.has(b.status)'),
        'Only active bookings are admitted to operational state'
      );
    });

    test('23. CANCELLED bookings are strictly excluded from operational map', () => {
      assert.ok(mapTabContent.includes("'CANCELLED'"), 'Identifies CANCELLED as terminal');
      assert.ok(
        mapTabContent.includes('TERMINAL_STATUSES.has(normalizedStatus)'),
        'Realtime terminal event cleans up booking'
      );
    });
  });

  // =========================================================================
  // 5. Route Logic & Trip Lifecycle Transitions
  // =========================================================================
  describe('5. Route Logic & Trip Lifecycle Transitions', () => {
    test('24. ASSIGNED booking triggers approach route from Driver GPS to Pickup coordinates', () => {
      assert.ok(mapTabContent.includes("status === 'ASSIGNED'"), 'Handles ASSIGNED state for routes');
      assert.ok(mapTabContent.includes("'ASSIGNED_APPROACH'"), 'Identifies ASSIGNED_APPROACH route');
      assert.ok(mapTabContent.includes('destLat: bookingCoords.pickup.latitude'), 'Routes to pickup latitude');
    });

    test('25. ARRIVED booking stops and suppresses approach route recalculation', () => {
      assert.ok(mapTabContent.includes("status === 'ARRIVED'"), 'Handles ARRIVED state');
      assert.ok(
        mapTabContent.includes("if (status === 'ARRIVED')"),
        'Suppresses route recalculation for arrived driver'
      );
    });

    test('26. IN_PROGRESS booking triggers active trip route from Driver GPS to Destination coordinates', () => {
      assert.ok(mapTabContent.includes("status === 'IN_PROGRESS'"), 'Handles IN_PROGRESS state');
      assert.ok(mapTabContent.includes("'TRIP_ACTIVE'"), 'Identifies TRIP_ACTIVE route');
      assert.ok(mapTabContent.includes('destLat: bookingCoords.destination.latitude'), 'Routes to destination latitude');
    });

    test('27. COMPLETED booking immediately purges active route from state', () => {
      assert.ok(
        mapTabContent.includes('TERMINAL_STATUSES.has(status)'),
        'Purges route when status is terminal'
      );
    });

    test('28. CANCELLED booking immediately purges active route from state', () => {
      assert.ok(
        mapTabContent.includes('delete copy[bookingId]'),
        'Removes booking route from routes state on cancellation'
      );
    });

    test('29. Movement threshold debounces route recalculation when driver moves < 25 meters', () => {
      assert.ok(mapTabContent.includes('getHaversineDistanceMeters'), 'Uses Haversine distance for threshold');
      assert.ok(mapTabContent.includes('movedMeters < 25'), 'Suppresses recalculation under 25 meters');
    });

    test('30. Significant driver movement (> 25m) triggers route refresh for active trip', () => {
      assert.ok(mapTabContent.includes('lastRouteFetchRef'), 'Tracks last route fetch coordinate and time');
      assert.ok(mapTabContent.includes('apiClient.getLocationRoute'), 'Calls backend route proxy');
    });
  });

  // =========================================================================
  // 6. Driver Assignment, Unassignment & Reassignment
  // =========================================================================
  describe('6. Driver Assignment, Unassignment & Reassignment', () => {
    test('31. Booking assignment associates driver with booking and generates approach route', () => {
      assert.ok(
        mapTabContent.includes('assigned_driver_id: nextDriverId'),
        'Updates assigned driver reference in booking state'
      );
      assert.ok(
        mapTabContent.includes('fetchBookingRoute(updatedBooking, driver)'),
        'Initiates route fetch on new driver assignment'
      );
    });

    test('32. Driver unassignment removes route and booking link while keeping driver marker', () => {
      assert.ok(
        mapTabContent.includes('prevDriverId && prevDriverId !== nextDriverId'),
        'Detects driver change or unassignment'
      );
      assert.ok(
        mapTabContent.includes('delete copy[bookingId]'),
        'Clears route on unassignment'
      );
      assert.ok(
        mapTabContent.includes('validDriversList'),
        'Driver marker remains mapped via valid coordinates'
      );
    });

    test('33. Reassignment from Driver A to Driver B clears Driver A route and binds Driver B', () => {
      assert.ok(
        mapTabContent.includes('lastRouteFetchRef.current[bookingId]'),
        'Invalidates route cache for reassigned booking'
      );
      assert.ok(
        mapTabContent.includes('nextDriverId'),
        'Binds new driver to booking'
      );
    });

    test('34. Old driver coordinates do not control booking route after reassignment', () => {
      assert.ok(
        mapTabContent.includes('b.assigned_driver_id === driverId'),
        'Only driver assigned to booking can trigger its route updates'
      );
    });
  });

  // =========================================================================
  // 7. Viewport Stability & Filter Controls
  // =========================================================================
  describe('7. Viewport Stability & Filter Controls', () => {
    test('35. Initial operational bounds are computed from active drivers and booking coordinates', () => {
      assert.ok(mapTabContent.includes('computeOperationalBounds'), 'Has operational bounds calculator');
      assert.ok(mapTabContent.includes('hasFittedInitialBoundsRef'), 'Tracks initial bounds fit via ref');
      assert.ok(
        mapTabContent.includes('!hasFittedInitialBoundsRef.current'),
        'Only fits bounds automatically on initial load'
      );
    });

    test('36. Realtime driver location updates do not reset bounds or recenter viewport', () => {
      // In onmessage handler for location update: does NOT call setMapBounds!
      const locationHandlerSection = mapTabContent.slice(
        mapTabContent.indexOf("msg.type === 'driver.location.updated'"),
        mapTabContent.indexOf("msg.type === 'booking.assignment.updated'")
      );
      assert.ok(!locationHandlerSection.includes('setMapBounds'), 'Does not call setMapBounds on location update');
      assert.ok(!locationHandlerSection.includes('fitBounds'), 'Does not invoke fitBounds on location update');
    });

    test('37. Explicit fit action (handleFitActiveOperations) recomputes bounds for current operations', () => {
      assert.ok(mapTabContent.includes('handleFitActiveOperations'), 'Provides explicit fit button handler');
      assert.ok(mapTabContent.includes('Fit Active Operations'), 'Renders Fit Active Operations UI button');
    });

    test('38. Filter online restricts driver display to Active drivers', () => {
      assert.ok(mapTabContent.includes("activeFilter === 'online'"), 'Supports online filter');
      assert.ok(mapTabContent.includes("driver.status === 'Active'"), 'Filters for active online drivers');
    });

    test('39. Filter assigned restricts display to drivers with active booking assignments', () => {
      assert.ok(mapTabContent.includes("activeFilter === 'assigned'"), 'Supports assigned filter');
      assert.ok(mapTabContent.includes('isAssigned'), 'Filters for assigned drivers');
    });

    test('40. Filter active_trips restricts display to IN_PROGRESS bookings', () => {
      assert.ok(mapTabContent.includes("activeFilter === 'active_trips'"), 'Supports active_trips filter');
      assert.ok(mapTabContent.includes("booking.status === 'IN_PROGRESS'"), 'Filters for IN_PROGRESS bookings');
    });

    test('41. Filter unassigned restricts display to bookings without assigned drivers', () => {
      assert.ok(mapTabContent.includes("activeFilter === 'unassigned'"), 'Supports unassigned filter');
      assert.ok(mapTabContent.includes('!booking.assigned_driver_id'), 'Filters for unassigned bookings');
    });
  });

  // =========================================================================
  // 8. Fault Tolerance & Coordinate Safety
  // =========================================================================
  describe('8. Fault Tolerance & Coordinate Safety', () => {
    test('42. Driver with null or missing coordinates is safely omitted from map without error', () => {
      assert.ok(mapTabContent.includes('if (!coords) return null;'), 'Skips driver marker if coordinates null');
    });

    test('43. Driver with out-of-bounds coordinates is safely rejected', () => {
      assert.ok(
        mapTabContent.includes('nLat >= -90') && 
        mapTabContent.includes('nLat <= 90') && 
        mapTabContent.includes('nLng >= -180') && 
        mapTabContent.includes('nLng <= 180'),
        'Strictly checks latitude and longitude geographical limits'
      );
    });

    test('44. Booking with malformed pickup or destination coordinates omits faulty marker safely', () => {
      assert.ok(
        mapTabContent.includes('if (coords.pickup)'),
        'Only renders pickup marker if pickup coordinates are valid'
      );
      assert.ok(
        mapTabContent.includes('if (coords.destination)'),
        'Only renders destination marker if destination coordinates are valid'
      );
    });

    test('45. Failed route request does not crash operational map and preserves markers', () => {
      assert.ok(mapTabContent.includes('catch (err)'), 'Protects route calculation with try/catch');
      assert.ok(
        mapTabContent.includes('[AdminMap] Route calculation failed'),
        'Logs warning on route failure instead of throwing'
      );
    });

    test('46. Aborted route controller does not set error state or corrupt routes', () => {
      assert.ok(
        mapTabContent.includes("err.name !== 'AbortError' && !controller.signal.aborted"),
        'Ignores intentional AbortError gracefully'
      );
    });

    test('47. AdminPage correctly routes to Operations Map tab via URL and navigation', () => {
      assert.ok(adminPageContent.includes("'map': '/admin/map'"), 'ADMIN_TAB_ROUTES includes map route');
      assert.ok(adminPageContent.includes("clean === '/admin/map'"), 'parseTabFromPath recognizes /admin/map');
      assert.ok(adminPageContent.includes("<AdminOperationalMapTab"), 'Renders AdminOperationalMapTab on map tab');
      assert.ok(adminSidebarContent.includes("navigateToTab('map')"), 'Sidebar has clickable map navigation button');
    });
  });
});
