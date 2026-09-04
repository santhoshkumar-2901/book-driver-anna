import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ENV } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFilePath = path.isAbsolute(ENV.DB_PATH) 
  ? ENV.DB_PATH 
  : path.resolve(__dirname, '../../', ENV.DB_PATH);

// Ensure parent directory exists
const dir = path.dirname(dbFilePath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new DatabaseSync(dbFilePath);

// Performance and safety pragmas
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA synchronous = NORMAL;');

// Initialize schema
const schemaPath = path.resolve(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
db.exec(schemaSql);

console.log(`[DATABASE] Connected to SQLite database at ${dbFilePath} (WAL mode, foreign keys enabled)`);
