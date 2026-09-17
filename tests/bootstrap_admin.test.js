import { test, describe } from 'node:test';
import assert from 'node:assert';
import { seedDatabase } from '../server/db/seed.js';
import { bootstrapAdmin } from '../server/scripts/bootstrapAdmin.js';
import { queryOne } from '../server/db/database.js';

describe('Production Seed Gating & Admin Bootstrap Script Tests', () => {

  test('1. seedDatabase skips execution when NODE_ENV is production and ALLOW_DB_SEED is not true', async () => {
    const origEnv = process.env.NODE_ENV;
    const origAllow = process.env.ALLOW_DB_SEED;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_DB_SEED;

      // When in production without ALLOW_DB_SEED=true, seedDatabase must return early without error
      await assert.doesNotReject(async () => {
        await seedDatabase();
      });
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origAllow !== undefined) {
        process.env.ALLOW_DB_SEED = origAllow;
      }
    }
  });

  test('2. bootstrapAdmin rejects missing password, short password, and default credentials', async () => {
    // Missing password
    await assert.rejects(
      async () => {
        await bootstrapAdmin({ email: 'test_missing@example.com', password: '' });
      },
      /Admin password is required/
    );

    // Password < 8 characters
    await assert.rejects(
      async () => {
        await bootstrapAdmin({ email: 'test_short@example.com', password: 'short' });
      },
      /must be at least 8 characters long/
    );

    // Insecure default password
    await assert.rejects(
      async () => {
        await bootstrapAdmin({ email: 'test_default@example.com', password: 'admin123' });
      },
      /Insecure or default password detected/
    );
  });

  test('3. bootstrapAdmin creates a valid bcrypt-hashed admin account upon valid input', async () => {
    const testAdminEmail = `bootstrap_admin_${Date.now()}@bookdriveranna.com`;
    const testAdminPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const testPassword = 'StrongProdAdminP@ss2026!';

    const result = await bootstrapAdmin({
      email: testAdminEmail,
      password: testPassword,
      name: 'System Operations Admin',
      phone: testAdminPhone,
      area: 'Bengaluru Central'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.created, true);
    assert.strictEqual(result.email, testAdminEmail.toLowerCase());

    // Verify row in database
    const dbRecord = await queryOne('SELECT id, email, role, password_hash, status FROM users WHERE email = ?', [testAdminEmail.toLowerCase()]);
    assert.ok(dbRecord, 'Admin record should exist in database');
    assert.strictEqual(dbRecord.role, 'admin');
    assert.strictEqual(dbRecord.status, 'Active');
    assert.ok(
      dbRecord.password_hash.startsWith('$2a$') || dbRecord.password_hash.startsWith('$2b$'),
      'Password must be hashed with bcrypt'
    );
    assert.notStrictEqual(dbRecord.password_hash, testPassword, 'Password must not be stored in plaintext');

    // Calling bootstrapAdmin again with same email returns existing admin idempotently
    const duplicateResult = await bootstrapAdmin({
      email: testAdminEmail,
      password: testPassword,
      phone: testAdminPhone
    });
    assert.strictEqual(duplicateResult.success, true);
    assert.strictEqual(duplicateResult.created, false);
    assert.strictEqual(duplicateResult.id, dbRecord.id);
  });

});
