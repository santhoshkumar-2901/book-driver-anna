import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import bookingsRouter from '../server/routes/bookings.js';
import locationRouter from '../server/routes/location.js';
import { createBooking } from '../server/services/bookingService.js';
import {
  calculateAuthoritativeFare,
  resolvePricingItem,
  resolveDistancePricingConfig,
  getPricingVersion
} from '../server/services/pricingService.js';
import { queryOne, execute } from '../server/db/database.js';

describe('Phase 3: Production Pricing Engine Hardening Suite', () => {
  let app;
  let server;
  let baseUrl;

  // Real test coordinates
  const BANGALORE_INDIRANAGAR = { lat: 12.9784, lng: 77.6408 };
  const BANGALORE_KORAMANGALA = { lat: 12.9352, lng: 77.6245 };
  const MYSORE_PALACE = { lat: 12.3051, lng: 76.6551 }; // ~140-150 km from Bangalore
  const OOTY_BOTANICAL = { lat: 11.4168, lng: 76.7119 }; // ~270-290 km from Bangalore
  const CHENNAI_CENTRAL = { lat: 13.0827, lng: 80.2707 }; // ~340-360 km from Bangalore
  const HYDERABAD_CHARMINAR = { lat: 17.3616, lng: 78.4747 }; // ~570 km (> 500 km)

  before(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/bookings', bookingsRouter);
    app.use('/api/location', locationRouter);
    app.use((err, req, res, next) => {
      const status = err.status || err.statusCode || 500;
      res.status(status).json({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message
        }
      });
    });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // =========================================================================
  // OBJECTIVE 1: PRICING ITEM RESOLUTION HARDENING
  // =========================================================================
  describe('Objective 1 — Audit and Harden Pricing Item Resolution', () => {
    const mockPricingList = [
      { id: 'driver_base_fare', category: 'driver', name: 'Driver Base Fare', price: 100 },
      { id: 'driver_price_per_km', category: 'driver', name: 'Price Per Km', price: 15 },
      { id: 'driver_min_fare', category: 'driver', name: 'Minimum Fare', price: 150 },
      { id: 'vehicle_sedan_daily', category: 'vehicle', name: 'Sedan Daily Rate', price: 1999 },
      { id: 'vehicle_sedan_km', category: 'vehicle', name: 'Sedan Rate Per Km', price: 18 },
      { id: 'class_beginner', category: 'class', name: 'Beginner Course', price: 5999 }
    ];
    const mockPricingMap = Object.fromEntries(mockPricingList.map(item => [item.id, item]));

    test('1.1 Prefers exact ID match over name matching', () => {
      const resolved = resolvePricingItem(mockPricingMap, 'driver', ['anything else'], ['driver_base_fare']);
      assert.strictEqual(resolved.id, 'driver_base_fare');
      assert.strictEqual(resolved.price, 100);
    });

    test('1.2 Matches exact normalized name within category', () => {
      const resolved = resolvePricingItem(mockPricingMap, 'driver', ['price per km']);
      assert.strictEqual(resolved.id, 'driver_price_per_km');
      assert.strictEqual(resolved.price, 15);
    });

    test('1.3 Category scoping prevents cross-category name collision', () => {
      // Both driver and vehicle have per-km rates
      const driverKm = resolvePricingItem(mockPricingMap, 'driver', ['price per km', 'rate per km'], ['driver_price_per_km']);
      const vehicleKm = resolvePricingItem(mockPricingMap, 'vehicle', ['sedan rate per km'], ['vehicle_sedan_km']);
      assert.strictEqual(driverKm.id, 'driver_price_per_km');
      assert.strictEqual(vehicleKm.id, 'vehicle_sedan_km');
      assert.notStrictEqual(driverKm.price, vehicleKm.price);
    });

    test('1.4 Generic tokens (fare, rate, km, price, minimum) strictly forbidden from fuzzy substring match', () => {
      // Searching for bare generic word 'km' must not randomly match driver_price_per_km or vehicle_sedan_km
      const resolved = resolvePricingItem(mockPricingMap, 'driver', ['km']);
      assert.strictEqual(resolved, null, 'Generic token "km" must return null instead of matching arbitrary rows');

      const resolvedFare = resolvePricingItem(mockPricingMap, 'driver', ['fare']);
      assert.strictEqual(resolvedFare, null, 'Generic token "fare" must return null instead of matching arbitrary rows');
    });

    test('1.5 Duplicate pricing records with conflicting prices fail safely with AMBIGUOUS_PRICING_ITEM', () => {
      const conflictingList = [
        { id: 'conflicting_1', category: 'driver', name: 'Test Duplicate Item', price: 200 },
        { id: 'conflicting_2', category: 'driver', name: 'Test Duplicate Item', price: 250 }
      ];
      assert.throws(() => {
        resolvePricingItem(conflictingList, 'driver', ['test duplicate item']);
      }, (err) => {
        assert.strictEqual(err.code, 'AMBIGUOUS_PRICING_ITEM');
        assert.strictEqual(err.statusCode, 500);
        return true;
      });
    });

    test('1.6 Duplicate pricing records with identical prices return safely without throwing', () => {
      const identicalList = [
        { id: 'identical_1', category: 'driver', name: 'Identical Tariff', price: 300 },
        { id: 'identical_2', category: 'driver', name: 'Identical Tariff', price: 300 }
      ];
      const resolved = resolvePricingItem(identicalList, 'driver', ['identical tariff']);
      assert.strictEqual(resolved.price, 300);
    });

    test('1.7 Missing pricing item returns null safely when no candidates match', () => {
      const resolved = resolvePricingItem(mockPricingMap, 'driver', ['non_existent_item_xyz']);
      assert.strictEqual(resolved, null);
    });
  });

  // =========================================================================
  // OBJECTIVE 2: PRICING VERSION DERIVATION
  // =========================================================================
  describe('Objective 2 — Remove Hardcoded Pricing Version', () => {
    test('2.1 Default tariffs produce pricing_version = 1 for backwards compatibility', () => {
      const version = getPricingVersion(null);
      assert.strictEqual(version, 1);
    });

    test('2.2 Altered pricing configuration produces deterministic integer version > 1', () => {
      const customPricingMap = {
        driver_base_fare: { id: 'driver_base_fare', price: 120 },
        driver_price_per_km: { id: 'driver_price_per_km', price: 18 }
      };
      const version1 = getPricingVersion(customPricingMap);
      assert.strictEqual(typeof version1, 'number');
      assert.ok(version1 > 1, 'Custom configuration must produce version > 1');

      // Calling again with same custom pricing map produces identical version (deterministic)
      const version2 = getPricingVersion(customPricingMap);
      assert.strictEqual(version1, version2);

      // Changing prices produces different version
      const customPricingMap2 = {
        driver_base_fare: { id: 'driver_base_fare', price: 150 },
        driver_price_per_km: { id: 'driver_price_per_km', price: 20 }
      };
      const version3 = getPricingVersion(customPricingMap2);
      assert.notStrictEqual(version1, version3);
    });
  });

  // =========================================================================
  // OBJECTIVE 3: DISTANCE-BASED DRIVER PRICING
  // =========================================================================
  describe('Objective 3 — Distance-Based Driver Pricing Engine', () => {
    test('3.1 Resolves base fare, price per km, and minimum fare from service_pricing', () => {
      const config = resolveDistancePricingConfig(null);
      assert.strictEqual(config.baseFare, 100);
      assert.strictEqual(config.pricePerKm, 15);
      assert.strictEqual(config.minimumFare, 150);
      assert.strictEqual(config.currency, 'INR');
    });

    test('3.2 Short route below minimum fare applies minimum fare', () => {
      // 2 km: base (100) + distance (2 * 15 = 30) = 130 < minimum (150) -> final fare = 150
      const fare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'distance',
        distanceKm: 2.0,
        isDistancePricing: true
      });
      assert.strictEqual(fare.distanceFare, 30);
      assert.strictEqual(fare.subtotal, 130);
      assert.strictEqual(fare.minimumFareApplied, true);
      assert.strictEqual(fare.calculatedFare, 150);
      assert.strictEqual(fare.totalFare, 150);
    });

    test('3.3 Normal route above minimum fare applies base + distance fare', () => {
      // 10 km: base (100) + distance (10 * 15 = 150) = 250 > minimum (150) -> final fare = 250
      const fare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'distance',
        distanceKm: 10.0,
        isDistancePricing: true
      });
      assert.strictEqual(fare.distanceFare, 150);
      assert.strictEqual(fare.minimumFareApplied, false);
      assert.strictEqual(fare.calculatedFare, 250);
      assert.strictEqual(fare.totalFare, 250);
    });

    test('3.4 Handles fractional/decimal distances precisely', () => {
      // 7.45 km: base (100) + distance (7.45 * 15 = 111.75) = 211.75
      const fare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'distance',
        distanceKm: 7.45,
        isDistancePricing: true
      });
      assert.strictEqual(fare.distanceFare, 111.75);
      assert.strictEqual(fare.calculatedFare, 211.75);
    });

    test('3.5 Missing required pricing configuration throws MISSING_PRICING_CONFIG', () => {
      const incompletePricing = {
        driver_price_per_km: { id: 'driver_price_per_km', price: 15 }
        // missing driver_base_fare and driver_min_fare
      };
      assert.throws(() => {
        resolveDistancePricingConfig(incompletePricing);
      }, (err) => {
        assert.strictEqual(err.code, 'MISSING_PRICING_CONFIG');
        assert.strictEqual(err.statusCode, 500);
        return true;
      });
    });

    test('3.6 Rejects invalid/negative distance with 400 INVALID_ROUTE_DATA', () => {
      assert.throws(() => {
        calculateAuthoritativeFare({
          bookingCategory: 'driver',
          driverTripOption: 'distance',
          distanceKm: -5,
          isDistancePricing: true
        });
      }, (err) => {
        assert.strictEqual(err.code, 'INVALID_ROUTE_DATA');
        assert.strictEqual(err.statusCode, 400);
        return true;
      });
    });
  });

  // =========================================================================
  // OBJECTIVE 4: OUTSTATION DISTANCE TIER CONSISTENCY
  // =========================================================================
  describe('Objective 4 — Outstation Distance Tier Consistency', () => {
    test('4.1 ≤ 150 km resolves to 150 km package (₹1,199 + GST)', () => {
      const fare80 = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'outstation',
        outstationTripType: 'one-way',
        distanceKm: 80
      });
      assert.strictEqual(fare80.basePrice, 1199);
      assert.strictEqual(fare80.totalFare, 1199 + Math.round(1199 * 0.05));

      const fare150 = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'outstation',
        outstationTripType: 'one-way',
        distanceKm: 150
      });
      assert.strictEqual(fare150.basePrice, 1199);
    });

    test('4.2 > 150 km and ≤ 300 km resolves to 300 km package (₹1,799 + GST)', () => {
      const fare180 = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'outstation',
        outstationTripType: 'one-way',
        distanceKm: 180.2
      });
      assert.strictEqual(fare180.basePrice, 1799);
      assert.strictEqual(fare180.totalFare, 1799 + Math.round(1799 * 0.05));

      const fare300 = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'outstation',
        outstationTripType: 'one-way',
        distanceKm: 300
      });
      assert.strictEqual(fare300.basePrice, 1799);
    });

    test('4.3 > 300 km and ≤ 500 km resolves to 500 km package (₹2,399 + GST)', () => {
      const fare350 = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'outstation',
        outstationTripType: 'one-way',
        distanceKm: 350
      });
      assert.strictEqual(fare350.basePrice, 2399);
      assert.strictEqual(fare350.totalFare, 2399 + Math.round(2399 * 0.05));

      const fare500 = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'outstation',
        outstationTripType: 'one-way',
        distanceKm: 500
      });
      assert.strictEqual(fare500.basePrice, 2399);
    });

    test('4.4 > 500 km safely rejects with UNSUPPORTED_OUTSTATION_DISTANCE (400)', () => {
      assert.throws(() => {
        calculateAuthoritativeFare({
          bookingCategory: 'driver',
          driverTripOption: 'outstation',
          outstationTripType: 'one-way',
          distanceKm: 570
        });
      }, (err) => {
        assert.strictEqual(err.code, 'UNSUPPORTED_OUTSTATION_DISTANCE');
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /currently support routes up to 500 km/);
        return true;
      });
    });

    test('4.5 API route /api/bookings/estimate returns 400 when outstation route exceeds 500 km', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingCategory: 'driver',
          driverTripOption: 'outstation',
          outstationTripType: 'one-way',
          pickup: { latitude: BANGALORE_INDIRANAGAR.lat, longitude: BANGALORE_INDIRANAGAR.lng },
          destination: { latitude: HYDERABAD_CHARMINAR.lat, longitude: HYDERABAD_CHARMINAR.lng } // ~570 km
        })
      });

      assert.strictEqual(res.status, 400, 'Must return 400 for > 500km route');
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'UNSUPPORTED_OUTSTATION_DISTANCE');
    });
  });

  // =========================================================================
  // OBJECTIVE 5: OUTSTATION PACKAGE BUTTON UX STATIC VERIFICATION
  // =========================================================================
  describe('Objective 5 — Outstation Package Button UX', () => {
    const modalPath = path.resolve('src/components/BookingModal.jsx');
    const modalContent = fs.readFileSync(modalPath, 'utf8');

    test('5.1 BookingModal displays road route summary and recommended package', () => {
      assert.match(modalContent, /Road Route:/, 'Must display Road Route metrics');
      assert.match(modalContent, /Recommended:/, 'Must display Recommended package tag');
      assert.match(modalContent, /● Recommended/, 'Must display Recommended badge on button');
    });

    test('5.2 BookingModal disables packages that do not cover the route distance', () => {
      assert.match(modalContent, /isUnavailable\s*\?/, 'Must handle unavailable packages');
      assert.match(modalContent, /Unavailable for this route/, 'Must render "Unavailable for this route" label');
      assert.match(modalContent, /disabled=\{isUnavailable\}/, 'Must set disabled attribute on insufficient packages');
    });

    test('5.3 BookingModal shows warning and disables submission when route exceeds 500 km', () => {
      assert.match(modalContent, /Route exceeds 500 km limit/, 'Must show route limit banner');
      assert.match(modalContent, /Route Exceeds 500 km Limit — Contact Support/, 'Must show disabled button label');
      assert.match(modalContent, /Outstation one-way pricing currently supports routes up to 500 km/, 'Must show clear explanation');
    });
  });

  // =========================================================================
  // OBJECTIVE 6: ROUND TRIP PACKAGE PRICING INTACT
  // =========================================================================
  describe('Objective 6 — Round Trip Package Pricing', () => {
    test('6.1 Round Trip maintains hourly package pricing even when road coordinates are provided', () => {
      const fare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'round-trip',
        roundTripDuration: '4hr',
        distanceKm: 25.5,
        durationMinutes: 45
      });
      // 4hr package = 349 + GST (5% = 17) = 366
      assert.strictEqual(fare.basePrice, 349);
      assert.strictEqual(fare.totalFare, 366);
      assert.strictEqual(fare.distanceKm, 25.5);
      assert.strictEqual(fare.durationMinutes, 45);
      assert.strictEqual(fare.pricePerKm, 0, 'Must not apply per-km tariff to Round Trip');
    });

    test('6.2 Round Trip booking persists distance but bills authoritative hourly package', async () => {
      const { booking } = await createBooking({
        customerName: 'Roundtrip Tester',
        customerPhone: '9845700001',
        bookingCategory: 'driver',
        driverTripOption: 'round-trip',
        roundTripDuration: '6hr', // 499 + GST = 524
        pickupArea: 'Indiranagar',
        dropLocation: 'Electronic City',
        pickupLat: BANGALORE_INDIRANAGAR.lat,
        pickupLng: BANGALORE_INDIRANAGAR.lng,
        destLat: BANGALORE_KORAMANGALA.lat,
        destLng: BANGALORE_KORAMANGALA.lng,
        date: '2026-11-20',
        time: '10:00'
      });

      const row = await queryOne('SELECT * FROM bookings WHERE id = ?', [booking.id]);
      assert.strictEqual(row.trip_type, 'round-trip');
      assert.strictEqual(Number(row.calculated_fare), 524); // 499 + 25 = 524
      assert.strictEqual(Number(row.base_fare), 499);
      assert.ok(row.distance_km > 0, 'Must persist calculated road distance');
    });
  });

  // =========================================================================
  // OBJECTIVE 7: NO CLIENT-SIDE FARE AUTHORITY (TAMPERING PROTECTION)
  // =========================================================================
  describe('Objective 7 — No Client-Side Fare Authority (Tampering Protection)', () => {
    test('7.1 Backend rejects/ignores client-provided calculatedFare, baseFare, pricePerKm, pricingVersion', async () => {
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Tamper Tester',
          customerPhone: '9845700002',
          bookingCategory: 'driver',
          driverTripOption: 'distance',
          pickupArea: 'Indiranagar',
          dropLocation: 'Koramangala',
          pickupLat: BANGALORE_INDIRANAGAR.lat,
          pickupLng: BANGALORE_INDIRANAGAR.lng,
          destLat: BANGALORE_KORAMANGALA.lat,
          destLng: BANGALORE_KORAMANGALA.lng,
          date: '2026-11-20',
          time: '11:00',
          // Malicious client tampering payloads
          calculatedFare: 1,
          fare: 1,
          totalFare: 1,
          baseFare: 1,
          pricePerKm: 1,
          pricingVersion: 999
        })
      });

      assert.strictEqual(res.status, 201, 'Booking should create successfully');
      const data = await res.json();
      const booking = data.data.booking;

      // Final fare must NOT be 1; it must be authoritatively calculated by backend
      assert.notStrictEqual(Number(booking.calculated_fare), 1);
      assert.ok(Number(booking.calculated_fare) >= 150, 'Must apply authoritative minimum fare (₹150) or higher');
      assert.notStrictEqual(Number(booking.pricing_version), 999);
    });

    test('7.2 Malicious client sends 150 km package for 350 km route: backend enforces authoritative 500 km tier', () => {
      // Malicious payload claiming 'One Way (Up to 150 km)' while road distance is 350 km
      const fare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'outstation',
        outstationTripType: 'one-way',
        outstationPackage: 'One Way (Up to 150 km)', // Fake low package
        distanceKm: 350 // Real route distance
      });

      // Must resolve to 500 km package (₹2,399), NOT 150 km package (₹1,199)
      assert.strictEqual(fare.basePrice, 2399);
      assert.strictEqual(fare.totalFare, 2399 + Math.round(2399 * 0.05));
    });
  });

  // =========================================================================
  // OBJECTIVE 8: PRICING SNAPSHOT VERIFICATION
  // =========================================================================
  describe('Objective 8 — Pricing Snapshot Retention', () => {
    test('8.1 Booking retains all required pricing snapshot fields', async () => {
      const { booking } = await createBooking({
        customerName: 'Snapshot Tester',
        customerPhone: '9845700003',
        bookingCategory: 'driver',
        driverTripOption: 'distance',
        pickupArea: 'Indiranagar',
        dropLocation: 'Koramangala',
        pickupLat: BANGALORE_INDIRANAGAR.lat,
        pickupLng: BANGALORE_INDIRANAGAR.lng,
        destLat: BANGALORE_KORAMANGALA.lat,
        destLng: BANGALORE_KORAMANGALA.lng,
        date: '2026-11-20',
        time: '12:00'
      });

      const row = await queryOne('SELECT * FROM bookings WHERE id = ?', [booking.id]);
      assert.ok(row.base_fare !== null && row.base_fare !== undefined, 'Must retain base_fare');
      assert.ok(row.price_per_km !== null && row.price_per_km !== undefined, 'Must retain price_per_km');
      assert.ok(row.distance_fare !== null && row.distance_fare !== undefined, 'Must retain distance_fare');
      assert.ok(row.waiting_fare !== null && row.waiting_fare !== undefined, 'Must retain waiting_fare');
      assert.ok(row.night_surcharge !== null && row.night_surcharge !== undefined, 'Must retain night_surcharge');
      assert.ok(row.discount_amount !== null && row.discount_amount !== undefined, 'Must retain discount_amount');
      assert.strictEqual(row.currency, 'INR', 'Must retain currency INR');
      assert.ok(Number(row.pricing_version) >= 1, 'Must retain pricing_version');
    });
  });

  // =========================================================================
  // REGRESSION: VEHICLE & DRIVING ACADEMY INTEGRITY
  // =========================================================================
  describe('Regression — Vehicle & Driving Academy Pricing Integrity', () => {
    test('R.1 Vehicle rental pricing calculates authoritative tariff + GST', () => {
      const fareSedan = calculateAuthoritativeFare({
        bookingCategory: 'vehicle',
        vehicleCategory: 'Sedan'
      });
      assert.strictEqual(fareSedan.basePrice, 1999);
      assert.strictEqual(fareSedan.gst, Math.round(1999 * 0.05));
      assert.strictEqual(fareSedan.totalFare, 1999 + fareSedan.gst);

      const fareSuv = calculateAuthoritativeFare({
        bookingCategory: 'vehicle',
        vehicleCategory: 'SUV'
      });
      assert.strictEqual(fareSuv.basePrice, 3499);
    });

    test('R.2 Driving Academy course pricing is all-inclusive flat rate with 0 GST', () => {
      const fareBeginner = calculateAuthoritativeFare({
        bookingCategory: 'class',
        selectedClassId: 'class-beginner'
      });
      assert.strictEqual(fareBeginner.basePrice, 5999);
      assert.strictEqual(fareBeginner.gst, 0);
      assert.strictEqual(fareBeginner.totalFare, 5999);

      const fareRefresher = calculateAuthoritativeFare({
        bookingCategory: 'class',
        selectedClassId: 'class-refresher'
      });
      assert.strictEqual(fareRefresher.basePrice, 3499);
    });
  });
});
