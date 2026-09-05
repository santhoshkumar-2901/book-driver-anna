import React, { useState, useEffect } from 'react';
import { CheckCircle2, Phone, MapPin, Calendar, Clock, Car, Copy, Check, ShieldCheck, Sparkles, X, Users, Snowflake, Sun, Star, Smartphone, PartyPopper, Briefcase, GraduationCap, Ban, AlertCircle, CreditCard, ArrowRight } from 'lucide-react';
import { SteeringWheel } from './Icons';
import { toDDMMYYYY } from '../utils/dateUtils';
import { useScrollLock } from '../utils/useScrollLock';

export default function BookingSuccessModal({ booking, onClose, onSimulateRidePayment }) {
  useScrollLock(Boolean(booking));

  const [copied, setCopied] = useState(false);
  const [isCancelled, setIsCancelled] = useState(Boolean(booking && booking.status === 'Cancelled'));
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('Change of travel plans');

  useEffect(() => {
    if (booking) {
      setIsCancelled(booking.status === 'Cancelled');
      setShowCancelConfirm(false);
    }
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
    passText += `Date/Time: ${toDDMMYYYY(booking.bookingDate || booking.date)} at ${booking.bookingTime || booking.time}\nCustomer: ${booking.customerName} (${booking.customerPhone})\nTotal Fare: ₹${booking.totalFare} (${booking.paymentMode ? booking.paymentMode.toUpperCase() : 'CASH'})\nAssigned Anna: ${booking.assignedAnna}`;
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
        <div className={`p-6 text-center relative overflow-hidden shrink-0 ${
          isCancelled 
            ? 'bg-gradient-to-r from-red-800 via-red-700 to-amber-700' 
            : 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-amber-500'
        }`}>
          <div className="absolute top-2 right-2">
            <button onClick={onClose} className="p-1 rounded-full bg-black/20 text-white hover:bg-black/40">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className={`w-16 h-16 bg-slate-950 rounded-full flex items-center justify-center mx-auto shadow-xl mb-3 border-2 ${
            isCancelled ? 'text-red-400 border-red-500' : 'text-emerald-400 border-emerald-400'
          }`}>
            {isCancelled ? <Ban className="w-10 h-10" /> : <CheckCircle2 className="w-10 h-10 animate-bounce" />}
          </div>

          <div className="bg-slate-950/40 backdrop-blur-sm inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white mb-1 border border-white/20">
            {isCancelled ? (
              <span className="text-red-300 flex items-center gap-1"><Ban className="w-3.5 h-3.5" /> Booking Cancelled</span>
            ) : (
              <span className="text-amber-300 flex items-center gap-1"><PartyPopper className="w-3.5 h-3.5" /> Booking Confirmed!</span>
            )}
          </div>

          <h3 className="text-2xl font-extrabold text-white font-['Outfit']">
            {isCancelled 
              ? 'Booking Cancelled' 
              : (booking.bookingType === 'class' ? 'Class Enrollment Confirmed!' : 'Anna is on his way!')}
          </h3>
          <p className="text-xs text-white/90 font-medium">
            Booking ID: <span className="font-mono font-bold bg-slate-950/60 px-2 py-0.5 rounded text-amber-300">{booking.bookingId}</span>
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Driver/Instructor Card */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80" 
                alt="Instructor Anna" 
                className="w-12 h-12 rounded-xl object-cover border-2 border-amber-400"
              />
              <div>
                <div className="text-xs text-amber-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> {booking.bookingType === 'class' ? 'Assigned Driving Instructor' : 'Assigned Driver Anna'}
                </div>
                <div className="text-sm font-extrabold text-white">{booking.assignedAnna || 'Manjunath Gowda'}</div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> 4.98 Rating • Certified Instructor
                </div>
              </div>
            </div>

            <a 
              href={`tel:${booking.customerPhone}`}
              className="p-3 bg-emerald-500 text-slate-950 font-bold rounded-xl shadow-lg hover:bg-emerald-400 transition-colors flex items-center gap-1.5 text-xs"
            >
              <Phone className="w-4 h-4 fill-slate-950" /> Call
            </a>
          </div>

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
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCopyPass}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Pass Copied!' : 'Copy Trip Ticket'}</span>
            </button>

            <button
              onClick={onClose}
              className="py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-lg transition-colors text-center"
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
