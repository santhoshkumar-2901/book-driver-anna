import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// In production, JWT_SECRET MUST be set in environment variables.
// In local development/testing, auto-generate or use a stable fallback.
const isProduction = process.env.NODE_ENV === 'production';
const defaultDevSecret = 'bda_dev_secret_super_secure_key_2026_jwt_token_sign';

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: isProduction,
  PORT: parseInt(process.env.PORT || '5000', 10),
  JWT_SECRET: process.env.JWT_SECRET || defaultDevSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '',
  ADMIN_REGISTRATION_SECRET: process.env.ADMIN_REGISTRATION_SECRET || 'ANNA_SECURE_ADMIN_KEY_9921',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000',
  DB_PATH: process.env.DB_PATH || './bda_database.sqlite'
};

if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET === defaultDevSecret)) {
  console.warn('[SECURITY WARNING] Running in production with default or unset JWT_SECRET!');
}
