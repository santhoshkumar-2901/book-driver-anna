import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Strict validation of authentication secrets and production database - no fallback secrets or automatic generation allowed
const jwtSecret = (process.env.JWT_SECRET || '').trim();
const adminSecret = (process.env.ADMIN_REGISTRATION_SECRET || '').trim();
const databaseUrl = (process.env.NODE_ENV === 'test') ? '' : (process.env.DATABASE_URL || '').trim();

if (isProduction) {
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET is required in production and must be at least 32 characters.');
  }
  if (!adminSecret || adminSecret.length < 32) {
    throw new Error('ADMIN_REGISTRATION_SECRET is required in production and must be at least 32 characters.');
  }
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required in production.');
  }
} else {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required and must be explicitly configured.');
  }
  if (!adminSecret) {
    throw new Error('ADMIN_REGISTRATION_SECRET is required and must be explicitly configured.');
  }
}

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: isProduction,
  PORT: parseInt(process.env.PORT || '5000', 10),

  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

  ADMIN_REGISTRATION_SECRET: adminSecret,

  CORS_ORIGIN:
    process.env.CORS_ORIGIN ||
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000',

  FRONTEND_ORIGIN: (process.env.FRONTEND_ORIGIN || 'https://book-driver-anna.vercel.app').replace(/\/+$/, ''),

  // Authoritative default UPI configuration (never silently falls back to real personal address in production)
  DEFAULT_UPI_ID: process.env.DEFAULT_UPI_ID || (isProduction ? '' : 'test.driver@fakeupi'),

  DB_PATH:
    process.env.DB_PATH ||
    (process.env.NODE_ENV === 'test'
      ? './bda_test_database.sqlite'
      : './bda_database.sqlite'),

  DATABASE_URL: databaseUrl,

  // Production Email Delivery Configuration (Gmail SMTP & Resend Fallback)
  GMAIL_USER: process.env.GMAIL_USER || '',
  GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD || '',
  APP_URL: (process.env.APP_URL || (isProduction ? 'https://book-driver-anna.vercel.app' : 'http://localhost:5173')).replace(/\/+$/, ''),

  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '465', 10),
  SMTP_USER: process.env.SMTP_USER || 'resend',
  SMTP_PASS: process.env.SMTP_PASS || process.env.RESEND_API_KEY || '',
  SMTP_FROM: process.env.SMTP_FROM || process.env.EMAIL_FROM || 'Book Driver Anna <onboarding@resend.dev>',
  EMAIL_FROM: process.env.EMAIL_FROM || process.env.SMTP_FROM || 'Book Driver Anna <onboarding@resend.dev>',
};
