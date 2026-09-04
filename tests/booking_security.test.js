import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { startTestServer } from './testHelper.js';
import { db } from '../server/db/database.js';

describe('Booking Security, Integrity, & Concurrency Tests', () => {
  let server, baseUrl;

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;
  });

  after(() => {
    server.close();
  });

  test('1. Client Price Tampering Defense: Server ignores client-supplied price and calculates authoritatively', async () => {
    // Attempt to inject a fake price of 1 Rupee for a 4-hour round trip (official price: 349 + 5% GST = 366)
    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Santhosh Price Test',
        customerPhone: '+91 98765 11111',
        bookingCategory: 'driver',
        driverTripOption: 'round-trip',
        roundTripDuration: '4hr',
        pickupArea: 'Indiranagar',
        date: '2026-11-15',
        time: '10:00 AM',
        totalFare: 1, // Tampered price
        calculated_fare: 1, // Tampered price
        paymentMode: 'cash'
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    
    // Server must compute 349 + 17 = 366
    assert.strictEqual(data.data.booking.calculated_fare, 366, 'Server must enforce authoritative fare calculation');
    
    // Verify in database
    const inDb = db.prepare('SELECT calculated_fare FROM bookings WHERE id = ?').get(data.data.booking.id);
    assert.strictEqual(inDb.calculated_fare, 366);
  });

  test('2. Past Date Rejection: Bookings for past dates are strictly rejected', async () => {
    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Time Traveler',
        customerPhone: '+91 98765 22222',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2020-01-01', // Past date!
        time: '10:00 AM'
      })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'INVALID_DATE');
  });

  test('3. Concurrency & Double Booking Defense: Slot locking prevents simultaneous conflicting bookings', async () => {
    const targetDate = `2027-${String(Math.floor(1 + Math.random() * 12)).padStart(2, '0')}-${String(Math.floor(1 + Math.random() * 28)).padStart(2, '0')}`;
    const targetTime = `11:${String(Math.floor(10 + Math.random() * 49))} AM`;
    const driverId = 'DRV-1001';

    // First booking requests DRV-1001
    const res1 = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'First Customer',
        customerPhone: '+91 98765 33333',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: targetDate,
        time: targetTime,
        preferredDriverId: driverId
      })
    });
    assert.strictEqual(res1.status, 201);

    // Second booking requests the SAME driver for the SAME date and time slot
    const res2 = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Second Conflicting Customer',
        customerPhone: '+91 98765 44444',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: targetDate,
        time: targetTime,
        preferredDriverId: driverId
      })
    });

    // Must be rejected with 409 Conflict
    assert.strictEqual(res2.status, 409);
    const data2 = await res2.json();
    assert.strictEqual(data2.success, false);
    assert.strictEqual(data2.error.code, 'SLOT_UNAVAILABLE');
  });

  test('4. Idempotency Key: Network retries with the same key do not create duplicate bookings', async () => {
    const idempotencyKey = 'idem-test-key-' + Date.now();
    const payload = {
      customerName: 'Idempotency Test User',
      customerPhone: '+91 98765 55555',
      bookingCategory: 'driver',
      driverTripOption: 'one-way',
      date: '2026-11-20',
      time: '02:00 PM',
      idempotencyKey
    };

    // First request
    const res1 = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(res1.status, 201);
    const data1 = await res1.json();
    assert.strictEqual(data1.data.isDuplicate, false);
    const bookingId1 = data1.data.booking.id;

    // Retry request with same idempotency key
    const res2 = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(res2.status, 200);
    const data2 = await res2.json();
    assert.strictEqual(data2.data.isDuplicate, true);
    assert.strictEqual(data2.data.booking.id, bookingId1, 'Must return identical booking without duplicate creation');
  });
});
