import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { 
  isDutyAssignedToDriver, 
  formatDuty, 
  getDriverDuties 
} from '../src/utils/driverDutyHelpers.js';

describe('Phase 5A — Frontend/Backend Source-of-Truth Regression Suite', () => {
  const bookingModalPath = path.resolve('src/components/BookingModal.jsx');
  const driverPortalPath = path.resolve('src/pages/DriverPortalPage.jsx');
  const adminPagePath = path.resolve('src/pages/AdminPage.jsx');
  const adminDriverTabPath = path.resolve('src/pages/admin/AdminDriverTab.jsx');
  const cancelModalPath = path.resolve('src/components/CancelBookingModal.jsx');
  const appPath = path.resolve('src/App.jsx');

  // =========================================================================
  // FIX 1: Booking Creation Must Never Fake Success
  // =========================================================================
  describe('Fix 1 — Booking Creation Authoritative Contract', () => {
    test('1.1 BookingModal no longer generates synthetic BDA-XXXXXX booking ID on submit fallback', () => {
      const content = fs.readFileSync(bookingModalPath, 'utf8');
      assert.doesNotMatch(
        content,
        /bookingId:\s*['"]BDA-['"]\s*\+\s*Math\.floor/,
        'BookingModal must NOT invent random BDA- IDs for client bookings'
      );
      assert.match(
        content,
        /bookingId:\s*null/,
        'BookingModal should initialize bookingDetails.bookingId as null'
      );
    });

    test('1.2 BookingModal createBooking failure stops flow, sets formError, and prevents success modal', () => {
      const content = fs.readFileSync(bookingModalPath, 'utf8');
      assert.doesNotMatch(
        content,
        /console\.warn\(\s*['"]\[BOOKING\] API call fallback:['"]/,
        'BookingModal must not have fallback that catches error and proceeds'
      );
      assert.match(
        content,
        /const serverRes = await apiClient\.createBooking\(payloadForApi\);/,
        'BookingModal must await apiClient.createBooking'
      );
      assert.match(
        content,
        /setFormError\(apiErr\.message\s*\|\|\s*['"]Failed to create booking\. Please try again\.['"]\);/,
        'BookingModal must capture apiErr.message in formError on failure'
      );
      // Ensure onBookingComplete is called ONLY after serverRes.data.booking is confirmed
      const submitBlock = content.slice(content.indexOf('handleSubmitBooking = async'), content.indexOf('return ('));
      assert.match(submitBlock, /if\s*\(!serverRes\?\.data\?\.booking\)\s*\{\s*throw new Error/);
      assert.match(submitBlock, /onBookingComplete\(bookingDetails\);/);
    });

    test('1.3 App.jsx post-auth booking creation rejects failure and refuses to invent booking pass', () => {
      const content = fs.readFileSync(appPath, 'utf8');
      assert.match(
        content,
        /if\s*\(!serverBooking\)\s*\{\s*alert\(['"].*?booking.*?['"]\);\s*return;\s*\}/,
        'App.jsx handleAuthSuccess must fail fast if server booking creation fails'
      );
    });
  });

  // =========================================================================
  // FIX 2: Driver Portal Must Use Authoritative Backend Duties
  // =========================================================================
  describe('Fix 2 — Driver Portal Backend Duties Contract', () => {
    test('2.1 DriverPortalPage calls apiClient.getDriverDuties on load and refresh', () => {
      const content = fs.readFileSync(driverPortalPath, 'utf8');
      assert.match(
        content,
        /apiClient\.getDriverDuties\(\)/,
        'DriverPortalPage must call apiClient.getDriverDuties'
      );
      assert.match(
        content,
        /fetchDuties\(\)/,
        'DriverPortalPage must invoke fetchDuties on mount and sync events'
      );
    });

    test('2.2 driverDutyHelpers supports backend snake_case DB columns and normalizes status', () => {
      const backendRow = {
        id: 'BDA-DRV-101',
        customer_name: 'Suresh Raina',
        customer_phone: '+91 98450 11223',
        customer_email: 'suresh@example.com',
        pickup_area: 'Koramangala',
        drop_location: 'Indiranagar',
        calculated_fare: 499,
        status: 'IN_PROGRESS',
        assigned_driver_id: 'DRV-ANNA-01',
        assigned_driver_name: 'Manjunath Gowda',
        assigned_driver_phone: '+91 98450 12345'
      };

      const driver = { id: 'DRV-ANNA-01', name: 'Manjunath Gowda', phone: '+91 98450 12345' };
      assert.strictEqual(isDutyAssignedToDriver(backendRow, driver), true);

      const duty = formatDuty(backendRow);
      assert.strictEqual(duty.customerName, 'Suresh Raina');
      assert.strictEqual(duty.customerPhone, '+91 98450 11223');
      assert.strictEqual(duty.pickup, 'Koramangala');
      assert.strictEqual(duty.destination, 'Indiranagar');
      assert.strictEqual(duty.payout, '₹499');
      assert.strictEqual(duty.status, 'In Progress');
      assert.strictEqual(duty.assignedDriver, 'Manjunath Gowda');
    });

    test('2.3 Empty backend duties produce empty state in DriverPortalPage', () => {
      const content = fs.readFileSync(driverPortalPath, 'utf8');
      assert.match(
        content,
        /No Duties Assigned Yet/,
        'DriverPortalPage must render empty state when acceptedTrips is empty'
      );
      assert.match(
        content,
        /const \[acceptedTrips, setAcceptedTrips\] = useState\(\[\]\);/,
        'DriverPortalPage should initialize acceptedTrips as empty array before backend loads'
      );
    });
  });

  // =========================================================================
  // FIX 3: Driver Start Trip Must Update Backend
  // =========================================================================
  describe('Fix 3 — Driver Start Trip State Machine Contract', () => {
    test('3.1 handleStartTrip calls apiClient.updateDutyStatus with IN_PROGRESS', () => {
      const content = fs.readFileSync(driverPortalPath, 'utf8');
      assert.match(
        content,
        /apiClient\.updateDutyStatus\(targetBookingId,\s*['"]IN_PROGRESS['"]\)/,
        'handleStartTrip must call apiClient.updateDutyStatus with targetBookingId and IN_PROGRESS'
      );
    });

    test('3.2 handleStartTrip does not mark In Progress on API failure and surfaces error', () => {
      const content = fs.readFileSync(driverPortalPath, 'utf8');
      assert.match(
        content,
        /catch\s*\(err\)\s*\{\s*console\.error\(['"]\[DRIVER PORTAL\] Failed to start trip:['"], err\);/,
        'handleStartTrip must catch error and log error'
      );
      assert.match(
        content,
        /setToastMessage\(`⚠️ Error: \$\{msg\}`\);/,
        'handleStartTrip must display error toast on failure'
      );
    });

    test('3.3 Start Trip button prevents duplicate clicks with disabled and loading state', () => {
      const content = fs.readFileSync(driverPortalPath, 'utf8');
      assert.match(
        content,
        /const \[startingTripId, setStartingTripId\] = useState\(null\);/,
        'DriverPortalPage must track startingTripId'
      );
      assert.match(
        content,
        /disabled=\{startingTripId === \(trip\.bookingId \|\| trip\.id\)\}/,
        'Start Trip button must be disabled when startingTripId is active'
      );
      assert.match(
        content,
        /startingTripId === \(trip\.bookingId \|\| trip\.id\) \? 'Starting Trip\.\.\.' : 'Start Trip \(Run Meter\)'/,
        'Start Trip button must show Starting Trip... while pending'
      );
    });
  });

  // =========================================================================
  // FIX 4: Admin Assignment Must Not Claim Success on API Failure
  // =========================================================================
  describe('Fix 4 — Admin Driver Assignment Backend Authority Contract', () => {
    test('4.1 handleAcceptAndAssignDriver awaits apiClient.updateAdminBooking FIRST before local state updates', () => {
      const content = fs.readFileSync(adminPagePath, 'utf8');
      const assignFn = content.slice(content.indexOf('handleAcceptAndAssignDriver = async'), content.indexOf('sendWhatsAppToClientForDriver ='));
      
      const apiCallIndex = assignFn.indexOf('apiClient.updateAdminBooking');
      const setDriverBookingsIndex = assignFn.indexOf('setDriverBookings(prev =>');
      const broadcastIndex = assignFn.indexOf('broadcastBookingUpdate(');

      assert.ok(apiCallIndex > 0, 'apiClient.updateAdminBooking must be called');
      assert.ok(setDriverBookingsIndex > apiCallIndex, 'setDriverBookings must be called AFTER backend API confirms');
      assert.ok(broadcastIndex > apiCallIndex, 'broadcastBookingUpdate must be called AFTER backend API confirms');
    });

    test('4.2 handleAcceptAndAssignDriver surfaces clear errors for HTTP 409 (slot conflict) and 400', () => {
      const content = fs.readFileSync(adminPagePath, 'utf8');
      assert.match(
        content,
        /err\.status === 409 \|\| err\.code === 'SLOT_UNAVAILABLE'/,
        'handleAcceptAndAssignDriver must handle slot conflicts'
      );
      assert.match(
        content,
        /The selected driver is already booked for this booking slot/,
        'handleAcceptAndAssignDriver must display clear slot conflict message'
      );
      assert.match(
        content,
        /alert\(`⚠️ Assignment Failed: \$\{errorMsg\}`\);/,
        'handleAcceptAndAssignDriver must alert admin on failure'
      );
      assert.match(
        content,
        /return false;/,
        'handleAcceptAndAssignDriver must return false on failure'
      );
    });

    test('4.3 AdminDriverTab disables Accept & Assign button while assignment is in progress', () => {
      const content = fs.readFileSync(adminDriverTabPath, 'utf8');
      assert.match(
        content,
        /assigningBookingId = null/,
        'AdminDriverTab must accept assigningBookingId prop'
      );
      assert.match(
        content,
        /disabled=\{assigningBookingId === b\.id\}/,
        'Accept & Assign button must be disabled when assigningBookingId matches booking'
      );
      assert.match(
        content,
        /assigningBookingId === b\.id \? 'Assigning\.\.\.' : 'Accept & Assign'/,
        'Accept & Assign button must show Assigning... while pending'
      );
    });
  });

  // =========================================================================
  // FIX 5: Cancellation Must Not Claim Success on API Failure
  // =========================================================================
  describe('Fix 5 — Cancellation Backend Authority Contract', () => {
    test('5.1 CancelBookingModal does not swallow API errors with catch(() => {})', () => {
      const content = fs.readFileSync(cancelModalPath, 'utf8');
      assert.doesNotMatch(
        content,
        /apiClient\.cancelBooking\(refId, phone, cancellationReason\)\.catch\(\(\) => \{\}\)/,
        'CancelBookingModal must NOT swallow cancellation errors'
      );
    });

    test('5.2 CancelBookingModal updates local lists ONLY on verified backend success', () => {
      const content = fs.readFileSync(cancelModalPath, 'utf8');
      const cancelFn = content.slice(content.indexOf('handleConfirmCancel = async'), content.indexOf('handleClose ='));

      const apiCallIndex = cancelFn.indexOf('apiClient.cancelBooking(refId, phone, cancellationReason)');
      const setCancelSuccessIndex = cancelFn.indexOf('setCancelSuccess({');
      const localStorageIndex = cancelFn.indexOf('localStorage.setItem(key');

      assert.ok(apiCallIndex > 0, 'apiClient.cancelBooking must be called');
      assert.ok(localStorageIndex > apiCallIndex, 'localStorage must be updated AFTER backend response');
      assert.ok(setCancelSuccessIndex > apiCallIndex, 'setCancelSuccess must be called AFTER backend response');
    });

    test('5.3 CancelBookingModal surfaces clear error for INVALID_STATE_TRANSITION and renders cancelError banner', () => {
      const content = fs.readFileSync(cancelModalPath, 'utf8');
      assert.match(
        content,
        /err\.code === 'INVALID_STATE_TRANSITION'/,
        'CancelBookingModal must inspect INVALID_STATE_TRANSITION error code'
      );
      assert.match(
        content,
        /This booking can no longer be cancelled as it is already in progress, completed, or cancelled\./,
        'CancelBookingModal must inform user that trip cannot be cancelled'
      );
      assert.match(
        content,
        /\{cancelError && \([\s\S]*?<span>\{cancelError\}<\/span>/,
        'CancelBookingModal must render cancelError alert banner in dialog'
      );
    });
  });
});
