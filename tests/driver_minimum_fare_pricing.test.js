import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { calculateAuthoritativeFare } from '../server/services/pricingService.js';
import { startTestServer } from './testHelper.js';
import { createBooking } from '../server/services/bookingService.js';

describe('Driver Minimum-Fare Pricing Logic Suite (Phase 2)', () => {
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

  // 1. Distance fare below ₹150 (Floor Applied)
  test('1. Distance fare below ₹150 applies minimum fare floor of ₹150 without adding base fare', () => {
    // 2 km: 2 * 15 = 30 < 150 -> final fare = 150
    const fare2km = calculateAuthoritativeFare({
      bookingCategory: 'driver',
      driverTripOption: 'one-way',
      distanceKm: 2.0
    });
    assert.strictEqual(fare2km.distanceFare, 30.00);
    assert.strictEqual(fare2km.minimumFare, 150);
    assert.strictEqual(fare2km.minimumFareApplied, true);
    assert.strictEqual(fare2km.calculatedFare, 150.00);
    assert.strictEqual(fare2km.totalFare, 150.00);
    assert.strictEqual(fare2km.gst, 0, 'Distance fare must be all-inclusive with 0 separate GST');

    // 5 km: 5 * 15 = 75 < 150 -> final fare = 150
    const fare5km = calculateAuthoritativeFare({
      bookingCategory: 'driver',
      driverTripOption: 'one-way',
      distanceKm: 5.0
    });
    assert.strictEqual(fare5km.distanceFare, 75.00);
    assert.strictEqual(fare5km.minimumFareApplied, true);
    assert.strictEqual(fare5km.totalFare, 150.00);
  });

  // 2. Distance fare exactly equal to ₹150
  test('2. Distance fare exactly equal to ₹150 charges exactly ₹150 with minimumFareApplied false', () => {
    // 10 km: 10 * 15 = 150 == 150 -> final fare = 150
    const fare10km = calculateAuthoritativeFare({
      bookingCategory: 'driver',
      driverTripOption: 'one-way',
      distanceKm: 10.0
    });
    assert.strictEqual(fare10km.distanceFare, 150.00);
    assert.strictEqual(fare10km.minimumFareApplied, false);
    assert.strictEqual(fare10km.calculatedFare, 150.00);
    assert.strictEqual(fare10km.totalFare, 150.00);
  });

  // 3. Distance fare above ₹150 (Pure Distance Fare without Base Fare Addition)
  test('3. Distance fare above ₹150 charges pure distance rate without adding base fare', () => {
    // 15 km: 15 * 15 = 225 > 150 -> final fare = 225
    const fare15km = calculateAuthoritativeFare({
      bookingCategory: 'driver',
      driverTripOption: 'one-way',
      distanceKm: 15.0
    });
    assert.strictEqual(fare15km.distanceFare, 225.00);
    assert.strictEqual(fare15km.minimumFareApplied, false);
    assert.strictEqual(fare15km.calculatedFare, 225.00);
    assert.strictEqual(fare15km.totalFare, 225.00);

    // 20 km: 20 * 15 = 300 > 150 -> final fare = 300
    const fare20km = calculateAuthoritativeFare({
      bookingCategory: 'driver',
      driverTripOption: 'one-way',
      distanceKm: 20.0
    });
    assert.strictEqual(fare20km.distanceFare, 300.00);
    assert.strictEqual(fare20km.minimumFareApplied, false);
    assert.strictEqual(fare20km.calculatedFare, 300.00);
    assert.strictEqual(fare20km.totalFare, 300.00);
  });

  // 4. One-Way and Round-Trip billing
  test('4. One-way uses outbound distance (1D) and round-trip uses return distance (2D) before floor check', () => {
    // One-way 4 km: billable = 4 km -> 4 * 15 = 60 < 150 -> 150
    const oneWayShort = calculateAuthoritativeFare({
      bookingCategory: 'driver',
      driverTripOption: 'one-way',
      distanceKm: 4.0
    });
    assert.strictEqual(oneWayShort.isRoundTrip, false);
    assert.strictEqual(oneWayShort.outboundDistanceKm, 4.0);
    assert.strictEqual(oneWayShort.billableDistanceKm, 4.0);
    assert.strictEqual(oneWayShort.totalFare, 150.00);

    // Round-trip 4 km: billable = 8 km -> 8 * 15 = 120 < 150 -> 150
    const roundTripShort = calculateAuthoritativeFare({
      bookingCategory: 'driver',
      driverTripOption: 'round-trip',
      distanceKm: 4.0
    });
    assert.strictEqual(roundTripShort.isRoundTrip, true);
    assert.strictEqual(roundTripShort.outboundDistanceKm, 4.0);
    assert.strictEqual(roundTripShort.billableDistanceKm, 8.0);
    assert.strictEqual(roundTripShort.distanceFare, 120.00);
    assert.strictEqual(roundTripShort.totalFare, 150.00);

    // Round-trip 10 km: billable = 20 km -> 20 * 15 = 300 > 150 -> 300
    const roundTripLong = calculateAuthoritativeFare({
      bookingCategory: 'driver',
      driverTripOption: 'round-trip',
      distanceKm: 10.0
    });
    assert.strictEqual(roundTripLong.isRoundTrip, true);
    assert.strictEqual(roundTripLong.outboundDistanceKm, 10.0);
    assert.strictEqual(roundTripLong.billableDistanceKm, 20.0);
    assert.strictEqual(roundTripLong.distanceFare, 300.00);
    assert.strictEqual(roundTripLong.totalFare, 300.00);
  });

  // 5. Custom tariffs resolved from pricing map / database
  test('5. Custom tariffs dynamically resolved apply to the formula without adding base fare', () => {
    const customPricingMap = {
      driver_base_fare: { id: 'driver_base_fare', category: 'driver', name: 'Base Fare', price: 120 },
      driver_price_per_km: { id: 'driver_price_per_km', category: 'driver', name: 'Price Per KM', price: 20 },
      driver_min_fare: { id: 'driver_min_fare', category: 'driver', name: 'Minimum Fare', price: 200 }
    };

    // 8 km with custom tariff: 8 * 20 = 160 < min fare 200 -> 200
    const customBelowMin = calculateAuthoritativeFare({
      bookingCategory: 'driver',
      driverTripOption: 'one-way',
      distanceKm: 8.0
    }, customPricingMap);
    assert.strictEqual(customBelowMin.pricePerKm, 20);
    assert.strictEqual(customBelowMin.minimumFare, 200);
    assert.strictEqual(customBelowMin.distanceFare, 160.00);
    assert.strictEqual(customBelowMin.minimumFareApplied, true);
    assert.strictEqual(customBelowMin.totalFare, 200.00);

    // 15 km with custom tariff: 15 * 20 = 300 > min fare 200 -> 300
    const customAboveMin = calculateAuthoritativeFare({
      bookingCategory: 'driver',
      driverTripOption: 'one-way',
      distanceKm: 15.0
    }, customPricingMap);
    assert.strictEqual(customAboveMin.distanceFare, 300.00);
    assert.strictEqual(customAboveMin.minimumFareApplied, false);
    assert.strictEqual(customAboveMin.totalFare, 300.00);
  });

  // 6. Consistency between HTTP estimate API and booking creation authoritative fare
  test('6. Consistency: /api/bookings/estimate and createBooking produce identical authoritative fares', async () => {
    // Use test coordinates inside Bangalore that resolve road distance (e.g. Indiranagar to Koramangala ~8.43km)
    const estimateRes = await fetch(`${baseUrl}/api/bookings/estimate?pickupLat=12.9716&pickupLng=77.5946&destLat=12.9279&destLng=77.6271&bookingCategory=driver&driverTripOption=one-way`);
    assert.strictEqual(estimateRes.status, 200);
    const estimateJson = await estimateRes.json();
    assert.strictEqual(estimateJson.success, true);
    const estimatedTotal = estimateJson.data.totalFare;

    // Next-day future date to prevent INVALID_DATE errors
    const futureDate = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];

    const bookingRes = await createBooking({
      customerName: 'Fare Consistency Test',
      customerPhone: '9845012345',
      customerEmail: 'consistency@example.com',
      bookingCategory: 'driver',
      driverTripOption: 'one-way',
      pickupArea: 'Indiranagar',
      dropLocation: 'Koramangala',
      pickupLat: 12.9716,
      pickupLng: 77.5946,
      destLat: 12.9279,
      destLng: 77.6271,
      calculated_fare: 9999, // Intentional client-side fake fare
      date: futureDate,
      time: '10:00'
    });

    assert.ok(bookingRes.booking);
    assert.strictEqual(bookingRes.booking.calculated_fare, estimatedTotal, 'Booking authoritative fare must match estimate authoritative fare');
  });

  // 7. Correct fare breakdown fields and tax treatment
  test('7. Fare breakdown contains structured metadata with gst=0 for distance rides', () => {
    const fare = calculateAuthoritativeFare({
      bookingCategory: 'driver',
      driverTripOption: 'one-way',
      distanceKm: 18.5
    });

    assert.strictEqual(fare.currency, 'INR');
    assert.strictEqual(fare.gst, 0);
    assert.strictEqual(fare.pricePerKm, 15);
    assert.strictEqual(fare.baseFare, 100);
    assert.strictEqual(fare.distanceFare, 277.50);
    assert.strictEqual(fare.minimumFare, 150);
    assert.strictEqual(fare.minimumFareApplied, false);
    assert.strictEqual(fare.totalFare, 277.50);

    assert.ok(fare.fareBreakdown, 'fareBreakdown object must be returned');
    assert.strictEqual(fare.fareBreakdown.distanceFare, 277.50);
    assert.strictEqual(fare.fareBreakdown.minimumFare, 150);
    assert.strictEqual(fare.fareBreakdown.estimatedTotal, 277.50);
  });
});
