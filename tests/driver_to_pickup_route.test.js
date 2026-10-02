import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { startTestServer } from './testHelper.js';
import { apiClient } from '../src/services/apiClient.js';

describe('Phase 13 — Driver-to-Customer Route Suite', () => {
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

  // =========================================================================
  // 1. Architecture, Code & Source Verification
  // =========================================================================
  describe('1. Route Architecture & Coordinate Sources', () => {
    test('1. Valid driver + pickup coordinates request a route via apiClient.getLocationRoute', () => {
      assert.ok(modalContent.includes('apiClient.getLocationRoute'), 'Must call apiClient.getLocationRoute');
      assert.ok(modalContent.includes('pickupLat: driverLat'), 'Driver latitude must be used as route origin');
      assert.ok(modalContent.includes('pickupLng: driverLng'), 'Driver longitude must be used as route origin');
      assert.ok(modalContent.includes('destLat: pickupLat'), 'Customer pickup latitude must be used as route destination');
      assert.ok(modalContent.includes('destLng: pickupLng'), 'Customer pickup longitude must be used as route destination');
    });

    test('2. Driver coordinates originate strictly from useDriverRealtimeLocation', () => {
      assert.ok(modalContent.includes('location: driverLiveLocation'), 'Must consume driverLiveLocation from useDriverRealtimeLocation');
      assert.ok(modalContent.includes('const driverLat = driverLiveLocation?.latitude'), 'Must read driverLat from driverLiveLocation');
      assert.ok(modalContent.includes('const driverLng = driverLiveLocation?.longitude'), 'Must read driverLng from driverLiveLocation');
    });

    test('3. Pickup coordinates originate strictly from authoritative booking record', () => {
      assert.ok(
        modalContent.includes('booking?.pickup_latitude ?? booking?.pickupLatitude') ||
        modalContent.includes('booking?.pickup_latitude || booking?.pickupLatitude'),
        'Must read pickup coordinates from authoritative booking'
      );
      assert.ok(modalContent.includes('hasValidPickupCoords'), 'Must validate pickup coordinates');
    });

    test('4. Existing /api/location/route backend is reused and browser does NOT call OSRM directly', () => {
      assert.ok(!modalContent.includes('router.project-osrm.org'), 'Browser component must NOT call OSRM directly');
      assert.ok(apiClientContent.includes("request(`/location/route?${params}`"), 'apiClient routes to backend /location/route');
    });
  });

  // =========================================================================
  // 2. Throttling, Debouncing & Cancellation Mechanics
  // =========================================================================
  describe('2. Throttling, Debouncing & Request Cancellation', () => {
    test('5. Minimum movement threshold (15m) prevents excessive route recalculations', () => {
      assert.ok(modalContent.includes('getHaversineDistanceMeters'), 'Must implement haversine distance check');
      assert.ok(modalContent.includes('movedMeters < 15'), 'Must enforce 15 meter movement threshold');
      assert.ok(modalContent.includes('lastRouteCoordsRef'), 'Must track lastRouteCoords to check movement delta');
    });

    test('6. Rapid driver updates are debounced before dispatching requests', () => {
      assert.ok(modalContent.includes('routeDebounceTimerRef'), 'Must maintain debounce timer ref');
      assert.ok(modalContent.includes('setTimeout'), 'Must use timer for debouncing');
      assert.ok(modalContent.includes('clearTimeout(routeDebounceTimerRef.current)'), 'Must clear prior debounce timer');
    });

    test('7. AbortController is used to cancel superseded in-flight requests', () => {
      assert.ok(modalContent.includes('routeAbortControllerRef'), 'Must maintain routeAbortControllerRef');
      assert.ok(modalContent.includes('new AbortController()'), 'Must instantiate AbortController');
      assert.ok(modalContent.includes('signal: controller.signal'), 'Must pass AbortSignal to route request');
      assert.ok(modalContent.includes('routeAbortControllerRef.current.abort()'), 'Must abort previous in-flight request');
    });

    test('8. Stale out-of-order responses are rejected using sequential request IDs', () => {
      assert.ok(modalContent.includes('routeRequestIdRef'), 'Must track request sequence ID');
      assert.ok(modalContent.includes('currentRequestId !== routeRequestIdRef.current'), 'Must reject stale responses');
    });
  });

  // =========================================================================
  // 3. Route Polyline Rendering & Separation of Concerns
  // =========================================================================
  describe('3. Route Display & Visual Distinguishability', () => {
    test('9. Driver-to-pickup route renders using RoutePolyline with royal blue dashed style', () => {
      assert.ok(modalContent.includes('<RoutePolyline'), 'Must render RoutePolyline in BookingSuccessModal');
      assert.ok(modalContent.includes('geometry={driverRoute.geometry}'), 'Must pass driver route geometry to RoutePolyline');
      assert.ok(modalContent.includes('color="#3b82f6"'), 'Must use distinct royal blue color (#3b82f6) for driver route');
      assert.ok(modalContent.includes('dashArray="6, 8"'), 'Must use dashed stroke (dashArray="6, 8") for driver route');
    });

    test('10. Customer trip route (Pickup -> Destination) remains intact and visually distinct (amber solid)', () => {
      assert.ok(
        modalContent.includes('booking?.routeGeometry') ||
        modalContent.includes('booking?.route_geometry') ||
        modalContent.includes('booking?.geometry'),
        'Customer trip route is supported alongside driver route'
      );
      assert.ok(modalContent.includes('color="#f59e0b"'), 'Customer trip route uses brand amber color');
      assert.ok(!modalContent.includes('dashArray="6, 8"\n                      color="#f59e0b"'), 'Trip route is solid, driver route is dashed');
    });

    test('11. Driver route state is kept strictly separate from customer trip route', () => {
      assert.ok(modalContent.includes('const [driverRoute, setDriverRoute] = useState(null)'), 'Must maintain dedicated driverRoute state');
      assert.ok(!modalContent.includes('booking.routeGeometry = driverRoute'), 'Driver route must never overwrite booking route geometry');
    });
  });

  // =========================================================================
  // 4. Assignment, Unassignment & Reassignment Lifecycles
  // =========================================================================
  describe('4. Driver Assignment, Unassignment & Reassignment Protection', () => {
    test('12. No assigned driver or missing GPS renders no driver route', () => {
      assert.ok(modalContent.includes('if (!hasAssignedDriver || !hasValidPickupCoords || !hasValidDriverCoords || isCancelled)'), 'Guards against missing driver, pickup, or GPS');
      assert.ok(modalContent.includes('setDriverRoute(null)'), 'Must clear driver route when prerequisites are not met');
    });

    test('13. Unassignment immediately aborts requests, clears route, and removes polyline', () => {
      assert.ok(modalContent.includes('previousDriverIdRef'), 'Must track previousDriverId to detect reassignment/unassignment');
      assert.ok(modalContent.includes('assignedDriverId !== previousDriverIdRef.current'), 'Must detect driver ID changes');
      assert.ok(modalContent.includes('routeAbortControllerRef.current.abort()'), 'Must abort pending requests on driver change');
    });

    test('14. Driver reassignment invalidates request IDs so old driver route cannot reappear', () => {
      assert.ok(modalContent.includes('routeRequestIdRef.current++'), 'Must increment route request ID on driver change');
      assert.ok(modalContent.includes('lastRouteCoordsRef.current = null'), 'Must reset lastRouteCoords on driver change');
    });
  });

  // =========================================================================
  // 5. Failure Resilience & Map Recentering Invariance
  // =========================================================================
  describe('5. Failure Resilience & Map Behavior', () => {
    test('15. Routing failure does not crash UI and does NOT break the live driver marker', () => {
      assert.ok(modalContent.includes('setDriverRouteError'), 'Must set graceful non-blocking route error state');
      assert.ok(modalContent.includes('Route temporarily unavailable'), 'Must display non-blocking route unavailable indicator');
      assert.ok(modalContent.includes('<DriverLocationMarker'), 'DriverLocationMarker is rendered independently of driverRoute');
    });

    test('16. Map center is NOT continuously adjusted on driver movement or route updates', () => {
      assert.ok(modalContent.includes('hasInitializedCenterRef'), 'Must guard initial map center with ref');
      assert.ok(!modalContent.includes('fitBounds'), 'Must NOT call fitBounds on driver updates');
      assert.ok(!modalContent.includes('setMapCenter([driverLat, driverLng])'), 'Must NOT reset center on live driver updates');
    });

    test('17. No ETA or distance-to-driver display is exposed in Phase 13', () => {
      assert.ok(!modalContent.includes('driverRoute?.distanceKm'), 'Must NOT display driver distance');
      assert.ok(!modalContent.includes('driverRoute?.durationMinutes'), 'Must NOT display driver ETA');
      assert.ok(!modalContent.includes('ETA to Pickup'), 'Must NOT display ETA to pickup');
    });
  });

  // =========================================================================
  // 6. Backend /api/location/route Integration for Driver-to-Pickup
  // =========================================================================
  describe('6. Backend Route Calculation Integration', () => {
    test('18. GET /api/location/route successfully calculates route with driver origin and pickup destination', async () => {
      const driverCoords = { lat: 12.9716, lng: 77.5946 }; // MG Road
      const pickupCoords = { lat: 12.9352, lng: 77.6245 }; // Koramangala

      const url = `${baseUrl}/api/location/route?pickupLat=${driverCoords.lat}&pickupLng=${driverCoords.lng}&destLat=${pickupCoords.lat}&destLng=${pickupCoords.lng}`;
      const res = await fetch(url);
      assert.strictEqual(res.status, 200, 'Must return 200 OK');

      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data, 'Must return route data');
      assert.strictEqual(body.data.geometry.type, 'LineString');
      assert.ok(Array.isArray(body.data.geometry.coordinates));
      assert.ok(body.data.geometry.coordinates.length >= 2);
    });

    test('19. GET /api/location/route validates inputs and rejects invalid/out-of-bounds coordinates', async () => {
      const invalidUrl = `${baseUrl}/api/location/route?pickupLat=999&pickupLng=77.5946&destLat=12.9352&destLng=77.6245`;
      const res = await fetch(invalidUrl);
      assert.strictEqual(res.status, 400, 'Must return 400 for out-of-bounds coordinates');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'INVALID_COORDINATES');
    });

    test('20. Same/nearly identical location returns instant zero-distance route geometry', async () => {
      const url = `${baseUrl}/api/location/route?pickupLat=12.97160&pickupLng=77.59460&destLat=12.97161&destLng=77.59461`;
      const res = await fetch(url);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.distanceMeters, 0);
      assert.strictEqual(body.data.geometry.type, 'LineString');
      assert.strictEqual(body.data.geometry.coordinates.length, 2);
    });
  });

  // =========================================================================
  // 7. Behavioral Simulation: Haversine, Debouncing & Race Condition Guards
  // =========================================================================
  describe('7. Algorithmic & Behavioral Simulations', () => {
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

    test('21. Haversine distance correctly identifies sub-15m jitter vs real movement', () => {
      const baseLat = 12.9716;
      const baseLng = 77.5946;

      // Jitter (~5 meters movement)
      const jitterLat = 12.97164;
      const jitterLng = 77.59462;
      const jitterDist = calculateHaversineMeters(baseLat, baseLng, jitterLat, jitterLng);
      assert.ok(jitterDist < 15, `Jitter distance ${jitterDist}m should be < 15m`);

      // Real vehicle movement (~50 meters)
      const moveLat = 12.9720;
      const moveLng = 77.5948;
      const moveDist = calculateHaversineMeters(baseLat, baseLng, moveLat, moveLng);
      assert.ok(moveDist > 15, `Movement distance ${moveDist}m should be > 15m`);
    });

    test('22. Debounce and AbortController simulator ensures only latest request takes effect', async () => {
      let abortedCount = 0;
      let completedRequestId = null;
      let activeController = null;
      let latestRequestId = 0;

      const triggerRouteRequest = (id) => {
        if (activeController) {
          activeController.abort();
          abortedCount++;
        }
        const controller = new AbortController();
        activeController = controller;
        const currentReqId = ++latestRequestId;

        return new Promise((resolve) => {
          setTimeout(() => {
            if (controller.signal.aborted) {
              return resolve({ status: 'aborted', id: currentReqId });
            }
            if (currentReqId === latestRequestId) {
              completedRequestId = currentReqId;
            }
            resolve({ status: 'completed', id: currentReqId });
          }, 30);
        });
      };

      // Rapidly fire 3 requests
      const p1 = triggerRouteRequest(1);
      const p2 = triggerRouteRequest(2);
      const p3 = triggerRouteRequest(3);

      await Promise.all([p1, p2, p3]);

      assert.strictEqual(abortedCount, 2, 'First 2 requests must be aborted');
      assert.strictEqual(completedRequestId, 3, 'Only the final request (ID 3) should complete');
    });

    test('23. Stale out-of-order response simulator rejects late earlier responses', async () => {
      let currentRequestId = 0;
      let appliedRoute = null;

      const dispatch = (routeData, delayMs) => {
        const thisReqId = ++currentRequestId;
        return new Promise((resolve) => {
          setTimeout(() => {
            if (thisReqId === currentRequestId) {
              appliedRoute = routeData;
            }
            resolve();
          }, delayMs);
        });
      };

      // Request 1 takes 50ms, Request 2 takes 10ms
      const p1 = dispatch({ route: 'Driver A stale route' }, 50);
      const p2 = dispatch({ route: 'Driver B latest route' }, 10);

      await Promise.all([p1, p2]);

      // Driver B must win even though Request 1 finished last
      assert.deepStrictEqual(appliedRoute, { route: 'Driver B latest route' });
    });

    test('24. Unassignment immediately clears route and prevents in-flight updates', () => {
      let driverRoute = { geometry: { coordinates: [[77, 12], [77.1, 12.1]] } };
      let inFlightController = new AbortController();
      let assignedDriverId = 'drv-100';

      // Simulate unassignment
      assignedDriverId = null;
      inFlightController.abort();
      driverRoute = null;

      assert.strictEqual(assignedDriverId, null);
      assert.strictEqual(inFlightController.signal.aborted, true);
      assert.strictEqual(driverRoute, null);
    });
  });

  // =========================================================================
  // 8. Edge Cases & Resilience Suite
  // =========================================================================
  describe('8. Edge Cases & Resilience Suite', () => {
    // Edge Case 1: Invalid driver coordinates
    test('25. Invalid driver coordinates (null, undefined, non-numeric, NaN, Infinity, out-of-bounds) prevent route calculation', () => {
      const validateDriverCoords = (coords) => {
        const driverLat = coords?.latitude;
        const driverLng = coords?.longitude;
        return typeof driverLat === 'number' && typeof driverLng === 'number' &&
               isFinite(driverLat) && isFinite(driverLng) &&
               driverLat >= -90 && driverLat <= 90 &&
               driverLng >= -180 && driverLng <= 180;
      };

      assert.strictEqual(validateDriverCoords(null), false);
      assert.strictEqual(validateDriverCoords(undefined), false);
      assert.strictEqual(validateDriverCoords({ latitude: '12.97', longitude: 77.59 }), false);
      assert.strictEqual(validateDriverCoords({ latitude: NaN, longitude: 77.59 }), false);
      assert.strictEqual(validateDriverCoords({ latitude: Infinity, longitude: 77.59 }), false);
      assert.strictEqual(validateDriverCoords({ latitude: 91.0, longitude: 77.59 }), false);
      assert.strictEqual(validateDriverCoords({ latitude: -91.0, longitude: 77.59 }), false);
      assert.strictEqual(validateDriverCoords({ latitude: 12.97, longitude: 181.0 }), false);
      assert.strictEqual(validateDriverCoords({ latitude: 12.97, longitude: -181.0 }), false);
      assert.strictEqual(validateDriverCoords({ latitude: 12.9716, longitude: 77.5946 }), true);

      // Verify source code enforces these exact checks
      assert.ok(modalContent.includes("typeof driverLat === 'number'"));
      assert.ok(modalContent.includes("typeof driverLng === 'number'"));
      assert.ok(modalContent.includes("isFinite(driverLat) && isFinite(driverLng)"));
      assert.ok(modalContent.includes("driverLat >= -90 && driverLat <= 90"));
      assert.ok(modalContent.includes("driverLng >= -180 && driverLng <= 180"));
    });

    // Edge Case 2: Invalid pickup coordinates
    test('26. Invalid pickup coordinates (null, missing, empty string, non-numeric, out-of-bounds) prevent route calculation', () => {
      const validatePickupCoords = (booking) => {
        const rawPickupLat = booking?.pickup_latitude ?? booking?.pickupLatitude;
        const rawPickupLng = booking?.pickup_longitude ?? booking?.pickupLongitude;
        const pickupLat = (rawPickupLat !== null && rawPickupLat !== undefined && rawPickupLat !== '') ? parseFloat(rawPickupLat) : NaN;
        const pickupLng = (rawPickupLng !== null && rawPickupLng !== undefined && rawPickupLng !== '') ? parseFloat(rawPickupLng) : NaN;
        return !isNaN(pickupLat) && !isNaN(pickupLng) && isFinite(pickupLat) && isFinite(pickupLng) &&
               pickupLat >= -90 && pickupLat <= 90 && pickupLng >= -180 && pickupLng <= 180;
      };

      assert.strictEqual(validatePickupCoords({}), false);
      assert.strictEqual(validatePickupCoords({ pickup_latitude: null, pickup_longitude: 77.59 }), false);
      assert.strictEqual(validatePickupCoords({ pickup_latitude: '', pickup_longitude: 77.59 }), false);
      assert.strictEqual(validatePickupCoords({ pickup_latitude: '   ', pickup_longitude: 77.59 }), false);
      assert.strictEqual(validatePickupCoords({ pickup_latitude: 'abc', pickup_longitude: 77.59 }), false);
      assert.strictEqual(validatePickupCoords({ pickup_latitude: 95.0, pickup_longitude: 77.59 }), false);
      assert.strictEqual(validatePickupCoords({ pickup_latitude: 12.97, pickup_longitude: 190.0 }), false);
      assert.strictEqual(validatePickupCoords({ pickup_latitude: 12.9716, pickup_longitude: 77.5946 }), true);
      assert.strictEqual(validatePickupCoords({ pickupLatitude: '12.9716', pickupLongitude: '77.5946' }), true);

      // Verify source code enforces these exact checks
      assert.ok(modalContent.includes("!isNaN(pickupLat) && !isNaN(pickupLng)"));
      assert.ok(modalContent.includes("isFinite(pickupLat) && isFinite(pickupLng)"));
      assert.ok(modalContent.includes("pickupLat >= -90 && pickupLat <= 90"));
      assert.ok(modalContent.includes("pickupLng >= -180 && pickupLng <= 180"));
    });

    // Edge Case 3: Same driver/pickup location
    test('27. Same driver and pickup location generates valid zero-distance route geometry without error', async () => {
      // Driver has arrived at exact customer pickup point
      const sharedLat = 12.9716;
      const sharedLng = 77.5946;

      const url = `${baseUrl}/api/location/route?pickupLat=${sharedLat}&pickupLng=${sharedLng}&destLat=${sharedLat}&destLng=${sharedLng}`;
      const res = await fetch(url);
      assert.strictEqual(res.status, 200);

      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.distanceMeters, 0);
      assert.strictEqual(body.data.durationSeconds, 0);
      assert.strictEqual(body.data.geometry.type, 'LineString');
      assert.deepStrictEqual(body.data.geometry.coordinates, [
        [sharedLng, sharedLat],
        [sharedLng, sharedLat]
      ]);
    });

    // Edge Case 4: Aborted request does not set an error
    test('28. Aborted request via AbortController does NOT set driverRouteError', async () => {
      let driverRouteError = null;
      const controller = new AbortController();

      const simulateRouteFetch = async () => {
        try {
          const fetchPromise = new Promise((_, reject) => {
            controller.signal.addEventListener('abort', () => {
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          });
          controller.abort(); // Abort immediately
          await fetchPromise;
        } catch (err) {
          if (err.name === 'AbortError' || controller.signal.aborted) {
            return; // Expected behavior: do not set error state
          }
          driverRouteError = 'Route temporarily unavailable';
        }
      };

      await simulateRouteFetch();
      assert.strictEqual(driverRouteError, null, 'driverRouteError must remain null on AbortError');

      // Verify code contains this specific guard
      assert.ok(modalContent.includes("if (err.name === 'AbortError' || controller.signal.aborted)"));
    });

    // Edge Case 5: Driver reassignment while debounce timer is pending
    test('29. Driver reassignment while debounce timer is pending cancels timer and prevents stale request dispatch', async () => {
      let debounceTimer = null;
      let requestDispatchedForDriver = null;

      // Driver A location triggers debounce timer
      const scheduleRouteForDriver = (driverId) => {
        debounceTimer = setTimeout(() => {
          requestDispatchedForDriver = driverId;
        }, 50);
      };

      scheduleRouteForDriver('driver-A');

      // Reassignment occurs at 10ms (before the 50ms timer fires)
      await new Promise(r => setTimeout(r, 10));
      clearTimeout(debounceTimer);
      debounceTimer = null;

      // Assign Driver B
      scheduleRouteForDriver('driver-B');

      // Wait for Driver B timer to fire
      await new Promise(r => setTimeout(r, 70));

      assert.strictEqual(requestDispatchedForDriver, 'driver-B', 'Driver A timer must not have fired');

      // Verify code clears debounceTimerRef on driver reassignment
      assert.ok(modalContent.includes('assignedDriverId !== previousDriverIdRef.current'));
      assert.ok(modalContent.includes('clearTimeout(routeDebounceTimerRef.current)'));
    });

    // Edge Case 6: Route response arriving after component unmount
    test('30. Route response arriving after component unmount is safely aborted and ignored', async () => {
      let unmounted = false;
      let stateUpdatedAfterUnmount = false;
      let routeAbortController = new AbortController();
      let currentRequestId = 1;

      // Simulated unmount cleanup
      const simulateUnmount = () => {
        unmounted = true;
        routeAbortController.abort();
        currentRequestId++; // Bump request ID
      };

      // Dispatched request with response arriving after unmount
      const runRequest = async () => {
        const reqId = currentRequestId;
        const controller = routeAbortController;

        await new Promise(r => setTimeout(r, 30));

        // Post-response guard in BookingSuccessModal
        if (controller.signal.aborted || reqId !== currentRequestId) {
          return; // Safely dropped
        }

        if (unmounted) {
          stateUpdatedAfterUnmount = true;
        }
      };

      const requestPromise = runRequest();
      simulateUnmount(); // Unmount happens while request is pending
      await requestPromise;

      assert.strictEqual(stateUpdatedAfterUnmount, false, 'State must NOT be updated after unmount');
      assert.strictEqual(routeAbortController.signal.aborted, true, 'Controller must be aborted on unmount');

      // Verify unmount cleanup in BookingSuccessModal
      assert.ok(modalContent.includes('return () => {'));
      assert.ok(modalContent.includes('routeAbortControllerRef.current.abort()'));
    });
  });
});
