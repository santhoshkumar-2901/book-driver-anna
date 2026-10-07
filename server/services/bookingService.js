import crypto from 'crypto';
import { queryOne, queryAll, execute, withTransaction, isTiDB } from '../db/database.js';
import { calculateAuthoritativeFare, getAllPricing } from './pricingService.js';
import { routingService } from './routingService.js';
import { logAuditEvent } from './auditService.js';
import { isValidCalendarDate, getTodayIST } from '../middleware/validate.js';
import { publishBookingAssignmentChange } from './realtimeService.js';

// Valid booking state machine transitions
const ALLOWED_STATE_TRANSITIONS = {
  'PENDING': ['ASSIGNED', 'CONFIRMED', 'CANCELLED'],
  'CONFIRMED': ['ASSIGNED', 'CANCELLED', 'COMPLETED'],
  'ASSIGNED': ['ARRIVED', 'IN_PROGRESS', 'CONFIRMED', 'CANCELLED', 'COMPLETED'],
  'ARRIVED': ['IN_PROGRESS', 'CONFIRMED', 'CANCELLED', 'COMPLETED'],
  'IN_PROGRESS': ['COMPLETED'],
  'COMPLETED': [], // Terminal
  'CANCELLED': []  // Terminal
};

export async function createBooking({
  userId = null,
  customerName,
  customerPhone,
  customerEmail = null,
  bookingCategory = 'driver',
  selectedClassId = 'class-beginner',
  vehicleCategory = 'Sedan',
  driverTripOption = 'one-way',
  dropLocation = '',
  roundTripDuration = '4hr',
  outstationTripType = 'round-trip',
  outstationPackage = 'Round trip 24hr',
  outstationDestination = '',
  pickupArea = 'Pickup Location',
  pickupLat = undefined,
  pickupLng = undefined,
  destLat = undefined,
  destLng = undefined,
  pickupLatitude = undefined,
  pickupLongitude = undefined,
  destinationLatitude = undefined,
  destinationLongitude = undefined,
  pickup_latitude = undefined,
  pickup_longitude = undefined,
  destination_latitude = undefined,
  destination_longitude = undefined,
  date,
  time,
  paymentMode = 'cash',
  preferredDriverId = null,
  idempotencyKey = null,
  ipAddress = null,
  useDistancePricing = false,
  isDistancePricing = false
}) {
  // 1. Validate Mandatory Customer Details
  if (!customerPhone || typeof customerPhone !== 'string' || !customerPhone.trim()) {
    const err = new Error('Customer phone number is required.');
    err.statusCode = 400;
    err.code = 'INVALID_INPUT';
    throw err;
  }

  // 2. Validate Date: Must be a valid calendar date in YYYY-MM-DD format and cannot be in the past (IST)
  if (!date || !isValidCalendarDate(date)) {
    const err = new Error('Booking date must be a valid calendar date in YYYY-MM-DD format.');
    err.statusCode = 400;
    err.code = 'INVALID_INPUT';
    throw err;
  }

  const today = getTodayIST();
  if (date < today) {
    const err = new Error('Booking date cannot be in the past.');
    err.statusCode = 400;
    err.code = 'INVALID_DATE';
    throw err;
  }

  // 2. Idempotency Check: If duplicate request with same key arrives, return existing
  if (idempotencyKey) {
    const existing = await queryOne('SELECT * FROM bookings WHERE idempotency_key = ?', [idempotencyKey]);
    if (existing) {
      return { booking: existing, isDuplicate: true };
    }
  }

  // 3. Authoritative Route Calculation & Coordinate Validation (when coordinates are provided)
  const pLat = pickupLat ?? pickupLatitude ?? pickup_latitude;
  const pLng = pickupLng ?? pickupLongitude ?? pickup_longitude;
  const dLat = destLat ?? destinationLatitude ?? destination_latitude;
  const dLng = destLng ?? destinationLongitude ?? destination_longitude;

  const isProvided = (v) => v !== undefined && v !== null && (typeof v !== 'string' || v.trim() !== '');
  const hasAnyCoord = isProvided(pLat) || isProvided(pLng) || isProvided(dLat) || isProvided(dLng);
  const hasAllCoords = isProvided(pLat) && isProvided(pLng) && isProvided(dLat) && isProvided(dLng);

  let validatedPickupLat = null;
  let validatedPickupLng = null;
  let validatedDestLat = null;
  let validatedDestLng = null;
  let distanceKm = null;
  let durationMinutes = null;

  if (hasAnyCoord) {
    if (!hasAllCoords) {
      const err = new Error('Incomplete coordinate pair. If geographic coordinates are supplied, all 4 coordinates (pickupLat, pickupLng, destLat, destLng) must be provided.');
      err.statusCode = 400;
      err.code = 'INVALID_COORDINATES';
      throw err;
    }

    const isNumeric = (v) => (typeof v === 'number' && !isNaN(v)) || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)));
    if (!isNumeric(pLat) || !isNumeric(pLng) || !isNumeric(dLat) || !isNumeric(dLng)) {
      const err = new Error('Coordinates must be valid numeric values.');
      err.statusCode = 400;
      err.code = 'INVALID_COORDINATES';
      throw err;
    }

    const parsedPLat = Number(pLat);
    const parsedPLng = Number(pLng);
    const parsedDLat = Number(dLat);
    const parsedDLng = Number(dLng);

    if (
      isNaN(parsedPLat) || isNaN(parsedPLng) || isNaN(parsedDLat) || isNaN(parsedDLng) ||
      !isFinite(parsedPLat) || !isFinite(parsedPLng) || !isFinite(parsedDLat) || !isFinite(parsedDLng) ||
      parsedPLat < -90 || parsedPLat > 90 || parsedDLat < -90 || parsedDLat > 90 ||
      parsedPLng < -180 || parsedPLng > 180 || parsedDLng < -180 || parsedDLng > 180
    ) {
      const err = new Error('Coordinates must be valid finite numbers within geographic bounds (-90 <= lat <= 90, -180 <= lng <= 180).');
      err.statusCode = 400;
      err.code = 'INVALID_COORDINATES';
      throw err;
    }

    validatedPickupLat = parsedPLat;
    validatedPickupLng = parsedPLng;
    validatedDestLat = parsedDLat;
    validatedDestLng = parsedDLng;

    // Same-location protection: Pickup and destination coordinates must be distinct
    if (Math.abs(validatedPickupLat - validatedDestLat) < 0.0001 && Math.abs(validatedPickupLng - validatedDestLng) < 0.0001) {
      const err = new Error('Pickup and destination must be different.');
      err.statusCode = 400;
      err.code = 'SAME_LOCATION';
      throw err;
    }

    try {
      const routeData = await routingService.getRoute({
        pickupLat: validatedPickupLat,
        pickupLng: validatedPickupLng,
        destLat: validatedDestLat,
        destLng: validatedDestLng
      });
      if (routeData) {
        distanceKm = routeData.distanceKm;
        durationMinutes = routeData.durationMinutes;
      }
    } catch (routeErr) {
      if (routeErr.code === 'INVALID_COORDINATES' || routeErr.code === 'NO_ROUTE_FOUND' || routeErr.code === 'SAME_LOCATION') {
        routeErr.statusCode = routeErr.status || 400;
        throw routeErr;
      }
      if (isDistancePricing || useDistancePricing || driverTripOption === 'distance') {
        routeErr.statusCode = routeErr.status || 502;
        throw routeErr;
      }
      // Graceful degradation: External route provider timeout or network error must not crash booking creation
      console.warn('[BOOKING ROUTING] Route provider unavailable, degrading to standard tariff calculation:', routeErr.message);
    }
  }

  // 4. Authoritative Fare Calculation on Backend using dynamic live pricing
  const pricingData = await getAllPricing().catch(() => null);
  const fareResult = calculateAuthoritativeFare({
    bookingCategory,
    selectedClassId,
    vehicleCategory,
    driverTripOption,
    dropLocation,
    roundTripDuration,
    outstationTripType,
    outstationPackage,
    distanceKm,
    durationMinutes,
    isDistancePricing: isDistancePricing || Boolean(validatedPickupLat && validatedDestLat && bookingCategory === 'driver' && driverTripOption === 'distance'),
    useDistancePricing: useDistancePricing || Boolean(validatedPickupLat && validatedDestLat && bookingCategory === 'driver' && driverTripOption === 'distance')
  }, pricingData?.map || null);

  // 4. Generate Cryptographically Secure Booking ID
  const prefix = bookingCategory === 'class' ? 'BDA-CLS-' : bookingCategory === 'vehicle' ? 'BDA-VEH-' : 'BDA-DRV-';
  const bookingId = prefix + crypto.randomBytes(3).toString('hex').toUpperCase();

  let serviceName = '';
  if (bookingCategory === 'class') {
    serviceName = `Driving Class (${selectedClassId})`;
  } else if (bookingCategory === 'vehicle') {
    serviceName = `Vehicle Rental (${vehicleCategory})`;
  } else {
    serviceName = `Driver Service (${driverTripOption})`;
  }

  // 5. Transactional Slot Locking & Concurrency Protection
  return await withTransaction(async (tx) => {
    let assignedDriverId = null;

    // Check if user requested a specific driver
    if (preferredDriverId) {
      // 1. Verify the driver exists and is Active with row-level serialization for TiDB
      // In TiDB (distributed MySQL), SELECT ... FOR UPDATE acquires a pessimistic lock on the driver row,
      // serializing concurrent booking attempts for the same driver.
      // In SQLite, withTransaction uses BEGIN IMMEDIATE which acquires an exclusive DB-level lock.
      const driverQuery = isTiDB
        ? 'SELECT id, name, status FROM drivers WHERE id = ? FOR UPDATE'
        : 'SELECT id, name, status FROM drivers WHERE id = ?';
      const driver = await tx.queryOne(
        driverQuery,
        [preferredDriverId]
      );

      if (!driver) {
        throw Object.assign(new Error('The requested driver does not exist.'), {
          statusCode: 400,
          code: 'DRIVER_NOT_FOUND'
        });
      }

      if (driver.status !== 'Active') {
        throw Object.assign(new Error(`The requested driver is currently ${driver.status.toLowerCase()} and cannot accept new bookings.`), {
          statusCode: 400,
          code: 'DRIVER_NOT_ACTIVE'
        });
      }

      // 2. Check if driver is already booked for this slot
      const conflict = await tx.queryOne(`
        SELECT id FROM bookings
        WHERE assigned_driver_id = ?
          AND date = ?
          AND time = ?
          AND status IN ('PENDING', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS')
      `, [preferredDriverId, date, time]);

      if (conflict) {
        throw Object.assign(new Error('The requested driver is already booked for this date and time slot.'), {
          statusCode: 409,
          code: 'SLOT_UNAVAILABLE'
        });
      }
      assignedDriverId = preferredDriverId;
    }

    let hasSnapshotColumns = true;
    if (!isTiDB) {
      try {
        const info = await tx.queryAll('PRAGMA table_info(bookings)');
        hasSnapshotColumns = info.some(c => (c.name || '').toLowerCase() === 'distance_km');
      } catch (e) {
        hasSnapshotColumns = false;
      }
    }

    try {
      if (hasSnapshotColumns) {
        await tx.execute(`
          INSERT INTO bookings (
            id, user_id, customer_name, customer_phone, customer_email,
            booking_type, trip_type, service_name, pickup_area, drop_location,
            pickup_latitude, pickup_longitude, destination_latitude, destination_longitude,
            date, time, calculated_fare, payment_mode, status,
            assigned_driver_id, idempotency_key,
            distance_km, base_fare, price_per_km, distance_fare,
            waiting_minutes, waiting_fare, night_surcharge, discount_amount,
            currency, pricing_version
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          bookingId,
          userId,
          customerName.trim(),
          customerPhone.trim(),
          customerEmail ? customerEmail.trim() : null,
          bookingCategory,
          driverTripOption || bookingCategory,
          serviceName,
          pickupArea,
          dropLocation,
          validatedPickupLat,
          validatedPickupLng,
          validatedDestLat,
          validatedDestLng,
          date,
          time,
          fareResult.calculatedFare ?? fareResult.totalFare,
          paymentMode,
          assignedDriverId,
          idempotencyKey,
          fareResult.distanceKm ?? (distanceKm !== null && distanceKm !== undefined ? Number(distanceKm) : null),
          fareResult.baseFare ?? fareResult.basePrice ?? null,
          fareResult.pricePerKm ?? null,
          fareResult.distanceFare ?? null,
          fareResult.waitingMinutes ?? 0,
          fareResult.waitingFare ?? 0,
          fareResult.nightSurcharge ?? 0,
          fareResult.discountAmount ?? 0,
          fareResult.currency || 'INR',
          fareResult.pricingVersion || 1
        ]);
      } else {
        await tx.execute(`
          INSERT INTO bookings (
            id, user_id, customer_name, customer_phone, customer_email,
            booking_type, trip_type, service_name, pickup_area, drop_location,
            pickup_latitude, pickup_longitude, destination_latitude, destination_longitude,
            date, time, calculated_fare, payment_mode, status,
            assigned_driver_id, idempotency_key
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
        `, [
          bookingId,
          userId,
          customerName.trim(),
          customerPhone.trim(),
          customerEmail ? customerEmail.trim() : null,
          bookingCategory,
          driverTripOption || bookingCategory,
          serviceName,
          pickupArea,
          dropLocation,
          validatedPickupLat,
          validatedPickupLng,
          validatedDestLat,
          validatedDestLng,
          date,
          time,
          fareResult.calculatedFare ?? fareResult.totalFare,
          paymentMode,
          assignedDriverId,
          idempotencyKey
        ]);
      }
    } catch (insertErr) {
      if (idempotencyKey && (
        insertErr.message?.includes('UNIQUE constraint failed') ||
        insertErr.message?.includes('Duplicate entry') ||
        insertErr.code === 'ER_DUP_ENTRY'
      )) {
        const existing = await queryOne('SELECT * FROM bookings WHERE idempotency_key = ?', [idempotencyKey]);
        if (existing) {
          return { booking: existing, isDuplicate: true };
        }
      }
      throw insertErr;
    }

    const newBooking = await tx.queryOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);

    await logAuditEvent({
      userId,
      action: 'BOOKING_CREATED',
      resourceType: 'booking',
      resourceId: bookingId,
      details: { fare: fareResult.totalFare, service: serviceName },
      ipAddress
    });

    return { booking: newBooking, isDuplicate: false };
  });
}

export async function cancelBooking({ bookingId, requesterUser = null, requesterPhone = null, reason = 'Customer request', ipAddress = null }) {
  const booking = await queryOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  if (!booking) {
    const err = new Error('Booking not found.');
    err.statusCode = 404;
    err.code = 'BOOKING_NOT_FOUND';
    throw err;
  }

  // Authorization Check:
  // 1. Admin always authorized
  // 2. Authenticated user who owns the booking (booking.user_id === requesterUser.id)
  // 3. Guest booking (booking.user_id IS NULL): requester must supply matching phone number
  const isAdmin = requesterUser && requesterUser.role === 'admin';
  const isOwner = requesterUser && booking.user_id && (booking.user_id === requesterUser.id);
  const cleanBookingPhone = (booking.customer_phone || '').replace(/[^0-9]/g, '').slice(-10);
  const cleanRequesterPhone = (requesterPhone || '').replace(/[^0-9]/g, '').slice(-10);
  const isGuestBooking = !booking.user_id;
  const isPhoneMatch = isGuestBooking && cleanRequesterPhone && cleanRequesterPhone.length >= 10 && cleanBookingPhone === cleanRequesterPhone;

  if (!isAdmin && !isOwner && !isPhoneMatch) {
    await logAuditEvent({
      userId: requesterUser?.id || null,
      action: 'UNAUTHORIZED_CANCEL_ATTEMPT',
      resourceType: 'booking',
      resourceId: bookingId,
      details: { requesterPhone },
      ipAddress
    });
    const err = new Error('Access denied: You do not have authorization to cancel this booking.');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  // State Machine Validation: Only PENDING, CONFIRMED, or ASSIGNED can be cancelled
  if (booking.status === 'COMPLETED' || booking.status === 'IN_PROGRESS') {
    const err = new Error(`Trips in '${booking.status}' status cannot be cancelled.`);
    err.statusCode = 400;
    err.code = 'INVALID_STATE_TRANSITION';
    throw err;
  }

  if (booking.status === 'CANCELLED') {
    return { booking, alreadyCancelled: true };
  }

  const CANCELLABLE_STATES = ['PENDING', 'CONFIRMED', 'ASSIGNED', 'ARRIVED'];
  if (!CANCELLABLE_STATES.includes(booking.status)) {
    const err = new Error(`Cannot cancel booking with status '${booking.status}'.`);
    err.statusCode = 400;
    err.code = 'INVALID_STATE_TRANSITION';
    throw err;
  }

  // Atomic conditional update
  const result = await execute(`
    UPDATE bookings
    SET status = 'CANCELLED', cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status IN ('PENDING', 'CONFIRMED', 'ASSIGNED', 'ARRIVED')
  `, [reason, bookingId]);

  if (result.affectedRows === 0) {
    const current = await queryOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (current && current.status === 'CANCELLED') {
      return { booking: current, alreadyCancelled: true };
    }
    const err = new Error('Booking could not be cancelled due to a concurrent state change.');
    err.statusCode = 409;
    err.code = 'CONCURRENT_MODIFICATION';
    throw err;
  }

  await logAuditEvent({
    userId: requesterUser?.id || null,
    action: 'BOOKING_CANCELLED',
    resourceType: 'booking',
    resourceId: bookingId,
    details: { reason },
    ipAddress
  });

  const updated = await queryOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);

  try {
    await publishBookingAssignmentChange({
      bookingId,
      assignedDriverId: null,
      assignedDriverName: null,
      status: 'CANCELLED'
    });
  } catch (e) {}

  return { booking: updated, alreadyCancelled: false };
}

export async function updateBookingStatus({
  bookingId,
  newStatus,
  assignedDriverId = undefined,
  assignedDriverName = undefined,
  assignedDriverPhone = undefined,
  requesterUser,
  ipAddress = null,
  tx = null
}) {
  const qOne = tx ? tx.queryOne : queryOne;
  const exec = tx ? tx.execute : execute;

  const booking = await qOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  if (!booking) {
    const err = new Error('Booking not found.');
    err.statusCode = 404;
    err.code = 'BOOKING_NOT_FOUND';
    throw err;
  }

  let normalizedNewStatus = String(newStatus).toUpperCase().trim();
  if (normalizedNewStatus.includes('ARRIV')) {
    normalizedNewStatus = 'ARRIVED';
  } else if (normalizedNewStatus.includes('ASSIGN')) {
    normalizedNewStatus = 'ASSIGNED';
  } else if (normalizedNewStatus.includes('CONFIRM')) {
    normalizedNewStatus = 'CONFIRMED';
  } else if (normalizedNewStatus.includes('PROGRESS')) {
    normalizedNewStatus = 'IN_PROGRESS';
  } else if (normalizedNewStatus.includes('COMPLETE')) {
    normalizedNewStatus = 'COMPLETED';
  } else if (normalizedNewStatus.includes('CANCEL')) {
    normalizedNewStatus = 'CANCELLED';
  } else if (normalizedNewStatus.includes('PEND')) {
    normalizedNewStatus = 'PENDING';
  }

  const currentStatus = String(booking.status).toUpperCase();

  // Terminal state protection: never resurrect or alter COMPLETED or CANCELLED bookings
  if (currentStatus === 'COMPLETED' || currentStatus === 'CANCELLED') {
    const err = new Error(`Cannot modify or transition booking in terminal '${booking.status}' status.`);
    err.statusCode = 400;
    err.code = 'INVALID_STATE_TRANSITION';
    throw err;
  }

  // Defense-in-depth: Enforce role-based ownership authorization at service layer
  if (requesterUser) {
    if (requesterUser.role === 'driver') {
      let requesterDriverId = requesterUser.driverId;
      if (!requesterDriverId && requesterUser.id) {
        const dRec = await qOne('SELECT id, status FROM drivers WHERE user_id = ?', [requesterUser.id]);
        if (dRec) {
          requesterDriverId = dRec.id;
          if (dRec.status !== 'Active') {
            const err = new Error(`Driver account is ${dRec.status.toLowerCase()}. Protected driver operations are disabled.`);
            err.statusCode = 403;
            err.code = 'DRIVER_INACTIVE';
            throw err;
          }
        }
      }
      if (!booking.assigned_driver_id || !requesterDriverId || booking.assigned_driver_id !== requesterDriverId) {
        const err = new Error('Access denied: You are not authorized to modify this booking.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
      if (['PENDING', 'CONFIRMED', 'CANCELLED', 'ASSIGNED'].includes(normalizedNewStatus)) {
        const err = new Error(`Drivers cannot transition booking to '${normalizedNewStatus}'.`);
        err.statusCode = 400;
        err.code = 'INVALID_STATE_TRANSITION';
        throw err;
      }
      if (currentStatus === 'ASSIGNED' && normalizedNewStatus === 'COMPLETED') {
        const err = new Error('Drivers cannot complete booking directly from ASSIGNED without starting the trip.');
        err.statusCode = 400;
        err.code = 'INVALID_STATE_TRANSITION';
        throw err;
      }
    } else if (requesterUser.role === 'customer') {
      if (normalizedNewStatus === 'ARRIVED') {
        const err = new Error('Access denied: Customers cannot mark driver arrival.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
      if (booking.user_id && booking.user_id !== requesterUser.id) {
        const err = new Error('Access denied: You do not have authorization to modify this booking.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
    } else if (requesterUser.role !== 'admin') {
      const err = new Error('Access denied: Unauthorized role.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
  }

  // Validate state machine transition (allow same status or permitted transition)
  const allowed = ALLOWED_STATE_TRANSITIONS[currentStatus] || [];
  if (normalizedNewStatus !== currentStatus && !allowed.includes(normalizedNewStatus)) {
    const err = new Error(`Cannot transition booking from '${booking.status}' to '${normalizedNewStatus}'.`);
    err.statusCode = 400;
    err.code = 'INVALID_STATE_TRANSITION';
    throw err;
  }

  let updateSql = `UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP`;
  const params = [normalizedNewStatus];

  if (assignedDriverId !== undefined) {
    updateSql += `, assigned_driver_id = ?`;
    params.push(assignedDriverId);
  }
  if (assignedDriverName !== undefined) {
    updateSql += `, assigned_driver_name = ?`;
    params.push(assignedDriverName);
  }
  if (assignedDriverPhone !== undefined) {
    updateSql += `, assigned_driver_phone = ?`;
    params.push(assignedDriverPhone);
  }

  updateSql += ` WHERE id = ? AND status = ?`;
  params.push(bookingId, booking.status);

  let result;
  try {
    result = await exec(updateSql, params);
  } catch (updateErr) {
    if (updateErr.message && (updateErr.message.includes('assigned_driver_name') || updateErr.message.includes('1054') || updateErr.message.includes('42S22'))) {
      let fallbackSql = `UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP`;
      const fallbackParams = [normalizedNewStatus];
      if (assignedDriverId !== undefined) {
        fallbackSql += `, assigned_driver_id = ?`;
        fallbackParams.push(assignedDriverId);
      }
      fallbackSql += ` WHERE id = ? AND status = ?`;
      fallbackParams.push(bookingId, booking.status);
      result = await exec(fallbackSql, fallbackParams);
    } else {
      throw updateErr;
    }
  }

  if (result.affectedRows === 0) {
    const current = await qOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!current) {
      const err = new Error('Booking not found.');
      err.statusCode = 404;
      err.code = 'BOOKING_NOT_FOUND';
      throw err;
    }
    // If the booking is already in the desired status (idempotent retry or MySQL reported 0 rows changed),
    // treat it as successful and return current record
    if (String(current.status).toUpperCase() === normalizedNewStatus) {
      // Successfully in target status already; continue to audit log and return updated
    } else if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
      const err = new Error(`Cannot modify or transition booking in terminal '${current.status}' status.`);
      err.statusCode = 400;
      err.code = 'INVALID_STATE_TRANSITION';
      throw err;
    } else {
      const err = new Error('Booking could not be updated due to a concurrent state change.');
      err.statusCode = 409;
      err.code = 'CONCURRENT_MODIFICATION';
      throw err;
    }
  }

  await logAuditEvent({
    userId: requesterUser?.id || null,
    action: 'BOOKING_STATUS_UPDATED',
    resourceType: 'booking',
    resourceId: bookingId,
    details: { from: booking.status, to: normalizedNewStatus, assignedDriverName },
    ipAddress
  });

  let updated;
  try {
    updated = await qOne(`
      SELECT b.*,
             COALESCE(b.assigned_driver_name, d.name) as assigned_driver_name,
             COALESCE(b.assigned_driver_phone, d.phone) as assigned_driver_phone
      FROM bookings b
      LEFT JOIN drivers d ON b.assigned_driver_id = d.id
      WHERE b.id = ?
    `, [bookingId]);
  } catch (err) {
    if (err.message && (err.message.includes('assigned_driver_name') || err.message.includes('1054') || err.message.includes('42S22'))) {
      updated = await qOne(`
        SELECT b.*,
               d.name as assigned_driver_name,
               d.phone as assigned_driver_phone
        FROM bookings b
        LEFT JOIN drivers d ON b.assigned_driver_id = d.id
        WHERE b.id = ?
      `, [bookingId]);
    } else {
      throw err;
    }
  }

  if (!tx && (assignedDriverId !== undefined || normalizedNewStatus !== currentStatus)) {
    try {
      await publishBookingAssignmentChange({
        bookingId,
        assignedDriverId: updated?.assigned_driver_id || null,
        assignedDriverName: updated?.assigned_driver_name || null,
        status: updated?.status
      });
    } catch (e) {}
  }

  return updated;
}

export async function getUserBookings(userId, phone = null, limit = 50) {
  if (!userId && !phone) return [];
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));

  const runQuery = async (includeAssignedCols = true) => {
    const selectSql = `
      SELECT b.*,
             ${includeAssignedCols ? 'COALESCE(b.assigned_driver_name, d.name)' : 'd.name'} as assigned_driver_name,
             ${includeAssignedCols ? 'COALESCE(b.assigned_driver_phone, d.phone)' : 'd.phone'} as assigned_driver_phone
      FROM bookings b
      LEFT JOIN drivers d ON b.assigned_driver_id = d.id
    `;
    if (userId && phone) {
      const cleanPhone = String(phone).replace(/[^0-9]/g, '');
      const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
      return await queryAll(
        `${selectSql} WHERE (b.user_id = ? OR b.customer_phone = ? OR b.customer_phone LIKE ?) ORDER BY b.created_at DESC LIMIT ?`,
        [userId, String(phone).trim(), `%${last10}`, safeLimit]
      );
    } else if (userId) {
      return await queryAll(`${selectSql} WHERE b.user_id = ? ORDER BY b.created_at DESC LIMIT ?`, [userId, safeLimit]);
    }
    const cleanPhone = String(phone).replace(/[^0-9]/g, '');
    const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
    return await queryAll(`${selectSql} WHERE (b.customer_phone = ? OR b.customer_phone LIKE ?) ORDER BY b.created_at DESC LIMIT ?`, [String(phone).trim(), `%${last10}`, safeLimit]);
  };

  try {
    return await runQuery(true);
  } catch (err) {
    if (err.message && (err.message.includes('assigned_driver_name') || err.message.includes('1054') || err.message.includes('42S22'))) {
      return await runQuery(false);
    }
    throw err;
  }
}

/**
 * Fetch open, unassigned customer bookings for driver portal pool
 */
export async function getAvailableDriverDuties(limit = 50) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));

  const runQuery = async (includeAssignedCols = true) => {
    const selectSql = `
      SELECT b.*,
             ${includeAssignedCols ? 'COALESCE(b.assigned_driver_name, d.name)' : 'd.name'} as assigned_driver_name,
             ${includeAssignedCols ? 'COALESCE(b.assigned_driver_phone, d.phone)' : 'd.phone'} as assigned_driver_phone
      FROM bookings b
      LEFT JOIN drivers d ON b.assigned_driver_id = d.id
      WHERE (b.booking_type = 'driver' OR b.booking_type IS NULL OR b.booking_type = '')
        AND (b.status = 'PENDING' OR b.status = 'CONFIRMED')
        AND b.assigned_driver_id IS NULL
      ORDER BY b.created_at DESC
      LIMIT ?
    `;
    return await queryAll(selectSql, [safeLimit]);
  };

  try {
    return await runQuery(true);
  } catch (err) {
    if (err.message && (err.message.includes('assigned_driver_name') || err.message.includes('1054') || err.message.includes('42S22'))) {
      return await runQuery(false);
    }
    throw err;
  }
}

/**
 * Accept / claim an open customer booking by driver partner with race-condition protection
 */
export async function acceptDriverDuty({ bookingId, requesterUser, ipAddress = null }) {
  if (!requesterUser) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  // Find driver record
  let driver;
  if (requesterUser.role === 'admin') {
    driver = await queryOne('SELECT id, name, phone, status FROM drivers WHERE status = "Active" LIMIT 1');
  } else {
    driver = await queryOne('SELECT id, name, phone, status FROM drivers WHERE user_id = ?', [requesterUser.id]);
    if (!driver && requesterUser.driverId) {
      driver = await queryOne('SELECT id, name, phone, status FROM drivers WHERE id = ?', [requesterUser.driverId]);
    }
  }

  if (!driver) {
    const err = new Error('No driver profile linked to this account.');
    err.statusCode = 403;
    err.code = 'NOT_A_DRIVER';
    throw err;
  }

  if (driver.status !== 'Active') {
    const err = new Error(`Driver account is ${driver.status.toLowerCase()}. Only active drivers can accept duties.`);
    err.statusCode = 403;
    err.code = 'DRIVER_INACTIVE';
    throw err;
  }

  const updated = await withTransaction(async (tx) => {
    // Pessimistic / row lock on booking
    const lockSql = isTiDB
      ? 'SELECT * FROM bookings WHERE id = ? FOR UPDATE'
      : 'SELECT * FROM bookings WHERE id = ?';
    const booking = await tx.queryOne(lockSql, [bookingId]);

    if (!booking) {
      const err = new Error('Booking not found.');
      err.statusCode = 404;
      err.code = 'BOOKING_NOT_FOUND';
      throw err;
    }

    if (booking.assigned_driver_id) {
      const err = new Error('This duty has already been accepted by another driver.');
      err.statusCode = 409;
      err.code = 'DUTY_ALREADY_CLAIMED';
      throw err;
    }

    const currentStatus = String(booking.status).toUpperCase();
    if (currentStatus !== 'PENDING' && currentStatus !== 'CONFIRMED') {
      const err = new Error(`Duty cannot be accepted in '${booking.status}' status.`);
      err.statusCode = 400;
      err.code = 'INVALID_STATE_TRANSITION';
      throw err;
    }

    // Check for slot conflict for this driver
    const conflict = await tx.queryOne(`
      SELECT id
      FROM bookings
      WHERE assigned_driver_id = ?
        AND date = ?
        AND time = ?
        AND id != ?
        AND status IN ('PENDING', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS')
      LIMIT 1
    `, [driver.id, booking.date, booking.time, bookingId]);

    if (conflict) {
      const err = new Error('You already have another assigned duty for this date and time slot.');
      err.statusCode = 409;
      err.code = 'SLOT_UNAVAILABLE';
      throw err;
    }

    let updateResult;
    try {
      updateResult = await tx.execute(`
        UPDATE bookings
        SET status = 'ASSIGNED',
            assigned_driver_id = ?,
            assigned_driver_name = ?,
            assigned_driver_phone = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND assigned_driver_id IS NULL
      `, [driver.id, driver.name, driver.phone, bookingId]);
    } catch (updateErr) {
      if (updateErr.message && (updateErr.message.includes('assigned_driver_name') || updateErr.message.includes('1054') || updateErr.message.includes('42S22'))) {
        updateResult = await tx.execute(`
          UPDATE bookings
          SET status = 'ASSIGNED',
              assigned_driver_id = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND assigned_driver_id IS NULL
        `, [driver.id, bookingId]);
      } else {
        throw updateErr;
      }
    }

    if (!updateResult || updateResult.affectedRows === 0) {
      const err = new Error('This duty has already been accepted by another driver.');
      err.statusCode = 409;
      err.code = 'DUTY_ALREADY_CLAIMED';
      throw err;
    }

    let updated;
    try {
      updated = await tx.queryOne(`
        SELECT b.*,
               COALESCE(b.assigned_driver_name, d.name) as assigned_driver_name,
               COALESCE(b.assigned_driver_phone, d.phone) as assigned_driver_phone
        FROM bookings b
        LEFT JOIN drivers d ON b.assigned_driver_id = d.id
        WHERE b.id = ?
      `, [bookingId]);
    } catch (err) {
      if (err.message && (err.message.includes('assigned_driver_name') || err.message.includes('1054') || err.message.includes('42S22'))) {
        updated = await tx.queryOne(`
          SELECT b.*,
                 d.name as assigned_driver_name,
                 d.phone as assigned_driver_phone
          FROM bookings b
          LEFT JOIN drivers d ON b.assigned_driver_id = d.id
          WHERE b.id = ?
        `, [bookingId]);
      } else {
        throw err;
      }
    }

    await logAuditEvent({
      userId: requesterUser.id,
      action: 'DRIVER_ACCEPTED_DUTY',
      resourceType: 'booking',
      resourceId: bookingId,
      details: { driverId: driver.id, driverName: driver.name, customer: booking.customer_name },
      ipAddress
    });

    return updated;
  });

  try {
    await publishBookingAssignmentChange({
      bookingId,
      assignedDriverId: updated?.assigned_driver_id || driver.id,
      assignedDriverName: updated?.assigned_driver_name || driver.name,
      assignedDriverPhone: updated?.assigned_driver_phone || driver.phone,
      status: 'ASSIGNED'
    });
  } catch (realtimeErr) {
    // Non-blocking
  }

  return updated;
}
