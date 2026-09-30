import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { queryOne, queryAll, execute, withTransaction } from '../db/database.js';
import { ENV } from '../config/env.js';
import { logAuditEvent } from './auditService.js';
import { sendPasswordResetEmail } from './emailService.js';

const SALT_ROUNDS = 12;
// Pre-computed valid dummy bcrypt hash for timing attack mitigation during failed user lookup
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy_password_timing_defense', SALT_ROUNDS);

export function hashPassword(plainPassword) {
  return bcrypt.hashSync(plainPassword, SALT_ROUNDS);
}

export function isValidBcryptHash(hash) {
  if (!hash || typeof hash !== 'string') return false;
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash);
}

export function verifyPassword(plainPassword, hash) {
  if (!plainPassword || !hash || typeof hash !== 'string') return false;
  if (!isValidBcryptHash(hash)) return false;
  try {
    return bcrypt.compareSync(plainPassword, hash);
  } catch (err) {
    return false;
  }
}

export function generateToken(user) {
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: (user.role || 'customer').toLowerCase(),
    area: user.area
  };
  return jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: ENV.JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, ENV.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export async function registerCustomer({ name, email, phone, password, area = 'Indiranagar', ipAddress = null }) {
  const cleanPhone = phone ? String(phone).replace(/[^0-9]/g, '') : '';
  const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
  const canonicalPhone = cleanPhone.length >= 10 ? `+91 ${last10}` : String(phone).trim();
  const cleanEmail = String(email || '').trim().toLowerCase();

  // 1. Check email
  const existingEmail = await queryOne(
    'SELECT id, email FROM users WHERE LOWER(email) = LOWER(?)',
    [cleanEmail]
  );
  if (existingEmail) {
    const err = new Error('An account already exists with this email.');
    err.statusCode = 409;
    err.code = 'USER_ALREADY_EXISTS';
    throw err;
  }

  // 2. Check phone
  const existingPhone = await queryOne(
    'SELECT id, phone FROM users WHERE phone = ? OR phone = ? OR REPLACE(REPLACE(REPLACE(phone, \' \', \'\'), \'-\', \'\'), \'+\', \'\') LIKE ?',
    [String(phone).trim(), canonicalPhone, `%${last10}`]
  );
  if (existingPhone) {
    const err = new Error('An account already exists with this phone number.');
    err.statusCode = 409;
    err.code = 'USER_ALREADY_EXISTS';
    throw err;
  }

  const userId = 'USR-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const passwordHash = hashPassword(password);

  await execute(`
    INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
    VALUES (?, ?, ?, ?, ?, 'customer', ?, 'Active')
  `, [userId, name.trim(), cleanEmail, canonicalPhone, passwordHash, area]);

  const user = { id: userId, name: name.trim(), email: cleanEmail, phone: canonicalPhone, role: 'customer', area };
  const token = generateToken(user);

  await logAuditEvent({
    userId,
    action: 'USER_REGISTERED',
    resourceType: 'user',
    resourceId: userId,
    ipAddress
  });

  return { user, token };
}

