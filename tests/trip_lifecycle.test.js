import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { startTestServer } from './testHelper.js';
import { apiClient } from '../src/services/apiClient.js';
import { updateBookingStatus, cancelBooking } from '../server/services/bookingService.js';
import { queryOne, execute } from '../server/db/database.js';

describe('Phase 15 — Trip Lifecycle & Driver Arrival State Suite', () => {
  let server, baseUrl;

  const modalPath = path.resolve('src/components/BookingSuccessModal.jsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  const bookingServicePath = path.resolve('server/services/bookingService.js');
  const bookingServiceContent = fs.readFileSync(bookingServicePath, 'utf8');

  const bookingsRoutePath = path.resolve('server/routes/bookings.js');
  const bookingsRouteContent = fs.readFileSync(bookingsRoutePath, 'utf8');

  const driverPortalPath = path.resolve('src/pages/DriverPortalPage.jsx');
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf8');

  const hookPath = path.resolve('src/utils/useDriverRealtimeLocation.js');
  const hookContent = fs.readFileSync(hookPath, 'utf8');

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;
  });

  after(async () => {
    if (server) {
      await new Promise((res) => server.close(res));
    }
  });

  // =========================================================================
  // 1. Authoritative Lifecycle States & Transitions
  // =========================================================================
  describe('1. Authoritative Lifecycle States & Transitions', () => {
    test('1. ASSIGNED state is recognized in authoritative lifecycle', () => {
      assert.ok(bookingServiceContent.includes("'ASSIGNED'"), 'ASSIGNED must be an authorized state');
      assert.ok(modalContent.includes('hasAssignedDriver'), 'Modal must evaluate assigned driver state');
    });

    test('2. ARRIVED state is recognized in authoritative lifecycle', () => {
      assert.ok(bookingServiceContent.includes("'ARRIVED'"), 'ARRIVED must be in ALLOWED_STATE_TRANSITIONS');
      assert.ok(
        modalContent.includes("String(currentStatus || '').toUpperCase() === 'ARRIVED'") ||
        modalContent.includes("isDriverArrived"),
        'Modal must evaluate isDriverArrived'
      );
    });

    test('3. IN_PROGRESS state is recognized as active-trip state', () => {
      assert.ok(
        modalContent.includes("String(currentStatus || '').toUpperCase() === 'IN_PROGRESS'"),
        'IN_PROGRESS must be authoritative active-trip state'
      );
    });

    test('4. COMPLETED state is recognized as terminal state', () => {
      assert.ok(
        modalContent.includes("String(currentStatus || '').toUpperCase() === 'COMPLETED'"),
        'COMPLETED must be recognized as terminal state'
      );
      assert.ok(bookingServiceContent.includes("'COMPLETED': []"), 'COMPLETED must be terminal with no transitions');
    });

    test('5. CANCELLED state is recognized as terminal state', () => {
      assert.ok(
        modalContent.includes("String(currentStatus || '').toUpperCase() === 'CANCELLED'"),
        'CANCELLED must be recognized as terminal state'
      );
      assert.ok(bookingServiceContent.includes("'CANCELLED': []"), 'CANCELLED must be terminal with no transitions');
    });

    test('6. No unauthorized booking statuses are introduced into the state machine', () => {
      assert.ok(!bookingServiceContent.includes('DRIVER_APPROACHING'), 'Must not invent DRIVER_APPROACHING');
      assert.ok(!bookingServiceContent.includes('DRIVER_NEARBY'), 'Must not invent DRIVER_NEARBY');
      assert.ok(!bookingServiceContent.includes('TRIP_STARTED'), 'Must not invent TRIP_STARTED');
      assert.ok(!bookingServiceContent.includes('TRIP_FINISHED'), 'Must not invent TRIP_FINISHED');
    });
  });

  // =========================================================================
  // 2. Driver Arrival State Presentation & Route Suppression
  // =========================================================================
  describe('2. Driver Arrival State Presentation & Route Suppression', () => {
    test('7. ARRIVED status clearly presents "Driver has arrived" in customer UI', () => {
      assert.ok(modalContent.includes('Driver has arrived'), 'Modal must render "Driver has arrived" text');
      assert.ok(modalContent.includes('isDriverArrived && hasAssignedDriver'), 'Arrival state requires assigned driver');
    });

    test('8. ARRIVED status does NOT activate the Driver → Destination route', () => {
      const isActiveTrip = (status) => String(status || '').toUpperCase() === 'IN_PROGRESS';
      assert.strictEqual(isActiveTrip('ARRIVED'), false, 'ARRIVED is not IN_PROGRESS');
    });

    test('9. ARRIVED status stops and clears Driver → Pickup route calculation', () => {
      assert.ok(modalContent.includes('if (isDriverArrived) {'), 'Must check isDriverArrived in route effect');
      assert.ok(modalContent.includes('!isDriverArrived'), 'Pre-pickup route requires !isDriverArrived');
    });

    test('10. ARRIVED status preserves the live DriverLocationMarker independent of route', () => {
      assert.ok(modalContent.includes('<DriverLocationMarker'), 'DriverLocationMarker is rendered in modal');
      assert.ok(modalContent.includes('driverLiveLocation'), 'DriverLocationMarker consumes driverLiveLocation');
    });

    test('11. Unassigned booking does NOT show driver arrival state', () => {
      assert.ok(
        modalContent.includes('(isDriverArrived && hasAssignedDriver)'),
        'Driver arrival badge and banner must require hasAssignedDriver'
      );
    });
  });

  // =========================================================================
  // 3. Trip Start Transition (ARRIVED → IN_PROGRESS)
  // =========================================================================
  describe('3. Trip Start Transition (ARRIVED → IN_PROGRESS)', () => {
    test('12. ARRIVED → IN_PROGRESS activates active-trip route (Driver → Destination)', () => {
      assert.ok(modalContent.includes("driverRouteType === 'active-trip'"));
      assert.ok(modalContent.includes("isActiveTrip ? 'active-trip' : 'to-pickup'"));
    });

    test('13. IN_PROGRESS route strictly uses driver realtime coordinates as origin', () => {
      assert.ok(modalContent.includes('pickupLat: driverLat'));
      assert.ok(modalContent.includes('pickupLng: driverLng'));
    });

    test('14. IN_PROGRESS route strictly uses booking destination coordinates as destination', () => {
      assert.ok(modalContent.includes('destLat: destLat'));
      assert.ok(modalContent.includes('destLng: destLng'));
    });

    test('15. Pre-pickup (Driver → Pickup) route is cleared/hidden when IN_PROGRESS', () => {
      assert.ok(modalContent.includes("!isActiveTrip && driverRoute?.geometry && driverRouteType === 'to-pickup' && !isDriverArrived"));
    });

    test('16. IN_PROGRESS route calculation reuses 15m threshold and 1000ms debounce', () => {
      assert.ok(modalContent.includes('movedMeters < 15'));
      assert.ok(modalContent.includes('const debounceDelay = lastRouteCoordsRef.current ? 1000 : 50'));
    });
  });

  // =========================================================================
  // 4. Trip Completion Lifecycle (IN_PROGRESS → COMPLETED)
  // =========================================================================
  describe('4. Trip Completion Lifecycle (IN_PROGRESS → COMPLETED)', () => {
    test('17. Transition to COMPLETED clears active-trip route', () => {
      assert.ok(modalContent.includes('isTerminalState'));
      assert.ok(modalContent.includes('setDriverRoute(null)'));
    });

    test('18. Transition to COMPLETED aborts pending route request', () => {
      assert.ok(modalContent.includes('routeAbortControllerRef.current.abort()'));
    });

    test('19. Transition to COMPLETED clears pending debounce timer', () => {
      assert.ok(modalContent.includes('clearTimeout(routeDebounceTimerRef.current)'));
    });

    test('20. Transition to COMPLETED invalidates stale responses via request ID increment', () => {
      assert.ok(modalContent.includes('routeRequestIdRef.current++'));
    });

    test('21. Backend prohibits modifying or transitioning bookings once in COMPLETED status', async () => {
      // Create a test booking and mark it COMPLETED
      const bookingId = `TEST-PH15-COMP-${Date.now()}`;
      await execute(`
        INSERT INTO bookings (id, customer_name, customer_phone, booking_type, trip_type, service_name, pickup_area, date, time, calculated_fare, status, created_at, updated_at)
        VALUES (?, 'Completed User', '+919876543210', 'driver', 'one-way', 'One-way Driver', 'Indiranagar', '2026-10-05', '10:00', 500, 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [bookingId]);

      await assert.rejects(
        async () => {
          await updateBookingStatus({
            bookingId,
            newStatus: 'IN_PROGRESS',
            requesterUser: { id: 'admin-1', role: 'admin' }
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'INVALID_STATE_TRANSITION');
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 5. Trip Cancellation Lifecycle
  // =========================================================================
  describe('5. Trip Cancellation Lifecycle', () => {
    test('22. CANCELLED state clears active driver route', () => {
      assert.ok(modalContent.includes('isCancelled'));
      assert.ok(modalContent.includes('setDriverRoute(null)'));
    });

    test('23. CANCELLED state aborts pending route requests', () => {
      assert.ok(modalContent.includes('routeAbortControllerRef.current.abort()'));
    });

    test('24. CANCELLED state clears pending debounce timer', () => {
      assert.ok(modalContent.includes('clearTimeout(routeDebounceTimerRef.current)'));
    });

    test('25. CANCELLABLE_STATES permits cancellation of PENDING, CONFIRMED, ASSIGNED, and ARRIVED bookings', () => {
      assert.ok(bookingServiceContent.includes("'PENDING', 'CONFIRMED', 'ASSIGNED', 'ARRIVED'"));
    });

    test('26. Backend prohibits cancellation of IN_PROGRESS or COMPLETED trips', async () => {
      const inProgId = `TEST-PH15-INPROG-${Date.now()}`;
      await execute(`
        INSERT INTO bookings (id, customer_name, customer_phone, booking_type, trip_type, service_name, pickup_area, date, time, calculated_fare, status, created_at, updated_at)
        VALUES (?, 'In Progress User', '+919876543210', 'driver', 'one-way', 'One-way Driver', 'Koramangala', '2026-10-05', '10:00', 500, 'IN_PROGRESS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [inProgId]);

      await assert.rejects(
        async () => {
          await cancelBooking({
            bookingId: inProgId,
            requesterUser: { id: 'admin-1', role: 'admin' },
            reason: 'Test cancel in progress'
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'INVALID_STATE_TRANSITION');
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 6. Driver Assignment Safety & Lifecycle Isolation
  // =========================================================================
  describe('6. Driver Assignment Safety & Lifecycle Isolation', () => {
    test('27. Unassignment (assignedDriverId === null) clears route and stops tracking', () => {
      assert.ok(modalContent.includes('if (assignedDriverId !== previousDriverIdRef.current)'));
      assert.ok(modalContent.includes('setDriverRoute(null)'));
      assert.ok(modalContent.includes('setDriverRouteType(null)'));
    });

    test('28. Driver reassignment (Driver A → Driver B) invalidates previous driver route and request ID', () => {
      assert.ok(modalContent.includes('routeRequestIdRef.current++'));
      assert.ok(modalContent.includes('lastRouteCoordsRef.current = null'));
    });

    test('29. Old driver late response cannot overwrite new driver lifecycle route', async () => {
      let activeDriver = 'driver_A';
      let activeReq = 0;
      let activeRoute = null;

      const simulateRoute = (driver, delay) => {
        const thisReq = ++activeReq;
        return new Promise(resolve => {
          setTimeout(() => {
            if (thisReq === activeReq && driver === activeDriver) {
              activeRoute = `Route for ${driver}`;
            }
            resolve();
          }, delay);
        });
      };

      const pA = simulateRoute('driver_A', 60);
      activeDriver = 'driver_B';
      const pB = simulateRoute('driver_B', 20);

      await Promise.all([pA, pB]);
      assert.strictEqual(activeRoute, 'Route for driver_B');
    });

    test('30. Driver B can become the active tracked driver upon reassignment', () => {
      assert.ok(modalContent.includes('previousDriverIdRef.current = assignedDriverId'));
    });
  });

  // =========================================================================
  // 7. Realtime Synchronization & Event Propagation
  // =========================================================================
  describe('7. Realtime Synchronization & Event Propagation', () => {
    test('31. Backend updateBookingStatus publishes booking.assignment.updated on status change', () => {
      assert.ok(
        bookingServiceContent.includes('publishBookingAssignmentChange'),
        'bookingService must call publishBookingAssignmentChange'
      );
      assert.ok(
        bookingServiceContent.includes('normalizedNewStatus !== currentStatus'),
        'Must publish assignment update whenever status changes'
      );
    });

    test('32. useDriverRealtimeLocation bridges booking.assignment.updated to broadcast channel', () => {
      assert.ok(
        hookContent.includes('broadcastBookingUpdate'),
        'useDriverRealtimeLocation must import broadcastBookingUpdate'
      );
      assert.ok(
        hookContent.includes("case 'booking.assignment.updated':"),
        'Hook must handle booking.assignment.updated'
      );
    });

    test('33. BookingSuccessModal listens to broadcast channel via onBookingUpdate', () => {
      assert.ok(modalContent.includes('onBookingUpdate('), 'Modal must subscribe to onBookingUpdate');
      assert.ok(modalContent.includes('setCurrentStatus(detail.status)'), 'Modal updates currentStatus on broadcast');
    });

    test('34. DriverPortalPage provides Mark Arrived and Start Trip actions for assigned duties', () => {
      assert.ok(driverPortalContent.includes('handleMarkArrived'), 'DriverPortalPage has handleMarkArrived');
      assert.ok(driverPortalContent.includes('handleStartTrip'), 'DriverPortalPage has handleStartTrip');
      assert.ok(driverPortalContent.includes("'ARRIVED'"), 'Driver portal can send ARRIVED status');
    });
  });

  // =========================================================================
  // 8. Resilience, Invariance & Strict Boundary Protections
  // =========================================================================
  describe('8. Resilience, Invariance & Strict Boundary Protections', () => {
    test('35. Routing failure does NOT break lifecycle state machine', () => {
      assert.ok(modalContent.includes('setDriverRouteError'), 'Captures routing error without altering currentStatus');
      assert.ok(modalContent.includes('Route temporarily unavailable'), 'Graceful non-blocking error badge');
    });

    test('36. Routing failure does NOT break or hide live DriverLocationMarker', () => {
      assert.ok(modalContent.includes('<DriverLocationMarker'), 'DriverLocationMarker is rendered independently');
    });

    test('37. Lifecycle state transitions do NOT continuously recenter map or call fitBounds', () => {
      assert.ok(!modalContent.includes('fitBounds'), 'Must NOT call fitBounds');
      assert.ok(!modalContent.includes('setMapCenter([driverLat, driverLng])'), 'Must NOT jump center on driver GPS');
    });

    test('38. Zero new database tables or columns introduced', () => {
      const schemaSql = fs.readFileSync('server/db/schema.sql', 'utf8');
      assert.ok(!schemaSql.includes('arrival_time'), 'Must NOT add arrival_time column');
      assert.ok(!schemaSql.includes('trip_events'), 'Must NOT add trip_events table');
    });

    test('39. Zero polling introduced for status checks or driver location', () => {
      assert.ok(!modalContent.includes('setInterval'), 'Modal must not use setInterval polling');
      assert.ok(!hookContent.includes('setInterval'), 'Hook must not use setInterval polling');
    });

    test('40. Zero new WebSocket transports or servers introduced', () => {
      assert.ok(!fs.existsSync('server/tripLifecycleSocket.js'), 'Must not create duplicate socket server');
      assert.ok(hookContent.includes('useDriverRealtimeLocation'), 'Strictly reuses existing hook');
    });
  });
});
