import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { queryOne, execute } from '../db/database.js';

const FORBIDDEN_PASSWORDS = new Set([
  'admin123',
  'password123',
  'admin',
  'password',
  '12345678',
  'adminadmin',
  'root',
  'toor'
]);

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        args[key] = nextArg;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

export async function bootstrapAdmin(options = {}) {
  const email = (options.email || process.env.BOOTSTRAP_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@bookdriveranna.com').trim().toLowerCase();
  const password = options.password || process.env.BOOTSTRAP_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  const name = (options.name || process.env.BOOTSTRAP_ADMIN_NAME || process.env.ADMIN_NAME || 'Production Administrator').trim();
  const phone = (options.phone || process.env.BOOTSTRAP_ADMIN_PHONE || process.env.ADMIN_PHONE || '+91 98765 00000').trim();
  const area = (options.area || process.env.BOOTSTRAP_ADMIN_AREA || process.env.ADMIN_AREA || 'Bengaluru HQ').trim();

  // 1. Password Presence & Length Validation
  if (!password || typeof password !== 'string' || password.trim().length === 0) {
    throw new Error('Admin password is required. Supply via --password or BOOTSTRAP_ADMIN_PASSWORD environment variable.');
  }

  const trimmedPassword = password.trim();
  if (trimmedPassword.length < 8) {
    throw new Error('Admin password must be at least 8 characters long.');
  }

  // 2. Reject Default / Insecure Passwords
  if (FORBIDDEN_PASSWORDS.has(trimmedPassword.toLowerCase())) {
    throw new Error('Insecure or default password detected. Please supply a strong, unique production password.');
  }

  // 3. Email Format Validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error(`Invalid email address format: ${email}`);
  }

  // 4. Check for existing user by email
  const existingUser = await queryOne('SELECT id, email, role FROM users WHERE email = ?', [email]);
  if (existingUser) {
    if (existingUser.role === 'admin') {
      console.log(`[BOOTSTRAP] Admin user '${email}' already exists (ID: ${existingUser.id}). No action taken.`);
      return { success: true, created: false, id: existingUser.id, email };
    }
    throw new Error(`A non-admin user with email '${email}' already exists (ID: ${existingUser.id}, role: ${existingUser.role}).`);
  }

  // Check for existing user by phone
  const existingPhoneUser = await queryOne('SELECT id, email, role FROM users WHERE phone = ?', [phone]);
  if (existingPhoneUser) {
    throw new Error(`A user with phone number '${phone}' already exists (ID: ${existingPhoneUser.id}, email: ${existingPhoneUser.email}). Please provide a unique phone via --phone or BOOTSTRAP_ADMIN_PHONE.`);
  }

  // 5. Generate secure hash & insert
  const adminId = `ADM-${Date.now().toString(36).toUpperCase()}`;
  const passwordHash = bcrypt.hashSync(trimmedPassword, 10);

  await execute(`
    INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
    VALUES (?, ?, ?, ?, ?, 'admin', ?, 'Active')
  `, [adminId, name, email, phone, passwordHash, area]);

  console.log(`[BOOTSTRAP] Admin user '${email}' successfully created (ID: ${adminId}).`);
  return { success: true, created: true, id: adminId, email };
}

// Direct CLI Execution
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const cliArgs = parseArgs(process.argv.slice(2));
  bootstrapAdmin(cliArgs)
    .then((result) => {
      console.log('[BOOTSTRAP] Completed:', JSON.stringify(result));
      process.exit(0);
    })
    .catch((err) => {
      console.error('[BOOTSTRAP ERROR]:', err.message);
      process.exit(1);
    });
}
