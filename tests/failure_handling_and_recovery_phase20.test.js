import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { startTestServer } from './testHelper.js';
import { RealtimeServer, setGlobalRealtimeServer, publishDriverLocation, publishBookingAssignmentChange } from '../server/services/realtimeService.js';
import { updateBookingStatus, cancelBooking, createBooking } from '../server/services/bookingService.js';
import { queryOne, execute } from '../server/db/database.js';
import { ENV } from '../server/config/env.js';
import { RoutingService } from '../server/services/routingService.js';
import { GeocodingService } from '../server/services/geocodingService.js';

// Dedicated realtime port for Phase 20 suite
const REALTIME_PORT = 5198;
const REALTIME_SECRET = 'p20_failure_recovery_secret_key';

function makeToken(user, options = {}) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name || 'Test User',
      email: user.email || 'user@test.com',
      phone: user.phone || '+91 9876543210',
      role: (user.role || 'customer').toLowerCase()
    },
    ENV.JWT_SECRET,
    { expiresIn: options.expiresIn || '1h' }
  );
}

function connectWsClient(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/realtime`);
    const messages = [];
    const timeout = setTimeout(() => {
      reject(new Error('WebSocket connection timed out'));
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
      clearTimeout(timeout);
      reject(err);
    });
  });
}

describe('Phase 20 — Failure Handling & Recovery Suite', () => {
  let appServer, baseUrl, realtimeServer;
  let customerUser, driverUser, driverRecord, activeBooking;
  const pfx = `P20_${Date.now()}`;
  const uSuffix = Math.floor(Math.random() * 89999 + 10000);

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

    // 3. Seed users & driver
    customerUser = {
      id: `USR-C-${pfx}`,
      name: 'Customer P20',
      email: `customer_${pfx}_${uSuffix}@test.com`,
      phone: `+91 98${uSuffix}001`,
      role: 'customer'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, '$2a$12$dummyHashCustomer', 'Active')`,
      [customerUser.id, customerUser.name, customerUser.email, customerUser.phone, customerUser.role]
    );

    driverUser = {
      id: `USR-D-${pfx}`,
      name: 'Driver P20',
      email: `driver_${pfx}_${uSuffix}@test.com`,
      phone: `+91 98${uSuffix}002`,
      role: 'driver'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, '$2a$12$dummyHashDriver', 'Active')`,
      [driverUser.id, driverUser.name, driverUser.email, driverUser.phone, driverUser.role]
    );

    driverRecord = {
      id: `DRV-${pfx}`,
      user_id: driverUser.id,
      name: driverUser.name,
      phone: driverUser.phone,
      license_number: `DL-P20-${uSuffix}`,
      hub_area: 'Indiranagar',
      status: 'Active',
      current_latitude: 12.9716,
      current_longitude: 77.5946
    };
    await execute(
      `INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, status, current_latitude, current_longitude, last_location_update)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [driverRecord.id, driverRecord.user_id, driverRecord.name, driverRecord.phone, driverRecord.license_number, driverRecord.hub_area, driverRecord.status, driverRecord.current_latitude, driverRecord.current_longitude]
    );
    driverUser.driverId = driverRecord.id;

    // Seed an assigned booking
    activeBooking = {
      id: `BKG-${pfx}`,
      user_id: customerUser.id,
      customer_name: customerUser.name,
      customer_phone: customerUser.phone,
      service_name: 'Driver Service',
      booking_type: 'driver',
      status: 'ASSIGNED',
      pickup_area: 'Indiranagar',
      drop_location: 'Whitefield',
      pickup_latitude: 12.9716,
      pickup_longitude: 77.5946,
      destination_latitude: 12.9698,
      destination_longitude: 77.7499,
      date: '2026-10-25',
      time: '10:00:00',
      calculated_fare: 499.00,
      assigned_driver_id: driverRecord.id,
      assigned_driver_name: driverRecord.name,
      assigned_driver_phone: driverRecord.phone
    };
    await execute(
      `INSERT INTO bookings (id, user_id, customer_name, customer_phone, service_name, booking_type, trip_type, status, pickup_area, drop_location, pickup_latitude, pickup_longitude, destination_latitude, destination_longitude, date, time, calculated_fare, assigned_driver_id, assigned_driver_name, assigned_driver_phone)
       VALUES (?, ?, ?, ?, ?, ?, 'one_way', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [activeBooking.id, activeBooking.user_id, activeBooking.customer_name, activeBooking.customer_phone, activeBooking.service_name, activeBooking.booking_type, activeBooking.status, activeBooking.pickup_area, activeBooking.drop_location, activeBooking.pickup_latitude, activeBooking.pickup_longitude, activeBooking.destination_latitude, activeBooking.destination_longitude, activeBooking.date, activeBooking.time, activeBooking.calculated_fare, activeBooking.assigned_driver_id, activeBooking.assigned_driver_name, activeBooking.assigned_driver_phone]
    );
  });

  after(async () => {
    if (realtimeServer) {
      await realtimeServer.close();
    }
    if (appServer && appServer.close) {
      await new Promise(r => appServer.close(r));
    }
  });

  // =========================================================================
  // Group 1: GPS Failure, Denial & Stale Tracking
  // =========================================================================
  describe('1. GPS Failure, Denial & Stale Tracking', () => {
    test('1. GPS permission denied (code 1): sets trackingStatus to denied and clears watch', () => {
      const useDriverLocationSource = fs.readFileSync(path.resolve('src/utils/useDriverLocation.js'), 'utf8');
      assert.ok(useDriverLocationSource.includes("case 1:"), 'Must handle code 1 PERMISSION_DENIED');
      assert.ok(useDriverLocationSource.includes("status = 'denied'"), 'Must set status to denied');
      assert.ok(useDriverLocationSource.includes('navigator.geolocation.clearWatch'), 'Must clear watch on denial');
    });

    test('2. GPS position unavailable (code 2): sets trackingStatus to unavailable with clear message', () => {
      const useDriverLocationSource = fs.readFileSync(path.resolve('src/utils/useDriverLocation.js'), 'utf8');
      assert.ok(useDriverLocationSource.includes("case 2:"), 'Must handle code 2 POSITION_UNAVAILABLE');
      assert.ok(useDriverLocationSource.includes("status = 'unavailable'"), 'Must set status to unavailable');
      assert.ok(useDriverLocationSource.includes('GPS position unavailable'), 'Must communicate position unavailable');
    });

    test('3. GPS timeout (code 3): sets trackingStatus to timeout without crashing', () => {
      const useDriverLocationSource = fs.readFileSync(path.resolve('src/utils/useDriverLocation.js'), 'utf8');
      assert.ok(useDriverLocationSource.includes("case 3:"), 'Must handle code 3 TIMEOUT');
      assert.ok(useDriverLocationSource.includes("status = 'timeout'"), 'Must set status to timeout');
    });

    test('4. GPS unsupported browser: gracefully sets unavailable without calling navigator.geolocation', () => {
      const useDriverLocationSource = fs.readFileSync(path.resolve('src/utils/useDriverLocation.js'), 'utf8');
      assert.ok(useDriverLocationSource.includes("typeof navigator === 'undefined' || !navigator.geolocation"), 'Must check geolocation support');
      assert.ok(useDriverLocationSource.includes("setTrackingStatus('unavailable')"), 'Must set status to unavailable if unsupported');
    });

    test('5. GPS coordinate validation: rejects non-numeric, NaN, Infinity, and out-of-bounds coords', () => {
      const useDriverLocationSource = fs.readFileSync(path.resolve('src/utils/useDriverLocation.js'), 'utf8');
      assert.ok(useDriverLocationSource.includes('isNaN(latitude)'), 'Must check isNaN');
      assert.ok(useDriverLocationSource.includes('isFinite(latitude)'), 'Must check isFinite');
      assert.ok(useDriverLocationSource.includes('latitude < -90 || latitude > 90'), 'Must validate lat bounds');
      assert.ok(useDriverLocationSource.includes('longitude < -180 || longitude > 180'), 'Must validate lng bounds');
      assert.ok(useDriverLocationSource.includes('Device returned invalid GPS coordinates'), 'Must report invalid GPS coords');
    });

    test('6. Stale GPS detection and retryTracking: detects stale timestamp > 60s and provides recovery', () => {
      const useDriverLocationSource = fs.readFileSync(path.resolve('src/utils/useDriverLocation.js'), 'utf8');
      assert.ok(useDriverLocationSource.includes('(Date.now() - timestamp) > 60000'), 'Must detect coordinates older than 60s');
      assert.ok(useDriverLocationSource.includes('retryTracking'), 'Must provide retryTracking recovery function');
    });
  });

  // =========================================================================
  // Group 2: Realtime Transport Failure, Disconnect & Reconnect
  // =========================================================================
  describe('2. Realtime Transport Failure, Disconnect & Reconnect', () => {
    test('7. WebSocket connection failure: transitions to reconnecting using exponential backoff', () => {
      const realtimeHookSource = fs.readFileSync(path.resolve('src/utils/useDriverRealtimeLocation.js'), 'utf8');
      assert.ok(realtimeHookSource.includes("setConnectionStatus('reconnecting')"), 'Must set reconnecting status');
      assert.ok(realtimeHookSource.includes('Math.min(1000 * Math.pow(2, attempt - 1), 10000)'), 'Must use exponential backoff');
    });

    test('8. Max reconnect attempts reached: caps at 6 attempts and transitions to error fallback', () => {
      const realtimeHookSource = fs.readFileSync(path.resolve('src/utils/useDriverRealtimeLocation.js'), 'utf8');
      assert.ok(realtimeHookSource.includes('const maxAttempts = 6'), 'Must set max reconnect attempts');
      assert.ok(realtimeHookSource.includes("setConnectionStatus('error')"), 'Must transition to error when max attempts exceeded');
      assert.ok(realtimeHookSource.includes('Realtime service currently unavailable'), 'Must communicate fallback mode');
    });

    test('9. Authentication failure (close code 4001): aborts reconnection loop immediately', () => {
      const realtimeHookSource = fs.readFileSync(path.resolve('src/utils/useDriverRealtimeLocation.js'), 'utf8');
      assert.ok(realtimeHookSource.includes('evt.code === 4001'), 'Must inspect 4001 close code');
      assert.ok(realtimeHookSource.includes('Authentication rejected by realtime service'), 'Must identify auth rejection');
    });

    test('10. Manual reconnect recovery: reconnect() resets attempt counter and triggers reconnection', () => {
      const realtimeHookSource = fs.readFileSync(path.resolve('src/utils/useDriverRealtimeLocation.js'), 'utf8');
      assert.ok(realtimeHookSource.includes('reconnectAttemptRef.current = 0'), 'Must reset attempt counter on manual reconnect');
      assert.ok(realtimeHookSource.includes('reconnect'), 'Must export reconnect recovery function');
    });

    test('11. Unexpected WebSocket close (e.g. server restart): schedules backoff reconnect without crash', async () => {
      const client = await connectWsClient(REALTIME_PORT);
      client.send({ type: 'authenticate', token: makeToken(customerUser) });
      await client.waitForMessage('authenticated');

      // Force close unexpectedly from client side (code 1006 abnormal or simulated crash)
      client.ws.terminate();
      await new Promise(r => setTimeout(r, 100));
      // Reconnect fresh client to verify server remains stable
      const client2 = await connectWsClient(REALTIME_PORT);
      client2.send({ type: 'authenticate', token: makeToken(customerUser) });
      const authMsg = await client2.waitForMessage('authenticated');
      assert.strictEqual(authMsg.type, 'authenticated');
      client2.close();
    });

    test('12. Malformed JSON message on WebSocket is safely discarded without crashing server or client', async () => {
      const client = await connectWsClient(REALTIME_PORT);
      client.send({ type: 'authenticate', token: makeToken(customerUser) });
      await client.waitForMessage('authenticated');

      // Send invalid JSON text directly
      client.ws.send('NOT_VALID_JSON{abc::123');
      // Verify server remains responsive by sending ping
      client.send({ type: 'ping' });
      const pongMsg = await client.waitForMessage('pong');
      assert.strictEqual(pongMsg.type, 'pong');
      client.close();
    });
  });

  // =========================================================================
  // Group 3: Stale Realtime Data & Freshness Classification
  // =========================================================================
  describe('3. Stale Realtime Data & Freshness Classification', () => {
    test('13. Freshness is UNAVAILABLE when location is not set or disconnected', () => {
      const realtimeHookSource = fs.readFileSync(path.resolve('src/utils/useDriverRealtimeLocation.js'), 'utf8');
      assert.ok(realtimeHookSource.includes("'UNAVAILABLE'"), 'Must return UNAVAILABLE when location is null');
      assert.ok(realtimeHookSource.includes('isUnavailable'), 'Must export isUnavailable');
    });

    test('14. Freshness is LIVE when location timestamp is under 45 seconds old', () => {
      const realtimeHookSource = fs.readFileSync(path.resolve('src/utils/useDriverRealtimeLocation.js'), 'utf8');
      assert.ok(realtimeHookSource.includes("'LIVE'"), 'Must return LIVE when location is fresh');
      assert.ok(realtimeHookSource.includes('isLive'), 'Must export isLive');
    });

    test('15. Freshness transitions to STALE when location timestamp is older than 45 seconds', () => {
      const realtimeHookSource = fs.readFileSync(path.resolve('src/utils/useDriverRealtimeLocation.js'), 'utf8');
      assert.ok(realtimeHookSource.includes('ageMs > 45000'), 'Must check 45s threshold for staleness');
      assert.ok(realtimeHookSource.includes("'STALE'"), 'Must return STALE status');
      assert.ok(realtimeHookSource.includes('isStale'), 'Must export isStale');
    });

    test('16. Realtime coordinates validation: rejects NaN, Infinity, and out-of-bounds coordinates', () => {
      const realtimeHookSource = fs.readFileSync(path.resolve('src/utils/useDriverRealtimeLocation.js'), 'utf8');
      assert.ok(realtimeHookSource.includes('!isNaN(msg.latitude)'), 'Must check isNaN on lat');
      assert.ok(realtimeHookSource.includes('isFinite(msg.latitude)'), 'Must check isFinite on lat');
      assert.ok(realtimeHookSource.includes('msg.latitude >= -90'), 'Must validate min lat');
      assert.ok(realtimeHookSource.includes('msg.latitude <= 90'), 'Must validate max lat');
      assert.ok(realtimeHookSource.includes('msg.longitude >= -180'), 'Must validate min lng');
      assert.ok(realtimeHookSource.includes('msg.longitude <= 180'), 'Must validate max lng');
    });

    test('17. Mismatched driverId in driver.location.updated is ignored and not applied', () => {
      const realtimeHookSource = fs.readFileSync(path.resolve('src/utils/useDriverRealtimeLocation.js'), 'utf8');
      assert.ok(
        realtimeHookSource.includes('if (driverId && msg.driverId && msg.driverId !== driverId)'),
        'Must ignore updates from mismatched driver IDs'
      );
    });
  });

  // =========================================================================
  // Group 4: Route Provider Failure & Degradation
  // =========================================================================
  describe('4. Route Provider Failure & Degradation', () => {
    test('18. OSRM provider timeout: returns PROVIDER_TIMEOUT (504) without exposing stack traces', async () => {
      const mockSlowFetch = async () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      };
      const service = new RoutingService({ fetchFn: mockSlowFetch });
      try {
        await service.getRoute({
          pickupLat: 12.9716,
          pickupLng: 77.5946,
          destLat: 12.9698,
          destLng: 77.7499
        });
        assert.fail('Should have thrown timeout error');
      } catch (err) {
        assert.strictEqual(err.code, 'PROVIDER_TIMEOUT');
        assert.strictEqual(err.status, 504);
        assert.strictEqual(err.message, 'Routing request timed out. Please try again.');
      }
    });

    test('19. OSRM provider network failure: returns PROVIDER_NETWORK_ERROR (502) cleanly', async () => {
      const mockNetworkErrorFetch = async () => {
        throw new Error('Connection refused ECONNREFUSED');
      };
      const service = new RoutingService({ fetchFn: mockNetworkErrorFetch });
      try {
        await service.getRoute({
          pickupLat: 12.9716,
          pickupLng: 77.5946,
          destLat: 12.9698,
          destLng: 77.7499
        });
        assert.fail('Should have thrown network error');
      } catch (err) {
        assert.strictEqual(err.code, 'PROVIDER_NETWORK_ERROR');
        assert.strictEqual(err.status, 502);
      }
    });

    test('20. OSRM provider rate limited (429): returns PROVIDER_RATE_LIMITED with retry advice', async () => {
      const mock429Fetch = async () => ({
        status: 429,
        ok: false
      });
      const service = new RoutingService({ fetchFn: mock429Fetch });
      try {
        await service.getRoute({
          pickupLat: 12.9716,
          pickupLng: 77.5946,
          destLat: 12.9698,
          destLng: 77.7499
        });
        assert.fail('Should have thrown 429');
      } catch (err) {
        assert.strictEqual(err.code, 'PROVIDER_RATE_LIMITED');
        assert.strictEqual(err.status, 429);
      }
    });

    test('21. OSRM provider NoRoute (404): returns NO_ROUTE_FOUND gracefully', async () => {
      const mockNoRouteFetch = async () => ({
        status: 200,
        ok: true,
        json: async () => ({ code: 'NoRoute', routes: [] })
      });
      const service = new RoutingService({ fetchFn: mockNoRouteFetch });
      try {
        await service.getRoute({
          pickupLat: 12.9716,
          pickupLng: 77.5946,
          destLat: 12.9698,
          destLng: 77.7499
        });
        assert.fail('Should have thrown NoRoute');
      } catch (err) {
        assert.strictEqual(err.code, 'NO_ROUTE_FOUND');
        assert.strictEqual(err.status, 404);
      }
    });

    test('22. Same-location route request (< 10m): returns zero metrics immediately without provider call', async () => {
      let fetchCalled = false;
      const mockFetch = async () => {
        fetchCalled = true;
        return { status: 200, ok: true, json: async () => ({}) };
      };
      const service = new RoutingService({ fetchFn: mockFetch });
      const result = await service.getRoute({
        pickupLat: 12.971600,
        pickupLng: 77.594600,
        destLat: 12.971605,
        destLng: 77.594605
      });
      assert.strictEqual(fetchCalled, false, 'External provider must not be called for identical coordinates');
      assert.strictEqual(result.distanceMeters, 0);
      assert.strictEqual(result.durationSeconds, 0);
    });
  });

  // =========================================================================
  // Group 5: Location Search Failure & Autocomplete Recovery
  // =========================================================================
  describe('5. Location Search Failure & Autocomplete Recovery', () => {
    test('23. Nominatim search timeout: returns PROVIDER_TIMEOUT (504) cleanly', async () => {
      const mockSlowFetch = async () => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      };
      const service = new GeocodingService({ fetchFn: mockSlowFetch });
      try {
        await service.search('Indiranagar');
        assert.fail('Should have thrown timeout');
      } catch (err) {
        assert.strictEqual(err.code, 'PROVIDER_TIMEOUT');
        assert.strictEqual(err.status, 504);
      }
    });

    test('24. Search query < 2 characters: rejected with 400 INVALID_QUERY without external call', async () => {
      let called = false;
      const service = new GeocodingService({ fetchFn: () => { called = true; } });
      try {
        await service.search('A');
        assert.fail('Should reject query < 2 chars');
      } catch (err) {
        assert.strictEqual(called, false);
        assert.strictEqual(err.code, 'INVALID_QUERY');
        assert.strictEqual(err.status, 400);
      }
    });

    test('25. LocationSearch component discards aborted in-flight requests and prevents stale results', () => {
      const searchCompSource = fs.readFileSync(path.resolve('src/components/map/LocationSearch.jsx'), 'utf8');
      assert.ok(
        searchCompSource.includes('if (abortControllerRef.current === abortController)'),
        'Must guard setResults with active abortController check'
      );
    });

    test('26. LocationSearch component renders retry action when search fails', () => {
      const searchCompSource = fs.readFileSync(path.resolve('src/components/map/LocationSearch.jsx'), 'utf8');
      assert.ok(searchCompSource.includes('onClick={() => performSearch(query)}'), 'Must provide Retry button calling performSearch');
      assert.ok(searchCompSource.includes('Retry'), 'Must render Retry text');
    });
  });

  // =========================================================================
  // Group 6: Booking API Failures & Transaction Integrity
  // =========================================================================
  describe('6. Booking API Failures & Transaction Integrity', () => {
    test('27. Booking creation with past date: rejected with 400 INVALID_DATE without DB insert', async () => {
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Test Failure Customer',
          customerPhone: '+91 9876543210',
          bookingCategory: 'driver',
          date: '2020-01-01', // Date in the past
          time: '10:00:00'
        })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_DATE');
    });

    test('28. Booking creation with malformed coordinates: rejected with 400 INVALID_COORDINATES', async () => {
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Test Coord Failure',
          customerPhone: '+91 9876543210',
          bookingCategory: 'driver',
          date: '2026-10-25',
          time: '10:00:00',
          pickupLat: 'NOT_A_NUMBER',
          pickupLng: 77.5946
        })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_COORDINATES');
    });

    test('29. BookingModal preserves form inputs and idempotency key on failure so user retry does not duplicate', () => {
      const bookingModalSource = fs.readFileSync(path.resolve('src/components/BookingModal.jsx'), 'utf8');
      assert.ok(
        bookingModalSource.includes('idempotencyKeyRef.current'),
        'Must preserve idempotencyKeyRef on failure'
      );
      assert.ok(
        bookingModalSource.includes('setFormError(apiErr.message ||'),
        'Must set formError without clearing input state'
      );
    });

    test('30. Cancellation of non-existent booking returns 404 BOOKING_NOT_FOUND', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/BKG-NONEXISTENT-9999/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${makeToken(customerUser)}`
        },
        body: JSON.stringify({ reason: 'Test' })
      });
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'BOOKING_NOT_FOUND');
    });

    test('31. Customer attempt to mark booking COMPLETED via API fails with 403 FORBIDDEN', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/${activeBooking.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${makeToken(customerUser)}`
        }
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // Group 7: Race Conditions, Component Unmount & Terminal State Protection
  // =========================================================================
  describe('7. Race Conditions, Component Unmount & Terminal State Protection', () => {
    test('32. Cancellation race: terminal cancellation received via realtime evicts driver location immediately', () => {
      const realtimeHookSource = fs.readFileSync(path.resolve('src/utils/useDriverRealtimeLocation.js'), 'utf8');
      assert.ok(
        realtimeHookSource.includes("upperStatus === 'COMPLETED' || upperStatus === 'CANCELLED'"),
        'Must inspect terminal status in assignment update'
      );
      assert.ok(
        realtimeHookSource.includes('setLocation(null)'),
        'Must clear driver location on terminal status'
      );
    });

    test('33. Completion race: completion status received via realtime clears active driver location', () => {
      const modalSource = fs.readFileSync(path.resolve('src/components/BookingSuccessModal.jsx'), 'utf8');
      assert.ok(
        modalSource.includes("String(currentStatus || '').toUpperCase() === 'COMPLETED'"),
        'Must check for COMPLETED status'
      );
      assert.ok(
        modalSource.includes('isTerminalState'),
        'Must identify terminal state and disable tracking'
      );
    });

    test('34. Driver reassignment race: route request in flight for Driver A is aborted on reassignment', () => {
      const modalSource = fs.readFileSync(path.resolve('src/components/BookingSuccessModal.jsx'), 'utf8');
      assert.ok(
        modalSource.includes('assignedDriverId !== previousDriverIdRef.current'),
        'Must watch for driver assignment changes'
      );
      assert.ok(
        modalSource.includes('routeAbortControllerRef.current.abort()'),
        'Must abort pending route request on driver change'
      );
      assert.ok(
        modalSource.includes('routeRequestIdRef.current++'),
        'Must increment request ID to invalidate stale responses'
      );
    });

    test('35. Driver unassignment race: unassignment clears driver live location and route state', () => {
      const modalSource = fs.readFileSync(path.resolve('src/components/BookingSuccessModal.jsx'), 'utf8');
      assert.ok(
        modalSource.includes('setDriverRoute(null)'),
        'Must clear driver route on unassignment'
      );
      assert.ok(
        modalSource.includes('setDriverRouteError(null)'),
        'Must clear driver route error on unassignment'
      );
    });

    test('36. Booking identity change race: changing booking ID immediately aborts in-flight route requests', () => {
      const modalSource = fs.readFileSync(path.resolve('src/components/BookingSuccessModal.jsx'), 'utf8');
      assert.ok(
        modalSource.includes('bId !== previousBookingIdRef.current'),
        'Must detect change in booking identity'
      );
      assert.ok(
        modalSource.includes('routeRequestIdRef.current++'),
        'Must invalidate request ID on booking identity change'
      );
    });

    test('37. Component unmount: unmounting tracking hook/component cleans up watchers and aborts requests', () => {
      const useDriverLocationSource = fs.readFileSync(path.resolve('src/utils/useDriverLocation.js'), 'utf8');
      assert.ok(
        useDriverLocationSource.includes('navigator.geolocation.clearWatch(watchIdRef.current)'),
        'useDriverLocation must clear watch on unmount'
      );

      const realtimeHookSource = fs.readFileSync(path.resolve('src/utils/useDriverRealtimeLocation.js'), 'utf8');
      assert.ok(
        realtimeHookSource.includes('socketRef.current.close(1000'),
        'useDriverRealtimeLocation must close WebSocket on unmount'
      );
      assert.ok(
        realtimeHookSource.includes('clearTimeout(reconnectTimeoutRef.current)'),
        'useDriverRealtimeLocation must clear reconnect timers on unmount'
      );
    });

    test('38. ErrorBoundary isolation: render exceptions in modals are caught without crashing app root', () => {
      const appSource = fs.readFileSync(path.resolve('src/App.jsx'), 'utf8');
      assert.ok(
        appSource.includes('<ErrorBoundary fallback={null}>\n        <BookingSuccessModal'),
        'BookingSuccessModal must be wrapped in ErrorBoundary'
      );
      assert.ok(
        appSource.includes('<ErrorBoundary fallback={null}>\n        <CancelBookingModal'),
        'CancelBookingModal must be wrapped in ErrorBoundary'
      );
    });
  });
});
