import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { startTestServer } from './testHelper.js';

describe('Booking Isolation: Demo Users vs New Users', () => {
  let server, baseUrl;
  let existingUserToken;
  let existingBookingId;

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // 1. Create a customer fixture
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Existing Customer Fixture',
        email: `existing_fixture_${Date.now()}@example.com`,
        phone: `+91 ${Math.floor(7000000000 + Math.random() * 2000000000)}`,
        password: 'password123',
        area: 'Indiranagar'
      })
    });
    const regData = await regRes.json();
    existingUserToken = regData.data.token;

    // 2. Create an existing booking fixture for this customer
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${existingUserToken}`
      },
      body: JSON.stringify({
        customerName: 'Existing Customer Fixture',
        customerPhone: '+91 98765 43210',
        customerEmail: 'existing_fixture@example.com',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Kempegowda Intl Airport (BLR T1/T2)',
        date: '2026-10-05',
        time: '06:30 AM'
      })
    });
    const bookData = await bookRes.json();
    existingBookingId = bookData.data.booking.id;
  });

  after(() => {
    server.close();
  });

  test('Demo user login returns exactly the seeded demo bookings', async () => {
    // Query bookings for existing customer
    const bookingsRes = await fetch(`${baseUrl}/api/bookings/my`, {
      headers: { 'Authorization': `Bearer ${existingUserToken}` }
    });
    assert.strictEqual(bookingsRes.status, 200);
    const bookingsData = await bookingsRes.json();
    assert.strictEqual(bookingsData.success, true);
    assert.ok(bookingsData.data.bookings.length >= 1, 'User should have their booking');
    assert.strictEqual(bookingsData.data.bookings[0].id, existingBookingId);
  });

  test('New user registration starts with exactly 0 bookings on default', async () => {
    const freshEmail = `test_new_client_${Date.now()}@example.com`;
    const freshPhone = `+91 ${Math.floor(7000000000 + Math.random() * 2000000000)}`;

    // 1. Sign up as a fresh new user
    const signupRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Brand New Customer',
        email: freshEmail,
        phone: freshPhone,
        password: 'password123',
        area: 'Indiranagar'
      })
    });
    assert.strictEqual(signupRes.status, 201);
    const signupData = await signupRes.json();
    const newToken = signupData.data.token;

    // 2. Query bookings for the fresh new user
    const bookingsRes = await fetch(`${baseUrl}/api/bookings/my`, {
      headers: { 'Authorization': `Bearer ${newToken}` }
    });
    assert.strictEqual(bookingsRes.status, 200);
    const bookingsData = await bookingsRes.json();
    assert.strictEqual(bookingsData.success, true);
    assert.strictEqual(bookingsData.data.bookings.length, 0, 'Freshly registered new user must have 0 bookings');
  });

  test('New user bookings are strictly isolated: placing a booking only shows for that user', async () => {
    const userA_Email = `user_a_${Date.now()}@example.com`;
    const userB_Email = `user_b_${Date.now()}@example.com`;
    const userA_Phone = `+91 ${Math.floor(8000000000 + Math.random() * 1000000000)}`;
    const userB_Phone = `+91 ${Math.floor(9000000000 + Math.random() * 1000000000)}`;

    // Register User A
    const regA = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User A',
        email: userA_Email,
        phone: userA_Phone,
        password: 'password123',
        area: 'Indiranagar'
      })
    });
    const dataA = await regA.json();
    const tokenA = dataA.data.token;

    // Register User B
    const regB = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User B',
        email: userB_Email,
        phone: userB_Phone,
        password: 'password123',
        area: 'Koramangala'
      })
    });
    const dataB = await regB.json();
    const tokenB = dataB.data.token;

    // User A books a driver
    const createRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        customerName: 'User A',
        customerPhone: userA_Phone,
        customerEmail: userA_Email,
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        date: '2026-10-15',
        time: '10:00 AM'
      })
    });
    assert.strictEqual(createRes.status, 201);
    const createdBooking = (await createRes.json()).data.booking;

    // User A sees 1 booking
    const bookingsA = await fetch(`${baseUrl}/api/bookings/my`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const listA = (await bookingsA.json()).data.bookings;
    assert.strictEqual(listA.length, 1);
    assert.strictEqual(listA[0].id, createdBooking.id);

    // User B still sees 0 bookings
    const bookingsB = await fetch(`${baseUrl}/api/bookings/my`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    const listB = (await bookingsB.json()).data.bookings;
    assert.strictEqual(listB.length, 0, 'User B must not see User A bookings or demo bookings');
  });
});
