import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../services/apiClient.js';
import { onBookingUpdate } from './broadcastSync.js';
import { isDummyOrDemoUser } from './userValidation.js';

// Exclude static demo booking IDs from triggering badges for real users
const DEMO_BOOKING_IDS = new Set([
  'BDA-DRV-9801',
  'BDA-VEH-9802',
  'BDA-977047',
  'BDA-VEH-9DE337',
  'BDA-DRV-9802',
  'BDA-601936',
  'BDA-CLS-4820'
]);

/**
 * Checks whether a single booking record has an active Pending or Confirmed status
 * and has NOT yet been paid.
 *
 * @param {Object} booking - The booking object
 * @param {Set} paidSet - Set of booking IDs that have already been paid
 * @returns {boolean} - True if booking is pending or confirmed and unpaid
 */
export function isBookingPendingOrConfirmedUnpaid(booking, paidSet = new Set()) {
  if (!booking) return false;
  const bId = booking.id || booking.bookingId || booking.enrollmentId;
  if (!bId) return false;

  // If explicitly marked as demo, ignore
  if (booking.isDemo || DEMO_BOOKING_IDS.has(bId)) return false;

  // 1. If booking ID is in paid set or marked isPaid / payment completed, red dot must disappear
  const isPaid = Boolean(
    paidSet.has(bId) ||
    booking.isPaid ||
    booking.is_paid ||
    booking.paymentStatus === 'PAID' ||
    booking.payment_status === 'PAID' ||
    booking.paymentCompleted
  );
  if (isPaid) return false;

  const rawStatus = String(booking.status || '').toUpperCase().trim();

  // 2. Terminated or inactive statuses must NOT show red dot
  if (
    rawStatus === 'CANCELLED' ||
    rawStatus.includes('CANCEL') ||
    rawStatus === 'REJECTED' ||
    rawStatus.includes('REJECT') ||
    rawStatus === 'COMPLETED' ||
    rawStatus.includes('COMPLET')
  ) {
    return false;
  }

  // 3. Only show red dot when booking is pending or confirmed
  const isPending = (
    rawStatus === 'PENDING' ||
    rawStatus.includes('PENDING') ||
    rawStatus === '' // default unassigned
  );

  const isConfirmed = (
    rawStatus === 'CONFIRMED' ||
    rawStatus.includes('CONFIRM') ||
    rawStatus === 'ASSIGNED' ||
    rawStatus.includes('ASSIGN') ||
    rawStatus.includes('ACCEPT') ||
    rawStatus.includes('TRAIN') ||
    rawStatus.includes('PROGRESS')
  );

  return isPending || isConfirmed;
}

/**
 * Synchronously checks localStorage across driver bookings, vehicle bookings,
 * and driving class enrollments to see if the given clientUser has any
 * unpaid pending or confirmed bookings.
 *
 * @param {Object} clientUser - Active client user
 * @param {Set} [customPaidSet] - Optional set of paid booking IDs
 * @returns {boolean}
 */
export function checkUserHasPendingOrConfirmedBooking(clientUser, customPaidSet = null) {
  if (!clientUser || isDummyOrDemoUser(clientUser)) return false;

  try {
    const paidSet = customPaidSet || new Set(JSON.parse(localStorage.getItem('bda_paid_bookings') || '[]'));
    const userPhoneClean = (clientUser.phone || '').replace(/[^0-9]/g, '');
    const userEmailClean = (clientUser.email || '').toLowerCase().trim();
    const currentUserId = clientUser.id ? String(clientUser.id).trim() : null;

    const isOwner = (b) => {
      const bUserId = b.userId ? String(b.userId).trim() : null;
      const bEmail = (b.customerEmail || b.email || '').toLowerCase().trim();
      const bPhone = (b.customerPhone || b.mobileNumber || b.phone || '').replace(/[^0-9]/g, '');

      return Boolean(
        (currentUserId && bUserId && bUserId === currentUserId) ||
        (userEmailClean && bEmail && bEmail === userEmailClean) ||
        (userPhoneClean && bPhone && (
          userPhoneClean === bPhone ||
          (userPhoneClean.length >= 10 && bPhone.length >= 10 && userPhoneClean.slice(-10) === bPhone.slice(-10))
        ))
      );
    };

    // Check 1: Driver Bookings
    const driverBookings = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
    for (const b of driverBookings) {
      if (isOwner(b) && isBookingPendingOrConfirmedUnpaid(b, paidSet)) {
        return true;
      }
    }

    // Check 2: Vehicle Bookings
    const vehicleBookings = JSON.parse(localStorage.getItem('bda_vehicle_bookings') || '[]');
    for (const b of vehicleBookings) {
      if (isOwner(b) && isBookingPendingOrConfirmedUnpaid(b, paidSet)) {
        return true;
      }
    }

    // Check 3: Driving Academy Enrollments
    const classEnrollments = JSON.parse(localStorage.getItem('bda_class_enrollments') || '[]');
    for (const b of classEnrollments) {
      if (isOwner(b) && isBookingPendingOrConfirmedUnpaid(b, paidSet)) {
        return true;
      }
    }
  } catch (e) {
    // Local storage parse fallback
  }

  return false;
}

