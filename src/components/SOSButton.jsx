import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, PhoneCall, Copy, Check, X, Phone } from 'lucide-react';
import { SUPPORT_HELPLINE } from '../data/mockData';

export default function SOSButton({ 
  trip, 
  className = '', 
  compact = false,
  label = 'SOS' 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const bookingId = trip?.id || trip?.bookingId || 'Active Trip';
  const driver = trip?.driverName || trip?.assignedDriver || 'Driver Assigned';
  const vehicle = trip?.carModel || trip?.vehicleName || 'Customer Vehicle';
  const status = trip?.status || 'In Progress';
  const pickup = trip?.pickupArea || trip?.pickup || '';
  const destination = trip?.dropLocation || trip?.destination || '';

  const handleCopyTripDetails = async () => {
    const textToCopy = [
      `🚨 BOOK DRIVER ANNA - SOS TRIP DETAILS`,
      `Booking ID: ${bookingId}`,
      `Driver: ${driver}`,
      `Vehicle: ${vehicle}`,
      `Status: ${status}`,
      pickup ? `Pickup: ${pickup}` : null,
      destination ? `Destination: ${destination}` : null,
      `Emergency Helpline: ${SUPPORT_HELPLINE}`
    ].filter(Boolean).join('\n');

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy trip details:', err);
    }
  };

  return (
    <>
      {/* SOS Trigger Button with distinct Red Alert styling */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className || `px-2.5 sm:px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black text-xs shadow-md shadow-red-950/60 border border-red-400/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95`}
        title="Emergency SOS & Support"
        aria-label="Emergency SOS button"
      >
        <ShieldAlert className="w-3.5 h-3.5 text-white animate-pulse" />
        <span className="tracking-wide font-extrabold">{label}</span>
      </button>

      {/* Confirmation & Safety Modal Panel */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sos-modal-title"
        >
          {/* Backdrop dismiss */}
          <div 
            className="absolute inset-0"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Panel Card */}
          <div className="relative z-10 w-full max-w-md bg-slate-900 border-2 border-red-500/80 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-red-950/80 space-y-4 text-slate-100">
            
            {/* Header with Red Alert Icon */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-600/20 border border-red-500 text-red-400 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
                </div>
                <div>
                  <h3 id="sos-modal-title" className="text-base sm:text-lg font-black text-white font-['Outfit'] flex items-center gap-1.5">
                    Emergency Support
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    24/7 Bengaluru Safety & Fleet Helpline
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close emergency panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Calm guidance & trip snapshot */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="text-[11px] text-red-400 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Active Journey Safety Snapshot</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-slate-500">Booking ID:</span> <span className="font-mono text-white font-bold">{bookingId}</span></div>
                <div><span className="text-slate-500">Status:</span> <span className="text-emerald-400 font-bold">{status}</span></div>
                <div className="col-span-2 truncate"><span className="text-slate-500">Driver:</span> <span className="text-slate-200 font-semibold">{driver}</span></div>
                <div className="col-span-2 truncate"><span className="text-slate-500">Vehicle:</span> <span className="text-slate-200 font-semibold">{vehicle}</span></div>
              </div>
            </div>

            {/* Explicit Two Confirmed Actions */}
            <div className="space-y-2.5 pt-1">
              
              {/* Action 1: Call Helpline */}
              <a
                href={`tel:${SUPPORT_HELPLINE.replace(/\s+/g, '')}`}
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-950/60 transition-all cursor-pointer"
              >
                <PhoneCall className="w-4 h-4 text-white" />
                <span>Call Helpline ({SUPPORT_HELPLINE})</span>
              </a>

              {/* Action 2: Share / Copy Trip Details */}
              <button
                type="button"
                onClick={handleCopyTripDetails}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">✓ Trip Details Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-amber-400" />
                    <span>Copy Trip Details to Share</span>
                  </>
                )}
              </button>
            </div>

            {/* Calm Dismiss Action */}
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer py-1"
              >
                Dismiss / I am safe
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
