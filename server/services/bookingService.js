import crypto from 'crypto';
import { db } from '../db/database.js';
import { calculateAuthoritativeFare } from './pricingService.js';
import { logAuditEvent } from './auditService.js';

// Valid booking state machine transitions
const ALLOWED_STATE_TRANSITIONS = {
  'PENDING': ['ASSIGNED', 'CANCELLED'],
  'CONFIRMED': ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  'ASSIGNED': ['IN_PROGRESS', 'CANCELLED'],
  'IN_PROGRESS': ['COMPLETED', 'CANCELLED'],
  'COMPLETED': [], // Terminal
  'CANCELLED': []  // Terminal
};

export function createBooking({
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
  // 1. Validate Date: Cannot book in the past
  const today = new Date().toISOString().split('T')[0];
  if (date < today) {
    const err = new Error('Booking date cannot be in the past.');
    err.statusCode = 400;
    err.code = 'INVALID_DATE';
    throw err;
  }

  // 2. Idempotency Check: If duplicate request with same key arrives, return existing
  if (idempotencyKey) {
    const existing = db.prepare('SELECT * FROM bookings WHERE idempotency_key = ?').get(idempotencyKey);
    if (existing) {
      return { booking: existing, isDuplicate: true };
    }
  }

  // 3. Authoritative Fare Calculation on Backend
  const fareResult = calculateAuthoritativeFare({
    bookingCategory,
    selectedClassId,
    vehicleCategory,
    driverTripOption,
    dropLocation,
    roundTripDuration,
    outstationTripType,
    outstationPackage
  });

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
  // We use SQLite's BEGIN IMMEDIATE to lock writer access and prevent race conditions
  db.exec('BEGIN IMMEDIATE;');
  try {
    let assignedDriverId = null;

    // Check if user requested a specific driver
    if (preferredDriverId) {
      // Check if driver is already booked for this slot
      const conflict = db.prepare(`
        SELECT id FROM bookings 
        WHERE assigned_driver_id = ? 
          AND date = ? 
          AND time = ? 
          AND status IN ('PENDING', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS')
      `).get(preferredDriverId, date, time);

      if (conflict) {
        throw Object.assign(new Error('The requested driver is already booked for this date and time slot.'), {
          statusCode: 409,
          code: 'SLOT_UNAVAILABLE'
        });
      }
      assignedDriverId = preferredDriverId;
    }

    const insertStmt = db.prepare(`
      INSERT INTO bookings (
        id, user_id, customer_name, customer_phone, customer_email,
        booking_type, trip_type, service_name, pickup_area, drop_location,
        date, time, calculated_fare, payment_mode, status,
        assigned_driver_id, idempotency_key
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `);

    insertStmt.run(
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
    );

    db.exec('COMMIT;');

    const newBooking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);

    logAuditEvent({
      userId,
      action: 'BOOKING_CREATED',
      resourceType: 'booking',
      resourceId: bookingId,
      details: { fare: fareResult.totalFare, service: serviceName },
      ipAddress
    });

    return { booking: newBooking, isDuplicate: false };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function cancelBooking({ bookingId, requesterUser = null, requesterPhone = null, reason = 'Customer request', ipAddress = null }) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    const err = new Error('Booking not found.');
    err.statusCode = 404;
    err.code = 'BOOKING_NOT_FOUND';
    throw err;
  }

  // Authorization Check:
  // 1. User owns the booking OR is Admin
  // 2. OR requester provided matching phone number for guest bookings
  const isOwner = requesterUser && (booking.user_id === requesterUser.id || requesterUser.role === 'admin');
  const isPhoneMatch = requesterPhone && (
    booking.customer_phone.replace(/[^0-9]/g, '').endsWith(requesterPhone.replace(/[^0-9]/g, '').slice(-10))
  );

  if (!isOwner && !isPhoneMatch) {
    logAuditEvent({
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
  if (booking.status === 'COMPLETED') {
    const err = new Error('Completed trips cannot be cancelled.');
    err.statusCode = 400;
    err.code = 'INVALID_STATE_TRANSITION';
    throw err;
  }

  if (booking.status === 'CANCELLED') {
    return { booking, alreadyCancelled: true };
  }

  db.prepare(`
    UPDATE bookings 
    SET status = 'CANCELLED', cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(reason, bookingId);

  logAuditEvent({
    userId: requesterUser?.id || null,
    action: 'BOOKING_CANCELLED',
    resourceType: 'booking',
    resourceId: bookingId,
    details: { reason },
    ipAddress
  });

  const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  return { booking: updated, alreadyCancelled: false };
}

export function updateBookingStatus({ bookingId, newStatus, assignedDriverId = undefined, requesterUser, ipAddress = null }) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    const err = new Error('Booking not found.');
    err.statusCode = 404;
    err.code = 'BOOKING_NOT_FOUND';
    throw err;
  }

  // Validate state machine transition
  const allowed = ALLOWED_STATE_TRANSITIONS[booking.status] || [];
  if (!allowed.includes(newStatus)) {
    const err = new Error(`Cannot transition booking from '${booking.status}' to '${newStatus}'.`);
    err.statusCode = 400;
    err.code = 'INVALID_STATE_TRANSITION';
    throw err;
  }

  let updateSql = `UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP`;
  const params = [newStatus];

  if (assignedDriverId !== undefined) {
    updateSql += `, assigned_driver_id = ?`;
    params.push(assignedDriverId);
  }

  updateSql += ` WHERE id = ?`;
  params.push(bookingId);

  db.prepare(updateSql).run(...params);

  logAuditEvent({
    userId: requesterUser?.id || null,
    action: 'BOOKING_STATUS_UPDATED',
    resourceType: 'booking',
    resourceId: bookingId,
    details: { from: booking.status, to: newStatus },
    ipAddress
  });

  return db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
}

export function getUserBookings(userId, phone = null) {
  if (!userId && !phone) return [];
  if (userId) {
    return db.prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  }
  return db.prepare('SELECT * FROM bookings WHERE customer_phone = ? ORDER BY created_at DESC').all(phone);
}
