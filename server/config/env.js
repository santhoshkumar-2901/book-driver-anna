import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET) {
  throw new Error('Fatal: JWT_SECRET environment variable is required.');
}

if (!process.env.ADMIN_REGISTRATION_SECRET) {
  throw new Error('Fatal: ADMIN_REGISTRATION_SECRET environment variable is required.');
}

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: isProduction,
  PORT: parseInt(process.env.PORT || '5000', 10),

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  GEMINI_API_KEY:
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    '',

  ADMIN_REGISTRATION_SECRET: process.env.ADMIN_REGISTRATION_SECRET,

  CORS_ORIGIN:
    process.env.CORS_ORIGIN ||
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000',

  DB_PATH:
    process.env.DB_PATH ||
    (process.env.NODE_ENV === 'test'
      ? './bda_test_database.sqlite'
      : './bda_database.sqlite'),

  DATABASE_URL: process.env.DATABASE_URL || '',
};
