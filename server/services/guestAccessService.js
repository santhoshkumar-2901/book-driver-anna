import crypto from 'crypto';
import { queryOne, execute, withTransaction } from '../db/database.js';
import { ENV } from '../config/env.js';
import { logAuditEvent } from './auditService.js';

export function parseTokenExpiry(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  if (str.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(str)) {
    return new Date(str).getTime();
  }
  return new Date(str.replace(' ', 'T') + 'Z').getTime();
}

/**
 * Deterministically derives a 256-bit guest access token from the versioned secret keyring,
 * booking reference, and client idempotency key.
 */
export function deriveGuestToken(bookingId, idempotencyKey, secretVersion = null) {
  const version = (secretVersion || ENV.GUEST_TOKEN_ACTIVE_VERSION || 'v1').trim();
  const keyring = ENV.GUEST_TOKEN_KEYRING || {};
  const secret = keyring[version];

  if (!secret || typeof secret !== 'string' || secret.length < 32) {
    throw new Error(`Missing or invalid secret (min 32 chars) for guest token version '${version}'.`);
  }

  if (!bookingId || typeof bookingId !== 'string' || !bookingId.trim()) {
    throw new Error('Booking ID is required for guest token derivation.');
  }

  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    throw new Error('Idempotency key is required for guest token derivation.');
  }

  const rawToken = crypto
    .createHmac('sha256', secret)
    .update(`${bookingId.trim()}:${idempotencyKey.trim()}`)
    .digest('hex');

  const tokenHash = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  return {
    rawToken,
    tokenHash,
    secretVersion: version
  };
}

/**
 * Issues and persists initial guest token within an existing database transaction (tx).
 * Guarantees atomic rollback if booking insertion or token insertion fails.
 */
export async function issueInitialGuestTokenTx(tx, bookingId, idempotencyKey) {
  const { rawToken, tokenHash, secretVersion } = deriveGuestToken(bookingId, idempotencyKey);
  const tokenId = 'GAT-' + crypto.randomBytes(8).toString('hex').toUpperCase();

  const expiresAtDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const expiresAt = expiresAtDate.toISOString().replace('T', ' ').substring(0, 19);

  await tx.execute(`
    INSERT INTO guest_access_tokens (
      id, booking_id, token_hash, secret_version, purpose, expires_at, created_at
    ) VALUES (?, ?, ?, ?, 'payment_link', ?, CURRENT_TIMESTAMP)
  `, [
    tokenId,
    bookingId,
    tokenHash,
    secretVersion,
    expiresAt
  ]);

  return {
    token: rawToken,
    url: `/pay/${bookingId}#token=${rawToken}`,
    paymentUrl: `/pay/${bookingId}#token=${rawToken}`,
    expiresAt: expiresAtDate.toISOString()
  };
}

/**
 * Recovers the active token for an existing booking on duplicate idempotent submissions.
 */
export async function recoverTokenForIdempotentRetry(bookingId, idempotencyKey) {
  const tokenRecord = await queryOne(`
    SELECT id, booking_id, token_hash, secret_version, expires_at, revoked_at
    FROM guest_access_tokens
    WHERE booking_id = ? AND purpose = 'payment_link'
    ORDER BY created_at DESC
    LIMIT 1
  `, [bookingId]);

  if (!tokenRecord || tokenRecord.revoked_at) {
    return null;
  }

  const expiryTime = parseTokenExpiry(tokenRecord.expires_at);
  if (isNaN(expiryTime) || expiryTime <= Date.now()) {
    return null;
  }

  // Re-derive raw token using the version recorded in DB
  const { rawToken, tokenHash } = deriveGuestToken(bookingId, idempotencyKey, tokenRecord.secret_version);

  // Guard: Verify recomputed hash matches stored database hash
  if (tokenHash !== tokenRecord.token_hash) {
    return null;
  }

  return {
    token: rawToken,
    url: `/pay/${bookingId}#token=${rawToken}`,
    paymentUrl: `/pay/${bookingId}#token=${rawToken}`,
    expiresAt: new Date(expiryTime).toISOString()
  };
}

/**
 * Validates a guest token against database hash and returns booking & validity details.
 */
