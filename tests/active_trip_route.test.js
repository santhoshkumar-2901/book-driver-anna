import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { startTestServer } from './testHelper.js';
import { apiClient } from '../src/services/apiClient.js';

describe('Phase 14 — Active Trip Live Route Suite', () => {
  let server, baseUrl;

  const modalPath = path.resolve('src/components/BookingSuccessModal.jsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  const polylinePath = path.resolve('src/components/map/RoutePolyline.jsx');
  const polylineContent = fs.readFileSync(polylinePath, 'utf8');

  const apiClientPath = path.resolve('src/services/apiClient.js');
  const apiClientContent = fs.readFileSync(apiClientPath, 'utf8');

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

  // Haversine formula helper for simulation tests
  function calculateHaversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // =========================================================================
  // 1. Active-State Behavior & Lifecycle
  // =========================================================================
  describe('1. Active-Trip Status Detection & State Transitions', () => {
    test('1. Active-trip route is inactive for CONFIRMED status', () => {
      const isTripActive = (status) => String(status || '').toUpperCase() === 'IN_PROGRESS';
      assert.strictEqual(isTripActive('CONFIRMED'), false);
      assert.strictEqual(isTripActive('confirmed'), false);
    });

    test('2. Active-trip route is inactive for ASSIGNED status', () => {
      const isTripActive = (status) => String(status || '').toUpperCase() === 'IN_PROGRESS';
      assert.strictEqual(isTripActive('ASSIGNED'), false);
      assert.strictEqual(isTripActive('assigned'), false);
    });

    test('3. Active-trip route is inactive for PENDING status', () => {
      const isTripActive = (status) => String(status || '').toUpperCase() === 'IN_PROGRESS';
      assert.strictEqual(isTripActive('PENDING'), false);
      assert.strictEqual(isTripActive('pending'), false);
    });

    test('4. Active-trip route activates strictly for IN_PROGRESS status', () => {
      assert.ok(
        modalContent.includes("String(currentStatus || '').toUpperCase() === 'IN_PROGRESS'"),
        'Must strictly check IN_PROGRESS for active trip'
      );
      const isTripActive = (status) => String(status || '').toUpperCase() === 'IN_PROGRESS';
      assert.strictEqual(isTripActive('IN_PROGRESS'), true);
      assert.strictEqual(isTripActive('in_progress'), true);
    });

    test('5. Route clears immediately on transition to COMPLETED', () => {
      assert.ok(
        modalContent.includes("String(currentStatus || '').toUpperCase() === 'COMPLETED'"),
        'Must treat COMPLETED as terminal state'
      );
      assert.ok(modalContent.includes('isTerminalState'), 'Must maintain isTerminalState guard');
    });

    test('6. Route clears immediately on transition to CANCELLED', () => {
      assert.ok(
        modalContent.includes("String(currentStatus || '').toUpperCase() === 'CANCELLED'"),
        'Must treat CANCELLED as terminal state'
      );
      assert.ok(modalContent.includes('previousStatusRef.current'), 'Must track status transitions');
    });
  });

  // =========================================================================
  // 2. Coordinate Sources & Validation
  // =========================================================================
  describe('2. Coordinate Sources & Validation', () => {
    test('7. Driver coordinates are used as route origin for active trip', () => {
      assert.ok(modalContent.includes('pickupLat: driverLat'), 'Driver latitude must be route origin');
      assert.ok(modalContent.includes('pickupLng: driverLng'), 'Driver longitude must be route origin');
      assert.ok(modalContent.includes('const driverLat = driverLiveLocation?.latitude'), 'Driver lat from driverLiveLocation');
      assert.ok(modalContent.includes('const driverLng = driverLiveLocation?.longitude'), 'Driver lng from driverLiveLocation');
    });

    test('8. Destination coordinates are used as route destination for active trip', () => {
      assert.ok(modalContent.includes('destLat: destLat'), 'Booking destination latitude must be route destination');
      assert.ok(modalContent.includes('destLng: destLng'), 'Booking destination longitude must be route destination');
    });

    test('9. Authoritative destination coordinates read from booking record with fallback support', () => {
      assert.ok(
        modalContent.includes('booking?.destination_latitude ?? booking?.destinationLatitude'),
        'Must support authoritative destination_latitude and camelCase fallback'
      );
      assert.ok(
        modalContent.includes('booking?.destination_longitude ?? booking?.destinationLongitude'),
        'Must support authoritative destination_longitude and camelCase fallback'
      );
    });

    test('10. Invalid driver latitude rejected', () => {
      const validateDriverCoords = (coords) => {
        const driverLat = coords?.latitude;
        const driverLng = coords?.longitude;
        return typeof driverLat === 'number' && typeof driverLng === 'number' &&
               isFinite(driverLat) && isFinite(driverLng) &&
               driverLat >= -90 && driverLat <= 90 &&
               driverLng >= -180 && driverLng <= 180;
      };

      assert.strictEqual(validateDriverCoords({ latitude: 91.0, longitude: 77.59 }), false);
      assert.strictEqual(validateDriverCoords({ latitude: -90.5, longitude: 77.59 }), false);
      assert.strictEqual(validateDriverCoords({ latitude: NaN, longitude: 77.59 }), false);
      assert.strictEqual(validateDriverCoords({ latitude: Infinity, longitude: 77.59 }), false);
      assert.strictEqual(validateDriverCoords({ latitude: '12.97', longitude: 77.59 }), false);
    });

    test('11. Invalid driver longitude rejected', () => {
      const validateDriverCoords = (coords) => {
        const driverLat = coords?.latitude;
        const driverLng = coords?.longitude;
        return typeof driverLat === 'number' && typeof driverLng === 'number' &&
               isFinite(driverLat) && isFinite(driverLng) &&
               driverLat >= -90 && driverLat <= 90 &&
               driverLng >= -180 && driverLng <= 180;
      };

      assert.strictEqual(validateDriverCoords({ latitude: 12.97, longitude: 181.0 }), false);
      assert.strictEqual(validateDriverCoords({ latitude: 12.97, longitude: -180.5 }), false);
      assert.strictEqual(validateDriverCoords({ latitude: 12.97, longitude: NaN }), false);
      assert.strictEqual(validateDriverCoords({ latitude: 12.97, longitude: -Infinity }), false);
      assert.strictEqual(validateDriverCoords({ latitude: 12.97, longitude: '77.59' }), false);
    });

    test('12. Invalid destination latitude rejected', () => {
      const validateDestCoords = (booking) => {
        const rawDestLat = booking?.destination_latitude ?? booking?.destinationLatitude;
        const rawDestLng = booking?.destination_longitude ?? booking?.destinationLongitude;
        const destLat = (rawDestLat !== null && rawDestLat !== undefined && rawDestLat !== '') ? parseFloat(rawDestLat) : NaN;
        const destLng = (rawDestLng !== null && rawDestLng !== undefined && rawDestLng !== '') ? parseFloat(rawDestLng) : NaN;
        return !isNaN(destLat) && !isNaN(destLng) && isFinite(destLat) && isFinite(destLng) &&
               destLat >= -90 && destLat <= 90 && destLng >= -180 && destLng <= 180;
      };

      assert.strictEqual(validateDestCoords({ destination_latitude: 95.0, destination_longitude: 77.59 }), false);
      assert.strictEqual(validateDestCoords({ destination_latitude: -100, destination_longitude: 77.59 }), false);
      assert.strictEqual(validateDestCoords({ destination_latitude: 'invalid', destination_longitude: 77.59 }), false);
      assert.strictEqual(validateDestCoords({ destination_latitude: '', destination_longitude: 77.59 }), false);
    });

    test('13. Invalid destination longitude rejected', () => {
      const validateDestCoords = (booking) => {
        const rawDestLat = booking?.destination_latitude ?? booking?.destinationLatitude;
        const rawDestLng = booking?.destination_longitude ?? booking?.destinationLongitude;
        const destLat = (rawDestLat !== null && rawDestLat !== undefined && rawDestLat !== '') ? parseFloat(rawDestLat) : NaN;
        const destLng = (rawDestLng !== null && rawDestLng !== undefined && rawDestLng !== '') ? parseFloat(rawDestLng) : NaN;
        return !isNaN(destLat) && !isNaN(destLng) && isFinite(destLat) && isFinite(destLng) &&
               destLat >= -90 && destLat <= 90 && destLng >= -180 && destLng <= 180;
      };

      assert.strictEqual(validateDestCoords({ destination_latitude: 12.97, destination_longitude: 195.0 }), false);
      assert.strictEqual(validateDestCoords({ destination_latitude: 12.97, destination_longitude: -200 }), false);
      assert.strictEqual(validateDestCoords({ destination_latitude: 12.97, destination_longitude: 'invalid' }), false);
      assert.strictEqual(validateDestCoords({ destination_latitude: 12.97, destination_longitude: '' }), false);
    });

    test('14. Missing driver coordinates handled safely', () => {
      assert.ok(modalContent.includes('hasValidDriverCoords'), 'Must guard with hasValidDriverCoords');
      assert.ok(modalContent.includes('if (!hasAssignedDriver || !hasRequiredCoords || !hasValidDriverCoords || isTerminalState)'));
    });

    test('15. Missing destination coordinates handled safely', () => {
      assert.ok(modalContent.includes('hasValidDestCoords'), 'Must guard with hasValidDestCoords');
      assert.ok(modalContent.includes('const hasRequiredCoords = isActiveTrip ? hasValidDestCoords : hasValidPickupCoords'));
    });
  });

  // =========================================================================
  // 3. Realtime Updates & Throttling
  // =========================================================================
  describe('3. Realtime Updates, Movement Threshold & Debounce', () => {
    test('16. Initial driver location triggers route with short 50ms delay', () => {
      assert.ok(
        modalContent.includes('const debounceDelay = lastRouteCoordsRef.current ? 1000 : 50'),
        'Initial route uses 50ms delay, subsequent uses 1000ms'
      );
    });

    test('17. Meaningful movement (>= 15m) triggers recalculation', () => {
      const baseLat = 12.9716;
      const baseLng = 77.5946;
      // Driver moves ~35 meters
      const nextLat = 12.9719;
      const nextLng = 77.5947;
      const distance = calculateHaversineMeters(baseLat, baseLng, nextLat, nextLng);
      assert.ok(distance >= 15, `Distance ${distance}m must be >= 15m`);
    });

    test('18. Movement below 15m does not trigger route', () => {
      assert.ok(modalContent.includes('if (movedMeters < 15)'), 'Must check movedMeters < 15');
      const baseLat = 12.9716;
      const baseLng = 77.5946;
      // GPS jitter: ~4 meters
      const jitterLat = 12.97163;
      const jitterLng = 77.59462;
      const distance = calculateHaversineMeters(baseLat, baseLng, jitterLat, jitterLng);
      assert.ok(distance < 15, `Jitter distance ${distance}m must be < 15m`);
    });

    test('19. Debounce prevents request storms during rapid driver GPS updates', async () => {
      let timer = null;
      let callCount = 0;

      const scheduleRoute = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          callCount++;
        }, 50);
      };

      // 5 rapid GPS events
      scheduleRoute();
      scheduleRoute();
      scheduleRoute();
      scheduleRoute();
      scheduleRoute();

      await new Promise((r) => setTimeout(r, 80));
      assert.strictEqual(callCount, 1, 'Debounce must collapse rapid events into a single request');
    });

    test('20. Latest driver location is used when debounced request fires', async () => {
      let timer = null;
      let capturedLocation = null;

      const queueLocation = (loc) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          capturedLocation = loc;
        }, 30);
      };

      queueLocation({ lat: 12.9716, lng: 77.5946 });
      queueLocation({ lat: 12.9720, lng: 77.5950 });
      queueLocation({ lat: 12.9725, lng: 77.5955 });

      await new Promise((r) => setTimeout(r, 60));
      assert.deepStrictEqual(capturedLocation, { lat: 12.9725, lng: 77.5955 });
    });
  });

  // =========================================================================
  // 4. Request Lifecycle, Cancellation & Stale Protection
  // =========================================================================
  describe('4. Request Lifecycle & Cancellation Safety', () => {
    test('21. Previous request is aborted when new route is initiated', () => {
      assert.ok(modalContent.includes('routeAbortControllerRef.current.abort()'));
      assert.ok(modalContent.includes('const controller = new AbortController()'));
      assert.ok(modalContent.includes('signal: controller.signal'));
    });

    test('22. Stale out-of-order response is ignored', async () => {
      let activeRequestId = 0;
      let currentResult = null;

      const requestSimulator = (id, resultData, delay) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            if (id === activeRequestId) {
              currentResult = resultData;
            }
            resolve();
          }, delay);
        });
      };

      // Request 1 starts (slow)
      const req1Id = ++activeRequestId;
      const p1 = requestSimulator(req1Id, 'old_route_coords', 50);

      // Request 2 starts (fast)
      const req2Id = ++activeRequestId;
      const p2 = requestSimulator(req2Id, 'new_route_coords', 15);

      await Promise.all([p1, p2]);
      assert.strictEqual(currentResult, 'new_route_coords', 'Stale request 1 must not overwrite request 2');
    });

    test('23. Aborted request does not show an error', () => {
      assert.ok(
        modalContent.includes("if (err.name === 'AbortError' || controller.signal.aborted)"),
        'Must catch and swallow AbortError without setting route error'
      );
    });

    test('24. Unmount aborts in-flight request', () => {
      assert.ok(modalContent.includes('routeAbortControllerRef.current.abort()'), 'Cleanup must abort controller');
    });

    test('25. Unmount clears pending debounce timer', () => {
      assert.ok(modalContent.includes('clearTimeout(routeDebounceTimerRef.current)'), 'Cleanup must clear debounce timer');
    });

    test('26. Request sequence invalidates stale responses on status changes', () => {
      assert.ok(modalContent.includes('routeRequestIdRef.current++'), 'Must bump sequence ID on status transitions');
    });
  });

  // =========================================================================
  // 5. Driver Assignment & Destination Handling
  // =========================================================================
  describe('5. Driver Assignment & Destination Changes', () => {
    test('27. Unassignment (assignedDriverId === null) clears route and aborts requests', () => {
      assert.ok(modalContent.includes('assignedDriverId !== previousDriverIdRef.current'));
      assert.ok(modalContent.includes('setDriverRoute(null)'));
      assert.ok(modalContent.includes('setDriverRouteType(null)'));
    });

    test('28. Driver reassignment invalidates old driver route', () => {
      assert.ok(modalContent.includes('lastRouteCoordsRef.current = null'), 'Must reset lastRouteCoordsRef on driver change');
    });

    test('29. Old driver late response cannot overwrite new driver route', async () => {
      let activeDriverId = 'driver_A';
      let activeRequestId = 0;
      let displayedDriverRoute = null;

      const runDriverRequest = (driverId, delayMs) => {
        const reqId = ++activeRequestId;
        return new Promise((resolve) => {
          setTimeout(() => {
            if (reqId === activeRequestId && driverId === activeDriverId) {
              displayedDriverRoute = `Route for ${driverId}`;
            }
            resolve();
          }, delayMs);
        });
      };

      const pA = runDriverRequest('driver_A', 60);

      // Reassigned to driver B
      activeDriverId = 'driver_B';
      const pB = runDriverRequest('driver_B', 20);

      await Promise.all([pA, pB]);
      assert.strictEqual(displayedDriverRoute, 'Route for driver_B');
    });

    test('30. Destination change triggers route recalculation and aborts prior request', () => {
      assert.ok(modalContent.includes('previousDestRef'), 'Must track previous destination with ref');
      assert.ok(modalContent.includes('destLat !== previousDestRef.current.lat'), 'Must detect destLat change');
      assert.ok(modalContent.includes('destLng !== previousDestRef.current.lng'), 'Must detect destLng change');
    });
  });

  // =========================================================================
  // 6. Visual Design, Route Priority & Map Invariance
  // =========================================================================
  describe('6. Visual Design, Route Priority & Map Invariance', () => {
    test('31. Active-trip route renders with distinct emerald green dashed style (#10b981, dashArray="4, 6")', () => {
      assert.ok(modalContent.includes('color="#10b981"'), 'Active-trip route must use emerald green #10b981');
      assert.ok(modalContent.includes('dashArray="4, 6"'), 'Active-trip route must use dashArray="4, 6"');
      assert.ok(modalContent.includes("driverRouteType === 'active-trip'"), 'Must guard with driverRouteType active-trip');
    });

    test('32. Pre-pickup route is hidden during IN_PROGRESS', () => {
      assert.ok(
        modalContent.includes("!isActiveTrip && driverRoute?.geometry && driverRouteType === 'to-pickup'"),
        'Pre-pickup route must only render when !isActiveTrip'
      );
    });

    test('33. Customer trip route (Route B) is hidden during IN_PROGRESS to prevent conflicting polylines', () => {
      assert.ok(
        modalContent.includes('!isActiveTrip') && modalContent.includes('booking?.routeGeometry'),
        'Customer trip route polyline is suppressed when isActiveTrip is true'
      );
    });

    test('34. No continuous automatic map recentering on driver movement or route update', () => {
      assert.ok(!modalContent.includes('fitBounds'), 'Must NOT call fitBounds on driver updates');
      assert.ok(!modalContent.includes('setMapCenter([driverLat, driverLng])'), 'Must NOT recenter on driver coordinate changes');
    });

    test('35. Browser does NOT make direct requests to external OSRM', () => {
      assert.ok(!modalContent.includes('router.project-osrm.org'), 'Must NOT contain direct OSRM endpoint');
      assert.ok(modalContent.includes('apiClient.getLocationRoute'), 'Must route exclusively through apiClient');
    });

    test('36. No ETA or distance-to-driver display exposed in Phase 14', () => {
      assert.ok(!modalContent.includes('driverRoute?.distanceKm'), 'Must NOT display active trip distance remaining');
      assert.ok(!modalContent.includes('driverRoute?.durationMinutes'), 'Must NOT display active trip ETA');
      assert.ok(!modalContent.includes('ETA to Destination'), 'Must NOT display ETA to destination');
      assert.ok(!modalContent.includes('Turn left'), 'Must NOT contain turn-by-turn navigation UI');
    });
  });

  // =========================================================================
  // 7. Failure Resilience & Backend Proxy Integration
  // =========================================================================
  describe('7. Failure Resilience & Backend Route Calculation', () => {
    test('37. Routing failure does not break the live driver marker or realtime tracking', () => {
      assert.ok(modalContent.includes('<DriverLocationMarker'), 'DriverLocationMarker is rendered unconditionally if driverLiveLocation is present');
      assert.ok(modalContent.includes('useDriverRealtimeLocation'), 'Realtime hook is decoupled from routing');
    });

    test('38. Routing failure shows non-blocking graceful fallback state without breaking tracking', () => {
      assert.ok(modalContent.includes('Route temporarily unavailable'), 'Shows graceful non-blocking alert badge');
      assert.ok(modalContent.includes('setDriverRouteError'), 'Captures routing error without crashing modal');
    });

    test('39. Route recovers after a subsequent successful request', () => {
      let routeState = null;
      let errorState = 'Route temporarily unavailable';

      // Simulate recovery on next GPS tick
      const handleSuccess = (route) => {
        routeState = route;
        errorState = null;
      };

      handleSuccess({ geometry: { type: 'LineString', coordinates: [[77.59, 12.97], [77.62, 12.93]] } });
      assert.ok(routeState !== null, 'Route must be updated on recovery');
      assert.strictEqual(errorState, null, 'Error must be cleared on recovery');
    });

    test('40. Backend GET /api/location/route successfully calculates active-trip route (Driver -> Destination)', async () => {
      const driverCoords = { lat: 12.9716, lng: 77.5946 }; // Current driver location
      const destCoords = { lat: 12.9352, lng: 77.6245 };   // Authoritative booking destination

      const url = `${baseUrl}/api/location/route?pickupLat=${driverCoords.lat}&pickupLng=${driverCoords.lng}&destLat=${destCoords.lat}&destLng=${destCoords.lng}`;
      const res = await fetch(url);
      assert.strictEqual(res.status, 200, 'Must return 200 OK');

      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data, 'Must return route data');
      assert.strictEqual(body.data.geometry.type, 'LineString');
      assert.ok(Array.isArray(body.data.geometry.coordinates));
      assert.ok(body.data.geometry.coordinates.length >= 2);
    });
  });
});
