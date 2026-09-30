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

  test('5. /api/auth/admin-register rejects hardcoded ANNA2026 and requires configured ENV secret', async () => {
    const uniqueEmail = `test_admin_${Date.now()}@bookdriveranna.com`;
    const uniquePhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;

    // 1. Rejected with old hardcoded secret
    const badRes = await fetch(`${baseUrl}/api/auth/admin-register`, {
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
    assert.strictEqual(badRes.status, 403, 'Old hardcoded secret must return HTTP 403');

    // 2. Accepted with configured ENV secret
    const goodRes = await fetch(`${baseUrl}/api/auth/admin-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Ops Admin',
        email: uniqueEmail,
        phone: uniquePhone,
        password: 'ValidSecurePass2026!',
        secretKey: process.env.ADMIN_REGISTRATION_SECRET,
        area: 'Indiranagar'
      })
    });
    assert.strictEqual(goodRes.status, 201, 'Configured ENV secret should return HTTP 201');
    const data = await goodRes.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data?.user?.email, uniqueEmail.toLowerCase());
    assert.ok(data.data?.token, 'Response should contain token');
  });

  test('6. /api/auth/admin-session is permanently removed and returns HTTP 404', async () => {
    const res = await fetch(`${baseUrl}/api/auth/admin-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testAdminEmail })
    });

    assert.strictEqual(res.status, 404, 'POST /api/auth/admin-session must return 404');
  });

  test('7. api/index.js exports a function handler compatible with Vercel serverless functions', () => {
    assert.strictEqual(typeof handler, 'function', 'handler must be an exported function');
  });

  test('8. Automatic admin provisioning is disabled; unseeded accounts cannot log in', async () => {
    const unprovisionedEmail = `unseeded_admin_${Date.now()}@bookdriveranna.com`;
    const res = await fetch(`${baseUrl}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: unprovisionedEmail,
        password: 'UnseededAdminPass2026!'
      })
    });

    assert.strictEqual(res.status, 401, 'Unseeded admin should receive 401 instead of auto-provisioning');
  });

  test('9. Public healthcheck does not leak internal metrics; admin diagnostics provides metrics to authorized admin', async () => {
    // 1. Verify public healthcheck is minimal and leaks no database or configuration details
    const publicRes = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(publicRes.status, 200);
    const publicData = await publicRes.json();
    assert.strictEqual(publicData.status, 'healthy');
    assert.strictEqual(publicData.database, undefined, 'Public healthcheck must not disclose database object');
    assert.strictEqual(publicData.userCount, undefined, 'Public healthcheck must not disclose userCount');
    assert.strictEqual(publicData.adminCount, undefined, 'Public healthcheck must not disclose adminCount');
    assert.strictEqual(publicData.emailConfig, undefined, 'Public healthcheck must not disclose emailConfig');

    // 2. Verify protected admin diagnostics provides metrics to authenticated admin
    const loginRes = await fetch(`${baseUrl}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testAdminEmail,
        password: testAdminPassword
      })
    });
    const loginData = await loginRes.json();
    const adminToken = loginData.data?.token;

    const diagRes = await fetch(`${baseUrl}/api/admin/diagnostics`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(diagRes.status, 200);
    const diagData = await diagRes.json();
    assert.strictEqual(diagData.success, true);
    assert.ok(typeof diagData.data?.database?.adminCount === 'number');
    assert.ok(Number(diagData.data?.database?.adminCount) >= 1, 'adminCount must be at least 1 in protected admin diagnostics');
  });

});

