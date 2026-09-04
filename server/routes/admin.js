import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { logAuditEvent } from '../services/auditService.js';
import { updateBookingStatus } from '../services/bookingService.js';

const router = Router();

// Protect ALL admin routes with server-side authentication and admin role enforcement
router.use(requireAuth, requireRole('admin'));

// GET /api/admin/metrics
router.get('/metrics', (req, res) => {
  const totalBookings = db.prepare('SELECT COUNT(*) as count FROM bookings').get().count;
  const pendingBookings = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'PENDING'").get().count;
  const completedBookings = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'COMPLETED'").get().count;
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(calculated_fare), 0) as total FROM bookings WHERE status = 'COMPLETED'").get().total;
  const totalCustomers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'").get().count;
  const totalDrivers = db.prepare('SELECT COUNT(*) as count FROM drivers').get().count;

  res.json({
    success: true,
    data: {
      totalBookings,
      pendingBookings,
      completedBookings,
      totalRevenue: Math.round(totalRevenue),
      totalCustomers,
      totalDrivers
    }
  });
});

// GET /api/admin/bookings
router.get('/bookings', (req, res) => {
  const { type, status } = req.query;
  let sql = 'SELECT * FROM bookings WHERE 1=1';
  const params = [];

  if (type && type !== 'all') {
    sql += ' AND booking_type = ?';
    params.push(type);
  }
  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status.toUpperCase());
  }

  sql += ' ORDER BY created_at DESC';
  const bookings = db.prepare(sql).all(...params);

  res.json({
    success: true,
    data: { bookings }
  });
});

// PATCH /api/admin/bookings/:id (Assign driver or update status)
router.patch('/bookings/:id', (req, res, next) => {
  try {
    const bookingId = req.params.id;
    const { status, assignedDriverId } = req.body;

    const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }
      });
    }

    let updated;
    if (status) {
      updated = updateBookingStatus({
        bookingId,
        newStatus: status,
        assignedDriverId,
        requesterUser: req.user,
        ipAddress: req.ip
      });
    } else if (assignedDriverId !== undefined) {
      db.prepare('UPDATE bookings SET assigned_driver_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(assignedDriverId, 'ASSIGNED', bookingId);
      updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);

      logAuditEvent({
        userId: req.user.id,
        action: 'ADMIN_ASSIGNED_DRIVER',
        resourceType: 'booking',
        resourceId: bookingId,
        details: { driverId: assignedDriverId },
        ipAddress: req.ip
      });
    }

    res.json({
      success: true,
      data: { booking: updated }
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/bookings/:id
router.delete('/bookings/:id', (req, res) => {
  const bookingId = req.params.id;
  const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!existing) {
    return res.status(404).json({
      success: false,
      error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }
    });
  }

  db.prepare('DELETE FROM bookings WHERE id = ?').run(bookingId);

  logAuditEvent({
    userId: req.user.id,
    action: 'ADMIN_DELETED_BOOKING',
    resourceType: 'booking',
    resourceId: bookingId,
    details: { customer: existing.customer_name, fare: existing.calculated_fare },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: `Booking ${bookingId} permanently deleted.`
  });
});

