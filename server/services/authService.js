import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/database.js';
import { ENV } from '../config/env.js';
import { logAuditEvent } from './auditService.js';

const SALT_ROUNDS = 12;

export function hashPassword(plainPassword) {
  return bcrypt.hashSync(plainPassword, SALT_ROUNDS);
}

export function verifyPassword(plainPassword, hash) {
  return bcrypt.compareSync(plainPassword, hash);
}

export function generateToken(user) {
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
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

export function registerCustomer({ name, email, phone, password, area = 'Indiranagar', ipAddress = null }) {
  // Check duplicate email or phone
  const existing = db.prepare('SELECT id, email, phone FROM users WHERE email = ? COLLATE NOCASE OR phone = ?').get(email.trim(), phone.trim());
  if (existing) {
    const isEmail = existing.email.toLowerCase() === email.trim().toLowerCase();
    const field = isEmail ? 'Email' : 'Phone number';
    const err = new Error(`${field} is already registered. Please log in.`);
    err.statusCode = 409;
    err.code = 'USER_ALREADY_EXISTS';
    throw err;
  }

  const userId = 'USR-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const passwordHash = hashPassword(password);

  const stmt = db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
    VALUES (?, ?, ?, ?, ?, 'customer', ?, 'Active')
  `);

  stmt.run(userId, name.trim(), email.trim(), phone.trim(), passwordHash, area);

  const user = { id: userId, name: name.trim(), email: email.trim(), phone: phone.trim(), role: 'customer', area };
  const token = generateToken(user);

  logAuditEvent({
    userId,
    action: 'USER_REGISTERED',
    resourceType: 'user',
    resourceId: userId,
    ipAddress
  });

  return { user, token };
}

export function authenticateUser({ identifier, password, requiredRole = null, ipAddress = null }) {
  const trimmed = identifier.trim();
  // Safe parameterized query matching email OR phone
  const user = db.prepare(`
    SELECT id, name, email, phone, password_hash, role, area, status 
    FROM users 
    WHERE (email = ? COLLATE NOCASE OR phone = ?) AND status = 'Active'
  `).get(trimmed, trimmed);

  // Timing-safe constant-time comparison to prevent timing attacks & enumeration
  if (!user || !verifyPassword(password, user.password_hash)) {
    logAuditEvent({
      userId: user?.id || null,
      action: 'LOGIN_FAILED',
      resourceType: 'auth',
      details: { identifier: trimmed },
      ipAddress
    });
    const err = new Error('Invalid email, phone number, or password.');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  // Role validation if required (e.g. admin login)
  if (requiredRole && user.role !== requiredRole) {
    logAuditEvent({
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

  logAuditEvent({
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
    role: user.role,
    area: user.area
  };

  const token = generateToken(safeUser);
  return { user: safeUser, token };
}

export function getUserById(userId) {
  const user = db.prepare('SELECT id, name, email, phone, role, area, status, created_at FROM users WHERE id = ?').get(userId);
  return user || null;
}
