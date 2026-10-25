import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { registerAdmin, registerCustomer } from '../server/services/authService.js';
import { createBooking } from '../server/services/bookingService.js';
import { normalizeIndianPhone, formatIndianPhone, getUnifiedAdminCustomers } from '../server/services/customerService.js';
import { queryOne, execute } from '../server/db/database.js';
import { ENV } from '../server/config/env.js';

describe('Phase 2 — Admin Customers from Guest Bookings Suite', () => {
  let server, baseUrl;
  let adminToken, customerToken;
  let testAdmin, testRegisteredCustomer;
  let registeredCustPhone;

  const testPassword = 'AdminCustomerTestPass123!';
  const testRunSuffix = Math.floor(10000000 + Math.random() * 90000000).toString();

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // 1. Create Admin
    const adminEmail = `admin_cust_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@bookdriveranna.com`;
    const adminPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const adminRes = await registerAdmin({
      name: 'Admin Anna Test',
      email: adminEmail,
      phone: adminPhone,
      password: testPassword,
      secretKey: ENV.ADMIN_REGISTRATION_SECRET
    });
    testAdmin = adminRes.user;
    adminToken = adminRes.token;

    // 2. Create Registered Customer
    registeredCustPhone = '98' + testRunSuffix;
    const custEmail = `reg_cust_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@example.com`;
    const custRes = await registerCustomer({
      name: 'Registered Ramesh',
      email: custEmail,
      phone: registeredCustPhone,
      password: testPassword
    });
    testRegisteredCustomer = custRes.user;
    customerToken = custRes.token;
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('1. Phone Normalization Helper Unit Tests', () => {
    test('1.1 Normalizes 10-digit number directly', () => {
      assert.equal(normalizeIndianPhone('9876543210'), '9876543210');
    });

    test('1.2 Normalizes +91 prefixed phone with spaces and dashes', () => {
      assert.equal(normalizeIndianPhone('+91 98765 43210'), '9876543210');
      assert.equal(normalizeIndianPhone('+91-98765-43210'), '9876543210');
      assert.equal(normalizeIndianPhone('+919876543210'), '9876543210');
      assert.equal(normalizeIndianPhone('919876543210'), '9876543210');
    });

    test('1.3 Normalizes leading 0 formatted numbers', () => {
      assert.equal(normalizeIndianPhone('09876543210'), '9876543210');
    });

    test('1.4 Rejects invalid, too short, or non-phone strings', () => {
      assert.equal(normalizeIndianPhone(''), null);
      assert.equal(normalizeIndianPhone('12345'), null);
      assert.equal(normalizeIndianPhone('invalid-phone'), null);
      assert.equal(normalizeIndianPhone(null), null);
    });

    test('1.5 Formats Indian phone consistently', () => {
      assert.equal(formatIndianPhone(null, '9876543210'), '+91 9876543210');
      assert.equal(formatIndianPhone('+91 98765 43210', '9876543210'), '+91 98765 43210');
    });
  });

  describe('2. Endpoint Authorization & Security', () => {
    test('2.1 Rejects unauthenticated request with 401', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`);
      assert.equal(res.status, 401);
    });

    test('2.2 Rejects non-admin authenticated request with 403', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${customerToken}` }
      });
      assert.equal(res.status, 403);
    });

    test('2.3 Dedicated /api/admin/customers alias also rejects unauthorized requests', async () => {
      const res = await fetch(`${baseUrl}/api/admin/customers`);
      assert.equal(res.status, 401);
    });

    test('2.4 Admin request succeeds with 200 and returns users & customers arrays', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert(Array.isArray(data.data.users));
      assert(Array.isArray(data.data.customers));
    });
  });

  describe('3. Customer Aggregation & Deduplication Logic', () => {
    test('3.1 Registered customer without bookings remains visible with bookingCount: 0', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      const found = data.data.users.find(u => u.id === testRegisteredCustomer.id);
      assert(found, 'Registered customer must be present');
      assert.equal(found.name, 'Registered Ramesh');
      assert.equal(found.bookingCount, 0);
      assert.equal(found.source, 'registered');
      assert.equal(found.lastBookingDate, null);
    });

    test('3.2 A guest customer appears after making a booking', async () => {
      const guestPhone = '97' + testRunSuffix;
      const guestName = 'Suresh Guest';
      const bookingDate = '2026-11-10';

      const bookingRes = await createBooking({
        customerName: guestName,
        customerPhone: guestPhone,
        customerEmail: 'suresh.guest@example.com',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        date: bookingDate,
        time: '10:00'
      });
      assert(bookingRes.booking.id);

      const res = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      const found = data.data.users.find(u => u.id === `GST-${guestPhone}` || u.phone.replace(/\D/g, '').endsWith(guestPhone));
      assert(found, 'Guest customer must appear in admin users list');
      assert.equal(found.name, guestName);
      assert.equal(found.bookingCount, 1);
      assert.equal(found.source, 'guest');
      assert(found.lastBookingDate);
    });

    test('3.3 Multiple bookings from the same normalized phone number produce one customer with updated bookingCount', async () => {
      const guestPhone = '97' + testRunSuffix; // Same phone as 3.2
      const bookingDate2 = '2026-11-12';

      await createBooking({
        customerName: 'Suresh Kumar G',
        customerPhone: `+91 ${guestPhone}`, // Same phone stored with +91
        customerEmail: 'suresh.guest@example.com',
        bookingCategory: 'vehicle',
        vehicleCategory: 'SUV',
        pickupArea: 'Koramangala',
        dropLocation: 'Mysore Road',
        date: bookingDate2,
        time: '14:00'
      });

      const res = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      const matches = data.data.users.filter(u => u.phone.replace(/\D/g, '').endsWith(guestPhone));
      assert.equal(matches.length, 1, 'Should NOT create duplicate customer records for same phone');
      assert.equal(matches[0].bookingCount, 2, 'Booking count should increment to 2');
    });

    test('3.4 Phone stored with +91 is matched consistently with its equivalent 10-digit number', async () => {
      const phoneDigits = '96' + testRunSuffix;
      
      // Booking 1 with +91 and spaces
      await createBooking({
        customerName: 'Ananya Sharma',
        customerPhone: `+91 ${phoneDigits.slice(0, 5)} ${phoneDigits.slice(5)}`,
        customerEmail: 'ananya@example.com',
        bookingCategory: 'driver',
        driverTripOption: 'round-trip',
        pickupArea: 'HSR Layout',
        dropLocation: 'Electronic City',
        date: '2026-11-15',
        time: '08:00'
      });

      // Booking 2 with raw 10 digits
      await createBooking({
        customerName: 'Ananya Sharma',
        customerPhone: phoneDigits,
        customerEmail: 'ananya@example.com',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'HSR Layout',
        dropLocation: 'Indiranagar',
        date: '2026-11-16',
        time: '18:00'
      });

      const res = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      const matches = data.data.users.filter(u => u.phone.replace(/\D/g, '').endsWith(phoneDigits));
      assert.equal(matches.length, 1, 'Should match +91 and 10-digit formats into a single customer');
      assert.equal(matches[0].bookingCount, 2);
    });

    test('3.5 Different customers with the same name remain separate if phones differ', async () => {
      const sameName = 'Vikram Malhotra';
      const phoneA = '95' + testRunSuffix;
      const phoneB = '94' + testRunSuffix;

      await createBooking({
        customerName: sameName,
        customerPhone: phoneA,
        customerEmail: 'vikram.a@example.com',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Jayanagar',
        dropLocation: 'MG Road',
        date: '2026-11-20',
        time: '09:00'
      });

      await createBooking({
        customerName: sameName,
        customerPhone: phoneB,
        customerEmail: 'vikram.b@example.com',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Malleshwaram',
        dropLocation: 'Hebbal',
        date: '2026-11-21',
        time: '11:00'
      });

      const res = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      const matchA = data.data.users.find(u => u.phone.replace(/\D/g, '').endsWith(phoneA));
      const matchB = data.data.users.find(u => u.phone.replace(/\D/g, '').endsWith(phoneB));

      assert(matchA && matchB, 'Both customers must exist');
      assert.notEqual(matchA.id, matchB.id, 'Customers must have different IDs');
      assert.equal(matchA.bookingCount, 1);
      assert.equal(matchB.bookingCount, 1);
    });

    test('3.6 A registered customer can be matched to guest bookings without duplicating customer', async () => {
      // testRegisteredCustomer has phone registeredCustPhone
      await createBooking({
        customerName: 'Registered Ramesh Booking',
        customerPhone: `+91 ${registeredCustPhone}`,
        customerEmail: 'ramesh.booking@example.com',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Koramangala',
        dropLocation: 'Whitefield',
        date: '2026-11-22',
        time: '12:00'
      });

      const res = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      const matches = data.data.users.filter(u => u.phone.replace(/\D/g, '').endsWith(registeredCustPhone));

      assert.equal(matches.length, 1, 'Should NOT create duplicate record for registered user');
      assert.equal(matches[0].id, testRegisteredCustomer.id, 'Must preserve registered user ID');
      assert.equal(matches[0].source, 'registered');
      assert.equal(matches[0].bookingCount, 1);
    });

    test('3.7 Customers with missing or invalid phone numbers are handled safely without merging', async () => {
      const bkgId1 = `BDA-DRV-INV1-${testRunSuffix}`;
      const bkgId2 = `BDA-DRV-INV2-${testRunSuffix}`;

      await execute(`
        INSERT INTO bookings (
          id, customer_name, customer_phone, service_name, booking_type, trip_type,
          pickup_area, date, time, calculated_fare, status
        ) VALUES 
        (?, 'Invalid Phone User 1', '12345', 'Driver Service', 'driver', 'one-way', 'Indiranagar', '2026-11-25', '10:00', 350, 'CONFIRMED'),
        (?, 'Invalid Phone User 2', '12345', 'Driver Service', 'driver', 'one-way', 'Whitefield', '2026-11-25', '11:00', 450, 'CONFIRMED')
      `, [bkgId1, bkgId2]);

      const res = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      const rec1 = data.data.users.find(u => u.id === `GST-BKG-${bkgId1}`);
      const rec2 = data.data.users.find(u => u.id === `GST-BKG-${bkgId2}`);

      assert(rec1, 'Booking 1 must have an isolated customer record');
      assert(rec2, 'Booking 2 must have an isolated customer record');
      assert.notEqual(rec1.id, rec2.id, 'Invalid phone bookings must NOT merge into a single customer');
    });

    test('3.8 Existing Drivers section endpoint remains unchanged and functional', async () => {
      const res = await fetch(`${baseUrl}/api/admin/drivers`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert(Array.isArray(data.data.drivers));
    });
  });
});
