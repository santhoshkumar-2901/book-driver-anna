import { Router } from 'express';
import { createBooking, cancelBooking, getUserBookings } from '../services/bookingService.js';
import { calculateAuthoritativeFare, getAllPricing } from '../services/pricingService.js';
import { routingService } from '../services/routingService.js';
import { bookingRateLimiter, lookupRateLimiter } from '../middleware/rateLimiter.js';
import { validateBookingInput } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { checkBookingOwnership } from '../middleware/rbac.js';
import { queryOne, execute } from '../db/database.js';
import { logAuditEvent } from '../services/auditService.js';
import { publishBookingAssignmentChange } from '../services/realtimeService.js';

const router = Router();

/**
 * Handle estimate request for both POST and GET /api/bookings/estimate & /api/bookings/fare-estimate
 */
const handleEstimateRequest = async (req, res, next) => {
  try {
    const params = req.method === 'POST' ? req.body : req.query;

    const pickupLat = params.pickup?.latitude ?? params.pickup?.lat ?? params.pickupLat ?? params.pickupLatitude ?? params.pickup_latitude;
    const pickupLng = params.pickup?.longitude ?? params.pickup?.lng ?? params.pickupLng ?? params.pickupLongitude ?? params.pickup_longitude;
    const destLat = params.destination?.latitude ?? params.destination?.lat ?? params.destLat ?? params.destinationLatitude ?? params.destination_latitude;
    const destLng = params.destination?.longitude ?? params.destination?.lng ?? params.destLng ?? params.destinationLongitude ?? params.destination_longitude;

    if (
      pickupLat === undefined || pickupLng === undefined ||
      destLat === undefined || destLng === undefined ||
      String(pickupLat).trim() === '' || String(pickupLng).trim() === '' ||
      String(destLat).trim() === '' || String(destLng).trim() === ''
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_COORDINATES',
          message: 'Both pickup and destination coordinates are required for route fare estimation.'
        }
      });
    }

    const pLat = parseFloat(pickupLat);
    const pLng = parseFloat(pickupLng);
    const dLat = parseFloat(destLat);
    const dLng = parseFloat(destLng);

    if (
      isNaN(pLat) || isNaN(pLng) || isNaN(dLat) || isNaN(dLng) ||
      !isFinite(pLat) || !isFinite(pLng) || !isFinite(dLat) || !isFinite(dLng)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_COORDINATES',
          message: 'Coordinates must be valid finite numbers.'
        }
      });
    }

    if (
      pLat < -90 || pLat > 90 || dLat < -90 || dLat > 90 ||
      pLng < -180 || pLng > 180 || dLng < -180 || dLng > 180
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_COORDINATES',
          message: 'Coordinates must be within geographic bounds (-90..90 latitude, -180..180 longitude).'
        }
      });
    }

    if (Math.abs(pLat - dLat) < 0.0001 && Math.abs(pLng - dLng) < 0.0001) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SAME_LOCATION',
          message: 'Pickup and destination must be different.'
        }
      });
    }

    const category = params.bookingType || params.bookingCategory || 'driver';
    const validCategories = ['driver', 'vehicle', 'class'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_SERVICE',
          message: `Unsupported booking service category '${category}'.`
        }
      });
    }

    // 1. Authoritative Route Calculation
    let routeData;
    try {
      routeData = await routingService.getRoute({
        pickupLat: pLat,
        pickupLng: pLng,
        destLat: dLat,
        destLng: dLng
      });
    } catch (routeErr) {
      return res.status(routeErr.status || 500).json({
        success: false,
        error: {
          code: routeErr.code || 'ROUTING_FAILED',
          message: routeErr.message || 'Unable to calculate road route for fare estimation.'
        }
      });
    }

    // 2. Fetch live pricing tariffs from database
    const pricingData = await getAllPricing().catch(() => null);

    // Determine if distance pricing should be applied
    const isFareEstimateRoute = req.originalUrl?.includes('fare-estimate') || req.path?.includes('fare-estimate');
    const isPackageTrip = params.driverTripOption === 'round-trip' || params.driverTripOption === 'outstation';
    const isDistanceRequested = !isPackageTrip && Boolean(
      params.useDistancePricing === true ||
      params.isDistancePricing === true ||
      params.driverTripOption === 'distance' ||
      params.bookingType === 'distance' ||
      (category === 'driver' && isFareEstimateRoute && (!params.driverTripOption || params.driverTripOption === 'one-way' || params.driverTripOption === 'distance'))
    );

    // 3. Authoritative Fare Calculation on Backend
    const fareResult = calculateAuthoritativeFare({
      bookingCategory: category,
      bookingType: params.bookingType,
      selectedClassId: params.selectedClassId,
      vehicleCategory: params.vehicleCategory,
      driverTripOption: params.driverTripOption || (isDistanceRequested ? 'distance' : 'one-way'),
      dropLocation: params.dropLocation || (params.destination?.displayName || ''),
      roundTripDuration: params.roundTripDuration,
      outstationTripType: params.outstationTripType,
      outstationPackage: params.outstationPackage,
      distanceKm: routeData.distanceKm,
      durationMinutes: routeData.durationMinutes,
      isDistancePricing: isDistanceRequested,
      useDistancePricing: isDistanceRequested,
      waitingMinutes: params.waitingMinutes || 0
    }, pricingData?.map || null);

    res.json({
      success: true,
      data: {
        distanceKm: routeData.distanceKm,
        durationMinutes: routeData.durationMinutes,
        distanceMeters: routeData.distanceMeters,
        durationSeconds: routeData.durationSeconds,
        baseFare: fareResult.baseFare ?? fareResult.basePrice,
        pricePerKm: fareResult.pricePerKm ?? 0,
        distanceFare: fareResult.distanceFare ?? 0,
        minimumFare: fareResult.minimumFare ?? 0,
        minimumFareApplied: fareResult.minimumFareApplied || false,
        waitingMinutes: fareResult.waitingMinutes ?? 0,
        waitingFare: fareResult.waitingFare ?? 0,
        nightSurcharge: fareResult.nightSurcharge ?? 0,
        discountAmount: fareResult.discountAmount ?? 0,
        subtotal: fareResult.subtotal ?? fareResult.totalFare,
        calculatedFare: fareResult.calculatedFare ?? fareResult.totalFare,
        estimatedFare: fareResult.calculatedFare ?? fareResult.totalFare,
        totalFare: fareResult.totalFare,
        basePrice: fareResult.basePrice,
        gst: fareResult.gst ?? 0,
        currency: fareResult.currency || 'INR',
        pricingVersion: fareResult.pricingVersion || 1,
        fareBreakdown: fareResult.fareBreakdown || {
          baseFare: fareResult.baseFare ?? fareResult.basePrice,
          pricePerKm: fareResult.pricePerKm ?? 0,
          distanceKm: routeData.distanceKm,
          distanceFare: fareResult.distanceFare ?? 0,
          minimumFare: fareResult.minimumFare ?? 0,
          waitingMinutes: 0,
          waitingFare: 0,
          nightSurcharge: 0,
          discountAmount: 0,
          estimatedTotal: fareResult.totalFare
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// POST & GET /api/bookings/fare-estimate
router.post('/fare-estimate', bookingRateLimiter, handleEstimateRequest);
router.get('/fare-estimate', bookingRateLimiter, handleEstimateRequest);

// POST & GET /api/bookings/estimate
router.post('/estimate', bookingRateLimiter, handleEstimateRequest);
router.get('/estimate', bookingRateLimiter, handleEstimateRequest);

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
      pickupArea: req.body.pickupArea || req.body.pickupLocation || req.body.pickup || req.body.address || 'Pickup Location',
      pickupLat: req.body.pickupLat ?? req.body.pickupLatitude ?? req.body.pickup_latitude,
      pickupLng: req.body.pickupLng ?? req.body.pickupLongitude ?? req.body.pickup_longitude,
      destLat: req.body.destLat ?? req.body.destinationLatitude ?? req.body.destination_latitude,
      destLng: req.body.destLng ?? req.body.destinationLongitude ?? req.body.destination_longitude,
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
    const bookings = await getUserBookings(req.user.id, req.user.phone, req.query.limit);
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
    let booking;
    try {
      booking = await queryOne(`
        SELECT b.id,
               b.customer_name,
               b.customer_phone,
               b.service_name,
               b.booking_type,
               b.trip_type,
               b.pickup_area,
               b.drop_location,
               b.pickup_latitude,
               b.pickup_longitude,
               b.destination_latitude,
               b.destination_longitude,
               b.date,
               b.time,
               b.calculated_fare,
               b.payment_mode,
               b.status,
               b.created_at,
               b.assigned_driver_id,
               COALESCE(b.assigned_driver_name, d.name) as assigned_driver_name,
               COALESCE(b.assigned_driver_phone, d.phone) as assigned_driver_phone
        FROM bookings b
        LEFT JOIN drivers d ON b.assigned_driver_id = d.id
        WHERE b.id = ?
      `, [bookingId.trim()]);
    } catch (queryErr) {
      if (queryErr.message && (queryErr.message.includes('assigned_driver_name') || queryErr.message.includes('1054') || queryErr.message.includes('42S22'))) {
        booking = await queryOne(`
          SELECT b.id,
                 b.customer_name,
                 b.customer_phone,
                 b.service_name,
                 b.booking_type,
                 b.trip_type,
                 b.pickup_area,
                 b.drop_location,
                 b.pickup_latitude,
                 b.pickup_longitude,
                 b.destination_latitude,
                 b.destination_longitude,
                 b.date,
                 b.time,
                 b.calculated_fare,
                 b.payment_mode,
                 b.status,
                 b.created_at,
                 b.assigned_driver_id,
                 d.name as assigned_driver_name,
                 d.phone as assigned_driver_phone
          FROM bookings b
          LEFT JOIN drivers d ON b.assigned_driver_id = d.id
          WHERE b.id = ?
        `, [bookingId.trim()]);
      } else {
        throw queryErr;
      }
    }

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
    // Only pre-completion states ('CONFIRMED', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS') can be completed.
    // Explicitly reject PENDING, CANCELLED, and COMPLETED.
    const COMPLETABLE_STATES = ['CONFIRMED', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS'];
    if (!COMPLETABLE_STATES.includes(booking.status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: `Cannot complete booking in '${booking.status}' status.`
        }
      });
    }

    // Role-specific lifecycle constraint:
    // Drivers cannot jump directly from ASSIGNED or CONFIRMED to COMPLETED without starting the trip.
    if (req.user.role === 'driver' && (booking.status === 'ASSIGNED' || booking.status === 'CONFIRMED')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: `Drivers cannot jump directly from '${booking.status}' to COMPLETED without starting the trip.`
        }
      });
    }

    const result = await execute(`
      UPDATE bookings
      SET status = 'COMPLETED', payment_mode = COALESCE(?, payment_mode), updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status IN ('CONFIRMED', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS')
    `, [paymentMode || null, bookingId]);

    if (result.affectedRows === 0) {
      const current = await queryOne('SELECT status FROM bookings WHERE id = ?', [bookingId]);
      if (current && current.status === 'COMPLETED') {
        // Idempotent success
      } else {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONCURRENT_MODIFICATION',
            message: 'Booking state changed concurrently. Completion failed.'
          }
        });
      }
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

    try {
      await publishBookingAssignmentChange({
        bookingId,
        assignedDriverId: updated?.assigned_driver_id || null,
        assignedDriverName: updated?.assigned_driver_name || null,
        status: 'COMPLETED'
      });
    } catch (e) {}

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

