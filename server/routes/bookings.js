import { Router } from 'express';
import { createBooking, cancelBooking, getUserBookings } from '../services/bookingService.js';
import { bookingRateLimiter } from '../middleware/rateLimiter.js';
import { validateBookingInput } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { checkBookingOwnership } from '../middleware/rbac.js';
import { queryOne, execute } from '../db/database.js';

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
router.post('/lookup', async (req, res, next) => {
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
      SELECT b.*, 
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

// POST /api/bookings/:id/complete (Mark trip completed & payment settled)
router.post('/:id/complete', optionalAuth, async (req, res, next) => {
  try {
    const bookingId = req.params.id;
    const { paymentMode } = req.body || {};
    const booking = await queryOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) {
      return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } });
    }

    await execute(`
      UPDATE bookings 
      SET status = 'COMPLETED', payment_mode = COALESCE(?, payment_mode), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [paymentMode || null, bookingId]);

    const updated = await queryOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    res.json({ success: true, data: { booking: updated } });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/:id (Get single booking with ownership verification)
router.get('/:id', optionalAuth, checkBookingOwnership, (req, res) => {
  res.json({
    success: true,
    data: { booking: req.booking }
  });
});

export default router;
