import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from './testHelper.js';
import { calculateAuthoritativeFare } from '../server/services/pricingService.js';
import { createBooking } from '../server/services/bookingService.js';
import { routingService } from '../server/services/routingService.js';
import { queryOne, execute } from '../server/db/database.js';

describe('Phase 7 — Distance, ETA & Authoritative Fare Integration Suite', () => {
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
  // 1. Authoritative Pricing Engine Unit Tests
  // =========================================================================
  describe('1. Authoritative Pricing Engine Unit Tests', () => {
    test('1. Valid route distance produces expected fare using existing pricing rules', () => {
      // Driver one-way city drop with route distance (8.43 km -> 8.43*15 = 126.45, minimum fare 150 applied)
      const fare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        dropLocation: 'Koramangala, Bengaluru',
        distanceKm: 8.43,
        durationMinutes: 22
      });

      assert.strictEqual(fare.baseFare, 100);
      assert.strictEqual(fare.pricePerKm, 15);
      assert.strictEqual(fare.distanceFare, 126.45);
      assert.strictEqual(fare.minimumFareApplied, true);
      assert.strictEqual(fare.totalFare, 150);
      assert.strictEqual(fare.distanceKm, 8.43);
      assert.strictEqual(fare.durationMinutes, 22);
    });

    test('2. Correct service pricing is selected for different services', () => {
      // Airport is a normal destination and uses distance pricing (34.5 km -> 34.5*15 = 517.5)
      const airportFare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        dropLocation: 'Kempegowda Intl Airport (BLR T1/T2)',
        distanceKm: 34.5
      });
      assert.strictEqual(airportFare.baseFare, 100);
      assert.strictEqual(airportFare.totalFare, 517.5);

      // Round trip pure distance tariff (Model B: 2D)
      const roundTripFare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'round-trip',
        distanceKm: 25.0
      });
      assert.strictEqual(roundTripFare.outboundDistanceKm, 25.0);
      assert.strictEqual(roundTripFare.billableDistanceKm, 50.0);
      assert.strictEqual(roundTripFare.isRoundTrip, true);
      // 50 * 15 = 750
      assert.strictEqual(roundTripFare.baseFare, 100);
      assert.strictEqual(roundTripFare.distanceFare, 750);
      assert.strictEqual(roundTripFare.totalFare, 750);

      // Vehicle daily rate
      const vehicleFare = calculateAuthoritativeFare({
        bookingCategory: 'vehicle',
        vehicleCategory: 'SUV',
        distanceKm: 15
      });
      assert.strictEqual(vehicleFare.basePrice, 3499, 'SUV daily base rate must be 3499');

      // Driving Class
      const classFare = calculateAuthoritativeFare({
        bookingCategory: 'class',
        selectedClassId: 'class-beginner'
      });
      assert.strictEqual(classFare.basePrice, 5999);
      assert.strictEqual(classFare.gst, 0, 'Driving classes must have 0 GST');
      assert.strictEqual(classFare.totalFare, 5999);
    });

    test('3. Minimum fare behavior remains correct for short city distances', () => {
      const shortTripFare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        dropLocation: 'MG Road, Bengaluru',
        distanceKm: 1.2
      });
      assert.strictEqual(shortTripFare.minimumFareApplied, true);
      assert.strictEqual(shortTripFare.totalFare, 150);
    });

    test('4. Existing rounding behavior maintains 2 decimal precision for currency consistency', () => {
      const fare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        dropLocation: 'Indiranagar',
        distanceKm: 12.34
      });
      assert.strictEqual(fare.baseFare, 100);
      assert.strictEqual(fare.distanceFare, 185.1);
      assert.strictEqual(fare.totalFare, 185.1);
    });

    test('5. Missing pricing configuration is handled safely', () => {
      // Custom pricing map with null/disabled tariff throws MISSING_PRICING_CONFIG
      const missingConfigMap = {
        driver_one_way_city: null
      };
      assert.throws(
        () => calculateAuthoritativeFare({
          bookingCategory: 'driver',
          driverTripOption: 'one-way'
        }, missingConfigMap),
        (err) => err.code === 'MISSING_PRICING_CONFIG' || err.statusCode === 500
      );
    });

    test('6. Invalid route data prevents pricing', () => {
      assert.throws(
        () => calculateAuthoritativeFare({
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          distanceKm: -15
        }),
        (err) => err.code === 'INVALID_ROUTE_DATA' && err.statusCode === 400
      );

      assert.throws(
        () => calculateAuthoritativeFare({
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          distanceKm: 'invalid_distance'
        }),
        (err) => err.code === 'INVALID_ROUTE_DATA' && err.statusCode === 400
      );
    });
  });

  // =========================================================================
  // 2. Estimate API Integration Tests (/api/bookings/estimate)
  // =========================================================================
  describe('2. Estimate API Integration Tests (/api/bookings/estimate)', () => {
    // Seed routing cache so integration test is deterministic and independent of public OSRM network
    before(() => {
      const cacheKey = routingService.getCacheKey(12.9716, 77.5946, 12.9279, 77.6271);
      routingService.setInCache(cacheKey, {
        distanceMeters: 8433,
        distanceKm: 8.43,
        durationSeconds: 1345,
        durationMinutes: 22,
        geometry: {
          type: 'LineString',
          coordinates: [[77.5946, 12.9716], [77.6271, 12.9279]]
        }
      });
    });

    test('8. Valid coordinates return distance, duration, and authoritative fare', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupLat: 12.9716,
          pickupLng: 77.5946,
          destLat: 12.9279,
          destLng: 77.6271,
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          dropLocation: 'Koramangala, Bengaluru'
        })
      });

      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.distanceKm, 8.43);
      assert.strictEqual(body.data.durationMinutes, 22);
      assert.strictEqual(body.data.baseFare, 100);
      assert.strictEqual(body.data.pricePerKm, 15);
      assert.strictEqual(body.data.distanceFare, 126.45);
      assert.strictEqual(body.data.totalFare, 150);
      assert.strictEqual(body.data.currency, 'INR');
    });

    test('9. Invalid coordinates are rejected with 400 INVALID_COORDINATES', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupLat: 195, // Invalid lat
          pickupLng: 77.5946,
          destLat: 12.9279,
          destLng: 77.6271
        })
      });

      const body = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'INVALID_COORDINATES');
    });

    test('10. Missing coordinates are rejected with 400 INVALID_COORDINATES', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupLat: 12.9716,
          destLat: 12.9279
        })
      });

      const body = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'INVALID_COORDINATES');
    });

    test('11. Unsupported service category is rejected with 400 UNSUPPORTED_SERVICE', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupLat: 12.9716,
          pickupLng: 77.5946,
          destLat: 12.9279,
          destLng: 77.6271,
          bookingCategory: 'helicopter'
        })
      });

      const body = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'UNSUPPORTED_SERVICE');
    });

    test('12. Provider failure / NoRoute returns proper error status without crash', async () => {
      // Out-of-bounds coordinates that can have no road connection or simulated route failure
      const res = await fetch(`${baseUrl}/api/bookings/estimate?pickupLat=0&pickupLng=0&destLat=0.01&destLng=0.01`);
      const body = await res.json();
      // Should return an application error rather than crashing
      assert.strictEqual(body.success, false);
      assert.ok(body.error && body.error.code);
    });
  });

  // =========================================================================
  // 3. Booking Security & Anti-Tampering Tests
  // =========================================================================
  describe('3. Booking Security & Anti-Tampering Tests', () => {
    const futureDate = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];

    test('13. Client-provided fare cannot override server authoritative fare', async () => {
      const maliciousPayload = {
        customerName: 'Security Tester',
        customerPhone: '9876543210',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        dropLocation: 'Kempegowda Intl Airport (BLR T1/T2)',
        pickupArea: 'Indiranagar',
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        destLat: 12.9279,
        destLng: 77.6271,
        calculated_fare: 10, // Maliciously altered client fare
        date: futureDate,
        time: '10:00 AM'
      };

      const result = await createBooking(maliciousPayload);
      assert.ok(result.booking, 'Booking must be created');
      // For route 8.43 km, distance fare is 8.43 * 15 = 126.45 < minimumFare 150 -> 150.00
      // Must NOT be the client-submitted 10!
      assert.strictEqual(result.booking.calculated_fare, 150, 'Server authoritative fare must win over client fare');
    });

    test('14. Client-provided distance cannot override authoritative distance', async () => {
      const maliciousDistancePayload = {
        customerName: 'Distance Tamperer',
        customerPhone: '9876543210',
        bookingCategory: 'driver',
        driverTripOption: 'round-trip',
        pickupArea: 'Indiranagar',
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        destLat: 12.9279,
        destLng: 77.6271,
        distanceKm: 1.0, // Client claiming 1km
        date: futureDate,
        time: '11:00 AM'
      };

      const result = await createBooking(maliciousDistancePayload);
      assert.ok(result.booking);
      // Backend independently recalculates route: cached distance is 8.43 km -> billable distance is 16.86 km -> fare is 16.86*15 = 252.9
      assert.strictEqual(result.booking.calculated_fare, 252.9);
    });

    test('15. Artificially high client fare is ignored and recalculated to authoritative price', async () => {
      const inflatedPayload = {
        customerName: 'High Fare Tester',
        customerPhone: '9876543210',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        dropLocation: 'Koramangala, Bengaluru',
        pickupArea: 'Indiranagar',
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        destLat: 12.9279,
        destLng: 77.6271,
        calculated_fare: 99999, // Artificially high client fare
        date: futureDate,
        time: '12:00 PM'
      };

      const result = await createBooking(inflatedPayload);
      assert.strictEqual(result.booking.calculated_fare, 150, 'Backend must compute exact 150.00 tariff floor, ignoring 99999');
    });

    test('16. Artificially low client fare (₹0 or ₹1) is ignored and server tariff wins', async () => {
      const zeroPayload = {
        customerName: 'Zero Fare Tester',
        customerPhone: '9876543210',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        dropLocation: 'Koramangala, Bengaluru',
        pickupArea: 'Indiranagar',
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        destLat: 12.9279,
        destLng: 77.6271,
        calculated_fare: 0,
        date: futureDate,
        time: '01:00 PM'
      };

      const result = await createBooking(zeroPayload);
      assert.strictEqual(result.booking.calculated_fare, 150);
    });

    test('17. Booking in database receives the authoritative server-calculated fare', async () => {
      const booking = await queryOne('SELECT * FROM bookings WHERE customer_name = ? ORDER BY created_at DESC', ['Zero Fare Tester']);
      assert.ok(booking);
      assert.strictEqual(booking.calculated_fare, 150, 'Database record must store authoritative 150.00 fare');
    });
  });

  // =========================================================================
  // 4. Frontend Contract & Architecture Verification
  // =========================================================================
  describe('4. Frontend Contract & Architecture Verification', () => {
    const modalPath = path.resolve('src/components/BookingModal.jsx');
    const modalContent = fs.readFileSync(modalPath, 'utf8');
    const clientPath = path.resolve('src/services/apiClient.js');
    const clientContent = fs.readFileSync(clientPath, 'utf8');

    test('18. Fare estimation occurs only after a valid route is available', () => {
      assert.match(
        modalContent,
        /if\s*\(\s*!routeData\s*\|\|\s*!pickupLocation/,
        'Must check routeData existence before triggering fare estimate'
      );
      assert.match(
        modalContent,
        /apiClient\.getBookingEstimate/,
        'Must call apiClient.getBookingEstimate'
      );
    });

    test('19. Loading state is displayed during fare calculation', () => {
      assert.match(
        modalContent,
        /fareLoading\s*&&/,
        'Must have conditional render for fareLoading'
      );
      assert.match(
        modalContent,
        /Calculating authoritative fare\.\.\./,
        'Must display user-facing calculating fare message'
      );
    });

    test('20. Fare is displayed correctly in route badge and payment option', () => {
      assert.match(
        modalContent,
        /Estimated Fare:\s*₹\{fareEstimate\.totalFare\}/,
        'Must display Estimated Fare in route badge'
      );
      assert.match(
        modalContent,
        /Total ₹\{effectiveTotalFare\.toLocaleString\('en-IN'\)\}/,
        'Must display effectiveTotalFare in payment options'
      );
    });

    test('21 & 22. Changing pickup or destination clears stale fare estimate', () => {
      assert.match(
        modalContent,
        /const handleClearPickup = \(\) => \{[\s\S]*?setFareEstimate\(null\);[\s\S]*?setFareLoading\(false\);/,
        'handleClearPickup must reset fareEstimate and fareLoading'
      );
      assert.match(
        modalContent,
        /const handleClearDestination = \(\) => \{[\s\S]*?setFareEstimate\(null\);[\s\S]*?setFareLoading\(false\);/,
        'handleClearDestination must reset fareEstimate and fareLoading'
      );
    });

    test('23. Stale estimate response cannot overwrite a newer estimate (AbortController protection)', () => {
      assert.match(
        modalContent,
        /fareAbortRef\.current\.abort\(\)/,
        'Must abort previous in-flight fare estimate'
      );
      assert.match(
        modalContent,
        /if\s*\(fareAbortRef\.current === controller\)/,
        'Must guard state updates against superseded fare controllers'
      );
    });

    test('24. Routing failure or clear prevents stale fare from being displayed', () => {
      assert.match(
        modalContent,
        /if\s*\(\s*!routeData/,
        'Clearing routeData must immediately reset fareEstimate'
      );
    });

    test('25. Existing booking submission contract remains compatible and includes coordinates', () => {
      assert.match(modalContent, /pickupLat:\s*pickupLocation\?\.latitude/, 'Must attach pickupLat to payloadForApi');
      assert.match(modalContent, /destLat:\s*destinationLocation\?\.latitude/, 'Must attach destLat to payloadForApi');
      assert.match(modalContent, /totalFare:\s*effectiveTotalFare/, 'Must submit effectiveTotalFare');
    });

    test('26. apiClient includes getBookingEstimate and estimateBookingFare methods', () => {
      assert.match(clientContent, /getBookingEstimate:\s*\(estimateData/, 'apiClient must have getBookingEstimate');
      assert.match(clientContent, /estimateBookingFare:\s*\(estimateData/, 'apiClient must have estimateBookingFare');
    });

    test('27. Strict database boundary: ZERO distance/duration/geometry columns added to bookings schema', () => {
      const schemaPath = path.resolve('server/db/schema.js');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      assert.ok(!schemaContent.includes('distance_km'), 'Schema must not include distance_km');
      assert.ok(!schemaContent.includes('estimated_duration'), 'Schema must not include estimated_duration');
      assert.ok(!schemaContent.includes('route_geometry'), 'Schema must not include route_geometry');
    });
  });
});