export async function registerAdmin({ name, email, phone, password, secretKey, area = 'Indiranagar', ipAddress = null }) {
  const adminSecret = (ENV.ADMIN_REGISTRATION_SECRET || '').trim();
  if (!adminSecret || !secretKey || typeof secretKey !== 'string') {
    const err = new Error('Invalid Admin Secret Authorization Key.');
    err.statusCode = 403;
    err.code = 'INVALID_ADMIN_SECRET';
    throw err;
  }

  const secretKeyBuf = Buffer.from(secretKey.trim());
  const expectedBuf = Buffer.from(adminSecret);

  if (secretKeyBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(secretKeyBuf, expectedBuf)) {
    const err = new Error('Invalid Admin Secret Authorization Key.');
    err.statusCode = 403;
    err.code = 'INVALID_ADMIN_SECRET';
    throw err;
  }

  const cleanPhone = phone ? String(phone).replace(/[^0-9]/g, '') : '';
  const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
  const canonicalPhone = cleanPhone.length >= 10 ? `+91 ${last10}` : String(phone).trim();
  const cleanEmail = String(email || '').trim().toLowerCase();

  // 1. Check email
  const existingEmail = await queryOne(
    'SELECT id, email FROM users WHERE LOWER(email) = LOWER(?)',
    [cleanEmail]
  );
  if (existingEmail) {
    const err = new Error('An account already exists with this email.');
    err.statusCode = 409;
    err.code = 'USER_ALREADY_EXISTS';
    throw err;
  }

  // 2. Check phone
  const existingPhone = await queryOne(
    'SELECT id, phone FROM users WHERE phone = ? OR phone = ? OR REPLACE(REPLACE(REPLACE(phone, \' \', \'\'), \'-\', \'\'), \'+\', \'\') LIKE ?',
    [String(phone).trim(), canonicalPhone, `%${last10}`]
  );
  if (existingPhone) {
    const err = new Error('An account already exists with this phone number.');
    err.statusCode = 409;
    err.code = 'USER_ALREADY_EXISTS';
    throw err;
  }

  const adminId = 'ADM-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const passwordHash = hashPassword(password);

  await execute(`
    INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
    VALUES (?, ?, ?, ?, ?, 'admin', ?, 'Active')
  `, [adminId, name.trim(), cleanEmail, canonicalPhone, passwordHash, area]);

  const user = { id: adminId, name: name.trim(), email: cleanEmail, phone: canonicalPhone, role: 'admin', area };
  const token = generateToken(user);

  await logAuditEvent({
    userId: adminId,
    action: 'ADMIN_REGISTERED',
    resourceType: 'user',
    resourceId: adminId,
    ipAddress
  });

  return { user, token };
}

export function normalizeExperienceYears(val) {
  if (typeof val === 'number' && !isNaN(val)) return Math.max(1, Math.round(val));
  const s = String(val || '').trim();
  if (s === '1-2 Years' || s === '1-2') return 2;
  if (s === '3-5 Years' || s === '3-5') return 4;
  if (s === '5-10 Years' || s === '5-10') return 7;
  if (s === '10+ Years' || s === '10+') return 10;
  const match = s.match(/\d+/);
  const parsed = match ? parseInt(match[0], 10) : 5;
  return isNaN(parsed) ? 5 : parsed;
}

