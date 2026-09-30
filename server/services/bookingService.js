import crypto from 'crypto';
import { queryOne, queryAll, execute, withTransaction, isTiDB } from '../db/database.js';
import { calculateAuthoritativeFare, getAllPricing } from './pricingService.js';
import { logAuditEvent } from './auditService.js';
import { isValidCalendarDate, getTodayIST } from '../middleware/validate.js';

// Valid booking state machine transitions
const ALLOWED_STATE_TRANSITIONS = {
  'PENDING': ['ASSIGNED', 'CONFIRMED', 'CANCELLED'],
  'CONFIRMED': ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED', 'COMPLETED'],
  'ASSIGNED': ['IN_PROGRESS', 'CONFIRMED', 'CANCELLED'],
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
  pickupArea = 'Indiranagar',
  date,
  time,
  paymentMode = 'cash',
  preferredDriverId = null,
  idempotencyKey = null,
  ipAddress = null
}) {
  // 1. Validate Date: Must be a valid calendar date in YYYY-MM-DD format and cannot be in the past (IST)
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

  // 3. Authoritative Fare Calculation on Backend using dynamic live pricing
  const pricingData = await getAllPricing().catch(() => null);
  const fareResult = calculateAuthoritativeFare({
    bookingCategory,
    selectedClassId,
    vehicleCategory,
    driverTripOption,
    dropLocation,
    roundTripDuration,
    outstationTripType,
    outstationPackage
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

    await tx.execute(`
      INSERT INTO bookings (
        id, user_id, customer_name, customer_phone, customer_email,
        booking_type, trip_type, service_name, pickup_area, drop_location,
        date, time, calculated_fare, payment_mode, status,
        assigned_driver_id, idempotency_key
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
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
      date,
      time,
      fareResult.totalFare,
      paymentMode,
      assignedDriverId,
      idempotencyKey
    ]);

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
  const isPhoneMatch = isGuestBooking && cleanRequesterPhone && cleanBookingPhone.endsWith(cleanRequesterPhone);

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

  const CANCELLABLE_STATES = ['PENDING', 'CONFIRMED', 'ASSIGNED'];
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
    WHERE id = ? AND status IN ('PENDING', 'CONFIRMED', 'ASSIGNED')
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
  if (normalizedNewStatus.includes('ASSIGN')) {
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

  const result = await exec(updateSql, params);

  if (result.affectedRows === 0) {
    const current = await qOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!current) {
      const err = new Error('Booking not found.');
      err.statusCode = 404;
      err.code = 'BOOKING_NOT_FOUND';
      throw err;
    }
    if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
      const err = new Error(`Cannot modify or transition booking in terminal '${current.status}' status.`);
      err.statusCode = 400;
      err.code = 'INVALID_STATE_TRANSITION';
      throw err;
    }
    const err = new Error('Booking could not be updated due to a concurrent state change.');
    err.statusCode = 409;
    err.code = 'CONCURRENT_MODIFICATION';
    throw err;
  }

  await logAuditEvent({
    userId: requesterUser?.id || null,
    action: 'BOOKING_STATUS_UPDATED',
    resourceType: 'booking',
    resourceId: bookingId,
    details: { from: booking.status, to: normalizedNewStatus, assignedDriverName },
    ipAddress
  });

  return await qOne(`
    SELECT b.*, 
           COALESCE(b.assigned_driver_name, d.name) as assigned_driver_name,
           COALESCE(b.assigned_driver_phone, d.phone) as assigned_driver_phone
    FROM bookings b
    LEFT JOIN drivers d ON b.assigned_driver_id = d.id
    WHERE b.id = ?
  `, [bookingId]);
}

export async function getUserBookings(userId, phone = null) {
  if (!userId && !phone) return [];
  const selectSql = `
    SELECT b.*, 
           COALESCE(b.assigned_driver_name, d.name) as assigned_driver_name,
           COALESCE(b.assigned_driver_phone, d.phone) as assigned_driver_phone
    FROM bookings b
    LEFT JOIN drivers d ON b.assigned_driver_id = d.id
  `;
  if (userId && phone) {
    const cleanPhone = String(phone).replace(/[^0-9]/g, '');
    const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
    return await queryAll(
      `${selectSql} WHERE b.user_id = ? OR b.customer_phone = ? OR b.customer_phone LIKE ? ORDER BY b.created_at DESC`,
      [userId, String(phone).trim(), `%${last10}`]
    );
  } else if (userId) {
    return await queryAll(`${selectSql} WHERE b.user_id = ? ORDER BY b.created_at DESC`, [userId]);
  }
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
  return await queryAll(`${selectSql} WHERE b.customer_phone = ? OR b.customer_phone LIKE ? ORDER BY b.created_at DESC`, [String(phone).trim(), `%${last10}`]);
}
