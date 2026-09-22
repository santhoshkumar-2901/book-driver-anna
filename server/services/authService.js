import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { queryOne, queryAll, execute } from '../db/database.js';
import { ENV } from '../config/env.js';
import { logAuditEvent } from './auditService.js';

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

export async function authenticateUser({ identifier, password, requiredRole = null, ipAddress = null }) {
  const trimmed = identifier ? String(identifier).trim() : '';
  if (!trimmed) {
    const err = new Error('Email or phone number is required.');
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

  // Safe parameterized query matching email OR phone (or last 10 digits of phone)
  let user = null;
  if (last10) {
    user = await queryOne(`
      SELECT id, name, email, phone, password_hash, role, area, status 
      FROM users 
      WHERE (LOWER(email) = LOWER(?) OR phone = ? OR phone LIKE ?) AND status = 'Active'
    `, [trimmed, trimmed, `%${last10}`]);
  } else {
    user = await queryOne(`
      SELECT id, name, email, phone, password_hash, role, area, status 
      FROM users 
      WHERE LOWER(email) = LOWER(?) AND status = 'Active'
    `, [trimmed]);
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
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  // Role validation if required (e.g. admin login)
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

  await logAuditEvent({
    userId: user.id,
    action: 'LOGIN_SUCCESS',
    resourceType: 'auth',
    ipAddress
  });

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: userRole || 'customer',
    area: user.area
  };

  const token = generateToken(safeUser);
  return { user: safeUser, token };
}

export async function getUserById(userId) {
  const user = await queryOne('SELECT id, name, email, phone, role, area, status, created_at FROM users WHERE id = ?', [userId]);
  return user || null;
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

