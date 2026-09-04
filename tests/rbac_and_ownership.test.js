import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { startTestServer } from './testHelper.js';

describe('RBAC, Authorization & Ownership Enforcement Tests', () => {
  let server, baseUrl;
  let adminToken;
  let userToken;

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // Login as Admin
    const adminRes = await fetch(`${baseUrl}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@bookdriveranna.com', password: 'admin123' })
    });
    const adminData = await adminRes.json();
    adminToken = adminData.data.token;

    // Login as Customer
    const userRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'rahul.sharma@example.com', password: 'password123' })
    });
    const userData = await userRes.json();
    userToken = userData.data.token;
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
        bookingId: 'BDA-DRV-9801',
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
        bookingId: 'BDA-DRV-9801',
        phone: '+91 98765 43210' // Matching phone
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.booking.id, 'BDA-DRV-9801');
  });
});
