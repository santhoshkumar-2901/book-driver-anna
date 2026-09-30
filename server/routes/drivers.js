import { Router } from 'express';
import { queryOne, queryAll } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { updateBookingStatus } from '../services/bookingService.js';

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

export default router;
