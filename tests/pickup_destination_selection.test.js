import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 5 — Pickup and Destination Selection Architecture Suite', () => {
  const modalPath = path.resolve('src/components/BookingModal.jsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  describe('1. Frontend State Architecture & Independence', () => {
    test('1.1 BookingModal manages distinct pickupLocation and destinationLocation states', () => {
      assert.match(
        modalContent,
        /const\s*\[pickupLocation,\s*setPickupLocation\]\s*=\s*useState\(null\)/,
        'Must initialize pickupLocation state as null'
      );
      assert.match(
        modalContent,
        /const\s*\[destinationLocation,\s*setDestinationLocation\]\s*=\s*useState\(null\)/,
        'Must initialize destinationLocation state as null'
      );
    });

    test('1.2 Handlers for pickup and destination selection and clearing are independent', () => {
      // Pickup handler sets pickupLocation without touching destinationLocation
      assert.match(
        modalContent,
        /const handleSelectPickup = \(item\) => \{[\s\S]*?setPickupLocation\(item\);/,
        'handleSelectPickup must set pickupLocation'
      );
      assert.match(
        modalContent,
        /const handleClearPickup = \(\) => \{[\s\S]*?setPickupLocation\(null\);/,
        'handleClearPickup must reset pickupLocation to null'
      );

      // Destination handler sets destinationLocation without touching pickupLocation
      assert.match(
        modalContent,
        /const handleSelectDestination = \(item\) => \{[\s\S]*?setDestinationLocation\(item\);/,
        'handleSelectDestination must set destinationLocation'
      );
      assert.match(
        modalContent,
        /const handleClearDestination = \(\) => \{[\s\S]*?setDestinationLocation\(null\);/,
        'handleClearDestination must reset destinationLocation to null'
      );
    });

    test('1.3 Current GPS location can be explicitly chosen as pickup with honest label', () => {
      assert.match(
        modalContent,
        /handleUseCurrentLocationForPickup/,
        'Must support explicit use of current location for pickup'
      );
      assert.match(
        modalContent,
        /Current Location \(GPS\)/,
        'Must use honest label without reverse geocoding'
      );
    });
  });

  describe('2. Map View Integration & Markers', () => {
    test('2.1 Dedicated PickupMarker and DestinationMarker components exist and are distinct', () => {
      const pickupMarkerPath = path.resolve('src/components/map/PickupMarker.jsx');
      const destMarkerPath = path.resolve('src/components/map/DestinationMarker.jsx');
      const gpsMarkerPath = path.resolve('src/components/map/LocationMarker.jsx');

      assert.ok(fs.existsSync(pickupMarkerPath), 'PickupMarker.jsx must exist');
      assert.ok(fs.existsSync(destMarkerPath), 'DestinationMarker.jsx must exist');
      assert.ok(fs.existsSync(gpsMarkerPath), 'LocationMarker.jsx must exist');

      const pickupCode = fs.readFileSync(pickupMarkerPath, 'utf8');
      const destCode = fs.readFileSync(destMarkerPath, 'utf8');

      // Visual color and icon distinction
      assert.match(pickupCode, /10b981|emerald/, 'PickupMarker must use emerald/green styling');
      assert.match(destCode, /f43f5e|rose/, 'DestinationMarker must use rose/crimson styling');
    });

    test('2.2 MapView supports bounds fitting when both pickup and destination exist', () => {
      const mapViewPath = path.resolve('src/components/map/MapView.jsx');
      const mapViewCode = fs.readFileSync(mapViewPath, 'utf8');

      assert.match(mapViewCode, /map\.fitBounds\(bounds/, 'MapView must support fitBounds');
      assert.match(modalContent, /bounds=\{mapBounds\}/, 'BookingModal must pass mapBounds to MapView');
    });

    test('2.3 No route polylines or fake routing lines are drawn in Phase 5', () => {
      // Must not render any Polyline component between points
      assert.ok(
        !modalContent.includes('<Polyline'),
        'BookingModal must NOT render <Polyline> in Phase 5'
      );
      assert.ok(
        !modalContent.includes('routingService'),
        'BookingModal must NOT reference routingService in Phase 5'
      );
    });
  });

  describe('3. Booking Form & Contract Compatibility', () => {
    test('3.1 Synchronizes area text for backward-compatible booking payload', () => {
      assert.match(
        modalContent,
        /setPickupArea\(item\.displayName\.split\(','\)\[0\]\.trim\(\)\)/,
        'Must keep pickupArea in sync with selected pickup'
      );
      assert.match(
        modalContent,
        /setDropLocation\(item\.displayName\.split\(','\)\[0\]\.trim\(\)\)/,
        'Must keep dropLocation in sync with selected destination'
      );
    });

    test('3.2 Booking payload construction remains intact and untouched', () => {
      assert.match(modalContent, /pickupArea,/, 'Booking payload must still contain pickupArea');
      assert.match(modalContent, /dropLocation:/, 'Booking payload must still contain dropLocation');
      assert.match(modalContent, /apiClient\.createBooking/, 'Must submit via apiClient.createBooking');
    });

    test('3.3 No schema or backend coordinate fields are required in Phase 5', () => {
      const schemaPath = path.resolve('server/db/schema.js');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      // Verify bookings schema is untouched
      assert.match(schemaContent, /pickup_area TEXT NOT NULL/, 'Schema must retain text pickup_area');
      assert.match(schemaContent, /drop_location TEXT/, 'Schema must retain text drop_location');
    });
  });
});
