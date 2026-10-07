import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { queryOne, queryAll, execute, withTransaction, isTiDB } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { logAuditEvent } from '../services/auditService.js';
import { updateBookingStatus } from '../services/bookingService.js';
import { publishBookingAssignmentChange } from '../services/realtimeService.js';
import { normalizeExperienceYears } from '../services/authService.js';
import { getAllPricing, updateServicePricing, resetServicePricing } from '../services/pricingService.js';
import { ENV } from '../config/env.js';

const router = Router();

// Protect ALL admin routes with server-side authentication and admin role enforcement
router.use(requireAuth, requireRole('admin'));

// GET /api/admin/metrics
router.get('/metrics', async (req, res, next) => {
  try {
    const [
      totalBookingsRow,
      pendingBookingsRow,
      completedBookingsRow,
      totalRevenueRow,
      totalCustomersRow,
      totalDriversRow
    ] = await Promise.all([
      queryOne('SELECT COUNT(*) as count FROM bookings'),
      queryOne("SELECT COUNT(*) as count FROM bookings WHERE status = 'PENDING'"),
      queryOne("SELECT COUNT(*) as count FROM bookings WHERE status = 'COMPLETED'"),
      queryOne("SELECT COALESCE(SUM(calculated_fare), 0) as total FROM bookings WHERE status = 'COMPLETED'"),
      queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'customer'"),
      queryOne('SELECT COUNT(*) as count FROM drivers')
    ]);

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
    let sql = `
      SELECT b.*,
             COALESCE(b.assigned_driver_name, d.name) as assigned_driver_name,
             COALESCE(b.assigned_driver_phone, d.phone) as assigned_driver_phone
      FROM bookings b
      LEFT JOIN drivers d ON b.assigned_driver_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (type && type !== 'all') {
      sql += ' AND b.booking_type = ?';
      params.push(type);
    }
    if (status && status !== 'all') {
      sql += ' AND b.status = ?';
      params.push(status.toUpperCase());
    }

    sql += ' ORDER BY b.created_at DESC';
    let bookings;
    try {
      bookings = await queryAll(sql, params);
    } catch (queryErr) {
      if (queryErr.message && (queryErr.message.includes('assigned_driver_name') || queryErr.message.includes('1054'))) {
        const fallbackSql = sql
          .replace(/COALESCE\(b\.assigned_driver_name,\s*d\.name\)\s*as\s*assigned_driver_name/gi, 'd.name as assigned_driver_name')
          .replace(/COALESCE\(b\.assigned_driver_phone,\s*d\.phone\)\s*as\s*assigned_driver_phone/gi, 'd.phone as assigned_driver_phone');
        bookings = await queryAll(fallbackSql, params);
      } else {
        throw queryErr;
      }
    }

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
    const { status, assignedDriverId, assignedDriverName, assignedDriverPhone, driverName, driverPhone } = req.body;
    const isUnassignment = assignedDriverId === null || (assignedDriverId === '' && assignedDriverId !== undefined);

    const updated = await withTransaction(async (tx) => {
      const lockBookingSql = isTiDB
        ? 'SELECT * FROM bookings WHERE id = ? FOR UPDATE'
        : 'SELECT * FROM bookings WHERE id = ?';
      const existing = await tx.queryOne(lockBookingSql, [bookingId]);
      if (!existing) {
        const err = new Error('Booking not found.');
        err.statusCode = 404;
        err.code = 'BOOKING_NOT_FOUND';
        throw err;
      }

      // Terminal state protection: never resurrect or alter COMPLETED or CANCELLED bookings
      if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
        const err = new Error(`Cannot assign driver or modify booking in terminal '${existing.status}' status.`);
        err.statusCode = 400;
        err.code = 'INVALID_STATE_TRANSITION';
        throw err;
      }

      let targetDriverId = assignedDriverId;
      let targetDriverName = assignedDriverName || driverName;
      let targetDriverPhone = assignedDriverPhone || driverPhone;
      let targetStatus = status;

      if (isUnassignment) {
        targetDriverId = null;
        targetDriverName = null;
        targetDriverPhone = null;
        if (!targetStatus) {
          targetStatus = existing.status === 'ASSIGNED' ? 'CONFIRMED' : existing.status;
        }
      } else if (assignedDriverId) {
        const lockDriverSql = isTiDB
          ? 'SELECT id, status FROM drivers WHERE id = ? FOR UPDATE'
          : 'SELECT id, status FROM drivers WHERE id = ?';
        const driver = await tx.queryOne(lockDriverSql, [assignedDriverId]);
        if (!driver || driver.status !== 'Active') {
          const err = new Error('Assigned driver must exist and have Active status.');
          err.statusCode = 400;
          err.code = 'INVALID_DRIVER';
          throw err;
        }

        // Check for slot conflict with another active booking for this driver
        const conflict = await tx.queryOne(`
          SELECT id
          FROM bookings
          WHERE assigned_driver_id = ?
            AND date = ?
            AND time = ?
            AND id != ?
            AND status IN ('PENDING', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS')
          LIMIT 1
        `, [assignedDriverId, existing.date, existing.time, bookingId]);

        if (conflict) {
          const err = new Error('The assigned driver is already booked for this date and time slot.');
          err.statusCode = 409;
          err.code = 'SLOT_UNAVAILABLE';
          throw err;
        }

        if (!targetStatus) {
          targetStatus = (existing.status === 'PENDING' || existing.status === 'CONFIRMED') ? 'ASSIGNED' : existing.status;
        }
      } else {
        if (!targetStatus) {
          targetStatus = existing.status;
        }
      }

      return await updateBookingStatus({
        bookingId,
        newStatus: targetStatus,
        assignedDriverId: (assignedDriverId !== undefined) ? targetDriverId : undefined,
        assignedDriverName: (assignedDriverId !== undefined || targetDriverName !== undefined) ? targetDriverName : undefined,
        assignedDriverPhone: (assignedDriverId !== undefined || targetDriverPhone !== undefined) ? targetDriverPhone : undefined,
        requesterUser: req.user,
        ipAddress: req.ip,
        tx
      });
    });

    // Notify realtime subscribers about the assignment change
    try {
      await publishBookingAssignmentChange({
        bookingId,
        assignedDriverId: updated.assigned_driver_id || null,
        assignedDriverName: updated.assigned_driver_name || null,
        status: updated.status
      });
    } catch (realtimeErr) {
      // Non-blocking
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

    if (existing.status === 'IN_PROGRESS' || existing.status === 'ARRIVED') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ACTIVE_TRIP_CANNOT_BE_DELETED',
          message: `Cannot delete booking while trip is active (${existing.status}). Complete or cancel it first.`
        }
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

    if (!password || typeof password !== 'string' || password.trim().length < 8) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Password is required and must be at least 8 characters long.' }
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
    const passwordHash = bcrypt.hashSync(password.trim(), 10);

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
    const { name, phone, licenseNumber, password, hubArea, experienceYears, specialization } = req.body;
    if (!name || !phone || !licenseNumber) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Driver name, phone, and license number are required.' }
      });
    }

    if (!password || typeof password !== 'string' || password.trim().length < 8) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'A valid driver password of at least 8 characters is required.' }
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
    const driverHash = bcrypt.hashSync(password.trim(), 10);
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
        normalizeExperienceYears(experienceYears),
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
      await tx.execute('UPDATE bookings SET assigned_driver_id = NULL WHERE assigned_driver_id = ?', [drvId]);
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

// POST /api/admin/system/clear-data (Development/Test Reset: Clear bookings, drivers, customers, keeping current admin)
router.post('/system/clear-data', async (req, res, next) => {
  try {
    if (ENV.IS_PRODUCTION || process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'System data clearing is disabled in production.' }
      });
    }

    const currentAdminId = req.user.id;

    await withTransaction(async (tx) => {
      await tx.execute('DELETE FROM bookings');
      await tx.execute('DELETE FROM drivers');
      await tx.execute("DELETE FROM users WHERE role != 'admin' OR (id != ? AND email = 'admin@bookdriveranna.com')", [currentAdminId]);
      // Note: audit_logs is NOT deleted! Audit history remains preserved.
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
      message: 'All test bookings, dummy customers, and test drivers have been cleared.'
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/pricing (Retrieve live tariff pricing for all services)
router.get('/pricing', async (req, res, next) => {
  try {
    const pricing = await getAllPricing();
    res.json({
      success: true,
      data: pricing
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/pricing (Update service tariff prices)
router.put('/pricing', async (req, res, next) => {
  try {
    const updates = req.body.items || req.body;
    const updatedPricing = await updateServicePricing(updates, req.user.id, req.ip);
    res.json({
      success: true,
      message: 'Service pricing successfully updated and synchronized across the platform.',
      data: updatedPricing
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/pricing/reset (Reset service tariffs to factory defaults)
router.post('/pricing/reset', async (req, res, next) => {
  try {
    const resetPricing = await resetServicePricing(req.user.id, req.ip);
    res.json({
      success: true,
      message: 'All service tariffs have been restored to factory defaults.',
      data: resetPricing
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/diagnostics (Protected admin system diagnostics)
router.get('/diagnostics', async (req, res, next) => {
  try {
    const [driversRow, adminsRow, usersRow, bookingsRow] = await Promise.all([
      queryOne('SELECT COUNT(*) as count FROM drivers'),
      queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'admin'"),
      queryOne('SELECT COUNT(*) as count FROM users'),
      queryOne('SELECT COUNT(*) as count FROM bookings')
    ]);

    res.json({
      success: true,
      data: {
        database: {
          status: 'connected',
          userCount: Number(usersRow?.count || 0),
          adminCount: Number(adminsRow?.count || 0),
          driverCount: Number(driversRow?.count || 0),
          bookingCount: Number(bookingsRow?.count || 0)
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
