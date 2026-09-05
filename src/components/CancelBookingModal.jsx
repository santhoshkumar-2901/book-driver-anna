// src/components/CancelBookingModal.jsx
import React, { useState } from 'react';
import { 
  X, Search, Ban, AlertCircle, CheckCircle2, Calendar, 
  Clock, MapPin, User, Phone, 
  Car, GraduationCap, ArrowRight, ShieldCheck, RefreshCw, KeyRound 
} from 'lucide-react';
import { SteeringWheel, WhatsAppIcon } from './Icons';
import { toDDMMYYYY } from '../utils/dateUtils';
import { useScrollLock } from '../utils/useScrollLock';
import { apiClient } from '../services/apiClient';

const CANCELLATION_REASONS = [
  'Change of travel plans',
  'Found alternative transportation',
  'Booked by mistake / duplicate booking',
  'Date & time scheduling conflict',
  'Personal emergency',
  'Other reason'
];

export default function CancelBookingModal({ isOpen, onClose }) {
  useScrollLock(isOpen);
  const [bookingIdInput, setBookingIdInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Active booking to cancel
  const [selectedBookingToCancel, setSelectedBookingToCancel] = useState(null);
  const [cancellationReason, setCancellationReason] = useState(CANCELLATION_REASONS[0]);
  const [cancelSuccess, setCancelSuccess] = useState(null);

  if (!isOpen) return null;

  // Secure Lookup: Requires BOTH Booking ID and Registered Phone Number to prevent IDOR
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setSearchError('');
    setSearchResults(null);
    setSelectedBookingToCancel(null);

    const bId = bookingIdInput.trim();
    const phone = phoneInput.trim();

    if (!bId) {
      setSearchError('Please enter your Booking ID (e.g. BDA-DRV-9801).');
      return;
    }

    if (!phone || phone.replace(/[^0-9]/g, '').length < 10) {
      setSearchError('Please enter your registered 10-digit mobile number.');
      return;
    }

    setIsSearching(true);

    try {
      // 1. Try Backend API first
      const res = await apiClient.lookupBooking(bId, phone);
      if (res && res.data && res.data.booking) {
        const b = res.data.booking;
        setSearchResults([{
          refId: b.id,
          customerName: b.customer_name,
          phone: b.customer_phone,
          serviceLabel: b.service_name || 'Driver Service',
          serviceCategory: b.booking_type,
          displayDate: b.date,
          displayTime: b.time,
          location: b.pickup_area,
          status: b.status,
          fare: b.calculated_fare
        }]);
        setIsSearching(false);
        return;
      }
    } catch (err) {
      // If 404 from server, check local fallback
      if (err.status === 404) {
        // Continue to local check
      } else if (err.code !== 'NETWORK_ERROR') {
        setSearchError(err.message || 'Error looking up booking.');
        setIsSearching(false);
        return;
      }
    }

    // 2. Local fallback check with strict ID + Phone verification
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
    const matched = [];

    const checkLists = [
      { key: 'bda_driver_bookings', cat: 'driver', label: 'Driver Service' },
      { key: 'bda_vehicle_bookings', cat: 'vehicle', label: 'Vehicle Rental' },
      { key: 'bda_class_enrollments', cat: 'class', label: 'Car Driving Class' }
    ];

    for (const item of checkLists) {
      try {
        const list = JSON.parse(localStorage.getItem(item.key) || '[]');
        for (const b of list) {
          const id = (b.id || b.enrollmentId || '').trim();
          const p = (b.phone || b.customerPhone || b.mobileNumber || '').replace(/[^0-9]/g, '').slice(-10);
          if (id.toLowerCase() === bId.toLowerCase() && p === cleanPhone) {
            matched.push({
              refId: id,
              customerName: b.customerName || b.fullName,
              phone: b.phone || b.mobileNumber,
              serviceLabel: b.tripTitle || b.serviceName || b.vehicleName || b.courseName || item.label,
              serviceCategory: item.cat,
              displayDate: b.date || b.bookingDate || b.startDate || b.preferredStartDate,
              displayTime: b.time || b.bookingTime || b.preferredTime || '',
              location: b.pickupArea || b.address || 'Bengaluru',
              status: b.status || 'Pending',
              fare: b.fare || b.totalPrice || b.courseFee
            });
          }
        }
      } catch (e) {}
    }

    setIsSearching(false);
    if (matched.length > 0) {
      setSearchResults(matched);
    } else {
      setSearchError('No booking found matching this Booking ID and Phone Number combination.');
    }
  };

  // Perform Cancellation
  const handleConfirmCancel = async () => {
    if (!selectedBookingToCancel) return;

    const refId = selectedBookingToCancel.refId;
    const phone = phoneInput.trim() || selectedBookingToCancel.phone;
    setIsCancelling(true);

    try {
      // 1. Call Backend API
      await apiClient.cancelBooking(refId, phone, cancellationReason).catch(() => {});
    } catch (e) {
      // Ignore network fallback error
    }

    // 2. Synchronize local storage lists
    const checkLists = ['bda_driver_bookings', 'bda_vehicle_bookings', 'bda_class_enrollments'];
    for (const key of checkLists) {
      try {
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const updated = existing.map(b => {
          if ((b.id === refId) || (b.enrollmentId === refId)) {
            return { ...b, status: 'CANCELLED', cancelReason: cancellationReason };
          }
          return b;
        });
        localStorage.setItem(key, JSON.stringify(updated));
      } catch (e) {}
    }

    // Dispatch global event for Admin and Pass modals to sync
    window.dispatchEvent(new CustomEvent('bda_order_created'));

    setCancelSuccess({
      refId,
      serviceLabel: selectedBookingToCancel.serviceLabel,
      customerName: selectedBookingToCancel.customerName,
      customerPhone: selectedBookingToCancel.phone,
      reason: cancellationReason
    });

    if (searchResults) {
      setSearchResults(prev => prev.map(item => item.refId === refId ? { ...item, status: 'CANCELLED' } : item));
    }

    setSelectedBookingToCancel(null);
    setIsCancelling(false);
  };

  const handleClose = () => {
    setBookingIdInput('');
    setPhoneInput('');
    setSearchResults(null);
    setSearchError('');
    setSelectedBookingToCancel(null);
    setCancelSuccess(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl overflow-hidden shadow-xl z-10 flex flex-col max-h-[92dvh] sm:max-h-[90vh] animate-in zoom-in-95 duration-150 text-slate-100 my-auto">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20 shrink-0">
              <Ban className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white font-['Outfit'] flex items-center gap-2 truncate">
                Cancel or Modify Booking
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                Verified booking lookup with zero cancellation penalty
              </p>
            </div>
          </div>

          <button 
            onClick={handleClose}
            className="text-slate-400 hover:text-white p-1.5 sm:p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar flex-1">

          {/* Success Banner */}
          {cancelSuccess && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl space-y-2 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-red-400 shrink-0" />
                <span>Booking Cancelled Successfully</span>
              </div>
              <p className="text-xs text-slate-300">
                Your <span className="font-semibold text-white">{cancelSuccess.serviceLabel}</span> (Ref: <span className="font-mono text-amber-300 font-bold">{cancelSuccess.refId}</span>) has been cancelled. No cancellation fees apply.
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <a
                  href={`https://api.whatsapp.com/send?phone=919886012345&text=${encodeURIComponent(`Hello Book Driver Anna, I have cancelled my booking (${cancelSuccess.refId}) due to: ${cancelSuccess.reason}. Please confirm.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5 fill-current" />
                  <span>Notify Support via WhatsApp</span>
                </a>
                <button
                  onClick={() => setCancelSuccess(null)}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Secure Search Form */}
          <form onSubmit={handleSearch} className="space-y-3 bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Verify Booking Ownership to Cancel:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400">Booking ID *</label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. BDA-DRV-9801"
                    value={bookingIdInput}
                    onChange={(e) => setBookingIdInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-400 font-mono uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400">Registered Phone *</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile number"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-400 font-mono"
                  />
                </div>
              </div>
            </div>

            {searchError && (
              <div className="text-xs text-red-400 flex items-center gap-1.5 font-semibold">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{searchError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSearching}
              className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-red-600/20"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying Booking...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Find & Verify Booking</span>
                </>
              )}
            </button>
          </form>

          {/* Cancellation Confirmation Dialog Prompt */}
          {selectedBookingToCancel && (
            <div className="p-4 bg-slate-950 border-2 border-red-500/40 rounded-2xl space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Confirm Cancellation for {selectedBookingToCancel.refId}
                </span>
                <button 
                  onClick={() => setSelectedBookingToCancel(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Back
                </button>
              </div>

              <div className="text-xs text-slate-300 space-y-1 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Service:</span>
                  <span className="font-bold text-white">{selectedBookingToCancel.serviceLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <span className="font-semibold text-white">{selectedBookingToCancel.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Schedule:</span>
                  <span className="font-semibold text-amber-400">{toDDMMYYYY(selectedBookingToCancel.displayDate)} @ {selectedBookingToCancel.displayTime}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Please select reason for cancellation:
                </label>
                <select
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-400"
                >
                  {CANCELLATION_REASONS.map((reason, idx) => (
                    <option key={idx} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedBookingToCancel(null)}
                  className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                >
                  Keep Booking
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={isCancelling}
                  className="py-2 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow-lg shadow-red-500/20 disabled:opacity-50"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>{isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Search Result Display */}
          {searchResults && searchResults.length > 0 && !selectedBookingToCancel && (
            <div className="space-y-3 animate-in fade-in">
              <div className="text-xs font-bold text-slate-400">
                Verified Booking Found:
              </div>

              {searchResults.map((item) => (
                <div 
                  key={item.refId}
                  className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-400">{item.refId}</span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          (item.status || '').toLowerCase() === 'cancelled'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                            : (item.status || '').toLowerCase() === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}>
                          {item.status || 'Active'}
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-sm mt-1">{item.serviceLabel}</h4>
                    </div>

                    {(item.status || '').toLowerCase() !== 'cancelled' && (item.status || '').toLowerCase() !== 'completed' ? (
                      <button
                        onClick={() => setSelectedBookingToCancel(item)}
                        className="py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500 italic">No action needed</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{toDDMMYYYY(item.displayDate)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{item.displayTime || 'Morning Slot'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      <span className="truncate">{item.location}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 text-center shrink-0">
          <p className="text-xs text-slate-400">
            Need urgent assistance? Call Anna 24/7 Helpline: <a href="tel:+919876543210" className="text-amber-400 font-bold hover:underline">+91 98765 43210</a>
          </p>
        </div>

      </div>
    </div>
  );
}
