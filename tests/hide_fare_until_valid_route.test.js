import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Hide Fare Until Valid Route Calculation Suite', () => {
  const modalPath = path.resolve('src/components/BookingModal.jsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  test('1. No default or fallback ₹314 fare is assigned or displayed when locations are missing', () => {
    // effectiveTotalFare must evaluate to null for driver service before route calculation succeeds
    assert.match(
      modalContent,
      /effectiveTotalFare\s*=\s*\(fareEstimate\s*&&\s*routeData\s*&&\s*typeof authoritativeTotal === 'number'\)\s*\?\s*authoritativeTotal\s*:\s*\(isDriverService\s*\?\s*null\s*:\s*fareInfo\.total\)/,
      'effectiveTotalFare must not fall back to fareInfo.total for driver service'
    );
    assert.match(
      modalContent,
      /effectiveBase\s*=\s*\(fareEstimate\s*&&\s*routeData\s*&&\s*typeof \(fareEstimate\.baseFare \?\? fareEstimate\.basePrice\) === 'number'\)\s*\?\s*\(fareEstimate\.baseFare \?\? fareEstimate\.basePrice\)\s*:\s*\(isDriverService\s*\?\s*null\s*:\s*fareInfo\.base\)/,
      'effectiveBase must not fall back to fareInfo.base for driver service'
    );
    assert.match(
      modalContent,
      /effectiveGst\s*=\s*\(fareEstimate\s*&&\s*routeData\s*&&\s*typeof fareEstimate\.gst === 'number'\)\s*\?\s*fareEstimate\.gst\s*:\s*\(isDriverService\s*\?\s*null\s*:\s*fareInfo\.gst\)/,
      'effectiveGst must not fall back to fareInfo.gst for driver service'
    );
  });

  test('2. Displays clear instructions when pickup or destination locations are not yet selected', () => {
    assert.match(
      modalContent,
      /Select pickup and destination locations above to view route and calculate fare\./,
      'Must display guidance message when both locations are unselected'
    );
    assert.match(
      modalContent,
      /Select pickup location to calculate route and fare\./,
      'Must display guidance when pickup is missing'
    );
    assert.match(
      modalContent,
      /Select destination location to calculate route and fare\./,
      'Must display guidance when destination is missing'
    );
    assert.match(
      modalContent,
      /Select pickup & destination to calculate fare/,
      'Payment option must show instruction when fare is not ready'
    );
  });

  test('3. Shows loading state during route or fare calculation and hides previous fare', () => {
    assert.match(
      modalContent,
      /isFareCalculating\s*=\s*isDriverService\s*&&\s*\(routeLoading\s*\|\|\s*fareLoading\)/,
      'Must track whether route or fare is calculating'
    );
    assert.match(
      modalContent,
      /Calculating fare\.\.\./,
      'Payment option must display calculating fare state'
    );
    assert.match(
      modalContent,
      /Calculating Route & Fare\.\.\.|Calculating Fare\.\.\./,
      'Submit button must display calculating state'
    );
  });

  test('4. Displays distance and fare only after route calculation succeeds and returns valid results', () => {
    assert.match(
      modalContent,
      /isFareReady\s*=\s*isDriverService\s*\?\s*Boolean\(!isFareCalculating\s*&&\s*!hasFareError\s*&&\s*routeData\s*&&\s*fareEstimate\s*&&\s*typeof authoritativeTotal === 'number'\)\s*:\s*true/,
      'isFareReady must verify no calculation in-flight, no error, and valid routeData and fareEstimate'
    );
    assert.match(
      modalContent,
      /Total ₹\{effectiveTotalFare\.toLocaleString\('en-IN'\)\}/,
      'Must render formatted total fare when fare is ready'
    );
  });

  test('5. Keeps fare hidden and shows error if route or fare calculation fails', () => {
    assert.match(
      modalContent,
      /hasFareError\s*=\s*isDriverService\s*&&\s*Boolean\(routeError\s*\|\|\s*fareError\)/,
      'Must detect routeError or fareError'
    );
    assert.match(
      modalContent,
      /\{routeError \|\| fareError \|\| 'Route calculation failed'\}/,
      'Must display route or fare error in payment options when calculation fails'
    );
  });

  test('6. Immediately invalidates previous route and hides fare when location is changed or cleared', () => {
    assert.match(
      modalContent,
      /const handleSelectPickup = \(item\) => \{[\s\S]*?setRouteData\(null\);[\s\S]*?setFareEstimate\(null\);/,
      'handleSelectPickup must immediately clear routeData and fareEstimate'
    );
    assert.match(
      modalContent,
      /const handleSelectDestination = \(item\) => \{[\s\S]*?setRouteData\(null\);[\s\S]*?setFareEstimate\(null\);/,
      'handleSelectDestination must immediately clear routeData and fareEstimate'
    );
    assert.match(
      modalContent,
      /const handleClearPickup = \(\) => \{[\s\S]*?setRouteData\(null\);[\s\S]*?setFareEstimate\(null\);/,
      'handleClearPickup must immediately clear routeData and fareEstimate'
    );
    assert.match(
      modalContent,
      /const handleClearDestination = \(\) => \{[\s\S]*?setRouteData\(null\);[\s\S]*?setFareEstimate\(null\);/,
      'handleClearDestination must immediately clear routeData and fareEstimate'
    );
  });

  test('7. Prevents stale asynchronous responses from updating state via AbortController', () => {
    assert.match(
      modalContent,
      /if \(routeAbortRef\.current === controller\)/,
      'Route response must check controller identity'
    );
    assert.match(
      modalContent,
      /if \(fareAbortRef\.current === controller\)/,
      'Fare response must check controller identity'
    );
    assert.match(
      modalContent,
      /routeAbortRef\.current\.abort\(\)/,
      'Route controller must be aborted on new selection or clearing'
    );
    assert.match(
      modalContent,
      /fareAbortRef\.current\.abort\(\)/,
      'Fare controller must be aborted on new selection or clearing'
    );
  });

  test('8. Prevents booking submission unless both locations, route, and valid fare are resolved', () => {
    assert.match(
      modalContent,
      /if \(!pickupLocation \|\| typeof pickupLocation\.latitude !== 'number' \|\| typeof pickupLocation\.longitude !== 'number'\)/,
      'Must validate pickupLocation coordinates before submission'
    );
    assert.match(
      modalContent,
      /if \(!destinationLocation \|\| typeof destinationLocation\.latitude !== 'number' \|\| typeof destinationLocation\.longitude !== 'number'\)/,
      'Must validate destinationLocation coordinates before submission'
    );
    assert.match(
      modalContent,
      /if \(routeLoading \|\| fareLoading\)/,
      'Must block submission while route or fare is calculating'
    );
    assert.match(
      modalContent,
      /if \(routeError \|\| fareError \|\| !routeData \|\| !fareEstimate \|\| typeof authoritativeTotal !== 'number'\)/,
      'Must block submission if route or fare is not ready or errored'
    );
    assert.match(
      modalContent,
      /disabled=\{isSubmitting \|\| \(isDriverService && \(!isFareReady \|\| isFareCalculating\)\)\}/,
      'Submit button must be disabled when driver fare is not ready or calculating'
    );
  });

  test('9. Preserves vehicle rental and driving school immediate package fares', () => {
    // For non-driver services, isFareReady is true and effectiveTotalFare is fareInfo.total
    assert.match(
      modalContent,
      /: \(isDriverService \? null : fareInfo\.total\)/,
      'Vehicle and class services retain immediate fareInfo total'
    );
    assert.match(
      modalContent,
      /bookingCategory === 'class' \? 'Driving Class Enrollment' : \(bookingCategory === 'vehicle' \? `\$\{vehicleCategory\} Booking` : 'Driver Booking'\)/,
      'Button label preserves vehicle category and driving class enrollments'
    );
  });
});
