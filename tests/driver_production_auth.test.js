import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { startTestServer } from './testHelper.js';
import { ensureProductionDrivers, queryOne } from '../server/db/database.js';

describe('Production Driver Authentication & Fleet Verification Suite', () => {
  let server, baseUrl;

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;
    await ensureProductionDrivers();
  });

  after(() => {
    server.close();
  });

  test('1. Verified production driver fleet is present in active drivers roster', async () => {
    const res = await fetch(`${baseUrl}/api/drivers`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.data.drivers), 'Drivers roster should be an array');
    const manju = data.data.drivers.find(d => d.name === 'Manjunath Gowda');
    assert.ok(manju, 'Manjunath Gowda should exist in drivers roster');
    assert.strictEqual(manju.status, 'Active');
  });

  test('2. Driver can authenticate using 10-digit phone number', async () => {
    const res = await fetch(`${baseUrl}/api/auth/driver-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '9886012345',
        password: 'driver123'
      })
    });

    assert.strictEqual(res.status, 200, 'Should return HTTP 200');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.user.role, 'driver');
    assert.strictEqual(data.data.user.dlNumber, 'KA-04-2021-0098745');
    assert.ok(data.data.token, 'Should return valid JWT token');
  });

  test('3. Driver can authenticate using Driving License (DL) number with dashes', async () => {
    const res = await fetch(`${baseUrl}/api/auth/driver-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'KA-04-2021-0098745',
        password: 'driver123'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.user.name, 'Manjunath Gowda');
  });

  test('4. Driver can authenticate using Driving License (DL) number without dashes', async () => {
    const res = await fetch(`${baseUrl}/api/auth/driver-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'KA0420210098745',
        password: 'driver123'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.user.name, 'Manjunath Gowda');
  });

  test('5. Driver registration creates active account in database and returns token', async () => {
    const testDl = `KA-03-2025-${Math.floor(1000000 + Math.random() * 9000000)}`;
    const testPhone = `9741${Math.floor(100000 + Math.random() * 900000)}`;

    const res = await fetch(`${baseUrl}/api/auth/driver-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Girish Murthy',
        phone: testPhone,
        dlNumber: testDl,
        password: 'driverPassword@2026',
        upiId: 'girish.driver@oksbi',
        area: 'Indiranagar'
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.user.name, 'Girish Murthy');
    assert.strictEqual(data.data.user.role, 'driver');
    assert.strictEqual(data.data.user.dlNumber, testDl);

    // Verify driver can subsequently log in with their DL number
    const loginRes = await fetch(`${baseUrl}/api/auth/driver-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testDl,
        password: 'driverPassword@2026'
      })
    });
    assert.strictEqual(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.strictEqual(loginData.data.user.name, 'Girish Murthy');
  });

  test('6. GET /api/auth/me returns enriched driver profile attributes', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/driver-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '9886012345',
        password: 'driver123'
      })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.token;

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.data.user.role, 'driver');
    assert.strictEqual(meData.data.user.dlNumber, 'KA-04-2021-0098745');
    assert.strictEqual(meData.data.user.upiId, 'manjunath.gowda@oksbi');
    assert.strictEqual(meData.data.user.isOnline, true);
  });

  test('7. Reject driver login with invalid password or non-driver role', async () => {
    const badPwdRes = await fetch(`${baseUrl}/api/auth/driver-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '9886012345',
        password: 'wrongPassword123'
      })
    });
    assert.strictEqual(badPwdRes.status, 401);

    const notFoundRes = await fetch(`${baseUrl}/api/auth/driver-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '9999999999',
        password: 'driver123'
      })
    });
    assert.strictEqual(notFoundRes.status, 401);
  });
});
