import { verifyToken, getUserById } from '../services/authService.js';
import { AUTH_COOKIE_NAME } from '../config/security.js';

export function extractToken(req) {
  // 1. Check Authorization header (explicit token header takes precedence)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  // 2. Check HttpOnly cookie (fallback for browser cookie sessions)
  if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
    return req.cookies[AUTH_COOKIE_NAME];
  }
  return null;
}

export async function requireAuth(req, res, next) {
  try {
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
    const user = await getUserById(decoded.id);
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
  } catch (err) {
    next(err);
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        const user = await getUserById(decoded.id);
        if (user && user.status === 'Active') {
          req.user = user;
        }
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}
