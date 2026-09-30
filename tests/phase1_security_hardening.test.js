import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { startTestServer } from './testHelper.js';
import { registerCustomer, registerDriver, registerAdmin, authenticateUser } from '../server/services/authService.js';
import { queryOne, queryAll, execute } from '../server/db/database.js';
import { ENV } from '../server/config/env.js';
import { lockdownLegacyAccounts } from '../server/scripts/lockdownLegacyAccounts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Phase 1 Critical Authentication Hardening Suite', () => {
  let server, baseUrl;

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;
  });

  after(async () => {
    server.close();
    await execute("DELETE FROM drivers WHERE id IN ('DRV-1001', 'DRV-1002', 'DRV-1003') OR id LIKE 'DRV-%'");
    await execute("DELETE FROM users WHERE id IN ('ADM-PROD-PRIMARY', 'ADM-PROD-ROOT', 'USR-DRV-1001') OR email LIKE '%@example.com' OR id LIKE 'USR-LOCKED-%'");
  });

  // -------------------------------------------------------------
  // 1. /api/auth/admin-session route removal & no alternate backdoors
  // -------------------------------------------------------------
  test('1.1 POST /api/auth/admin-session is permanently removed and returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/auth/admin-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com' })
    });
    assert.strictEqual(res.status, 404, 'Must return 404');
  });

  test('1.2 POST /api/auth/admin-session with empty body returns 404 (no auto-minting)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/admin-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 404, 'Must return 404');
  });

  // -------------------------------------------------------------
  // 2. Harden Admin Registration
  // -------------------------------------------------------------
  test('2.1 Admin registration is disabled in production and returns 403', async () => {
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const res = await fetch(`${baseUrl}/api/auth/admin-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Prod Attempt Admin',
          email: 'prodattepmt@example.com',
          phone: '+91 99999 11111',
          password: 'TestPassword2026!',
          secretKey: ENV.ADMIN_REGISTRATION_SECRET
        })
      });
      assert.strictEqual(res.status, 403, 'Must return 403 in production');
      const data = await res.json();
      assert.strictEqual(data.error?.code, 'FORBIDDEN');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  test('2.2 Every previously hardcoded admin secret is rejected', async () => {
    // Test the historical secrets that were previously accepted
    const oldSecret1 = 'ANNA2026';
    const oldSecret2 = 'bda-admin-production-bootstrap-key-2026';

    await assert.rejects(
      async () => {
        await registerAdmin({
          name: 'Hacker Admin',
          email: 'hacker1@example.com',
          phone: '+91 91111 22222',
          password: 'Password123!',
          secretKey: oldSecret1
        });
      },
      (err) => err.statusCode === 403 && err.code === 'INVALID_ADMIN_SECRET'
    );

    await assert.rejects(
      async () => {
        await registerAdmin({
          name: 'Hacker Admin 2',
          email: 'hacker2@example.com',
          phone: '+91 91111 22223',
          password: 'Password123!',
          secretKey: oldSecret2
        });
      },
      (err) => err.statusCode === 403 && err.code === 'INVALID_ADMIN_SECRET'
    );
  });

  test('2.3 Wrong-length secrets and invalid secrets are safely rejected via timingSafeEqual without throwing', async () => {
    // Shorter than expected
    await assert.rejects(
      async () => {
        await registerAdmin({
          name: 'Bad Length Admin',
          email: 'badlen@example.com',
          phone: '+91 91111 33333',
          password: 'Password123!',
          secretKey: 'short'
        });
      },
      (err) => err.statusCode === 403 && err.code === 'INVALID_ADMIN_SECRET'
    );

    // Longer than expected
    await assert.rejects(
      async () => {
        await registerAdmin({
          name: 'Bad Length Admin 2',
          email: 'badlen2@example.com',
          phone: '+91 91111 33334',
          password: 'Password123!',
          secretKey: 'a'.repeat(128)
        });
      },
      (err) => err.statusCode === 403 && err.code === 'INVALID_ADMIN_SECRET'
    );

    // Null or undefined or non-string secret
    await assert.rejects(
      async () => {
        await registerAdmin({
          name: 'Null Secret Admin',
          email: 'nullsecret@example.com',
          phone: '+91 91111 33335',
          password: 'Password123!',
          secretKey: null
        });
      },
      (err) => err.statusCode === 403 && err.code === 'INVALID_ADMIN_SECRET'
    );
  });

  test('2.4 Only configured environment secret authorizes admin registration in non-production', async () => {
    const validEmail = `legit_admin_${Date.now()}@example.com`;
    const validPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;

    const { user, token } = await registerAdmin({
      name: 'Legit Admin',
      email: validEmail,
      phone: validPhone,
      password: 'LegitAdminPass2026!',
      secretKey: ENV.ADMIN_REGISTRATION_SECRET
    });

    assert.ok(user);
    assert.strictEqual(user.role, 'admin');
    assert.ok(token);
  });

  // -------------------------------------------------------------
  // 3. Prevent registerDriver Account Takeover & Privilege Escalation
  // -------------------------------------------------------------
  test('3.1 Registering driver using existing customer phone fails with 409 without modifying account', async () => {
    const custPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const custEmail = `victim_cust_${Date.now()}@example.com`;
    const custPassword = 'OriginalCustomerPass123!';

    const { user: originalCust } = await registerCustomer({
      name: 'Original Customer',
      email: custEmail,
      phone: custPhone,
      password: custPassword
    });

    const preUser = await queryOne('SELECT id, password_hash, role, status FROM users WHERE id = ?', [originalCust.id]);

    // Attack: register driver using victim's phone
    const res = await fetch(`${baseUrl}/api/auth/driver-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker Driver',
        phone: custPhone,
        dlNumber: `KA-01-2025-${Date.now().toString().slice(-7)}`,
        password: 'AttackerNewPassword123!'
      })
    });

    assert.strictEqual(res.status, 409, 'Must return 409 USER_ALREADY_EXISTS');

    // Verify victim's user record was NOT modified
    const postUser = await queryOne('SELECT id, password_hash, role, status FROM users WHERE id = ?', [originalCust.id]);
    assert.strictEqual(postUser.password_hash, preUser.password_hash, 'Password hash must remain unmodified');
    assert.strictEqual(postUser.role, 'customer', 'Role must remain customer');
    assert.strictEqual(postUser.status, 'Active');

    // Verify victim can still log in with their original password
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: custEmail, password: custPassword })
    });
    assert.strictEqual(loginRes.status, 200, 'Original customer should still be able to log in');
  });

  test('3.2 Registering driver using existing customer email fails with 409 without modifying account', async () => {
    const custPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const custEmail = `victim_cust_email_${Date.now()}@example.com`;
    const custPassword = 'OriginalCustomerPass456!';

    await registerCustomer({
      name: 'Customer Two',
      email: custEmail,
      phone: custPhone,
      password: custPassword
    });

    const preUser = await queryOne('SELECT id, password_hash, role FROM users WHERE email = ?', [custEmail.toLowerCase()]);

    // Attack via direct service call with existing email
    await assert.rejects(
      async () => {
        await registerDriver({
          name: 'Attacker Two',
          phone: `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`,
          dlNumber: `KA-02-2025-${Date.now().toString().slice(-7)}`,
          password: 'AttackerPassword789!',
          email: custEmail
        });
      },
      (err) => err.statusCode === 409 && err.code === 'USER_ALREADY_EXISTS'
    );

    const postUser = await queryOne('SELECT id, password_hash, role FROM users WHERE email = ?', [custEmail.toLowerCase()]);
    assert.strictEqual(postUser.password_hash, preUser.password_hash);
    assert.strictEqual(postUser.role, 'customer');
  });

  test('3.3 Registering driver using existing admin phone fails with 409 without modifying account', async () => {
    const adminPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const adminEmail = `victim_admin_${Date.now()}@example.com`;
    const adminPassword = 'OriginalAdminPass999!';

    const { user: originalAdmin } = await registerAdmin({
      name: 'Victim Admin',
      email: adminEmail,
      phone: adminPhone,
      password: adminPassword,
      secretKey: ENV.ADMIN_REGISTRATION_SECRET
    });

    const preAdmin = await queryOne('SELECT id, password_hash, role FROM users WHERE id = ?', [originalAdmin.id]);

    const res = await fetch(`${baseUrl}/api/auth/driver-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker Impersonating Admin',
        phone: adminPhone,
        dlNumber: `KA-03-2025-${Date.now().toString().slice(-7)}`,
        password: 'AttackerTakeoverPass!'
      })
    });

    assert.strictEqual(res.status, 409);

    const postAdmin = await queryOne('SELECT id, password_hash, role FROM users WHERE id = ?', [originalAdmin.id]);
    assert.strictEqual(postAdmin.password_hash, preAdmin.password_hash);
    assert.strictEqual(postAdmin.role, 'admin', 'Admin role must not be downgraded or changed');
  });

  test('3.4 Registering driver using existing admin email fails with 409', async () => {
    const adminPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const adminEmail = `victim_admin2_${Date.now()}@example.com`;
    const adminPassword = 'OriginalAdminPass888!';

    await registerAdmin({
      name: 'Victim Admin 2',
      email: adminEmail,
      phone: adminPhone,
      password: adminPassword,
      secretKey: ENV.ADMIN_REGISTRATION_SECRET
    });

    await assert.rejects(
      async () => {
        await registerDriver({
          name: 'Attacker Impersonating Admin Email',
          phone: `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`,
          dlNumber: `KA-04-2025-${Date.now().toString().slice(-7)}`,
          password: 'AttackerPass123!',
          email: adminEmail
        });
      },
      (err) => err.statusCode === 409 && err.code === 'USER_ALREADY_EXISTS'
    );
  });

  test('3.5 Driver login does NOT automatically convert customer or admin into driver role', async () => {
    const custPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const custEmail = `standard_customer_${Date.now()}@example.com`;
    const custPassword = 'CustomerPass123!';

    const { user: cust } = await registerCustomer({
      name: 'Customer Trying Driver Login',
      email: custEmail,
      phone: custPhone,
      password: custPassword
    });

    // Customer attempts driver login
    const res = await fetch(`${baseUrl}/api/auth/driver-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: custPhone,
        password: custPassword
      })
    });

    assert.strictEqual(res.status, 403, 'Should reject role mismatch with 403');

    // Verify role remained customer
    const userRow = await queryOne('SELECT role FROM users WHERE id = ?', [cust.id]);
    assert.strictEqual(userRow.role, 'customer', 'Role must remain customer');
  });

  // -------------------------------------------------------------
  // 4. Locked / Invalid Password Hash Handling
  // -------------------------------------------------------------
  test('4.1 Account with *LOCKED* password hash receives 401 and never crashes bcrypt', async () => {
    const lockedEmail = `locked_user_${Date.now()}@example.com`;
    const lockedPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const lockedUserId = `USR-LOCKED-${Date.now()}`;

    // Insert user with *LOCKED* password_hash
    await execute(`
      INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
      VALUES (?, 'Locked Account', ?, ?, '*LOCKED*', 'customer', 'Indiranagar', 'Active')
    `, [lockedUserId, lockedEmail, lockedPhone]);

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: lockedEmail,
        password: 'AnyPasswordAttempt!'
      })
    });

    assert.strictEqual(res.status, 401, 'Locked account must receive 401');
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error?.code, 'INVALID_CREDENTIALS');
  });

  // -------------------------------------------------------------
  // 5. Missing / Short Secrets Fail Securely on Startup (Child Process Tests)
  // -------------------------------------------------------------
  test('5.1 Production refuses to start without JWT_SECRET (exits non-zero)', () => {
    const child = spawnSync('node', ['-e', 'import("./server/config/env.js");'], {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        JWT_SECRET: '',
        ADMIN_REGISTRATION_SECRET: 'a_valid_long_admin_secret_32_characters!'
      },
      encoding: 'utf8'
    });

    assert.notStrictEqual(child.status, 0, 'Must exit with non-zero exit code');
    assert.match(
      child.stderr + child.stdout,
      /JWT_SECRET is required in production and must be at least 32 characters/
    );
  });

  test('5.2 Production refuses to start with short JWT_SECRET (<32 chars)', () => {
    const child = spawnSync('node', ['-e', 'import("./server/config/env.js");'], {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        JWT_SECRET: 'too-short',
        ADMIN_REGISTRATION_SECRET: 'a_valid_long_admin_secret_32_characters!'
      },
      encoding: 'utf8'
    });

    assert.notStrictEqual(child.status, 0, 'Must exit with non-zero exit code');
    assert.match(
      child.stderr + child.stdout,
      /JWT_SECRET is required in production and must be at least 32 characters/
    );
  });

  test('5.3 Production refuses to start without or with short ADMIN_REGISTRATION_SECRET', () => {
    const child = spawnSync('node', ['-e', 'import("./server/config/env.js");'], {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        JWT_SECRET: 'a_valid_long_jwt_secret_with_at_least_32_characters!',
        ADMIN_REGISTRATION_SECRET: 'short-secret'
      },
      encoding: 'utf8'
    });

    assert.notStrictEqual(child.status, 0, 'Must exit with non-zero exit code');
    assert.match(
      child.stderr + child.stdout,
      /ADMIN_REGISTRATION_SECRET is required in production and must be at least 32 characters/
    );
  });

  // -------------------------------------------------------------
  // 6. Legacy Account Lockdown Script Tests
  // -------------------------------------------------------------
  // 6. Legacy Account Lockdown Safety & Exact Compound Identity Verification
  // -------------------------------------------------------------
  test('6.1 Lockdown script defaults to DRY RUN with zero writes', async () => {
    // Seed exact legacy fixture account
    const testLegacyEmail = 'admin@bookdriveranna.com';
    await execute(`
      INSERT OR REPLACE INTO users (id, name, email, phone, password_hash, role, area, status)
      VALUES ('ADM-PROD-ROOT', 'System Operations Admin', ?, '+91 98765 00000', 'someOldHash', 'admin', 'Bengaluru HQ', 'Active')
    `, [testLegacyEmail]);

    const preUser = await queryOne('SELECT password_hash, status FROM users WHERE id = ?', ['ADM-PROD-ROOT']);

    // Run lockdown with apply: false (Dry Run)
    const result = await lockdownLegacyAccounts({ apply: false });

    assert.strictEqual(result.dryRun, true);
    assert.strictEqual(result.modifiedUsersCount, 0, 'Dry run must perform 0 user writes');
    assert.strictEqual(result.modifiedDriversCount, 0, 'Dry run must perform 0 driver writes');

    const postUser = await queryOne('SELECT password_hash, status FROM users WHERE id = ?', ['ADM-PROD-ROOT']);
    assert.strictEqual(postUser.password_hash, preUser.password_hash, 'Password hash must be untouched during dry-run');
    assert.strictEqual(postUser.status, preUser.status, 'Status must be untouched during dry-run');
  });

  test('6.2 Legitimate account with reused legacy phone is detected as conflict, skipped, and NOT locked', async () => {
    // Seed a legitimate customer who happens to have the same phone as a legacy admin
    const legitCustId = 'USR-CUST-REUSED-PHONE';
    const legitPhone = '+91 78991 20704'; // Matches canonical legacy phone for ADM-PROD-PRIMARY
    const legitEmail = 'real_customer_phone_reuse@example.com';
    const originalHash = '$2a$10$legitHashCustomerPhoneReuse1234567890';

    await execute(`
      INSERT OR REPLACE INTO users (id, name, email, phone, password_hash, role, area, status)
      VALUES (?, 'Real Customer Phone', ?, ?, ?, 'customer', 'Koramangala', 'Active')
    `, [legitCustId, legitEmail, legitPhone, originalHash]);

    // Also seed a legitimate driver with a reused phone
    const legitDriverUserId = 'USR-DRV-LEGIT-REUSED';
    const legitDriverId = 'DRV-LEGIT-REUSED';
    const legitDriverPhone = '+91 98860 12345'; // Matches legacy driver phone

    await execute(`
      INSERT OR REPLACE INTO users (id, name, email, phone, password_hash, role, area, status)
      VALUES (?, 'Real Driver Phone', 'real_driver_reuse@example.com', ?, ?, 'driver', 'Indiranagar', 'Active')
    `, [legitDriverUserId, legitDriverPhone, originalHash]);

    await execute(`
      INSERT OR REPLACE INTO drivers (id, user_id, name, phone, license_number, hub_area, status)
      VALUES (?, ?, 'Real Driver Phone', ?, 'KA-99-2023-9999999', 'Indiranagar', 'Active')
    `, [legitDriverId, legitDriverUserId, legitDriverPhone]);

    // Run lockdown with apply: true
    const result = await lockdownLegacyAccounts({ apply: true });

    // Verify legitimate customer with reused phone was SKIPPED and NOT locked
    const postLegitCust = await queryOne('SELECT password_hash, status, role FROM users WHERE id = ?', [legitCustId]);
    assert.strictEqual(postLegitCust.status, 'Active', 'Legitimate customer must remain Active');
    assert.strictEqual(postLegitCust.password_hash, originalHash, 'Password hash must NOT be locked');
    assert.strictEqual(postLegitCust.role, 'customer');

    // Verify legitimate driver with reused phone was SKIPPED and NOT locked
    const postLegitDriverUser = await queryOne('SELECT password_hash, status FROM users WHERE id = ?', [legitDriverUserId]);
    assert.strictEqual(postLegitDriverUser.status, 'Active', 'Legitimate driver user must remain Active');
    assert.strictEqual(postLegitDriverUser.password_hash, originalHash, 'Password hash must NOT be locked');

    const postLegitDriver = await queryOne('SELECT status FROM drivers WHERE id = ?', [legitDriverId]);
    assert.strictEqual(postLegitDriver.status, 'Active', 'Legitimate driver record must remain Active');

    // Verify conflict was recorded in script result
    assert.ok(result.conflictsCount >= 2, 'Should record conflicts for phone reuse');
    assert.ok(result.conflicts.some(c => c.userId === legitCustId), 'Should identify customer conflict');
  });

  test('6.3 Legitimate account with reused legacy email is detected as conflict, skipped, and NOT locked', async () => {
    // Seed a legitimate user with the same email as a legacy account but different ID and role
    const legitUserEmail = 'bookdriveranna@gmail.com';
    const legitUserId = 'USR-LEGIT-NEW-ID';
    const originalHash = '$2a$10$legitHashEmailReuse1234567890';

    // Clean up if previous exact admin exists to isolate email-reuse test
    await execute('DELETE FROM users WHERE id = ? OR email = ?', [legitUserId, legitUserEmail]);

    await execute(`
      INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
      VALUES (?, 'Different User Name', ?, '+91 99999 88888', ?, 'customer', 'HSR Layout', 'Active')
    `, [legitUserId, legitUserEmail, originalHash]);

    // Run lockdown with apply: true
    const result = await lockdownLegacyAccounts({ apply: true });

    // Verify account with reused email was SKIPPED and NOT locked
    const postUser = await queryOne('SELECT password_hash, status, role FROM users WHERE id = ?', [legitUserId]);
    assert.strictEqual(postUser.status, 'Active', 'Account with reused email must remain Active');
    assert.strictEqual(postUser.password_hash, originalHash, 'Password hash must NOT be locked');
    assert.strictEqual(postUser.role, 'customer');

    assert.ok(result.conflicts.some(c => c.userId === legitUserId), 'Conflict must be reported for reused email');
  });

  test('6.4 Lockdown script with --apply modifies ONLY exact compound legacy matches', async () => {
    // Seed exact legacy fixture accounts
    const legacyAdminId = 'ADM-PROD-PRIMARY';
    const legacyDriverUserId = 'USR-DRV-1001';
    const legacyDriverId = 'DRV-1001';

    // Insert exact matching compound legacy accounts
    await execute(`
      INSERT OR REPLACE INTO users (id, name, email, phone, password_hash, role, area, status)
      VALUES (?, 'Legacy Admin Primary', 'bookdriveranna@gmail.com', '+91 78991 20704', 'oldHash1', 'admin', 'Indiranagar', 'Active')
    `, [legacyAdminId]);

    await execute(`
      INSERT OR REPLACE INTO users (id, name, email, phone, password_hash, role, area, status)
      VALUES (?, 'Manjunath Gowda', 'manjunath.gowda@driveranna.com', '+91 98860 12345', 'oldHash2', 'driver', 'Indiranagar', 'Active')
    `, [legacyDriverUserId]);

    await execute(`
      INSERT OR REPLACE INTO drivers (id, user_id, name, phone, license_number, hub_area, status)
      VALUES (?, ?, 'Manjunath Gowda', '+91 98860 12345', 'KA-04-2021-0098745', 'Indiranagar', 'Active')
    `, [legacyDriverId, legacyDriverUserId]);

    const result = await lockdownLegacyAccounts({ apply: true });

    assert.strictEqual(result.dryRun, false);
    assert.ok(result.matchedUsersCount >= 2, 'Should match exact legacy users');
    assert.ok(result.matchedDriversCount >= 1, 'Should match exact legacy driver');

    // Verify exact legacy accounts were locked
    const lockedAdmin = await queryOne('SELECT password_hash, status FROM users WHERE id = ?', [legacyAdminId]);
    assert.strictEqual(lockedAdmin.password_hash, '*LOCKED*');
    assert.strictEqual(lockedAdmin.status, 'Inactive');

    const lockedDriverUser = await queryOne('SELECT password_hash, status FROM users WHERE id = ?', [legacyDriverUserId]);
    assert.strictEqual(lockedDriverUser.password_hash, '*LOCKED*');
    assert.strictEqual(lockedDriverUser.status, 'Inactive');

    const lockedDriver = await queryOne('SELECT status FROM drivers WHERE id = ?', [legacyDriverId]);
    assert.strictEqual(lockedDriver.status, 'Inactive');

    // Verify row was NOT deleted
    assert.ok(lockedAdmin, 'Row must not be deleted');
    assert.ok(lockedDriverUser, 'Row must not be deleted');
    assert.ok(lockedDriver, 'Row must not be deleted');
  });

});
