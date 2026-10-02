import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('Phase 11 — Live Driver Marker Suite', () => {
  const markerPath = path.resolve('src/components/map/DriverLocationMarker.jsx');
  const markerContent = fs.readFileSync(markerPath, 'utf8');

  const modalPath = path.resolve('src/components/BookingSuccessModal.jsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  const hookPath = path.resolve('src/utils/useDriverRealtimeLocation.js');
  const hookContent = fs.readFileSync(hookPath, 'utf8');

  describe('1. Driver Marker Component & Validation', () => {
    test('1. Driver marker file exists and renders with Leaflet Marker', () => {
      assert.ok(fs.existsSync(markerPath), 'DriverLocationMarker.jsx must exist');
      assert.ok(markerContent.includes('Marker position='), 'DriverLocationMarker must use Leaflet Marker');
      assert.ok(markerContent.includes('bda-driver-marker-wrapper'), 'DriverLocationMarker must use distinct CSS class');
      assert.ok(markerContent.includes('export default function DriverLocationMarker'), 'Must export DriverLocationMarker component');
    });

    test('2. Invalid coordinates are rejected safely (null, NaN, out of bounds)', () => {
      assert.ok(markerContent.includes('if (!location) return null;'), 'Must return null if location is falsy');
      assert.ok(markerContent.includes('isFinite(lat)'), 'Must check isFinite for latitude');
      assert.ok(markerContent.includes('isFinite(lng)'), 'Must check isFinite for longitude');
      assert.ok(markerContent.includes('lat < -90 || lat > 90'), 'Must validate latitude bounds');
      assert.ok(markerContent.includes('lng < -180 || lng > 180'), 'Must validate longitude bounds');
    });

    test('3. Driver marker is visually distinct from customer GPS, pickup, and destination', () => {
      const pickupContent = fs.readFileSync(path.resolve('src/components/map/PickupMarker.jsx'), 'utf8');
      const destContent = fs.readFileSync(path.resolve('src/components/map/DestinationMarker.jsx'), 'utf8');
      const custContent = fs.readFileSync(path.resolve('src/components/map/LocationMarker.jsx'), 'utf8');

      // Driver marker uses blue/vehicle styling
      assert.ok(markerContent.includes('#2563eb') || markerContent.includes('blue'), 'Driver marker must use distinct blue palette');
      assert.ok(markerContent.includes('<svg') || markerContent.includes('🚗'), 'Driver marker must render vehicle icon');

      // Pickup uses emerald green
      assert.ok(pickupContent.includes('#10b981') || pickupContent.includes('emerald'), 'Pickup must use green');

      // Destination uses rose/red
      assert.ok(destContent.includes('#f43f5e') || destContent.includes('rose'), 'Destination must use rose');

      // Customer GPS uses amber
      assert.ok(custContent.includes('#f59e0b') || custContent.includes('amber'), 'Customer GPS must use amber');
    });
  });

  describe('2. Phase 10 Realtime Location Consumption & Initial Location', () => {
    test('4. BookingSuccessModal consumes useDriverRealtimeLocation hook', () => {
      assert.ok(modalContent.includes('useDriverRealtimeLocation'), 'Must import and use useDriverRealtimeLocation');
      assert.ok(modalContent.includes('DriverLocationMarker'), 'Must import and render DriverLocationMarker');
      assert.ok(modalContent.includes('hasAssignedDriver'), 'Must guard live tracking with hasAssignedDriver check');
    });

    test('5. Initial driver location hydration produces driver marker immediately', () => {
      assert.ok(hookContent.includes('driver.location.initial'), 'Hook must handle driver.location.initial');
      assert.ok(hookContent.includes('driver.location.updated'), 'Hook must handle driver.location.updated');
    });

    test('6. Location state updates with latest coordinates and preserves single latest position', () => {
      // Verify that incoming location updates replace the location object instead of appending to an array
      assert.ok(hookContent.includes('setLocation({'), 'Hook must update latest location');
      assert.ok(!hookContent.includes('locationHistory'), 'Hook must NOT maintain location history or trails');
      assert.ok(!hookContent.includes('breadcrumbs'), 'Hook must NOT draw breadcrumbs');
    });
  });

  describe('3. Map Interaction & Non-Interference', () => {
    test('7. Map does NOT constantly recenter or fitBounds on driver movement', () => {
      // Guarded initial center ref prevents recentering on subsequent driver GPS movements
      assert.ok(modalContent.includes('hasInitializedCenterRef'), 'Must use ref to initialize center only once');
      assert.ok(!modalContent.includes('map.fitBounds(driverLiveLocation'), 'Must NOT continuously call fitBounds on driver updates');
    });

    test('8. Marker only activates when booking has an assigned driver', () => {
      assert.ok(modalContent.includes('hasAssignedDriver'), 'Must verify assignedDriver existence');
      assert.ok(modalContent.includes('!isCancelled'), 'Must disable when booking is cancelled');
    });
  });

  describe('4. Connection States & Error Resilience', () => {
    test('9. Handles connecting, waiting, live, and error states gracefully', () => {
      assert.ok(modalContent.includes('Connecting to driver'), 'Must render connecting state badge');
      assert.ok(modalContent.includes('Waiting for driver'), 'Must render waiting-for-location state badge');
      assert.ok(modalContent.includes('Live GPS Active') || modalContent.includes('Live'), 'Must render live GPS active badge');
      assert.ok(modalContent.includes('Live location temporarily unavailable'), 'Must render error state badge without crashing');
    });

    test('10. Realtime service failure does not crash booking UI', () => {
      // Verify the details grid and modal controls are rendered outside the realtime try/guard
      assert.ok(modalContent.includes('Trip / Class Details Grid'), 'Details grid must remain rendered and functional');
      assert.ok(modalContent.includes('Total Amount Payable'), 'Fare and settlement remain fully accessible');
    });
  });

  describe('5. Unmount & Lifecycle Cleanup', () => {
    test('11. Unmount cleans up realtime WebSocket and timers cleanly', () => {
      assert.ok(hookContent.includes('isUnmountedRef.current = true'), 'Hook must track unmount state');
      assert.ok(hookContent.includes('socketRef.current.close(1000'), 'Hook must close socket with code 1000 on unmount');
      assert.ok(hookContent.includes('clearTimeout(reconnectTimeoutRef.current)'), 'Hook must clear reconnect timers on unmount');
    });

    test('12. Changing booking ID disconnects previous subscription', () => {
      assert.ok(hookContent.includes('[bookingId, token, enabled'), 'Hook effect must depend on bookingId and token');
      assert.ok(hookContent.includes('type: \'unsubscribe\''), 'Hook must unsubscribe on cleanup');
    });
  });

  describe('6. Regression & Strict Phase 11 Boundaries', () => {
    test('13. Phase 3 Customer GPS, Phase 5 Pickup/Destination, and Phase 6 Route remain intact', () => {
      const mapIndex = fs.readFileSync(path.resolve('src/components/map/index.js'), 'utf8');

      assert.ok(mapIndex.includes('LocationMarker'), 'Customer GPS LocationMarker preserved');
      assert.ok(mapIndex.includes('PickupMarker'), 'PickupMarker preserved');
      assert.ok(mapIndex.includes('DestinationMarker'), 'DestinationMarker preserved');
      assert.ok(mapIndex.includes('RoutePolyline'), 'RoutePolyline preserved');
      assert.ok(mapIndex.includes('DriverLocationMarker'), 'DriverLocationMarker exported');
    });

    test('14. Strict Boundary: ZERO driver-to-customer route, dynamic ETA, or navigation implemented', () => {
      assert.ok(!markerContent.includes('osrm'), 'Driver marker must NOT invoke OSRM');
      assert.ok(!markerContent.includes('turn-by-turn'), 'No turn-by-turn navigation in driver marker');
      assert.ok(!hookContent.includes('driverToCustomerRoute'), 'No driver-to-customer route calculation');
      assert.ok(!hookContent.includes('dynamicEta'), 'No dynamic ETA calculation in transport layer');
    });

    test('15. Strict Boundary: ZERO database schema changes or new tables', () => {
      const schemaJs = fs.readFileSync(path.resolve('server/db/schema.js'), 'utf8');
      assert.ok(!schemaJs.includes('CREATE TABLE IF NOT EXISTS driver_markers'), 'No new tables');
    });

    test('16. BookingModal also integrates DriverLocationMarker cleanly without breaking', () => {
      const bModalContent = fs.readFileSync(path.resolve('src/components/BookingModal.jsx'), 'utf8');
      assert.ok(bModalContent.includes('DriverLocationMarker'), 'BookingModal must import DriverLocationMarker');
      assert.ok(bModalContent.includes('<DriverLocationMarker'), 'BookingModal must render DriverLocationMarker when location is available');
    });
  });
});
