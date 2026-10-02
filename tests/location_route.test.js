import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from './testHelper.js';
import { RoutingService, routingService } from '../server/services/routingService.js';
import { RATE_LIMITS } from '../server/config/security.js';

describe('Phase 6 — OSRM Routing Architecture & Integration Suite', () => {
  let server, baseUrl;

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
  // 1. Backend RoutingService Unit Tests (OSRM Integration & Normalization)
  // =========================================================================
  describe('1. Backend RoutingService Unit Tests', () => {
    const validPickup = { lat: 12.9716, lng: 77.5946 }; // MG Road, Bangalore
    const validDest = { lat: 12.9279, lng: 77.6271 };   // Koramangala, Bangalore

    test('1. Valid coordinates return normalized route data with GeoJSON geometry', async () => {
      const mockOsrmResponse = {
        code: 'Ok',
        routes: [
          {
            distance: 8432.5,
            duration: 1345.2,
            geometry: {
              type: 'LineString',
              coordinates: [
                [77.5946, 12.9716],
                [77.6050, 12.9550],
                [77.6271, 12.9279]
              ]
            }
          }
        ]
      };

      const mockFetch = async (url) => {
        // Assert coordinate order in OSRM URL: {lng},{lat};{lng},{lat}
        assert.ok(url.includes('/route/v1/driving/77.5946,12.9716;77.6271,12.9279'));
        return {
          ok: true,
          status: 200,
          json: async () => mockOsrmResponse
        };
      };

      const service = new RoutingService({ fetchFn: mockFetch });
      const result = await service.getRoute({
        pickupLat: validPickup.lat,
        pickupLng: validPickup.lng,
        destLat: validDest.lat,
        destLng: validDest.lng
      });

      assert.strictEqual(result.distanceMeters, 8433);
      assert.strictEqual(result.distanceKm, 8.43);
      assert.strictEqual(result.durationSeconds, 1345);
      assert.strictEqual(result.durationMinutes, 22);
      assert.strictEqual(result.geometry.type, 'LineString');
      assert.deepStrictEqual(result.geometry.coordinates, mockOsrmResponse.routes[0].geometry.coordinates);
      assert.strictEqual(result.fromCache, false);
    });

    test('2. Invalid latitude (< -90 or > 90) is rejected with 400', async () => {
      const service = new RoutingService();
      await assert.rejects(
        () => service.getRoute({ pickupLat: 95, pickupLng: 77.5, destLat: 12.9, destLng: 77.6 }),
        (err) => err.code === 'INVALID_COORDINATES' && err.status === 400
      );
      await assert.rejects(
        () => service.getRoute({ pickupLat: 12.9, pickupLng: 77.5, destLat: -95, destLng: 77.6 }),
        (err) => err.code === 'INVALID_COORDINATES' && err.status === 400
      );
    });

    test('3. Invalid longitude (< -180 or > 180) is rejected with 400', async () => {
      const service = new RoutingService();
      await assert.rejects(
        () => service.getRoute({ pickupLat: 12.9, pickupLng: 185, destLat: 12.9, destLng: 77.6 }),
        (err) => err.code === 'INVALID_COORDINATES' && err.status === 400
      );
      await assert.rejects(
        () => service.getRoute({ pickupLat: 12.9, pickupLng: 77.5, destLat: 12.9, destLng: -185 }),
        (err) => err.code === 'INVALID_COORDINATES' && err.status === 400
      );
    });

    test('4. Missing coordinate is rejected with 400', async () => {
      const service = new RoutingService();
      await assert.rejects(
        () => service.getRoute({ pickupLat: undefined, pickupLng: 77.5, destLat: 12.9, destLng: 77.6 }),
        (err) => err.code === 'INVALID_COORDINATES' && err.status === 400
      );
    });

    test('5. Non-numeric or NaN/Infinity coordinate is rejected with 400', async () => {
      const service = new RoutingService();
      await assert.rejects(
        () => service.getRoute({ pickupLat: 'invalid_lat', pickupLng: 77.5, destLat: 12.9, destLng: 77.6 }),
        (err) => err.code === 'INVALID_COORDINATES' && err.status === 400
      );
      await assert.rejects(
        () => service.getRoute({ pickupLat: Infinity, pickupLng: 77.5, destLat: 12.9, destLng: 77.6 }),
        (err) => err.code === 'INVALID_COORDINATES' && err.status === 400
      );
    });

    test('6. Same pickup and destination coordinates return zero distance/duration safely without provider call', async () => {
      let fetchCalled = false;
      const mockFetch = async () => {
        fetchCalled = true;
        return { ok: true, status: 200, json: async () => ({}) };
      };

      const service = new RoutingService({ fetchFn: mockFetch });
      const result = await service.getRoute({
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        destLat: 12.9716,
        destLng: 77.5946
      });

      assert.strictEqual(fetchCalled, false, 'External fetch must NOT be invoked for identical coordinates');
      assert.strictEqual(result.distanceMeters, 0);
      assert.strictEqual(result.distanceKm, 0);
      assert.strictEqual(result.durationSeconds, 0);
      assert.strictEqual(result.durationMinutes, 0);
      assert.strictEqual(result.geometry.type, 'LineString');
      assert.strictEqual(result.geometry.coordinates.length, 2);
    });

    test('7. OSRM NoRoute code returns 404 NO_ROUTE_FOUND', async () => {
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ code: 'NoRoute', message: 'No route found between points' })
      });

      const service = new RoutingService({ fetchFn: mockFetch });
      await assert.rejects(
        () => service.getRoute({ pickupLat: 12.9, pickupLng: 77.5, destLat: 13.0, destLng: 77.6 }),
        (err) => err.code === 'NO_ROUTE_FOUND' && err.status === 404
      );
    });

    test('8. OSRM 4xx (429 Rate Limit and generic 400) is handled safely', async () => {
      const rateLimitedFetch = async () => ({
        ok: false,
        status: 429
      });

      const serviceRateLimit = new RoutingService({ fetchFn: rateLimitedFetch });
      await assert.rejects(
        () => serviceRateLimit.getRoute({ pickupLat: 12.9, pickupLng: 77.5, destLat: 13.0, destLng: 77.6 }),
        (err) => err.code === 'PROVIDER_RATE_LIMITED' && err.status === 429
      );

      const clientErrorFetch = async () => ({
        ok: false,
        status: 400
      });

      const serviceClientErr = new RoutingService({ fetchFn: clientErrorFetch });
      await assert.rejects(
        () => serviceClientErr.getRoute({ pickupLat: 12.9, pickupLng: 77.5, destLat: 13.0, destLng: 77.6 }),
        (err) => err.code === 'PROVIDER_ERROR' && err.status === 400
      );
    });

    test('9. OSRM 5xx returns 503 PROVIDER_UNAVAILABLE', async () => {
      const serverErrorFetch = async () => ({
        ok: false,
        status: 502
      });

      const service = new RoutingService({ fetchFn: serverErrorFetch });
      await assert.rejects(
        () => service.getRoute({ pickupLat: 12.9, pickupLng: 77.5, destLat: 13.0, destLng: 77.6 }),
        (err) => err.code === 'PROVIDER_UNAVAILABLE' && err.status === 503
      );
    });

    test('10. OSRM timeout via AbortError returns 504 PROVIDER_TIMEOUT', async () => {
      const timeoutFetch = async () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      };

      const service = new RoutingService({ fetchFn: timeoutFetch });
      await assert.rejects(
        () => service.getRoute({ pickupLat: 12.9, pickupLng: 77.5, destLat: 13.0, destLng: 77.6 }),
        (err) => err.code === 'PROVIDER_TIMEOUT' && err.status === 504
      );
    });

    test('11. Malformed OSRM responses are rejected safely with 502', async () => {
      // Non-json response
      const nonJsonFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => { throw new Error('Unexpected token < in JSON'); }
      });
      const serviceNonJson = new RoutingService({ fetchFn: nonJsonFetch });
      await assert.rejects(
        () => serviceNonJson.getRoute({ pickupLat: 12.9, pickupLng: 77.5, destLat: 13.0, destLng: 77.6 }),
        (err) => err.code === 'PROVIDER_MALFORMED_RESPONSE' && err.status === 502
      );

      // Missing route array or coordinates
      const invalidPayloadFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ code: 'Ok', routes: [{ distance: 'not-a-number' }] })
      });
      const serviceInvalid = new RoutingService({ fetchFn: invalidPayloadFetch });
      await assert.rejects(
        () => serviceInvalid.getRoute({ pickupLat: 12.9, pickupLng: 77.5, destLat: 13.0, destLng: 77.6 }),
        (err) => err.code === 'PROVIDER_MALFORMED_RESPONSE' && err.status === 502
      );
    });

    test('12. Valid geometry is normalized to LineString and metrics correctly rounded', async () => {
      const mockOsrm = {
        code: 'Ok',
        routes: [
          {
            distance: 12500, // 12.5 km
            duration: 1800,  // 30 min
            geometry: {
              type: 'LineString',
              coordinates: [[77.5, 12.9], [77.6, 13.0]]
            }
          }
        ]
      };

      const service = new RoutingService({ fetchFn: async () => ({ ok: true, status: 200, json: async () => mockOsrm }) });
      const route = await service.getRoute({ pickupLat: 12.9, pickupLng: 77.5, destLat: 13.0, destLng: 77.6 });

      assert.strictEqual(route.distanceKm, 12.5);
      assert.strictEqual(route.durationMinutes, 30);
      assert.strictEqual(route.geometry.type, 'LineString');
      assert.deepStrictEqual(route.geometry.coordinates, [[77.5, 12.9], [77.6, 13.0]]);
    });

    test('13. Bounded in-memory cache stores routes and returns cached result on repeat requests', async () => {
      let callCount = 0;
      const mockOsrm = {
        code: 'Ok',
        routes: [{
          distance: 5000,
          duration: 600,
          geometry: { type: 'LineString', coordinates: [[77.5, 12.9], [77.6, 13.0]] }
        }]
      };

      const service = new RoutingService({
        fetchFn: async () => {
          callCount++;
          return { ok: true, status: 200, json: async () => mockOsrm };
        }
      });

      const firstCall = await service.getRoute({ pickupLat: 12.9, pickupLng: 77.5, destLat: 13.0, destLng: 77.6 });
      assert.strictEqual(firstCall.fromCache, false);
      assert.strictEqual(callCount, 1);

      const secondCall = await service.getRoute({ pickupLat: 12.9, pickupLng: 77.5, destLat: 13.0, destLng: 77.6 });
      assert.strictEqual(secondCall.fromCache, true);
      assert.strictEqual(callCount, 1, 'Repeat request must be served from cache without second fetch call');
      assert.strictEqual(secondCall.distanceKm, 5);
    });

    test('14. Rate limiting is configured for routing endpoint in security config', () => {
      assert.ok(RATE_LIMITS.LOCATION_ROUTE, 'LOCATION_ROUTE rate limit configuration must exist');
      assert.strictEqual(RATE_LIMITS.LOCATION_ROUTE.max, 30);
      assert.strictEqual(RATE_LIMITS.LOCATION_ROUTE.windowMs, 60000);
    });
  });

  // =========================================================================
  // 2. HTTP Endpoint Integration Tests (GET /api/location/route)
  // =========================================================================
  describe('2. HTTP Endpoint Integration Tests (GET /api/location/route)', () => {
    test('2.1 Rejects request when coordinates are missing with 400', async () => {
      const res = await fetch(`${baseUrl}/api/location/route?pickupLat=12.9716&pickupLng=77.5946`);
      const body = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'INVALID_COORDINATES');
    });

    test('2.2 Rejects non-numeric coordinates with 400', async () => {
      const res = await fetch(`${baseUrl}/api/location/route?pickupLat=invalid&pickupLng=77.5946&destLat=12.9&destLng=77.6`);
      const body = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'INVALID_COORDINATES');
    });

    test('2.3 Rejects out-of-bounds coordinates with 400', async () => {
      const res = await fetch(`${baseUrl}/api/location/route?pickupLat=95&pickupLng=77.5946&destLat=12.9&destLng=77.6`);
      const body = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'INVALID_COORDINATES');
    });

    test('2.4 Handles identical pickup and destination via HTTP endpoint with 200 and zero metrics', async () => {
      const res = await fetch(`${baseUrl}/api/location/route?pickupLat=12.9716&pickupLng=77.5946&destLat=12.9716&destLng=77.5946`);
      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.distanceMeters, 0);
      assert.strictEqual(body.data.durationMinutes, 0);
      assert.strictEqual(body.data.geometry.type, 'LineString');
    });

    test('2.5 Supports both short (pickupLat) and long (pickupLatitude) query parameters', async () => {
      const res = await fetch(`${baseUrl}/api/location/route?pickupLatitude=12.9716&pickupLongitude=77.5946&destinationLatitude=12.9716&destinationLongitude=77.5946`);
      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.distanceMeters, 0);
    });
  });

  // =========================================================================
  // 3. Frontend Routing Architecture & Contract Verification
  // =========================================================================
  describe('3. Frontend Routing Architecture & Contract Verification', () => {
    const modalPath = path.resolve('src/components/BookingModal.jsx');
    const modalContent = fs.readFileSync(modalPath, 'utf8');
    const polylinePath = path.resolve('src/components/map/RoutePolyline.jsx');
    const polylineContent = fs.readFileSync(polylinePath, 'utf8');

    test('15 & 16. Route request condition: does not request route when either pickup or destination is missing', () => {
      // Must check that both pickupLocation and destinationLocation exist before requesting route
      assert.match(
        modalContent,
        /!pickupLocation\s*\|\|\s*typeof pickupLocation\.latitude !== 'number'/,
        'Must guard against missing pickupLocation'
      );
      assert.match(
        modalContent,
        /!destinationLocation\s*\|\|\s*typeof destinationLocation\.latitude !== 'number'/,
        'Must guard against missing destinationLocation'
      );
    });

    test('17. Route request occurs when both pickup and destination exist', () => {
      assert.match(
        modalContent,
        /apiClient\.getLocationRoute\(/,
        'BookingModal must trigger apiClient.getLocationRoute when both locations exist'
      );
    });

    test('18. Route is rendered via RoutePolyline using Leaflet with GeoJSON [lng, lat] converted to [lat, lng]', () => {
      assert.ok(fs.existsSync(polylinePath), 'RoutePolyline.jsx component must exist');
      assert.match(modalContent, /<RoutePolyline\s+geometry=\{routeData\.geometry\}/, 'BookingModal must render RoutePolyline with geometry');
      
      // Conversion from GeoJSON [lng, lat] to Leaflet [lat, lng]
      assert.match(
        polylineContent,
        /\.map\(\(\[lng,\s*lat\]\)\s*=>\s*\[lat,\s*lng\]\)/,
        'RoutePolyline must convert GeoJSON [lng, lat] to Leaflet [lat, lng]'
      );
      assert.match(polylineContent, /<Polyline/, 'RoutePolyline must render Leaflet Polyline');
    });

    test('19. Distance and duration UI display appears from OSRM response', () => {
      assert.match(
        modalContent,
        /\{routeData\.distanceKm\}\s*km/,
        'Must render distance in km from routeData'
      );
      assert.match(
        modalContent,
        /~\{routeData\.durationMinutes\}\s*min/,
        'Must render duration in minutes from routeData'
      );
    });

    test('20 & 21. Clearing pickup or destination resets route state', () => {
      // When pickup is cleared
      assert.match(
        modalContent,
        /const handleClearPickup = \(\) => \{[\s\S]*?setRouteData\(null\);[\s\S]*?setRouteLoading\(false\);/,
        'handleClearPickup must reset routeData and routeLoading'
      );
      // When destination is cleared
      assert.match(
        modalContent,
        /const handleClearDestination = \(\) => \{[\s\S]*?setRouteData\(null\);[\s\S]*?setRouteLoading\(false\);/,
        'handleClearDestination must reset routeData and routeLoading'
      );
    });

    test('22 & 23. Changing pickup or destination triggers dependency array in useEffect', () => {
      assert.match(
        modalContent,
        /\}, \[pickupLocation,\s*destinationLocation\]\);/,
        'Route calculation useEffect must re-run when pickupLocation or destinationLocation changes'
      );
    });

    test('24. Loading state appears during routing calculation', () => {
      assert.match(
        modalContent,
        /routeLoading\s*&&/,
        'BookingModal must conditionally render routeLoading indicator'
      );
      assert.match(
        modalContent,
        /Calculating road route\.\.\./,
        'Must display user-friendly calculating message'
      );
    });

    test('25. Routing error is displayed safely without raw exceptions', () => {
      assert.match(
        modalContent,
        /routeError\s*&&/,
        'BookingModal must conditionally render routeError alert'
      );
      assert.match(
        modalContent,
        /<span>\{routeError\}<\/span>/,
        'Must render clean routeError message'
      );
    });

    test('26. Stale route responses cannot overwrite newer selections (AbortController protection)', () => {
      assert.match(
        modalContent,
        /routeAbortRef\.current\.abort\(\)/,
        'Must abort previous in-flight route request'
      );
      assert.match(
        modalContent,
        /new AbortController\(\)/,
        'Must create new AbortController per request'
      );
      assert.match(
        modalContent,
        /signal:\s*controller\.signal/,
        'Must pass signal to apiClient'
      );
      assert.match(
        modalContent,
        /if\s*\(routeAbortRef\.current === controller\)/,
        'Must guard state updates against superseded controllers'
      );
    });

    test('27. Browser never contacts OSRM directly in frontend source files', () => {
      const srcDir = path.resolve('src');
      const files = fs.readdirSync(srcDir, { recursive: true });
      for (const file of files) {
        if (typeof file === 'string' && (file.endsWith('.js') || file.endsWith('.jsx'))) {
          const filePath = path.join(srcDir, file);
          if (fs.statSync(filePath).isFile()) {
            const code = fs.readFileSync(filePath, 'utf8');
            assert.ok(
              !code.includes('router.project-osrm.org'),
              `Direct OSRM URL forbidden in frontend file: ${file}`
            );
          }
        }
      }
    });

    test('28. Strict Phase 6 boundary: Distance/duration do NOT affect fare calculation or booking payload', () => {
      // 1. calculateTotalFare function must not reference routeData or distanceKm
      const calcTotalFareBlock = modalContent.slice(
        modalContent.indexOf('const calculateTotalFare = () => {'),
        modalContent.indexOf('const fareInfo = calculateTotalFare();')
      );
      assert.ok(
        !calcTotalFareBlock.includes('routeData'),
        'calculateTotalFare must NOT use routeData in Phase 6'
      );
      assert.ok(
        !calcTotalFareBlock.includes('distanceKm'),
        'calculateTotalFare must NOT use distanceKm in Phase 6'
      );

      // 2. Booking payload submitted to API must not contain distance or duration or coordinates
      const submitBlock = modalContent.slice(
        modalContent.indexOf('const handleSubmitBooking = async'),
        modalContent.indexOf('onBookingComplete(bookingDetails);')
      );
      assert.ok(!submitBlock.includes('distance_km'), 'Booking payload must NOT contain distance_km');
      assert.ok(!submitBlock.includes('distanceKm'), 'Booking payload must NOT contain distanceKm');
      assert.ok(!submitBlock.includes('estimated_duration'), 'Booking payload must NOT contain estimated_duration');
      assert.ok(!submitBlock.includes('pickup_latitude'), 'Booking payload must NOT contain pickup_latitude');
      assert.ok(!submitBlock.includes('pickup_longitude'), 'Booking payload must NOT contain pickup_longitude');
    });
  });
});
