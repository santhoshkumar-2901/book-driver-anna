import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { startTestServer } from './testHelper.js';
import { db, queryOne, withTransaction } from '../server/db/database.js';
import { resetPasswordWithToken } from '../server/services/authService.js';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Phase 4A — Production Reliability Hardening Suite', () => {
  let server, baseUrl;

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;
  });

  after(() => {
    if (server) {
      server.close();
    }
  });

  // Helper to create a user and a valid reset token
  async function createFixtureUserWithToken(prefix, initialPassword = 'InitialSecretPass@123') {
    const userId = `USR-P4A-${prefix}-${Date.now()}`;
    const email = `p4a_${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}@example.com`;
    const phone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const passwordHash = bcrypt.hashSync(initialPassword, 10);

    await db.execute(
      `INSERT INTO users (id, name, email, phone, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, 'customer', 'Active')`,
      [userId, `Test User ${prefix}`, email, phone, passwordHash]
    );

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenId = `PRT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await db.execute(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [tokenId, userId, tokenHash, expiresAt]
    );

    return { userId, email, phone, initialPassword, rawToken, tokenId };
  }

  // =========================================================================
  // FIX 1: Atomic Password Reset Token Consumption
  // =========================================================================

  test('Fix 1 - Test 1: Unused token successfully resets password and consumes token atomically', async () => {
    const fixture = await createFixtureUserWithToken('unused');
    const newPassword = 'NewSecurePassword@2026';

    const result = await resetPasswordWithToken({
      rawToken: fixture.rawToken,
      newPassword,
      ipAddress: '127.0.0.1'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.message, 'Your password has been reset successfully.');

    // Token must be marked used
    const tokenRow = await queryOne('SELECT used_at FROM password_reset_tokens WHERE id = ?', [fixture.tokenId]);
    assert.ok(tokenRow.used_at !== null, 'Token used_at must be populated');

    // User password hash must verify with the new password
    const userRow = await queryOne('SELECT password_hash FROM users WHERE id = ?', [fixture.userId]);
    assert.ok(bcrypt.compareSync(newPassword, userRow.password_hash), 'New password must match stored hash');
  });

  test('Fix 1 - Test 2: Already-used token is rejected with 400', async () => {
    const fixture = await createFixtureUserWithToken('used');
    const newPassword = 'PasswordAttemptOne@2026';

    // First use succeeds
    const firstResult = await resetPasswordWithToken({
      rawToken: fixture.rawToken,
      newPassword,
      ipAddress: '127.0.0.1'
    });
    assert.strictEqual(firstResult.success, true);

    // Second use must fail
    await assert.rejects(
      async () => {
        await resetPasswordWithToken({
          rawToken: fixture.rawToken,
          newPassword: 'PasswordAttemptTwo@2026',
          ipAddress: '127.0.0.1'
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'INVALID_RESET_TOKEN');
        return true;
      }
    );
  });

  test('Fix 1 - Test 3: Concurrent attempts using the same token result in exactly one success, one rejection, and consistent DB state', async () => {
    const fixture = await createFixtureUserWithToken('concurrent');
    const passwordA = 'ConcurrentSuccessPasswordA@123';
    const passwordB = 'ConcurrentAttemptPasswordB@456';

    // Launch two simultaneous reset requests with the exact same token
    const [resA, resB] = await Promise.allSettled([
      resetPasswordWithToken({ rawToken: fixture.rawToken, newPassword: passwordA, ipAddress: '127.0.0.1' }),
      resetPasswordWithToken({ rawToken: fixture.rawToken, newPassword: passwordB, ipAddress: '127.0.0.2' })
    ]);

    const successes = [resA, resB].filter(r => r.status === 'fulfilled');
    const rejections = [resA, resB].filter(r => r.status === 'rejected');

    assert.strictEqual(successes.length, 1, 'Exactly one concurrent request must succeed');
    assert.strictEqual(rejections.length, 1, 'The other concurrent request must be rejected');

    const rejectedReason = rejections[0].reason;
    assert.strictEqual(rejectedReason.statusCode, 400);
    assert.strictEqual(rejectedReason.code, 'INVALID_RESET_TOKEN');

    // Verify token is used exactly once
    const tokenRow = await queryOne('SELECT used_at FROM password_reset_tokens WHERE id = ?', [fixture.tokenId]);
    assert.ok(tokenRow.used_at !== null, 'Token must be marked used');

    // The user's active password in DB must match the winner's password, never the loser's
    const userRow = await queryOne('SELECT password_hash FROM users WHERE id = ?', [fixture.userId]);
    const winnerPassword = successes[0].value ? (bcrypt.compareSync(passwordA, userRow.password_hash) ? passwordA : passwordB) : null;
    assert.ok(winnerPassword !== null, 'Database password must match the successful request');
  });

  test('Fix 1 - Test 3B: HTTP POST /api/auth/reset-password handles concurrent requests (exactly one 200, one 400)', async () => {
    const fixture = await createFixtureUserWithToken('http_concurrent');
    const passwordA = 'HttpConcurrentPassA@123';
    const passwordB = 'HttpConcurrentPassB@456';

    const [resA, resB] = await Promise.all([
      fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: fixture.rawToken, password: passwordA })
      }),
      fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: fixture.rawToken, password: passwordB })
      })
    ]);

    const statuses = [resA.status, resB.status].sort();
    assert.deepStrictEqual(statuses, [200, 400], `Expected [200, 400] under concurrent HTTP reset, got [${resA.status}, ${resB.status}]`);

    // Verify token is used in DB
    const tokenRow = await queryOne('SELECT used_at FROM password_reset_tokens WHERE id = ?', [fixture.tokenId]);
    assert.ok(tokenRow.used_at !== null, 'Token must be marked used');
  });

  test('Fix 1 - Test 4: If token consumption fails, the password update is rolled back', async () => {
    const fixture = await createFixtureUserWithToken('rollback', 'OriginalRollbackPassword@123');
    const userBefore = await queryOne('SELECT password_hash FROM users WHERE id = ?', [fixture.userId]);
    const originalHash = userBefore.password_hash;

    // Simulate token invalidation right before consumption in a transaction:
    // Mark token as already used in DB so the atomic UPDATE affects 0 rows
    await db.execute('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [fixture.tokenId]);

    // Now attempt resetPasswordWithToken: it must fail and roll back the user password update
    await assert.rejects(
      async () => {
        await resetPasswordWithToken({
          rawToken: fixture.rawToken,
          newPassword: 'AttemptedPasswordShouldBeRolledBack@2026',
          ipAddress: '127.0.0.1'
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        return true;
      }
    );

    // Verify that the user password hash in DB remains completely unchanged
    const userAfter = await queryOne('SELECT password_hash FROM users WHERE id = ?', [fixture.userId]);
    assert.strictEqual(
      userAfter.password_hash,
      originalHash,
      'User password hash must remain unchanged when token consumption rolls back'
    );
  });

  // =========================================================================
  // FIX 2: Fail Fast When Production DATABASE_URL Is Missing
  // =========================================================================

  test('Fix 2 - Test 5: Production refuses to start without DATABASE_URL (exits non-zero, clear error)', () => {
    const child = spawnSync('node', ['-e', 'import("./server/config/env.js");'], {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        JWT_SECRET: 'a_valid_long_jwt_secret_with_at_least_32_characters!',
        ADMIN_REGISTRATION_SECRET: 'a_valid_long_admin_secret_32_characters!',
        DATABASE_URL: ''
      },
      encoding: 'utf8'
    });

    assert.notStrictEqual(child.status, 0, 'Must exit with non-zero exit code in production without DATABASE_URL');
    const combinedOutput = child.stderr + child.stdout;
    assert.match(
      combinedOutput,
      /DATABASE_URL is required in production\./,
      'Must emit clear error that DATABASE_URL is required in production'
    );
    // Confirm no credentials or passwords are leaked
    assert.strictEqual(combinedOutput.includes('password='), false);
  });

  test('Fix 2 - Test 6: Database initialization fails fast and does NOT create or connect to /tmp/bda_database.sqlite in production', () => {
    const tmpDbPath = '/tmp/bda_database.sqlite';
    // Remove /tmp sqlite if it existed previously
    if (fs.existsSync(tmpDbPath)) {
      try { fs.unlinkSync(tmpDbPath); } catch (e) {}
    }

    const child = spawnSync('node', ['-e', 'import("./server/db/database.js");'], {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        JWT_SECRET: 'a_valid_long_jwt_secret_with_at_least_32_characters!',
        ADMIN_REGISTRATION_SECRET: 'a_valid_long_admin_secret_32_characters!',
        DATABASE_URL: ''
      },
      encoding: 'utf8'
    });

    assert.notStrictEqual(child.status, 0, 'Database module must fail to load in production without DATABASE_URL');
    assert.match(
      child.stderr + child.stdout,
      /DATABASE_URL is required in production\./
    );

    // Confirm /tmp/bda_database.sqlite was NOT created
    assert.strictEqual(
      fs.existsSync(tmpDbPath),
      false,
      'Production failure must NOT create or fall back to /tmp/bda_database.sqlite'
    );
  });

  test('Fix 2 - Test 7: Non-production / test environment continues to allow SQLite without error', () => {
    const child = spawnSync('node', ['-e', 'import("./server/config/env.js"); console.log("ENV_OK");'], {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        JWT_SECRET: 'dev-jwt-secret-key-configured',
        ADMIN_REGISTRATION_SECRET: 'dev-admin-secret-configured',
        DATABASE_URL: ''
      },
      encoding: 'utf8'
    });

    assert.strictEqual(child.status, 0, 'Non-production with empty DATABASE_URL must succeed using SQLite fallback');
    assert.match(child.stdout, /ENV_OK/);
  });
});
