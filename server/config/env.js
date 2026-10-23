import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Strict validation of authentication secrets and production database - no fallback secrets or automatic generation allowed
const jwtSecret = (process.env.JWT_SECRET || '').trim();
const adminSecret = (process.env.ADMIN_REGISTRATION_SECRET || '').trim();
const databaseUrl = (process.env.NODE_ENV === 'test') ? '' : (process.env.DATABASE_URL || '').trim();

const rawKeyring = (process.env.GUEST_TOKEN_KEYRING || '').trim();
const activeKeyVersion = (process.env.GUEST_TOKEN_ACTIVE_VERSION || 'v1').trim();
let guestTokenKeyring = {};

if (rawKeyring) {
  try {
    guestTokenKeyring = JSON.parse(rawKeyring);
  } catch (e) {
    throw new Error('GUEST_TOKEN_KEYRING must be a valid JSON object string.');
  }
} else if (process.env.GUEST_TOKEN_SECRET) {
  guestTokenKeyring = { [activeKeyVersion]: process.env.GUEST_TOKEN_SECRET.trim() };
} else if (!isProduction) {
  guestTokenKeyring = { v1: 'bda-dev-guest-token-secret-key-32chars-minimum!' };
}

const activeSecret = guestTokenKeyring[activeKeyVersion];

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
  if (!activeSecret || activeSecret.length < 32) {
    throw new Error('GUEST_TOKEN_KEYRING must define a secret of at least 32 characters for GUEST_TOKEN_ACTIVE_VERSION in production.');
  }
} else {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required and must be explicitly configured.');
  }
  if (!adminSecret) {
    throw new Error('ADMIN_REGISTRATION_SECRET is required and must be explicitly configured.');
  }
  if (!activeSecret || activeSecret.length < 32) {
    throw new Error(`GUEST_TOKEN_KEYRING missing valid secret (min 32 chars) for active version '${activeKeyVersion}'.`);
  }
}

// Real Razorpay gateway configuration (fail-closed)
const razorpayKeyId = (process.env.RAZORPAY_KEY_ID || '').trim();
const razorpayKeySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
const razorpayWebhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
const razorpayEnabledRaw = (process.env.RAZORPAY_ENABLED || '').trim().toLowerCase();
const isRazorpayExplicitlyEnabled = razorpayEnabledRaw === 'true' || razorpayEnabledRaw === '1';

if (isRazorpayExplicitlyEnabled) {
  if (!razorpayKeyId || razorpayKeyId.length < 8) {
    throw new Error('RAZORPAY_KEY_ID is required when RAZORPAY_ENABLED is true.');
  }
  if (!razorpayKeySecret || razorpayKeySecret.length < 16) {
    throw new Error('RAZORPAY_KEY_SECRET is required when RAZORPAY_ENABLED is true (min 16 chars).');
  }
  if (!razorpayWebhookSecret || razorpayWebhookSecret.length < 16) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is required when RAZORPAY_ENABLED is true (min 16 chars).');
  }
}

const isRazorpayConfigValid = Boolean(
  isRazorpayExplicitlyEnabled &&
  razorpayKeyId.length >= 8 &&
  razorpayKeySecret.length >= 16 &&
  razorpayWebhookSecret.length >= 16
);

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: isProduction,
  PORT: parseInt(process.env.PORT || '5000', 10),

  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

  ADMIN_REGISTRATION_SECRET: adminSecret,
  GUEST_TOKEN_KEYRING: guestTokenKeyring,
  GUEST_TOKEN_ACTIVE_VERSION: activeKeyVersion,

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
  OSRM_BASE_URL: (process.env.OSRM_BASE_URL || 'https://router.project-osrm.org').replace(/\/+$/, ''),
  REALTIME_PORT: parseInt(process.env.REALTIME_PORT || '5001', 10),
  REALTIME_SERVICE_URL: (process.env.REALTIME_SERVICE_URL || '').replace(/\/+$/, ''),
  REALTIME_INTERNAL_SECRET: process.env.REALTIME_INTERNAL_SECRET || '',

  // Real Razorpay Gateway Configuration (Fail-closed: enabled only if explicitly turned on with valid secrets)
  RAZORPAY_KEY_ID: razorpayKeyId,
  RAZORPAY_KEY_SECRET: razorpayKeySecret,
  RAZORPAY_WEBHOOK_SECRET: razorpayWebhookSecret,
  RAZORPAY_ENABLED: isRazorpayConfigValid,
};

/**
 * Strict fail-closed check: enables real Razorpay gateway processing ONLY when
 * RAZORPAY_ENABLED is explicitly true AND all required keys/secrets are present.
 * Mere presence of environment variables without RAZORPAY_ENABLED=true will never enable real payments.
 */
export function isRazorpayPaymentAllowed() {
  const enabledRaw = (process.env.RAZORPAY_ENABLED !== undefined ? process.env.RAZORPAY_ENABLED : (ENV.RAZORPAY_ENABLED ? 'true' : '')).trim().toLowerCase();
  const isExplicitlyEnabled = enabledRaw === 'true' || enabledRaw === '1';
  const creds = getRazorpayCredentials();

  return Boolean(
    isExplicitlyEnabled &&
    creds.keyId.length >= 8 &&
    creds.keySecret.length >= 16 &&
    creds.webhookSecret.length >= 16
  );
}

/**
 * Returns active Razorpay credentials from process.env with fallback to initial ENV object.
 */
export function getRazorpayCredentials() {
  return {
    keyId: (process.env.RAZORPAY_KEY_ID || ENV.RAZORPAY_KEY_ID || '').trim(),
    keySecret: (process.env.RAZORPAY_KEY_SECRET || ENV.RAZORPAY_KEY_SECRET || '').trim(),
    webhookSecret: (process.env.RAZORPAY_WEBHOOK_SECRET || ENV.RAZORPAY_WEBHOOK_SECRET || '').trim()
  };
}

/**
 * Strict fail-closed check: enables dummy checkout simulation ONLY when
 * NODE_ENV is explicitly 'development' or 'test' AND IS_PRODUCTION is false.
 * Missing, empty, staging, production, or unknown environments permanently fail closed.
 */
export function isDummyPaymentAllowed() {
  const env = (process.env.NODE_ENV || '').trim().toLowerCase();
  const isExplicitDevOrTest = env === 'development' || env === 'test';
  const isProdFlag = Boolean(ENV.IS_PRODUCTION);
  return isExplicitDevOrTest && !isProdFlag;
}
