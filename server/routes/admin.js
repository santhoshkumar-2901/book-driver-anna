import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { queryOne, queryAll, execute, withTransaction } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { logAuditEvent } from '../services/auditService.js';
import { updateBookingStatus } from '../services/bookingService.js';

const router = Router();

// Protect ALL admin routes with server-side authentication and admin role enforcement
router.use(requireAuth, requireRole('admin'));

// GET /api/admin/metrics
router.get('/metrics', async (req, res, next) => {
  try {
    const totalBookingsRow = await queryOne('SELECT COUNT(*) as count FROM bookings');
    const pendingBookingsRow = await queryOne("SELECT COUNT(*) as count FROM bookings WHERE status = 'PENDING'");
    const completedBookingsRow = await queryOne("SELECT COUNT(*) as count FROM bookings WHERE status = 'COMPLETED'");
    const totalRevenueRow = await queryOne("SELECT COALESCE(SUM(calculated_fare), 0) as total FROM bookings WHERE status = 'COMPLETED'");
    const totalCustomersRow = await queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'customer'");
    const totalDriversRow = await queryOne('SELECT COUNT(*) as count FROM drivers');

    const totalBookings = Number(totalBookingsRow?.count || 0);
    const pendingBookings = Number(pendingBookingsRow?.count || 0);
    const completedBookings = Number(completedBookingsRow?.count || 0);
    const totalRevenue = Number(totalRevenueRow?.total || 0);
    const totalCustomers = Number(totalCustomersRow?.count || 0);
    const totalDrivers = Number(totalDriversRow?.count || 0);

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
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/bookings
router.get('/bookings', async (req, res, next) => {
  try {
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
    const bookings = await queryAll(sql, params);

    res.json({
      success: true,
      data: { bookings }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/bookings/:id (Assign driver or update status)
router.patch('/bookings/:id', async (req, res, next) => {
  try {
    const bookingId = req.params.id;
    const { status, assignedDriverId } = req.body;

    const existing = await queryOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }
      });
    }

    let updated;
    if (status) {
      updated = await updateBookingStatus({
        bookingId,
        newStatus: status,
        assignedDriverId,
        requesterUser: req.user,
        ipAddress: req.ip
      });
    } else if (assignedDriverId !== undefined) {
      await execute('UPDATE bookings SET assigned_driver_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        assignedDriverId,
        'ASSIGNED',
        bookingId
      ]);
      updated = await queryOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);

      await logAuditEvent({
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
router.delete('/bookings/:id', async (req, res, next) => {
  try {
    const bookingId = req.params.id;
    const existing = await queryOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }
      });
    }

    await execute('DELETE FROM bookings WHERE id = ?', [bookingId]);

    await logAuditEvent({
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
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users
router.get('/users', async (req, res, next) => {
  try {
    const users = await queryAll(`
      SELECT id, name, email, phone, role, area, status, created_at 
      FROM users 
      WHERE role = 'customer'
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: { users }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users (Add new client)
router.post('/users', async (req, res, next) => {
  try {
    const { name, email, phone, area, password } = req.body;
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Name, email, and phone are required.' }
      });
    }

    const existing = await queryOne('SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR phone = ?', [
      email.trim(),
      phone.trim()
    ]);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'User with this email or phone already exists.' }
      });
    }

    const id = 'USR-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const passwordHash = bcrypt.hashSync(password || 'password123', 10);

    await execute(`
      INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
      VALUES (?, ?, ?, ?, ?, 'customer', ?, 'Active')
    `, [id, name.trim(), email.trim().toLowerCase(), phone.trim(), passwordHash, area || 'Indiranagar']);

    const created = await queryOne('SELECT id, name, email, phone, role, area, status, created_at FROM users WHERE id = ?', [id]);

    await logAuditEvent({
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
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res, next) => {
  try {
    const userId = req.params.id;
    const existing = await queryOne('SELECT id, name, email FROM users WHERE id = ? AND role = ?', [userId, 'customer']);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Customer not found.' }
      });
    }

    await execute('DELETE FROM users WHERE id = ?', [userId]);

    await logAuditEvent({
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
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/drivers
router.get('/drivers', async (req, res, next) => {
  try {
    const drivers = await queryAll(`
      SELECT d.*, u.email 
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      ORDER BY d.rating DESC
    `);

    res.json({
      success: true,
      data: { drivers }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/drivers (Add new driver)
router.post('/drivers', async (req, res, next) => {
  try {
    const { name, phone, licenseNumber, hubArea, experienceYears, specialization } = req.body;
    if (!name || !phone || !licenseNumber) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Driver name, phone, and license number are required.' }
      });
    }

    const existingLicense = await queryOne('SELECT id FROM drivers WHERE LOWER(license_number) = LOWER(?)', [
      licenseNumber.trim()
    ]);
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

    const created = await withTransaction(async (tx) => {
      await tx.execute(`
        INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
        VALUES (?, ?, ?, ?, ?, 'driver', ?, 'Active')
      `, [usrId, name.trim(), email, phone.trim(), driverHash, hubArea || 'Indiranagar']);

      await tx.execute(`
        INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, experience_years, specialization, rating, trips_completed, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 4.95, 0, 'Active')
      `, [
        drvId,
        usrId,
        name.trim(),
        phone.trim(),
        licenseNumber.trim().toUpperCase(),
        hubArea || 'Indiranagar',
        experienceYears || 5,
        specialization || 'Manual & Automatic Cars'
      ]);

      return await tx.queryOne('SELECT * FROM drivers WHERE id = ?', [drvId]);
    });

    await logAuditEvent({
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
    next(err);
  }
});

// DELETE /api/admin/drivers/:id
router.delete('/drivers/:id', async (req, res, next) => {
  try {
    const drvId = req.params.id;
    const driver = await queryOne('SELECT * FROM drivers WHERE id = ?', [drvId]);
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: { code: 'DRIVER_NOT_FOUND', message: 'Driver not found.' }
      });
    }

    await withTransaction(async (tx) => {
      await tx.execute('DELETE FROM drivers WHERE id = ?', [drvId]);
      await tx.execute('DELETE FROM users WHERE id = ?', [driver.user_id]);
    });

    await logAuditEvent({
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
    next(err);
  }
});

// POST /api/admin/system/clear-data (Production Reset: Clear all bookings, drivers, customers, keeping current admin)
router.post('/system/clear-data', async (req, res, next) => {
  try {
    const currentAdminId = req.user.id;

    await withTransaction(async (tx) => {
      await tx.execute('DELETE FROM bookings');
      await tx.execute('DELETE FROM drivers');
      await tx.execute("DELETE FROM users WHERE role != 'admin' OR (id != ? AND email = 'admin@bookdriveranna.com')", [currentAdminId]);
      await tx.execute('DELETE FROM audit_logs');
    });

    await logAuditEvent({
      userId: req.user.id,
      action: 'ADMIN_PURGED_TEST_DATA',
      resourceType: 'system',
      resourceId: 'all',
      details: { executedBy: req.user.email },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'All test bookings, dummy customers, and test drivers have been permanently cleared for production.'
    });
  } catch (err) {
    next(err);
  }
});

export default router;
