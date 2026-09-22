import React, { useState, useEffect, useCallback } from 'react';
import { 
  Car, ShieldCheck, CheckCircle2, MapPin, Phone, LogOut, ArrowUpRight, 
  DollarSign, TrendingUp, Calendar, Clock, Award, AlertCircle, Check, X, 
  ChevronRight, RefreshCw, Power, QrCode, Smartphone, Sparkles, Save, Edit2, Copy
} from 'lucide-react';
import { SteeringWheel, WhatsAppIcon } from '../components/Icons';
import useScrollLock from '../utils/useScrollLock';
import { broadcastBookingUpdate, onBookingUpdate } from '../utils/broadcastSync';
import { 
  isDutyAssignedToDriver, 
  isDutyAssignedToOtherDriver, 
  formatDuty, 
  getDriverDuties 
} from '../utils/driverDutyHelpers';
import { SUPPORT_HELPLINE } from '../data/mockData';
import SOSButton from '../components/SOSButton';

export { isDutyAssignedToDriver, isDutyAssignedToOtherDriver, formatDuty, getDriverDuties };

export default function DriverPortalPage({ 
  driverUser, 
  onLogout 
}) {
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
  const [acceptedTrips, setAcceptedTrips] = useState(() => {
    return getDriverDuties(driverUser).myAssigned;
  });
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
    return 'anna.driver@oksbi';
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
    if (!cleanUpi || !cleanUpi.includes('@')) {
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

  const [availableDuties, setAvailableDuties] = useState(() => {
    return getDriverDuties(driverUser).openPool;
  });

  // Real-time synchronization when admin assigns or modifies bookings across tabs and windows
  useEffect(() => {
    const reloadDuties = (payload) => {
      const { myAssigned, openPool } = getDriverDuties(driverUser);
      setAcceptedTrips(myAssigned);
      setAvailableDuties(openPool);

      // Notify if a duty was just assigned to THIS driver by admin
      if (payload && (payload.bookingId || payload.id)) {
        const currentDriver = driverUser || (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('bda_driver_user') || 'null') : null) || {};
        if (isDutyAssignedToDriver(payload, currentDriver)) {
          setToastMessage(`🔔 New Trip Assigned! Duty #${payload.bookingId || payload.id} has been assigned to you by Dispatch Admin.`);
          setTimeout(() => setToastMessage(null), 6000);
        }
      }
    };

    const unsubscribe = onBookingUpdate(reloadDuties);
    window.addEventListener('storage', reloadDuties);
    window.addEventListener('bda_booking_updated', reloadDuties);
    window.addEventListener('bda_order_created', reloadDuties);

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener('storage', reloadDuties);
      window.removeEventListener('bda_booking_updated', reloadDuties);
      window.removeEventListener('bda_order_created', reloadDuties);
    };
  }, [driverUser]);

  const handleAcceptDuty = (duty) => {
    if (!isOnline) {
      setToastMessage("Please switch your duty status to ONLINE to accept trips.");
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const currentDriver = driverUser || (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('bda_driver_user') || 'null') : null) || {};
    const acceptedDuty = { 
      ...duty, 
      status: 'Assigned',
      assignedDriver: currentDriver.name || 'Driver Assigned',
      assignedDriverPhone: currentDriver.phone || '',
      assignedDriverUpi: driverUpi || currentDriver.upiId || ''
    };

    // Update persistent bda_driver_bookings
    try {
      const savedBookings = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
      const updated = savedBookings.map(b => (b.id === duty.id || b.bookingId === duty.id) ? {
        ...b,
        status: 'Assigned',
        assignedDriver: currentDriver.name || 'Driver Assigned',
        assignedDriverPhone: currentDriver.phone || '',
        assignedDriverUpi: driverUpi || currentDriver.upiId || ''
      } : b);
      localStorage.setItem('bda_driver_bookings', JSON.stringify(updated));
    } catch (e) {}

    broadcastBookingUpdate({
      bookingId: duty.id,
      status: 'Assigned',
      assignedDriver: currentDriver.name,
      assignedDriverPhone: currentDriver.phone,
      assignedDriverUpi: driverUpi || currentDriver.upiId
    });

    setAcceptedTrips(prev => [acceptedDuty, ...prev.filter(d => d.id !== duty.id)]);
    setAvailableDuties(prev => prev.filter(d => d.id !== duty.id));
    setToastMessage(`✓ Duty ${duty.id} accepted! Customer ${duty.customerName} notified that Anna is on the way.`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleStartTrip = (tripId) => {
    setAcceptedTrips(prev => prev.map(t => t.id === tripId ? { ...t, status: 'In Progress' } : t));

    // Update persistent bda_driver_bookings
    try {
      const savedBookings = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
      const updated = savedBookings.map(b => (b.id === tripId || b.bookingId === tripId) ? { ...b, status: 'In Progress' } : b);
      localStorage.setItem('bda_driver_bookings', JSON.stringify(updated));
    } catch (e) {}

    broadcastBookingUpdate({ bookingId: tripId, status: 'In Progress' });
    setToastMessage(`🚗 Trip ${tripId} started! Meter is running.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleConfirmSettlement = () => {
    if (!settlementTrip) return;
    const numericFare = Number(settlementTrip.payout.replace(/[^0-9]/g, '')) || 749;

    setTodayEarnings(prev => prev + numericFare);
    setLifetimeTrips(prev => prev + 1);

    // Update persistent bda_driver_bookings
    try {
      const savedBookings = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
      const updated = savedBookings.map(b => (b.id === settlementTrip.id || b.bookingId === settlementTrip.id) ? { ...b, status: 'Completed' } : b);
      localStorage.setItem('bda_driver_bookings', JSON.stringify(updated));
    } catch (e) {}

    broadcastBookingUpdate({ bookingId: settlementTrip.id, status: 'Completed' });

    // Notify customer app via CustomEvent
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bda_ride_completed', {
        detail: {
          id: settlementTrip.id,
          driverName: driverUser?.name || "Driver Assigned",
          driverPhone: driverUser?.phone || SUPPORT_HELPLINE,
          driverRating: driverUser?.rating || 5.0,
          carModel: settlementTrip.carModel,
          pickupArea: settlementTrip.pickup,
          dropLocation: settlementTrip.destination,
          distance: settlementTrip.distance,
          totalFare: numericFare,
          settlementMethod
        }
      }));
    }

    setAcceptedTrips(prev => prev.filter(t => t.id !== settlementTrip.id));
    setToastMessage(`✓ Trip ${settlementTrip.id} completed! Payout of ${settlementTrip.payout} recorded.`);
    setSettlementTrip(null);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleOpenSettlement = (trip) => {
    setSettlementTrip(trip);
    setSettlementMethod('online');
    const numericFare = Number(trip.payout?.replace(/[^0-9]/g, '')) || 749;
    const activeUpi = (driverUpi || driverUser?.upiId || '').trim() || 'anna.driver@oksbi';

    broadcastBookingUpdate({
      bookingId: trip.id,
      status: 'Fare Settlement',
      assignedDriver: driverUser?.name || 'Driver Assigned',
      assignedDriverPhone: driverUser?.phone || '',
      assignedDriverUpi: activeUpi,
      driverUpi: activeUpi,
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
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md max-w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 shrink-0">
              <SteeringWheel className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-sm sm:text-lg text-white font-['Outfit'] leading-none truncate">
                Book Driver <span className="text-emerald-400">Anna</span>
              </div>
              <div className="text-[9px] sm:text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5 truncate">
                <Award className="w-2.5 h-2.5 inline shrink-0" /> Driver Portal
              </div>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            
            {/* Online/Offline Duty Toggle Button */}
            <button
              onClick={handleToggleOnline}
              className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer border shadow-sm ${
                isOnline
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
              title={isOnline ? "Click to go Offline" : "Click to go Online"}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="p-1.5 sm:p-2 rounded-xl text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0"
              title="Driver Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">Sign Out</span>
            </button>

          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Welcome Driver Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden shadow-xl">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 font-black text-xl sm:text-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              {driverUser?.name ? driverUser.name.charAt(0).toUpperCase() : 'M'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-white font-['Outfit'] tracking-tight truncate">
                  Namaskara, Anna {driverUser?.name || 'Partner'}!
                </h1>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0 inline-flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Verified Fleet Anna</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                <span>DL: <strong className="text-slate-200 font-mono">{driverUser?.dlNumber || 'KA-04-2021-0098745'}</strong></span>
                <span>•</span>
                <span>Hub: <strong className="text-amber-400">{driverUser?.area || 'Indiranagar & Central'}</strong></span>
                <span>•</span>
                <span>Rating: <strong className="text-emerald-400 font-extrabold">★ {driverUser?.rating || '4.98'}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Today's Earnings</div>
              <div className="text-base font-extrabold text-emerald-400 font-mono mt-0.5">
                ₹{todayEarnings}
              </div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Lifetime Trips</div>
              <div className="text-base font-extrabold text-white font-mono mt-0.5">
                {lifetimeTrips}
              </div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl text-center col-span-2 sm:col-span-1">
              <div className="text-[10px] uppercase font-bold text-slate-400">Next Payout</div>
              <div className="text-xs font-bold text-amber-400 mt-1">
                Monday (Direct Bank)
              </div>
            </div>
          </div>
        </div>

        {/* Driver Payment UPI & Auto-Generated QR Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/15 text-amber-400 border border-amber-400/30 flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-white font-['Outfit'] flex items-center gap-2">
                  <span>Your Direct Payment UPI & Scannable QR</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Auto Generated
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
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
              <div className="space-y-1 text-center sm:text-left min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md inline-block">
                  Live QR Preview
                </span>
                <div className="text-xs font-bold text-white font-mono truncate max-w-[170px]">
                  {driverUpi.trim() || 'Enter UPI ID'}
                </div>
                <p className="text-[10px] text-slate-400">
                  When you are assigned, customers can scan this QR code to settle fare directly to you.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Active Assigned Trips (Duties assigned to this driver by admin or accepted) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${acceptedTrips.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              <h2 className="text-base sm:text-lg font-extrabold text-white font-['Outfit']">Your Active Assigned Trips</h2>
            </div>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
              acceptedTrips.length > 0
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-extrabold'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}>
              {acceptedTrips.length} Assigned
            </span>
          </div>

          {acceptedTrips.length === 0 ? (
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
                <div key={trip.id} className="bg-emerald-950/20 border-2 border-emerald-500/40 rounded-3xl p-5 space-y-3 shadow-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {trip.id}
                        </span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          trip.status === 'In Progress'
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                            : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                        }`}>
                          {trip.status === 'In Progress' ? 'Ride In Progress' : 'Assigned to You'}
                        </span>
                      </div>
                      <h3 className="text-base font-black text-white font-['Outfit'] mt-1">{trip.tripType}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <SOSButton trip={trip} />
                      <div className="text-lg font-black text-emerald-400 font-mono">{trip.payout}</div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between text-[11px] text-amber-400 font-bold border-b border-slate-800/80 pb-1">
                      <span>Assigned Driver: {trip.assignedDriver || driverUser?.name || 'You'}</span>
                      <span className="text-slate-400 font-normal">{trip.scheduledTime}</span>
                    </div>
                    <div><strong>Customer:</strong> {trip.customerName} {trip.customerPhone ? `(${trip.customerPhone})` : ''}</div>
                    <div><strong>Pickup:</strong> {trip.pickup}</div>
                    <div><strong>Destination:</strong> {trip.destination}</div>
                    <div><strong>Vehicle:</strong> {trip.carModel}</div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                    <a 
                      href={`tel:${trip.customerPhone || SUPPORT_HELPLINE}`}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                      title="Call Customer"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Call Customer</span>
                    </a>

                    {trip.status !== 'In Progress' ? (
                      <button
                        onClick={() => handleStartTrip(trip.id)}
                        className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20 hover:scale-[1.02] cursor-pointer text-center"
                      >
                        Start Trip (Run Meter)
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenSettlement(trip)}
                        className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-xs transition-all shadow-md shadow-emerald-500/20 hover:scale-[1.02] cursor-pointer text-center flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>End Ride & Settle Fare</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
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
                        <div>
                          <span className="text-slate-500 text-[10px] block uppercase font-bold">Pickup</span>
                          <span className="font-semibold text-slate-200">{duty.pickup}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 pt-1.5 border-t border-slate-800/60">
                        <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-slate-500 text-[10px] block uppercase font-bold">Drop / Stops</span>
                          <span className="font-semibold text-slate-200">{duty.destination}</span>
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
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
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
            <div className="grid grid-cols-2 gap-3 text-xs">
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
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://wa.me/918025550199?text=Hi%20Dispatch%2C%20this%20is%20Driver%20Anna.%20Need%20assistance%20with%20duty."
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg"
              >
                <WhatsAppIcon className="w-4 h-4 fill-white" />
                <span>WhatsApp Dispatch</span>
              </a>

              <a 
                href="tel:+918025550199"
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center gap-1.5 border border-slate-700"
              >
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>Call SOS</span>
              </a>
            </div>
          </div>

        </div>

        {/* Driver Ride Settlement Modal with Customer UPI QR Code */}
        {settlementTrip && (() => {
          const settlementNumericFare = Number(settlementTrip.payout?.replace(/[^0-9]/g, '')) || 749;
          const effectiveDriverUpi = (driverUpi || driverUser?.upiId || '').trim() || 'anna.driver@oksbi';
          const settlementUpiData = `upi://pay?pa=${encodeURIComponent(effectiveDriverUpi)}&pn=${encodeURIComponent(driverUser?.name || 'Driver Anna')}&am=${settlementNumericFare}&cu=INR&tn=${encodeURIComponent('Driver Anna Trip ' + settlementTrip.id)}`;
          const settlementQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(settlementUpiData)}`;

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
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Route:</span>
                    <span className="text-slate-200 truncate max-w-[200px]">{settlementTrip.pickup} ➔ {settlementTrip.destination}</span>
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
                      onClick={() => setSettlementMethod('online')}
                      className={`p-3 rounded-xl border flex flex-col items-start gap-1 transition-all cursor-pointer text-left ${
                        settlementMethod === 'online'
                          ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                        <QrCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>UPI QR Code</span>
                      </div>
                      <p className="text-[10px] text-slate-400">Customer scans & pays</p>
                    </button>

                    <button 
                      type="button"
                      onClick={() => setSettlementMethod('cash')}
                      className={`p-3 rounded-xl border flex flex-col items-start gap-1 transition-all cursor-pointer text-left ${
                        settlementMethod === 'cash'
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
                {settlementMethod === 'online' ? (
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
                )}

                {/* Confirm buttons */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSettlementTrip(null)}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    id="confirm-settlement-btn"
                    onClick={handleConfirmSettlement}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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