// GET /api/admin/users
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT id, name, email, phone, role, area, status, created_at 
    FROM users 
    WHERE role = 'customer'
    ORDER BY created_at DESC
  `).all();

  res.json({
    success: true,
    data: { users }
  });
});

// POST /api/admin/users (Add new client)
router.post('/users', (req, res) => {
  const { name, email, phone, area, password } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Name, email, and phone are required.' }
    });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE OR phone = ?').get(email.trim(), phone.trim());
  if (existing) {
    return res.status(409).json({
      success: false,
      error: { code: 'USER_EXISTS', message: 'User with this email or phone already exists.' }
    });
  }

  const id = 'USR-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const passwordHash = bcrypt.hashSync(password || 'password123', 10);

  db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
    VALUES (?, ?, ?, ?, ?, 'customer', ?, 'Active')
  `).run(id, name.trim(), email.trim().toLowerCase(), phone.trim(), passwordHash, area || 'Indiranagar');

  const created = db.prepare('SELECT id, name, email, phone, role, area, status, created_at FROM users WHERE id = ?').get(id);

  logAuditEvent({
    userId: req.user.id,
    action: 'ADMIN_CREATED_USER',
    resourceType: 'user',
    resourceId: id,
    ipAddress: req.ip
  });

  res.status(201).json({
    success: true,
    data: { user: created }
  });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  const userId = req.params.id;
  const existing = db.prepare('SELECT id, name, email FROM users WHERE id = ? AND role = ?').get(userId, 'customer');
  if (!existing) {
    return res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'Customer not found.' }
    });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  logAuditEvent({
    userId: req.user.id,
    action: 'ADMIN_DELETED_USER',
    resourceType: 'user',
    resourceId: userId,
    details: { name: existing.name, email: existing.email },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: `Customer ${existing.name} removed from database.`
  });
});

// GET /api/admin/drivers
router.get('/drivers', (req, res) => {
  const drivers = db.prepare(`
    SELECT d.*, u.email 
    FROM drivers d
    JOIN users u ON d.user_id = u.id
    ORDER BY d.rating DESC
  `).all();

  res.json({
    success: true,
    data: { drivers }
  });
});

// POST /api/admin/drivers (Add new driver)
router.post('/drivers', (req, res) => {
  const { name, phone, licenseNumber, hubArea, experienceYears, specialization } = req.body;
  if (!name || !phone || !licenseNumber) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Driver name, phone, and license number are required.' }
    });
  }

  const existingLicense = db.prepare('SELECT id FROM drivers WHERE license_number = ? COLLATE NOCASE').get(licenseNumber.trim());
  if (existingLicense) {
    return res.status(409).json({
      success: false,
      error: { code: 'LICENSE_EXISTS', message: 'Driver with this license number already exists.' }
    });
  }

  const usrId = 'USR-DRV-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const drvId = 'DRV-' + crypto.randomBytes(2).toString('hex').toUpperCase();
  const driverHash = bcrypt.hashSync('driver123', 10);
  const email = `${name.toLowerCase().replace(/\s+/g, '.')}@driveranna.com`;

  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare(`
      INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
      VALUES (?, ?, ?, ?, ?, 'driver', ?, 'Active')
    `).run(usrId, name.trim(), email, phone.trim(), driverHash, hubArea || 'Indiranagar');

    db.prepare(`
      INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, experience_years, specialization, rating, trips_completed, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 4.95, 0, 'Active')
    `).run(
      drvId,
      usrId,
      name.trim(),
      phone.trim(),
      licenseNumber.trim().toUpperCase(),
      hubArea || 'Indiranagar',
      experienceYears || 5,
      specialization || 'Manual & Automatic Cars'
    );

    db.exec('COMMIT;');

    const created = db.prepare('SELECT * FROM drivers WHERE id = ?').get(drvId);

    logAuditEvent({
      userId: req.user.id,
      action: 'ADMIN_CREATED_DRIVER',
      resourceType: 'driver',
      resourceId: drvId,
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      data: { driver: created }
    });
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
});

// DELETE /api/admin/drivers/:id
router.delete('/drivers/:id', (req, res) => {
  const drvId = req.params.id;
  const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(drvId);
  if (!driver) {
    return res.status(404).json({
      success: false,
      error: { code: 'DRIVER_NOT_FOUND', message: 'Driver not found.' }
    });
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare('DELETE FROM drivers WHERE id = ?').run(drvId);
    db.prepare('DELETE FROM users WHERE id = ?').run(driver.user_id);
    db.exec('COMMIT;');

    logAuditEvent({
      userId: req.user.id,
      action: 'ADMIN_DELETED_DRIVER',
      resourceType: 'driver',
      resourceId: drvId,
      details: { name: driver.name, license: driver.license_number },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Driver Anna ${driver.name} removed from fleet.`
    });
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
});

export default router;
