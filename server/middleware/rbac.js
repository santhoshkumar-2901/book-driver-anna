import { queryOne } from '../db/database.js';

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied: Requires one of [${allowedRoles.join(', ')}] role.`
        }
      });
    }

    next();
  };
}

export async function checkBookingOwnership(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
      });
    }

    const bookingId = req.params.id || req.body.bookingId;
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_BOOKING_ID', message: 'Booking ID is required.' }
      });
    }

    const booking = await queryOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }
      });
    }

    // 1. Admins have override access
    if (req.user.role === 'admin') {
      req.booking = booking;
      return next();
    }

    // 2. Customer ownership verification
    if (booking.user_id && booking.user_id === req.user.id) {
      req.booking = booking;
      return next();
    }

    // 3. Assigned driver verification
    if (req.user.role === 'driver') {
      const driver = await queryOne('SELECT id, status FROM drivers WHERE user_id = ?', [req.user.id]);
      if (driver && driver.status === 'Active' && booking.assigned_driver_id === driver.id) {
        req.booking = booking;
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied: You are not authorized to access this booking.'
      }
    });
  } catch (err) {
    next(err);
  }
}
