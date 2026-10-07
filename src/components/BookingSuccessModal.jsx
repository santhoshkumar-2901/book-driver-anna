import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Phone, MapPin, Calendar, Clock, Car, Copy, Check, ShieldCheck, Sparkles, X, Users, Snowflake, Sun, Star, Smartphone, PartyPopper, Briefcase, GraduationCap, Ban, AlertCircle, CreditCard, ArrowRight, Loader2 } from 'lucide-react';
import { SteeringWheel } from './Icons';
import { toDDMMYYYY } from '../utils/dateUtils';
import { useScrollLock } from '../utils/useScrollLock';
import { onBookingUpdate } from '../utils/broadcastSync';
import { SUPPORT_HELPLINE } from '../data/mockData';
import { MapView, DEFAULT_MAP_CENTER, PickupMarker, DestinationMarker, DriverLocationMarker, RoutePolyline } from './map';
import { useDriverRealtimeLocation } from '../utils/useDriverRealtimeLocation';
import { apiClient } from '../services/apiClient';

function getHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const STATUS_LIFECYCLE_RANK = {
  'PENDING': 1,
  'CONFIRMED': 2,
  'ASSIGNED': 3,
  'ARRIVED': 4,
  'IN_PROGRESS': 5,
  'COMPLETED': 6,
  'CANCELLED': 6
};

