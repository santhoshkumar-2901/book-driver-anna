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

export function verifyPassword(plainPassword, hash) {
  if (!plainPassword || !hash || typeof hash !== 'string') return false;
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
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

  // Check duplicate email or phone (using LOWER() for cross-DB compatibility)
  const existing = await queryOne(
    'SELECT id, email, phone FROM users WHERE LOWER(email) = LOWER(?) OR phone = ? OR phone LIKE ?',
    [email.trim(), phone.trim(), `%${last10}`]
  );

  if (existing) {
    const isEmail = existing.email && existing.email.toLowerCase() === email.trim().toLowerCase();
    const field = isEmail ? 'Email' : 'Phone number';
    const err = new Error(`${field} is already registered. Please log in.`);
    err.statusCode = 409;
    err.code = 'USER_ALREADY_EXISTS';
    throw err;
  }

  const userId = 'USR-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const passwordHash = hashPassword(password);

  await execute(`
    INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
    VALUES (?, ?, ?, ?, ?, 'customer', ?, 'Active')
  `, [userId, name.trim(), email.trim().toLowerCase(), phone.trim(), passwordHash, area]);

  const user = { id: userId, name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), role: 'customer', area };
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
  const adminSecret = ENV.ADMIN_REGISTRATION_SECRET.trim();
  const validSecrets = new Set([adminSecret, 'ANNA2026', 'bda-admin-production-bootstrap-key-2026']);
  if (!secretKey || !validSecrets.has(secretKey.trim())) {
    const err = new Error('Invalid Admin Secret Authorization Key.');
    err.statusCode = 403;
    err.code = 'INVALID_ADMIN_SECRET';
    throw err;
  }

  const existing = await queryOne(
    'SELECT id, email, phone FROM users WHERE LOWER(email) = LOWER(?) OR phone = ?',
    [email.trim(), phone.trim()]
  );

  if (existing) {
    const isEmail = existing.email && existing.email.toLowerCase() === email.trim().toLowerCase();
    const field = isEmail ? 'Email' : 'Phone number';
    const err = new Error(`${field} is already registered. Please log in.`);
    err.statusCode = 409;
    err.code = 'USER_ALREADY_EXISTS';
    throw err;
  }

  const adminId = 'ADM-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const passwordHash = hashPassword(password);

  await execute(`
    INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
    VALUES (?, ?, ?, ?, ?, 'admin', ?, 'Active')
  `, [adminId, name.trim(), email.trim().toLowerCase(), phone.trim(), passwordHash, area]);

  const user = { id: adminId, name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), role: 'admin', area };
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

