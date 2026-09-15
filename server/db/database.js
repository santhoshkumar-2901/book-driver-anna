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
  const dbFilePath = path.isAbsolute(ENV.DB_PATH) 
    ? ENV.DB_PATH 
    : path.resolve(__dirname, '../../', ENV.DB_PATH);

  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  sqliteDb = new DatabaseSync(dbFilePath);
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  sqliteDb.exec('PRAGMA synchronous = NORMAL;');

  const schemaPath = path.resolve(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    sqliteDb.exec(schemaSql);
  }

  console.log(`[DATABASE] Connected to local SQLite at ${dbFilePath} (WAL mode, foreign keys enabled)`);
}

/**
 * Execute a query returning a single row (or null if not found)
 */
export async function queryOne(sql, params = []) {
  if (isTiDB) {
    const rows = await tidbConn.execute(sql, params);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } else {
    const row = sqliteDb.prepare(sql).get(...params);
    return row || null;
  }
}

/**
 * Execute a query returning all matching rows as an array
 */
export async function queryAll(sql, params = []) {
  if (isTiDB) {
    const rows = await tidbConn.execute(sql, params);
    return Array.isArray(rows) ? rows : [];
  } else {
    return sqliteDb.prepare(sql).all(...params);
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
          return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        },
        queryAll: async (sql, params = []) => {
          const rows = await tx.execute(sql, params);
          return Array.isArray(rows) ? rows : [];
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
          return row || null;
        },
        queryAll: async (sql, params = []) => sqliteDb.prepare(sql).all(...params),
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
