import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { startTestServer } from './testHelper.js';
import { bootstrapAdmin } from '../server/scripts/bootstrapAdmin.js';

describe('RBAC, Authorization & Ownership Enforcement Tests', () => {
  let server, baseUrl;
  let adminToken;
  let userToken;
  let fixtureBookingId;
  const fixtureCustomerPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // 1. Create a dedicated Admin account via bootstrapAdmin
    const adminEmail = `rbac_admin_${Date.now()}@bookdriveranna.com`;
    const adminPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const adminPassword = 'StrongAdminPass2026!';
    await bootstrapAdmin({
      email: adminEmail,
      password: adminPassword,
      name: 'RBAC Test Admin',
      phone: adminPhone,
      area: 'Indiranagar'
    });

    // Login as Admin
    const adminRes = await fetch(`${baseUrl}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: adminEmail, password: adminPassword })
    });
    const adminData = await adminRes.json();
    adminToken = adminData.data.token;

    // 2. Register Customer Fixture
    const userEmail = `rbac_customer_${Date.now()}@example.com`;
    const userRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'RBAC Customer Fixture',
        email: userEmail,
        phone: fixtureCustomerPhone,
        password: 'password123',
        area: 'Indiranagar'
      })
    });
    const userData = await userRes.json();
    userToken = userData.data.token;

    // 3. Create a Booking Fixture for this customer
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        customerName: 'RBAC Customer Fixture',
        customerPhone: fixtureCustomerPhone,
        customerEmail: userEmail,
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Kempegowda Intl Airport (BLR T1/T2)',
        date: '2026-10-12',
        time: '07:30 AM'
      })
    });
    const bookData = await bookRes.json();
    fixtureBookingId = bookData.data.booking.id;
  });

  after(() => {
    server.close();
  });

  test('1. Non-admin user cannot access Admin metrics (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'FORBIDDEN');
  });

  test('2. Unauthenticated request to Admin endpoints returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/admin/bookings`);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'UNAUTHORIZED');
  });

  test('3. Authenticated Admin can access Admin metrics and bookings (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(typeof data.data.totalBookings === 'number');
    assert.ok(typeof data.data.totalCustomers === 'number');
    assert.ok(typeof data.data.totalDrivers === 'number');
  });

  test('4. Booking Lookup Defense: Rejects lookup when Phone number does not match Booking ID', async () => {
    const res = await fetch(`${baseUrl}/api/bookings/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: fixtureBookingId,
        phone: '+91 91111 22222' // Wrong phone!
      })
    });

    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'BOOKING_NOT_FOUND');
  });

  test('5. Valid Booking Lookup requires matching Booking ID and registered Phone', async () => {
    const res = await fetch(`${baseUrl}/api/bookings/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: fixtureBookingId,
        phone: fixtureCustomerPhone // Matching phone
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.booking.id, fixtureBookingId);
  });

  test('6. Newly registered user has 0 bookings on default (isolation from demo bookings)', async () => {
    // Register a fresh customer
    const newEmail = `brand_new_user_${Date.now()}@example.com`;
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Brand New User',
        email: newEmail,
        phone: `+91 ${Math.floor(6000000000 + Math.random() * 3000000000)}`,
        password: 'password123',
        area: 'Indiranagar'
      })
    });
    assert.strictEqual(regRes.status, 201);
    const regData = await regRes.json();
    const newUserToken = regData.data.token;

    // Call /api/bookings/my with the newly registered user
    const myBookingsRes = await fetch(`${baseUrl}/api/bookings/my`, {
      headers: { 'Authorization': `Bearer ${newUserToken}` }
    });
    assert.strictEqual(myBookingsRes.status, 200);
    const myBookingsData = await myBookingsRes.json();
    assert.strictEqual(myBookingsData.success, true);
    assert.strictEqual(Array.isArray(myBookingsData.data.bookings), true);
    assert.strictEqual(myBookingsData.data.bookings.length, 0, 'New user must have exactly 0 bookings on default');
  });

  test('7. Demo user has access to seeded demo bookings', async () => {
    // Call /api/bookings/my with userToken for fixture user
    const res = await fetch(`${baseUrl}/api/bookings/my`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.data.bookings.length > 0, 'User should have their booking');
    assert.strictEqual(data.data.bookings[0].id, fixtureBookingId);
  });
});
