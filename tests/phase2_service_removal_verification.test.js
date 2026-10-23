import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from './testHelper.js';
import { calculateAuthoritativeFare, getAllPricing, updateServicePricing } from '../server/services/pricingService.js';
import { createBooking, getUserBookings } from '../server/services/bookingService.js';
import { routingService } from '../server/services/routingService.js';
import { execute, queryOne, queryAll } from '../server/db/database.js';

describe('Model B — Pure Distance-Based Round Trip & Service Decommission Verification', () => {
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
        'driver_outstation_150km', 'driver_outstation_300km', 'driver_outstation_500km',
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
      assert.ok(map.driver_monthly, 'Must include driver_monthly');
      assert.ok(map.driver_base_fare, 'Must include driver_base_fare');
      assert.ok(map.driver_price_per_km, 'Must include driver_price_per_km');
      assert.ok(map.driver_min_fare, 'Must include driver_min_fare');
    });

    test('1.3 updateServicePricing rejects obsolete driver IDs with 400 OBSOLETE_SERVICE', async () => {
      const obsoleteKeys = [
        'driver_hourly_2hr', 'driver_outstation_12hr', 'driver_night_party',
        'driver_airport_drop', 'driver_outstation_150km', 'driver_outstation_300km', 'driver_outstation_500km'
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
  // 2. Authoritative Fare Calculation Verification (Model B Pure Distance)
  // =========================================================================
  describe('2. Authoritative Fare Calculation Engine (Model B)', () => {
    test('2.1 Round Trip accepts pure distance-based requests with billableDistance = 2D', () => {
      const fare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'round-trip',
        pickupArea: 'Indiranagar',
        dropLocation: 'Electronic City',
        distanceKm: 20.0
      });

      // Outbound route distance = 20 km
      assert.strictEqual(fare.outboundDistanceKm, 20.0);
      // Defined billing assumption for round trip = 2 * 20 km = 40 km
      assert.strictEqual(fare.billableDistanceKm, 40.0);
      assert.strictEqual(fare.isRoundTrip, true);
      // Base fare 100 + (40 km * 15/km = 600) = 700
      assert.strictEqual(fare.baseFare, 100);
      assert.strictEqual(fare.distanceFare, 600);
      assert.strictEqual(fare.totalFare, 700);
    });

    test('2.2 One Way Drop accepts pure distance-based requests with billableDistance = D', () => {
      const fare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        distanceKm: 20.0
      });

      assert.strictEqual(fare.outboundDistanceKm, 20.0);
      assert.strictEqual(fare.billableDistanceKm, 20.0);
      assert.strictEqual(fare.isRoundTrip, false);
      // Base fare 100 + (20 km * 15/km = 300) = 400
      assert.strictEqual(fare.baseFare, 100);
      assert.strictEqual(fare.distanceFare, 300);
      assert.strictEqual(fare.totalFare, 400);
    });

    test('2.3 Minimum fare applies to round trip if billable amount is below min fare', () => {
      const fare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'round-trip',
        pickupArea: 'Indiranagar',
        dropLocation: 'Domlur',
        distanceKm: 1.0 // Outbound 1.0 km, billable 2.0 km -> 100 + 30 = 130 (< min fare 150)
      });
      assert.strictEqual(fare.outboundDistanceKm, 1.0);
      assert.strictEqual(fare.billableDistanceKm, 2.0);
      assert.strictEqual(fare.minimumFareApplied, true);
      assert.strictEqual(fare.totalFare, 150);
    });

    test('2.4 Rejects legacy hourly requests (roundTripDuration / driverDuration) with 400 OBSOLETE_SERVICE', () => {
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

      assert.throws(() => {
        calculateAuthoritativeFare({
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          driverDuration: '2hr'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'OBSOLETE_SERVICE');
        return true;
      });
    });

    test('2.5 Rejects time-based outstation packages (12hr, 24hr, 46hr, 72hr) with 400 OBSOLETE_SERVICE', () => {
      const timePackages = ['Round trip 12hr', 'Round trip 24hr', 'Round trip 46hr', 'Round trip 72hr'];
      for (const pkg of timePackages) {
        assert.throws(() => {
          calculateAuthoritativeFare({
            bookingCategory: 'driver',
            driverTripOption: 'round-trip',
            outstationPackage: pkg
          });
        }, (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'OBSOLETE_SERVICE');
          return true;
        }, `Package '${pkg}' must be rejected with 400 OBSOLETE_SERVICE`);
      }
    });

    test('2.6 Rejects obsolete outstation distance tier packages (150km, 300km, 500km) with 400 OBSOLETE_SERVICE', () => {
      const tierPackages = [
        'One Way (Up to 150 km)',
        'One Way (Up to 300 km)',
        'One Way (Up to 500 km)',
        'driver_outstation_150km',
        'driver_outstation_300km',
        'driver_outstation_500km'
      ];
      for (const pkg of tierPackages) {
        assert.throws(() => {
          calculateAuthoritativeFare({
            bookingCategory: 'driver',
            outstationPackage: pkg
          });
        }, (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'OBSOLETE_SERVICE');
          return true;
        }, `Outstation tier '${pkg}' must be rejected with 400 OBSOLETE_SERVICE`);
      }
    });

    test('2.7 Rejects legacy party driver requests with 400 OBSOLETE_SERVICE', () => {
      assert.throws(() => {
        calculateAuthoritativeFare({
          bookingCategory: 'driver',
          driverTripOption: 'night-party'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'OBSOLETE_SERVICE');
        return true;
      });
    });

    test('2.8 Airport is a normal destination and uses distance tariff, not fixed 899 tariff', () => {
      const fare = calculateAuthoritativeFare({
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Kempegowda International Airport (BLR T1/T2)',
        distanceKm: 38.0
      });
      // 100 + 38 * 15 = 670 base fare, NOT 899 fixed
      assert.strictEqual(fare.totalFare, 670);
      assert.notStrictEqual(fare.totalFare, 899, 'Airport destination must never trigger legacy fixed tariff');
    });
  });

  // =========================================================================
  // 3. New Booking Creation API Validation
  // =========================================================================
  describe('3. Booking Creation API Validation', () => {
    test('3.1 Creates valid Round Trip booking with stored billable distance = 2D', async () => {
      const result = await createBooking({
        customerName: 'RoundTrip Rider',
        customerPhone: '9845112250',
        bookingCategory: 'driver',
        driverTripOption: 'round-trip',
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        pickupLat: 12.9784,
        pickupLng: 77.6408,
        destLat: 12.9698,
        destLng: 77.7500,
        date: '2026-11-01',
        time: '10:00'
      });

      assert.ok(result && result.booking && result.booking.id);
      assert.strictEqual(result.booking.trip_type, 'round-trip');

      // Verify stored distance_km semantics in database = billableDistanceKm (2D)
      const stored = await queryOne('SELECT distance_km, calculated_fare FROM bookings WHERE id = ?', [result.booking.id]);
      assert.ok(stored, 'Booking must exist in database');
      assert.ok(Number(stored.distance_km) > 0, 'Billable distance must be recorded');
      assert.strictEqual(Number(stored.distance_km), result.fareResult.billableDistanceKm, 'distance_km column must store billableDistanceKm');
      assert.strictEqual(result.fareResult.billableDistanceKm, result.fareResult.outboundDistanceKm * 2, 'billable distance must be exactly 2 * outbound distance');
    });

    test('3.2 Creates valid One Way Drop booking with stored billable distance = D', async () => {
      const result = await createBooking({
        customerName: 'OneWay Rider',
        customerPhone: '9845112251',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        pickupLat: 12.9784,
        pickupLng: 77.6408,
        destLat: 12.9750,
        destLng: 77.6100,
        date: '2026-11-01',
        time: '10:00'
      });

      assert.ok(result && result.booking && result.booking.id);
      assert.strictEqual(result.booking.trip_type, 'one-way');

      const stored = await queryOne('SELECT distance_km FROM bookings WHERE id = ?', [result.booking.id]);
      assert.strictEqual(Number(stored.distance_km), result.fareResult.billableDistanceKm);
      assert.strictEqual(result.fareResult.billableDistanceKm, result.fareResult.outboundDistanceKm);
    });

    test('3.3 Estimate API returns both outboundDistanceKm and billableDistanceKm', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupLat: 12.9784,
          pickupLng: 77.6408,
          destLat: 12.9698,
          destLng: 77.7500,
          bookingCategory: 'driver',
          driverTripOption: 'round-trip'
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(typeof body.data.outboundDistanceKm === 'number', 'Must expose outboundDistanceKm');
      assert.ok(typeof body.data.billableDistanceKm === 'number', 'Must expose billableDistanceKm');
      assert.strictEqual(body.data.isRoundTrip, true);
      assert.strictEqual(body.data.billableDistanceKm, Number((body.data.outboundDistanceKm * 2).toFixed(2)));
    });

    test('3.4 Rejects creation of obsolete round-trip hourly booking', async () => {
      await assert.rejects(async () => {
        await createBooking({
          customerName: 'Hourly Booker',
          customerPhone: '9845112252',
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

    test('3.5 Rejects creation of obsolete outstation distance tier package booking', async () => {
      await assert.rejects(async () => {
        await createBooking({
          customerName: 'Tier Booker',
          customerPhone: '9845112253',
          bookingCategory: 'driver',
          driverTripOption: 'outstation',
          outstationPackage: 'One Way (Up to 150 km)',
          date: '2026-11-01',
          time: '10:00'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'OBSOLETE_SERVICE');
        return true;
      });
    });

    test('3.6 Rejects creation of obsolete Party Driver booking', async () => {
      await assert.rejects(async () => {
        await createBooking({
          customerName: 'Party Booker',
          customerPhone: '9845112254',
          bookingCategory: 'driver',
          driverTripOption: 'night-party',
          date: '2026-11-01',
          time: '23:00'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'OBSOLETE_SERVICE');
        return true;
      });
    });
  });

  // =========================================================================
  // 4. Routing Architecture & Terminology Verification
  // =========================================================================
  describe('4. Routing Architecture (OSRM Road-Route vs Validated Fallback)', () => {
    test('4.1 OSRM primary road route calculates road distance and LineString geometry', async () => {
      // Mock OSRM success using routing service cache
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

      const route = await routingService.getRoute({
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        destLat: 12.9279,
        destLng: 77.6271
      });

      assert.ok(route);
      assert.strictEqual(route.distanceKm, 8.43);
      assert.strictEqual(route.durationMinutes, 22);
      assert.strictEqual(route.geometry.type, 'LineString');
    });

    test('4.2 Same location returns 0 distance without calling external routing provider', async () => {
      const route = await routingService.getRoute({
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        destLat: 12.9716,
        destLng: 77.5946
      });

      assert.strictEqual(route.distanceMeters, 0);
      assert.strictEqual(route.distanceKm, 0);
      assert.strictEqual(route.durationMinutes, 0);
    });

    test('4.3 Invalid coordinate inputs throw INVALID_COORDINATES with 400 status', async () => {
      await assert.rejects(async () => {
        await routingService.getRoute({
          pickupLat: 95, // invalid > 90
          pickupLng: 77.5946,
          destLat: 12.9279,
          destLng: 77.6271
        });
      }, (err) => {
        assert.strictEqual(err.code, 'INVALID_COORDINATES');
        assert.strictEqual(err.status, 400);
        return true;
      });
    });
  });

  // =========================================================================
  // 5. Historical Records Integrity
  // =========================================================================
  describe('5. Historical Records Integrity', () => {
    test('5.1 Pre-existing historical bookings with old service names remain readable in database', async () => {
      const testPhone = '9999900001';
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

      const userBookings = await getUserBookings(null, testPhone);
      assert.ok(userBookings.some(b => b.id === histBookingId), 'Historical booking must appear in user booking list');
    });
  });

  // =========================================================================
  // 6. Preserved Categories Verification (Vehicle Rental & Driving Academy)
  // =========================================================================
  describe('6. Preserved Categories Verification (Vehicle Rental & Driving Academy)', () => {
    test('6.1 Vehicle fleet rentals remain fully operational', async () => {
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

    test('6.2 Driving Academy courses remain fully operational', async () => {
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