export async function validateGuestToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string' || !/^[0-9a-f]{64}$/i.test(rawToken.trim())) {
    return {
      valid: false,
      code: 'INVALID_TOKEN',
      status: 400,
      message: 'This payment link is invalid or malformed.'
    };
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

  const record = await queryOne(`
    SELECT t.id, t.booking_id, t.token_hash, t.secret_version, t.purpose, t.expires_at, t.revoked_at,
           b.id as b_id, b.service_name, b.booking_type, b.trip_type, b.date, b.time,
           b.pickup_area, b.drop_location, b.calculated_fare, b.status as booking_status,
           b.payment_status, b.assigned_driver_name
    FROM guest_access_tokens t
    JOIN bookings b ON t.booking_id = b.id
    WHERE t.token_hash = ?
  `, [tokenHash]);

  if (!record) {
    return {
      valid: false,
      code: 'TOKEN_NOT_FOUND',
      status: 404,
      message: 'No booking found for this payment link.'
    };
  }

  if (record.revoked_at) {
    return {
      valid: false,
      code: 'TOKEN_REVOKED',
      status: 403,
      message: 'This payment link has been replaced or revoked. Please contact support.'
    };
  }

  const expiryTime = parseTokenExpiry(record.expires_at);
  if (isNaN(expiryTime) || expiryTime <= Date.now()) {
    return {
      valid: false,
      code: 'TOKEN_EXPIRED',
      status: 410,
      message: 'This payment link has expired. To settle your outstanding fare, please contact Book Driver Anna support.'
    };
  }

  if (record.booking_status === 'CANCELLED') {
    return {
      valid: false,
      code: 'BOOKING_CANCELLED',
      status: 400,
      message: 'This booking has been cancelled.'
    };
  }

  return {
    valid: true,
    tokenRecord: record,
    booking: record
  };
}

/**
 * Builds sanitized, safe booking & payment summary for guest consumption.
 * Strictly omits customer phone/email, user IDs, driver phone, and exact coordinates.
 */
export async function getSanitizedBookingSummary(rawToken) {
  const validation = await validateGuestToken(rawToken);

  if (!validation.valid) {
    return {
      success: false,
      status: validation.status,
      error: {
        code: validation.code,
        message: validation.message
      }
    };
  }

  const b = validation.booking;
  const isPaid = b.payment_status === 'PAID';

  return {
    success: true,
    status: 200,
    data: {
      bookingId: b.b_id,
      serviceName: b.service_name,
      bookingCategory: b.booking_type,
      tripType: b.trip_type,
      date: b.date,
      time: b.time,
      pickupArea: b.pickup_area,
      dropLocation: b.drop_location,
      calculatedFare: Number(b.calculated_fare),
      currency: 'INR',
      bookingStatus: b.booking_status,
      paymentStatus: b.payment_status || 'UNPAID',
      isPaid,
      assignedDriverName: b.assigned_driver_name || null,
      expiresAt: new Date(parseTokenExpiry(validation.tokenRecord.expires_at)).toISOString()
    }
  };
}

/**
 * Re-issues a payment link under authenticated Administrator authorization.
 * Uses a fresh secure admin nonce, revokes previous tokens atomically, and logs an audit event.
 */
export async function reissueAdminPaymentLink({ bookingId, adminUserId, ipAddress = null }) {
  if (!bookingId || typeof bookingId !== 'string') {
    throw Object.assign(new Error('Booking ID is required.'), { statusCode: 400, code: 'INVALID_INPUT' });
  }

  const booking = await queryOne('SELECT id, status, payment_status, calculated_fare FROM bookings WHERE id = ?', [bookingId.trim()]);
  if (!booking) {
    throw Object.assign(new Error('Booking not found.'), { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  }

  if (booking.status === 'CANCELLED') {
    throw Object.assign(new Error('Cannot issue payment link for a cancelled booking.'), { statusCode: 400, code: 'BOOKING_CANCELLED' });
  }

  // Generate unique replacement nonce so the new link is independent of the original creation idempotency key
  const adminNonce = crypto.randomBytes(16).toString('hex');
  const replacementKey = `admin-reissue-${Date.now()}-${adminNonce}`;

  const { rawToken, tokenHash, secretVersion } = deriveGuestToken(booking.id, replacementKey);
  const tokenId = 'GAT-' + crypto.randomBytes(8).toString('hex').toUpperCase();

  const expiresAtDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const expiresAt = expiresAtDate.toISOString().replace('T', ' ').substring(0, 19);

  await withTransaction(async (tx) => {
    // Revoke any previous active tokens for this booking
    await tx.execute(`
      UPDATE guest_access_tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE booking_id = ? AND revoked_at IS NULL
    `, [booking.id]);

    // Insert new replacement token
    await tx.execute(`
      INSERT INTO guest_access_tokens (
        id, booking_id, token_hash, secret_version, purpose, expires_at, created_at
      ) VALUES (?, ?, ?, ?, 'payment_link', ?, CURRENT_TIMESTAMP)
    `, [
      tokenId,
      booking.id,
      tokenHash,
      secretVersion,
      expiresAt
    ]);
  });

  await logAuditEvent({
    userId: adminUserId,
    action: 'ADMIN_TOKEN_REISSUED',
    resourceType: 'booking',
    resourceId: booking.id,
    details: { tokenId, secretVersion },
    ipAddress
  });

  return {
    token: rawToken,
    url: `/pay/${booking.id}#token=${rawToken}`,
    paymentUrl: `/pay/${booking.id}#token=${rawToken}`,
    expiresAt: expiresAtDate.toISOString()
  };
}
