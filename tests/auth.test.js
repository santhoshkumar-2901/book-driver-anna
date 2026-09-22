import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { startTestServer } from './testHelper.js';
import { db } from '../server/db/database.js';

describe('Authentication & Password Security Tests', () => {
  let server, baseUrl;
  const fixtureUser = {
    name: 'Auth Fixture User',
    email: `auth_fixture_${Date.now()}@example.com`,
    phone: `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`,
    password: 'securePassword123',
    area: 'Indiranagar'
  };

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // Register an inline test fixture user so tests are self-contained
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fixtureUser)
    });
  });

  after(() => {
    server.close();
  });

  test('1. Passwords in database are strictly hashed with bcrypt, never plaintext', () => {
    const users = db.prepare('SELECT email, password_hash FROM users').all();
    assert.ok(users.length > 0, 'Should have users in database');
    for (const u of users) {
      assert.ok(
        u.password_hash.startsWith('$2a$') || u.password_hash.startsWith('$2b$'),
        `User ${u.email} must have a bcrypt hash, found: ${u.password_hash}`
      );
      assert.notStrictEqual(u.password_hash, 'password123');
      assert.notStrictEqual(u.password_hash, 'admin123');
    }
  });

  test('2. Successful Customer Registration sets HttpOnly cookie and returns user object without password hash', async () => {
    const testEmail = `newuser_${Date.now()}@example.com`;
    const testPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Anand Kumar',
        email: testEmail,
        phone: testPhone,
        password: 'securePassword2026',
        area: 'Indiranagar'
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.user.email, testEmail.toLowerCase());
    assert.strictEqual(data.data.user.role, 'customer');
    assert.strictEqual(data.data.user.password_hash, undefined, 'Password hash must never be returned to client');

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Must set authentication cookie');
    assert.ok(setCookie.includes('HttpOnly'), 'Cookie must be HttpOnly');
  });

  test('3. Registration rejects passwords shorter than 8 characters', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Short Pwd User',
        email: `short_pwd_${Date.now()}@example.com`,
        phone: `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`,
        password: 'short'
      })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'INVALID_INPUT');
    assert.ok(data.error.message.includes('at least 8 characters'));
  });

  test('4. Duplicate email or phone registration is rejected with 409 Conflict', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Attempt',
        email: fixtureUser.email,
        phone: '+91 98765 99999',
        password: 'password123'
      })
    });

    assert.strictEqual(res.status, 409);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'USER_ALREADY_EXISTS');
  });

  test('5. Correct identifier + correct password succeeds and issues JWT and cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: fixtureUser.email,
        password: fixtureUser.password
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.user.name, fixtureUser.name);
    assert.ok(data.data.token, 'Must return JWT token');
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Must set auth cookie');
  });

  test('6. Correct identifier + wrong password returns 401 and issues NO token or cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: fixtureUser.email,
        password: 'wrong_password_attempt'
      })
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'INVALID_CREDENTIALS');
    assert.strictEqual(data.error.message, 'Invalid email or password.');
    assert.strictEqual(data.data, undefined);
    assert.strictEqual(res.headers.get('set-cookie'), null, 'Failed login must NOT issue cookie');
  });

  test('7. Correct identifier + random password returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: fixtureUser.email,
        password: 'rnd_' + Math.random() + '_!@#$%'
      })
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'INVALID_CREDENTIALS');
    assert.strictEqual(data.error.message, 'Invalid email or password.');
  });

  test('8. Correct identifier + empty password returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: fixtureUser.email,
        password: ''
      })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'INVALID_INPUT');
  });

  test('9. Nonexistent identifier + password returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'nonexistent_user_999999@example.com',
        password: 'somePassword123!'
      })
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'INVALID_CREDENTIALS');
    assert.strictEqual(data.error.message, 'Invalid email or password.');
  });

  test('10. Wrong identifier + correct password returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'different_wrong_user@example.com',
        password: fixtureUser.password
      })
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'INVALID_CREDENTIALS');
    assert.strictEqual(data.error.message, 'Invalid email or password.');
  });

  test('11. Empty identifier + password returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '',
        password: fixtureUser.password
      })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'INVALID_INPUT');
  });

  test('12. Correct phone + wrong password returns 401 and issues NO token or cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: fixtureUser.phone,
        password: 'wrong_phone_pwd'
      })
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'INVALID_CREDENTIALS');
    assert.strictEqual(data.error.message, 'Invalid email or password.');
    assert.strictEqual(res.headers.get('set-cookie'), null);
  });
});
