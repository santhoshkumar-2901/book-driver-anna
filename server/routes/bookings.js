import { Router } from 'express';
import { createBooking, cancelBooking, getUserBookings } from '../services/bookingService.js';
import { bookingRateLimiter, lookupRateLimiter } from '../middleware/rateLimiter.js';
import { validateBookingInput } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { checkBookingOwnership } from '../middleware/rbac.js';
import { queryOne, execute } from '../db/database.js';
import { logAuditEvent } from '../services/auditService.js';

const router = Router();

// POST /api/bookings (Create a booking)
router.post('/', bookingRateLimiter, optionalAuth, validateBookingInput, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || null;
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey || null;

    const result = await createBooking({
      userId: req.user ? req.user.id : null,
      customerName: req.body.customerName,
      customerPhone: req.body.customerPhone,
      customerEmail: req.body.customerEmail || (req.user ? req.user.email : null),
      bookingCategory: req.body.bookingCategory,
      selectedClassId: req.body.selectedClassId,
      vehicleCategory: req.body.vehicleCategory,
      driverTripOption: req.body.driverTripOption,
      dropLocation: req.body.dropLocation,
      roundTripDuration: req.body.roundTripDuration,
      outstationTripType: req.body.outstationTripType,
      outstationPackage: req.body.outstationPackage,
      outstationDestination: req.body.outstationDestination,
      pickupArea: req.body.pickupArea,
      date: req.body.date,
      time: req.body.time,
      paymentMode: req.body.paymentMode || 'cash',
      preferredDriverId: req.body.preferredDriverId || null,
      idempotencyKey,
      ipAddress
    });

    const statusCode = result.isDuplicate ? 200 : 201;
    res.status(statusCode).json({
      success: true,
      data: {
        booking: result.booking,
        isDuplicate: result.isDuplicate
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/my (User's personal bookings list)
router.get('/my', requireAuth, async (req, res, next) => {
  try {
    const bookings = await getUserBookings(req.user.id, req.user.phone);
    res.json({
      success: true,
      data: { bookings }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/bookings/lookup (Secure lookup requiring BOTH Booking ID AND Phone Number)
router.post('/lookup', lookupRateLimiter, async (req, res, next) => {
  try {
    const { bookingId, phone } = req.body;

    if (!bookingId || !phone) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Both Booking ID and registered Phone Number are required.' }
      });
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
    const booking = await queryOne(`
      SELECT b.id,
             b.customer_name,
             b.customer_phone,
             b.service_name,
             b.booking_type,
             b.trip_type,
             b.pickup_area,
             b.drop_location,
             b.date,
             b.time,
             b.calculated_fare,
             b.payment_mode,
             b.status,
             b.created_at,
             COALESCE(b.assigned_driver_name, d.name) as assigned_driver_name,
             COALESCE(b.assigned_driver_phone, d.phone) as assigned_driver_phone
      FROM bookings b
      LEFT JOIN drivers d ON b.assigned_driver_id = d.id
      WHERE b.id = ?
    `, [bookingId.trim()]);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'No booking found with this ID.' }
      });
    }

    const bookingPhoneClean = (booking.customer_phone || '').replace(/[^0-9]/g, '').slice(-10);
    if (bookingPhoneClean !== cleanPhone) {
      // Return 404 to avoid leaking whether ID exists
      return res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking ID and registered Phone Number do not match.' }
      });
    }

    res.json({
      success: true,
      data: { booking }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/bookings/:id/cancel
router.post('/:id/cancel', optionalAuth, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || null;
    const { phone, reason } = req.body;

    const result = await cancelBooking({
      bookingId: req.params.id,
      requesterUser: req.user || null,
      requesterPhone: phone || (req.user ? req.user.phone : null),
      reason: reason || 'Customer requested cancellation',
      ipAddress
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/bookings/:id/complete (Mark trip completed & payment settled with strict actor verification)
router.post('/:id/complete', requireAuth, async (req, res, next) => {
  try {
    const bookingId = req.params.id;
    const { paymentMode } = req.body || {};

    const booking = await queryOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }
      });
    }

    // Role & Ownership Verification:
    // Only administrators and active assigned drivers can complete a booking upon duty end & payment settlement.
    // Customers cannot complete bookings.
    let isAuthorized = false;

    if (req.user.role === 'admin') {
      isAuthorized = true;
    } else if (req.user.role === 'driver') {
      const driver = await queryOne('SELECT id, status FROM drivers WHERE user_id = ?', [req.user.id]);
      if (driver && driver.status === 'Active' && booking.assigned_driver_id === driver.id) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: You are not authorized to complete or settle this booking.'
        }
      });
    }

    // State Machine Validation:
    // Only pre-completion states ('CONFIRMED', 'ASSIGNED', 'IN_PROGRESS') can be completed.
    // Explicitly reject PENDING, CANCELLED, and COMPLETED.
    const COMPLETABLE_STATES = ['CONFIRMED', 'ASSIGNED', 'IN_PROGRESS'];
    if (!COMPLETABLE_STATES.includes(booking.status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: `Cannot complete booking in '${booking.status}' status.`
        }
      });
    }

    const result = await execute(`
      UPDATE bookings 
      SET status = 'COMPLETED', payment_mode = COALESCE(?, payment_mode), updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status IN ('CONFIRMED', 'ASSIGNED', 'IN_PROGRESS')
    `, [paymentMode || null, bookingId]);

    if (result.affectedRows === 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONCURRENT_MODIFICATION',
          message: 'Booking state changed concurrently. Completion failed.'
        }
      });
    }

    await logAuditEvent({
      userId: req.user.id,
      action: 'BOOKING_COMPLETED',
      resourceType: 'booking',
      resourceId: bookingId,
      details: { paymentMode: paymentMode || booking.payment_mode },
      ipAddress: req.ip
    });

    const updated = await queryOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    res.json({ success: true, data: { booking: updated } });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/:id (Get single booking with ownership verification)
router.get('/:id', requireAuth, checkBookingOwnership, (req, res) => {
  res.json({
    success: true,
    data: { booking: req.booking }
  });
});

export default router;
