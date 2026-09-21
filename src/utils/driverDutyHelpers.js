/**
 * Pure business logic helpers for driver duty assignment and isolation
 */

/**
 * Checks if a booking is specifically assigned to the given driver partner
 */
export function isDutyAssignedToDriver(b, driverUser) {
  if (!driverUser || !b) return false;

  const currentPhone = (driverUser.phone || '').replace(/[^0-9]/g, '');
  const assignedPhone = (b.assignedDriverPhone || b.driverPhone || '').replace(/[^0-9]/g, '');

  // 1. Match by phone number (last 10 digits or exact match)
  if (currentPhone && assignedPhone) {
    if (currentPhone === assignedPhone || 
        (currentPhone.length >= 10 && assignedPhone.length >= 10 && currentPhone.slice(-10) === assignedPhone.slice(-10))) {
      return true;
    }
  }

  // 2. Match by driver ID
  if (driverUser.id && (b.assignedDriverId === driverUser.id || b.driverId === driverUser.id)) {
    return true;
  }

  // 3. Match by driver name (case-insensitive substring or exact match)
  const currentName = (driverUser.name || '').toLowerCase().trim();
  const assignedName = (b.assignedDriver || b.driverName || '').toLowerCase().trim();
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
  
  const assignedName = (b.assignedDriver || b.driverName || '').trim();
  const assignedPhone = (b.assignedDriverPhone || b.driverPhone || '').trim();

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
  return {
    id: b.id || b.bookingId || `DUTY-${Math.floor(1000 + Math.random() * 9000)}`,
    bookingId: b.id || b.bookingId,
    customerName: b.customerName || b.name || "Customer",
    customerPhone: b.customerPhone || b.phone || "+91 98450 00000",
    customerEmail: b.customerEmail || b.email || "",
    tripType: b.serviceType === 'driver' ? `${b.tripType || 'Driver'} Service` : 'Driver Duty',
    pickup: b.pickupArea || b.pickup || "Pickup Location",
    destination: b.dropLocation || b.drop || "Drop Location",
    scheduledTime: b.time ? `${b.date || 'Today'}, ${b.time}` : (b.bookingDate ? `${b.bookingDate}, ${b.bookingTime || ''}` : 'Scheduled'),
    carModel: b.vehicleCategory || b.carModel || 'Customer Vehicle',
    payout: `₹${b.fare || b.totalFare || b.estimatedPrice || 499}`,
    urgency: b.urgency || (b.status === 'Assigned' ? 'Admin Assigned' : 'Standard Booking'),
    distance: b.distance || 'City Route',
    status: b.status || 'Assigned',
    assignedDriver: b.assignedDriver,
    assignedDriverPhone: b.assignedDriverPhone,
    assignedDriverUpi: b.assignedDriverUpi
  };
}

/**
 * Reads local storage and partitions duties:
 * - myAssigned: Bookings assigned specifically to THIS driver
 * - openPool: Truly unclaimed, pending bookings waiting for assignment
 */
export function getDriverDuties(driverUser) {
  try {
    const savedBookings = typeof localStorage !== 'undefined' ? localStorage.getItem('bda_driver_bookings') : null;
    if (!savedBookings) return { myAssigned: [], openPool: [] };

    const parsed = JSON.parse(savedBookings);
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