/**
 * Custom React hook that monitors active bookings for clientUser and returns
 * true if any pending or confirmed booking is unpaid, and false once paid.
 *
 * @param {Object|null} clientUser - Currently logged in user
 * @returns {boolean} hasActiveBookingBadge
 */
export function useUserBookingBadge(clientUser) {
  const [hasActiveBadge, setHasActiveBadge] = useState(() => {
    return checkUserHasPendingOrConfirmedBooking(clientUser);
  });
  const lastBackendFetchRef = useRef(0);
  const isEvaluatingRef = useRef(false);

  const evaluateBadge = useCallback(async ({ force = false } = {}) => {
    if (!clientUser || isDummyOrDemoUser(clientUser)) {
      setHasActiveBadge(false);
      return;
    }

    // 1. Immediate synchronous evaluation from localStorage
    let paidSet = new Set();
    try {
      paidSet = new Set(JSON.parse(localStorage.getItem('bda_paid_bookings') || '[]'));
    } catch (e) {}

    const localHasActive = checkUserHasPendingOrConfirmedBooking(clientUser, paidSet);
    if (localHasActive) {
      setHasActiveBadge(true);
      return;
    }

    // Guard against concurrent in-flight requests
    if (isEvaluatingRef.current) return;

    // 2. Query authoritative backend /api/bookings/my if local check was negative
    // Throttled to avoid flooding the backend with repetitive GET requests
    const now = Date.now();
    if (!force && (now - lastBackendFetchRef.current < 20000)) {
      return;
    }

    try {
      isEvaluatingRef.current = true;
      lastBackendFetchRef.current = now;
      const res = await apiClient.getMyBookings();
      if (res && res.data && Array.isArray(res.data.bookings)) {
        const hasServerActive = res.data.bookings.some(b => isBookingPendingOrConfirmedUnpaid(b, paidSet));
        setHasActiveBadge(hasServerActive);
        return;
      }
    } catch (err) {
      // Backend lookup fallback
    } finally {
      isEvaluatingRef.current = false;
    }

    setHasActiveBadge(false);
  }, [clientUser]);

  useEffect(() => {
    evaluateBadge({ force: true });

    // Re-evaluate on real-time broadcast events
    const unsubscribeSync = onBookingUpdate(() => {
      evaluateBadge({ force: true });
    });

    const handleCustomEvent = () => evaluateBadge({ force: true });
    window.addEventListener('bda_booking_updated', handleCustomEvent);
    window.addEventListener('bda_order_created', handleCustomEvent);
    window.addEventListener('bda_ride_completed', handleCustomEvent);
    window.addEventListener('bda_payment_completed', handleCustomEvent);
    window.addEventListener('storage', handleCustomEvent);

    // Periodic heartbeat to stay in sync (30s interval instead of 3.5s)
    const interval = setInterval(() => evaluateBadge({ force: false }), 30000);

    return () => {
      unsubscribeSync();
      window.removeEventListener('bda_booking_updated', handleCustomEvent);
      window.removeEventListener('bda_order_created', handleCustomEvent);
      window.removeEventListener('bda_ride_completed', handleCustomEvent);
      window.removeEventListener('bda_payment_completed', handleCustomEvent);
      window.removeEventListener('storage', handleCustomEvent);
      clearInterval(interval);
    };
  }, [evaluateBadge]);

  return hasActiveBadge;
}