export async function registerDriver({
  name,
  phone,
  dlNumber,
  password,
  email: customEmail = null,
  upiId = null,
  area = 'Indiranagar',
  vehicleType = 'Manual & Automatic Cars',
  experienceYears = 5,
  ipAddress = null
}) {
  const cleanPhone = phone ? String(phone).replace(/[^0-9]/g, '') : '';
  const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
  const formattedPhone = cleanPhone.startsWith('91') && cleanPhone.length === 12
    ? `+${cleanPhone.slice(0, 2)} ${cleanPhone.slice(2)}`
    : `+91 ${cleanPhone.slice(-10)}`;
  const cleanDl = (dlNumber || '').trim().toUpperCase();
  const email = (customEmail || `${name.toLowerCase().replace(/[^a-z0-9]/g, '.')}.${last10}@driveranna.com`).trim().toLowerCase();
  const passwordHash = hashPassword(password);
  const expYearsInt = normalizeExperienceYears(experienceYears);

  // 1. Check email
  const existingEmail = await queryOne(
    'SELECT id, email FROM users WHERE LOWER(email) = LOWER(?)',
    [email.trim()]
  );
  if (existingEmail) {
    const err = new Error('An account already exists with this email.');
    err.statusCode = 409;
    err.code = 'USER_ALREADY_EXISTS';
    throw err;
  }

  // 2. Check phone
  const existingPhone = await queryOne(
    'SELECT id, phone FROM users WHERE phone = ? OR phone = ? OR REPLACE(REPLACE(REPLACE(phone, \' \', \'\'), \'-\', \'\'), \'+\', \'\') LIKE ?',
    [String(phone).trim(), formattedPhone, `%${last10}`]
  );
  if (existingPhone) {
    const err = new Error('An account already exists with this phone number.');
    err.statusCode = 409;
    err.code = 'USER_ALREADY_EXISTS';
    throw err;
  }

  // Check if DL already exists in drivers table
  const existingDl = await queryOne(
    'SELECT id, user_id FROM drivers WHERE LOWER(license_number) = LOWER(?)',
    [cleanDl]
  );

  if (existingDl) {
    const err = new Error('This Driving License (DL) number is already registered. Please check your DL number or log in.');
    err.statusCode = 409;
    err.code = 'USER_ALREADY_EXISTS';
    throw err;
  }

  const userId = 'USR-DRV-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const driverId = 'DRV-' + crypto.randomBytes(4).toString('hex').toUpperCase();

  const effectiveUpi = (upiId || '').trim() || ENV.DEFAULT_UPI_ID || '';

  // Atomic creation of user and driver records within a single transaction
  await withTransaction(async (tx) => {
    // 1. Insert into users table with dedicated driver credentials
    await tx.execute(`
      INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
      VALUES (?, ?, ?, ?, ?, 'driver', ?, 'Active')
    `, [userId, name.trim(), email, formattedPhone, passwordHash, area]);

    // 2. Insert into drivers table (if this fails, the users insert rolls back)
    await tx.execute(`
      INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, experience_years, specialization, rating, trips_completed, upi_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 5.0, 0, ?, 'Active')
    `, [
      driverId,
      userId,
      name.trim(),
      formattedPhone,
      cleanDl,
      area,
      expYearsInt,
      vehicleType,
      effectiveUpi || null
    ]);
  });

  const safeDriver = {
    id: userId,
    driverId,
    name: name.trim(),
    email,
    phone: formattedPhone,
    role: 'driver',
    area,
    dlNumber: cleanDl,
    upiId: (upiId || '').trim() || ENV.DEFAULT_UPI_ID || '',
    vehicleType,
    experienceYears,
    rating: 5.0,
    trips: 0,
    isOnline: true
  };

  const token = generateToken(safeDriver);

  await logAuditEvent({
    userId,
    action: 'DRIVER_REGISTERED',
    resourceType: 'driver',
    resourceId: driverId,
    ipAddress
  });

  return { user: safeDriver, token };
}

