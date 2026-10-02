import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 21: Mobile UX Hardening Suite', () => {
  const indexHtmlPath = path.resolve('index.html');
  const bookingModalPath = path.resolve('src/components/BookingModal.jsx');
  const dateInputPath = path.resolve('src/components/DateInput.jsx');
  const bookingSuccessPath = path.resolve('src/components/BookingSuccessModal.jsx');
  const locationSearchPath = path.resolve('src/components/map/LocationSearch.jsx');
  const mapViewPath = path.resolve('src/components/map/MapView.jsx');
  const driverPortalPath = path.resolve('src/pages/DriverPortalPage.jsx');
  const adminOperationalMapPath = path.resolve('src/pages/admin/AdminOperationalMapTab.jsx');
  const navbarPath = path.resolve('src/components/Navbar.jsx');
  const clientAuthPath = path.resolve('src/pages/ClientAuthPage.jsx');
  const driverAuthPath = path.resolve('src/pages/DriverAuthPage.jsx');
  const cancelBookingPath = path.resolve('src/components/CancelBookingModal.jsx');
  const drivingClassPath = path.resolve('src/components/DrivingClassEnrollmentModal.jsx');
  const ridePaymentPath = path.resolve('src/components/RidePaymentModal.jsx');

  // =========================================================================
  // 1. HTML Viewport & Viewport Overflow Protection
  // =========================================================================
  test('1. index.html configures viewport-fit=cover and width=device-width', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    assert.match(content, /viewport-fit=cover/, 'Meta viewport must specify viewport-fit=cover for notch/home-indicator safety');
    assert.match(content, /width=device-width/, 'Meta viewport must set width=device-width');
    assert.match(content, /initial-scale=1\.0/, 'Meta viewport must set initial-scale=1.0');
  });

  test('2. index.html applies max-w-full and overflow containment to body', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    assert.match(content, /max-w-full/, 'Body must have max-w-full');
    assert.match(content, /overflow-x-clip|overflow-x-hidden/, 'Body must prevent horizontal overflow bleed');
  });

  // =========================================================================
  // 2. Customer Booking Flow Forms & Keyboards (BookingModal & DateInput)
  // =========================================================================
  test('3. BookingModal phone input specifies inputMode="tel" and autoComplete="tel"', () => {
    const content = fs.readFileSync(bookingModalPath, 'utf8');
    assert.match(content, /inputMode="tel"/, 'Phone input must specify inputMode="tel" for mobile numeric dialer');
    assert.match(content, /autoComplete="tel"/, 'Phone input must specify autoComplete="tel"');
  });

  test('4. BookingModal passenger and luggage counts specify inputMode="numeric"', () => {
    const content = fs.readFileSync(bookingModalPath, 'utf8');
    assert.match(content, /setPassengerCount[\s\S]*?inputMode="numeric"/, 'Passenger count must specify inputMode="numeric"');
    assert.match(content, /setLuggageCount[\s\S]*?inputMode="numeric"/, 'Luggage count must specify inputMode="numeric"');
  });

  test('5. DateInput specifies inputMode="numeric" for mobile numeric date typing', () => {
    const content = fs.readFileSync(dateInputPath, 'utf8');
    assert.match(content, /inputMode="numeric"/, 'DateInput must specify inputMode="numeric" for mobile keyboards');
  });

  test('6. DateInput calendar trigger button provides accessible touch target and aria-label', () => {
    const content = fs.readFileSync(dateInputPath, 'utf8');
    assert.match(content, /min-w-\[40px\]|min-h-\[40px\]/, 'Calendar trigger must have comfortable touch target');
    assert.match(content, /aria-label="Choose date from calendar"/, 'Calendar trigger must have descriptive aria-label');
  });

  test('7. BookingModal close button has minimum 44px touch target and aria-label', () => {
    const content = fs.readFileSync(bookingModalPath, 'utf8');
    assert.match(content, /min-h-\[44px\]\s+min-w-\[44px\]/, 'Modal close button must satisfy WCAG 44x44px touch target');
    assert.match(content, /aria-label="Close booking modal"/, 'Modal close button must have descriptive aria-label');
    assert.match(content, /touch-manipulation/, 'Close button should disable double-tap delay via touch-manipulation');
  });

  test('8. BookingModal submit button specifies minimum 48px touch height and responsive text', () => {
    const content = fs.readFileSync(bookingModalPath, 'utf8');
    assert.match(content, /min-h-\[48px\]/, 'Submit button must have min-h-[48px] for effortless thumb tapping');
    assert.match(content, /text-sm sm:text-base/, 'Submit button text must scale down gracefully on 360px viewports');
  });

  test('9. BookingModal One Way location header uses flex-wrap to prevent 360px overflow', () => {
    const content = fs.readFileSync(bookingModalPath, 'utf8');
    assert.match(content, /flex flex-wrap items-center justify-between gap-2/, 'One Way header must wrap on narrow screens');
  });

  test('10. BookingModal Outstation package header uses flex-wrap to prevent text clipping', () => {
    const content = fs.readFileSync(bookingModalPath, 'utf8');
    assert.match(content, /flex flex-wrap items-center justify-between gap-1/, 'Outstation header must wrap cleanly on narrow screens');
  });

  test('11. BookingModal payment method options stack cleanly and enforce min 48px height', () => {
    const content = fs.readFileSync(bookingModalPath, 'utf8');
    assert.match(content, /min-h-\[48px\]/, 'Payment buttons must have min-h-[48px]');
    assert.match(content, /flex flex-col sm:flex-row/, 'Payment buttons must adapt between flex-col and sm:flex-row');
  });

  // =========================================================================
  // 3. Location Search & Leaflet Map Touch UX
  // =========================================================================
  test('12. LocationSearch input specifies inputMode="search" and disables auto-correct', () => {
    const content = fs.readFileSync(locationSearchPath, 'utf8');
    assert.match(content, /inputMode="search"/, 'Location search input must specify inputMode="search"');
    assert.match(content, /autoCorrect="off"/, 'Location search should disable autoCorrect');
    assert.match(content, /autoCapitalize="none"/, 'Location search should disable autoCapitalize');
    assert.match(content, /spellCheck="false"/, 'Location search should disable spellCheck');
  });

  test('13. LocationSearch clear button has touch-accessible sizing and aria-label', () => {
    const content = fs.readFileSync(locationSearchPath, 'utf8');
    assert.match(content, /min-w-\[38px\]\s+min-h-\[38px\]/, 'Clear button must have touch target sizing');
    assert.match(content, /aria-label="Clear location search"/, 'Clear button must have aria-label');
  });

  test('14. LocationSearch dropdown items specify minimum 44px touch height and touch-manipulation', () => {
    const content = fs.readFileSync(locationSearchPath, 'utf8');
    assert.match(content, /min-h-\[44px\]/, 'Search dropdown items must have min-h-[44px] for easy thumb tap');
    assert.match(content, /touch-manipulation/, 'Search dropdown items should specify touch-manipulation');
  });

  test('15. MapView provides region role and accessible region label', () => {
    const content = fs.readFileSync(mapViewPath, 'utf8');
    assert.match(content, /role="region"/, 'MapView must designate role="region"');
    assert.match(content, /aria-label=\{ariaLabel\}/, 'MapView must provide aria-label for assistive tech');
  });

  // =========================================================================
  // 4. Booking Confirmation & Tracking Modal UX
  // =========================================================================
  test('16. BookingSuccessModal close button has minimum 44px touch target and aria-label', () => {
    const content = fs.readFileSync(bookingSuccessPath, 'utf8');
    assert.match(content, /min-h-\[44px\]\s+min-w-\[44px\]/, 'Success modal close button must have 44x44px touch target');
    assert.match(content, /aria-label="Close booking confirmation modal"/, 'Success modal close button must have descriptive aria-label');
  });

  test('17. BookingSuccessModal banner title scales down on mobile viewports', () => {
    const content = fs.readFileSync(bookingSuccessPath, 'utf8');
    assert.match(content, /text-xl sm:text-2xl/, 'Banner heading must scale to text-xl on mobile');
    assert.match(content, /break-all/, 'Booking ID must specify break-all to prevent horizontal card stretching');
  });

  test('18. BookingSuccessModal driver call button has minimum 44px touch target', () => {
    const content = fs.readFileSync(bookingSuccessPath, 'utf8');
    assert.match(content, /min-h-\[44px\]\s+min-w-\[70px\]/, 'Call button must have minimum 44px height');
  });

  test('19. BookingSuccessModal action buttons provide minimum 44px touch targets', () => {
    const content = fs.readFileSync(bookingSuccessPath, 'utf8');
    assert.match(content, /min-h-\[44px\][\s\S]*?Copy Trip Ticket|Copy Trip Ticket[\s\S]*?min-h-\[44px\]/, 'Copy pass button must have min-h-[44px]');
    assert.match(content, /min-h-\[44px\][\s\S]*?Done & Return Home|Done & Return Home[\s\S]*?min-h-\[44px\]/, 'Done button must have min-h-[44px]');
  });

  // =========================================================================
  // 5. Driver Portal Mobile Experience
  // =========================================================================
  test('20. DriverPortalPage header controls specify touch-friendly heights and aria-labels', () => {
    const content = fs.readFileSync(driverPortalPath, 'utf8');
    assert.match(content, /toggleTracking[\s\S]*?min-h-\[40px\] sm:min-h-\[44px\]/, 'GPS toggle button must have touch height');
    assert.match(content, /handleToggleOnline[\s\S]*?min-h-\[40px\] sm:min-h-\[44px\]/, 'Online duty toggle must have touch height');
    assert.match(content, /aria-label="Driver Sign Out"/, 'Sign out button must have accessible aria-label');
    assert.match(content, /min-h-\[40px\] sm:min-h-\[44px\] min-w-\[40px\] sm:min-w-\[44px\]/, 'Sign out button must have touch target dimensions');
  });

  test('21. DriverPortalPage duty action buttons enforce minimum 44px touch target height', () => {
    const content = fs.readFileSync(driverPortalPath, 'utf8');
    assert.match(content, /Call Customer[\s\S]*?min-h-\[44px\]/, 'Call Customer button must have min-h-[44px]');
    assert.match(content, /End Ride & Settle Fare[\s\S]*?min-h-\[44px\]/, 'End Ride button must have min-h-[44px]');
    assert.match(content, /Start Trip \(Run Meter\)[\s\S]*?min-h-\[44px\]/, 'Start Trip button must have min-h-[44px]');
    assert.match(content, /Mark Arrived[\s\S]*?min-h-\[44px\]/, 'Mark Arrived button must have min-h-[44px]');
    assert.match(content, /Accept Duty \(Anna\)[\s\S]*?min-h-\[44px\]/, 'Accept Duty button must have min-h-[44px]');
  });

  test('22. DriverPortalPage settlement dialog buttons specify minimum 44px touch height', () => {
    const content = fs.readFileSync(driverPortalPath, 'utf8');
    assert.match(content, /setSettlementTrip\(null\)[\s\S]*?min-h-\[44px\]/, 'Settlement cancel button must have min-h-[44px]');
    assert.match(content, /confirm-settlement-btn[\s\S]*?min-h-\[44px\]/, 'Settlement confirm button must have min-h-[44px]');
  });

  // =========================================================================
  // 6. Admin Operational Map Responsive Architecture
  // =========================================================================
  test('23. AdminOperationalMapTab map container uses responsive viewport height', () => {
    const content = fs.readFileSync(adminOperationalMapPath, 'utf8');
    assert.match(content, /height="min\(55vh,\s*620px\)"/, 'Map container must scale responsively using min(55vh, 620px)');
  });

  test('24. AdminOperationalMapTab sidebar scales responsively between mobile and desktop', () => {
    const content = fs.readFileSync(adminOperationalMapPath, 'utf8');
    assert.match(content, /h-\[380px\] sm:h-\[450px\] lg:h-\[620px\]/, 'Sidebar list must adapt height for mobile/tablet screens');
  });

  test('25. AdminOperationalMapTab legend overlay prevents overflow on 360px-412px viewports', () => {
    const content = fs.readFileSync(adminOperationalMapPath, 'utf8');
    assert.match(content, /max-w-\[calc\(100%-1\.5rem\)\]/, 'Legend overlay must constrain width to prevent viewport overflow');
    assert.match(content, /flex flex-wrap items-center/, 'Legend overlay items must wrap flex items cleanly');
  });

  // =========================================================================
  // 7. InputMode & Keyboard Hardening Across Secondary Modals & Pages
  // =========================================================================
  test('26. ClientAuthPage and DriverAuthPage specify inputMode="tel" on registration phone fields', () => {
    const clientContent = fs.readFileSync(clientAuthPath, 'utf8');
    assert.match(clientContent, /inputMode="tel"[\s\S]*?bda_client_reg_phone|bda_client_reg_phone[\s\S]*?inputMode="tel"/, 'Client registration phone must specify inputMode="tel"');

    const driverContent = fs.readFileSync(driverAuthPath, 'utf8');
    assert.match(driverContent, /inputMode="tel"[\s\S]*?bda_drv_reg_phone|bda_drv_reg_phone[\s\S]*?inputMode="tel"/, 'Driver registration phone must specify inputMode="tel"');
  });

  test('27. CancelBookingModal and DrivingClassEnrollmentModal specify inputMode="tel"', () => {
    const cancelContent = fs.readFileSync(cancelBookingPath, 'utf8');
    assert.match(cancelContent, /phoneInput[\s\S]*?inputMode="tel"/, 'Cancel booking phone input must specify inputMode="tel"');

    const classContent = fs.readFileSync(drivingClassPath, 'utf8');
    assert.match(classContent, /mobileNumber[\s\S]*?inputMode="tel"/, 'Driving class phone input must specify inputMode="tel"');
  });

  test('28. RidePaymentModal custom tip input specifies inputMode="numeric"', () => {
    const content = fs.readFileSync(ridePaymentPath, 'utf8');
    assert.match(content, /customTip[\s\S]*?inputMode="numeric"/, 'Custom tip input must specify inputMode="numeric"');
  });
});
