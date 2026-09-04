import { db } from '../db/database.js';

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

export function checkBookingOwnership(req, res, next) {
  const bookingId = req.params.id || req.body.bookingId;
  if (!bookingId) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_BOOKING_ID', message: 'Booking ID is required.' }
    });
  }

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return res.status(404).json({
      success: false,
      error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }
    });
  }

  // Admins have override access
  if (req.user && req.user.role === 'admin') {
    req.booking = booking;
    return next();
  }

  // Check if authenticated user owns the booking
  if (req.user && booking.user_id === req.user.id) {
    req.booking = booking;
    return next();
  }

  return res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Access denied: You do not own this booking.'
    }
  });
}
