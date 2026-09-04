import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { updateBookingStatus } from '../services/bookingService.js';

const router = Router();

// GET /api/drivers (Public active driver roster)
router.get('/', (req, res) => {
  const drivers = db.prepare(`
    SELECT id, name, hub_area, experience_years, specialization, rating, trips_completed, status 
    FROM drivers 
    WHERE status = 'Active'
    ORDER BY rating DESC
  `).all();

  res.json({
    success: true,
    data: { drivers }
  });
});

// GET /api/drivers/duties (Driver portal: fetch duties assigned to authenticated driver)
router.get('/duties', requireAuth, requireRole('driver', 'admin'), (req, res) => {
  // Find driver ID for this user
  const driver = db.prepare('SELECT id FROM drivers WHERE user_id = ?').get(req.user.id);
  if (!driver && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { code: 'NOT_A_DRIVER', message: 'No driver profile linked to this account.' }
    });
  }

  const driverId = driver ? driver.id : null;
  let duties = [];

  if (driverId) {
    duties = db.prepare(`
      SELECT * FROM bookings 
      WHERE assigned_driver_id = ? 
      ORDER BY date ASC, time ASC
    `).all(driverId);
  } else if (req.user.role === 'admin') {
    duties = db.prepare('SELECT * FROM bookings ORDER BY date ASC, time ASC').all();
  }

  res.json({
    success: true,
    data: { duties }
  });
});

// PATCH /api/drivers/duties/:id/status (Driver portal: update trip status)
router.patch('/duties/:id/status', requireAuth, requireRole('driver', 'admin'), (req, res, next) => {
  try {
    const bookingId = req.params.id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_STATUS', message: 'Target status is required.' }
      });
    }

    // Verify driver is assigned to this booking (unless admin)
    if (req.user.role !== 'admin') {
      const driver = db.prepare('SELECT id FROM drivers WHERE user_id = ?').get(req.user.id);
      const booking = db.prepare('SELECT assigned_driver_id FROM bookings WHERE id = ?').get(bookingId);
      if (!booking || !driver || booking.assigned_driver_id !== driver.id) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only update duties assigned to you.' }
        });
      }
    }

    const updated = updateBookingStatus({
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
