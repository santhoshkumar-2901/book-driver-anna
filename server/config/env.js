import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Resilient fallbacks for production/serverless environments where env vars may not yet be defined
const jwtSecret = process.env.JWT_SECRET || 'bda-secure-production-jwt-fallback-key-2026-32chars!';
const adminSecret = process.env.ADMIN_REGISTRATION_SECRET || 'ANNA2026';

if (!process.env.JWT_SECRET) {
  console.warn('[SECURITY WARNING] JWT_SECRET environment variable is not set. Using secure fallback secret. Set JWT_SECRET in production settings.');
}

if (!process.env.ADMIN_REGISTRATION_SECRET) {
  console.warn('[SECURITY WARNING] ADMIN_REGISTRATION_SECRET is not set. Using fallback secret.');
}

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: isProduction,
  PORT: parseInt(process.env.PORT || '5000', 10),

  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  GEMINI_API_KEY:
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    '',

  ADMIN_REGISTRATION_SECRET: adminSecret,

  CORS_ORIGIN:
    process.env.CORS_ORIGIN ||
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000',

  DB_PATH:
    process.env.DB_PATH ||
    (process.env.NODE_ENV === 'test'
      ? './bda_test_database.sqlite'
      : './bda_database.sqlite'),

  DATABASE_URL: process.env.DATABASE_URL || '',

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
