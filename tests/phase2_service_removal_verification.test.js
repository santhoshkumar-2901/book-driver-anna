import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from './testHelper.js';
import { calculateAuthoritativeFare, getAllPricing, updateServicePricing } from '../server/services/pricingService.js';
import { createBooking, getUserBookings } from '../server/services/bookingService.js';
import { execute, queryOne, queryAll } from '../server/db/database.js';

describe('Phase 2 — Final Acceptance Verification: Decommission All Time-Based Driver Services', () => {
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
  // 1. Database & Pricing Service Verification
  // =========================================================================
  describe('1. Pricing Service & Database Verification', () => {
    test('1.1 Obsolete driver tariffs are excluded from getAllPricing()', async () => {
      const { map, list } = await getAllPricing();
      const obsoleteKeys = [
        'driver_hourly_2hr', 'driver_hourly_4hr', 'driver_hourly_6hr',
        'driver_hourly_8hr', 'driver_hourly_12hr', 'driver_outstation_12hr',
        'driver_outstation_24hr', 'driver_outstation_46hr', 'driver_outstation_72hr',
        'driver_airport_drop', 'driver_night_party'
      ];
      for (const key of obsoleteKeys) {
        assert.strictEqual(map[key], undefined, `Obsolete tariff '${key}' must not exist in pricing map`);
        assert.ok(!list.some(item => item.id === key), `Obsolete tariff '${key}' must not exist in pricing list`);
      }
    });

    test('1.2 Active driver tariffs are valid distance-based and corporate services', async () => {
      const { map } = await getAllPricing();
      assert.ok(map.driver_one_way_city, 'Must include driver_one_way_city');
      assert.ok(map.driver_outstation_150km, 'Must include driver_outstation_150km');
      assert.ok(map.driver_outstation_300km, 'Must include driver_outstation_300km');
      assert.ok(map.driver_outstation_500km, 'Must include driver_outstation_500km');
      assert.ok(map.driver_monthly, 'Must include driver_monthly');
      assert.ok(map.driver_base_fare, 'Must include driver_base_fare');
      assert.ok(map.driver_price_per_km, 'Must include driver_price_per_km');
      assert.ok(map.driver_min_fare, 'Must include driver_min_fare');
    });

    test('1.3 updateServicePricing rejects obsolete driver IDs with 400 OBSOLETE_SERVICE', async () => {
      const obsoleteKeys = [
        'driver_hourly_2hr', 'driver_outstation_12hr', 'driver_night_party', 'driver_airport_drop'
      ];
      for (const key of obsoleteKeys) {
        await assert.rejects(async () => {
          await updateServicePricing([{ id: key, price: 500 }]);
        }, (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'OBSOLETE_SERVICE');
          return true;
        }, `Updating '${key}' must reject with 400 OBSOLETE_SERVICE`);
      }
    });
  });

  // =========================================================================
  // 2. Authoritative Fare Calculation Verification
  // =========================================================================
  describe('2. Authoritative Fare Calculation Engine', () => {
    test('2.1 Rejects round-trip hourly driver requests with 400 OBSOLETE_SERVICE', () => {
      assert.throws(() => {
        calculateAuthoritativeFare({
          bookingCategory: 'driver',
          driverTripOption: 'round-trip',
          roundTripDuration: '4hr'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'OBSOLETE_SERVICE');
        return true;
      });
    });

    test('2.2 Rejects time-based outstation packages (12hr, 24hr, 46hr, 72hr) with 400 OBSOLETE_SERVICE', () => {
      const timePackages = ['Round trip 12hr', 'Round trip 24hr', 'Round trip 46hr', 'Round trip 72hr'];
      for (const pkg of timePackages) {
        assert.throws(() => {
          calculateAuthoritativeFare({
            bookingCategory: 'driver',
            driverTripOption: 'outstation',
            outstationPackage: pkg
          });
        }, (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'OBSOLETE_SERVICE');
          return true;
        }, `Package '${pkg}' must be rejected with 400 OBSOLETE_SERVICE`);
      }
    });

    test('2.3 Normal City Driver calculates distance-based fare correctly', () => {
      const fare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        distanceKm: 15.0
      });
      assert.strictEqual(fare.basePrice, 299);
      assert.strictEqual(fare.totalFare, 299 + Math.round(299 * 0.05));
    });

    test('2.4 Distance-based outstation tiers calculate correctly without duration products', () => {
      // 120 km -> 150 km tier
      const f150 = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'outstation',
        outstationPackage: 'One Way (Up to 150 km)',
        distanceKm: 120
      });
      assert.strictEqual(f150.basePrice, 1199);

      // 250 km -> 300 km tier
      const f300 = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'outstation',
        outstationPackage: 'One Way (Up to 300 km)',
        distanceKm: 250
      });
      assert.strictEqual(f300.basePrice, 1799);

      // 400 km -> 500 km tier
      const f500 = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'outstation',
        outstationPackage: 'One Way (Up to 500 km)',
        distanceKm: 400
      });
      assert.strictEqual(f500.basePrice, 2399);
    });

    test('2.5 Airport is a normal destination and does NOT trigger fixed 899 tariff', () => {
      const fare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Kempegowda International Airport (BLR T1/T2)',
        distanceKm: 38.0
      });
      // Normal city driver fare (299 base), NOT 899
      assert.strictEqual(fare.basePrice, 299);
      assert.notStrictEqual(fare.basePrice, 899, 'Airport destination must never trigger special tariff');
    });
  });

  // =========================================================================
  // 3. New Booking Creation Rejection & Acceptance
  // =========================================================================
  describe('3. Booking Creation API Validation', () => {
    test('3.1 Rejects creation of obsolete round-trip hourly booking', async () => {
      await assert.rejects(async () => {
        await createBooking({
          customerName: 'Hourly Booker',
          customerPhone: '9845112233',
          bookingCategory: 'driver',
          driverTripOption: 'round-trip',
          roundTripDuration: '2hr',
          date: '2026-11-01',
          time: '10:00'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'OBSOLETE_SERVICE');
        return true;
      });
    });

    test('3.2 Rejects creation of obsolete outstation time package booking', async () => {
      await assert.rejects(async () => {
        await createBooking({
          customerName: 'Time Package Booker',
          customerPhone: '9845112234',
          bookingCategory: 'driver',
          driverTripOption: 'outstation',
          outstationPackage: 'Round trip 24hr',
          date: '2026-11-01',
          time: '10:00'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'OBSOLETE_SERVICE');
        return true;
      });
    });

    test('3.3 Creates valid City Driver booking', async () => {
      const result = await createBooking({
        customerName: 'City Rider',
        customerPhone: '9845112235',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        date: '2026-11-01',
        time: '10:00'
      });
      assert.ok(result && result.booking && result.booking.id);
      assert.strictEqual(result.booking.trip_type, 'one-way');
    });

    test('3.4 Creates valid Outstation Driver booking (distance-based tier)', async () => {
      const result = await createBooking({
        customerName: 'Outstation Rider',
        customerPhone: '9845112236',
        bookingCategory: 'driver',
        driverTripOption: 'outstation',
        outstationPackage: 'One Way (Up to 150 km)',
        pickupArea: 'Indiranagar',
        dropLocation: 'Mysuru Palace',
        date: '2026-11-01',
        time: '08:00'
      });
      assert.ok(result && result.booking && result.booking.id);
      assert.strictEqual(result.booking.trip_type, 'outstation');
    });

    test('3.5 Normal Airport destination booking creates successfully under City Driver', async () => {
      const result = await createBooking({
        customerName: 'Airport Flyer',
        customerPhone: '9845112237',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Kempegowda International Airport (BLR T1)',
        date: '2026-11-01',
        time: '05:00'
      });
      assert.ok(result && result.booking && result.booking.id);
      assert.strictEqual(result.booking.trip_type, 'one-way');
      assert.strictEqual(result.booking.drop_location, 'Kempegowda International Airport (BLR T1)');
    });
  });

  // =========================================================================
  // 4. Historical Bookings Readability
  // =========================================================================
  describe('4. Historical Records Integrity', () => {
    test('4.1 Pre-existing historical bookings with old service names remain readable in database', async () => {
      const testPhone = '9999900001';
      // Insert a historical booking mimicking past records
      const histBookingId = `BKG-HIST-${Date.now()}`;
      await execute(`
        INSERT INTO bookings (
          id, customer_name, customer_phone, service_name, booking_type, trip_type,
          pickup_area, drop_location, date, time, calculated_fare, status
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, '2025-01-01', '10:00', 899, 'COMPLETED'
        )
      `, [
        histBookingId, 'Old Customer', testPhone,
        'Airport Drop (BLR T1/T2)', 'driver', 'one-way',
        'Indiranagar', 'Kempegowda Airport'
      ]);

      const stored = await queryOne('SELECT * FROM bookings WHERE id = ?', [histBookingId]);
      assert.ok(stored, 'Historical booking must be retrievable');
      assert.strictEqual(stored.service_name, 'Airport Drop (BLR T1/T2)');
      assert.strictEqual(Number(stored.calculated_fare), 899);

      // Verify getUserBookings retrieves it without crashing
      const userBookings = await getUserBookings(null, testPhone);
      assert.ok(userBookings.some(b => b.id === histBookingId), 'Historical booking must appear in user booking list');
    });
  });

  // =========================================================================
  // 5. Preserved Features Verification
  // =========================================================================
  describe('5. Preserved Categories Verification (Vehicle Rental & Driving Academy)', () => {
    test('5.1 Vehicle fleet rentals remain fully operational', async () => {
      const vehFare = calculateAuthoritativeFare({
        bookingCategory: 'vehicle',
        vehicleCategory: 'Sedan'
      });
      assert.strictEqual(vehFare.basePrice, 1999);

      const result = await createBooking({
        customerName: 'Rental Customer',
        customerPhone: '9845112238',
        bookingCategory: 'vehicle',
        vehicleCategory: 'Sedan',
        pickupArea: 'Indiranagar',
        dropLocation: 'Mysore',
        date: '2026-11-01',
        time: '09:00'
      });
      assert.ok(result.booking && result.booking.id);
      assert.strictEqual(result.booking.booking_type, 'vehicle');
      assert.ok(result.booking.service_name.includes('Vehicle Rental'));
    });

    test('5.2 Driving Academy courses remain fully operational', async () => {
      const classFare = calculateAuthoritativeFare({
        bookingCategory: 'class',
        selectedClassId: 'class-beginner'
      });
      assert.strictEqual(classFare.basePrice, 5999);
      assert.strictEqual(classFare.gst, 0);

      const result = await createBooking({
        customerName: 'Driving Student',
        customerPhone: '9845112239',
        bookingCategory: 'class',
        selectedClassId: 'class-beginner',
        pickupArea: 'Indiranagar',
        date: '2026-11-01',
        time: '07:00'
      });
      assert.ok(result.booking && result.booking.id);
      assert.strictEqual(result.booking.booking_type, 'class');
      assert.ok(result.booking.service_name.includes('Driving Class'));
    });
  });
});
