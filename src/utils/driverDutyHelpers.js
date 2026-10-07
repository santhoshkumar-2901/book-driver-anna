/**
 * Pure business logic helpers for driver duty assignment and isolation
 */

/**
 * Checks if a booking is specifically assigned to the given driver partner
 */
export function isDutyAssignedToDriver(b, driverUser) {
  if (!driverUser || !b) return false;

  const currentPhone = (driverUser.phone || '').replace(/[^0-9]/g, '');
  const assignedPhone = (b.assignedDriverPhone || b.assigned_driver_phone || b.driverPhone || '').replace(/[^0-9]/g, '');

  // 1. Match by phone number (last 10 digits or exact match)
  if (currentPhone && assignedPhone) {
    if (currentPhone === assignedPhone || 
        (currentPhone.length >= 10 && assignedPhone.length >= 10 && currentPhone.slice(-10) === assignedPhone.slice(-10))) {
      return true;
    }
  }

  // 2. Match by driver ID (supporting camelCase and backend snake_case assigned_driver_id)
  if (driverUser.id && (b.assignedDriverId === driverUser.id || b.assigned_driver_id === driverUser.id || b.driverId === driverUser.id)) {
    return true;
  }

  // 3. Match by driver name (case-insensitive substring or exact match)
  const currentName = (driverUser.name || '').toLowerCase().trim();
  const assignedName = (b.assignedDriver || b.assigned_driver_name || b.driverName || '').toLowerCase().trim();
  if (currentName && assignedName && (
    currentName === assignedName ||
    currentName.includes(assignedName) ||
    assignedName.includes(currentName)
  )) {
    return true;
  }

  // 4. Match by UPI ID
  const currentUpi = (driverUser.upiId || '').toLowerCase().trim();
  const assignedUpi = (b.assignedDriverUpi || b.driverUpi || '').toLowerCase().trim();
  if (currentUpi && assignedUpi && currentUpi === assignedUpi) {
    return true;
  }

  return false;
}

/**
 * Checks if a booking has been assigned by admin to a DIFFERENT driver partner
 */
export function isDutyAssignedToOtherDriver(b, driverUser) {
  if (!b) return false;
  
  const assignedName = (b.assignedDriver || b.assigned_driver_name || b.driverName || '').trim();
  const assignedPhone = (b.assignedDriverPhone || b.assigned_driver_phone || b.driverPhone || '').trim();

  const hasAssignment = 
    (assignedName && 
      assignedName !== 'Pending Admin Acceptance' && 
      !assignedName.includes('Pending') && 
      !assignedName.includes('Assigned on Dispatch') && 
      assignedName !== 'Driver Assigned') ||
    (assignedPhone && assignedPhone !== '+91 80 2555 0199');

  if (!hasAssignment) return false;
  return !isDutyAssignedToDriver(b, driverUser);
}

/**
 * Formats a raw booking into a clean driver duty card object
 */
export function formatDuty(b) {
  const rawStatus = (b.status || 'Assigned').toUpperCase();
  let normalizedStatus = 'Assigned';
  if (rawStatus.includes('PROGRESS')) {
    normalizedStatus = 'In Progress';
  } else if (rawStatus.includes('COMPLET')) {
    normalizedStatus = 'Completed';
  } else if (rawStatus.includes('CANCEL')) {
    normalizedStatus = 'Cancelled';
  } else if (rawStatus.includes('CONFIRM')) {
    normalizedStatus = 'Confirmed';
  } else if (rawStatus.includes('PEND')) {
    normalizedStatus = 'Pending';
  }

  return {
    id: b.id || b.bookingId || `DUTY-${Math.floor(1000 + Math.random() * 9000)}`,
    bookingId: b.id || b.bookingId,
    customerName: b.customerName || b.customer_name || b.name || "Customer",
    customerPhone: b.customerPhone || b.customer_phone || b.phone || "+91 98450 00000",
    customerEmail: b.customerEmail || b.customer_email || b.email || "",
    tripType: (b.booking_type === 'driver' || b.serviceType === 'driver') ? `${b.trip_type || b.tripType || 'Driver'} Service` : (b.service_name || b.tripTitle || 'Driver Duty'),
    pickup: b.pickup_location || b.pickupLocation || b.pickup_area || b.pickupArea || b.pickupAddress || b.address || b.streetAddress || b.pickup || "Pickup Location",
    destination: b.drop_location || b.dropLocation || b.drop || "Drop Location",
    scheduledTime: b.time ? `${b.date || 'Today'}, ${b.time}` : (b.bookingDate ? `${b.bookingDate}, ${b.bookingTime || ''}` : 'Scheduled'),
    carModel: b.vehicleCategory || b.carModel || 'Customer Vehicle',
    payout: `₹${b.calculated_fare || b.fare || b.totalFare || b.estimatedPrice || 499}`,
    urgency: b.urgency || ((rawStatus === 'ASSIGNED' || b.status === 'Assigned') ? 'Admin Assigned' : 'Standard Booking'),
    distance: b.distance || 'City Route',
    status: normalizedStatus,
    assignedDriver: b.assigned_driver_name || b.assignedDriver,
    assignedDriverPhone: b.assigned_driver_phone || b.assignedDriverPhone,
    assignedDriverUpi: b.assignedDriverUpi
  };
}

