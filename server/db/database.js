import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connect } from '@tidbcloud/serverless';
import { DatabaseSync } from 'node:sqlite';
import { ENV } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const isTiDB = Boolean(ENV.DATABASE_URL && ENV.DATABASE_URL.trim().length > 0);

let sqliteDb = null;
let tidbConn = null;

if (isTiDB) {
  try {
    tidbConn = connect({ url: ENV.DATABASE_URL.trim() });
    console.log('[DATABASE] Initialized TiDB Cloud connection (Serverless HTTP Driver)');
  } catch (err) {
    console.error('[DATABASE] Failed to initialize TiDB Cloud connection:', err.message);
    throw err;
  }
} else {
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

  const schemaPath = path.resolve(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    try {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      sqliteDb.exec(schemaSql);
    } catch (e) {
      console.warn('[DATABASE] Schema initialization note:', e.message);
    }
  }

  try {
    sqliteDb.exec('ALTER TABLE bookings ADD COLUMN assigned_driver_name TEXT;');
  } catch (e) {}
  try {
    sqliteDb.exec('ALTER TABLE bookings ADD COLUMN assigned_driver_phone TEXT;');
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
      sqliteDb.exec('ROLLBACK;');
      throw err;
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
