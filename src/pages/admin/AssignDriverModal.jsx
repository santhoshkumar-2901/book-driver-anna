import React, { useState, useEffect } from 'react';
import { User, Phone, CheckCircle2, AlertCircle, X, ArrowRight, ShieldCheck, Car, ChevronRight } from 'lucide-react';
import { SteeringWheel } from '../../components/Icons';
import { useScrollLock } from '../../utils/useScrollLock';

export default function AssignDriverModal({
  isOpen,
  booking,
  onClose,
  onConfirm,
  registeredDrivers = [],
  initialDriverName = '',
  initialDriverPhone = ''
}) {
  useScrollLock(isOpen);

  const [step, setStep] = useState('input'); // 'input' | 'confirm'
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [selectedRegisteredId, setSelectedRegisteredId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Sync state whenever modal opens or booking changes
  useEffect(() => {
    if (isOpen && booking) {
      const existingName = (initialDriverName && initialDriverName !== 'Driver Assigned' && initialDriverName !== 'Driver Assigned on Dispatch')
        ? initialDriverName
        : (booking.assignedDriver && booking.assignedDriver !== 'Driver Assigned' && booking.assignedDriver !== 'Driver Assigned on Dispatch')
        ? booking.assignedDriver
        : '';

      const existingPhone = (initialDriverPhone && initialDriverPhone !== '+91 80 2555 0199')
        ? initialDriverPhone
        : (booking.assignedDriverPhone && booking.assignedDriverPhone !== '+91 80 2555 0199')
        ? booking.assignedDriverPhone
        : '';

      setDriverName(existingName);
      setDriverPhone(existingPhone);
      setSelectedRegisteredId('');
      setErrorMessage('');

      // If both name and phone were already validly filled on the card, go straight to confirm step
      if (existingName.trim().length >= 2 && existingPhone.replace(/[^0-9]/g, '').length >= 10) {
        setStep('confirm');
      } else {
        setStep('input');
      }
    }
  }, [isOpen, booking, initialDriverName, initialDriverPhone]);

  if (!isOpen || !booking) return null;

  // Handle selecting a registered driver from dropdown
  const handleSelectRegisteredDriver = (driverId) => {
    setSelectedRegisteredId(driverId);
    if (!driverId) return;

    const matched = registeredDrivers.find(d => d.id === driverId);
    if (matched) {
      setDriverName(matched.name || '');
      setDriverPhone(matched.phone || '');
      setErrorMessage('');
    }
  };

  // Proceed from input step to confirmation step
  const handleProceedToConfirm = (e) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedName = driverName.trim();
    const cleanDigits = driverPhone.replace(/[^0-9]/g, '');

    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage('Please enter a valid driver full name (at least 2 characters).');
      return;
    }

    if (!cleanDigits || cleanDigits.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number for the driver.');
      return;
    }

    setStep('confirm');
  };

  // Final confirmation
  const handleFinalConfirm = () => {
    const trimmedName = driverName.trim();
    let formattedPhone = driverPhone.trim();
    const cleanDigits = driverPhone.replace(/[^0-9]/g, '');
    if (cleanDigits.length === 10) {
      formattedPhone = `+91 ${cleanDigits}`;
    }

    onConfirm({
      bookingId: booking.id,
      driverName: trimmedName,
      driverPhone: formattedPhone
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5 pb-3.5 border-b border-slate-800">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
            <SteeringWheel className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white font-['Outfit']">
                {step === 'input' ? 'Assign Driver to Booking' : 'Confirm Driver Assignment'}
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-400 border border-amber-400/20">
                {booking.id}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Customer: <strong className="text-white">{booking.customerName}</strong> ({booking.phone})
            </p>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: INPUT DRIVER DETAILS */}
        {step === 'input' && (
          <form onSubmit={handleProceedToConfirm} className="space-y-4">
            {/* Quick Selector from Registered Drivers (if available) */}
            {registeredDrivers && registeredDrivers.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Select from Registered Drivers (Optional)
                </label>
                <select
                  value={selectedRegisteredId}
                  onChange={(e) => handleSelectRegisteredDriver(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="">-- Choose a verified registered driver --</option>
                  {registeredDrivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} • {d.phone} ({d.area || 'Bangalore'}) {d.dutyStatus ? `[${d.dutyStatus}]` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Driver Full Name */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Driver Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Ramesh Kumar"
                  value={driverName}
                  onChange={(e) => {
                    setDriverName(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>
            </div>

            {/* Driver Phone Number */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Driver Mobile Phone Number *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  placeholder="e.g. 98765 43210"
                  value={driverPhone}
                  onChange={(e) => {
                    setDriverPhone(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors font-mono"
                />
              </div>
            </div>

            {/* Trip Context Card */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-300 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span>Trip Type: <strong>{booking.tripTitle || booking.tripType || 'Driver Service'}</strong></span>
                <span>Fare: <strong className="text-amber-400">₹{booking.fare}</strong></span>
              </div>
              <div className="text-slate-400 truncate">
                📍 Pickup: <strong>{booking.pickupArea}</strong> → Drop: <strong>{booking.dropLocation || 'Local Service'}</strong>
              </div>
              <div className="text-slate-400">
                📅 Schedule: <strong>{booking.date} at {booking.time}</strong>
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Review & Confirm</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: CONFIRMATION STEP */}
        {step === 'confirm' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Confirmation Banner */}
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-blue-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Please Confirm Assignment Details</span>
              </div>
              <p className="text-[11px] text-blue-200/90 leading-relaxed">
                Accepting will update the booking to <strong>Assigned</strong> and dispatch driver details to the customer.
              </p>
            </div>

            {/* Summary Details Table */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Booking Ref:</span>
                <span className="font-mono font-bold text-amber-400">{booking.id}</span>
              </div>
              
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Customer:</span>
                <span className="font-bold text-white">{booking.customerName} ({booking.phone})</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Assigned Driver:</span>
                <span className="font-black text-emerald-400 text-sm">{driverName}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Driver Contact:</span>
                <span className="font-mono font-bold text-white">{driverPhone}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Schedule:</span>
                <span className="font-medium text-slate-300">{booking.date} • {booking.time}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('input')}
                className="py-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                ← Edit Details
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalConfirm}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Accept & Assign</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
