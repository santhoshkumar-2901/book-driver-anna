import { queryAll } from '../db/database.js';

/**
 * Normalize an Indian phone number to 10 canonical digits.
 * Handles '+91', '91', leading '0', spaces, dashes, etc.
 * Returns null if the number cannot be reliably normalized to a 10-digit mobile number.
 */
export function normalizeIndianPhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return null;
  const digits = rawPhone.replace(/\D/g, '');

  if (digits.length === 10) {
    return digits;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length > 10) {
    const last10 = digits.slice(-10);
    return last10;
  }
  return null;
}

/**
 * Format 10-digit phone number as standard Indian format
 */
export function formatIndianPhone(rawPhone, normalizedPhone) {
  if (rawPhone && typeof rawPhone === 'string' && rawPhone.trim()) {
    return rawPhone.trim();
  }
  if (normalizedPhone && normalizedPhone.length === 10) {
    return `+91 ${normalizedPhone}`;
  }
  return rawPhone || '';
}

/**
 * Retrieve unified list of customers combining:
 * 1. Existing registered customers from `users` table (`role = 'customer'`)
 * 2. Guest customers from `bookings` table
 *
 * Rules:
 * - Group by normalized 10-digit phone number where available.
 * - Never merge customers solely based on identical names.
 * - For records without a valid phone number, use safe isolated fallback IDs (e.g. per booking ID).
 * - If a booking's phone or user_id matches a registered customer, aggregate under that registered account.
 * - Calculate accurate non-duplicated booking counts and most recent booking timestamp.
 * - Return id, name, phone, email, area, status, bookingCount, lastBookingDate, createdAt, source.
 */
export async function getUnifiedAdminCustomers() {
  const [registeredUsers, allBookings] = await Promise.all([
    queryAll(`
      SELECT id, name, email, phone, role, area, status, created_at
      FROM users
      WHERE role = 'customer'
      ORDER BY created_at DESC
    `),
    queryAll(`
      SELECT id, user_id, customer_name, customer_phone, customer_email, pickup_area, booking_type, status, created_at, date
      FROM bookings
      ORDER BY created_at DESC
    `)
  ]);

  const customerMap = new Map(); // key -> customerRecord
  const phoneToKey = new Map();  // normalizedPhone -> key
  const userIdToKey = new Map(); // user_id -> key

  // 1. Populate registered customers first to ensure registered IDs take precedence
  for (const user of registeredUsers) {
    const key = `USER-${user.id}`;
    const normPhone = normalizeIndianPhone(user.phone);

    if (normPhone) {
      phoneToKey.set(normPhone, key);
    }
    userIdToKey.set(user.id, key);

    customerMap.set(key, {
      id: user.id,
      name: user.name || 'Customer',
      phone: formatIndianPhone(user.phone, normPhone),
      rawPhone: user.phone || '',
      normalizedPhone: normPhone,
      email: user.email || '',
      area: user.area || 'Bangalore Central',
      status: user.status || 'Active',
      bookingCount: 0,
      lastBookingDate: null,
      createdAt: user.created_at || new Date().toISOString(),
      source: 'registered',
      _seenBookingIds: new Set()
    });
  }

  // 2. Aggregate bookings (guest + registered)
  for (const b of allBookings) {
    let targetKey = null;

    // A. Check if booking is explicitly linked to a registered user
    if (b.user_id && userIdToKey.has(b.user_id)) {
      targetKey = userIdToKey.get(b.user_id);
    }

    // B. Check if booking phone matches an existing customer (registered or already seen guest)
    const normPhone = normalizeIndianPhone(b.customer_phone);
    if (!targetKey && normPhone) {
      if (phoneToKey.has(normPhone)) {
        targetKey = phoneToKey.get(normPhone);
      } else {
        // New guest customer identified by valid mobile number
        targetKey = `GST-${normPhone}`;
        phoneToKey.set(normPhone, targetKey);

        customerMap.set(targetKey, {
          id: targetKey,
          name: b.customer_name || 'Guest Customer',
          phone: formatIndianPhone(b.customer_phone, normPhone),
          rawPhone: b.customer_phone || '',
          normalizedPhone: normPhone,
          email: b.customer_email || '',
          area: b.pickup_area || 'Bangalore Central',
          status: 'Active',
          bookingCount: 0,
          lastBookingDate: null,
          createdAt: b.created_at || new Date().toISOString(),
          source: 'guest',
          _seenBookingIds: new Set()
        });
      }
    }

    // C. Fallback for bookings without a valid phone number and without user_id
    if (!targetKey) {
      // Isolate each unverified booking to its own distinct record to prevent accidental merging
      targetKey = `GST-BKG-${b.id}`;
      customerMap.set(targetKey, {
        id: targetKey,
        name: b.customer_name || 'Guest Customer',
        phone: b.customer_phone || '',
        rawPhone: b.customer_phone || '',
        normalizedPhone: null,
        email: b.customer_email || '',
        area: b.pickup_area || 'Bangalore Central',
        status: 'Active',
        bookingCount: 0,
        lastBookingDate: null,
        createdAt: b.created_at || new Date().toISOString(),
        source: 'guest',
        _seenBookingIds: new Set()
      });
    }

    // D. Update customer activity and record details
    const cust = customerMap.get(targetKey);
    if (cust) {
      // Ensure each booking is counted exactly once
      if (!cust._seenBookingIds.has(b.id)) {
        cust._seenBookingIds.add(b.id);
        cust.bookingCount += 1;

        // Update last booking date
        const bookingTimestamp = b.created_at || b.date;
        if (bookingTimestamp) {
          if (!cust.lastBookingDate) {
            cust.lastBookingDate = bookingTimestamp;
          } else {
            const currentLast = new Date(cust.lastBookingDate).getTime();
            const thisDate = new Date(bookingTimestamp).getTime();
            if (!isNaN(thisDate) && (isNaN(currentLast) || thisDate > currentLast)) {
              cust.lastBookingDate = bookingTimestamp;
            }
          }
        }

        // For guest customers, update name/email/area from booking records if not yet set
        if (cust.source === 'guest') {
          if ((!cust.name || cust.name === 'Guest Customer') && b.customer_name) {
            cust.name = b.customer_name;
          }
          if (!cust.email && b.customer_email) {
            cust.email = b.customer_email;
          }
          if ((!cust.area || cust.area === 'Bangalore Central') && b.pickup_area) {
            cust.area = b.pickup_area;
          }
        } else {
          // For registered customers with missing email or area, fill from booking if available
          if (!cust.email && b.customer_email) {
            cust.email = b.customer_email;
          }
          if ((!cust.area || cust.area === 'Bangalore Central') && b.pickup_area) {
            cust.area = b.pickup_area;
          }
        }
      }
    }
  }

  // 3. Clean up internal tracking data and build clean response array
  const customers = Array.from(customerMap.values()).map(c => {
    const { _seenBookingIds, rawPhone, normalizedPhone, ...cleanRecord } = c;
    return cleanRecord;
  });

  // Sort: most recent booking activity or recent registration first
  customers.sort((a, b) => {
    const timeA = new Date(a.lastBookingDate || a.createdAt).getTime() || 0;
    const timeB = new Date(b.lastBookingDate || b.createdAt).getTime() || 0;
    return timeB - timeA;
  });

  return customers;
}
