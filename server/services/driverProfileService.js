import { queryOne, queryAll, execute, withTransaction } from '../db/database.js';
import { generateToken } from './authService.js';
import { logAuditEvent } from './auditService.js';
import { isValidIndianPhone, formatIndianPhone, sanitizeString } from '../middleware/validate.js';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const UPI_REGEX = /^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$/;

/**
 * Masks sensitive driving license number (e.g. KA-04-2021-0098745 -> KA-04-XXXX-8745)
 */
export function maskLicenseNumber(licenseNumber) {
  if (!licenseNumber || typeof licenseNumber !== 'string') return '';
  const clean = licenseNumber.trim();
  if (clean.length <= 6) return clean;
  const parts = clean.split('-');
  if (parts.length >= 3) {
    const start = parts.slice(0, 2).join('-');
    const end = parts[parts.length - 1];
    return `${start}-XXXX-${end.length > 4 ? end.slice(-4) : end}`;
  }
  return clean.slice(0, 4) + '-XXXX-' + clean.slice(-4);
}

/**
 * Retrieves safe, sanitized profile information for an authenticated driver.
 * Derives identity exclusively from userId.
 */
export async function getDriverProfile(userId) {
  if (!userId) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  // 1. Fetch user account details
  const user = await queryOne(
    'SELECT id, name, email, phone, role, area, status, created_at FROM users WHERE id = ?',
    [userId]
  );

  if (!user) {
    const err = new Error('Driver account record not found.');
    err.statusCode = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  if ((user.role || '').toLowerCase() !== 'driver') {
    const err = new Error('Access denied: You do not have an active driver profile.');
    err.statusCode = 403;
    err.code = 'NOT_A_DRIVER';
    throw err;
  }

  // 2. Fetch driver partner record
  const driver = await queryOne(`
    SELECT id, user_id, name, phone, license_number, hub_area, 
           experience_years, specialization, rating, trips_completed, 
           upi_id, status, created_at
    FROM drivers 
    WHERE user_id = ?
  `, [userId]);

  if (!driver) {
    const err = new Error('No driver partner profile linked to this account.');
    err.statusCode = 403;
    err.code = 'NOT_A_DRIVER';
    throw err;
  }

  // 3. Serialize safe data exclusively (NO password_hash, tokens, reset tokens, or internals)
  const safeProfile = {
    id: driver.id, // Public driver partner ID e.g. DRV-XXXX
    userId: user.id, // Account ID
    name: user.name || driver.name,
    email: user.email || '',
    phone: user.phone || driver.phone,
    area: user.area || driver.hub_area || 'Indiranagar',
    hubArea: driver.hub_area || user.area || 'Indiranagar',
    role: user.role,
    status: driver.status || user.status || 'Active',
    licenseNumber: driver.license_number,
    maskedLicenseNumber: maskLicenseNumber(driver.license_number),
    experienceYears: driver.experience_years ? String(driver.experience_years) : '5+ Years',
    specialization: driver.specialization || 'Manual & Automatic Cars',
    rating: Number(driver.rating) || 5.0,
    tripsCompleted: Number(driver.trips_completed) || 0,
    upiId: driver.upi_id || '',
    createdAt: user.created_at || driver.created_at
  };

  return safeProfile;
}

/**
 * Updates driver-editable profile fields safely.
 * Strictly prevents role, status, license, rating, or internal field modifications.
 */
export async function updateDriverProfile({ userId, updates = {}, ipAddress = null }) {
  if (!userId) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  // Verify current driver account
  const user = await queryOne('SELECT id, name, email, phone, role, area, status FROM users WHERE id = ?', [userId]);
  if (!user || (user.role || '').toLowerCase() !== 'driver') {
    const err = new Error('Access denied: Driver profile not found.');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const driver = await queryOne('SELECT id, user_id, name, phone, hub_area, upi_id FROM drivers WHERE user_id = ?', [userId]);
  if (!driver) {
    const err = new Error('Driver profile record not found.');
    err.statusCode = 404;
    err.code = 'DRIVER_NOT_FOUND';
    throw err;
  }

  // --- Validation ---
  const { name, phone, email, area, hubArea, upiId } = updates;

  // Name validation
  let targetName = user.name;
  if (name !== undefined) {
    const cleanName = sanitizeString(String(name));
    if (!cleanName || cleanName.length < 2) {
      const err = new Error('Full name must be at least 2 characters long.');
      err.statusCode = 400;
      err.code = 'INVALID_INPUT';
      throw err;
    }
    if (cleanName.length > 100) {
      const err = new Error('Full name must not exceed 100 characters.');
      err.statusCode = 400;
      err.code = 'INVALID_INPUT';
      throw err;
    }
    targetName = cleanName;
  }

  // Phone validation & uniqueness
  let targetPhone = user.phone;
  if (phone !== undefined) {
    const cleanPhone = String(phone).trim();
    if (!isValidIndianPhone(cleanPhone)) {
      const err = new Error('Please provide a valid 10-digit Indian mobile number.');
      err.statusCode = 400;
      err.code = 'INVALID_INPUT';
      throw err;
    }
    const formatted = formatIndianPhone(cleanPhone);
    const digitsOnly = cleanPhone.replace(/[^0-9]/g, '').slice(-10);

    // If changing phone, check uniqueness
    if (formatted !== user.phone) {
      const existingPhone = await queryOne(
        'SELECT id FROM users WHERE (phone = ? OR phone = ? OR REPLACE(REPLACE(REPLACE(phone, \' \', \'\'), \'-\', \'\'), \'+\', \'\') LIKE ?) AND id != ?',
        [cleanPhone, formatted, `%${digitsOnly}`, userId]
      );
      if (existingPhone) {
        const err = new Error('An account already exists with this phone number.');
        err.statusCode = 409;
        err.code = 'PHONE_ALREADY_EXISTS';
        throw err;
      }
    }
    targetPhone = formatted;
  }

  // Email validation & uniqueness
  let targetEmail = user.email;
  if (email !== undefined) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      const err = new Error('Please provide a valid email address.');
      err.statusCode = 400;
      err.code = 'INVALID_INPUT';
      throw err;
    }
    if (cleanEmail.length > 150) {
      const err = new Error('Email address must not exceed 150 characters.');
      err.statusCode = 400;
      err.code = 'INVALID_INPUT';
      throw err;
    }

    // If changing email, check uniqueness
    if (cleanEmail !== user.email) {
      const existingEmail = await queryOne(
        'SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?',
        [cleanEmail, userId]
      );
      if (existingEmail) {
        const err = new Error('An account already exists with this email address.');
        err.statusCode = 409;
        err.code = 'EMAIL_ALREADY_EXISTS';
        throw err;
      }
    }
    targetEmail = cleanEmail;
  }

  // Hub Area validation
  let targetArea = user.area;
  const areaCandidate = hubArea !== undefined ? hubArea : area;
  if (areaCandidate !== undefined) {
    const cleanArea = sanitizeString(String(areaCandidate));
    if (cleanArea && cleanArea.length <= 100) {
      targetArea = cleanArea;
    }
  }

  // UPI validation (optional)
  let targetUpi = driver.upi_id || null;
  if (upiId !== undefined) {
    const cleanUpi = sanitizeString(String(upiId || '')).trim();
    if (cleanUpi.length > 0) {
      if (!UPI_REGEX.test(cleanUpi)) {
        const err = new Error('Please provide a valid UPI ID (e.g. name@bank or phone@paytm).');
        err.statusCode = 400;
        err.code = 'INVALID_INPUT';
        throw err;
      }
      targetUpi = cleanUpi;
    } else {
      targetUpi = null;
    }
  }

  // --- Atomic Database Update ---
  await withTransaction(async (tx) => {
    // 1. Update users table
    await tx.execute(`
      UPDATE users 
      SET name = ?, phone = ?, email = ?, area = ? 
      WHERE id = ?
    `, [targetName, targetPhone, targetEmail, targetArea, userId]);

    // 2. Update drivers table
    await tx.execute(`
      UPDATE drivers 
      SET name = ?, phone = ?, hub_area = ?, upi_id = ? 
      WHERE user_id = ?
    `, [targetName, targetPhone, targetArea, targetUpi, userId]);

    // 3. Keep active assigned bookings in sync with updated driver name and phone
    try {
      await tx.execute(`
        UPDATE bookings
        SET assigned_driver_name = ?, assigned_driver_phone = ?
        WHERE assigned_driver_id = ? AND status IN ('ASSIGNED', 'ARRIVED', 'IN_PROGRESS')
      `, [targetName, targetPhone, driver.id]);
    } catch (e) {
      // In case bookings table schema is legacy, ignore non-fatal update
    }
  });

  // Audit logging
  await logAuditEvent({
    userId,
    action: 'DRIVER_PROFILE_UPDATED',
    resourceType: 'driver',
    resourceId: driver.id,
    details: {
      updatedFields: {
        name: targetName !== user.name,
        phone: targetPhone !== user.phone,
        email: targetEmail !== user.email,
        area: targetArea !== user.area,
        upiId: targetUpi !== driver.upi_id
      }
    },
    ipAddress
  });

  // Fetch fresh profile
  const freshProfile = await getDriverProfile(userId);

  // Issue refreshed JWT token to ensure continuous, synchronous authentication
  const refreshedUserPayload = {
    id: user.id,
    name: targetName,
    email: targetEmail,
    phone: targetPhone,
    role: 'driver',
    area: targetArea
  };
  const token = generateToken(refreshedUserPayload);

  return {
    profile: freshProfile,
    user: refreshedUserPayload,
    token
  };
}
