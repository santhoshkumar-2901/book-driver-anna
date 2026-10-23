import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const appContent = fs.readFileSync(path.resolve('src/App.jsx'), 'utf8');
const resolveRouteFnCode = appContent
  .match(/export function resolveRoute\([\s\S]*?\n\}/)[0]
  .replace('export function resolveRoute', 'function resolveRoute');
const resolveRoute = new Function(`${resolveRouteFnCode}; return resolveRoute;`)();
import { createBooking } from '../server/services/bookingService.js';
import { queryOne, execute } from '../server/db/database.js';

describe('Phase 1: Guest Booking Foundation & Customer Auth Removal Suite', () => {

  describe('1. Frontend Guest Booking Modal Decoupling', () => {
    test('1.1 BookingModal does not require or intercept customer authentication before submitting', () => {
      const content = fs.readFileSync(path.resolve('src/components/BookingModal.jsx'), 'utf8');
      assert.doesNotMatch(
        content,
        /if\s*\(\s*!clientUser\s*&&\s*onRequireAuth\s*\)/,
        'BookingModal must not intercept unauthenticated customers with an auth check'
      );
      assert.match(
        content,
        /apiClient\.createBooking/,
        'BookingModal must submit directly to apiClient.createBooking'
      );
    });

    test('1.2 DrivingClassEnrollmentModal does not require or prompt customer login before submitting', () => {
      const content = fs.readFileSync(path.resolve('src/components/DrivingClassEnrollmentModal.jsx'), 'utf8');
      assert.doesNotMatch(
        content,
        /if\s*\(\s*!clientUser\s*&&\s*onRequireAuth\s*\)/,
        'DrivingClassEnrollmentModal must not prompt unauthenticated customers to login'
      );
      assert.match(
        content,
        /finalizeEnrollmentSubmit\(enrollmentData\)/,
        'DrivingClassEnrollmentModal must finalize enrollment directly for guest submission'
      );
      assert.match(
        content,
        /bda_class_enrollments/,
        'Driving School enrollment accurately uses browser localStorage (bda_class_enrollments)'
      );
    });

    test('1.3 App.jsx does not render PostBookingAuthPromptModal or maintain pending booking queues', () => {
      const content = fs.readFileSync(path.resolve('src/App.jsx'), 'utf8');
      assert.doesNotMatch(
        content,
        /<PostBookingAuthPromptModal/,
        'App.jsx must not render PostBookingAuthPromptModal'
      );
      assert.doesNotMatch(
        content,
        /pendingBookingSubmission/,
        'App.jsx must not retain pending booking queue state'
      );
      assert.doesNotMatch(
        content,
        /handleRequireAuthForBooking/,
        'App.jsx must not have handleRequireAuthForBooking'
      );
      assert.doesNotMatch(
        content,
        /handleRequireAuthForEnrollment/,
        'App.jsx must not have handleRequireAuthForEnrollment'
      );
    });
  });

  describe('2. Customer Authentication Routes Disabled', () => {
    test('2.1 Direct navigation to /login resolves to not-found', () => {
      const route = resolveRoute('/login');
      assert.strictEqual(route.page, 'not-found', '/login must resolve to not-found');
    });

    test('2.2 Direct navigation to /signup resolves to not-found', () => {
      const route = resolveRoute('/signup');
      assert.strictEqual(route.page, 'not-found', '/signup must resolve to not-found');
    });

    test('2.3 Direct navigation to /client-auth resolves to not-found', () => {
      const route = resolveRoute('/client-auth');
      assert.strictEqual(route.page, 'not-found', '/client-auth must resolve to not-found');
    });

    test('2.4 Direct navigation to /forgot-password resolves to not-found', () => {
      const route = resolveRoute('/forgot-password');
      assert.strictEqual(route.page, 'not-found', '/forgot-password must resolve to not-found');
    });

    test('2.5 Direct navigation to /reset-password resolves to not-found', () => {
      const route = resolveRoute('/reset-password');
      assert.strictEqual(route.page, 'not-found', '/reset-password must resolve to not-found');
    });

    test('2.6 Public navigation routes remain fully functional', () => {
      assert.strictEqual(resolveRoute('/').page, 'home', '/ must resolve to home');
      assert.strictEqual(resolveRoute('/services').page, 'services', '/services must resolve to services');
      assert.strictEqual(resolveRoute('/about').page, 'about', '/about must resolve to about');
      assert.strictEqual(resolveRoute('/contact').page, 'contact', '/contact must resolve to contact');
    });
  });

  describe('3. Admin & Driver Authentication Workflows Preserved', () => {
    test('3.1 Admin route resolves to admin layout', () => {
      const adminRoute = resolveRoute('/admin');
      assert.strictEqual(adminRoute.role, 'admin');
      assert.strictEqual(adminRoute.page, 'admin');
    });

    test('3.2 Driver routes resolve to driver layout and portals', () => {
      const driverLogin = resolveRoute('/driver/login');
      assert.strictEqual(driverLogin.role, 'driver');
      assert.strictEqual(driverLogin.page, 'driver-login');

      const driverSignup = resolveRoute('/driver/signup');
      assert.strictEqual(driverSignup.role, 'driver');
      assert.strictEqual(driverSignup.page, 'driver-signup');

      const driverPortal = resolveRoute('/driver/portal');
      assert.strictEqual(driverPortal.role, 'driver');
      assert.strictEqual(driverPortal.page, 'driver-portal');
    });

    test('3.3 AdminPage return-to-client button navigates to home instead of retired client login', () => {
      const content = fs.readFileSync(path.resolve('src/App.jsx'), 'utf8');
      assert.match(
        content,
        /onReturnToClient=\{.*changePage\('home'\).*\}/,
        'Admin page return action must safely redirect to home'
      );
    });
  });

  describe('4. Backend Unauthenticated Guest Booking Execution', () => {
    const today = new Date().toISOString().split('T')[0];
    let createdDriverBookingId = null;
    let createdVehicleBookingId = null;

    after(async () => {
      if (createdDriverBookingId) {
        await execute('DELETE FROM bookings WHERE id = ?', [createdDriverBookingId]).catch(() => {});
      }
      if (createdVehicleBookingId) {
        await execute('DELETE FROM bookings WHERE id = ?', [createdVehicleBookingId]).catch(() => {});
      }
    });

    test('4.1 Guest can successfully create a Book a Driver booking without user_id / JWT', async () => {
      const guestDriverPayload = {
        userId: null,
        customerName: 'Guest Driver Customer',
        customerPhone: '9876543210',
        customerEmail: 'guestdriver@example.com',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar 100ft Road',
        dropLocation: 'Koramangala 5th Block',
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        destLat: 12.9352,
        destLng: 77.6245,
        date: today,
        time: '11:00 AM',
        paymentMode: 'cash',
        idempotencyKey: 'phase1-guest-driver-' + Date.now()
      };

      const result = await createBooking(guestDriverPayload);
      assert.ok(result.booking, 'Booking must be created');
      assert.strictEqual(result.booking.user_id, null, 'user_id must be null for guest');
      assert.strictEqual(result.booking.customer_name, 'Guest Driver Customer');
      assert.strictEqual(result.booking.customer_phone, '9876543210');
      assert.strictEqual(result.booking.status, 'PENDING');
      assert.ok(result.booking.calculated_fare >= 150, 'Minimum fare rule of ₹150 applies');
      createdDriverBookingId = result.booking.id;

      // Verify row in database
      const row = await queryOne('SELECT * FROM bookings WHERE id = ?', [createdDriverBookingId]);
      assert.ok(row, 'Row must exist in database');
      assert.strictEqual(row.user_id, null, 'Database column user_id must be NULL');
      assert.strictEqual(row.customer_phone, '9876543210');
    });

    test('4.2 Guest can successfully create a Rental Car booking without user_id / JWT', async () => {
      const guestVehiclePayload = {
        userId: null,
        customerName: 'Guest Vehicle Customer',
        customerPhone: '9845012345',
        customerEmail: 'guestcar@example.com',
        bookingCategory: 'vehicle',
        vehicleCategory: 'Sedan',
        pickupArea: 'Whitefield Main Road',
        dropLocation: 'Kempegowda Intl Airport',
        date: today,
        time: '02:00 PM',
        paymentMode: 'cash',
        idempotencyKey: 'phase1-guest-vehicle-' + Date.now()
      };

      const result = await createBooking(guestVehiclePayload);
      assert.ok(result.booking, 'Vehicle booking must be created');
      assert.strictEqual(result.booking.user_id, null, 'user_id must be null for guest');
      assert.strictEqual(result.booking.customer_name, 'Guest Vehicle Customer');
      assert.strictEqual(result.booking.booking_type, 'vehicle');
      assert.strictEqual(result.booking.status, 'PENDING');
      createdVehicleBookingId = result.booking.id;

      const row = await queryOne('SELECT * FROM bookings WHERE id = ?', [createdVehicleBookingId]);
      assert.ok(row, 'Vehicle booking must exist in database');
      assert.strictEqual(row.user_id, null);
    });

    test('4.3 Idempotency protection prevents duplicate bookings for guest submissions', async () => {
      const sharedKey = 'phase1-guest-idem-' + Date.now();
      const payload = {
        userId: null,
        customerName: 'Duplicate Test Guest',
        customerPhone: '9888877777',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'MG Road',
        dropLocation: 'Airport',
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        destLat: 12.9352,
        destLng: 77.6245,
        date: today,
        time: '05:00 PM',
        idempotencyKey: sharedKey
      };

      const firstAttempt = await createBooking(payload);
      assert.strictEqual(Boolean(firstAttempt.isDuplicate), false);

      const secondAttempt = await createBooking(payload);
      assert.strictEqual(secondAttempt.isDuplicate, true);
      assert.strictEqual(secondAttempt.booking.id, firstAttempt.booking.id);

      // Clean up test booking
      await execute('DELETE FROM bookings WHERE id = ?', [firstAttempt.booking.id]).catch(() => {});
    });

    test('4.4 Invalid coordinates and missing phone remain strictly rejected for guests', async () => {
      await assert.rejects(
        () => createBooking({
          userId: null,
          customerName: 'Invalid Guest',
          customerPhone: '', // Missing
          bookingCategory: 'driver',
          date: today,
          time: '10:00 AM'
        }),
        (err) => err.code === 'INVALID_INPUT',
        'Missing phone must be rejected with INVALID_INPUT'
      );

      await assert.rejects(
        () => createBooking({
          userId: null,
          customerName: 'Invalid Coords Guest',
          customerPhone: '9999988888',
          bookingCategory: 'driver',
          pickupLat: 12.97,
          pickupLng: 77.59,
          destLat: 12.97,
          destLng: 77.59, // Identical coordinates
          date: today,
          time: '10:00 AM'
        }),
        (err) => err.code === 'SAME_LOCATION',
        'Identical coordinates must be rejected with SAME_LOCATION'
      );
    });
  });

  describe('5. Impersonation Protection Verification', () => {
    test('5.1 Backend routes derive userId strictly from authenticated JWT, ignoring req.body.userId', () => {
      const routeContent = fs.readFileSync(path.resolve('server/routes/bookings.js'), 'utf8');
      assert.match(
        routeContent,
        /userId:\s*req\.user\s*\?\s*req\.user\.id\s*:\s*null/,
        'Server must only use req.user.id from verified JWT, never req.body.userId'
      );
    });
  });
});
