import { Router } from 'express';
import { registerCustomer, registerAdmin, authenticateUser } from '../services/authService.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { validateRegisterInput, validateLoginInput } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { AUTH_COOKIE_NAME, COOKIE_OPTIONS } from '../config/security.js';

const router = Router();

// POST /api/auth/register
router.post('/register', authRateLimiter, validateRegisterInput, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const { user, token } = await registerCustomer({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      password: req.body.password,
      area: req.body.area,
      ipAddress
    });

    res.cookie(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);
    res.status(201).json({
      success: true,
      data: { user, token }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login (Customer login)
router.post('/login', authRateLimiter, validateLoginInput, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const { user, token } = await authenticateUser({
      identifier: req.body.identifier,
      password: req.body.password,
      requiredRole: null, // Any valid user can log in here
      ipAddress
    });

    res.cookie(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);
    res.json({
      success: true,
      data: { user, token }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/driver-login (Dedicated Driver portal authentication)
router.post('/driver-login', authRateLimiter, validateLoginInput, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const { user, token } = await authenticateUser({
      identifier: req.body.identifier,
      password: req.body.password,
      requiredRole: 'driver',
      ipAddress
    });

    res.cookie(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);
    res.json({
      success: true,
      data: { user, token }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/admin-login (Dedicated Admin portal authentication)
router.post('/admin-login', authRateLimiter, validateLoginInput, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const { user, token } = await authenticateUser({
      identifier: req.body.identifier,
      password: req.body.password,
      requiredRole: 'admin',
      ipAddress
    });

    res.cookie(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);
    res.json({
      success: true,
      data: { user, token }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/admin-register (Dedicated Admin onboarding with secret key)
router.post('/admin-register', authRateLimiter, validateRegisterInput, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const { user, token } = await registerAdmin({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      password: req.body.password,
      secretKey: req.body.secretKey,
      area: req.body.area || 'Indiranagar',
      ipAddress
    });

    res.cookie(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);
    res.status(201).json({
      success: true,
      data: { user, token }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
  res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: { user: req.user }
  });
});

export default router;