/**
 * Reads local storage or custom provided bookings and partitions duties:
 * - myAssigned: Bookings assigned specifically to THIS driver
 * - openPool: Truly unclaimed, pending bookings waiting for assignment
 */
export function getDriverDuties(driverUser, customBookings = null) {
  try {
    let parsed = customBookings;
    if (!parsed) {
      const savedBookings = typeof localStorage !== 'undefined' ? localStorage.getItem('bda_driver_bookings') : null;
      if (!savedBookings) return { myAssigned: [], openPool: [] };
      parsed = JSON.parse(savedBookings);
    }
    if (!Array.isArray(parsed)) return { myAssigned: [], openPool: [] };

    const currentDriver = driverUser || (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('bda_driver_user') || 'null') : null) || {};
    const myAssigned = [];
    const openPool = [];

    parsed.forEach(b => {
      const rawStatus = (b.status || 'Pending').toUpperCase();
      // Skip completed or cancelled duties in active lists
      if (rawStatus.includes('COMPLET') || rawStatus.includes('CANCEL')) {
        return;
      }

      const isMine = isDutyAssignedToDriver(b, currentDriver);

      if (isMine) {
        myAssigned.push(formatDuty(b));
      } else {
        const isOther = isDutyAssignedToOtherDriver(b, currentDriver);
        // Only unclaimed pending/confirmed bookings appear in open pool
        if (!isOther && (rawStatus === 'PENDING' || rawStatus === 'CONFIRMED')) {
          openPool.push(formatDuty(b));
        }
      }
    });

    return { myAssigned, openPool };
  } catch (e) {
    return { myAssigned: [], openPool: [] };
  }
}

/**
 * Normalizes any booking object (from raw SQL or camelCase localStorage)
 * into a standard driver booking card format for admin and driver views.
 */
export function normalizeDriverBooking(b) {
  if (!b) return b;
  const rawStatus = (b.status || 'Pending').toUpperCase();
  const formattedStatus = 
    rawStatus === 'ASSIGNED' ? 'Assigned' :
    rawStatus === 'CONFIRMED' ? 'Confirmed' :
    rawStatus === 'CANCELLED' ? 'Cancelled' :
    rawStatus === 'COMPLETED' ? 'Completed' : 'Pending';

  const cleanDriverName = (b.assigned_driver_name && b.assigned_driver_name !== 'Driver Assigned on Dispatch' && b.assigned_driver_name !== 'Driver Assigned' && b.assigned_driver_name !== 'Pending Admin Acceptance')
    ? b.assigned_driver_name
    : ((b.assignedDriver && b.assignedDriver !== 'Driver Assigned on Dispatch' && b.assignedDriver !== 'Driver Assigned' && b.assignedDriver !== 'Pending Admin Acceptance') ? b.assignedDriver : '');

  const cleanDriverPhone = (b.assigned_driver_phone && b.assigned_driver_phone !== '+91 80 2555 0199')
    ? b.assigned_driver_phone
    : ((b.assignedDriverPhone && b.assignedDriverPhone !== '+91 80 2555 0199') ? b.assignedDriverPhone : '');

  return {
    ...b,
    id: b.id || b.bookingId,
    customerName: b.customerName || b.customer_name || b.name || 'Customer',
    phone: b.phone || b.customer_phone || b.customerPhone || '',
    email: b.email || b.customer_email || b.customerEmail || '',
    tripType: b.tripType || b.trip_type || 'one-way',
    tripTitle: b.tripTitle || b.service_name || (b.tripType ? `${b.tripType} Driver` : 'Driver Service'),
    pickupArea: b.pickupLocation || b.pickup_location || b.pickupArea || b.pickup_area || b.pickupAddress || b.address || b.streetAddress || b.pickup || 'Pickup Location',
    dropLocation: b.dropLocation || b.drop_location || b.destination || 'Drop Location',
    date: b.date || b.bookingDate || '',
    time: b.time || b.bookingTime || '',
    fare: b.fare !== undefined ? b.fare : (b.calculated_fare !== undefined ? b.calculated_fare : (b.totalFare || 0)),
    paymentMode: b.paymentMode || b.payment_mode || 'cash',
    status: b.status ? (b.status.charAt(0).toUpperCase() + b.status.slice(1).toLowerCase()) : formattedStatus,
    assignedDriver: cleanDriverName,
    assignedDriverPhone: cleanDriverPhone
  };
}