export async function authenticateUser({ identifier, password, requiredRole = null, ipAddress = null }) {
  const trimmed = identifier ? String(identifier).trim() : '';
  if (!trimmed) {
    const err = new Error('Email, mobile number, or DL number is required.');
    err.statusCode = 400;
    err.code = 'INVALID_INPUT';
    throw err;
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    const err = new Error('Password is required.');
    err.statusCode = 400;
    err.code = 'INVALID_INPUT';
    throw err;
  }

  const cleanPhone = trimmed.replace(/[^0-9]/g, '');
  const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : null;
  const canonicalPhone = last10 ? `+91 ${last10}` : null;
  const cleanDl = trimmed.toUpperCase().replace(/[\s-]/g, '');

  let user = null;

  // 1. If looking for a driver, or if identifier could be a Driving License (DL) or phone
  if (requiredRole === 'driver' || trimmed.length >= 5) {
    try {
      const driverUser = await queryOne(`
        SELECT u.id, u.name, u.email, u.phone, u.password_hash, u.role, u.area, u.status,
               d.id as driver_id, d.license_number, d.upi_id, d.rating, d.trips_completed,
               d.hub_area, d.specialization, d.experience_years
        FROM users u
        INNER JOIN drivers d ON d.user_id = u.id
        WHERE (
          LOWER(u.email) = LOWER(?)
          OR u.phone = ?
          ${canonicalPhone ? "OR u.phone = ?" : ""}
          ${last10 ? "OR REPLACE(REPLACE(REPLACE(u.phone, ' ', ''), '-', ''), '+', '') LIKE ?" : ''}
          OR LOWER(d.license_number) = LOWER(?)
          OR REPLACE(REPLACE(UPPER(d.license_number), '-', ''), ' ', '') = ?
        )
      `, [
        trimmed,
        trimmed,
        ...(canonicalPhone ? [canonicalPhone] : []),
        ...(last10 ? [`%${last10}`] : []),
        trimmed,
        cleanDl
      ]);
      if (driverUser) {
        user = driverUser;
      }
    } catch (e) {
      // Fallback to standard users query if drivers join fails
    }
  }

  // 2. Standard user lookup if not found through driver table
  if (!user) {
    if (last10) {
      user = await queryOne(`
        SELECT id, name, email, phone, password_hash, role, area, status 
        FROM users 
        WHERE (
          LOWER(email) = LOWER(?) 
          OR phone = ? 
          ${canonicalPhone ? "OR phone = ?" : ""}
          OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') LIKE ?
        )
      `, [trimmed, trimmed, ...(canonicalPhone ? [canonicalPhone] : []), `%${last10}`]);
    } else {
      user = await queryOne(`
        SELECT id, name, email, phone, password_hash, role, area, status 
        FROM users 
        WHERE LOWER(email) = LOWER(?)
      `, [trimmed]);
    }
  }

  const userPasswordHash = user ? (user.password_hash || user.PASSWORD_HASH || user.Password_Hash) : null;
  const isHashValidBcrypt = isValidBcryptHash(userPasswordHash);
  const isUserActive = user && (user.status || '').toLowerCase() === 'active';

  let isPasswordValid = false;
  if (user && isUserActive && isHashValidBcrypt) {
    isPasswordValid = verifyPassword(password, userPasswordHash);
  } else {
    // Perform dummy bcrypt comparison to defend against timing attacks without passing invalid hashes to bcrypt
    verifyPassword(password, DUMMY_PASSWORD_HASH);
  }

  // Determine failure reason for server-side logging without exposing it to the client
  let failureReason = null;
  if (!user) {
    failureReason = 'LOGIN_FAILED_ACCOUNT_NOT_FOUND';
  } else if (!isUserActive) {
    failureReason = 'LOGIN_FAILED_ACCOUNT_INACTIVE';
  } else if (!isHashValidBcrypt || !isPasswordValid) {
    failureReason = 'LOGIN_FAILED_INVALID_PASSWORD';
  }

  if (failureReason) {
    console.warn(`[AUTH] Login failed: ${failureReason} (identifier: '${trimmed}')`);
    await logAuditEvent({
      userId: user?.id || null,
      action: failureReason,
      resourceType: 'auth',
      details: { identifier: trimmed, reason: failureReason },
      ipAddress
    });
    const message = 'Invalid email/phone or password.';
    const err = new Error(message);
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  // Strict role validation - no automatic role mutation or privilege escalation
  const userRole = (user.role || user.ROLE || '').toLowerCase();
  if (requiredRole && userRole !== requiredRole.toLowerCase()) {
    await logAuditEvent({
      userId: user.id,
      action: 'LOGIN_ROLE_MISMATCH',
      resourceType: 'auth',
      details: { required: requiredRole, actual: user.role },
      ipAddress
    });
    const err = new Error('Access denied: Insufficient privileges for this portal.');
    err.statusCode = 403;
    err.code = 'INSUFFICIENT_PRIVILEGES';
    throw err;
  }

  console.log(`[AUTH] Login success: LOGIN_SUCCESS (userId: '${user.id}', role: '${userRole}')`);
  await logAuditEvent({
    userId: user.id,
    action: 'LOGIN_SUCCESS',
    resourceType: 'auth',
    ipAddress
  });

  // Enrich driver properties if role is driver
  let driverDetails = {};
  if (userRole === 'driver') {
    try {
      const driverRecord = user.driver_id ? user : await queryOne(`
        SELECT id as driver_id, license_number, upi_id, rating, trips_completed, hub_area, specialization, experience_years
        FROM drivers WHERE user_id = ?
      `, [user.id]);
      if (driverRecord) {
        driverDetails = {
          driverId: driverRecord.driver_id,
          dlNumber: driverRecord.license_number || '',
          upiId: driverRecord.upi_id || ENV.DEFAULT_UPI_ID || '',
          rating: Number(driverRecord.rating) || 4.95,
          trips: Number(driverRecord.trips_completed || driverRecord.trips) || 0,
          vehicleType: driverRecord.specialization || 'Manual & Automatic Cars',
          experienceYears: driverRecord.experience_years || '5+ Years',
          isOnline: true
        };
      }
    } catch (e) {}
  }

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: userRole || 'customer',
    area: user.area,
    ...driverDetails
  };

  const token = generateToken(safeUser);
  return { user: safeUser, token };
}

