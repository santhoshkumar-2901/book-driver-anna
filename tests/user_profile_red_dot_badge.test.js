import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { 
  isBookingPendingOrConfirmedUnpaid, 
  checkUserHasPendingOrConfirmedBooking 
} from '../src/utils/useUserBookingBadge.js';

// In-memory mock localStorage for Node testing environment
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new MockLocalStorage();

describe('User Profile Red Dot Badge for Active Bookings Suite', () => {
  const testUser = {
    id: 'CLI-849201',
    name: 'Santhosh Kumar',
    phone: '+91 9876543210',
    email: 'santhosh@gmail.com'
  };

  const otherUser = {
    id: 'CLI-739182',
    name: 'Rajesh Hegde',
    phone: '+91 9123456780',
    email: 'rajesh.hegde@outlook.com'
  };

  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  test('1. isBookingPendingOrConfirmedUnpaid returns true ONLY for Pending and Confirmed unpaid bookings', () => {
    const paidSet = new Set(['BDA-PAID-01']);

    // Pending -> true
    assert.strictEqual(
      isBookingPendingOrConfirmedUnpaid({ id: 'BDA-001', status: 'Pending' }, paidSet),
      true,
      'Pending booking must trigger red dot'
    );
    assert.strictEqual(
      isBookingPendingOrConfirmedUnpaid({ id: 'BDA-001B', status: 'PENDING' }, paidSet),
      true,
      'Uppercase PENDING booking must trigger red dot'
    );

    // Confirmed -> true
    assert.strictEqual(
      isBookingPendingOrConfirmedUnpaid({ id: 'BDA-002', status: 'Confirmed' }, paidSet),
      true,
      'Confirmed booking must trigger red dot'
    );
    assert.strictEqual(
      isBookingPendingOrConfirmedUnpaid({ id: 'BDA-002B', status: 'ASSIGNED' }, paidSet),
      true,
      'Assigned booking must trigger red dot'
    );
    assert.strictEqual(
      isBookingPendingOrConfirmedUnpaid({ id: 'BDA-002C', status: 'Accepted & In Training' }, paidSet),
      true,
      'Accepted academy class must trigger red dot'
    );

    // Paid -> MUST DISAPPEAR (false)
    assert.strictEqual(
      isBookingPendingOrConfirmedUnpaid({ id: 'BDA-PAID-01', status: 'Confirmed' }, paidSet),
      false,
      'Booking in paidSet must NOT trigger red dot (red dot disappears after paid)'
    );
    assert.strictEqual(
      isBookingPendingOrConfirmedUnpaid({ id: 'BDA-003', status: 'Confirmed', isPaid: true }, paidSet),
      false,
      'Booking with isPaid: true must NOT trigger red dot'
    );
    assert.strictEqual(
      isBookingPendingOrConfirmedUnpaid({ id: 'BDA-004', status: 'Confirmed', paymentStatus: 'PAID' }, paidSet),
      false,
      'Booking with paymentStatus: PAID must NOT trigger red dot'
    );

    // Completed -> MUST DISAPPEAR (false)
    assert.strictEqual(
      isBookingPendingOrConfirmedUnpaid({ id: 'BDA-005', status: 'Completed' }, paidSet),
      false,
      'Completed booking must NOT trigger red dot'
    );

    // Cancelled -> MUST NOT SHOW (false)
    assert.strictEqual(
      isBookingPendingOrConfirmedUnpaid({ id: 'BDA-006', status: 'Cancelled' }, paidSet),
      false,
      'Cancelled booking must NOT trigger red dot'
    );

    // Rejected -> MUST NOT SHOW (false)
    assert.strictEqual(
      isBookingPendingOrConfirmedUnpaid({ id: 'BDA-007', status: 'Rejected' }, paidSet),
      false,
      'Rejected booking must NOT trigger red dot'
    );
  });

  test('2. Unauthenticated user has NO red dot badge', () => {
    globalThis.localStorage.setItem('bda_driver_bookings', JSON.stringify([
      { id: 'BDA-001', userId: 'CLI-TEST-1001', status: 'Pending' }
    ]));

    assert.strictEqual(
      checkUserHasPendingOrConfirmedBooking(null),
      false,
      'No user should return false'
    );
  });

  test('3. User with no bookings has NO red dot badge', () => {
    assert.strictEqual(
      checkUserHasPendingOrConfirmedBooking(testUser),
      false,
      'User with no bookings must not show red dot'
    );
  });

  test('4. Driver booking booked by user: Red dot appears on Pending, remains on Confirmed, and disappears after paid', () => {
    const booking = {
      id: 'BDA-DRV-101',
      userId: testUser.id,
      phone: testUser.phone,
      customerEmail: testUser.email,
      status: 'Pending'
    };

    // Step 1: Booked -> Pending -> Red dot SHOWS
    globalThis.localStorage.setItem('bda_driver_bookings', JSON.stringify([booking]));
    assert.strictEqual(
      checkUserHasPendingOrConfirmedBooking(testUser),
      true,
      'Red dot must appear when driver booking is pending'
    );

    // Step 2: Admin/System Confirms -> Confirmed -> Red dot STILL SHOWS
    booking.status = 'Confirmed';
    globalThis.localStorage.setItem('bda_driver_bookings', JSON.stringify([booking]));
    assert.strictEqual(
      checkUserHasPendingOrConfirmedBooking(testUser),
      true,
      'Red dot must remain when booking is confirmed'
    );

    // Step 3: User pays -> Added to bda_paid_bookings -> Red dot DISAPPEARS
    globalThis.localStorage.setItem('bda_paid_bookings', JSON.stringify(['BDA-DRV-101']));
    assert.strictEqual(
      checkUserHasPendingOrConfirmedBooking(testUser),
      false,
      'Red dot must disappear after booking is paid'
    );
  });

  test('5. Vehicle rental booked by user: Red dot appears on Pending/Confirmed and disappears after paid', () => {
    const vehicleBooking = {
      id: 'BDA-VEH-202',
      userId: testUser.id,
      phone: testUser.phone,
      customerEmail: testUser.email,
      status: 'Pending'
    };

    // Pending -> red dot shows
    globalThis.localStorage.setItem('bda_vehicle_bookings', JSON.stringify([vehicleBooking]));
    assert.strictEqual(
      checkUserHasPendingOrConfirmedBooking(testUser),
      true,
      'Red dot must appear when vehicle rental is pending'
    );

    // Confirmed -> red dot shows
    vehicleBooking.status = 'Confirmed';
    globalThis.localStorage.setItem('bda_vehicle_bookings', JSON.stringify([vehicleBooking]));
    assert.strictEqual(
      checkUserHasPendingOrConfirmedBooking(testUser),
      true,
      'Red dot must show when vehicle rental is confirmed'
    );

    // Paid -> red dot disappears
    globalThis.localStorage.setItem('bda_paid_bookings', JSON.stringify(['BDA-VEH-202']));
    assert.strictEqual(
      checkUserHasPendingOrConfirmedBooking(testUser),
      false,
      'Red dot must disappear after vehicle rental is paid'
    );
  });

  test('6. Driving Academy enrollment booked by user: Red dot appears on Pending/Confirmed and disappears after paid', () => {
    const classBooking = {
      enrollmentId: 'BDA-CLS-303',
      userId: testUser.id,
      phone: testUser.phone,
      customerEmail: testUser.email,
      status: 'Pending'
    };

    // Pending -> red dot shows
    globalThis.localStorage.setItem('bda_class_enrollments', JSON.stringify([classBooking]));
    assert.strictEqual(
      checkUserHasPendingOrConfirmedBooking(testUser),
      true,
      'Red dot must appear when driving class is pending'
    );

    // Confirmed / Accepted -> red dot shows
    classBooking.status = 'Accepted & In Training';
    globalThis.localStorage.setItem('bda_class_enrollments', JSON.stringify([classBooking]));
    assert.strictEqual(
      checkUserHasPendingOrConfirmedBooking(testUser),
      true,
      'Red dot must show when driving class is accepted/confirmed'
    );

    // Paid -> red dot disappears
    globalThis.localStorage.setItem('bda_paid_bookings', JSON.stringify(['BDA-CLS-303']));
    assert.strictEqual(
      checkUserHasPendingOrConfirmedBooking(testUser),
      false,
      'Red dot must disappear after driving class is paid'
    );
  });

  test('7. Cross-user isolation: Another user’s pending booking does NOT trigger red dot for test user', () => {
    const othersBooking = {
      id: 'BDA-DRV-999',
      userId: otherUser.id,
      phone: otherUser.phone,
      customerEmail: otherUser.email,
      status: 'Pending'
    };

    globalThis.localStorage.setItem('bda_driver_bookings', JSON.stringify([othersBooking]));

    assert.strictEqual(
      checkUserHasPendingOrConfirmedBooking(testUser),
      false,
      'Another user booking must not trigger red dot for current user'
    );

    assert.strictEqual(
      checkUserHasPendingOrConfirmedBooking(otherUser),
      true,
      'Owner user must get the red dot'
    );
  });

  test('8. Navbar and UserProfileModal contain red dot badge markup and styling', () => {
    const navbarCode = fs.readFileSync(path.resolve('src/components/Navbar.jsx'), 'utf8');
    const userModalCode = fs.readFileSync(path.resolve('src/components/UserProfileModal.jsx'), 'utf8');
    const appCode = fs.readFileSync(path.resolve('src/App.jsx'), 'utf8');

    // Navbar imports useUserBookingBadge
    assert.match(navbarCode, /useUserBookingBadge/, 'Navbar must import or use useUserBookingBadge');
    assert.match(navbarCode, /data-testid="profile-booking-dot"/, 'Navbar must include testid for desktop red dot badge');
    assert.match(navbarCode, /data-testid="mobile-profile-booking-dot"/, 'Navbar must include testid for mobile red dot badge');
    assert.match(navbarCode, /bg-red-500/, 'Navbar red dot must use vibrant red styling');
    assert.match(navbarCode, /rounded-full/, 'Navbar red dot must be circular');

    // UserProfileModal contains red dot on avatar and My Bookings tab
    assert.match(userModalCode, /data-testid="modal-profile-booking-dot"/, 'UserProfileModal must include red dot on modal profile avatar');
    assert.match(userModalCode, /data-testid="modal-bookings-tab-dot"/, 'UserProfileModal must include red dot on My Bookings tab');

    // App.jsx wires useUserBookingBadge and propagates hasActiveBookingBadge
    assert.match(appCode, /useUserBookingBadge\(clientUser\)/, 'App.jsx must invoke useUserBookingBadge hook');
    assert.match(appCode, /hasActiveBookingBadge={hasActiveBookingBadge}/, 'App.jsx must pass hasActiveBookingBadge to components');
    assert.match(appCode, /bda_payment_completed/, 'App.jsx must dispatch bda_payment_completed on payment success');
  });

  test('9. Confirmed vehicle rental bookings in UserProfileModal provide Pay option and vehicle details', () => {
    const userModalCode = fs.readFileSync(path.resolve('src/components/UserProfileModal.jsx'), 'utf8');

    // Verifies vehicle rental confirmed card is rendered
    assert.match(
      userModalCode,
      /isVehicle\s*&&\s*isConfirmed\s*&&\s*!isCancelled/,
      'UserProfileModal must identify confirmed vehicle rentals'
    );

    // Verifies Pay button is rendered for confirmed vehicle rentals
    assert.match(
      userModalCode,
      /onClick=\{\(\)\s*=>\s*handleOpenPayment\(b\)\}/,
      'UserProfileModal must attach handleOpenPayment to vehicle rental payment button'
    );

    // Verifies Pay button label and Paid status badge
    assert.match(
      userModalCode,
      /<Smartphone[^>]*\/>\s*Pay/,
      'UserProfileModal must provide Pay button with Smartphone icon'
    );
    assert.match(
      userModalCode,
      /<CheckCircle2[^>]*\/>\s*Paid/,
      'UserProfileModal must render Paid badge when vehicle booking is paid'
    );

    // Verifies vehicle details: vehicle registration if assigned, or vehicle title (Confirmed)
    assert.match(
      userModalCode,
      /Vehicle Reg:/,
      'UserProfileModal must display Vehicle Reg if vehicle is assigned'
    );
    assert.match(
      userModalCode,
      /Vehicle Reserved:/,
      'UserProfileModal must display Vehicle Reserved when confirmed'
    );
  });
});

