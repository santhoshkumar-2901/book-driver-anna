import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTiDB,
  ensureDatabaseReady,
  initializeTiDBSchema,
  isTableExistsError,
  isDuplicateColumnError,
  isDuplicateIndexError,
  TIDB_TABLE_DDLS,
  TIDB_COLUMN_MIGRATIONS,
  TIDB_INDEX_CREATIONS,
  _resetTiDBInitForTesting,
  _setTiDBConnForTesting,
  queryOne,
  execute
} from '../server/db/database.js';

describe('Phase 5B — TiDB Initialization Race & Schema Hardening Suite', () => {
  afterEach(() => {
    // Always restore clean state after each test
    _setTiDBConnForTesting(null);
    _resetTiDBInitForTesting();
  });

  // =========================================================================
  // 1. Schema Definitions & Columns
  // =========================================================================
  describe('1. Schema Definitions & Required Objects', () => {
    test('1.1 TIDB_TABLE_DDLS contains all 9 required tables', () => {
      const requiredTables = [
        'users',
        'drivers',
        'password_reset_tokens',
        'service_pricing',
        'bookings',
        'guest_access_tokens',
        'payment_attempts',
        'audit_logs',
        'payment_webhook_events'
      ];

      for (const table of requiredTables) {
        const found = TIDB_TABLE_DDLS.some(ddl =>
          ddl.toLowerCase().includes(`create table if not exists ${table}`)
        );
        assert.ok(found, `TIDB_TABLE_DDLS must define table '${table}'`);
      }
    });

    test('1.2 bookings table DDL includes payment_status and required indexes', () => {
      const bookingsDdl = TIDB_TABLE_DDLS.find(ddl =>
        ddl.includes('CREATE TABLE IF NOT EXISTS bookings')
      );
      assert.ok(bookingsDdl, 'bookings table DDL must exist in TIDB_TABLE_DDLS');

      // payment_status column in base DDL
      assert.ok(
        bookingsDdl.includes("payment_status VARCHAR(32) NOT NULL DEFAULT 'UNPAID'"),
        'bookings DDL must include payment_status column directly'
      );

      // Indexes
      assert.ok(
        bookingsDdl.includes('INDEX idx_bookings_status (status)'),
        'bookings DDL must include idx_bookings_status'
      );
      assert.ok(
        bookingsDdl.includes('INDEX idx_bookings_payment_status (payment_status)'),
        'bookings DDL must include idx_bookings_payment_status'
      );
      assert.ok(
        bookingsDdl.includes('INDEX idx_bookings_driver_slot (assigned_driver_id, date, time)'),
        'bookings DDL must include idx_bookings_driver_slot non-unique index'
      );
    });

    test('1.3 payment_attempts DDL includes gateway_payment_id index', () => {
      const paDdl = TIDB_TABLE_DDLS.find(ddl =>
        ddl.includes('CREATE TABLE IF NOT EXISTS payment_attempts')
      );
      assert.ok(paDdl, 'payment_attempts DDL must exist');
      assert.ok(
        paDdl.includes('INDEX idx_pa_gateway_payment_id (gateway_payment_id)'),
        'payment_attempts DDL must index gateway_payment_id'
      );
    });

    test('1.4 payment_status backfill query strictly uses LEGACY_UNVERIFIED and never marks historical bookings as PAID', () => {
      const fnString = initializeTiDBSchema.toString();
      assert.ok(
        fnString.includes("payment_status = 'LEGACY_UNVERIFIED'"),
        'Backfill query must use LEGACY_UNVERIFIED'
      );
      assert.ok(
        !fnString.includes("payment_status = 'PAID'"),
        'Backfill query must NEVER automatically classify historical bookings as PAID'
      );
    });
  });

  // =========================================================================
  // 2. Idempotent Error Detection Helpers
  // =========================================================================
  describe('2. Idempotent Error Classification', () => {
    test('2.1 isTableExistsError detects table exists codes and messages', () => {
      assert.strictEqual(isTableExistsError({ code: 'ER_TABLE_EXISTS_ERROR' }), true);
      assert.strictEqual(isTableExistsError({ errno: 1050 }), true);
      assert.strictEqual(isTableExistsError({ message: "Table 'users' already exists" }), true);
      assert.strictEqual(isTableExistsError({ code: 'ER_SYNTAX_ERROR', message: 'syntax error near SELECT' }), false);
      assert.strictEqual(isTableExistsError(null), false);
    });

    test('2.2 isDuplicateColumnError detects duplicate column codes and messages', () => {
      assert.strictEqual(isDuplicateColumnError({ code: 'ER_DUP_FIELDNAME' }), true);
      assert.strictEqual(isDuplicateColumnError({ errno: 1060 }), true);
      assert.strictEqual(isDuplicateColumnError({ message: "Duplicate column name 'payment_status'" }), true);
      assert.strictEqual(isDuplicateColumnError({ code: 'ER_NO_SUCH_TABLE', message: "Table doesn't exist" }), false);
      assert.strictEqual(isDuplicateColumnError(null), false);
    });

    test('2.3 isDuplicateIndexError detects duplicate index codes and messages', () => {
      assert.strictEqual(isDuplicateIndexError({ code: 'ER_DUP_KEYNAME' }), true);
      assert.strictEqual(isDuplicateIndexError({ errno: 1061 }), true);
      assert.strictEqual(isDuplicateIndexError({ message: "Duplicate key name 'idx_bookings_status'" }), true);
      assert.strictEqual(isDuplicateIndexError({ message: "Index already exists" }), true);
      assert.strictEqual(isDuplicateIndexError({ code: 'ER_BAD_FIELD_ERROR', message: "Unknown column 'xyz'" }), false);
      assert.strictEqual(isDuplicateIndexError(null), false);
    });
  });

  // =========================================================================
  // 3. Dependent Queries Wait For Initialization
  // =========================================================================
  describe('3. Execution Ordering & Awaiting Initialization', () => {
    test('3.1 Dependent queries await schema initialization completion before executing', async () => {
      const executedSqls = [];
      let initCompleted = false;

      const mockConn = {
        execute: async (sql) => {
          // Add artificial latency to test concurrency waiting
          await new Promise(r => setTimeout(r, 20));
          executedSqls.push(sql);
          if (sql.includes('SELECT 1 as test_col')) {
            assert.strictEqual(
              initCompleted,
              true,
              'Dependent query MUST NOT execute before schema initialization completes'
            );
            return [{ test_col: 1 }];
          }
          return [];
        }
      };

      _setTiDBConnForTesting(mockConn);

      // Launch initialization
      const initPromise = ensureDatabaseReady().then(() => {
        initCompleted = true;
      });

      // Launch dependent query concurrently
      const queryPromise = queryOne('SELECT 1 as test_col');

      await Promise.all([initPromise, queryPromise]);

      const result = await queryPromise;
      assert.ok(result, 'Query must return normalized result');
      assert.strictEqual(result.test_col, 1);
      assert.ok(initCompleted, 'Initialization must have completed');

      // Verify that all 9 tables, 13 migrations, backfill, and 4 indexes were executed in order
      assert.ok(executedSqls.length >= 27, `Expected at least 27 DDL/migration statements, got ${executedSqls.length}`);
      assert.ok(
        executedSqls[0].includes('CREATE TABLE IF NOT EXISTS users'),
        'First statement must be users DDL'
      );
      assert.ok(
        executedSqls[executedSqls.length - 1].includes('SELECT 1 as test_col'),
        'Last statement must be the dependent user query'
      );
    });
  });

  // =========================================================================
  // 4. Retry After Initialization Failure
  // =========================================================================
  describe('4. Failure Recovery & Retry Semantics', () => {
    test('4.1 Initialization failure resets the cached promise so next query can retry', async () => {
      let shouldFail = true;
      let attemptCount = 0;

      const mockConn = {
        execute: async (sql) => {
          if (shouldFail && sql.includes('CREATE TABLE IF NOT EXISTS users')) {
            attemptCount++;
            const err = new Error('ECONNRESET: Simulated transient network drop during TiDB handshake');
            err.code = 'ECONNRESET';
            throw err;
          }
          return [];
        }
      };

      _setTiDBConnForTesting(mockConn);

      // First attempt: should fail fast
      await assert.rejects(
        async () => {
          await ensureDatabaseReady();
        },
        (err) => {
          assert.strictEqual(err.code, 'ECONNRESET');
          return true;
        },
        'First attempt must reject with transient network error'
      );

      assert.strictEqual(attemptCount, 1, 'First attempt must have executed');

      // Allow second attempt to succeed (network recovered)
      shouldFail = false;

      // Second attempt: must NOT be stuck in permanently rejected state
      await assert.doesNotReject(
        async () => {
          await ensureDatabaseReady();
        },
        'Second attempt must retry and succeed after previous failure'
      );
    });
  });

  // =========================================================================
  // 5. Idempotent Object Handling & Unrelated Error Surfacing
  // =========================================================================
  describe('5. Idempotent Migrations & Error Integrity', () => {
    test('5.1 Existing tables, columns, and indexes do NOT trigger duplicate errors', async () => {
      const mockConn = {
        execute: async (sql) => {
          if (sql.includes('CREATE TABLE')) {
            const err = new Error('Table already exists');
            err.code = 'ER_TABLE_EXISTS_ERROR';
            err.errno = 1050;
            throw err;
          }
          if (sql.includes('ALTER TABLE')) {
            const err = new Error("Duplicate column name 'assigned_driver_name'");
            err.code = 'ER_DUP_FIELDNAME';
            err.errno = 1060;
            throw err;
          }
          if (sql.includes('CREATE INDEX')) {
            const err = new Error("Duplicate key name 'idx_bookings_status'");
            err.code = 'ER_DUP_KEYNAME';
            err.errno = 1061;
            throw err;
          }
          return [];
        }
      };

      _setTiDBConnForTesting(mockConn);

      // Must complete cleanly without throwing duplicate errors
      await assert.doesNotReject(
        async () => {
          await ensureDatabaseReady();
        },
        'Existing schema objects must be handled idempotently'
      );
    });

    test('5.2 Unrelated database errors are surfaced and not swallowed', async () => {
      const mockConn = {
        execute: async (sql) => {
          if (sql.includes('ALTER TABLE bookings ADD COLUMN assigned_driver_name')) {
            const err = new Error('Access denied for user to alter table bookings');
            err.code = 'ER_ACCESS_DENIED_ERROR';
            err.errno = 1045;
            throw err;
          }
          return [];
        }
      };

      _setTiDBConnForTesting(mockConn);

      await assert.rejects(
        async () => {
          await ensureDatabaseReady();
        },
        (err) => {
          assert.strictEqual(err.code, 'ER_ACCESS_DENIED_ERROR');
          assert.strictEqual(err.errno, 1045);
          return true;
        },
        'Unrelated error must be surfaced immediately'
      );
    });
  });

  // =========================================================================
  // 6. SQLite Behavior Preserved
  // =========================================================================
  describe('6. SQLite Behavior Preservation', () => {
    test('6.1 In SQLite mode, local database operations work normally without TiDB initialization', async () => {
      _setTiDBConnForTesting(null);
      _resetTiDBInitForTesting();

      // Query local test SQLite database
      const row = await queryOne('SELECT 1 as num');
      assert.ok(row, 'SQLite queryOne must return result');
      assert.strictEqual(row.num, 1);
    });
  });
});