export default function BookingSuccessModal({ booking, onClose, onSimulateRidePayment }) {
  useScrollLock(Boolean(booking));

  const sanitizeDriverName = (name) => {
    if (!name || typeof name !== 'string') return null;
    const trimmed = name.trim();
    if (
      trimmed === 'Pending Admin Acceptance' ||
      trimmed.toLowerCase().includes('pending') ||
      trimmed === 'Driver Assigned' ||
      trimmed.includes('Assigned on Dispatch')
    ) {
      return null;
    }
    return trimmed;
  };

  const [copied, setCopied] = useState(false);
  const [isCancelled, setIsCancelled] = useState(() => {
    const raw = String(booking?.status || '').toUpperCase();
    return raw === 'CANCELLED' || raw.includes('CANCEL');
  });
  const [currentStatus, setCurrentStatus] = useState(booking?.status || 'Pending');
  const [isPaid, setIsPaid] = useState(() => {
    try {
      const bId = booking?.bookingId || booking?.id;
      const paid = new Set(JSON.parse(localStorage.getItem('bda_paid_bookings') || '[]'));
      return Boolean(booking?.isPaid || String(booking?.status || '').toUpperCase() === 'COMPLETED' || (bId && paid.has(bId)));
    } catch (e) {
      return false;
    }
  });
  const [assignedDriverId, setAssignedDriverId] = useState(() => {
    return booking?.assigned_driver_id || booking?.assignedDriverId || null;
  });
  const [assignedDriver, setAssignedDriver] = useState(() => {
    return sanitizeDriverName(booking?.assigned_driver_name || booking?.assignedAnna || booking?.assignedDriver);
  });
  const [assignedDriverPhone, setAssignedDriverPhone] = useState(
    booking?.assigned_driver_phone || booking?.assignedDriverPhone || booking?.driverPhone || null
  );
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('Change of travel plans');
  const lastStatusMetaRef = useRef({ timestamp: 0, status: null });

  // Synchronize state when booking prop changes (cross-booking isolation)
  useEffect(() => {
    if (booking) {
      const rawStatus = booking.status || 'Pending';
      const isCanc = String(rawStatus).toUpperCase() === 'CANCELLED' || String(rawStatus).toLowerCase().includes('cancel');
      setIsCancelled(isCanc);
      setCurrentStatus(rawStatus);
      lastStatusMetaRef.current = {
        timestamp: Date.now(),
        status: String(rawStatus).toUpperCase()
      };
      const bId = booking.bookingId || booking.id;
      try {
        const paid = new Set(JSON.parse(localStorage.getItem('bda_paid_bookings') || '[]'));
        setIsPaid(Boolean(booking.isPaid || String(rawStatus).toUpperCase() === 'COMPLETED' || (bId && paid.has(bId))));
      } catch (e) {
        setIsPaid(Boolean(booking.isPaid || String(rawStatus).toUpperCase() === 'COMPLETED'));
      }
      const dId = booking.assigned_driver_id || booking.assignedDriverId || null;
      setAssignedDriverId(dId);
      setAssignedDriver(sanitizeDriverName(booking.assigned_driver_name || booking.assignedAnna || booking.assignedDriver));
      setAssignedDriverPhone(booking.assigned_driver_phone || booking.assignedDriverPhone || booking.driverPhone || null);
    }
  }, [booking?.id, booking?.bookingId, booking?.status]);

  // Realtime Driver Tracking (Phase 11 & 12)
  const bookingId = booking?.bookingId || booking?.id;
  const token = typeof localStorage !== 'undefined'
    ? (localStorage.getItem('bda_client_token') || localStorage.getItem('bda_jwt_token'))
    : null;

  // Trip status evaluations (Phases 14, 15 & 16)
  const isDriverArrived = String(currentStatus || '').toUpperCase() === 'ARRIVED';
  const isActiveTrip = String(currentStatus || '').toUpperCase() === 'IN_PROGRESS';
  const isTerminalState = isCancelled ||
    String(currentStatus || '').toUpperCase() === 'COMPLETED' ||
    String(currentStatus || '').toUpperCase() === 'CANCELLED';

  const hasAssignedDriver = Boolean(
    (assignedDriverId || assignedDriver) &&
    !isCancelled &&
    !currentStatus.toLowerCase().includes('cancel')
  );

  const {
    location: driverLiveLocation,
    connectionStatus,
    freshness,
    error: realtimeError,
    isConnected,
    reconnect: reconnectRealtime
  } = useDriverRealtimeLocation({
    bookingId,
    driverId: assignedDriverId,
    token,
    enabled: Boolean(hasAssignedDriver && !isTerminalState && bookingId && token)
  });

  const [mapCenter, setMapCenter] = useState(() => {
    if (booking?.pickup_latitude && booking?.pickup_longitude) {
      return [booking.pickup_latitude, booking.pickup_longitude];
    }
    if (booking?.pickupLatitude && booking?.pickupLongitude) {
      return [booking.pickupLatitude, booking.pickupLongitude];
    }
    return DEFAULT_MAP_CENTER;
  });
  const hasInitializedCenterRef = useRef(false);

  useEffect(() => {
    // Only adjust initial view once when initial location is received if no pickup coordinates exist
    if (!hasInitializedCenterRef.current && driverLiveLocation?.latitude && driverLiveLocation?.longitude) {
      hasInitializedCenterRef.current = true;
      if (!booking?.pickup_latitude && !booking?.pickupLatitude) {
        setMapCenter([driverLiveLocation.latitude, driverLiveLocation.longitude]);
      }
    }
  }, [driverLiveLocation, booking]);

  // Phase 13 & 14 — Driver-to-Customer & Active Trip Route State
  const [driverRoute, setDriverRoute] = useState(null);
  const [driverRouteType, setDriverRouteType] = useState(null); // 'to-pickup' | 'active-trip'
  const [driverRouteLoading, setDriverRouteLoading] = useState(false);
  const [driverRouteError, setDriverRouteError] = useState(null);

  const previousBookingIdRef = useRef(booking?.bookingId || booking?.id);
  const routeAbortControllerRef = useRef(null);
  const routeRequestIdRef = useRef(0);
  const routeDebounceTimerRef = useRef(null);
  const lastRouteCoordsRef = useRef(null);
  const previousDriverIdRef = useRef(assignedDriverId);
  const previousStatusRef = useRef(currentStatus);

  // Authoritative pickup coordinate validation
  const rawPickupLat = booking?.pickup_latitude ?? booking?.pickupLatitude;
  const rawPickupLng = booking?.pickup_longitude ?? booking?.pickupLongitude;
  const pickupLat = (rawPickupLat !== null && rawPickupLat !== undefined && rawPickupLat !== '') ? parseFloat(rawPickupLat) : NaN;
  const pickupLng = (rawPickupLng !== null && rawPickupLng !== undefined && rawPickupLng !== '') ? parseFloat(rawPickupLng) : NaN;
  const hasValidPickupCoords = !isNaN(pickupLat) && !isNaN(pickupLng) && isFinite(pickupLat) && isFinite(pickupLng) && pickupLat >= -90 && pickupLat <= 90 && pickupLng >= -180 && pickupLng <= 180;

  // Authoritative destination coordinate validation (Phase 14)
  const rawDestLat = booking?.destination_latitude ?? booking?.destinationLatitude ?? booking?.dropLatitude ?? booking?.dropLat;
  const rawDestLng = booking?.destination_longitude ?? booking?.destinationLongitude ?? booking?.dropLongitude ?? booking?.dropLng;
  const destLat = (rawDestLat !== null && rawDestLat !== undefined && rawDestLat !== '') ? parseFloat(rawDestLat) : NaN;
  const destLng = (rawDestLng !== null && rawDestLng !== undefined && rawDestLng !== '') ? parseFloat(rawDestLng) : NaN;
  const hasValidDestCoords = !isNaN(destLat) && !isNaN(destLng) && isFinite(destLat) && isFinite(destLng) && destLat >= -90 && destLat <= 90 && destLng >= -180 && destLng <= 180;

  const previousDestRef = useRef({ lat: destLat, lng: destLng });

  // Realtime driver coordinate validation
  const driverLat = driverLiveLocation?.latitude;
  const driverLng = driverLiveLocation?.longitude;
  const hasValidDriverCoords = typeof driverLat === 'number' && typeof driverLng === 'number' && isFinite(driverLat) && isFinite(driverLng) && driverLat >= -90 && driverLat <= 90 && driverLng >= -180 && driverLng <= 180;

  // Booking status transition protection (Section 8)
  useEffect(() => {
    if (currentStatus !== previousStatusRef.current) {
      if (routeAbortControllerRef.current) {
        routeAbortControllerRef.current.abort();
        routeAbortControllerRef.current = null;
      }
      if (routeDebounceTimerRef.current) {
        clearTimeout(routeDebounceTimerRef.current);
        routeDebounceTimerRef.current = null;
      }
      routeRequestIdRef.current++;
      lastRouteCoordsRef.current = null;
      setDriverRoute(null);
      setDriverRouteType(null);
      setDriverRouteLoading(false);
      setDriverRouteError(null);
      previousStatusRef.current = currentStatus;
    }
  }, [currentStatus]);

  // Destination change protection (Section 10)
  useEffect(() => {
    if (
      destLat !== previousDestRef.current.lat ||
      destLng !== previousDestRef.current.lng
    ) {
      if (isActiveTrip) {
        if (routeAbortControllerRef.current) {
          routeAbortControllerRef.current.abort();
          routeAbortControllerRef.current = null;
        }
        if (routeDebounceTimerRef.current) {
          clearTimeout(routeDebounceTimerRef.current);
          routeDebounceTimerRef.current = null;
        }
        routeRequestIdRef.current++;
        lastRouteCoordsRef.current = null;
        setDriverRoute(null);
        setDriverRouteType(null);
        setDriverRouteLoading(false);
        setDriverRouteError(null);
      }
      previousDestRef.current = { lat: destLat, lng: destLng };
    }
  }, [destLat, destLng, isActiveTrip]);

  // Driver reassignment / unassignment protection (Section 9)
  useEffect(() => {
    if (assignedDriverId !== previousDriverIdRef.current) {
      if (routeAbortControllerRef.current) {
        routeAbortControllerRef.current.abort();
        routeAbortControllerRef.current = null;
      }
      if (routeDebounceTimerRef.current) {
        clearTimeout(routeDebounceTimerRef.current);
        routeDebounceTimerRef.current = null;
      }
      routeRequestIdRef.current++;
      lastRouteCoordsRef.current = null;
      setDriverRoute(null);
      setDriverRouteType(null);
      setDriverRouteLoading(false);
      setDriverRouteError(null);
      previousDriverIdRef.current = assignedDriverId;
    }
  }, [assignedDriverId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (routeAbortControllerRef.current) {
        routeAbortControllerRef.current.abort();
      }
      if (routeDebounceTimerRef.current) {
        clearTimeout(routeDebounceTimerRef.current);
      }
    };
  }, []);

  // Route calculation and debouncing effect (Phases 13, 14 & 15)
  useEffect(() => {
    // Arrival State (Phase 15): When driver has arrived, stop approach route and clear driver route
    if (isDriverArrived) {
      if (routeAbortControllerRef.current) {
        routeAbortControllerRef.current.abort();
        routeAbortControllerRef.current = null;
      }
      if (routeDebounceTimerRef.current) {
        clearTimeout(routeDebounceTimerRef.current);
        routeDebounceTimerRef.current = null;
      }
      setDriverRoute(null);
      setDriverRouteType(null);
      setDriverRouteLoading(false);
      lastRouteCoordsRef.current = null;
      return;
    }

    const hasRequiredCoords = isActiveTrip ? hasValidDestCoords : hasValidPickupCoords;
    if (!hasAssignedDriver || !hasValidPickupCoords || !hasValidDriverCoords || isCancelled) {
      if (!isActiveTrip) {
        if (routeAbortControllerRef.current) {
          routeAbortControllerRef.current.abort();
          routeAbortControllerRef.current = null;
        }
        if (routeDebounceTimerRef.current) {
          clearTimeout(routeDebounceTimerRef.current);
          routeDebounceTimerRef.current = null;
        }
        setDriverRoute(null);
        setDriverRouteType(null);
        setDriverRouteLoading(false);
        lastRouteCoordsRef.current = null;
        return;
      }
    }

    if (!hasAssignedDriver || !hasRequiredCoords || !hasValidDriverCoords || isTerminalState) {
      if (routeAbortControllerRef.current) {
        routeAbortControllerRef.current.abort();
        routeAbortControllerRef.current = null;
      }
      if (routeDebounceTimerRef.current) {
        clearTimeout(routeDebounceTimerRef.current);
        routeDebounceTimerRef.current = null;
      }
      setDriverRoute(null);
      setDriverRouteType(null);
      setDriverRouteLoading(false);
      lastRouteCoordsRef.current = null;
      return;
    }

    const targetLat = isActiveTrip ? destLat : pickupLat;
    const targetLng = isActiveTrip ? destLng : pickupLng;
    const currentRouteType = isActiveTrip ? 'active-trip' : 'to-pickup';

    // Minimum movement threshold: skip recalculation if driver has moved less than 15 meters
    if (lastRouteCoordsRef.current) {
      const movedMeters = getHaversineDistanceMeters(
        lastRouteCoordsRef.current.lat,
        lastRouteCoordsRef.current.lng,
        driverLat,
        driverLng
      );
      if (movedMeters < 15) {
        return;
      }
    }

    // Clear any previous debounce timer
    if (routeDebounceTimerRef.current) {
      clearTimeout(routeDebounceTimerRef.current);
    }

    // Initial route calculation uses short 50ms delay, subsequent updates debounce at 1000ms
    const debounceDelay = lastRouteCoordsRef.current ? 1000 : 50;

    routeDebounceTimerRef.current = setTimeout(async () => {
      if (routeAbortControllerRef.current) {
        routeAbortControllerRef.current.abort();
      }

      const controller = new AbortController();
      routeAbortControllerRef.current = controller;
      const currentRequestId = ++routeRequestIdRef.current;

      setDriverRouteLoading(true);
      setDriverRouteError(null);

      try {
        const routeParams = isActiveTrip ? {
          pickupLat: driverLat,
          pickupLng: driverLng,
          destLat: destLat,
          destLng: destLng
        } : {
          pickupLat: driverLat,
          pickupLng: driverLng,
          destLat: pickupLat,
          destLng: pickupLng
        };

        const res = await apiClient.getLocationRoute(routeParams, { signal: controller.signal });

        if (currentRequestId !== routeRequestIdRef.current || isTerminalState) {
          return;
        }

        if (res?.success && res?.data?.geometry) {
          setDriverRoute(res.data);
          setDriverRouteType(currentRouteType);
          setDriverRouteError(null);
          lastRouteCoordsRef.current = { lat: driverLat, lng: driverLng };
        } else {
          setDriverRouteError('Route temporarily unavailable');
        }
      } catch (err) {
        if (err.name === 'AbortError' || controller.signal.aborted) {
          return;
        }
        if (isTerminalState) {
          return;
        }
        if (currentRequestId !== routeRequestIdRef.current) {
          return;
        }
        console.warn('[DriverRoute] Failed to fetch driver route:', err.message);
        setDriverRouteError('Route temporarily unavailable');
      } finally {
        if (currentRequestId === routeRequestIdRef.current && !isTerminalState) {
          setDriverRouteLoading(false);
        }
      }
    }, debounceDelay);

    return () => {
      if (routeDebounceTimerRef.current) {
        clearTimeout(routeDebounceTimerRef.current);
      }
    };
  }, [
    hasAssignedDriver,
    isTerminalState,
    isActiveTrip,
    hasValidDriverCoords,
    hasValidPickupCoords,
    hasValidDestCoords,
    driverLat,
    driverLng,
    pickupLat,
    pickupLng,
    destLat,
    destLng,
    isCancelled
  ]);

  useEffect(() => {
    if (booking) {
      const bId = booking.bookingId || booking.id;

      // Phase 16: Cross-booking isolation
      // If booking identity changes, immediately abort, reset timers, bump request ID, and clear routes
      if (bId !== previousBookingIdRef.current) {
        if (routeAbortControllerRef.current) {
          routeAbortControllerRef.current.abort();
          routeAbortControllerRef.current = null;
        }
        if (routeDebounceTimerRef.current) {
          clearTimeout(routeDebounceTimerRef.current);
          routeDebounceTimerRef.current = null;
        }
        routeRequestIdRef.current++;
        lastRouteCoordsRef.current = null;
        setDriverRoute(null);
        setDriverRouteType(null);
        setDriverRouteLoading(false);
        setDriverRouteError(null);
        hasInitializedCenterRef.current = false;
        previousBookingIdRef.current = bId;
      }

      let initialStatus = booking.status || 'Pending';
      let initialDriverId = booking.assigned_driver_id || booking.assignedDriverId || null;
      let initialDriver = sanitizeDriverName(booking.assigned_driver_name || booking.assignedAnna || booking.assignedDriver);
      let initialPhone = booking.assigned_driver_phone || booking.assignedDriverPhone || booking.driverPhone || null;

      try {
        const drivers = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
        const match = drivers.find(d => d.id === bId);
        if (match) {
          if (match.status) initialStatus = match.status;
          if (match.assigned_driver_id || match.assignedDriverId) {
            initialDriverId = match.assigned_driver_id || match.assignedDriverId;
          }
          const matchedDriver = sanitizeDriverName(match.assigned_driver_name || match.assignedDriver);
          if (matchedDriver) initialDriver = matchedDriver;
          if (match.assigned_driver_phone || match.assignedDriverPhone) {
            initialPhone = match.assigned_driver_phone || match.assignedDriverPhone;
          }
        }
      } catch (e) {}

      try {
        const paid = new Set(JSON.parse(localStorage.getItem('bda_paid_bookings') || '[]'));
        setIsPaid(Boolean(booking.isPaid || initialStatus === 'Completed' || (bId && paid.has(bId))));
      } catch (e) {}

      setIsCancelled(initialStatus === 'Cancelled');
      setCurrentStatus(initialStatus);
      setAssignedDriverId(initialDriverId);
      setAssignedDriver(initialDriver);
      setAssignedDriverPhone(initialPhone);
      setShowCancelConfirm(false);
    }
  }, [booking]);

  useEffect(() => {
    if (!booking) return;
    const bId = booking.bookingId || booking.id;
    const unsub = onBookingUpdate((detail) => {
      if (!detail || detail.bookingId !== bId) return;

      const eventTime = detail.timestamp ? new Date(detail.timestamp).getTime() : Date.now();
      const newStatusUpper = detail.status ? String(detail.status).toUpperCase() : null;

      if (newStatusUpper) {
        // Stale timestamp protection: ignore events with timestamps older than last processed status
        if (lastStatusMetaRef.current.timestamp && eventTime < lastStatusMetaRef.current.timestamp) {
          return;
        }

        // State machine ordering protection: prevent rolling backwards (e.g. IN_PROGRESS -> ARRIVED or ASSIGNED)
        // Exception: admin explicitly unassigned driver (newStatus is CONFIRMED with assignedDriverId === null)
        const currentUpper = String(currentStatus || '').toUpperCase();
        if (
          STATUS_LIFECYCLE_RANK[newStatusUpper] &&
          STATUS_LIFECYCLE_RANK[currentUpper] &&
          STATUS_LIFECYCLE_RANK[newStatusUpper] < STATUS_LIFECYCLE_RANK[currentUpper]
        ) {
          const isExplicitUnassignment = (newStatusUpper === 'CONFIRMED' && (detail.assignedDriverId === null || detail.assigned_driver_id === null));
          if (!isExplicitUnassignment) {
            return; // Discard stale backward status event
          }
        }

        lastStatusMetaRef.current = {
          timestamp: Math.max(lastStatusMetaRef.current.timestamp, eventTime),
          status: newStatusUpper
        };

        setCurrentStatus(detail.status);
        if (detail.status.toLowerCase().includes('cancel')) {
          setIsCancelled(true);
        }
        if (detail.status === 'Completed' || detail.isPaid) {
          setIsPaid(true);
        }
      }
      if (detail.isPaid) {
        setIsPaid(true);
      }
      if (detail.assignedDriverId !== undefined) {
        setAssignedDriverId(detail.assignedDriverId);
      } else if (detail.assigned_driver_id !== undefined) {
        setAssignedDriverId(detail.assigned_driver_id);
      }
      if (detail.assignedDriver !== undefined) {
        setAssignedDriver(sanitizeDriverName(detail.assignedDriver));
      } else if (detail.assigned_driver_name !== undefined) {
        setAssignedDriver(sanitizeDriverName(detail.assigned_driver_name));
      }
      if (detail.assignedDriverPhone !== undefined) {
        setAssignedDriverPhone(detail.assignedDriverPhone);
      } else if (detail.assigned_driver_phone !== undefined) {
        setAssignedDriverPhone(detail.assigned_driver_phone);
      }
    });
    return unsub;
  }, [booking]);

  if (!booking) return null;

  const handleCancelBooking = () => {
    const bookingId = booking.bookingId || booking.id;
    try {
      // 1. Driver bookings
      const drivers = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
      const updatedDrivers = drivers.map(b => b.id === bookingId ? { ...b, status: 'Cancelled', cancelReason } : b);
      localStorage.setItem('bda_driver_bookings', JSON.stringify(updatedDrivers));

      // 2. Vehicle bookings
      const vehicles = JSON.parse(localStorage.getItem('bda_vehicle_bookings') || '[]');
      const updatedVehicles = vehicles.map(b => b.id === bookingId ? { ...b, status: 'Cancelled', cancelReason } : b);
      localStorage.setItem('bda_vehicle_bookings', JSON.stringify(updatedVehicles));

      // 3. Class enrollments
      const classes = JSON.parse(localStorage.getItem('bda_class_enrollments') || '[]');
      const updatedClasses = classes.map(b => b.enrollmentId === bookingId ? { ...b, status: 'Cancelled', cancelReason } : b);
      localStorage.setItem('bda_class_enrollments', JSON.stringify(updatedClasses));

      window.dispatchEvent(new CustomEvent('bda_order_created'));
    } catch (e) {
      console.error(e);
    }

    setIsCancelled(true);
    setShowCancelConfirm(false);
  };

  const handleCopyPass = () => {
    let passText = `BOOK DRIVER ANNA CONFIRMATION\nBooking ID: ${booking.bookingId}\nService: ${booking.serviceName}\nPickup Area: ${booking.pickupArea}\n`;
    if (booking.bookingType === 'class') {
      passText += `Vehicle: ${booking.classTrainingCar} (${booking.classTransmission})\nBatch Slot: ${booking.classTimeSlot}\n`;
    }
    if (booking.passengers) {
      passText += `Passengers: ${booking.passengers}\nLuggage: ${booking.luggage || 'No Luggage'}\nAC Preference: ${booking.acPreference || 'AC'}\n`;
    }
    passText += `Date/Time: ${toDDMMYYYY(booking.bookingDate || booking.date)} at ${booking.bookingTime || booking.time}\nCustomer: ${booking.customerName} (${booking.customerPhone})\nTotal Fare: ₹${booking.totalFare} (${booking.paymentMode ? booking.paymentMode.toUpperCase() : 'CASH'})`;
    if (assignedDriver) {
      passText += `\nAssigned Anna: ${assignedDriver}`;
    }
    navigator.clipboard.writeText(passText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl z-10 animate-in zoom-in-95 duration-300 my-auto text-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        
        {/* Banner */}
        <div className={`p-5 sm:p-6 text-center relative overflow-hidden shrink-0 ${
          isCancelled 
            ? 'bg-gradient-to-r from-red-800 via-red-700 to-amber-700' 
            : 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-amber-500'
        }`}>
          <div className="absolute top-2 right-2">
            <button
              onClick={onClose}
              aria-label="Close booking confirmation modal"
              className="p-1 rounded-full bg-black/20 text-white hover:bg-black/40 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className={`w-14 h-14 sm:w-16 sm:h-16 bg-slate-950 rounded-full flex items-center justify-center mx-auto shadow-xl mb-3 border-2 ${
            isCancelled ? 'text-red-400 border-red-500' : 'text-emerald-400 border-emerald-400'
          }`}>
            {isCancelled ? <Ban className="w-8 h-8 sm:w-10 sm:h-10" /> : <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 animate-bounce" />}
          </div>

          <div className="bg-slate-950/40 backdrop-blur-sm inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white mb-1 border border-white/20">
            {isCancelled ? (
              <span className="text-red-300 flex items-center gap-1"><Ban className="w-3.5 h-3.5" /> Booking Cancelled</span>
            ) : (isPaid || currentStatus.toLowerCase().includes('complete')) ? (
              <span className="text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Ride Completed • Payment Settled</span>
            ) : isActiveTrip ? (
              <span className="text-emerald-300 flex items-center gap-1"><Car className="w-3.5 h-3.5 animate-pulse" /> Trip in Progress • On Route</span>
            ) : (isDriverArrived && hasAssignedDriver) ? (
              <span className="text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Driver has arrived</span>
            ) : currentStatus.toLowerCase().includes('pending') ? (
              <span className="text-amber-300 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Booking Placed • Awaiting Driver Assignment</span>
            ) : (
              <span className="text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Order Confirmed & Driver Assigned!</span>
            )}
          </div>

          <h3 className="text-xl sm:text-2xl font-extrabold text-white font-['Outfit']">
            {isCancelled 
              ? 'Booking Cancelled' 
              : (isPaid || currentStatus.toLowerCase().includes('complete'))
              ? 'Trip Completed & Fare Paid!'
              : isActiveTrip
              ? 'Trip in Progress!'
              : (isDriverArrived && hasAssignedDriver)
              ? (booking.bookingType === 'class' ? 'Instructor has arrived!' : 'Driver has arrived!')
              : currentStatus.toLowerCase().includes('pending')
              ? 'Order Received! Anna Dispatching Soon'
              : (booking.bookingType === 'class' ? 'Class Enrollment Confirmed!' : 'Anna is on his way!')}
          </h3>
          <p className="text-xs text-white/90 font-medium">
            Booking ID: <span className="font-mono font-bold bg-slate-950/60 px-2 py-0.5 rounded text-amber-300 break-all">{booking.bookingId}</span>
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">

          {/* No Driver Assigned State Card */}
          {!hasAssignedDriver && !isCancelled && (
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 font-bold shrink-0">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="text-xs text-amber-400 font-bold">Driver Assignment</div>
                  <div className="text-sm font-extrabold text-white">Waiting for driver assignment</div>
                  <div className="text-[11px] text-slate-400">Our dispatch team is assigning an Anna to your ride</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-950/70 text-amber-300 border border-amber-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                <span>Dispatching</span>
              </span>
            </div>
          )}

          {/* Driver/Instructor Card - Only render when a real driver has been assigned */}
          {hasAssignedDriver && (
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-400/10 border-2 border-amber-400 flex items-center justify-center text-amber-400 font-bold shrink-0">
                  <SteeringWheel className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-amber-400 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> {booking.bookingType === 'class' ? 'Assigned Driving Instructor' : 'Assigned Driver Anna'}
                  </div>
                  <div className="text-sm font-extrabold text-white">{assignedDriver}</div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {booking.driverRating || '5.0'} Rating • Certified Anna
                  </div>
                </div>
              </div>

              <a 
                href={`tel:${assignedDriverPhone || SUPPORT_HELPLINE}`}
                className="p-3 bg-emerald-500 text-slate-950 font-bold rounded-xl shadow-lg hover:bg-emerald-400 transition-colors flex items-center justify-center gap-1.5 text-xs min-h-[44px] min-w-[70px] shrink-0"
              >
                <Phone className="w-4 h-4 fill-slate-950" /> Call
              </a>
            </div>
          )}

          {/* Live Driver Tracking Map Card (Phase 11) */}
          {hasAssignedDriver && (
            <div className="bg-slate-950 rounded-2xl p-3.5 sm:p-4 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <Car className="w-4 h-4 text-blue-400" />
                  <span>Live Driver Tracking</span>
                </div>

                {/* Connection / GPS / Route state badge */}
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {/* Phase 16: Terminal state badge takes precedence over transient tracking badges */}
                  {isTerminalState ? (
                    isCancelled ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-950/70 text-red-300 border border-red-500/30">
                        <Ban className="w-3 h-3 text-red-400" />
                        <span>Trip Cancelled</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Trip Completed</span>
                      </span>
                    )
                  ) : (
                    <>
                      {isDriverArrived && hasAssignedDriver && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>Driver has arrived</span>
                        </span>
                      )}
                      {isActiveTrip && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>Active Trip Live Route</span>
                        </span>
                      )}
                      {driverRouteLoading && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-950/70 text-blue-300 border border-blue-500/30">
                          <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                          <span>{isActiveTrip ? 'Updating trip route...' : 'Updating driver route...'}</span>
                        </span>
                      )}
                      {driverRouteError && !driverRouteLoading && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-900 text-slate-400 border border-slate-700/60" title={driverRouteError}>
                          <AlertCircle className="w-3 h-3 text-amber-400" />
                          <span>Route temporarily unavailable</span>
                          <button
                            type="button"
                            onClick={() => {
                              lastRouteCoordsRef.current = null;
                              setDriverRouteError(null);
                              routeRequestIdRef.current++;
                            }}
                            className="text-[10px] text-amber-400 underline hover:text-amber-300 ml-0.5 font-bold"
                          >
                            Retry
                          </button>
                        </span>
                      )}
                      {connectionStatus === 'connecting' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-950/70 text-blue-300 border border-blue-500/30">
                          <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                          <span>Connecting to driver...</span>
                        </span>
                      )}
                      {connectionStatus === 'connected' && !driverLiveLocation && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/70 text-amber-300 border border-amber-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                          <span>Driver assigned • Waiting for driver's location...</span>
                        </span>
                      )}
                      {connectionStatus === 'connected' && driverLiveLocation && freshness !== 'STALE' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>Live GPS Active</span>
                        </span>
                      )}
                      {connectionStatus === 'connected' && driverLiveLocation && freshness === 'STALE' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/70 text-amber-300 border border-amber-500/30">
                          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                          <span>GPS Signal Stale</span>
                        </span>
                      )}
                      {connectionStatus === 'error' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-900 text-slate-400 border border-slate-700/60">
                          <AlertCircle className="w-3 h-3 text-amber-400" />
                          <span>Live location temporarily unavailable</span>
                          {reconnectRealtime && (
                            <button
                              type="button"
                              onClick={reconnectRealtime}
                              className="text-[10px] text-amber-400 underline hover:text-amber-300 ml-0.5 font-bold"
                            >
                              Retry
                            </button>
                          )}
                        </span>
                      )}
                      {connectionStatus === 'disconnected' && !driverLiveLocation && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-900 text-slate-400 border border-slate-700/60">
                          <span>Offline</span>
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Map displaying live driver location and route */}
              <div className="relative rounded-xl overflow-hidden border border-slate-800">
                <MapView
                  center={mapCenter}
                  zoom={14}
                  height="180px"
                  className="border-0"
                  ariaLabel="Live Driver Location Map"
                >
                  {/* Customer Trip Route (Route B: Pickup -> Destination) */}
                  {(booking?.routeGeometry || booking?.route_geometry || booking?.geometry) && !isActiveTrip && (
                    <RoutePolyline
                      geometry={booking.routeGeometry || booking.route_geometry || booking.geometry}
                      color="#f59e0b"
                      weight={4}
                      opacity={0.85}
                    />
                  )}

                  {/* Pre-Pickup Driver Route (Phase 13: Royal Blue Dashed - Driver -> Pickup) */}
                  {!isActiveTrip && driverRoute?.geometry && driverRouteType === 'to-pickup' && !isDriverArrived && !isTerminalState && (
                    <RoutePolyline
                      geometry={driverRoute.geometry}
                      color="#3b82f6"
                      weight={4}
                      opacity={0.85}
                      dashArray="6, 8"
                    />
                  )}

                  {/* Active Trip Driver Route (Phase 14: Emerald Green Dashed - Driver -> Destination) */}
                  {isActiveTrip && driverRoute?.geometry && driverRouteType === 'active-trip' && !isTerminalState && (
                    <RoutePolyline
                      geometry={driverRoute.geometry}
                      color="#10b981"
                      weight={4}
                      opacity={0.9}
                      dashArray="4, 6"
                    />
                  )}

                  {(booking?.pickup_latitude || booking?.pickupLatitude) && (
                    <PickupMarker
                      location={{
                        latitude: booking.pickup_latitude || booking.pickupLatitude,
                        longitude: booking.pickup_longitude || booking.pickupLongitude,
                        displayName: booking.pickupArea || 'Pickup Location'
                      }}
                    />
                  )}
                  {(booking?.destination_latitude || booking?.destinationLatitude) && (
                    <DestinationMarker
                      location={{
                        latitude: booking.destination_latitude || booking.destinationLatitude,
                        longitude: booking.destination_longitude || booking.destinationLongitude,
                        displayName: booking.dropLocation || 'Destination'
                      }}
                    />
                  )}
                  {driverLiveLocation && (
                    <DriverLocationMarker
                      location={driverLiveLocation}
                      label={assignedDriver}
                      subtitle="Assigned Anna • Live"
                    />
                  )}
                </MapView>
              </div>
            </div>
          )}

          {/* Trip / Class Details Grid */}
          <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 space-y-3 text-xs">
            <div className="flex items-start justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                {booking.bookingType === 'class' ? <GraduationCap className="w-4 h-4 text-amber-400" /> : <SteeringWheel className="w-4 h-4 text-amber-400" />}
                Service Option:
              </span>
              <span className="font-bold text-white text-right">{booking.serviceName}</span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-amber-400" /> {booking.bookingType === 'class' ? 'Training Area:' : 'Pickup Area:'}
              </span>
              <span className="font-bold text-white">{booking.pickupArea}</span>
            </div>

            {booking.bookingType === 'class' && (
              <>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-amber-400" /> Vehicle & Gear:
                  </span>
                  <span className="font-bold text-amber-300 text-right">
                    {booking.classTrainingCar} ({booking.classTransmission})
                  </span>
                </div>

                {booking.classTimeSlot && (
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-400" /> Daily Batch Slot:
                    </span>
                    <span className="font-bold text-white">{booking.classTimeSlot}</span>
                  </div>
                )}
              </>
            )}

            {booking.passengers && (
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-400" /> Passengers & Luggage:
                </span>
                <span className="font-bold text-amber-300 flex items-center gap-1">
                  {booking.passengers} • <Briefcase className="w-3.5 h-3.5 text-amber-400 inline" /> {booking.luggage} • {booking.acPreference === 'AC' ? <Snowflake className="w-3.5 h-3.5 text-cyan-400 inline" /> : <Sun className="w-3.5 h-3.5 text-amber-400 inline" />} {booking.acPreference}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-400" /> Date & Time:
              </span>
              <span className="font-bold text-white">{toDDMMYYYY(booking.bookingDate || booking.date)} @ {booking.bookingTime || booking.time}</span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Customer:</span>
              <span className="font-bold text-white">{booking.customerName} ({booking.customerPhone})</span>
            </div>

            <div className="flex items-center justify-between text-sm pt-1">
              <span className="font-bold text-slate-300">Total Amount Payable:</span>
              <span className="font-extrabold text-amber-400 text-lg font-['Outfit']">₹{booking.totalFare}</span>
            </div>
          </div>

          {/* Cancel Confirmation Prompt */}
          {showCancelConfirm && !isCancelled && (
            <div className="p-4 bg-slate-950 border-2 border-red-500/50 rounded-2xl space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Are you sure you want to cancel this booking?</span>
              </div>
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Reason for cancellation:</label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-400"
                >
                  <option value="Change of travel plans">Change of travel plans</option>
                  <option value="Found alternative transport">Found alternative transport</option>
                  <option value="Booked by mistake">Booked by mistake</option>
                  <option value="Timing conflict">Timing conflict</option>
                  <option value="Other reason">Other reason</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCancelBooking}
                  className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-red-950"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Confirm Cancellation (Free)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors"
                >
                  Keep Booking
                </button>
              </div>
            </div>
          )}

          {/* Ride Completion & Payment Button */}
          {!isCancelled && (
            (isPaid || currentStatus.toLowerCase().includes('complete')) ? (
              <div className="w-full py-3 px-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Fare Paid & Ride Completed</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onSimulateRidePayment) {
                    onSimulateRidePayment(booking);
                  }
                  onClose();
                }}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-300"
              >
                <CreditCard className="w-4 h-4" />
                <span>Complete Ride & Pay Fare</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCopyPass}
              className="py-3 px-3 sm:px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-colors min-h-[44px] cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="truncate">{copied ? 'Pass Copied!' : 'Copy Trip Ticket'}</span>
            </button>

            <button
              onClick={onClose}
              className="py-3 px-3 sm:px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-lg transition-colors text-center min-h-[44px] cursor-pointer"
            >
              Done & Return Home
            </button>
          </div>

          {/* Cancel Booking Button on Pass Ticket */}
          {!isCancelled ? (
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="w-full py-2.5 px-4 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Cancel Booking (Zero Cancellation Fee)</span>
            </button>
          ) : (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-center space-y-0.5">
              <div className="text-xs font-bold text-red-400 flex items-center justify-center gap-1.5">
                <Ban className="w-3.5 h-3.5" /> This booking has been cancelled
              </div>
              <p className="text-[11px] text-slate-400">Zero cancellation charges incurred.</p>
            </div>
          )}

          <div className="text-center text-[10px] text-slate-500 flex items-center justify-center gap-1">
            <Smartphone className="w-3 h-3 text-purple-400" /> SMS & WhatsApp with live GPS tracking link has been sent to {booking.customerPhone}
          </div>

        </div>

      </div>
    </div>
  );
}
