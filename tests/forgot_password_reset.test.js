import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { startTestServer } from './testHelper.js';
import { db } from '../server/db/database.js';
import { getLastTestEmail, clearTestMailbox } from '../server/services/emailService.js';

describe('Production-Ready Forgot Password & Password Reset Flow Tests', () => {
  let server, baseUrl;

  const testUser = {
    name: 'Reset Test Customer',
    email: `reset_test_${Date.now()}@example.com`,
    phone: `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`,
    password: 'InitialPassword2026!',
    area: 'Indiranagar'
  };

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // Register user account fixture
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    assert.strictEqual(res.status, 201);
  });

  after(() => {
    server.close();
  });

  beforeEach(() => {
    clearTestMailbox();
  });

  test('1. Database schema: password_reset_tokens table exists with expected structure', () => {
    const tableInfo = db.prepare("PRAGMA table_info(password_reset_tokens)").all();
    const columns = tableInfo.map(c => c.name);
    assert.ok(columns.includes('id'), 'Missing id column');
    assert.ok(columns.includes('user_id'), 'Missing user_id column');
    assert.ok(columns.includes('token_hash'), 'Missing token_hash column');
    assert.ok(columns.includes('expires_at'), 'Missing expires_at column');
    assert.ok(columns.includes('used_at'), 'Missing used_at column');
    assert.ok(columns.includes('created_at'), 'Missing created_at column');
  });

  test('2. Forgot password for existing email triggers secure email delivery and records hashed token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(
      data.message,
      'If an account exists with that email, a password reset link has been sent.'
    );

    // Verify test mailbox captured the dispatch
    const sentEmail = getLastTestEmail();
    assert.ok(sentEmail, 'Email must have been dispatched');
    assert.strictEqual(sentEmail.to, testUser.email);
    assert.ok(sentEmail.subject.includes('Reset Your Password'));
    assert.ok(sentEmail.text.includes('/reset-password?token='));
    assert.ok(sentEmail.html.includes('Reset Password'));
    assert.ok(sentEmail.text.includes('15 minutes'));

    // Extract raw token from reset link in email
    const match = sentEmail.text.match(/token=([a-f0-9]{64})/);
    assert.ok(match, 'Email text must contain a 64-character hex reset token');
    const rawToken = match[1];

    // Verify token is hashed with SHA-256 in the database
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const row = db.prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ?').get(tokenHash);
    assert.ok(row, 'Database must contain token_hash');
    assert.strictEqual(row.token_hash, tokenHash);
    assert.strictEqual(row.used_at, null);

    // Ensure raw token was NEVER stored in plaintext in the database
    const rawMatches = db.prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ?').all(rawToken);
    assert.strictEqual(rawMatches.length, 0, 'Plaintext token must never be stored in database');
  });

  test('3. Email enumeration defense: unknown email returns identical generic response with no leaks', async () => {
    const unknownEmail = `nonexistent_${Date.now()}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: unknownEmail })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(
      data.message,
      'If an account exists with that email, a password reset link has been sent.'
    );

    // Ensure NO email was sent for nonexistent account
    const sentEmail = getLastTestEmail();
    assert.strictEqual(sentEmail, null, 'No email should be dispatched for unknown user');
  });

  test('4. Token verification: valid token returns valid: true', async () => {
    // Request a reset token
    await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email })
    });

    const sentEmail = getLastTestEmail();
    assert.ok(sentEmail);
    const rawToken = sentEmail.text.match(/token=([a-f0-9]{64})/)[1];

    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-reset-token?token=${rawToken}`);
    assert.strictEqual(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyData.success, true);
    assert.strictEqual(verifyData.valid, true);
  });

  test('5. Token verification: invalid or corrupted token returns valid: false', async () => {
    const fakeToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-reset-token?token=${fakeToken}`);
    assert.strictEqual(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyData.success, false);
    assert.strictEqual(verifyData.valid, false);
    assert.strictEqual(verifyData.message, 'This password reset link is invalid or expired.');
  });

  test('6. Token verification: expired token (>15 minutes) is rejected', async () => {
    // Generate an expired token in the database
    const expiredRawToken = crypto.randomBytes(32).toString('hex');
    const expiredTokenHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');
    const pastTime = new Date(Date.now() - 20 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(testUser.email.toLowerCase());
    const expiredTokenId = 'PRT-EXPIRED-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    db.prepare(`
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, datetime('now', '-20 minutes'))
    `).run(expiredTokenId, user.id, expiredTokenHash, pastTime);

    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-reset-token?token=${expiredRawToken}`);
    assert.strictEqual(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyData.success, false);
    assert.strictEqual(verifyData.valid, false);
    assert.strictEqual(verifyData.message, 'This password reset link is invalid or expired.');

    // Also verify reset-password rejects this expired token
    const resetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: expiredRawToken,
        password: 'NewBrandPassword2026!'
      })
    });
    assert.strictEqual(resetRes.status, 400);
    const resetData = await resetRes.json();
    assert.strictEqual(resetData.success, false);
    assert.ok(resetData.error.message.includes('invalid or expired'));
  });

  test('7. Old token invalidation: requesting another reset invalidates previously active tokens', async () => {
    // First request
    await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email })
    });
    const firstEmail = getLastTestEmail();
    const firstToken = firstEmail.text.match(/token=([a-f0-9]{64})/)[1];
    clearTestMailbox();

    // Second request
    await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email })
    });
    const secondEmail = getLastTestEmail();
    const secondToken = secondEmail.text.match(/token=([a-f0-9]{64})/)[1];

    assert.notStrictEqual(firstToken, secondToken, 'Tokens must be distinct');

    // First token must now be invalid
    const verifyFirst = await fetch(`${baseUrl}/api/auth/verify-reset-token?token=${firstToken}`);
    const firstData = await verifyFirst.json();
    assert.strictEqual(firstData.valid, false, 'First token must be invalidated');

    // Second token must be valid
    const verifySecond = await fetch(`${baseUrl}/api/auth/verify-reset-token?token=${secondToken}`);
    const secondData = await verifySecond.json();
    assert.strictEqual(secondData.valid, true, 'Second token must remain valid');
  });

  test('8. Reset password validates password length (minimum 8 characters)', async () => {
    await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email })
    });
    const sentEmail = getLastTestEmail();
    const token = sentEmail.text.match(/token=([a-f0-9]{64})/)[1];

    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        password: 'short'
      })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.message.includes('at least 8 characters'));
  });

  test('9. Full End-to-End: Reset password with valid token, update bcrypt hash, and verify login', async () => {
    const newPassword = 'BrandNewSecurePassword@2026';

    // 1. Request reset link
    await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email })
    });
    const sentEmail = getLastTestEmail();
    const token = sentEmail.text.match(/token=([a-f0-9]{64})/)[1];

    // 2. Perform password reset
    const resetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        password: newPassword
      })
    });

    assert.strictEqual(resetRes.status, 200);
    const resetData = await resetRes.json();
    assert.strictEqual(resetData.success, true);
    assert.strictEqual(resetData.message, 'Your password has been reset successfully.');

    // 3. Single-use check: Try to reset again with the same token
    const reuseRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        password: 'AnotherPassword999!'
      })
    });
    assert.strictEqual(reuseRes.status, 400, 'Reused token must be rejected');
    const reuseData = await reuseRes.json();
    assert.strictEqual(reuseData.success, false);

    // 4. Old password must be rejected
    const oldLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testUser.email,
        password: testUser.password
      })
    });
    assert.strictEqual(oldLoginRes.status, 401, 'Old password must be rejected');

    // 5. New password must be accepted and issue token and cookie
    const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testUser.email,
        password: newPassword
      })
    });
    assert.strictEqual(newLoginRes.status, 200, 'New password must succeed');
    const newLoginData = await newLoginRes.json();
    assert.strictEqual(newLoginData.success, true);
    assert.strictEqual(newLoginData.data.user.email, testUser.email.toLowerCase());
    assert.ok(newLoginData.data.token, 'Must return JWT token');
    assert.ok(newLoginRes.headers.get('set-cookie'), 'Must issue authentication cookie');
  });

  test('10. Existing auth regression: Registration, login, logout, and /me still work seamlessly', async () => {
    const regEmail = `regression_${Date.now()}@example.com`;
    const regPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;

    // Register
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Regression User',
        email: regEmail,
        phone: regPhone,
        password: 'RegPassword123!',
        area: 'Indiranagar'
      })
    });
    assert.strictEqual(regRes.status, 201);
    const regData = await regRes.json();
    const token = regData.data.token;

    // Call /me with token
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.data.user.email, regEmail.toLowerCase());

    // Logout
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST'
    });
    assert.strictEqual(logoutRes.status, 200);
  });
});
