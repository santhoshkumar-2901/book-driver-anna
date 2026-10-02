import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { startTestServer } from './testHelper.js';
import { execute, queryOne } from '../server/db/database.js';
import { registerDriver, registerCustomer } from '../server/services/authService.js';
import { maskLicenseNumber } from '../server/services/driverProfileService.js';

describe('Driver Profile Section & API Verification Suite', () => {
  let server, baseUrl;

  const testSuffix = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Test Driver A
  const driverAPhone = `+91 9740${testSuffix}`;
  const driverADl = `KA-04-2024-${testSuffix}`;
  const driverAPassword = 'DriverPassA123!';
  const driverAName = 'Ramesh Kumar';
  const driverAEmail = `ramesh_${testSuffix}@driveranna.com`;
  let driverAToken = null;

  // Test Driver B
  const driverBPhone = `+91 9741${testSuffix}`;
  const driverBDl = `KA-05-2025-${testSuffix}`;
  const driverBPassword = 'DriverPassB123!';
  const driverBName = 'Suresh Gowda';
  const driverBEmail = `suresh_${testSuffix}@driveranna.com`;
  let driverBToken = null;

  // Test Customer
  const customerPhone = `+91 9845${testSuffix}`;
  const customerEmail = `customer_${testSuffix}@gmail.com`;
  const customerPassword = 'CustPass123!';
  let customerToken = null;

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // Clean up test data if present
    await execute('DELETE FROM drivers WHERE license_number IN (?, ?)', [driverADl, driverBDl]);
    await execute('DELETE FROM users WHERE email IN (?, ?, ?)', [driverAEmail, driverBEmail, customerEmail]);

    // Register Driver A
    const drvA = await registerDriver({
      name: driverAName,
      phone: driverAPhone,
      dlNumber: driverADl,
      password: driverAPassword,
      email: driverAEmail,
      upiId: 'ramesh@oksbi',
      area: 'Indiranagar'
    });
    driverAToken = drvA.token;

    // Register Driver B
    const drvB = await registerDriver({
      name: driverBName,
      phone: driverBPhone,
      dlNumber: driverBDl,
      password: driverBPassword,
      email: driverBEmail,
      upiId: 'suresh@paytm',
      area: 'Koramangala'
    });
    driverBToken = drvB.token;

    // Register Customer
    const cust = await registerCustomer({
      name: 'Pooja Sharma',
      email: customerEmail,
      phone: customerPhone,
      password: customerPassword,
      area: 'Indiranagar'
    });
    customerToken = cust.token;
  });

  after(async () => {
    server.close();
    await execute('DELETE FROM drivers WHERE license_number IN (?, ?)', [driverADl, driverBDl]);
    await execute('DELETE FROM users WHERE email IN (?, ?, ?)', [driverAEmail, driverBEmail, customerEmail]);
  });

  // =========================================================================
  // 1. AUTHENTICATION REQUIREMENTS
  // =========================================================================
  describe('1. Authentication Gating for Driver Profile', () => {
    test('1.1 Unauthenticated GET /api/drivers/me returns HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/me`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'UNAUTHORIZED');
    });

    test('1.2 Unauthenticated PUT /api/drivers/me returns HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hacker Name' })
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'UNAUTHORIZED');
    });
  });

  // =========================================================================
  // 2. AUTHORIZATION & ROLE RESTRICTIONS
  // =========================================================================
  describe('2. Authorization & Cross-Role Isolation', () => {
    test('2.1 Customer cannot access GET /api/drivers/me (returns HTTP 403)', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/me`, {
        headers: { Authorization: `Bearer ${customerToken}` }
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('2.2 Customer cannot access PUT /api/drivers/me (returns HTTP 403)', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/me`, {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${customerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: 'Sneaky Customer' })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('2.3 Driver retrieves their own profile strictly from token (ignores spoofed query / body)', async () => {
      // Driver A attempts to send driver B's details in query/body
      const res = await fetch(`${baseUrl}/api/drivers/me?driverId=DRV-FAKE-B`, {
        headers: { Authorization: `Bearer ${driverAToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.profile.name, driverAName);
      assert.strictEqual(data.data.profile.email, driverAEmail.toLowerCase());
      assert.strictEqual(data.data.profile.licenseNumber, driverADl);
    });
  });

  // =========================================================================
  // 3. SENSITIVE DATA SECURITY & MASKING
  // =========================================================================
  describe('3. Sensitive Data Protection & License Masking', () => {
    test('3.1 License number is properly masked in profile output', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/me`, {
        headers: { Authorization: `Bearer ${driverAToken}` }
      });
      const data = await res.json();
      const profile = data.data.profile;
      
      assert.ok(profile.maskedLicenseNumber, 'Masked license should exist');
      assert.ok(profile.maskedLicenseNumber.includes('XXXX') || profile.maskedLicenseNumber.includes('...'), 'License middle digits should be masked');
      assert.strictEqual(profile.maskedLicenseNumber.slice(-4), driverADl.slice(-4));
    });

    test('3.2 Utility maskLicenseNumber correctly formats standard and dash-separated DLs', () => {
      assert.strictEqual(maskLicenseNumber('KA-04-2021-0098745'), 'KA-04-XXXX-8745');
      assert.strictEqual(maskLicenseNumber('KA0420210098745'), 'KA04-XXXX-8745');
      assert.strictEqual(maskLicenseNumber(''), '');
    });

    test('3.3 API response NEVER exposes password_hash, tokens, reset tokens, or secrets', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/me`, {
        headers: { Authorization: `Bearer ${driverAToken}` }
      });
      const data = await res.json();
      const p = data.data.profile;

      assert.strictEqual(p.password_hash, undefined);
      assert.strictEqual(p.passwordHash, undefined);
      assert.strictEqual(p.password, undefined);
      assert.strictEqual(p.token_hash, undefined);
      assert.strictEqual(p.reset_token, undefined);
      assert.strictEqual(p.current_latitude, undefined);
      assert.strictEqual(p.current_longitude, undefined);
    });
  });

  // =========================================================================
  // 4. PROFILE UPDATE VALIDATION
  // =========================================================================
  describe('4. Profile Update Validation & Error Handling', () => {
    test('4.1 Rejects empty or too short name with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/me`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${driverAToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: 'A' })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_INPUT');
    });

    test('4.2 Rejects invalid Indian phone number with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/me`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${driverAToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone: '12345' })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_INPUT');
    });

    test('4.3 Rejects invalid email address with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/me`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${driverAToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: 'not-an-email' })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_INPUT');
    });

    test('4.4 Rejects duplicate phone already registered to another user with HTTP 409', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/me`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${driverAToken}`,
          'Content-Type': 'application/json'
        },
        // Try to update Driver A's phone to Driver B's phone
        body: JSON.stringify({ phone: driverBPhone })
      });
      assert.strictEqual(res.status, 409);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'PHONE_ALREADY_EXISTS');
    });

    test('4.5 Rejects duplicate email already registered to another user with HTTP 409', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/me`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${driverAToken}`,
          'Content-Type': 'application/json'
        },
        // Try to update Driver A's email to Driver B's email
        body: JSON.stringify({ email: driverBEmail })
      });
      assert.strictEqual(res.status, 409);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'EMAIL_ALREADY_EXISTS');
    });

    test('4.6 Rejects invalid UPI ID format with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/me`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${driverAToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ upiId: 'invalid-upi-handle' })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_INPUT');
    });
  });

  // =========================================================================
  // 5. IMMUTABILITY OF ADMIN & SYSTEM FIELDS
  // =========================================================================
  describe('5. Immutability of Admin-Controlled & Security Fields', () => {
    test('5.1 Driver cannot modify role, status, license_number, rating, or trips', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/me`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${driverAToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Ramesh K Updated',
          role: 'admin',
          status: 'Suspended',
          license_number: 'KA-01-FAKE-999999',
          licenseNumber: 'KA-01-FAKE-999999',
          rating: 10.0,
          tripsCompleted: 99999,
          trips_completed: 99999
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      
      const p = data.data.profile;
      assert.strictEqual(p.name, 'Ramesh K Updated');
      assert.strictEqual(p.role, 'driver', 'Role must remain driver');
      assert.strictEqual(p.status, 'Active', 'Status must remain Active');
      assert.strictEqual(p.licenseNumber, driverADl, 'License number must remain original');
      assert.ok(p.rating <= 5.0, 'Rating must remain <= 5.0');
      assert.strictEqual(p.tripsCompleted, 0, 'Trips completed must remain 0');

      // Verify in DB directly
      const userDb = await queryOne('SELECT role, status FROM users WHERE email = ?', [driverAEmail.toLowerCase()]);
      assert.strictEqual(userDb.role, 'driver');
      assert.strictEqual(userDb.status, 'Active');

      const driverDb = await queryOne('SELECT license_number, status, trips_completed FROM drivers WHERE user_id = (SELECT id FROM users WHERE email = ?)', [driverAEmail.toLowerCase()]);
      assert.strictEqual(driverDb.license_number, driverADl);
      assert.strictEqual(driverDb.status, 'Active');
      assert.strictEqual(driverDb.trips_completed, 0);
    });
  });

  // =========================================================================
  // 6. SUCCESSFUL EDIT & MULTI-TABLE SYNCHRONIZATION
  // =========================================================================
  describe('6. Successful Profile Updates & Cross-Table Synchronization', () => {
    test('6.1 Driver updates personal details, hub area, and UPI successfully', async () => {
      const newPhoneRaw = `9743${testSuffix}`;
      const newPhoneFormatted = `+91 ${newPhoneRaw}`;
      const newEmail = `ramesh_updated_${testSuffix}@driveranna.com`;
      const newUpi = 'ramesh.updated@okaxis';
      const newHub = 'Whitefield';

      const res = await fetch(`${baseUrl}/api/drivers/me`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${driverAToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Ramesh Anna',
          phone: newPhoneRaw,
          email: newEmail,
          hubArea: newHub,
          upiId: newUpi
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data.token, 'Should return refreshed token with new claims');

      const p = data.data.profile;
      assert.strictEqual(p.name, 'Ramesh Anna');
      assert.strictEqual(p.phone, newPhoneFormatted);
      assert.strictEqual(p.email, newEmail.toLowerCase());
      assert.strictEqual(p.hubArea, newHub);
      assert.strictEqual(p.upiId, newUpi);

      // Verify in database both users and drivers tables were updated
      const user = await queryOne('SELECT id, name, phone, email, area FROM users WHERE email = ?', [newEmail.toLowerCase()]);
      assert.ok(user, 'User should be found with updated email');
      assert.strictEqual(user.name, 'Ramesh Anna');
      assert.strictEqual(user.phone, newPhoneFormatted);
      assert.strictEqual(user.area, newHub);

      const driver = await queryOne('SELECT name, phone, hub_area, upi_id FROM drivers WHERE user_id = ?', [user.id]);
      assert.strictEqual(driver.name, 'Ramesh Anna');
      assert.strictEqual(driver.phone, newPhoneFormatted);
      assert.strictEqual(driver.hub_area, newHub);
      assert.strictEqual(driver.upi_id, newUpi);

      // Update driverAToken for subsequent requests
      driverAToken = data.data.token;
    });

    test('6.2 Fetching GET /api/drivers/me returns the freshly updated data', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/me`, {
        headers: { Authorization: `Bearer ${driverAToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.profile.name, 'Ramesh Anna');
      assert.strictEqual(data.data.profile.hubArea, 'Whitefield');
      assert.strictEqual(data.data.profile.upiId, 'ramesh.updated@okaxis');
    });
  });
});
