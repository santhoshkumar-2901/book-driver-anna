import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connect } from '@tidbcloud/serverless';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { ENV } from '../config/env.js';
import { SCHEMA_SQL } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const isTiDB = Boolean(ENV.DATABASE_URL && ENV.DATABASE_URL.trim().length > 0);

let sqliteDb = null;
let tidbConn = null;

if (isTiDB) {
  try {
    tidbConn = connect({ url: ENV.DATABASE_URL.trim() });
    console.log('[DATABASE] Initialized TiDB Cloud connection (Serverless HTTP Driver)');
    // Auto-create essential tables if not exist in TiDB Cloud
    tidbConn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(64) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'customer',
        area VARCHAR(255) NOT NULL DEFAULT 'Indiranagar',
        status VARCHAR(32) NOT NULL DEFAULT 'Active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_users_email (email),
        INDEX idx_users_phone (phone)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(err => {
      console.warn('[DATABASE] TiDB users auto-init note:', err.message);
    });

    tidbConn.execute(`
      CREATE TABLE IF NOT EXISTS drivers (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(64) NOT NULL,
        license_number VARCHAR(64) NOT NULL UNIQUE,
        hub_area VARCHAR(255) NOT NULL DEFAULT 'Indiranagar',
        experience_years VARCHAR(64) DEFAULT '5 Years',
        specialization VARCHAR(255) DEFAULT 'Manual & Automatic Cars',
        rating DECIMAL(3,2) DEFAULT 4.95,
        trips_completed INT DEFAULT 0,
        upi_id VARCHAR(255) DEFAULT NULL,
        status VARCHAR(32) DEFAULT 'Active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_drivers_phone (phone),
        INDEX idx_drivers_license (license_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(err => {
      console.warn('[DATABASE] TiDB drivers auto-init note:', err.message);
    });

    tidbConn.execute(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_prt_user (user_id),
        INDEX idx_prt_hash (token_hash)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(err => {
      console.warn('[DATABASE] TiDB password_reset_tokens auto-init note:', err.message);
    });

    tidbConn.execute(`
      CREATE TABLE IF NOT EXISTS service_pricing (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        category VARCHAR(32) NOT NULL,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        unit VARCHAR(64) NULL,
        description TEXT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pricing_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(err => {
      console.warn('[DATABASE] TiDB service_pricing auto-init note:', err.message);
    });

    tidbConn.execute(`
      CREATE TABLE IF NOT EXISTS bookings (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        user_id VARCHAR(64) NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(64) NOT NULL,
        customer_email VARCHAR(255) NULL,
        booking_type VARCHAR(32) NOT NULL,
        trip_type VARCHAR(64) NOT NULL,
        service_name VARCHAR(255) NOT NULL,
        pickup_area VARCHAR(255) NOT NULL,
        drop_location TEXT NULL,
        date VARCHAR(64) NOT NULL,
        time VARCHAR(64) NOT NULL,
        calculated_fare DECIMAL(10,2) NOT NULL,
        payment_mode VARCHAR(64) DEFAULT 'cash',
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        cancellation_reason TEXT NULL,
        assigned_driver_id VARCHAR(64) NULL,
        assigned_driver_name VARCHAR(255) NULL,
        assigned_driver_phone VARCHAR(64) NULL,
        idempotency_key VARCHAR(128) NULL UNIQUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_bookings_user_id (user_id),
        INDEX idx_bookings_phone (customer_phone),
        INDEX idx_bookings_date_status (date, status),
        INDEX idx_bookings_driver_slot (assigned_driver_id, date, time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(err => {
      console.warn('[DATABASE] TiDB bookings auto-init note:', err.message);
    });

    tidbConn.execute(`
      CREATE INDEX IF NOT EXISTS idx_bookings_driver_slot ON bookings (assigned_driver_id, date, time);
    `).catch(err => {
      const isExpected = err?.message?.includes('Duplicate key') ||
        err?.message?.includes('already exists') ||
        err?.code === 'ER_DUP_KEYNAME' ||
        err?.errno === 1061;
      if (!isExpected) {
        console.warn('[DATABASE] TiDB idx_bookings_driver_slot auto-init note:', err.message);
      }
    });

    tidbConn.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(64) NULL,
        action VARCHAR(128) NOT NULL,
        resource_type VARCHAR(64) NOT NULL,
        resource_id VARCHAR(64) NULL,
        details TEXT NULL,
        ip_address VARCHAR(64) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(err => {
      console.warn('[DATABASE] TiDB audit_logs auto-init note:', err.message);
    });
  } catch (err) {
    console.error('[DATABASE] Failed to initialize TiDB Cloud connection:', err.message);
    throw err;
  }
} else {
  if (ENV.IS_PRODUCTION) {
    throw new Error('DATABASE_URL is required in production.');
  }

  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
  let dbFilePath;

  if (isServerless) {
    dbFilePath = '/tmp/bda_database.sqlite';
  } else {
    dbFilePath = path.isAbsolute(ENV.DB_PATH) 
      ? ENV.DB_PATH 
      : path.resolve(__dirname, '../../', ENV.DB_PATH);
  }

  try {
    const dir = path.dirname(dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    sqliteDb = new DatabaseSync(dbFilePath);
  } catch (err) {
    console.warn(`[DATABASE] Could not open SQLite at ${dbFilePath} (${err.message}). Using in-memory database.`);
    sqliteDb = new DatabaseSync(':memory:');
  }

  try {
    sqliteDb.exec('PRAGMA journal_mode = WAL;');
  } catch (e) {
    try { sqliteDb.exec('PRAGMA journal_mode = MEMORY;'); } catch (err) {}
  }
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  sqliteDb.exec('PRAGMA synchronous = NORMAL;');

  // Execute embedded schema to guarantee complete table definitions in all environments
  try {
    sqliteDb.exec(SCHEMA_SQL);
  } catch (e) {
    console.warn('[DATABASE] Schema initialization note:', e.message);
  }

  try {
    sqliteDb.exec('ALTER TABLE bookings ADD COLUMN assigned_driver_name TEXT;');
  } catch (e) {}
  try {
    sqliteDb.exec('ALTER TABLE bookings ADD COLUMN assigned_driver_phone TEXT;');
  } catch (e) {}
  try {
    sqliteDb.exec("ALTER TABLE drivers ADD COLUMN upi_id TEXT DEFAULT NULL;");
  } catch (e) {}

  console.log(`[DATABASE] Connected to SQLite at ${dbFilePath} (foreign keys enabled)`);
}

/**
 * Normalize database row objects so all column names are accessible via lowercase keys
 */
export function normalizeRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  const normalized = { ...row };
  for (const [key, val] of Object.entries(row)) {
    const lower = key.toLowerCase();
    if (lower !== key && !(lower in normalized)) {
      normalized[lower] = val;
    }
  }
  return normalized;
}

export function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeRow);
}

/**
 * Execute a query returning a single row (or null if not found)
 */
export async function queryOne(sql, params = []) {
  if (isTiDB) {
    const rows = await tidbConn.execute(sql, params);
    return Array.isArray(rows) && rows.length > 0 ? normalizeRow(rows[0]) : null;
  } else {
    const row = sqliteDb.prepare(sql).get(...params);
    return row ? normalizeRow(row) : null;
  }
}

/**
 * Execute a query returning all matching rows as an array
 */
export async function queryAll(sql, params = []) {
  if (isTiDB) {
    const rows = await tidbConn.execute(sql, params);
    return Array.isArray(rows) ? normalizeRows(rows) : [];
  } else {
    const rows = sqliteDb.prepare(sql).all(...params);
    return normalizeRows(rows);
  }
}

/**
 * Execute an INSERT / UPDATE / DELETE statement
 */
export async function execute(sql, params = []) {
  if (isTiDB) {
    const res = await tidbConn.execute(sql, params);
    return {
      affectedRows: res?.rowsAffected ?? 0,
      insertId: res?.lastInsertId ?? null,
      raw: res
    };
  } else {
    const res = sqliteDb.prepare(sql).run(...params);
    return {
      affectedRows: res.changes,
      insertId: res.lastInsertRowid,
      raw: res
    };
  }
}

/**
 * Direct statement execution
 */
export async function exec(sql) {
  if (isTiDB) {
    return await tidbConn.execute(sql);
  } else {
    return sqliteDb.exec(sql);
  }
}

let sqliteTxMutex = Promise.resolve();

/**
 * Execute operations within a transaction
 */
export async function withTransaction(callback) {
  if (isTiDB) {
    const tx = await tidbConn.begin();
    try {
      const txExecutor = {
        queryOne: async (sql, params = []) => {
          const rows = await tx.execute(sql, params);
          return Array.isArray(rows) && rows.length > 0 ? normalizeRow(rows[0]) : null;
        },
        queryAll: async (sql, params = []) => {
          const rows = await tx.execute(sql, params);
          return Array.isArray(rows) ? normalizeRows(rows) : [];
        },
        execute: async (sql, params = []) => {
          const res = await tx.execute(sql, params);
          return {
            affectedRows: res?.rowsAffected ?? 0,
            insertId: res?.lastInsertId ?? null
          };
        }
      };
      const result = await callback(txExecutor);
      await tx.commit();
      return result;
    } catch (err) {
      await tx.rollback().catch(() => {});
      throw err;
    }
  } else {
    // SQLite operates on a single connection handle; serialize concurrent async transactions
    // to prevent "cannot start a transaction within a transaction" errors.
    let release;
    const currentLock = new Promise((resolve) => { release = resolve; });
    const previousLock = sqliteTxMutex;
    sqliteTxMutex = previousLock.then(() => currentLock, () => currentLock);
    await previousLock;

    try {
      sqliteDb.exec('BEGIN IMMEDIATE;');
      try {
        const txExecutor = {
          queryOne: async (sql, params = []) => {
            const row = sqliteDb.prepare(sql).get(...params);
            return row ? normalizeRow(row) : null;
          },
          queryAll: async (sql, params = []) => {
            const rows = sqliteDb.prepare(sql).all(...params);
            return normalizeRows(rows);
          },
          execute: async (sql, params = []) => {
            const res = sqliteDb.prepare(sql).run(...params);
            return { affectedRows: res.changes, insertId: res.lastInsertRowid };
          }
        };
        const result = await callback(txExecutor);
        sqliteDb.exec('COMMIT;');
        return result;
      } catch (err) {
        try { sqliteDb.exec('ROLLBACK;'); } catch (e) {}
        throw err;
      }
    } finally {
      release();
    }
  }
}

export const db = {
  isTiDB,
  queryOne,
  queryAll,
  execute,
  exec,
  withTransaction,
  prepare(sql) {
    if (!isTiDB && sqliteDb) {
      return sqliteDb.prepare(sql);
    }
    return {
      get: (...params) => queryOne(sql, params),
      all: (...params) => queryAll(sql, params),
      run: (...params) => execute(sql, params)
    };
  }
};
