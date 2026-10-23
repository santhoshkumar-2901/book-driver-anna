// Ensure test environment variables are securely initialized before any server code runs
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.DB_PATH = './bda_test_database.sqlite';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'bda-test-jwt-secret-key-32-chars-long-minimum!';
process.env.ADMIN_REGISTRATION_SECRET = process.env.ADMIN_REGISTRATION_SECRET || 'bda-test-admin-registration-secret-32chars!';
process.env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://book-driver-anna.vercel.app';
process.env.GUEST_TOKEN_KEYRING = process.env.GUEST_TOKEN_KEYRING || JSON.stringify({ v1: 'bda-test-guest-token-secret-key-32chars-minimum!' });
process.env.GUEST_TOKEN_ACTIVE_VERSION = process.env.GUEST_TOKEN_ACTIVE_VERSION || 'v1';
