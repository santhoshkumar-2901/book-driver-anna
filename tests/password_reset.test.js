import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { startTestServer } from './testHelper.js';
import { db } from '../server/db/database.js';
import { getLastTestEmail, clearTestMailbox } from '../server/services/emailService.js';

describe('Production Authentication, Password Reset & Security Suite', () => {
  let server, baseUrl;
  const userA = {
    name: 'Reset Test User',
    email: `reset_test_${Date.now()}@example.com`,
    phone: `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`,
    password: 'InitialPassword123!',
    area: 'Indiranagar'
  };

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // Create fixture user
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userA)
    });
    assert.strictEqual(res.status, 201);
  });

  after(() => {
    server.close();
  });

  test('1. Registration rejects passwords shorter than 8 characters', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Short Pwd User',
        email: `short_pwd_${Date.now()}@example.com`,
        phone: `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`,
        password: 'short7' // only 6 chars
      })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'INVALID_INPUT');
    assert.ok(data.error.message.includes('at least 8 characters'));
  });

  test('2. Forgot password returns identical generic message for existing vs non-existing emails (Anti-Enumeration)', async () => {
    clearTestMailbox();

    // Request for existing email
    const resExist = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userA.email })
    });
    assert.strictEqual(resExist.status, 200);
    const dataExist = await resExist.json();

    // Request for non-existing email
    const resNonExist = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'non_existent_account_12345@example.com' })
    });
    assert.strictEqual(resNonExist.status, 200);
    const dataNonExist = await resNonExist.json();

    // Verify messages and status codes are indistinguishable
    assert.strictEqual(dataExist.success, true);
    assert.strictEqual(dataNonExist.success, true);
    assert.strictEqual(dataExist.message, dataNonExist.message);
    assert.strictEqual(dataExist.message, 'If an account exists for this email, password reset instructions have been sent.');

    // Verify an email was dispatched only for the existing user
    const sentEmail = getLastTestEmail();
    assert.ok(sentEmail, 'Email must have been dispatched');
    assert.strictEqual(sentEmail.to, userA.email);
  });

  test('3. Raw reset token is NEVER stored in database; only SHA-256 hash exists in password_reset_tokens', async () => {
    const sentEmail = getLastTestEmail();
    assert.ok(sentEmail, 'Dispatched email must exist');

    // Extract raw token from reset link
    const match = sentEmail.text.match(/token=([a-f0-9]+)/);
    assert.ok(match, 'Email must contain raw token in URL');
    const rawToken = match[1];
    assert.strictEqual(rawToken.length, 64, 'Raw token must be 32 cryptographically secure random bytes in hex');

    // Calculate expected SHA-256 hash
    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Query database for all tokens
    const records = db.prepare('SELECT id, user_id, token_hash, expires_at, used_at FROM password_reset_tokens').all();
    assert.ok(records.length > 0, 'Database must contain reset token records');

    // Verify raw token is NOT in any column in the database
    for (const r of records) {
      assert.notStrictEqual(r.token_hash, rawToken, 'Raw token must never be stored as hash');
      assert.notStrictEqual(JSON.stringify(r).includes(rawToken), true, 'Raw token must not exist anywhere in record');
    }

    // Verify the SHA-256 hash is what is actually stored
    const matchingRecord = records.find(r => r.token_hash === expectedHash);
    assert.ok(matchingRecord, 'A record with the matching SHA-256 hash must exist in password_reset_tokens');
    assert.strictEqual(matchingRecord.used_at, null, 'Token should initially be unused');
  });

  test('4. Token verification endpoint validates token without leaking user details', async () => {
    const sentEmail = getLastTestEmail();
    const match = sentEmail.text.match(/token=([a-f0-9]+)/);
    const rawToken = match[1];

    // Valid token
    const res = await fetch(`${baseUrl}/api/auth/verify-reset-token?token=${rawToken}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.valid, true);
    assert.strictEqual(data.data.user, undefined, 'Must never expose user details in verify-reset-token');

    // Invalid token
    const resInvalid = await fetch(`${baseUrl}/api/auth/verify-reset-token?token=deadbeefdeadbeef0000`);
    const dataInvalid = await resInvalid.json();
    assert.strictEqual(dataInvalid.data.valid, false);
  });

  test('5. Reset password endpoint rejects passwords under 8 characters', async () => {
    const sentEmail = getLastTestEmail();
    const match = sentEmail.text.match(/token=([a-f0-9]+)/);
    const rawToken = match[1];

    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        newPassword: 'short'
      })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.message.includes('at least 8 characters'));
  });

  test('6. Valid password reset succeeds and invalidates previous credentials', async () => {
    const sentEmail = getLastTestEmail();
    const match = sentEmail.text.match(/token=([a-f0-9]+)/);
    const rawToken = match[1];
    const newPassword = 'BrandNewPassword2026!';

    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        newPassword
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.message.includes('successfully changed'));

    // Verify old password no longer works
    const oldLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: userA.email,
        password: userA.password
      })
    });
    assert.strictEqual(oldLoginRes.status, 401, 'Old password must be rejected');

    // Verify new password works
    const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: userA.email,
        password: newPassword
      })
    });
    assert.strictEqual(newLoginRes.status, 200, 'New password must authenticate successfully');

    // Update test user's current password for remaining tests
    userA.password = newPassword;
  });

  test('7. Token single-use enforcement: used token cannot be used again', async () => {
    const sentEmail = getLastTestEmail();
    const match = sentEmail.text.match(/token=([a-f0-9]+)/);
    const rawToken = match[1];

    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        newPassword: 'AnotherPassword333!'
      })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'TOKEN_ALREADY_USED');
  });

  test('8. Expired tokens are rejected', async () => {
    const fakeRawToken = crypto.randomBytes(32).toString('hex');
    const fakeHash = crypto.createHash('sha256').update(fakeRawToken).digest('hex');
    const expiredTimestamp = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 mins ago

    // Insert expired token directly for userA
    const users = db.prepare('SELECT id FROM users WHERE email = ?').all(userA.email);
    const userId = users[0].id;

    const tokenId = 'PRT-EXP-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
    db.prepare(`
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(tokenId, userId, fakeHash, expiredTimestamp);

    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: fakeRawToken,
        newPassword: 'BrandNewPassword444!'
      })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'TOKEN_EXPIRED');
  });

  test('9. Authenticated password change endpoint (POST /api/auth/change-password)', async () => {
    // 1. Log in to get token
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: userA.email,
        password: userA.password
      })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.token;

    // 2. Reject incorrect current password
    const badCurrentRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        currentPassword: 'wrongCurrentPassword1!',
        newPassword: 'UpdatedSecretPassword2026!'
      })
    });
    assert.strictEqual(badCurrentRes.status, 401);
    const badCurrentData = await badCurrentRes.json();
    assert.strictEqual(badCurrentData.error.code, 'INVALID_CREDENTIALS');

    // 3. Reject new password identical to current password
    const samePwdRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        currentPassword: userA.password,
        newPassword: userA.password
      })
    });
    assert.strictEqual(samePwdRes.status, 400);

    // 4. Successfully change password
    const successRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        currentPassword: userA.password,
        newPassword: 'UpdatedSecretPassword2026!'
      })
    });
    assert.strictEqual(successRes.status, 200);
    const successData = await successRes.json();
    assert.strictEqual(successData.success, true);
  });

  test('10. Logout clears cookie with matching security attributes', async () => {
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST'
    });

    assert.strictEqual(res.status, 200);
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Must set cookie header to clear authentication cookie');
    assert.ok(setCookie.includes('bda_auth_token=;'), 'Cookie value must be cleared');
    assert.ok(setCookie.includes('HttpOnly'), 'Cleared cookie must preserve HttpOnly attribute');
    assert.ok(setCookie.includes('Path=/'), 'Cleared cookie must preserve Path attribute');
  });
});