// GET /api/bookings/:id/driver-location (Booking-scoped live driver tracking with ownership verification)
router.get('/:id/driver-location', requireAuth, checkBookingOwnership, async (req, res, next) => {
  try {
    const booking = req.booking;

    // Terminal state protection: live driver tracking stops on COMPLETED or CANCELLED
    const upperStatus = String(booking.status || '').toUpperCase();
    if (upperStatus === 'COMPLETED' || upperStatus === 'CANCELLED') {
      return res.json({
        success: true,
        data: {
          trackingActive: false,
          status: booking.status,
          message: `Trip is ${booking.status.toLowerCase()}. Live tracking is concluded.`,
          location: null
        }
      });
    }

    // Check if a driver is assigned
    if (!booking.assigned_driver_id) {
      return res.json({
        success: true,
        data: {
          trackingActive: false,
          status: booking.status,
          assignedDriver: null,
          message: 'No driver assigned to this booking yet.',
          location: null
        }
      });
    }

    // Retrieve ONLY the assigned driver's coordinates and freshness timestamp
    const driver = await queryOne(
      'SELECT id, name, status, current_latitude, current_longitude, last_location_update FROM drivers WHERE id = ?',
      [booking.assigned_driver_id]
    );

    if (!driver || driver.current_latitude === null || driver.current_longitude === null) {
      return res.json({
        success: true,
        data: {
          trackingActive: true,
          status: booking.status,
          assignedDriver: {
            id: driver?.id || booking.assigned_driver_id,
            name: booking.assigned_driver_name || driver?.name || 'Assigned Driver'
          },
          freshness: 'UNAVAILABLE',
          message: 'Driver location is not yet available.',
          location: null
        }
      });
    }

    // Evaluate freshness: LIVE (<= 45s), STALE (> 45s)
    let freshness = 'UNAVAILABLE';
    if (driver.last_location_update) {
      const rawDateStr = String(driver.last_location_update);
      const isoStr = (rawDateStr.includes('T') ? rawDateStr : rawDateStr.replace(' ', 'T')) + (rawDateStr.endsWith('Z') ? '' : 'Z');
      const ageMs = Date.now() - new Date(isoStr).getTime();
      freshness = (!isNaN(ageMs) && Math.abs(ageMs) <= 45000) ? 'LIVE' : 'STALE';
    }

    res.json({
      success: true,
      data: {
        trackingActive: true,
        status: booking.status,
        bookingId: booking.id,
        assignedDriver: {
          id: driver.id,
          name: booking.assigned_driver_name || driver.name
        },
        freshness,
        location: {
          latitude: Number(driver.current_latitude),
          longitude: Number(driver.current_longitude),
          updatedAt: driver.last_location_update,
          isLive: freshness === 'LIVE',
          isStale: freshness === 'STALE'
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
