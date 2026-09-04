import { verifyToken, getUserById } from '../services/authService.js';
import { AUTH_COOKIE_NAME } from '../config/security.js';

export function extractToken(req) {
  // 1. Check HttpOnly cookie
  if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
    return req.cookies[AUTH_COOKIE_NAME];
  }
  // 2. Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

export function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in to continue.'
      }
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Session expired or invalid. Please log in again.'
      }
    });
  }

  // Verify user still exists and is active in DB
  const user = getUserById(decoded.id);
  if (!user || user.status !== 'Active') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'ACCOUNT_DISABLED',
        message: 'Account is no longer active. Please contact support.'
      }
    });
  }

  req.user = user;
  next();
}

export function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      const user = getUserById(decoded.id);
      if (user && user.status === 'Active') {
        req.user = user;
      }
    }
  }
  next();
}
