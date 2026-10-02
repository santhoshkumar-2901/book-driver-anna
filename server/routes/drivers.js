import { Router } from 'express';
import { queryOne, queryAll, execute } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { driverLocationRateLimiter } from '../middleware/rateLimiter.js';
import { updateBookingStatus } from '../services/bookingService.js';
import { publishDriverLocation } from '../services/realtimeService.js';

const router = Router();

// GET /api/drivers (Public active driver roster)
router.get('/', async (req, res, next) => {
  try {
    const drivers = await queryAll(`
      SELECT id, name, hub_area, experience_years, specialization, rating, trips_completed, status 
      FROM drivers 
      WHERE status = 'Active'
      ORDER BY rating DESC
    `);

    res.json({
      success: true,
      data: { drivers }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/drivers/duties (Driver portal: fetch duties assigned to authenticated driver)
router.get('/duties', requireAuth, requireRole('driver', 'admin'), async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      const duties = await queryAll('SELECT * FROM bookings ORDER BY date ASC, time ASC');
      return res.json({ success: true, data: { duties } });
    }

    // Driver verification: verify profile exists and status is Active
    const driver = await queryOne('SELECT id, status FROM drivers WHERE user_id = ?', [req.user.id]);
    if (!driver) {
      return res.status(403).json({
        success: false,
        error: { code: 'NOT_A_DRIVER', message: 'No driver profile linked to this account.' }
      });
    }

    if (driver.status !== 'Active') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'DRIVER_INACTIVE',
          message: `Driver account is ${driver.status.toLowerCase()}. Protected driver operations are disabled.`
        }
      });
    }

    const duties = await queryAll(`
      SELECT * FROM bookings
      WHERE assigned_driver_id = ?
      ORDER BY date ASC, time ASC
    `, [driver.id]);

    res.json({
      success: true,
      data: { duties }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/drivers/history (Driver portal: fetch past completed/cancelled trips assigned to authenticated driver)
router.get('/history', requireAuth, requireRole('driver', 'admin'), async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 100));

    if (req.user.role === 'admin') {
      const history = await queryAll(`
        SELECT * FROM bookings
        WHERE status IN ('COMPLETED', 'CANCELLED')
        ORDER BY created_at DESC
        LIMIT ?
      `, [limit]);
      return res.json({ success: true, data: { history, duties: history, bookings: history } });
    }

    // Driver verification: verify profile exists and status is Active
    const driver = await queryOne('SELECT id, status FROM drivers WHERE user_id = ?', [req.user.id]);
    if (!driver) {
      return res.status(403).json({
        success: false,
        error: { code: 'NOT_A_DRIVER', message: 'No driver profile linked to this account.' }
      });
    }

    if (driver.status !== 'Active') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'DRIVER_INACTIVE',
          message: `Driver account is ${driver.status.toLowerCase()}. Protected driver operations are disabled.`
        }
      });
    }

    const history = await queryAll(`
      SELECT * FROM bookings
      WHERE assigned_driver_id = ? AND status IN ('COMPLETED', 'CANCELLED')
      ORDER BY created_at DESC
      LIMIT ?
    `, [driver.id, limit]);

    res.json({
      success: true,
      data: { history, duties: history, bookings: history }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/drivers/duties/:id/status (Driver portal: update trip status)
router.patch('/duties/:id/status', requireAuth, requireRole('driver', 'admin'), async (req, res, next) => {
  try {
    const bookingId = req.params.id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_STATUS', message: 'Target status is required.' }
      });
    }

    // Verify driver is active and assigned to this specific booking (unless admin)
    if (req.user.role !== 'admin') {
      const driver = await queryOne('SELECT id, status FROM drivers WHERE user_id = ?', [req.user.id]);
      if (!driver) {
        return res.status(403).json({
          success: false,
          error: { code: 'NOT_A_DRIVER', message: 'No driver profile linked to this account.' }
        });
      }

      if (driver.status !== 'Active') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'DRIVER_INACTIVE',
            message: `Driver account is ${driver.status.toLowerCase()}. Protected driver operations are disabled.`
          }
        });
      }

      const booking = await queryOne('SELECT assigned_driver_id FROM bookings WHERE id = ?', [bookingId]);
      if (!booking || booking.assigned_driver_id !== driver.id) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only update duties assigned to you.' }
        });
      }
    }

    const normalizedTarget = String(status).toUpperCase().trim();
    if (normalizedTarget.includes('COMPLETE')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: 'Trip completion must be performed via the dedicated duty completion endpoint.'
        }
      });
    }
    if (normalizedTarget.includes('PEND')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: 'Drivers cannot revert assigned duties to PENDING.'
        }
      });
    }

    const updated = await updateBookingStatus({
      bookingId,
      newStatus: status,
      requesterUser: req.user,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      data: { booking: updated }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/drivers/location (Driver GPS: continuous location update)
router.put('/location', driverLocationRateLimiter, requireAuth, requireRole('driver'), async (req, res, next) => {
  try {
    // 1. Authenticated Driver Identity & Eligibility Verification
    // Derive driver strictly from authenticated session/JWT; never trust client-supplied IDs
    const driver = await queryOne('SELECT id, status FROM drivers WHERE user_id = ?', [req.user.id]);
    if (!driver) {
      return res.status(403).json({
        success: false,
        error: { code: 'NOT_A_DRIVER', message: 'No driver profile linked to this account.' }
      });
    }

    if (driver.status !== 'Active') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'DRIVER_INACTIVE',
          message: `Driver account is ${driver.status.toLowerCase()}. Protected driver operations are disabled.`
        }
      });
    }

    // 2. Strict Coordinate Validation
    const { latitude, longitude } = req.body || {};

    if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_COORDINATES', message: 'Both latitude and longitude are required.' }
      });
    }

    const isNumeric = (v) => (typeof v === 'number' && !isNaN(v)) || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)));
    if (!isNumeric(latitude) || !isNumeric(longitude)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_COORDINATES', message: 'Coordinates must be valid numeric values.' }
      });
    }

    const parsedLat = Number(latitude);
    const parsedLng = Number(longitude);

    if (
      !isFinite(parsedLat) || !isFinite(parsedLng) ||
      parsedLat < -90 || parsedLat > 90 ||
      parsedLng < -180 || parsedLng > 180
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_COORDINATES',
          message: 'Coordinates must be valid finite numbers within geographic bounds (-90 <= lat <= 90, -180 <= lng <= 180).'
        }
      });
    }

    // 3. Database Persistence: Update ONLY the authenticated driver's coordinates
    await execute(`
      UPDATE drivers
      SET current_latitude = ?, current_longitude = ?, last_location_update = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [parsedLat, parsedLng, driver.id]);

    // 4. Publish Realtime Location Event (Phase 10: non-blocking, safe dispatch)
    publishDriverLocation({
      driverId: driver.id,
      latitude: parsedLat,
      longitude: parsedLng
    }).catch(err => {
      console.warn('[REALTIME] Failed to dispatch driver location:', err.message);
    });

    res.json({
      success: true,
      data: {
        latitude: parsedLat,
        longitude: parsedLng
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/drivers/location (Driver GPS: fetch own latest persisted location)
router.get('/location', requireAuth, requireRole('driver'), async (req, res, next) => {
  try {
    const driver = await queryOne('SELECT id, status, current_latitude, current_longitude, last_location_update FROM drivers WHERE user_id = ?', [req.user.id]);
    if (!driver) {
      return res.status(403).json({
        success: false,
        error: { code: 'NOT_A_DRIVER', message: 'No driver profile linked to this account.' }
      });
    }

    res.json({
      success: true,
      data: {
        latitude: driver.current_latitude,
        longitude: driver.current_longitude,
        lastLocationUpdate: driver.last_location_update
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
