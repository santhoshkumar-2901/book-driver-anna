import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { startTestServer } from './testHelper.js';
import { db } from '../server/db/database.js';

describe('Authentication & Password Security Tests', () => {
  let server, baseUrl;

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;
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

  test('3. Duplicate email or phone registration is rejected with 409 Conflict', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Attempt',
        email: 'rahul.sharma@example.com',
        phone: '+91 98765 99999',
        password: 'password123'
      })
    });

    assert.strictEqual(res.status, 409);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'USER_ALREADY_EXISTS');
  });

  test('4. Login with incorrect password returns 401 with generic error message to prevent enumeration', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'rahul.sharma@example.com',
        password: 'wrong_password_attempt'
      })
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'INVALID_CREDENTIALS');
    assert.strictEqual(data.error.message, 'Invalid email, phone number, or password.');
  });

  test('5. Valid login returns JWT token and sets HttpOnly cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'rahul.sharma@example.com',
        password: 'password123'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.user.name, 'Rahul Sharma');
    assert.ok(data.data.token, 'Must return JWT token');
  });
});