export async function getUserById(userId) {
  const user = await queryOne('SELECT id, name, email, phone, role, area, status, created_at FROM users WHERE id = ?', [userId]);
  if (!user) return null;
  if ((user.role || '').toLowerCase() === 'driver') {
    try {
      const driverRecord = await queryOne(`
        SELECT id as driver_id, license_number, upi_id, rating, trips_completed, hub_area, specialization, experience_years
        FROM drivers WHERE user_id = ?
      `, [userId]);
      if (driverRecord) {
        return {
          ...user,
          driverId: driverRecord.driver_id,
          dlNumber: driverRecord.license_number || '',
          upiId: driverRecord.upi_id || ENV.DEFAULT_UPI_ID || '',
          rating: Number(driverRecord.rating) || 4.95,
          trips: Number(driverRecord.trips_completed) || 0,
          vehicleType: driverRecord.specialization || 'Manual & Automatic Cars',
          experienceYears: driverRecord.experience_years || '5+ Years',
          isOnline: true
        };
      }
    } catch (e) {}
  }
  return user;
}

/**
 * Change password for an authenticated user
 */
export async function changePassword({ userId, currentPassword, newPassword, ipAddress = null }) {
  if (!userId) {
    const err = new Error('User authentication required.');
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  const user = await queryOne('SELECT id, password_hash, status FROM users WHERE id = ?', [userId]);
  if (!user || user.status !== 'Active') {
    const err = new Error('User not found or account is inactive.');
    err.statusCode = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const isCurrentValid = verifyPassword(currentPassword, user.password_hash);
  if (!isCurrentValid) {
    await logAuditEvent({
      userId,
      action: 'PASSWORD_CHANGE_FAILED',
      resourceType: 'user',
      resourceId: userId,
      details: { reason: 'INVALID_CURRENT_PASSWORD' },
      ipAddress
    });
    const err = new Error('Current password is incorrect.');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  if (currentPassword === newPassword) {
    const err = new Error('New password must be different from current password.');
    err.statusCode = 400;
    err.code = 'PASSWORD_REUSE';
    throw err;
  }

  const newHash = hashPassword(newPassword);
  await execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

  await logAuditEvent({
    userId,
    action: 'PASSWORD_CHANGED',
    resourceType: 'user',
    resourceId: userId,
    ipAddress
  });

  return {
    success: true,
    message: 'Password has been changed successfully.'
  };
}

/**
 * Request a password reset link for an email address.
 * Strictly adheres to email enumeration defense:
 * Returns the exact same generic message whether the account exists or not.
 */
export async function requestPasswordReset({ email, ipAddress = null }) {
  const genericResponse = {
    message: 'If an account exists with that email, a password reset link has been sent.'
  };

  const trimmed = email ? String(email).trim().toLowerCase() : '';
  if (!trimmed) {
    return genericResponse;
  }

  // Lookup user by email (case-insensitive)
  const user = await queryOne(
    'SELECT id, name, email, status FROM users WHERE LOWER(email) = LOWER(?)',
    [trimmed]
  );

  if (!user || user.status !== 'Active') {
    // Timing defense: simulate SHA-256 token generation and hashing work
    crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
    return genericResponse;
  }

  // Invalidate any existing unused reset tokens for this user
  await execute(
    'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL',
    [user.id]
  );

  // Generate cryptographically secure random token (32 bytes = 64 hex characters)
  const token = crypto.randomBytes(32).toString('hex');
  // Store only the SHA-256 hash in database
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const tokenId = 'PRT-' + crypto.randomBytes(8).toString('hex').toUpperCase();

  // Enforce 15-minute expiration
  const expiresAtDate = new Date(Date.now() + 15 * 60 * 1000);
  const expiresAt = expiresAtDate.toISOString().replace('T', ' ').substring(0, 19);

  await execute(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [tokenId, user.id, tokenHash, expiresAt]
  );

  // Deliver reset email through Gmail SMTP via Nodemailer
  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      token
    });
  } catch (emailErr) {
    console.error('[AUTH SERVICE] Failed to send password reset email:', emailErr.message);
  }

  await logAuditEvent({
    userId: user.id,
    action: 'PASSWORD_RESET_REQUESTED',
    resourceType: 'user',
    resourceId: user.id,
    ipAddress
  });

  return genericResponse;
}

