import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Car, ShieldCheck, CheckCircle2, MapPin, Phone, LogOut, ArrowUpRight, 
  DollarSign, TrendingUp, Calendar, Clock, Award, AlertCircle, Check, X, 
  ChevronRight, RefreshCw, Power, QrCode, Smartphone, Sparkles, Save, Edit2, Copy,
  Navigation, Radio, User
} from 'lucide-react';
import { SteeringWheel, WhatsAppIcon } from '../components/Icons';
import useScrollLock from '../utils/useScrollLock';
import { useDriverLocation } from '../utils/useDriverLocation';
import { broadcastBookingUpdate, onBookingUpdate } from '../utils/broadcastSync';
import { 
  isDutyAssignedToDriver, 
  isDutyAssignedToOtherDriver, 
  formatDuty, 
  getDriverDuties 
} from '../utils/driverDutyHelpers';
import { SUPPORT_HELPLINE } from '../data/mockData';
import SOSButton from '../components/SOSButton';
import { isDummyOrDemoUser, isValidUpi } from '../utils/userValidation';
import { apiClient } from '../services/apiClient';
import DriverProfileSection from '../components/DriverProfileSection';

export { isDutyAssignedToDriver, isDutyAssignedToOtherDriver, formatDuty, getDriverDuties };

export default function DriverPortalPage({ 
  driverUser, 
  onLogout,
  initialTab = 'duties'
}) {
  const [currentDriverUser, setCurrentDriverUser] = useState(driverUser);
  const [portalTab, setPortalTab] = useState(initialTab); // 'duties' | 'profile'

  useEffect(() => {
    if (driverUser) {
      setCurrentDriverUser(driverUser);
    }
  }, [driverUser]);

  const activeDriver = currentDriverUser || driverUser;

  // Automatically reject and logout any dummy driver profiles
  useEffect(() => {

    if (!driverUser || isDummyOrDemoUser(driverUser)) {
      if (onLogout) onLogout();
    }
  }, [driverUser, onLogout]);

  const [isOnline, setIsOnline] = useState(() => {
    if (driverUser?.isOnline !== undefined) return Boolean(driverUser.isOnline);
    try {
      const savedUser = localStorage.getItem('bda_driver_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed?.isOnline !== undefined) return Boolean(parsed.isOnline);
      }
    } catch (e) {}
    return true;
  });

  // Driver GPS Location Tracking Hook
  const {
    trackingStatus,
    isTracking,
    currentCoords,
    lastSyncTime,
    errorMessage: gpsError,
    toggleTracking,
    startTracking,
    stopTracking
  } = useDriverLocation();
  const [acceptedTrips, setAcceptedTrips] = useState([]);
  const [pastTrips, setPastTrips] = useState([]);
  const [dutiesTab, setDutiesTab] = useState('active'); // 'active' | 'history'
  const [isLoadingDuties, setIsLoadingDuties] = useState(true);
  const [dutiesError, setDutiesError] = useState(null);
  const [startingTripId, setStartingTripId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [todayEarnings, setTodayEarnings] = useState(driverUser?.earningsToday || 0);
  const [lifetimeTrips, setLifetimeTrips] = useState(driverUser?.trips || 0);
  const [settlementTrip, setSettlementTrip] = useState(null);
  const [settlementMethod, setSettlementMethod] = useState('online'); // 'online' or 'cash'

  // Driver UPI ID state for generating dynamic QR codes
  const [driverUpi, setDriverUpi] = useState(() => {
    if (driverUser?.upiId) return driverUser.upiId;
    try {
      const savedUser = localStorage.getItem('bda_driver_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed?.upiId) return parsed.upiId;
      }
      const savedDrivers = localStorage.getItem('bda_registered_drivers');
      if (savedDrivers) {
        const list = JSON.parse(savedDrivers);
        const currentPhone = (driverUser?.phone || '').replace(/[^0-9]/g, '');
        const currentId = driverUser?.id;
        const found = list.find(d => (currentId && d.id === currentId) || (currentPhone && d.phone && d.phone.replace(/[^0-9]/g, '') === currentPhone));
        if (found?.upiId) return found.upiId;
      }
    } catch (e) {}
    return (driverUser?.upiId || '');
  });
  const [upiSaveSuccess, setUpiSaveSuccess] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  const handleCopyUpi = (text) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  useScrollLock(Boolean(settlementTrip));

  const handleSaveUpi = (e) => {
    if (e) e.preventDefault();
    const cleanUpi = driverUpi.trim();
    if (!isValidUpi(cleanUpi)) {
      setToastMessage("Please enter a valid UPI ID (e.g. yourname@oksbi or phone@paytm)");
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    // 1. Update active driver user session
    try {
      const savedUser = localStorage.getItem('bda_driver_user');
      const parsed = savedUser ? JSON.parse(savedUser) : { ...(driverUser || {}) };
      parsed.upiId = cleanUpi;
      localStorage.setItem('bda_driver_user', JSON.stringify(parsed));
    } catch (e) {}

    // 2. Update fleet directory in bda_registered_drivers
    try {
      const savedDrivers = localStorage.getItem('bda_registered_drivers');
      let driversList = savedDrivers ? JSON.parse(savedDrivers) : [];
      if (Array.isArray(driversList)) {
        const currentId = driverUser?.id;
        const currentPhone = (driverUser?.phone || '').replace(/[^0-9]/g, '');
        let found = false;
        const updated = driversList.map(d => {
          const dPhone = (d.phone || '').replace(/[^0-9]/g, '');
          if ((currentId && d.id === currentId) || (currentPhone && dPhone && (dPhone === currentPhone || dPhone.includes(currentPhone) || currentPhone.includes(dPhone)))) {
            found = true;
            return { ...d, upiId: cleanUpi };
          }
          return d;
        });
        if (!found && driverUser) {
          updated.unshift({ ...driverUser, upiId: cleanUpi });
        }
        localStorage.setItem('bda_registered_drivers', JSON.stringify(updated));
      }
    } catch (e) {}

    // 3. Dispatch real-time event for RidePaymentModal & Admin
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bda_driver_upi_updated', {
        detail: {
          driverId: driverUser?.id,
          phone: driverUser?.phone,
          name: driverUser?.name,
          upiId: cleanUpi
        }
      }));
    }

    setUpiSaveSuccess(true);
    setToastMessage(`✓ UPI ID updated to ${cleanUpi}. Live QR code generated!`);
    setTimeout(() => {
      setUpiSaveSuccess(false);
      setTimeout(() => setToastMessage(null), 1000);
    }, 3000);
  };

  // Sync duty status to persistent database and notify admin in real-time
  const handleToggleOnline = () => {
    const nextStatus = !isOnline;
    setIsOnline(nextStatus);

    // 1. Update active driver user session
    try {
      const savedUser = localStorage.getItem('bda_driver_user');
      const parsed = savedUser ? JSON.parse(savedUser) : { ...(driverUser || {}) };
      parsed.isOnline = nextStatus;
      localStorage.setItem('bda_driver_user', JSON.stringify(parsed));
    } catch (e) {}

    // 2. Update fleet directory in bda_registered_drivers
    try {
      const savedDrivers = localStorage.getItem('bda_registered_drivers');
      let driversList = savedDrivers ? JSON.parse(savedDrivers) : [];
      if (Array.isArray(driversList)) {
        const currentId = driverUser?.id;
        const currentPhone = (driverUser?.phone || '').replace(/[^0-9]/g, '');
        let found = false;
        const updated = driversList.map(d => {
          const dPhone = (d.phone || '').replace(/[^0-9]/g, '');
          if ((currentId && d.id === currentId) || (currentPhone && dPhone && (dPhone === currentPhone || dPhone.includes(currentPhone) || currentPhone.includes(dPhone)))) {
            found = true;
            return { ...d, isOnline: nextStatus };
          }
          return d;
        });
        if (!found && driverUser) {
          updated.unshift({ ...driverUser, isOnline: nextStatus });
        }
        localStorage.setItem('bda_registered_drivers', JSON.stringify(updated));
      }
    } catch (e) {}

    // 3. Dispatch real-time event for Admin Page and cross-tab sync
    window.dispatchEvent(new CustomEvent('bda_driver_status_updated', {
      detail: {
        driverId: driverUser?.id,
        phone: driverUser?.phone,
        isOnline: nextStatus
      }
    }));

    setToastMessage(nextStatus ? '✓ You are now ONLINE & receiving customer duties.' : 'You are now OFFLINE. New bookings paused.');
  };

  // Initial sync on mount
  useEffect(() => {
    if (!driverUser) return;
    try {
      const savedDrivers = localStorage.getItem('bda_registered_drivers');
      let driversList = savedDrivers ? JSON.parse(savedDrivers) : [];
      if (Array.isArray(driversList)) {
        const currentId = driverUser?.id;
        const currentPhone = (driverUser?.phone || '').replace(/[^0-9]/g, '');
        let needsUpdate = false;
        const updated = driversList.map(d => {
          const dPhone = (d.phone || '').replace(/[^0-9]/g, '');
          if ((currentId && d.id === currentId) || (currentPhone && dPhone && (dPhone === currentPhone || dPhone.includes(currentPhone) || currentPhone.includes(dPhone)))) {
            if (d.isOnline !== isOnline) {
              needsUpdate = true;
              return { ...d, isOnline };
            }
          }
          return d;
        });
        if (needsUpdate) {
          localStorage.setItem('bda_registered_drivers', JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent('bda_driver_status_updated', {
            detail: { driverId: driverUser?.id, phone: driverUser?.phone, isOnline }
          }));
        }
      }
    } catch (e) {}
  }, [driverUser, isOnline]);

  const [availableDuties, setAvailableDuties] = useState([]);

  const isFetchingRef = useRef(false);
  const reloadTimerRef = useRef(null);
  const driverUserRef = useRef(driverUser);

  useEffect(() => {
    driverUserRef.current = driverUser;
  }, [driverUser]);

  // Authoritative fetch of driver duties & history from backend
  const fetchDuties = useCallback(async (options = {}) => {
    const currentUser = driverUserRef.current || driverUser;
    if (!currentUser) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoadingDuties(true);
    setDutiesError(null);

    try {
      // 1. Fetch duties assigned to this driver
      const res = await apiClient.getDriverDuties();
      if (res && res.data && Array.isArray(res.data.duties)) {
        const serverDuties = res.data.duties;
        const activeDuties = serverDuties.filter(b => {
          const rawStatus = (b.status || '').toUpperCase();
          return !rawStatus.includes('COMPLET') && !rawStatus.includes('CANCEL');
        });
        const historicalDuties = serverDuties.filter(b => {
          const rawStatus = (b.status || '').toUpperCase();
          return rawStatus.includes('COMPLET') || rawStatus.includes('CANCEL');
        });
        const formatted = activeDuties.map(formatDuty);
        setAcceptedTrips(formatted);
        setPastTrips(historicalDuties.map(formatDuty));

        // Update non-authoritative convenience cache ONLY if changed to prevent storage event loops
        try {
          const onlyDriverDuties = serverDuties
            .filter(b => b.booking_type === 'driver' || (!b.booking_type && !b.id?.startsWith('BDA-VEH-') && !b.id?.startsWith('BDA-CLS-')))
            .map(b => ({
              ...b,
              customerName: b.customer_name || b.customerName || 'Customer',
              phone: b.customer_phone || b.customerPhone || b.phone || '',
              pickupArea: b.pickup_area || b.pickupArea || 'Pickup Location',
              dropLocation: b.drop_location || b.dropLocation || 'Drop Location',
              fare: b.calculated_fare !== undefined ? b.calculated_fare : (b.fare !== undefined ? b.fare : 0),
              tripTitle: b.service_name || b.tripTitle || 'Driver Service'
            }));
          const serialized = JSON.stringify(onlyDriverDuties);
          const existing = localStorage.getItem('bda_driver_bookings');
          if (existing !== serialized) {
            localStorage.setItem('bda_driver_bookings', serialized);
          }
        } catch (e) {}
      } else {
        setAcceptedTrips([]);
      }

      // 2. Fetch available unclaimed customer bookings waiting for an Anna
      try {
        const availRes = await apiClient.getAvailableDuties();
        if (availRes && availRes.data && Array.isArray(availRes.data.duties)) {
          const formattedAvail = availRes.data.duties.map(d => {
            const formatted = formatDuty(d);
            return {
              ...formatted,
              urgency: 'Open Duty'
            };
          });
          setAvailableDuties(formattedAvail);
        } else {
          setAvailableDuties([]);
        }
      } catch (aErr) {
        console.warn('[DRIVER PORTAL] Failed to fetch available duties:', aErr.message);
      }

      // 3. Query dedicated bounded history endpoint ONLY when on history tab or explicitly requested
      if (options.includeHistory || dutiesTab === 'history') {
        try {
          const historyRes = await apiClient.getDriverHistory();
          if (historyRes && historyRes.data && Array.isArray(historyRes.data.history)) {
            setPastTrips(historyRes.data.history.map(formatDuty));
          }
        } catch (hErr) {
          // Fallback already assigned from serverDuties
        }
      }
    } catch (err) {
      console.warn('[DRIVER PORTAL] Failed to fetch server duties:', err.message);
      setDutiesError(err.message || 'Unable to load duties from server.');
    } finally {
      setIsLoadingDuties(false);
      isFetchingRef.current = false;
    }
  }, [dutiesTab, driverUser?.id]);

  useEffect(() => {
    fetchDuties();
  }, [fetchDuties]);

  // Real-time synchronization when admin assigns or modifies bookings across tabs and windows
  useEffect(() => {
    const handleDutyChange = (payload) => {
      // Debounce reload to collapse bursts of updates into a single network call
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
      }
      reloadTimerRef.current = setTimeout(() => {
        fetchDuties();
      }, 350);

      // Notify if a duty was just assigned to THIS driver by admin
      if (payload && (payload.bookingId || payload.id)) {
        const currentDriver = driverUserRef.current || (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('bda_driver_user') || 'null') : null) || {};
        if (isDutyAssignedToDriver(payload, currentDriver)) {
          setToastMessage(`🔔 New Trip Assigned! Duty #${payload.bookingId || payload.id} has been assigned to you by Dispatch Admin.`);
          setTimeout(() => setToastMessage(null), 6000);
        }
      }
    };

    // onBookingUpdate already handles BroadcastChannel, storage, and bda_booking_updated events
    const unsubscribe = onBookingUpdate(handleDutyChange);
    window.addEventListener('bda_order_created', handleDutyChange);

    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
      }
      if (unsubscribe) unsubscribe();
      window.removeEventListener('bda_order_created', handleDutyChange);
    };
  }, [fetchDuties]);

  const handleAcceptDuty = async (duty) => {
    if (!isOnline) {
      setToastMessage("Please switch your duty status to ONLINE to accept trips.");
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const currentDriver = driverUser || (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('bda_driver_user') || 'null') : null) || {};

    try {
      // 1. Authoritative Backend Acceptance
      const targetId = duty.id || duty.bookingId;
      const res = await apiClient.acceptDuty(targetId);
      const serverBooking = res?.data?.booking;

      const assignedDriverName = currentDriver.name || serverBooking?.assigned_driver_name || 'Driver Assigned';
      const assignedDriverPhone = currentDriver.phone || serverBooking?.assigned_driver_phone || '';

      const acceptedDuty = {
        ...duty,
        status: 'Assigned',
        assignedDriver: assignedDriverName,
        assignedDriverPhone: assignedDriverPhone,
        assignedDriverUpi: driverUpi || currentDriver.upiId || ''
      };

      // 2. Update persistent bda_driver_bookings
      try {
        const savedBookings = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
        const updated = savedBookings.map(b => (b.id === targetId || b.bookingId === targetId) ? {
          ...b,
          status: 'Assigned',
          assignedDriver: assignedDriverName,
          assignedDriverPhone: assignedDriverPhone,
          assignedDriverUpi: driverUpi || currentDriver.upiId || ''
        } : b);
        localStorage.setItem('bda_driver_bookings', JSON.stringify(updated));
      } catch (e) {}

      // 3. Real-time broadcast for Admin Page and other connected sessions
      broadcastBookingUpdate({
        bookingId: targetId,
        status: 'Assigned',
        assignedDriver: assignedDriverName,
        assignedDriverPhone: assignedDriverPhone,
        assignedDriverUpi: driverUpi || currentDriver.upiId
      });

      setAcceptedTrips(prev => [acceptedDuty, ...prev.filter(d => (d.id !== targetId && d.bookingId !== targetId))]);
      setAvailableDuties(prev => prev.filter(d => (d.id !== targetId && d.bookingId !== targetId)));
      setToastMessage(`✓ Duty ${targetId} accepted! Customer ${duty.customerName} notified that Anna is on the way.`);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err) {
      console.error('[DRIVER ACCEPT DUTY ERROR]', err);
      setToastMessage(`⚠️ Could not accept duty: ${err.message || 'Please try again.'}`);
      setTimeout(() => setToastMessage(null), 5000);
      fetchDuties();
    }
  };

  const [arrivingTripId, setArrivingTripId] = useState(null);

  const handleMarkArrived = async (tripId) => {
    if (arrivingTripId) return;
    const targetBookingId = tripId;
    setArrivingTripId(targetBookingId);

    try {
      await apiClient.updateDutyStatus(targetBookingId, 'ARRIVED');

      setAcceptedTrips(prev => prev.map(t => {
        if (t.id === targetBookingId || t.bookingId === targetBookingId) {
          return {
            ...t,
            status: 'Arrived'
          };
        }
        return t;
      }));

      try {
        const savedBookings = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
        const updated = savedBookings.map(b => (b.id === targetBookingId || b.bookingId === targetBookingId) ? { ...b, status: 'ARRIVED' } : b);
        localStorage.setItem('bda_driver_bookings', JSON.stringify(updated));
      } catch (e) {}

      broadcastBookingUpdate({ bookingId: targetBookingId, status: 'ARRIVED' });
      setToastMessage(`📍 Arrived at pickup for ${targetBookingId}! Customer notified.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('[DRIVER PORTAL] Failed to mark arrived:', err);
      const msg = err.message || 'Failed to update arrival status. Please try again.';
      setToastMessage(`⚠️ Error: ${msg}`);
      setTimeout(() => setToastMessage(null), 6000);
    } finally {
      setArrivingTripId(null);
    }
  };

  const handleStartTrip = async (tripId) => {
    if (startingTripId) return;
    const targetBookingId = tripId;
    setStartingTripId(targetBookingId);

    try {
      const res = await apiClient.updateDutyStatus(targetBookingId, 'IN_PROGRESS');
      const updatedBooking = res?.data?.booking;

      setAcceptedTrips(prev => prev.map(t => {
        if (t.id === targetBookingId || t.bookingId === targetBookingId) {
          return {
            ...t,
            status: 'In Progress'
          };
        }
        return t;
      }));

      // Update non-authoritative convenience cache
      try {
        const savedBookings = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
        const updated = savedBookings.map(b => (b.id === targetBookingId || b.bookingId === targetBookingId) ? { ...b, status: 'IN_PROGRESS' } : b);
        localStorage.setItem('bda_driver_bookings', JSON.stringify(updated));
      } catch (e) {}

      broadcastBookingUpdate({ bookingId: targetBookingId, status: 'In Progress' });
      setToastMessage(`🚗 Trip ${targetBookingId} started! Meter is running.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('[DRIVER PORTAL] Failed to start trip:', err);
      const msg = err.message || 'Failed to start trip on server. Please try again.';
      setToastMessage(`⚠️ Error: ${msg}`);
      setTimeout(() => setToastMessage(null), 6000);
    } finally {
      setStartingTripId(null);
    }
  };

  const handleConfirmSettlement = () => {
    if (!settlementTrip) return;
    const numericFare = Number(settlementTrip.payout.replace(/[^0-9]/g, '')) || 749;

    setTodayEarnings(prev => prev + numericFare);
    setLifetimeTrips(prev => prev + 1);

    // Update persistent bda_driver_bookings and bda_paid_bookings
    try {
      const savedBookings = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
      const updated = savedBookings.map(b => (b.id === settlementTrip.id || b.bookingId === settlementTrip.id || b.id === settlementTrip.bookingId) ? { ...b, status: 'Completed', isPaid: true, paymentStatus: 'PAID' } : b);
      localStorage.setItem('bda_driver_bookings', JSON.stringify(updated));
    } catch (e) {}

    try {
      const paid = JSON.parse(localStorage.getItem('bda_paid_bookings') || '[]');
      const idsToAdd = [settlementTrip.id, settlementTrip.bookingId].filter(Boolean);
      let changed = false;
      idsToAdd.forEach(id => {
        if (!paid.includes(id)) {
          paid.push(id);
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem('bda_paid_bookings', JSON.stringify(paid));
      }
    } catch (e) {}

    // Synchronize to backend database
    const bookingTargetId = settlementTrip.bookingId || settlementTrip.id;
    if (bookingTargetId) {
      apiClient.completeBooking(bookingTargetId, settlementMethod).catch(err => {
        console.warn('[DRIVER PORTAL] Complete booking backend note:', err.message);
      });
    }

    const payload = { 
      id: settlementTrip.id,
      bookingId: settlementTrip.bookingId || settlementTrip.id, 
      status: 'Completed',
      isPaid: true,
      paymentStatus: 'PAID',
      settlementMethod,
      totalFare: numericFare,
      assignedDriver: driverUser?.name || "Driver Assigned",
      assignedDriverPhone: driverUser?.phone || SUPPORT_HELPLINE
    };

    broadcastBookingUpdate(payload);

    // Notify customer app via CustomEvent
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bda_ride_completed', {
        detail: {
          ...payload,
          driverRating: driverUser?.rating || 5.0,
          carModel: settlementTrip.carModel,
          pickupArea: settlementTrip.pickup,
          dropLocation: settlementTrip.destination,
          distance: settlementTrip.distance
        }
      }));
      window.dispatchEvent(new CustomEvent('bda_booking_updated', { detail: payload }));
    }

    setAcceptedTrips(prev => prev.filter(t => t.id !== settlementTrip.id));
    setToastMessage(`✓ Trip ${settlementTrip.id} completed! Payout of ${settlementTrip.payout} recorded.`);
    setSettlementTrip(null);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleOpenSettlement = (trip) => {
    setSettlementTrip(trip);
    const activeUpi = (driverUpi || driverUser?.upiId || '').trim();
    const hasUpi = isValidUpi(activeUpi);
    setSettlementMethod(hasUpi ? 'online' : 'cash');
    const numericFare = Number(trip.payout?.replace(/[^0-9]/g, '')) || 749;

    broadcastBookingUpdate({
      bookingId: trip.id,
      status: 'Fare Settlement',
      assignedDriver: driverUser?.name || 'Driver Assigned',
      assignedDriverPhone: driverUser?.phone || '',
      assignedDriverUpi: hasUpi ? activeUpi : '',
      driverUpi: hasUpi ? activeUpi : '',
      totalFare: numericFare
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bda_ride_completed', {
        detail: {
          id: trip.id,
          driverName: driverUser?.name || "Driver Assigned",
          driverPhone: driverUser?.phone || SUPPORT_HELPLINE,
          driverRating: driverUser?.rating || 5.0,
          driverUpi: activeUpi,
          carModel: trip.carModel,
          pickupArea: trip.pickup,
          dropLocation: trip.destination,
          distance: trip.distance,
          totalFare: numericFare,
          settlementMethod: 'online'
        }
      }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-400 selection:text-slate-950 pb-16">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-slate-900 border-2 border-emerald-500/80 text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-top-4">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <div className="text-xs font-bold text-slate-200">{toastMessage}</div>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white ml-2 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="bg-slate-950/85 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-xl max-w-full overflow-x-hidden shadow-md shadow-black/20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Brand & Duties Navigation */}
          <button
            id="driver-nav-duties-btn"
            type="button"
            onClick={() => setPortalTab('duties')}
            className="flex items-center gap-2 sm:gap-3 min-w-0 text-left cursor-pointer group focus:outline-none"
            title="Book Driver Anna — Return to Duties"
            aria-label="Duties and Trips"
          >
            <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 font-bold shadow-inner shrink-0 group-hover:border-emerald-400/60 transition-colors">
              <SteeringWheel className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="hidden sm:block min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-xs sm:text-base text-white font-['Outfit'] tracking-tight leading-none truncate">
                  Book Driver <span className="text-emerald-400">Anna</span>
                </span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1">
                <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1 sm:gap-1.5 truncate">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-500'}`} />
                  <span className="truncate max-w-[85px] xs:max-w-[120px] sm:max-w-[160px] text-slate-300 font-semibold">
                    {activeDriver?.name || 'Driver Partner'}
                  </span>
                  {activeDriver?.area && (
                    <span className="hidden lg:inline text-slate-500">• {activeDriver.area}</span>
                  )}
                </div>
              </div>
            </div>
          </button>

          {/* Right Header Controls: Online, Profile, and Logout */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            
            {/* 1. Online/Offline Duty Toggle Button */}
            <button
              onClick={handleToggleOnline}
              className={`min-h-[40px] sm:min-h-[44px] px-2.5 sm:px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer border shadow-sm touch-manipulation ${
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title={isOnline ? "Duty Status: Online. Click to go offline." : "Duty Status: Offline. Click to go online."}
              aria-label={isOnline ? "Duty Status: Online" : "Duty Status: Offline"}
            >
              {isOnline ? (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
              )}
              <span className="font-mono tracking-tight">{isOnline ? 'Online' : 'Offline'}</span>
            </button>

            {/* 2. Profile Button */}
            <button
              id="driver-nav-profile-btn"
              type="button"
              onClick={() => setPortalTab(prev => prev === 'profile' ? 'duties' : 'profile')}
              className={`min-h-[40px] sm:min-h-[44px] px-2.5 sm:px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer border shadow-sm touch-manipulation ${
                portalTab === 'profile'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white hover:border-slate-700'
              }`}
              title={portalTab === 'profile' ? "Return to Duties" : "View Driver Profile"}
              aria-label="Driver Profile"
            >
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Profile</span>
            </button>

            {/* 3. Logout Button */}
            <button
              onClick={onLogout}
              className="min-h-[40px] sm:min-h-[44px] min-w-[40px] sm:min-w-[44px] px-2.5 sm:px-3 rounded-xl text-slate-400 hover:text-rose-300 bg-slate-900 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold shrink-0 touch-manipulation"
              title="Driver Sign Out"
              aria-label="Driver Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
              <span className="hidden sm:inline">Logout</span>
            </button>

          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {portalTab === 'profile' ? (
          <DriverProfileSection
            driverUser={activeDriver}
            onProfileUpdated={(updatedProfile, token) => {
              setCurrentDriverUser(prev => ({ ...(prev || {}), ...updatedProfile }));
              setToastMessage('Driver profile updated successfully!');
              setTimeout(() => setToastMessage(null), 4000);
            }}
            onReturnToDuties={() => setPortalTab('duties')}
          />
        ) : (
          <>
            {/* Welcome Driver Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800 rounded-3xl p-4 sm:p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6 relative overflow-hidden shadow-xl">
              <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 font-black text-lg sm:text-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                  {activeDriver?.name ? activeDriver.name.charAt(0).toUpperCase() : 'M'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 min-w-0">
                    <h1 className="text-lg sm:text-2xl font-black text-white font-['Outfit'] tracking-tight truncate">
                      Namaskara, Anna {activeDriver?.name || 'Partner'}!
                    </h1>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 sm:px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0 inline-flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>Verified Fleet Anna</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-400 mt-1">
                    <span>DL: <strong className="text-slate-200 font-mono">{activeDriver?.dlNumber || 'Verified ID'}</strong></span>
                    <span className="hidden xs:inline">•</span>
                    <span>Hub: <strong className="text-amber-400">{activeDriver?.area || 'Bengaluru Fleet'}</strong></span>
                    <span className="hidden xs:inline">•</span>
                    <span>Rating: <strong className="text-emerald-400 font-extrabold">★ {activeDriver?.rating || '5.0'}</strong></span>
                  </div>
                </div>
              </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 w-full md:w-auto shrink-0">
            <div className="bg-slate-950/80 border border-slate-800 p-2.5 sm:p-3 rounded-2xl text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Today's Earnings</div>
              <div className="text-base font-extrabold text-emerald-400 font-mono mt-0.5">
                ₹{todayEarnings}
              </div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-2.5 sm:p-3 rounded-2xl text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Lifetime Trips</div>
              <div className="text-base font-extrabold text-white font-mono mt-0.5">
                {lifetimeTrips}
              </div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-2.5 sm:p-3 rounded-2xl text-center col-span-2 sm:col-span-1">
              <div className="text-[10px] uppercase font-bold text-slate-400">Next Payout</div>
              <div className="text-xs font-bold text-amber-400 mt-1">
                Monday (Direct Bank)
              </div>
            </div>
          </div>
        </div>

        {/* Driver GPS Live Tracking Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 md:p-7 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                isTracking
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                <Navigation className={`w-5 h-5 ${isTracking ? 'animate-pulse text-cyan-400' : ''}`} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-white font-['Outfit']">
                    Driver GPS Live Tracking
                  </h2>
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 sm:px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border ${
                    trackingStatus === 'active'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : trackingStatus === 'requesting'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse'
                      : trackingStatus === 'denied' || trackingStatus === 'unavailable' || trackingStatus === 'error'
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      trackingStatus === 'active' ? 'bg-emerald-400 animate-pulse' :
                      trackingStatus === 'requesting' ? 'bg-amber-400' :
                      trackingStatus === 'denied' || trackingStatus === 'error' ? 'bg-rose-400' : 'bg-slate-500'
                    }`} />
                    <span>
                      Location tracking: {
                        trackingStatus === 'idle' ? 'Not enabled' :
                        trackingStatus === 'requesting' ? 'Requesting permission' :
                        trackingStatus === 'active' ? 'Active' :
                        trackingStatus === 'denied' ? 'Permission denied' :
                        trackingStatus === 'unavailable' ? 'Location unavailable' :
                        trackingStatus === 'timeout' ? 'Timeout' : 'Error'
                      }
                    </span>
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Continuous GPS positioning updates your location with dispatch and ensures fast pickup allocations.
                </p>
              </div>
            </div>

            <button
              onClick={toggleTracking}
              className={`min-h-[40px] sm:min-h-[44px] px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 border shadow-md touch-manipulation ${
                isTracking
                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black border-transparent hover:opacity-95 shadow-emerald-500/20'
              }`}
            >
              {isTracking ? (
                <>
                  <X className="w-4 h-4" />
                  <span>Disable GPS Tracking</span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4" />
                  <span>Enable GPS Tracking</span>
                </>
              )}
            </button>
          </div>

          {/* Telemetry / Coordinate Details when active */}
          {currentCoords && (
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Coordinates</div>
                  <div className="text-slate-200 font-mono font-bold">
                    {currentCoords.latitude.toFixed(6)}°, {currentCoords.longitude.toFixed(6)}°
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">GPS Accuracy</div>
                  <div className="text-emerald-400 font-mono font-bold">
                    ±{Math.round(currentCoords.accuracy || 0)}m (High Accuracy)
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Last Server Sync</div>
                  <div className="text-slate-300 font-mono">
                    {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Syncing...'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error / Denial Warning Banner */}
          {gpsError && (
            <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold">{gpsError}</div>
                {trackingStatus === 'denied' && (
                  <div className="text-[11px] text-rose-400/80">
                    To enable live tracking, click the permissions/lock icon in your browser URL bar, change Location to "Allow", and click Enable GPS Tracking again.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Driver Payment UPI & Scannable QR Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 md:p-7 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/15 text-amber-400 border border-amber-400/30 flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-black text-white font-['Outfit']">
                  Your Direct Payment UPI & Scannable QR
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter your personal UPI ID (GPay / PhonePe / Paytm). Customers on your rides will scan this QR to pay you directly.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-2 border-t border-slate-800/80 items-center">
            {/* Input Form */}
            <div className="md:col-span-7 space-y-3">
              <form onSubmit={handleSaveUpi} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                    Your UPI ID / VPA
                  </label>
                  <div className="relative">
                    <input 
                      id="driver-upi-input"
                      type="text"
                      value={driverUpi}
                      onChange={(e) => setDriverUpi(e.target.value)}
                      placeholder="e.g. yourname@oksbi or 9845012345@paytm"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/50 transition-all pr-24"
                    />
                    <button
                      id="save-driver-upi-btn"
                      type="submit"
                      className={`absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        upiSaveSuccess
                          ? 'bg-emerald-500 text-slate-950 shadow-sm'
                          : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm'
                      }`}
                    >
                      {upiSaveSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Saved</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save UPI</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Works with Google Pay, PhonePe, Paytm, BHIM, CRED & all Indian banking UPI apps.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">Supported:</span>
                  <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-md">@oksbi</span>
                  <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-md">@okaxis</span>
                  <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-md">@ybl</span>
                  <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-md">@paytm</span>
                  <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-md">@ibl</span>
                </div>
              </form>
            </div>

            {/* Generated QR Code Preview */}
            <div className="md:col-span-5 flex flex-col sm:flex-row items-center gap-4 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
              <div className="w-28 h-28 bg-white p-1.5 rounded-xl border border-slate-200 flex items-center justify-center shrink-0 shadow-md">
                {driverUpi.trim() ? (
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${encodeURIComponent(driverUpi.trim())}&pn=${encodeURIComponent(driverUser?.name || "Driver Anna")}&cu=INR`)}`}
                    alt="Driver UPI QR"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <QrCode className="w-16 h-16 text-slate-400" />
                )}
              </div>
              <div className="space-y-1 text-center sm:text-left min-w-0 flex-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md inline-block">
                  Live QR Preview
                </span>
                <div className="text-xs font-bold text-white font-mono truncate max-w-full sm:max-w-[220px]">
                  {driverUpi.trim() || 'Enter UPI ID'}
                </div>
                <p className="text-[10px] text-slate-400">
                  When you are assigned, customers can scan this QR code to settle fare directly to you.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Trips & Past Trip Records */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                dutiesTab === 'active'
                  ? (acceptedTrips.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600')
                  : (pastTrips.length > 0 ? 'bg-amber-400' : 'bg-slate-600')
              }`} />
              <h2 className="text-base sm:text-lg font-extrabold text-white font-['Outfit']">
                {dutiesTab === 'active' ? 'Your Active Assigned Trips' : 'Your Past Trips History'}
              </h2>
            </div>

            {/* View Mode Toggle: Active vs Past Trips */}
            <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={() => setDutiesTab('active')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  dutiesTab === 'active'
                    ? 'bg-amber-400 text-slate-950 font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Active Duties ({acceptedTrips.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setDutiesTab('history');
                  fetchDuties({ includeHistory: true });
                }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  dutiesTab === 'history'
                    ? 'bg-amber-400 text-slate-950 font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Past Trips History ({pastTrips.length})
              </button>
            </div>
          </div>

          {dutiesError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold flex items-center justify-between">
              <span>⚠️ {dutiesError}</span>
              <button onClick={fetchDuties} className="underline hover:text-white cursor-pointer ml-2">Retry</button>
            </div>
          )}

          {dutiesTab === 'history' ? (
            isLoadingDuties && pastTrips.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 text-center space-y-2">
                <RefreshCw className="w-6 h-6 text-amber-400 mx-auto animate-spin" />
                <p className="text-xs text-slate-400">Loading your past trip records...</p>
              </div>
            ) : pastTrips.length === 0 ? (
              <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl p-6 text-center space-y-1.5">
                <Car className="w-7 h-7 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-slate-300">No Past Trips Found</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Completed and cancelled trip assignments for {driverUser?.name || 'Driver'} will appear here for historical reference.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pastTrips.map(trip => {
                  const isTripCancelled = String(trip.status || '').toLowerCase().includes('cancel');
                  return (
                    <div
                      key={trip.id}
                      className={`border-2 rounded-3xl p-4 sm:p-5 space-y-3 shadow-lg ${
                        isTripCancelled
                          ? 'bg-red-950/20 border-red-500/30'
                          : 'bg-emerald-950/20 border-emerald-500/30'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              {trip.id}
                            </span>
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              isTripCancelled
                                ? 'bg-red-400/20 text-red-300 border border-red-400/30'
                                : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                            }`}>
                              {isTripCancelled ? (
                                <>
                                  <X className="w-3 h-3 text-red-400" />
                                  <span>Trip Cancelled</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>Trip Completed</span>
                                </>
                              )}
                            </span>
                          </div>
                          <h3 className="text-base font-black text-white font-['Outfit'] mt-1">{trip.tripType}</h3>
                        </div>
                        <div className="text-lg font-black text-emerald-400 font-mono">{trip.payout}</div>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate"><strong className="text-slate-400 font-normal">Pickup:</strong> {trip.pickup}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate"><strong className="text-slate-400 font-normal">Drop:</strong> {trip.destination}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{trip.scheduledTime}</span>
                        </div>
                      </div>

                      {/* Customer Info (Authorized for driver) */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80 text-slate-400">
                        <span className="truncate">Customer: <strong className="text-slate-200">{trip.customerName}</strong></span>
                        <span className="font-mono text-[11px] text-slate-400">{trip.customerPhone}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <>
              {isLoadingDuties && acceptedTrips.length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 text-center space-y-2">
              <RefreshCw className="w-6 h-6 text-amber-400 mx-auto animate-spin" />
              <p className="text-xs text-slate-400">Loading your assigned duties...</p>
            </div>
          ) : acceptedTrips.length === 0 ? (
            <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl p-6 text-center space-y-1.5">
              <Car className="w-7 h-7 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-300">No Duties Assigned Yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                When dispatch admin accepts & assigns a customer booking to you ({driverUser?.name || 'Driver'}), it will appear here instantly.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {acceptedTrips.map(trip => (
                <div key={trip.id} className="bg-emerald-950/20 border-2 border-emerald-500/40 rounded-3xl p-4 sm:p-5 space-y-3 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {trip.id}
                        </span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          String(trip.status || '').toLowerCase() === 'in progress'
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                            : String(trip.status || '').toLowerCase() === 'arrived'
                            ? 'bg-blue-400/20 text-blue-300 border border-blue-400/30'
                            : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                        }`}>
                          {String(trip.status || '').toLowerCase() === 'in progress'
                            ? 'Ride In Progress'
                            : String(trip.status || '').toLowerCase() === 'arrived'
                            ? 'Arrived at Pickup'
                            : 'Assigned to You'}
                        </span>
                      </div>
                      <h3 className="text-base font-black text-white font-['Outfit'] mt-1">{trip.tripType}</h3>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                      <SOSButton trip={trip} />
                      <div className="text-lg font-black text-emerald-400 font-mono">{trip.payout}</div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-amber-400 font-bold border-b border-slate-800/80 pb-1">
                      <span>Assigned Driver: {trip.assignedDriver || driverUser?.name || 'You'}</span>
                      <span className="text-slate-400 font-normal">{trip.scheduledTime}</span>
                    </div>
                    <div className="break-words"><strong>Customer:</strong> {trip.customerName} {trip.customerPhone ? `(${trip.customerPhone})` : ''}</div>
                    <div className="break-words"><strong>Pickup:</strong> {trip.pickup}</div>
                    <div className="break-words"><strong>Destination:</strong> {trip.destination}</div>
                    <div><strong>Vehicle:</strong> {trip.carModel}</div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                    <a 
                      href={`tel:${trip.customerPhone || SUPPORT_HELPLINE}`}
                      className="w-full sm:w-auto py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700 min-h-[44px] touch-manipulation"
                      title="Call Customer"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Call Customer</span>
                    </a>

                    {String(trip.status || '').toLowerCase() === 'in progress' ? (
                      <button
                        onClick={() => handleOpenSettlement(trip)}
                        className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-xs transition-all shadow-md shadow-emerald-500/20 hover:scale-[1.02] cursor-pointer text-center flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation"
                      >
                        <Check className="w-4 h-4" />
                        <span>End Ride & Settle Fare</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartTrip(trip.bookingId || trip.id)}
                        disabled={startingTripId === (trip.bookingId || trip.id)}
                        className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20 hover:scale-[1.02] cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation"
                      >
                        {startingTripId === (trip.bookingId || trip.id) ? 'Starting Trip...' : 'Start Trip'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
            </>
          )}
        </div>

        {/* Live Available Bangalore Duties */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white font-['Outfit']">
                Available Bengaluru Customer Duties
              </h2>
              <p className="text-xs text-slate-400">
                Live customer bookings waiting for an Anna to accept
              </p>
            </div>
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{availableDuties.length} Duties Available</span>
            </div>
          </div>

          {availableDuties.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">All Current Duties Claimed!</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Keep your duty status set to ONLINE. New Bangalore trips will pop up automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {availableDuties.map(duty => (
                <div 
                  key={duty.id}
                  className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 space-y-4 transition-all shadow-md flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {duty.id}
                      </span>
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                        {duty.urgency}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-black text-white font-['Outfit'] group-hover:text-emerald-400 transition-colors">
                        {duty.tripType}
                      </h3>
                      <div className="text-lg font-black text-emerald-400 font-mono mt-1">
                        {duty.payout}
                      </div>
                    </div>

                    {/* Duty Specs */}
                    <div className="space-y-2 text-xs text-slate-300 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <span className="text-slate-500 text-[10px] block uppercase font-bold">Pickup</span>
                          <span className="font-semibold text-slate-200 break-words">{duty.pickup}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 pt-1.5 border-t border-slate-800/60">
                        <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <span className="text-slate-500 text-[10px] block uppercase font-bold">Drop / Stops</span>
                          <span className="font-semibold text-slate-200 break-words">{duty.destination}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/60 text-[11px] text-slate-400">
                        <span><Clock className="w-3 h-3 inline mr-1 text-amber-400" />{duty.scheduledTime}</span>
                        <span><Car className="w-3 h-3 inline mr-1 text-slate-400" />{duty.carModel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Accept Button */}
                  <button
                    onClick={() => handleAcceptDuty(duty)}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2 min-h-[44px] touch-manipulation"
                  >
                    <SteeringWheel className="w-4 h-4 stroke-[2.2]" />
                    <span>Accept Duty (Anna)</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Verification Badges & Fleet Helpline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-2">
          
          {/* Verification Status Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Verified Documents & Clearances</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center gap-2 text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Driving License (Active)</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center gap-2 text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Police Clearance (Passed)</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center gap-2 text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Aadhaar KYC (Verified)</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center gap-2 text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Commercial Accident Cover</span>
              </div>
            </div>
          </div>

          {/* Fleet Dispatcher Hotline */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-400" />
                <span>24/7 Fleet Dispatcher Support</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Facing route issues, customer delay, or emergency? Contact our Bengaluru control room immediately.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-2">
              <a
                href={`https://wa.me/${SUPPORT_HELPLINE.replace(/[^0-9]/g, '')}?text=${encodeURIComponent("Hi Dispatch, this is Driver Anna. Need assistance with duty.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg"
              >
                <WhatsAppIcon className="w-4 h-4 fill-white" />
                <span>WhatsApp Dispatch</span>
              </a>

              <a 
                href={`tel:${SUPPORT_HELPLINE}`}
                className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 border border-slate-700"
              >
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>Call SOS</span>
              </a>
            </div>
          </div>

        </div>
          </>
        )}

        {/* Driver Ride Settlement Modal with Customer UPI QR Code */}
        {settlementTrip && (() => {
          const settlementNumericFare = Number(settlementTrip.payout?.replace(/[^0-9]/g, '')) || 749;
          const effectiveDriverUpi = (driverUpi || driverUser?.upiId || '').trim();
          const hasValidSettlementUpi = isValidUpi(effectiveDriverUpi);
          const settlementUpiData = hasValidSettlementUpi
            ? `upi://pay?pa=${encodeURIComponent(effectiveDriverUpi)}&pn=${encodeURIComponent(driverUser?.name || 'Driver Anna')}&am=${settlementNumericFare}&cu=INR&tn=${encodeURIComponent('Driver Anna Trip ' + settlementTrip.id)}`
            : '';
          const settlementQrUrl = hasValidSettlementUpi
            ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(settlementUpiData)}`
            : '';

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden touch-none overscroll-contain">
              <div 
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm touch-none overscroll-contain"
                onClick={() => setSettlementTrip(null)}
                onTouchMove={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              />
              <div className="relative bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto overscroll-contain touch-pan-y p-5 sm:p-6 shadow-2xl z-10 space-y-4 animate-in zoom-in-95 duration-200 text-slate-100">
                
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-white font-['Outfit']">End Ride & Settle Fare</h3>
                      <p className="text-[10px] text-slate-400 font-mono">Trip #{settlementTrip.id}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSettlementTrip(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                    aria-label="Close settlement modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Trip Recap */}
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Customer:</span>
                    <strong className="text-white">{settlementTrip.customerName}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 shrink-0">Route:</span>
                    <span className="text-slate-200 truncate text-right flex-1 min-w-0" title={`${settlementTrip.pickup} ➔ ${settlementTrip.destination}`}>
                      {settlementTrip.pickup} ➔ {settlementTrip.destination}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="font-bold text-slate-300">Total Driver Payout:</span>
                    <span className="text-xl font-black text-emerald-400 font-mono">₹{settlementNumericFare}</span>
                  </div>
                </div>

                {/* Fare Collection Options Toggle */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    Select Fare Collection Method:
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button 
                      type="button"
                      onClick={() => {
                        if (hasValidSettlementUpi) setSettlementMethod('online');
                      }}
                      disabled={!hasValidSettlementUpi}
                      className={`p-3 rounded-xl border flex flex-col items-start gap-1 transition-all text-left ${
                        !hasValidSettlementUpi
                          ? 'opacity-40 cursor-not-allowed bg-slate-950/60 border-slate-800 text-slate-500'
                          : settlementMethod === 'online'
                          ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-md shadow-emerald-500/10 cursor-pointer'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                        <QrCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>UPI QR Code</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {hasValidSettlementUpi ? 'Customer scans & pays' : 'No UPI ID configured'}
                      </p>
                    </button>

                    <button 
                      type="button"
                      onClick={() => setSettlementMethod('cash')}
                      className={`p-3 rounded-xl border flex flex-col items-start gap-1 transition-all cursor-pointer text-left ${
                        settlementMethod === 'cash' || !hasValidSettlementUpi
                          ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                        <DollarSign className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Cash Payment</span>
                      </div>
                      <p className="text-[10px] text-slate-400">Paid directly to Anna</p>
                    </button>
                  </div>
                </div>

                {/* Dynamic QR Code Display for Customer Payment */}
                {settlementMethod === 'online' && hasValidSettlementUpi ? (
                  <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-4 text-center space-y-3 shadow-lg shadow-black/40">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Customer Scan & Pay</span>
                      </span>
                      <span className="text-[11px] font-mono font-black text-white bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        ₹{settlementNumericFare}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-tight">
                      Show this QR code to <strong className="text-slate-200">{settlementTrip.customerName}</strong>. Works with Google Pay, PhonePe, Paytm & BHIM.
                    </p>

                    {/* Scannable High-Contrast QR Code Card */}
                    <div className="bg-white p-3.5 rounded-2xl inline-block shadow-2xl border-4 border-slate-800">
                      <img 
                        src={settlementQrUrl}
                        alt="Customer UPI Payment QR"
                        id="driver-settlement-qr-img"
                        className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-lg mx-auto"
                      />
                      <div className="pt-2 border-t border-slate-200 mt-2 flex items-center justify-center gap-1 text-[10px] font-extrabold text-slate-800">
                        <span>UPI QR</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-emerald-700">Instant Driver Settlement</span>
                      </div>
                    </div>

                    {/* Driver VPA / UPI ID Badge with Copy Option */}
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                      <div className="text-left truncate">
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Settlement VPA</span>
                        <span className="font-mono text-emerald-400 font-bold text-xs truncate block">{effectiveDriverUpi}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyUpi(effectiveDriverUpi)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 cursor-pointer shrink-0 transition-colors"
                      >
                        {copiedUpi ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy UPI</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Accepted App Pills */}
                    <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1 text-[9px] text-slate-400 font-semibold">
                      <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">GPay</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">PhonePe</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">Paytm</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">BHIM</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">CRED</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!hasValidSettlementUpi && (
                      <div className="bg-amber-950/25 border border-amber-500/30 rounded-2xl p-3 text-center space-y-1 animate-in fade-in">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-300">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Online UPI Settlement Unavailable</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          No UPI ID is configured for this driver account. Please collect cash directly, or configure a UPI ID in your driver portal.
                        </p>
                      </div>
                    )}

                    <div className="bg-slate-950 border border-amber-500/40 rounded-2xl p-4 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-amber-400 font-bold">
                        <DollarSign className="w-4 h-4" />
                        <span>Direct Cash Handover</span>
                      </div>
                      <p className="text-slate-300 text-xs leading-relaxed">
                        Please collect <strong className="text-white font-mono">₹{settlementNumericFare}</strong> in cash directly from <strong className="text-white">{settlementTrip.customerName}</strong> before concluding this ride duty.
                      </p>
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-[11px] text-amber-200">
                        ✓ No commission deduction. 100% of the cash fare belongs to Anna.
                      </div>
                    </div>
                  </div>
                )}

                {/* Confirm buttons */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSettlementTrip(null)}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer min-h-[44px] flex items-center justify-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    id="confirm-settlement-btn"
                    onClick={handleConfirmSettlement}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] touch-manipulation"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {settlementMethod === 'online' 
                        ? `Payment Received & Complete Trip` 
                        : `Confirm Cash Collected (₹${settlementNumericFare})`}
                    </span>
                  </button>
                </div>

              </div>
            </div>
          );
        })()}

      </main>

    </div>
  );
}
