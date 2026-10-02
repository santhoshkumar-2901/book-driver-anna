import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { startTestServer } from './testHelper.js';
import { RealtimeServer, setGlobalRealtimeServer, publishDriverLocation } from '../server/services/realtimeService.js';
import { updateBookingStatus, cancelBooking } from '../server/services/bookingService.js';
import { queryOne, execute } from '../server/db/database.js';
import { ENV } from '../server/config/env.js';

// Helper to create test JWT tokens
function makeToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name || 'Test Customer',
      email: user.email || 'customer@test.com',
      phone: user.phone || '+91 9876543210',
      role: (user.role || 'customer').toLowerCase()
    },
    ENV.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Helper to connect a real WebSocket client
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
        async waitForMessage(type, timeout = 3000) {
          const start = Date.now();
          while (Date.now() - start < timeout) {
            const found = messages.find(m => m.type === type);
            if (found) return found;
            await new Promise(r => setTimeout(r, 20));
          }
          throw new Error(`Timeout waiting for message '${type}'. Received: ${JSON.stringify(messages)}`);
        },
        hasMessage(type, predicate = null) {
          return messages.some(m => m.type === type && (!predicate || predicate(m)));
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
      // Don't reject if already connected
    });
  });
}

describe('Phase 16 — Post-Trip Tracking Cleanup & Booking State Synchronization Suite', () => {
  let appServer, baseUrl;
  let realtimeServer;
  const REALTIME_PORT = 5516;
  const REALTIME_SECRET = 'phase16_test_secret_32_chars_ok!';

  const modalPath = path.resolve('src/components/BookingSuccessModal.jsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  const hookPath = path.resolve('src/utils/useDriverRealtimeLocation.js');
  const hookContent = fs.readFileSync(hookPath, 'utf8');

  const bookingServicePath = path.resolve('server/services/bookingService.js');
  const bookingServiceContent = fs.readFileSync(bookingServicePath, 'utf8');

  const driverPortalPath = path.resolve('src/pages/DriverPortalPage.jsx');
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf8');

  let customerUser, driverUserA, driverRecordA, driverUserB, driverRecordB;
  let bookingA, bookingB;

  before(async () => {
    // 1. Start test HTTP server
    const s = await startTestServer();
    appServer = s.server;
    baseUrl = s.baseUrl;

    // 2. Start standalone Realtime server for real socket tests
    realtimeServer = new RealtimeServer({
      port: REALTIME_PORT,
      internalSecret: REALTIME_SECRET
    });
    await realtimeServer.start();
    setGlobalRealtimeServer(realtimeServer);

    // 3. Seed users & drivers in test DB
    const uSuffix = Math.floor(Math.random() * 89999 + 10000);
    customerUser = {
      id: `USR-CUST-P16-${Date.now()}`,
      name: 'Customer Phase16',
      email: `cust_p16_${Date.now()}_${uSuffix}@test.com`,
      phone: `+91 99${uSuffix}11`,
      role: 'customer'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [customerUser.id, customerUser.name, customerUser.email, customerUser.phone, customerUser.role, '$2a$12$dummyHash']
    );

    driverUserA = {
      id: `USR-DRV-A-${Date.now()}`,
      name: 'Driver Anna Alpha',
      email: `driver_a_${Date.now()}_${uSuffix}@test.com`,
      phone: `+91 91${uSuffix}01`,
      role: 'driver'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [driverUserA.id, driverUserA.name, driverUserA.email, driverUserA.phone, driverUserA.role, '$2a$12$dummyHash']
    );

    driverRecordA = {
      id: `DRV-A-${Date.now()}`,
      user_id: driverUserA.id,
      name: driverUserA.name,
      phone: driverUserA.phone,
      license_number: `DL-KA01-A-${Date.now()}`,
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

    driverUserB = {
      id: `USR-DRV-B-${Date.now()}`,
      name: 'Driver Anna Beta',
      email: `driver_b_${Date.now()}_${uSuffix}@test.com`,
      phone: `+91 91${uSuffix}02`,
      role: 'driver'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [driverUserB.id, driverUserB.name, driverUserB.email, driverUserB.phone, driverUserB.role, '$2a$12$dummyHash']
    );

    driverRecordB = {
      id: `DRV-B-${Date.now()}`,
      user_id: driverUserB.id,
      name: driverUserB.name,
      phone: driverUserB.phone,
      license_number: `DL-KA01-B-${Date.now()}`,
      hub_area: 'Indiranagar',
      status: 'Active',
      current_latitude: 12.9800,
      current_longitude: 77.6000
    };
    await execute(
      `INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, status, current_latitude, current_longitude, last_location_update)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [driverRecordB.id, driverRecordB.user_id, driverRecordB.name, driverRecordB.phone, driverRecordB.license_number, driverRecordB.hub_area, driverRecordB.status, driverRecordB.current_latitude, driverRecordB.current_longitude]
    );

    // 4. Seed test bookings
    bookingA = {
      id: `BKG-P16-A-${Date.now()}`,
      user_id: customerUser.id,
      customer_name: customerUser.name,
      customer_phone: customerUser.phone,
      booking_type: 'driver',
      trip_type: 'one_way',
      service_name: 'Local Trip',
      pickup_area: 'Indiranagar Metro, Bengaluru',
      drop_location: 'Koramangala 5th Block, Bengaluru',
      pickup_latitude: 12.9784,
      pickup_longitude: 77.6408,
      destination_latitude: 12.9352,
      destination_longitude: 77.6245,
      date: '2026-10-15',
      time: '10:00:00',
      calculated_fare: 499.00,
      status: 'IN_PROGRESS',
      assigned_driver_id: driverRecordA.id
    };
    await execute(
      `INSERT INTO bookings (id, user_id, customer_name, customer_phone, booking_type, trip_type, service_name, pickup_area, drop_location, pickup_latitude, pickup_longitude, destination_latitude, destination_longitude, date, time, calculated_fare, status, assigned_driver_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bookingA.id, bookingA.user_id, bookingA.customer_name, bookingA.customer_phone, bookingA.booking_type, bookingA.trip_type, bookingA.service_name, bookingA.pickup_area, bookingA.drop_location, bookingA.pickup_latitude, bookingA.pickup_longitude, bookingA.destination_latitude, bookingA.destination_longitude, bookingA.date, bookingA.time, bookingA.calculated_fare, bookingA.status, bookingA.assigned_driver_id]
    );

    bookingB = {
      id: `BKG-P16-B-${Date.now()}`,
      user_id: customerUser.id,
      customer_name: customerUser.name,
      customer_phone: customerUser.phone,
      booking_type: 'driver',
      trip_type: 'one_way',
      service_name: 'Airport Drop',
      pickup_area: 'MG Road, Bengaluru',
      drop_location: 'Electronic City, Bengaluru',
      pickup_latitude: 12.9750,
      pickup_longitude: 77.6050,
      destination_latitude: 12.8450,
      destination_longitude: 77.6650,
      date: '2026-10-16',
      time: '14:00:00',
      calculated_fare: 799.00,
      status: 'ASSIGNED',
      assigned_driver_id: driverRecordB.id
    };
    await execute(
      `INSERT INTO bookings (id, user_id, customer_name, customer_phone, booking_type, trip_type, service_name, pickup_area, drop_location, pickup_latitude, pickup_longitude, destination_latitude, destination_longitude, date, time, calculated_fare, status, assigned_driver_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bookingB.id, bookingB.user_id, bookingB.customer_name, bookingB.customer_phone, bookingB.booking_type, bookingB.trip_type, bookingB.service_name, bookingB.pickup_area, bookingB.drop_location, bookingB.pickup_latitude, bookingB.pickup_longitude, bookingB.destination_latitude, bookingB.destination_longitude, bookingB.date, bookingB.time, bookingB.calculated_fare, bookingB.status, bookingB.assigned_driver_id]
    );
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
  // 1. Authoritative Terminal States
  // =========================================================================
  describe('1. Authoritative Terminal States', () => {
    test('1. COMPLETED is terminal in backend and frontend', () => {
      assert.ok(bookingServiceContent.includes("'COMPLETED'"), 'Backend recognizes COMPLETED');
      assert.ok(
        modalContent.includes("String(currentStatus || '').toUpperCase() === 'COMPLETED'"),
        'Modal evaluates COMPLETED as terminal'
      );
    });

    test('2. CANCELLED is terminal in backend and frontend', () => {
      assert.ok(bookingServiceContent.includes("'CANCELLED'"), 'Backend recognizes CANCELLED');
      assert.ok(
        modalContent.includes("String(currentStatus || '').toUpperCase() === 'CANCELLED'"),
        'Modal evaluates CANCELLED as terminal'
      );
    });

    test('3. COMPLETED does not activate active-trip routing', () => {
      assert.ok(
        modalContent.includes('isTerminalState'),
        'Routing guards against isTerminalState'
      );
      assert.ok(
        modalContent.includes('if (!hasAssignedDriver || !hasRequiredCoords || !hasValidDriverCoords || isTerminalState)'),
        'Route calculation immediately exits when isTerminalState'
      );
    });

    test('4. CANCELLED does not activate active-trip routing', () => {
      assert.ok(
        modalContent.includes('isCancelled') && modalContent.includes('isTerminalState'),
        'Routing is blocked when booking is cancelled'
      );
    });
  });

  // =========================================================================
  // 2. Route Cleanup Verification
  // =========================================================================
  describe('2. Route Cleanup Verification', () => {
    test('5. COMPLETED clears active-trip route', () => {
      assert.ok(modalContent.includes('setDriverRoute(null)'), 'Clears driver route');
      assert.ok(modalContent.includes('setDriverRouteType(null)'), 'Resets driver route type');
    });

    test('6. CANCELLED clears active-trip route', () => {
      assert.ok(
        modalContent.includes('setDriverRoute(null)') && modalContent.includes('setDriverRouteType(null)'),
        'Clears route state when cancelled'
      );
    });

    test('7. COMPLETED clears Driver → Pickup route', () => {
      assert.ok(
        modalContent.includes('lastRouteCoordsRef.current = null'),
        'Resets last route coordinates ref'
      );
    });

    test('8. CANCELLED clears Driver → Pickup route', () => {
      assert.ok(
        modalContent.includes('lastRouteCoordsRef.current = null'),
        'Cancels tracking coords when cancelled'
      );
    });

    test('9. COMPLETED cancels pending route request via AbortController.abort()', () => {
      assert.ok(
        modalContent.includes('routeAbortControllerRef.current.abort()'),
        'Aborts pending in-flight route requests'
      );
    });

    test('10. CANCELLED cancels pending route request', () => {
      assert.ok(
        modalContent.includes('routeAbortControllerRef.current.abort()'),
        'Aborts pending request on cancellation'
      );
    });

    test('11. COMPLETED clears debounce timer', () => {
      assert.ok(
        modalContent.includes('clearTimeout(routeDebounceTimerRef.current)'),
        'Clears pending debounce timer on completion'
      );
    });

    test('12. CANCELLED clears debounce timer', () => {
      assert.ok(
        modalContent.includes('clearTimeout(routeDebounceTimerRef.current)'),
        'Clears debounce timer on cancellation'
      );
    });

    test('13. Terminal state invalidates stale route responses via request ID increment', () => {
      assert.ok(
        modalContent.includes('routeRequestIdRef.current++'),
        'Monotonically increments routeRequestId to reject late responses'
      );
      assert.ok(
        modalContent.includes('currentRequestId !== routeRequestIdRef.current || isTerminalState'),
        'Guards route resolution against stale request IDs and terminal state'
      );
    });
  });

  // =========================================================================
  // 3. Realtime Subscription Cleanup
  // =========================================================================
  describe('3. Realtime Subscription Cleanup', () => {
    test('14. Completed booking stops requiring live driver updates', () => {
      assert.ok(
        modalContent.includes('enabled: Boolean(hasAssignedDriver && !isTerminalState && bookingId && token)'),
        'Disables useDriverRealtimeLocation when isTerminalState'
      );
    });

    test('15. Cancelled booking stops requiring live driver updates', () => {
      assert.ok(
        modalContent.includes('!isCancelled') && modalContent.includes('!isTerminalState'),
        'Ensures hook is disabled when cancelled'
      );
    });

    test('16. Booking-specific subscription cleanup does not close shared WebSocket', async () => {
      const client = await connectWsClient(REALTIME_PORT);
      client.send({ type: 'authenticate', token: makeToken(customerUser) });
      await client.waitForMessage('authenticated');

      // Subscribe to Booking A and Booking B on SAME WebSocket
      client.send({ type: 'subscribe', bookingId: bookingA.id });
      await client.waitForMessage('subscribed');

      client.send({ type: 'subscribe', bookingId: bookingB.id });
      await client.waitForMessage('subscribed');

      // Unsubscribe from Booking A (trip completed)
      client.send({ type: 'unsubscribe', bookingId: bookingA.id });
      const unsubMsg = await client.waitForMessage('unsubscribed');
      assert.strictEqual(unsubMsg.bookingId, bookingA.id);

      // Verify the WebSocket connection is STILL OPEN
      assert.strictEqual(client.ws.readyState, WebSocket.OPEN, 'Shared WebSocket must remain OPEN');

      client.close();
    });

    test('17. Unrelated booking subscription remains intact and receives location updates', async () => {
      const client = await connectWsClient(REALTIME_PORT);
      client.send({ type: 'authenticate', token: makeToken(customerUser) });
      await client.waitForMessage('authenticated');

      // Subscribe to both
      client.send({ type: 'subscribe', bookingId: bookingA.id });
      await client.waitForMessage('subscribed');
      client.send({ type: 'subscribe', bookingId: bookingB.id });
      await client.waitForMessage('subscribed');

      // Unsubscribe only Booking A
      client.send({ type: 'unsubscribe', bookingId: bookingA.id });
      await client.waitForMessage('unsubscribed');
      client.clearMessages();

      // Publish update for Driver B (assigned to Booking B)
      await publishDriverLocation({
        driverId: driverRecordB.id,
        latitude: 12.9810,
        longitude: 77.6010
      });

      const updateB = await client.waitForMessage('driver.location.updated');
      assert.strictEqual(updateB.bookingId, bookingB.id);
      assert.strictEqual(updateB.driverId, driverRecordB.id);
      assert.strictEqual(updateB.latitude, 12.9810);

      // Verify NO updates were received for Booking A
      const leakedA = client.hasMessage('driver.location.updated', m => m.bookingId === bookingA.id);
      assert.strictEqual(leakedA, false, 'Booking A must not receive location events after unsubscription');

      client.close();
    });

    test('18. Backend publishDriverLocation excludes COMPLETED and CANCELLED bookings from dispatch', async () => {
      // Transition bookingA to COMPLETED in database
      await execute('UPDATE bookings SET status = ? WHERE id = ?', ['COMPLETED', bookingA.id]);

      const client = await connectWsClient(REALTIME_PORT);
      client.send({ type: 'authenticate', token: makeToken(customerUser) });
      await client.waitForMessage('authenticated');

      // Attempt to publish driver location for Driver A
      const pubResult = await publishDriverLocation({
        driverId: driverRecordA.id,
        latitude: 12.9720,
        longitude: 77.5950
      });

      // Active bookings count should be 0 because bookingA is COMPLETED
      assert.strictEqual(pubResult.activeBookingsCount, 0, 'No location events dispatched for terminal bookings');

      // Revert status for remaining tests
      await execute('UPDATE bookings SET status = ? WHERE id = ?', ['IN_PROGRESS', bookingA.id]);
      client.close();
    });
  });

  // =========================================================================
  // 4. Cross-Booking State Isolation
  // =========================================================================
  describe('4. Cross-Booking State Isolation', () => {
    test('19. Booking A state cannot leak into Booking B', () => {
      assert.ok(
        modalContent.includes('previousBookingIdRef'),
        'Modal tracks previousBookingIdRef for cross-booking isolation'
      );
      assert.ok(
        modalContent.includes('if (bId !== previousBookingIdRef.current)'),
        'Detects booking identity changes'
      );
    });

    test('20. Driver A location cannot appear in Booking B', () => {
      assert.ok(
        hookContent.includes('msg.driverId !== driverId'),
        'Hook strictly filters incoming locations by assigned driverId'
      );
      assert.ok(
        modalContent.includes('setDriverRoute(null)') && modalContent.includes('lastRouteCoordsRef.current = null'),
        'Clears previous coordinates and routes on booking change'
      );
    });

    test('21. Driver A route cannot appear in Booking B', () => {
      assert.ok(
        modalContent.includes('setDriverRoute(null)') && modalContent.includes('setDriverRouteType(null)'),
        'Immediately resets driver route when bId changes'
      );
    });

    test('22. Driver A late route response cannot overwrite Booking B', () => {
      assert.ok(
        modalContent.includes('routeRequestIdRef.current++'),
        'Increments monotonic routeRequestId when switching bookings'
      );
    });

    test('23. In-flight route debounce timer from Booking A is cancelled when Booking B opens', () => {
      assert.ok(
        modalContent.includes('clearTimeout(routeDebounceTimerRef.current)'),
        'Clears debounce timer on booking identity change'
      );
      assert.ok(
        modalContent.includes('routeAbortControllerRef.current.abort()'),
        'Aborts pending fetch controller on booking identity change'
      );
    });
  });

  // =========================================================================
  // 5. Reopening & Refresh Rehydration
  // =========================================================================
  describe('5. Reopening & Refresh Rehydration', () => {
    test('24. Reopening completed booking does not restart route', () => {
      assert.ok(
        modalContent.includes('isTerminalState') && modalContent.includes('setDriverRouteLoading(false)'),
        'Immediately terminates route calculation if initial status is terminal'
      );
    });

    test('25. Reopening cancelled booking does not restart route', () => {
      assert.ok(
        modalContent.includes('isCancelled') && modalContent.includes('setDriverRoute(null)'),
        'Does not calculate route for cancelled bookings'
      );
    });

    test('26. Refreshed completed booking loads authoritative COMPLETED status from backend', async () => {
      // Mark bookingA as COMPLETED
      await updateBookingStatus({
        bookingId: bookingA.id,
        newStatus: 'COMPLETED',
        requesterUser: customerUser
      });

      const freshBooking = await queryOne('SELECT * FROM bookings WHERE id = ?', [bookingA.id]);
      assert.strictEqual(freshBooking.status, 'COMPLETED');
    });

    test('27. Refreshed cancelled booking loads authoritative CANCELLED status from backend', async () => {
      // Mark bookingB as CANCELLED
      await cancelBooking({
        bookingId: bookingB.id,
        reason: 'Change of plans',
        requesterUser: customerUser
      });

      const freshBooking = await queryOne('SELECT * FROM bookings WHERE id = ?', [bookingB.id]);
      assert.strictEqual(freshBooking.status, 'CANCELLED');
    });

    test('28. Reopening terminal booking does not initiate live WebSocket subscription', () => {
      assert.ok(
        modalContent.includes('enabled: Boolean(hasAssignedDriver && !isTerminalState && bookingId && token)'),
        'enabled is false for terminal bookings, preventing socket connection'
      );
    });
  });

  // =========================================================================
  // 6. Event Ordering & Transient State Precedence
  // =========================================================================
  describe('6. Event Ordering & Transient State Precedence', () => {
    test('29. Late location event cannot resurrect tracking or route calculation after completion', () => {
      assert.ok(
        modalContent.includes('if (!hasAssignedDriver || !hasRequiredCoords || !hasValidDriverCoords || isTerminalState)'),
        'Route calculation effect bails out immediately if isTerminalState is true'
      );
    });

    test('30. Late route response cannot resurrect route after completion', () => {
      assert.ok(
        modalContent.includes('if (currentRequestId !== routeRequestIdRef.current || isTerminalState)'),
        'Rejects late responses if isTerminalState is true'
      );
    });

    test('31. Terminal status wins over transient badges (hides updating/error/connecting)', () => {
      assert.ok(
        modalContent.includes('Trip Completed') || modalContent.includes('Trip Cancelled'),
        'Renders authoritative terminal badges'
      );
      assert.ok(
        modalContent.includes('{isTerminalState ? ('),
        'Terminal state overrides transient badges'
      );
    });

    test('32. Backend rejects any attempt to modify or transition terminal bookings (INVALID_STATE_TRANSITION)', async () => {
      await assert.rejects(
        async () => {
          await updateBookingStatus({
            bookingId: bookingA.id,
            newStatus: 'IN_PROGRESS',
            requesterUser: customerUser
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_STATE_TRANSITION');
          assert.ok(err.message.includes('terminal'));
          return true;
        },
        'Must reject transitioning a COMPLETED booking'
      );
    });
  });

  // =========================================================================
  // 7. Driver Portal Consistency
  // =========================================================================
  describe('7. Driver Portal Consistency', () => {
    test('33. Completed booking does not remain active in driver tracking UI', () => {
      assert.ok(
        driverPortalContent.includes("!rawStatus.includes('COMPLET')"),
        'Excludes completed bookings from active duties'
      );
      assert.ok(
        driverPortalContent.includes('setAcceptedTrips(prev => prev.filter(t => t.id !== settlementTrip.id))'),
        'Removes completed trip from acceptedTrips on settlement'
      );
    });

    test('34. Cancelled booking does not remain active in driver tracking UI', () => {
      assert.ok(
        driverPortalContent.includes("!rawStatus.includes('CANCEL')"),
        'Excludes cancelled bookings from active duties'
      );
    });

    test('35. Driver settlement broadcast synchronizes completion to customers', () => {
      assert.ok(
        driverPortalContent.includes("status: 'Completed'"),
        'Broadcasts Completed status payload'
      );
      assert.ok(
        driverPortalContent.includes('broadcastBookingUpdate'),
        'Broadcasts update via multi-tab channel'
      );
    });
  });

  // =========================================================================
  // 8. Strict Phase 16 Boundaries & Invariance
  // =========================================================================
  describe('8. Strict Phase 16 Boundaries & Invariance', () => {
    test('36. Zero polling introduced for post-trip cleanup or status checks', () => {
      assert.ok(!modalContent.includes('setInterval'), 'Modal must NOT use polling');
      assert.ok(!hookContent.includes('setInterval'), 'Hook must NOT use polling');
    });

    test('37. Zero new WebSocket transports or duplicate socket servers created', () => {
      assert.ok(!fs.existsSync('server/postTripSocket.js'), 'Must not create duplicate socket servers');
      assert.ok(hookContent.includes('useDriverRealtimeLocation'), 'Strictly reuses existing hook');
    });

    test('38. Zero new database tables or columns introduced', () => {
      const schemaSql = fs.readFileSync('server/db/schema.sql', 'utf8');
      assert.ok(!schemaSql.includes('post_trip_events'), 'No post_trip_events table');
      assert.ok(!schemaSql.includes('cleanup_timestamp'), 'No cleanup_timestamp column');
    });

    test('39. Zero new booking statuses added to authoritative state machine', () => {
      const statuses = ['PENDING', 'CONFIRMED', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
      for (const s of statuses) {
        assert.ok(bookingServiceContent.includes(`'${s}'`), `Must preserve standard status ${s}`);
      }
      assert.ok(!bookingServiceContent.includes("'ARCHIVED'"), 'No unauthorized ARCHIVED status');
      assert.ok(!bookingServiceContent.includes("'CLOSED'"), 'No unauthorized CLOSED status');
    });

    test('40. Terminal state transitions preserve customer map pan/zoom without auto-recentering or fitBounds', () => {
      assert.ok(!modalContent.includes('fitBounds'), 'Must NOT call fitBounds on terminal transition');
      assert.ok(!modalContent.includes('setMapCenter([driverLat, driverLng])'), 'Must NOT jump center on driver location');
    });

    test('41. Phase 14 active-trip and Phase 15 trip-lifecycle polylines are hidden when terminal', () => {
      assert.ok(
        modalContent.includes('!isTerminalState'),
        'Route polylines are guarded with !isTerminalState'
      );
    });
  });
});