function parseTokenExpiry(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  if (str.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(str)) {
    return new Date(str).getTime();
  }
  return new Date(str.replace(' ', 'T') + 'Z').getTime();
}

/**
 * Verify whether a raw password reset token is valid, unused, and not expired
 */
export async function verifyResetToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length !== 64) {
    return {
      valid: false,
      message: 'This password reset link is invalid or expired.'
    };
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
  const record = await queryOne(
    'SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?',
    [tokenHash]
  );

  if (!record || record.used_at) {
    return {
      valid: false,
      message: 'This password reset link is invalid or expired.'
    };
  }

  const expiryTime = parseTokenExpiry(record.expires_at);
  if (isNaN(expiryTime) || expiryTime <= Date.now()) {
    return {
      valid: false,
      message: 'This password reset link is invalid or expired.'
    };
  }

  return {
    valid: true
  };
}

/**
 * Reset user password with single-use verified token and atomic transaction
 */
export async function resetPasswordWithToken({ rawToken, token, newPassword, ipAddress = null }) {
  const effectiveToken = typeof rawToken === 'string' && rawToken.trim()
    ? rawToken.trim()
    : (typeof token === 'string' ? token.trim() : '');

  if (!effectiveToken || effectiveToken.length !== 64) {
    const err = new Error('This password reset link is invalid or expired.');
    err.statusCode = 400;
    err.code = 'INVALID_RESET_TOKEN';
    throw err;
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    const err = new Error('Password must be at least 8 characters long.');
    err.statusCode = 400;
    err.code = 'INVALID_PASSWORD';
    throw err;
  }

  const tokenHash = crypto.createHash('sha256').update(effectiveToken).digest('hex');
  const record = await queryOne(
    'SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?',
    [tokenHash]
  );

  if (!record || record.used_at) {
    const err = new Error('This password reset link is invalid or expired.');
    err.statusCode = 400;
    err.code = 'INVALID_RESET_TOKEN';
    throw err;
  }

  const expiryTime = parseTokenExpiry(record.expires_at);
  if (isNaN(expiryTime) || expiryTime <= Date.now()) {
    const err = new Error('This password reset link is invalid or expired.');
    err.statusCode = 400;
    err.code = 'EXPIRED_RESET_TOKEN';
    throw err;
  }

  const user = await queryOne('SELECT id, status FROM users WHERE id = ?', [record.user_id]);
  if (!user || user.status !== 'Active') {
    const err = new Error('Account not found or inactive.');
    err.statusCode = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  // Hash the new password using the existing bcrypt setup
  const newHash = hashPassword(newPassword);

  // Atomically update user password and mark the reset token as used
  await withTransaction(async (tx) => {
    await tx.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);
    const updateRes = await tx.execute(
      'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL',
      [record.id]
    );

    const affected = updateRes?.affectedRows ?? 0;
    if (affected !== 1) {
      const err = new Error('This password reset link is invalid or has already been used.');
      err.statusCode = 400;
      err.code = 'INVALID_RESET_TOKEN';
      throw err;
    }
  });

  await logAuditEvent({
    userId: user.id,
    action: 'PASSWORD_RESET_COMPLETED',
    resourceType: 'user',
    resourceId: user.id,
    ipAddress
  });

  return {
    success: true,
    message: 'Your password has been reset successfully.'
  };
}

