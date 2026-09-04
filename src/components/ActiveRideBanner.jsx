import React, { useState } from 'react';
import { Car, Phone, ShieldAlert, ArrowRight, CreditCard, CheckCircle2, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';
import { SteeringWheel } from './Icons';

export default function ActiveRideBanner({ 
  activeRide, 
  onOpenPayment, 
  onSimulateDemoRide 
}) {
  const [isMinimized, setIsMinimized] = useState(false);

  // If no active ride is currently tracked, don't show the banner
  if (!activeRide) {
    return null;
  }

  const driverName = activeRide.driverName || activeRide.assignedDriver || activeRide.assignedAnna || "Manjunath Gowda";
  const carModel = activeRide.carModel || activeRide.vehicleName || "Honda City (White)";
  const destination = activeRide.dropLocation || activeRide.destination || "Kempegowda Intl Airport";
  const fare = activeRide.totalFare || activeRide.fare || 549;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-slate-900/95 border-2 border-amber-400/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl shadow-black/80 backdrop-blur-xl text-slate-100 flex flex-col gap-2">
        
        {/* Top summary row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              <Car className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                  Ride In Progress
                </span>
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-white truncate font-['Outfit']">
                {driverName} • <span className="text-slate-400 font-normal">{carModel}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenPayment}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition-all flex items-center gap-1 cursor-pointer hover:scale-105"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Complete & Pay ₹{fare}</span>
              <ArrowRight className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              title={isMinimized ? "Expand" : "Collapse"}
            >
              {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expanded trip details */}
        {!isMinimized && (
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300">
            <div className="truncate flex items-center gap-1 text-slate-400">
              <span>Heading to:</span>
              <strong className="text-white truncate max-w-[200px] sm:max-w-xs">{destination}</strong>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a 
                href={`tel:${activeRide.driverPhone || '+919886012345'}`}
                className="text-slate-400 hover:text-emerald-400 flex items-center gap-1 font-bold"
              >
                <Phone className="w-3 h-3 text-emerald-400" /> Call Anna
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
