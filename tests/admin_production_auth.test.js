import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { SCHEMA_SQL } from '../server/db/schema.js';
import { startTestServer } from './testHelper.js';
import { bootstrapAdmin } from '../server/scripts/bootstrapAdmin.js';
import { queryOne } from '../server/db/database.js';
import handler from '../api/index.js';

describe('Production Admin Authentication & Serverless Routing Suite', () => {
  let server, baseUrl;
  const testAdminEmail = `prod_admin_test_${Date.now()}@bookdriveranna.com`;
  const testAdminPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
  const testAdminPassword = 'ProductionAdminPass2026!';

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    await bootstrapAdmin({
      email: testAdminEmail,
      password: testAdminPassword,
      name: 'Prod Test Admin',
      phone: testAdminPhone,
      area: 'Bengaluru HQ'
    });
  });

  after(() => {
    server.close();
  });

  test('1. SCHEMA_SQL defines all required tables and indexes as an embedded string', () => {
    assert.ok(typeof SCHEMA_SQL === 'string', 'SCHEMA_SQL should be a string');
    assert.ok(SCHEMA_SQL.includes('CREATE TABLE IF NOT EXISTS users'), 'Should define users table');
    assert.ok(SCHEMA_SQL.includes('CREATE TABLE IF NOT EXISTS drivers'), 'Should define drivers table');
    assert.ok(SCHEMA_SQL.includes('CREATE TABLE IF NOT EXISTS bookings'), 'Should define bookings table');
    assert.ok(SCHEMA_SQL.includes('CREATE TABLE IF NOT EXISTS audit_logs'), 'Should define audit_logs table');
  });

  test('2. Production administrator is present in the database', async () => {
    const adminUser = await queryOne("SELECT id, name, email, phone, role, status FROM users WHERE role = 'admin' LIMIT 1");
    assert.ok(adminUser, 'An admin account must exist in the database');
    assert.strictEqual(adminUser.role, 'admin');
    assert.strictEqual(adminUser.status, 'Active');
  });

  test('3. /api/auth/admin-login authenticates valid admin and returns JWT token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testAdminEmail,
        password: testAdminPassword
      })
    });

    assert.strictEqual(res.status, 200, 'Admin login should return HTTP 200');
    const data = await res.json();
    assert.strictEqual(data.success, true, 'Admin login should succeed');
    assert.ok(data.data?.token, 'Admin login response must include JWT token');
    assert.strictEqual(data.data?.user?.role, 'admin');
  });

  test('4. Dual-prefix routing: /auth/admin-login works without /api prefix for Vercel rewrite resilience', async () => {
    const res = await fetch(`${baseUrl}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testAdminEmail,
        password: testAdminPassword
      })
    });

    assert.strictEqual(res.status, 200, 'Dual-prefix /auth/admin-login should return HTTP 200');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.data?.token);
  });

  test('5. /api/auth/admin-register accepts ANNA2026 secret key', async () => {
    const uniqueEmail = `test_admin_${Date.now()}@bookdriveranna.com`;
    const uniquePhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;

    const res = await fetch(`${baseUrl}/api/auth/admin-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Ops Admin',
        email: uniqueEmail,
        phone: uniquePhone,
        password: 'ValidSecurePass2026!',
        secretKey: 'ANNA2026',
        area: 'Indiranagar'
      })
    });

    assert.strictEqual(res.status, 201, 'Admin registration with ANNA2026 should return HTTP 201');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data?.user?.email, uniqueEmail.toLowerCase());
    assert.ok(data.data?.token, 'Response should contain token');
  });

  test('6. /api/auth/admin-session successfully restores session for authenticated admin', async () => {
    const res = await fetch(`${baseUrl}/api/auth/admin-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testAdminEmail })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.data?.token);
    assert.strictEqual(data.data?.user?.email, testAdminEmail.toLowerCase());
  });

  test('7. api/index.js exports a function handler compatible with Vercel serverless functions', () => {
    assert.strictEqual(typeof handler, 'function', 'handler must be an exported function');
  });

  test('8. ensureProductionAdmins ensures standard admin accounts (bookdriveranna@gmail.com) can log in', async () => {
    const adminEmail = process.env.ADMIN_EMAIL || 'bookdriveranna@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'adminpassword@bda';

    const res = await fetch(`${baseUrl}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: adminEmail,
        password: adminPassword
      })
    });

    assert.strictEqual(res.status, 200, 'Standard production admin should log in with HTTP 200');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data?.user?.email, adminEmail.toLowerCase());
    assert.strictEqual(data.data?.user?.role, 'admin');
    assert.ok(data.data?.token);
  });

  test('9. Healthcheck endpoint reports adminCount correctly in database metrics', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
    assert.ok(typeof data.database?.adminCount === 'number' || typeof data.database?.adminCount === 'string');
    assert.ok(Number(data.database?.adminCount) >= 1, 'adminCount must be at least 1');
  });

});

