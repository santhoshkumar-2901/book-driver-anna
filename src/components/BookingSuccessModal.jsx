import React, { useState, useEffect } from 'react';
import { CheckCircle2, Phone, MapPin, Calendar, Clock, Car, Copy, Check, ShieldCheck, Sparkles, X, Users, Snowflake, Sun, Star, Smartphone, PartyPopper, Briefcase } from 'lucide-react';
import { SteeringWheel } from './Icons';

export default function BookingSuccessModal({ booking, onClose }) {
  const [copied, setCopied] = useState(false);

  // Lock background body scroll when modal is open
  useEffect(() => {
    if (booking) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [booking]);

  if (!booking) return null;

  const handleCopyPass = () => {
    const passText = `BOOK DRIVER ANNA CONFIRMATION\nBooking ID: ${booking.bookingId}\nService: ${booking.serviceName}\nPickup Area: ${booking.pickupArea}\nPassengers: ${booking.passengers || 'N/A'}\nLuggage: ${booking.luggage || 'No Luggage'}\nAC Preference: ${booking.acPreference || 'AC'}\nDate/Time: ${booking.bookingDate} at ${booking.bookingTime}\nCustomer: ${booking.customerName} (${booking.customerPhone})\nTotal Fare: ₹${booking.totalFare} (${booking.paymentMode.toUpperCase()})\nAssigned Anna: ${booking.assignedAnna}`;
    navigator.clipboard.writeText(passText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl z-10 animate-in zoom-in-95 duration-300 my-auto text-slate-100 flex flex-col max-h-[90vh]">
        
        {/* Banner */}
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-amber-500 p-6 text-center relative overflow-hidden shrink-0">
          <div className="absolute top-2 right-2">
            <button onClick={onClose} className="p-1 rounded-full bg-black/20 text-white hover:bg-black/40">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="w-16 h-16 bg-slate-950 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-xl mb-3 border-2 border-emerald-400">
            <CheckCircle2 className="w-10 h-10 animate-bounce" />
          </div>

          <div className="bg-slate-950/40 backdrop-blur-sm inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white mb-1 border border-white/20">
            <PartyPopper className="w-3.5 h-3.5 text-amber-300" /> Booking Confirmed!
          </div>

          <h3 className="text-2xl font-extrabold text-white font-['Outfit']">
            Anna is on his way!
          </h3>
          <p className="text-xs text-white/90 font-medium">
            Booking ID: <span className="font-mono font-bold bg-slate-950/60 px-2 py-0.5 rounded text-amber-300">{booking.bookingId}</span>
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Driver Card */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80" 
                alt="Manjunath Gowda" 
                className="w-12 h-12 rounded-xl object-cover border-2 border-amber-400"
              />
              <div>
                <div className="text-xs text-amber-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Assigned Driver Anna
                </div>
                <div className="text-sm font-extrabold text-white">Manjunath Gowda</div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> 4.98 Rating • 3,400+ Trips in Blr
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

          {/* Trip Details Grid */}
          <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 space-y-3 text-xs">
            <div className="flex items-start justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                <SteeringWheel className="w-4 h-4 text-amber-400" />
                Service Option:
              </span>
              <span className="font-bold text-white text-right">{booking.serviceName}</span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-amber-400" /> Pickup Area:
              </span>
              <span className="font-bold text-white">{booking.pickupArea}</span>
            </div>

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
              <span className="font-bold text-white">{booking.bookingDate} @ {booking.bookingTime}</span>
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

          <div className="text-center text-[10px] text-slate-500 flex items-center justify-center gap-1">
            <Smartphone className="w-3 h-3 text-purple-400" /> SMS & WhatsApp with live GPS tracking link has been sent to {booking.customerPhone}
          </div>

        </div>

      </div>
    </div>
  );
}