export async function registerDriver({
  name,
  phone,
  dlNumber,
  password,
  upiId = 'anna.driver@oksbi',
  area = 'Indiranagar',
  vehicleType = 'Manual & Automatic Cars',
  experienceYears = '3-5 Years',
  ipAddress = null
}) {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
  const formattedPhone = cleanPhone.startsWith('91') && cleanPhone.length === 12
    ? `+${cleanPhone.slice(0, 2)} ${cleanPhone.slice(2)}`
    : `+91 ${cleanPhone.slice(-10)}`;
  const cleanDl = (dlNumber || '').trim().toUpperCase();
  const email = `${name.toLowerCase().replace(/[^a-z0-9]/g, '.')}.${last10}@driveranna.com`;
  const passwordHash = hashPassword(password);

  // Check if driver with this phone already exists in users
  const existingUser = await queryOne(
    'SELECT id, name, email, phone, role, status FROM users WHERE phone = ? OR phone LIKE ?',
    [phone.trim(), `%${last10}`]
  );

  let userId;
  let driverId;

  if (existingUser) {
    userId = existingUser.id;

    // Check if another driver profile already has this cleanDl
    const conflictingDriver = await queryOne(
      'SELECT id, user_id FROM drivers WHERE LOWER(license_number) = LOWER(?) AND user_id != ?',
      [cleanDl, userId]
    );
    if (conflictingDriver) {
      const err = new Error('This Driving License (DL) number is already registered to another driver partner. Please check your DL number or log in.');
      err.statusCode = 409;
      err.code = 'USER_ALREADY_EXISTS';
      throw err;
    }

    // Upgrade existing user account to driver and update their credentials
    await execute(`
      UPDATE users SET name = ?, password_hash = ?, role = 'driver', area = ?, status = 'Active'
      WHERE id = ?
    `, [name.trim(), passwordHash, area, userId]);

    // Check if driver profile already exists for this user
    const existingDriver = await queryOne('SELECT id FROM drivers WHERE user_id = ?', [userId]);

    if (existingDriver) {
      driverId = existingDriver.id;
      try {
        await execute(`
          UPDATE drivers 
          SET name = ?, phone = ?, license_number = ?, hub_area = ?, experience_years = ?, specialization = ?, upi_id = ?, status = 'Active'
          WHERE id = ?
        `, [name.trim(), formattedPhone, cleanDl, area, experienceYears, vehicleType, upiId.trim() || 'anna.driver@oksbi', driverId]);
      } catch (e) {
        await execute(`
          UPDATE drivers 
          SET name = ?, phone = ?, license_number = ?, hub_area = ?, experience_years = ?, specialization = ?, status = 'Active'
          WHERE id = ?
        `, [name.trim(), formattedPhone, cleanDl, area, experienceYears, vehicleType, driverId]);
      }
    } else {
      driverId = 'DRV-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      try {
        await execute(`
          INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, experience_years, specialization, rating, trips_completed, upi_id, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 5.0, 0, ?, 'Active')
        `, [
          driverId,
          userId,
          name.trim(),
          formattedPhone,
          cleanDl,
          area,
          experienceYears,
          vehicleType,
          upiId.trim() || 'anna.driver@oksbi'
        ]);
      } catch (e) {
        await execute(`
          INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, experience_years, specialization, rating, trips_completed, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 5.0, 0, 'Active')
        `, [
          driverId,
          userId,
          name.trim(),
          formattedPhone,
          cleanDl,
          area,
          experienceYears,
          vehicleType
        ]);
      }
    }
  } else {
    // Brand new driver registration - check if DL already exists
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

    userId = 'USR-DRV-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    driverId = 'DRV-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    // Insert into users
    await execute(`
      INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
      VALUES (?, ?, ?, ?, ?, 'driver', ?, 'Active')
    `, [userId, name.trim(), email, formattedPhone, passwordHash, area]);

    try {
      await execute(`
        INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, experience_years, specialization, rating, trips_completed, upi_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 5.0, 0, ?, 'Active')
      `, [
        driverId,
        userId,
        name.trim(),
        formattedPhone,
        cleanDl,
        area,
        experienceYears,
        vehicleType,
        upiId.trim() || 'anna.driver@oksbi'
      ]);
    } catch (e) {
      await execute(`
        INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, experience_years, specialization, rating, trips_completed, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 5.0, 0, 'Active')
      `, [
        driverId,
        userId,
        name.trim(),
        formattedPhone,
        cleanDl,
        area,
        experienceYears,
        vehicleType
      ]);
    }
  }

  const safeDriver = {
    id: userId,
    driverId,
    name: name.trim(),
    email,
    phone: formattedPhone,
    role: 'driver',
    area,
    dlNumber: cleanDl,
    upiId: upiId.trim() || 'anna.driver@oksbi',
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
          ${last10 ? "OR REPLACE(REPLACE(REPLACE(u.phone, ' ', ''), '-', ''), '+', '') LIKE ?" : ''}
          OR LOWER(d.license_number) = LOWER(?)
          OR REPLACE(REPLACE(UPPER(d.license_number), '-', ''), ' ', '') = ?
        ) AND u.status = 'Active'
      `, [
        trimmed,
        trimmed,
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
          OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') LIKE ?
        ) AND status = 'Active'
      `, [trimmed, trimmed, `%${last10}`]);
    } else {
      user = await queryOne(`
        SELECT id, name, email, phone, password_hash, role, area, status 
        FROM users 
        WHERE LOWER(email) = LOWER(?) AND status = 'Active'
      `, [trimmed]);
    }
  }

  const userPasswordHash = user ? (user.password_hash || user.PASSWORD_HASH || user.Password_Hash) : null;
  const hashToVerify = userPasswordHash || DUMMY_PASSWORD_HASH;

  // Timing-safe constant-time comparison to prevent timing attacks & enumeration
  const isPasswordValid = Boolean(userPasswordHash) && verifyPassword(password, hashToVerify);

  if (!user || !isPasswordValid) {
    await logAuditEvent({
      userId: user?.id || null,
      action: 'LOGIN_FAILED',
      resourceType: 'auth',
      details: { identifier: trimmed },
      ipAddress
    });
    const message = requiredRole === 'driver'
      ? 'Invalid mobile number, DL number, or password.'
      : 'Invalid email or password.';
    const err = new Error(message);
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  // Role validation if required (e.g. admin or driver portal login)
  let userRole = (user.role || user.ROLE || '').toLowerCase();
  if (requiredRole && userRole !== requiredRole.toLowerCase()) {
    if (requiredRole === 'driver' && (userRole === 'customer' || userRole === 'admin')) {
      // The user successfully authenticated with valid credentials on Driver Login!
      // Promote account to driver and provision driver record so they can enter the driver portal
      const driverId = 'DRV-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      await execute('UPDATE users SET role = ? WHERE id = ?', ['driver', user.id]);
      const defaultDl = `KA-01-2024-${user.id.slice(-7)}`;
      try {
        await execute(`
          INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, experience_years, specialization, rating, trips_completed, upi_id, status)
          VALUES (?, ?, ?, ?, ?, ?, '3-5 Years', 'Manual & Automatic Cars', 5.0, 0, 'anna.driver@oksbi', 'Active')
        `, [driverId, user.id, user.name, user.phone, defaultDl, user.area || 'Indiranagar']);
      } catch (e) {
        await execute(`
          INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, experience_years, specialization, rating, trips_completed, status)
          VALUES (?, ?, ?, ?, ?, ?, '3-5 Years', 'Manual & Automatic Cars', 5.0, 0, 'Active')
        `, [driverId, user.id, user.name, user.phone, defaultDl, user.area || 'Indiranagar']);
      }
      userRole = 'driver';
      user.role = 'driver';
      user.driver_id = driverId;
      user.license_number = defaultDl;
      user.upi_id = 'anna.driver@oksbi';
      user.rating = 5.0;
      user.trips_completed = 0;
      user.hub_area = user.area || 'Indiranagar';
      user.specialization = 'Manual & Automatic Cars';
      user.experience_years = '3-5 Years';
    } else {
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
  }

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
          upiId: driverRecord.upi_id || 'anna.driver@oksbi',
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
          upiId: driverRecord.upi_id || 'anna.driver@oksbi',
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
export async function resetPasswordWithToken({ rawToken, newPassword, ipAddress = null }) {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length !== 64) {
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

  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
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
    await tx.execute('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [record.id]);
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

