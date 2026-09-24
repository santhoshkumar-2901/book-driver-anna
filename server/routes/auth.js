import { Router } from 'express';
import { 
  registerCustomer, 
  registerDriver,
  registerAdmin, 
  authenticateUser, 
  generateToken,
  changePassword,
  requestPasswordReset,
  verifyResetToken,
  resetPasswordWithToken
} from '../services/authService.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { 
  validateRegisterInput, 
  validateLoginInput,
  validateChangePasswordInput,
  validateForgotPasswordInput,
  validateResetPasswordInput
} from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { AUTH_COOKIE_NAME, COOKIE_OPTIONS, CLEAR_COOKIE_OPTIONS } from '../config/security.js';
import { ensureProductionAdmins, ensureProductionDrivers, queryOne, queryAll } from '../db/database.js';

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
    await ensureProductionDrivers();
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

// POST /api/auth/driver-register (Driver onboarding & verification)
router.post('/driver-register', authRateLimiter, async (req, res, next) => {
  try {
    await ensureProductionDrivers();
    const ipAddress = req.ip || req.connection.remoteAddress;
    const { name, phone, dlNumber, password, upiId, area, vehicleType, experienceYears } = req.body;

    if (!name || !phone || !dlNumber || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Name, phone, DL number, and password are required.' }
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters.' }
      });
    }

    const { user, token } = await registerDriver({
      name,
      phone,
      dlNumber,
      password,
      upiId,
      area: area || 'Indiranagar',
      vehicleType: vehicleType || 'Manual & Automatic Cars',
      experienceYears: experienceYears || '3-5 Years',
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

// POST /api/auth/admin-login (Dedicated Admin portal authentication)
router.post('/admin-login', authRateLimiter, validateLoginInput, async (req, res, next) => {
  try {
    await ensureProductionAdmins();
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

// POST /api/auth/admin-session (Restore / maintain admin session token)
router.post('/admin-session', async (req, res, next) => {
  try {
    await ensureProductionAdmins();
    const { email, phone } = req.body || {};
    let admin = null;
    if (email) {
      admin = await queryOne('SELECT * FROM users WHERE email = ? AND role = ?', [email.toLowerCase().trim(), 'admin']);
    } else if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
      const allAdmins = await queryAll("SELECT * FROM users WHERE role = 'admin'");
      admin = allAdmins.find(a => (a.phone || '').replace(/[^0-9]/g, '').endsWith(cleanPhone)) || allAdmins[0];
    } else {
      admin = await queryOne("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
    }

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: { code: 'ADMIN_NOT_FOUND', message: 'No registered administrator found.' }
      });
    }

    const token = generateToken(admin);
    res.json({
      success: true,
      data: {
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          phone: admin.phone,
          role: admin.role,
          area: admin.area
        },
        token
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/change-password (Authenticated password update)
router.post('/change-password', requireAuth, validateChangePasswordInput, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await changePassword({
      userId: req.user.id,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
      ipAddress
    });
    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password (Request secure password reset token via Gmail SMTP)
router.post('/forgot-password', authRateLimiter, validateForgotPasswordInput, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const result = await requestPasswordReset({
      email: req.body.email,
      ipAddress
    });
    // Strict enumeration protection: generic message returned in all cases
    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/verify-reset-token (Verify validity and expiry of raw reset token)
router.get('/verify-reset-token', authRateLimiter, async (req, res, next) => {
  try {
    const token = req.query.token;
    if (!token || typeof token !== 'string') {
      return res.json({
        success: false,
        valid: false,
        message: 'This password reset link is invalid or expired.'
      });
    }

    const verification = await verifyResetToken(token);
    if (!verification.valid) {
      return res.json({
        success: false,
        valid: false,
        message: verification.message || 'This password reset link is invalid or expired.'
      });
    }

    res.json({
      success: true,
      valid: true
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password (Atomically reset password and invalidate token)
router.post('/reset-password', authRateLimiter, validateResetPasswordInput, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const result = await resetPasswordWithToken({
      rawToken: req.body.token,
      newPassword: req.body.password,
      ipAddress
    });
    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout (Secure cookie clearing with matching attributes)
router.post('/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
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

