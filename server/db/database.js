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
    // Auto-create password_reset_tokens table if not exists in TiDB
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
      console.warn('[DATABASE] TiDB table auto-init note:', err.message);
    });
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

let adminProvisionPromise = null;

/**
 * Universal Production Administrator Provisioning & Sync
 * Works seamlessly across both SQLite (local / ephemeral) and TiDB Cloud (production).
 * Auto-heals missing admin users, role mismatches, and synchronizes password hashes.
 */
export async function ensureProductionAdmins(force = false) {
  if (adminProvisionPromise && !force) {
    return adminProvisionPromise;
  }

  adminProvisionPromise = (async () => {
    // If TiDB Cloud, ensure users and essential tables exist first
    if (isTiDB && tidbConn) {
      try {
        await tidbConn.execute(`
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(64) NOT NULL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            phone VARCHAR(64) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(32) NOT NULL DEFAULT 'customer',
            area VARCHAR(255) NOT NULL DEFAULT 'Indiranagar',
            status VARCHAR(32) NOT NULL DEFAULT 'Active',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err) {
        console.warn('[DATABASE] TiDB users table ensure notice:', err.message);
      }
    }

    const adminsToProvision = [
      {
        id: 'ADM-PROD-PRIMARY',
        name: 'Book Driver Anna Administrator',
        email: (process.env.ADMIN_EMAIL || 'bookdriveranna@gmail.com').trim().toLowerCase(),
        password: process.env.ADMIN_PASSWORD || 'adminpassword@bda',
        phone: (process.env.ADMIN_PHONE || '+91 78991 20704').trim(),
        area: 'Bengaluru HQ'
      },
      {
        id: 'ADM-PROD-ROOT',
        name: 'System Operations Admin',
        email: 'admin@bookdriveranna.com',
        password: process.env.ADMIN_PASSWORD || 'Admin@Anna2026!',
        phone: '+91 98765 00000',
        area: 'Bengaluru HQ'
      }
    ];

    for (const adm of adminsToProvision) {
      try {
        const existing = await queryOne(
          'SELECT id, name, email, phone, password_hash, role, status FROM users WHERE LOWER(email) = LOWER(?) OR phone = ?',
          [adm.email, adm.phone]
        );

        const targetHash = bcrypt.hashSync(adm.password, 10);

        if (!existing) {
          await execute(`
            INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
            VALUES (?, ?, ?, ?, ?, 'admin', ?, 'Active')
          `, [adm.id, adm.name, adm.email, adm.phone, targetHash, adm.area]);
          console.log(`[DATABASE] Production administrator ensured (created): ${adm.email}`);
        } else {
          const isPasswordValid = bcrypt.compareSync(adm.password, existing.password_hash || '');
          const isRoleAdmin = (existing.role || '').toLowerCase() === 'admin';
          const isActive = existing.status === 'Active';
          const isEmailMatch = (existing.email || '').toLowerCase() === adm.email.toLowerCase();

          if (!isPasswordValid || !isRoleAdmin || !isActive || !isEmailMatch) {
            await execute(
              'UPDATE users SET name = ?, email = ?, password_hash = ?, role = ?, status = ?, area = ? WHERE id = ?',
              [adm.name, adm.email, targetHash, 'admin', 'Active', adm.area, existing.id]
            );
            console.log(`[DATABASE] Production administrator synchronized: ${adm.email}`);
          }
        }
      } catch (err) {
        console.warn(`[DATABASE] Admin provisioning note for ${adm.email}:`, err.message);
      }
    }
  })().catch((err) => {
    adminProvisionPromise = null;
    throw err;
  });

  return adminProvisionPromise;
}

// Trigger unified admin provisioning on startup for both SQLite and TiDB Cloud
ensureProductionAdmins().catch((err) => {
  console.warn('[DATABASE] Initial admin ensure notice:', err.message);
});

let driverProvisionPromise = null;

export const DEFAULT_PRODUCTION_DRIVERS = [
  {
    driverId: 'DRV-1001',
    userId: 'USR-DRV-1001',
    name: 'Manjunath Gowda',
    phone: '+91 98860 12345',
    email: 'manjunath.gowda@driveranna.com',
    licenseNumber: 'KA-04-2021-0098745',
    password: process.env.DRIVER_DEFAULT_PASSWORD || 'driver123',
    hubArea: 'Indiranagar',
    experienceYears: 12,
    specialization: 'Manual & Automatic Cars',
    rating: 4.98,
    tripsCompleted: 3420,
    upiId: 'manjunath.gowda@oksbi'
  },
  {
    driverId: 'DRV-1002',
    userId: 'USR-DRV-1002',
    name: 'Venkatesh Prasad',
    phone: '+91 98450 67890',
    email: 'venkatesh.prasad@driveranna.com',
    licenseNumber: 'KA-05-2020-0081234',
    password: process.env.DRIVER_DEFAULT_PASSWORD || 'driver123',
    hubArea: 'Koramangala',
    experienceYears: 9,
    specialization: 'Automatic Luxury & SUVs',
    rating: 4.95,
    tripsCompleted: 2890,
    upiId: 'venkatesh.prasad@okaxis'
  },
  {
    driverId: 'DRV-1003',
    userId: 'USR-DRV-1003',
    name: 'Suresh Kumar',
    phone: '+91 99002 55667',
    email: 'suresh.kumar@driveranna.com',
    licenseNumber: 'KA-01-2019-0043120',
    password: process.env.DRIVER_DEFAULT_PASSWORD || 'driver123',
    hubArea: 'Whitefield',
    experienceYears: 14,
    specialization: 'All Cars & Heavy Sedans',
    rating: 4.96,
    tripsCompleted: 4150,
    upiId: 'suresh.anna@paytm'
  }
];

/**
 * Universal Production Driver Partner Fleet Provisioning & Sync
 * Works seamlessly across both SQLite (local / ephemeral) and TiDB Cloud (production).
 * Auto-creates tables, heals missing driver partner records, and synchronizes credentials.
 */
export async function ensureProductionDrivers(force = false) {
  if (driverProvisionPromise && !force) {
    return driverProvisionPromise;
  }

  driverProvisionPromise = (async () => {
    // 1. If TiDB Cloud, ensure drivers table exists
    if (isTiDB && tidbConn) {
      try {
        await tidbConn.execute(`
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
            upi_id VARCHAR(255) DEFAULT 'anna.driver@oksbi',
            status VARCHAR(32) DEFAULT 'Active',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_drivers_phone (phone),
            INDEX idx_drivers_license (license_number)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err) {
        console.warn('[DATABASE] TiDB drivers table ensure notice:', err.message);
      }
    } else if (sqliteDb) {
      try {
        sqliteDb.exec("ALTER TABLE drivers ADD COLUMN upi_id TEXT DEFAULT 'anna.driver@oksbi';");
      } catch (e) {}
    }

    // 2. Ensure each production driver partner exists
    for (const drv of DEFAULT_PRODUCTION_DRIVERS) {
      try {
        const cleanPhone = drv.phone.replace(/[^0-9]/g, '').slice(-10);
        let user = await queryOne(
          'SELECT id, name, email, phone, password_hash, role, status FROM users WHERE LOWER(email) = LOWER(?) OR phone = ? OR phone LIKE ?',
          [drv.email, drv.phone, `%${cleanPhone}`]
        );

        const targetHash = bcrypt.hashSync(drv.password, 10);

        if (!user) {
          await execute(`
            INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
            VALUES (?, ?, ?, ?, ?, 'driver', ?, 'Active')
          `, [drv.userId, drv.name, drv.email, drv.phone, targetHash, drv.hubArea]);
          user = { id: drv.userId };
          console.log(`[DATABASE] Production driver user created: ${drv.name} (${drv.phone})`);
        } else {
          const isPasswordValid = bcrypt.compareSync(drv.password, user.password_hash || '');
          const isRoleDriver = (user.role || '').toLowerCase() === 'driver';
          if (!isPasswordValid || !isRoleDriver) {
            await execute(
              'UPDATE users SET password_hash = ?, role = ?, status = ? WHERE id = ?',
              [targetHash, 'driver', 'Active', user.id]
            );
          }
        }

        // Check if driver profile exists
        const driverRecord = await queryOne(
          'SELECT id FROM drivers WHERE user_id = ? OR LOWER(license_number) = LOWER(?)',
          [user.id, drv.licenseNumber]
        );

        if (!driverRecord) {
          try {
            await execute(`
              INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, experience_years, specialization, rating, trips_completed, upi_id, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
            `, [
              drv.driverId,
              user.id,
              drv.name,
              drv.phone,
              drv.licenseNumber,
              drv.hubArea,
              drv.experienceYears,
              drv.specialization,
              drv.rating,
              drv.tripsCompleted,
              drv.upiId
            ]);
          } catch (e) {
            await execute(`
              INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, experience_years, specialization, rating, trips_completed, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
            `, [
              drv.driverId,
              user.id,
              drv.name,
              drv.phone,
              drv.licenseNumber,
              drv.hubArea,
              drv.experienceYears,
              drv.specialization,
              drv.rating,
              drv.tripsCompleted
            ]);
          }
          console.log(`[DATABASE] Production driver profile created: ${drv.name} [DL: ${drv.licenseNumber}]`);
        }
      } catch (err) {
        console.warn(`[DATABASE] Driver provisioning note for ${drv.name}:`, err.message);
      }
    }
  })().catch((err) => {
    driverProvisionPromise = null;
    throw err;
  });

  return driverProvisionPromise;
}

// Trigger driver provisioning on startup for both SQLite and TiDB Cloud
ensureProductionDrivers().catch((err) => {
  console.warn('[DATABASE] Initial driver ensure notice:', err.message);
});

