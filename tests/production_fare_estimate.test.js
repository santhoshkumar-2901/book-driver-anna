import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { startTestServer } from './testHelper.js';
import { calculateAuthoritativeFare, getAllPricing, updateServicePricing, resetServicePricing } from '../server/services/pricingService.js';
import { createBooking } from '../server/services/bookingService.js';
import { routingService } from '../server/services/routingService.js';
import { queryOne, execute } from '../server/db/database.js';
import { bootstrapAdmin } from '../server/scripts/bootstrapAdmin.js';

describe('Production Fare Estimate & Distance Pricing Test Suite', () => {
  let server, baseUrl;
  let adminToken;
  const adminEmail = `admin_fare_${Date.now()}@bookdriveranna.com`;
  const adminPassword = 'AdminFarePass2026!';

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // Seed mock route in routing cache for deterministic testing without external network
    const cacheKey = routingService.getCacheKey(9.9195, 78.1193, 9.9175, 78.1194);
    routingService.setInCache(cacheKey, {
      distanceMeters: 4820,
      distanceKm: 4.82,
      durationSeconds: 900,
      durationMinutes: 15,
      geometry: {
        type: 'LineString',
        coordinates: [[78.1193, 9.9195], [78.1194, 9.9175]]
      }
    });

    // Also seed Bangalore test route
    const blrKey = routingService.getCacheKey(12.9716, 77.5946, 12.9279, 77.6271);
    routingService.setInCache(blrKey, {
      distanceMeters: 8430,
      distanceKm: 8.43,
      durationSeconds: 1320,
      durationMinutes: 22,
      geometry: {
        type: 'LineString',
        coordinates: [[77.5946, 12.9716], [77.6271, 12.9279]]
      }
    });

    // Create admin user for admin pricing updates
    await bootstrapAdmin({
      email: adminEmail,
      password: adminPassword,
      name: 'Fare Admin',
      phone: `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`,
      area: 'Madurai Central'
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: adminEmail,
        password: adminPassword
      })
    });
    const loginData = await loginRes.json();
    adminToken = loginData.data?.token;
  });

  after(async () => {
    if (server) {
      await new Promise((res) => server.close(res));
    }
  });

  // =========================================================================
  // 1. Pricing Engine & Mathematical Formulas
  // =========================================================================
  describe('1. Pricing Engine & Mathematical Formulas', () => {
    test('1.1 Base fare, per-km fare and distance calculation (Madurai Example: 4.82 km)', () => {
      // Pickup: Meenakshi Amman Temple (9.9195, 78.1193) -> Drop: Madurai Railway Station (9.9175, 78.1194)
      // Distance: 4.82 km, Base: 100, Price/km: 15 -> distanceFare = 72.30, total = 172.30
      const pricingMap = {
        driver_base_fare: { id: 'driver_base_fare', category: 'driver', name: 'Base Fare', price: 100 },
        driver_price_per_km: { id: 'driver_price_per_km', category: 'driver', name: 'Price Per KM', price: 15 },
        driver_min_fare: { id: 'driver_min_fare', category: 'driver', name: 'Minimum Fare', price: 150 }
      };

      const fare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        isDistancePricing: true,
        distanceKm: 4.82,
        durationMinutes: 15
      }, pricingMap);

      assert.strictEqual(fare.baseFare, 100, 'Base fare must be 100');
      assert.strictEqual(fare.pricePerKm, 15, 'Price per km must be 15');
      assert.strictEqual(fare.distanceFare, 72.30, 'Distance fare must be 4.82 * 15 = 72.30');
      assert.strictEqual(fare.subtotal, 172.30, 'Subtotal must be 100 + 72.30 = 172.30');
      assert.strictEqual(fare.calculatedFare, 172.30, 'Calculated fare must be 172.30');
      assert.strictEqual(fare.currency, 'INR');
    });

    test('1.2 Minimum fare application when subtotal is below minimum fare', () => {
      // Short trip 1.0 km: base 100 + 15 = 115, but minimum fare is 150
      const pricingMap = {
        driver_base_fare: { id: 'driver_base_fare', category: 'driver', name: 'Base Fare', price: 100 },
        driver_price_per_km: { id: 'driver_price_per_km', category: 'driver', name: 'Price Per KM', price: 15 },
        driver_min_fare: { id: 'driver_min_fare', category: 'driver', name: 'Minimum Fare', price: 150 }
      };

      const fare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        isDistancePricing: true,
        distanceKm: 1.0,
        durationMinutes: 5
      }, pricingMap);

      assert.strictEqual(fare.subtotal, 115.00);
      assert.strictEqual(fare.minimumFare, 150);
      assert.strictEqual(fare.minimumFareApplied, true);
      assert.strictEqual(fare.calculatedFare, 150.00, 'Calculated fare must be bumped to minimum fare 150');
    });

    test('1.3 Changed admin price dynamically updates fare calculation', () => {
      // Admin changes price from ₹15 to ₹18
      const updatedPricingMap = {
        driver_base_fare: { id: 'driver_base_fare', category: 'driver', name: 'Base Fare', price: 100 },
        driver_price_per_km: { id: 'driver_price_per_km', category: 'driver', name: 'Price Per KM', price: 18 },
        driver_min_fare: { id: 'driver_min_fare', category: 'driver', name: 'Minimum Fare', price: 150 }
      };

      const fare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        isDistancePricing: true,
        distanceKm: 4.82,
        durationMinutes: 15
      }, updatedPricingMap);

      assert.strictEqual(fare.pricePerKm, 18);
      assert.strictEqual(fare.distanceFare, 86.76, 'Distance fare must be 4.82 * 18 = 86.76');
      assert.strictEqual(fare.calculatedFare, 186.76, 'Calculated fare must be 100 + 86.76 = 186.76');
    });

    test('1.4 Reject invalid distance inputs (NaN, negative, infinite)', () => {
      assert.throws(() => {
        calculateAuthoritativeFare({
          bookingCategory: 'driver',
          isDistancePricing: true,
          distanceKm: -5
        });
      }, (err) => err.code === 'INVALID_ROUTE_DATA');

      assert.throws(() => {
        calculateAuthoritativeFare({
          bookingCategory: 'driver',
          isDistancePricing: true,
          distanceKm: NaN
        });
      }, (err) => err.code === 'INVALID_ROUTE_DATA');

      assert.throws(() => {
        calculateAuthoritativeFare({
          bookingCategory: 'driver',
          isDistancePricing: true,
          distanceKm: Infinity
        });
      }, (err) => err.code === 'INVALID_ROUTE_DATA');
    });
  });

  // =========================================================================
  // 2. Fare Estimate API Endpoint (POST /api/bookings/fare-estimate)
  // =========================================================================
  describe('2. Fare Estimate API Endpoint (POST /api/bookings/fare-estimate)', () => {
    test('2.1 Successfully estimates fare with nested pickup and destination coordinates', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/fare-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingType: 'driver',
          pickup: {
            latitude: 9.9195,
            longitude: 78.1193
          },
          destination: {
            latitude: 9.9175,
            longitude: 78.1194
          }
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.distanceKm, 4.82);
      assert.strictEqual(body.data.durationMinutes, 15);
      assert.strictEqual(body.data.baseFare, 100);
      assert.strictEqual(body.data.pricePerKm, 15);
      assert.strictEqual(body.data.distanceFare, 72.30);
      assert.strictEqual(body.data.calculatedFare, 172.30);
      assert.strictEqual(body.data.currency, 'INR');
      assert.ok(body.data.fareBreakdown, 'Response must include fareBreakdown object');
      assert.strictEqual(body.data.fareBreakdown.estimatedTotal, 172.30);
    });

    test('2.2 Successfully estimates fare with flat coordinate parameters', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/fare-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingCategory: 'driver',
          pickupLat: 9.9195,
          pickupLng: 78.1193,
          destLat: 9.9175,
          destLng: 78.1194
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.distanceKm, 4.82);
      assert.strictEqual(body.data.calculatedFare, 172.30);
    });

    test('2.3 Rejects invalid coordinates with HTTP 400 INVALID_COORDINATES', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/fare-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingType: 'driver',
          pickup: { latitude: 'invalid', longitude: 78.1193 },
          destination: { latitude: 9.9175, longitude: 78.1194 }
        })
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'INVALID_COORDINATES');
    });

    test('2.4 Rejects out of range coordinates with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/fare-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingType: 'driver',
          pickup: { latitude: 195, longitude: 78.1193 },
          destination: { latitude: 9.9175, longitude: 78.1194 }
        })
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'INVALID_COORDINATES');
    });

    test('2.5 Handles routing failure gracefully with clear error message', async () => {
      // Uncached far-away location that cannot route (e.g. middle of Indian Ocean)
      const res = await fetch(`${baseUrl}/api/bookings/fare-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingType: 'driver',
          pickup: { latitude: 0.1, longitude: 80.0 },
          destination: { latitude: 0.2, longitude: 80.0 }
        })
      });

      // Provider should fail or return routing error
      if (!res.ok) {
        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.ok(body.error, 'Must return error on routing failure');
      }
    });
  });

  // =========================================================================
  // 3. Admin Dynamic Tariff Updates & Historical Price Protection
  // =========================================================================
  describe('3. Admin Tariff Updates & Historical Price Protection', () => {
    test('3.1 Admin price change via PUT /api/admin/pricing immediately takes effect on new estimates', async () => {
      // 1. Admin updates Price Per KM from 15 to 18
      const updateRes = await fetch(`${baseUrl}/api/admin/pricing`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          items: [
            { id: 'driver_price_per_km', price: 18 }
          ]
        })
      });
      assert.strictEqual(updateRes.status, 200);

      // 2. Fetch new fare estimate: should automatically use ₹18/km
      const estRes = await fetch(`${baseUrl}/api/bookings/fare-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingType: 'driver',
          pickup: { latitude: 9.9195, longitude: 78.1193 },
          destination: { latitude: 9.9175, longitude: 78.1194 }
        })
      });
      const estBody = await estRes.json();
      assert.strictEqual(estBody.success, true);
      assert.strictEqual(estBody.data.pricePerKm, 18, 'Must use updated ₹18/km rate');
      assert.strictEqual(estBody.data.distanceFare, 86.76);
      assert.strictEqual(estBody.data.calculatedFare, 186.76);

      // 3. Reset back to ₹15 for remaining test suite
      await updateServicePricing([{ id: 'driver_price_per_km', price: 15 }]);
    });

    test('3.2 Historical booking fare snapshot remains unchanged when admin subsequently alters prices', async () => {
      // 1. Create Booking A with rate ₹15/km
      await updateServicePricing([{ id: 'driver_price_per_km', price: 15 }]);

      const bookingARes = await createBooking({
        customerName: 'Historical Test User A',
        customerPhone: '9876543210',
        bookingCategory: 'driver',
        driverTripOption: 'distance',
        useDistancePricing: true,
        pickupLat: 9.9195,
        pickupLng: 78.1193,
        destLat: 9.9175,
        destLng: 78.1194,
        date: '2026-10-20',
        time: '10:00 AM'
      });

      const bookingA = bookingARes.booking;
      assert.ok(bookingA);
      assert.strictEqual(Number(bookingA.price_per_km), 15);
      assert.strictEqual(Number(bookingA.calculated_fare), 172.30);

      // 2. Admin alters tariff from ₹15 to ₹25
      await updateServicePricing([{ id: 'driver_price_per_km', price: 25 }]);

      // 3. Create Booking B with new rate ₹25/km
      const bookingBRes = await createBooking({
        customerName: 'Historical Test User B',
        customerPhone: '9876543211',
        bookingCategory: 'driver',
        driverTripOption: 'distance',
        useDistancePricing: true,
        pickupLat: 9.9195,
        pickupLng: 78.1193,
        destLat: 9.9175,
        destLng: 78.1194,
        date: '2026-10-20',
        time: '11:00 AM'
      });
      const bookingB = bookingBRes.booking;
      assert.strictEqual(Number(bookingB.price_per_km), 25);
      // 4.82 * 25 = 120.50 + 100 = 220.50
      assert.strictEqual(Number(bookingB.calculated_fare), 220.50);

      // 4. Query Booking A from database: MUST NOT CHANGE!
      const freshBookingA = await queryOne('SELECT * FROM bookings WHERE id = ?', [bookingA.id]);
      assert.strictEqual(Number(freshBookingA.price_per_km), 15, 'Booking A price_per_km must still be ₹15');
      assert.strictEqual(Number(freshBookingA.calculated_fare), 172.30, 'Booking A calculated_fare must still be ₹172.30');

      // Reset back to 15
      await updateServicePricing([{ id: 'driver_price_per_km', price: 15 }]);
    });
  });

  // =========================================================================
  // 4. Security: Tampering Prevention & Authoritative Enforcement
  // =========================================================================
  describe('4. Security: Tampering Prevention & Authoritative Enforcement', () => {
    test('4.1 Malicious client cannot inject price_per_km = 0, base_fare = 0 or calculated_fare = 1', async () => {
      const maliciousPayload = {
        customerName: 'Tamper Tester',
        customerPhone: '9876543210',
        bookingCategory: 'driver',
        driverTripOption: 'distance',
        useDistancePricing: true,
        pickupLat: 9.9195,
        pickupLng: 78.1193,
        destLat: 9.9175,
        destLng: 78.1194,
        date: '2026-10-20',
        time: '02:00 PM',
        // Injected malicious prices:
        base_fare: 0,
        baseFare: 0,
        price_per_km: 0,
        pricePerKm: 0,
        distance_fare: 0,
        distanceFare: 0,
        calculated_fare: 1,
        calculatedFare: 1,
        totalFare: 1
      };

      const result = await createBooking(maliciousPayload);
      assert.ok(result.booking);
      // Server must calculate 172.30, ignoring 1
      assert.strictEqual(Number(result.booking.calculated_fare), 172.30, 'Server authoritative fare must win over client injection');
      assert.strictEqual(Number(result.booking.base_fare), 100, 'Server base fare must win');
      assert.strictEqual(Number(result.booking.price_per_km), 15, 'Server price_per_km must win');
      assert.strictEqual(Number(result.booking.distance_fare), 72.30, 'Server distance_fare must win');
    });
  });

  // =========================================================================
  // 5. Final Booking Creation Stores Complete Fare Snapshot
  // =========================================================================
  describe('5. Booking Creation Fare Snapshot Persistence', () => {
    test('5.1 Created booking stores all snapshot columns in bookings table', async () => {
      const res = await createBooking({
        customerName: 'Snapshot Verification User',
        customerPhone: '9876543210',
        bookingCategory: 'driver',
        driverTripOption: 'distance',
        useDistancePricing: true,
        pickupLat: 9.9195,
        pickupLng: 78.1193,
        destLat: 9.9175,
        destLng: 78.1194,
        date: '2026-10-20',
        time: '04:00 PM'
      });

      const b = await queryOne('SELECT * FROM bookings WHERE id = ?', [res.booking.id]);
      assert.ok(b, 'Booking row must exist');

      // Verify all snapshot fields
      assert.strictEqual(Number(b.distance_km), 4.82, 'distance_km must be 4.82');
      assert.strictEqual(Number(b.base_fare), 100, 'base_fare must be 100');
      assert.strictEqual(Number(b.price_per_km), 15, 'price_per_km must be 15');
      assert.strictEqual(Number(b.distance_fare), 72.30, 'distance_fare must be 72.30');
      assert.strictEqual(Number(b.waiting_minutes), 0, 'waiting_minutes must be 0');
      assert.strictEqual(Number(b.waiting_fare), 0, 'waiting_fare must be 0');
      assert.strictEqual(Number(b.night_surcharge), 0, 'night_surcharge must be 0');
      assert.strictEqual(Number(b.discount_amount), 0, 'discount_amount must be 0');
      assert.strictEqual(Number(b.calculated_fare), 172.30, 'calculated_fare must be 172.30');
      assert.strictEqual(b.currency, 'INR', 'currency must be INR');
      assert.strictEqual(Number(b.pricing_version), 1, 'pricing_version must be 1');
    });
  });
});
