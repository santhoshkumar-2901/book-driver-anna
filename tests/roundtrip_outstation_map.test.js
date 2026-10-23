import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import bookingsRouter from '../server/routes/bookings.js';
import locationRouter from '../server/routes/location.js';
import { createBooking } from '../server/services/bookingService.js';
import { calculateAuthoritativeFare } from '../server/services/pricingService.js';
import { queryOne, execute } from '../server/db/database.js';

describe('Book Driver Anna — Round Trip & Outstation Map Integration Suite', () => {
  let app;
  let server;
  let baseUrl;

  // Real geographic coordinates for testing
  const BANGALORE_INDIRANAGAR = { lat: 12.9784, lng: 77.6408, name: 'Indiranagar, Bangalore' };
  const BANGALORE_ELECTRONIC_CITY = { lat: 12.8399, lng: 77.6770, name: 'Electronic City, Bangalore' };
  const MYSORE_PALACE = { lat: 12.3051, lng: 76.6551, name: 'Mysore Palace, Mysuru' };
  const CHENNAI_CENTRAL = { lat: 13.0827, lng: 80.2707, name: 'Chennai Central, Chennai' };
  const PONDICHERRY_PROMENADE = { lat: 11.9341, lng: 79.8358, name: 'Promenade Beach, Pondicherry' };

  before(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/bookings', bookingsRouter);
    app.use('/api/location', locationRouter);

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
  // 1. Frontend Static Contract Verification
  // =========================================================================
  describe('1. Frontend Modal Integration & Architecture', () => {
    const modalPath = path.resolve('src/components/BookingModal.jsx');
    const modalContent = fs.readFileSync(modalPath, 'utf8');

    test('1.1 BookingModal provides unified pickup and destination search for all driver options', () => {
      assert.match(modalContent, /id="pickup-location-search"/, 'Must provide pickup location search');
      assert.match(modalContent, /id="destination-location-search"/, 'Must provide destination location search');
      assert.match(modalContent, /handleUseCurrentLocationForPickup/, 'Must provide current location button');
    });

    test('1.2 Round trip hourly packages are decommissioned in BookingModal', () => {
      assert.ok(!modalContent.includes("Round Trip Duration (2hr, 4hr, 6hr, 12hr)"));
      assert.ok(!modalContent.includes("driver_hourly_2hr"));
    });

    test('1.3 Round Trip uses pure distance without duration or tier packages in BookingModal', () => {
      assert.match(modalContent, /driverTripOption === 'round-trip'/, 'Must support round-trip driver option');
      assert.ok(!modalContent.includes("Select Distance Tier"), 'Distance tier selector must be removed');
      assert.ok(!modalContent.includes("driver_outstation_150km"), 'Outstation tier prices must be removed');
      assert.ok(!modalContent.includes("Outstation Trip Mode"));
      assert.ok(!modalContent.includes("driver_outstation_12hr"));
    });

    test('1.4 MapView renders Leaflet components for markers and route polyline', () => {
      assert.match(modalContent, /<MapView/, 'Must render MapView');
      assert.match(modalContent, /<PickupMarker location=\{pickupLocation\}/, 'Must render PickupMarker');
      assert.match(modalContent, /<DestinationMarker location=\{destinationLocation\}/, 'Must render DestinationMarker');
      assert.match(modalContent, /<RoutePolyline geometry=\{routeData\.geometry\}/, 'Must render RoutePolyline');
    });

    test('1.5 Switching trip options clears transient route state to prevent cross-mode pollution', () => {
      assert.match(modalContent, /handleDriverTripOptionChange/, 'Must provide clean trip option switcher');
      assert.match(modalContent, /setRouteData\(null\)/, 'Must clear route data on mode change');
    });
  });

  // =========================================================================
  // 2. Obsolete Package Rejection & City Driver Route Integration
  // =========================================================================
  describe('2. Obsolete Package Rejection & City Driver Integration', () => {
    test('2.1 Round trip time packages are rejected with 400 OBSOLETE_SERVICE', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/fare-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingCategory: 'driver',
          driverTripOption: 'round-trip',
          roundTripDuration: '4hr',
          pickup: { latitude: BANGALORE_INDIRANAGAR.lat, longitude: BANGALORE_INDIRANAGAR.lng },
          destination: { latitude: BANGALORE_ELECTRONIC_CITY.lat, longitude: BANGALORE_ELECTRONIC_CITY.lng }
        })
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'OBSOLETE_SERVICE');
    });

    test('2.2 Round trip booking creation is rejected with 400 OBSOLETE_SERVICE', async () => {
      await assert.rejects(async () => {
        await createBooking({
          customerName: 'RoundTrip Tester',
          customerPhone: '9888877771',
          customerEmail: 'roundtrip@example.com',
          bookingCategory: 'driver',
          driverTripOption: 'round-trip',
          roundTripDuration: '4hr',
          pickupArea: BANGALORE_INDIRANAGAR.name,
          dropLocation: BANGALORE_ELECTRONIC_CITY.name,
          pickupLat: BANGALORE_INDIRANAGAR.lat,
          pickupLng: BANGALORE_INDIRANAGAR.lng,
          destLat: BANGALORE_ELECTRONIC_CITY.lat,
          destLng: BANGALORE_ELECTRONIC_CITY.lng,
          date: '2026-10-15',
          time: '10:00',
          paymentMode: 'cash'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'OBSOLETE_SERVICE');
        return true;
      });
    });

    test('2.3 City Driver estimates road distance and calculates distance-based fare', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/fare-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickup: { latitude: BANGALORE_INDIRANAGAR.lat, longitude: BANGALORE_INDIRANAGAR.lng },
          destination: { latitude: BANGALORE_ELECTRONIC_CITY.lat, longitude: BANGALORE_ELECTRONIC_CITY.lng }
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data.distanceKm > 0);
      assert.ok(data.data.totalFare > 0);
    });

    test('2.4 City driver rejects identical pickup and destination coordinates in estimate and booking', async () => {
      // 1. Fare estimate endpoint rejects same location
      const res = await fetch(`${baseUrl}/api/bookings/fare-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickup: { latitude: BANGALORE_INDIRANAGAR.lat, longitude: BANGALORE_INDIRANAGAR.lng },
          destination: { latitude: BANGALORE_INDIRANAGAR.lat, longitude: BANGALORE_INDIRANAGAR.lng }
        })
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'SAME_LOCATION');
      assert.strictEqual(body.error.message, 'Pickup and destination must be different.');

      // 2. Booking creation rejects same location
      await assert.rejects(async () => {
        await createBooking({
          customerName: 'Same Location Tester',
          customerPhone: '9888877775',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: BANGALORE_INDIRANAGAR.name,
          dropLocation: BANGALORE_INDIRANAGAR.name,
          pickupLat: BANGALORE_INDIRANAGAR.lat,
          pickupLng: BANGALORE_INDIRANAGAR.lng,
          destLat: BANGALORE_INDIRANAGAR.lat,
          destLng: BANGALORE_INDIRANAGAR.lng,
          date: '2026-10-15',
          time: '11:00',
          paymentMode: 'cash'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'SAME_LOCATION');
        return true;
      });
    });

    test('2.5 BookingModal prevents submission and resets state if pickup equals destination', () => {
      const modalPath = path.resolve('src/components/BookingModal.jsx');
      const content = fs.readFileSync(modalPath, 'utf8');
      assert.match(
        content,
        /Math\.abs\(pickupLocation\.latitude - destinationLocation\.latitude\) < 0\.0001/,
        'BookingModal must detect identical pickup and destination'
      );
      assert.match(
        content,
        /Pickup and destination must be different\./,
        'BookingModal must display user-facing same-location error'
      );
    });
  });

  // =========================================================================
  // 3. Round Trip Map, Routing & Distance Fare Flow (Model B)
  // =========================================================================
  describe('3. Round Trip Routing & Distance Fare Integration', () => {
    test('3.1 Round trip calculates road distance and billable distance = 2D (Bangalore to Mysore)', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/fare-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingCategory: 'driver',
          driverTripOption: 'round-trip',
          pickup: { latitude: BANGALORE_INDIRANAGAR.lat, longitude: BANGALORE_INDIRANAGAR.lng },
          destination: { latitude: MYSORE_PALACE.lat, longitude: MYSORE_PALACE.lng }
        })
      });

      assert.strictEqual(res.status, 200, 'Must return HTTP 200');
      const body = await res.json();
      assert.strictEqual(body.success, true);
      // Bangalore to Mysore road distance is approx 130-160 km
      assert.ok(body.data.distanceKm >= 100, 'Bangalore to Mysore outbound road distance must be >= 100 km');
      assert.ok(body.data.outboundDistanceKm >= 100, 'outboundDistanceKm must be >= 100 km');
      assert.strictEqual(body.data.billableDistanceKm, Number((body.data.outboundDistanceKm * 2).toFixed(2)));
      // Base fare: 100 + billableDistanceKm * 15
      const expectedTotal = Number((100 + body.data.billableDistanceKm * 15).toFixed(2));
      assert.strictEqual(Number(body.data.totalFare.toFixed(2)), expectedTotal);
    });

    test('3.2 Round trip intercity route (Chennai to Pondicherry)', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/fare-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingCategory: 'driver',
          driverTripOption: 'round-trip',
          pickup: { latitude: CHENNAI_CENTRAL.lat, longitude: CHENNAI_CENTRAL.lng },
          destination: { latitude: PONDICHERRY_PROMENADE.lat, longitude: PONDICHERRY_PROMENADE.lng }
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(body.data.distanceKm >= 120, 'Chennai to Pondicherry road distance must be >= 120 km');
      assert.strictEqual(body.data.billableDistanceKm, Number((body.data.outboundDistanceKm * 2).toFixed(2)));
    });

    test('3.3 Round trip booking creation persists coordinates, distance_km = billableDistance', async () => {
      const result = await createBooking({
        customerName: 'RoundTrip Traveler',
        customerPhone: '9888877772',
        customerEmail: 'roundtrip@example.com',
        bookingCategory: 'driver',
        driverTripOption: 'round-trip',
        pickupArea: BANGALORE_INDIRANAGAR.name,
        dropLocation: MYSORE_PALACE.name,
        pickupLat: BANGALORE_INDIRANAGAR.lat,
        pickupLng: BANGALORE_INDIRANAGAR.lng,
        destLat: MYSORE_PALACE.lat,
        destLng: MYSORE_PALACE.lng,
        date: '2026-10-15',
        time: '08:00',
        paymentMode: 'cash'
      });

      assert.ok(result && result.booking && result.booking.id, 'Booking must be created');
      const stored = await queryOne('SELECT * FROM bookings WHERE id = ?', [result.booking.id]);
      assert.ok(stored, 'Booking must exist in database');
      assert.strictEqual(stored.trip_type, 'round-trip');
      assert.strictEqual(stored.drop_location, MYSORE_PALACE.name);
      assert.ok(stored.pickup_latitude !== null, 'pickup_latitude must be persisted');
      assert.ok(stored.pickup_longitude !== null, 'pickup_longitude must be persisted');
      assert.ok(stored.destination_latitude !== null, 'destination_latitude must be persisted');
      assert.ok(stored.destination_longitude !== null, 'destination_longitude must be persisted');
      assert.ok(stored.distance_km !== null, 'distance_km must be persisted');
      assert.strictEqual(Number(stored.distance_km), result.fareResult.billableDistanceKm);
      assert.strictEqual(result.fareResult.billableDistanceKm, result.fareResult.outboundDistanceKm * 2);
    });

    test('3.4 Round trip rejects identical pickup and destination coordinates', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/fare-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingCategory: 'driver',
          driverTripOption: 'round-trip',
          pickup: { latitude: MYSORE_PALACE.lat, longitude: MYSORE_PALACE.lng },
          destination: { latitude: MYSORE_PALACE.lat, longitude: MYSORE_PALACE.lng }
        })
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'SAME_LOCATION');
    });

    test('3.5 Obsolete outstation distance tier packages reject with 400 OBSOLETE_SERVICE', () => {
      assert.throws(() => {
        calculateAuthoritativeFare({
          bookingCategory: 'driver',
          outstationPackage: 'One Way (Up to 150 km)',
          distanceKm: 80
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'OBSOLETE_SERVICE');
        return true;
      });

      assert.throws(() => {
        calculateAuthoritativeFare({
          bookingCategory: 'driver',
          outstationPackage: 'One Way (Up to 300 km)',
          distanceKm: 180
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'OBSOLETE_SERVICE');
        return true;
      });
    });
  });

  // =========================================================================
  // 4. Security, Server Authority & Regression Integrity
  // =========================================================================
  describe('4. Architecture Integrity & Zero Paid Mapping Boundary', () => {
    test('4.1 No Google Maps, Mapbox, HERE, or paid map APIs are referenced in source code', () => {
      const srcDir = path.resolve('src');
      const files = fs.readdirSync(srcDir, { recursive: true });
      for (const file of files) {
        if (typeof file === 'string' && (file.endsWith('.js') || file.endsWith('.jsx'))) {
          const filePath = path.join(srcDir, file);
          if (fs.statSync(filePath).isFile()) {
            const code = fs.readFileSync(filePath, 'utf8');
            assert.ok(!code.includes('maps.googleapis.com'), `Google Maps forbidden: ${file}`);
            assert.ok(!code.includes('api.mapbox.com'), `Mapbox forbidden: ${file}`);
            assert.ok(!code.includes('hereapi.com'), `HERE Maps forbidden: ${file}`);
          }
        }
      }
    });

    test('4.2 Client cannot override authoritative route distance or fare', async () => {
      // Malicious client tries to forge 500 km distance and calculated_fare of 10
      const result = await createBooking({
        customerName: 'Hacker Spoof',
        customerPhone: '9888877776',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: BANGALORE_INDIRANAGAR.name,
        dropLocation: BANGALORE_ELECTRONIC_CITY.name,
        pickupLat: BANGALORE_INDIRANAGAR.lat,
        pickupLng: BANGALORE_INDIRANAGAR.lng,
        destLat: BANGALORE_ELECTRONIC_CITY.lat,
        destLng: BANGALORE_ELECTRONIC_CITY.lng,
        distanceKm: 500, // Client tries to spoof 500 km
        calculatedFare: 10, // Client tries to spoof 10 INR fare
        totalFare: 10,
        date: '2026-10-15',
        time: '12:00',
        paymentMode: 'cash'
      });

      assert.ok(result && result.booking && result.booking.id);
      const stored = await queryOne('SELECT * FROM bookings WHERE id = ?', [result.booking.id]);
      // Server must have calculated the true road distance (~15-25 km), NOT 500 km
      assert.notStrictEqual(stored.distance_km, 500, 'Server must reject client-supplied distanceKm');
      assert.ok(stored.distance_km < 100, 'Distance must be authoritative OSRM route distance');
      // Server must have calculated authoritative fare, NOT 10 INR
      assert.notStrictEqual(stored.calculated_fare, 10, 'Server must reject client-supplied fare');
      assert.ok(stored.calculated_fare >= 200, 'Fare must be authoritative server fare');
    });

    test('4.3 Invalid, NaN, and Infinity coordinates are rejected with 400', async () => {
      // NaN coordinates
      await assert.rejects(async () => {
        await createBooking({
          customerName: 'NaN Coords',
          customerPhone: '9888877777',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          dropLocation: 'Whitefield',
          pickupLat: NaN,
          pickupLng: 77.6408,
          destLat: 12.8399,
          destLng: 77.6770,
          date: '2026-10-15',
          time: '12:00'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'INVALID_COORDINATES');
        return true;
      });

      // Infinity coordinates
      await assert.rejects(async () => {
        await createBooking({
          customerName: 'Inf Coords',
          customerPhone: '9888877778',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          dropLocation: 'Whitefield',
          pickupLat: 12.9784,
          pickupLng: Infinity,
          destLat: 12.8399,
          destLng: 77.6770,
          date: '2026-10-15',
          time: '12:00'
        });
      }, (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'INVALID_COORDINATES');
        return true;
      });
    });

    test('4.4 One-Way distance pricing remains authoritative and unaffected', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/fare-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickup: { latitude: BANGALORE_INDIRANAGAR.lat, longitude: BANGALORE_INDIRANAGAR.lng },
          destination: { latitude: BANGALORE_ELECTRONIC_CITY.lat, longitude: BANGALORE_ELECTRONIC_CITY.lng }
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.distanceFare > 0, 'One-Way trip must compute distanceFare');
      assert.ok(body.data.pricePerKm > 0, 'One-Way trip must have pricePerKm');
    });

    test('4.5 Vehicle rental bookings remain fully compatible', async () => {
      const result = await createBooking({
        customerName: 'Vehicle Renter',
        customerPhone: '9888877773',
        bookingCategory: 'vehicle',
        vehicleCategory: 'Sedan',
        pickupArea: 'Indiranagar',
        dropLocation: 'Bangalore City',
        date: '2026-10-15',
        time: '09:00',
        paymentMode: 'cash'
      });
      assert.ok(result && result.booking && result.booking.id);
      const stored = await queryOne('SELECT * FROM bookings WHERE id = ?', [result.booking.id]);
      assert.strictEqual(stored.booking_type, 'vehicle');
    });

    test('4.6 Driving Academy enrollments remain fully compatible', async () => {
      const result = await createBooking({
        customerName: 'Academy Student',
        customerPhone: '9888877774',
        bookingCategory: 'class',
        selectedClassId: 'class-beginner',
        pickupArea: 'Indiranagar',
        date: '2026-10-15',
        time: '07:00',
        paymentMode: 'cash'
      });
      assert.ok(result && result.booking && result.booking.id);
      const stored = await queryOne('SELECT * FROM bookings WHERE id = ?', [result.booking.id]);
      assert.strictEqual(stored.booking_type, 'class');
    });
  });
});
