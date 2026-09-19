import React from 'react';
import { LogIn, UserPlus, ShieldCheck } from 'lucide-react';
import { useScrollLock } from '../utils/useScrollLock';

export default function PostBookingAuthPromptModal({
  isOpen,
  bookingInfo,
  onChooseLogin,
  onChooseSignup
}) {
  useScrollLock(isOpen);

  if (!isOpen || !bookingInfo) return null;

  const { bookingId, serviceTitle, customerName } = bookingInfo;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 text-center space-y-4">
        {/* Verification Status Icon */}
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner">
          <ShieldCheck className="w-7 h-7 text-amber-400" />
        </div>

        {/* Badge & Title */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Almost Done • Final Step</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white font-['Outfit']">
            Login or Signup
          </h2>
          <p className="text-xs text-slate-300 max-w-sm mx-auto mt-1 leading-relaxed">
            {customerName ? `Hello ${customerName}, ` : ''}please log in or sign up to confirm your booking for <strong className="text-amber-400">{serviceTitle || 'Transit Service'}</strong> and access your live driver dispatch pass:
          </p>
        </div>

        {/* Actions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
          {/* Login Option */}
          <button
            type="button"
            onClick={onChooseLogin}
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-white transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <LogIn className="w-4 h-4" />
            </div>
            <span className="font-bold text-xs">Login</span>
            <span className="text-[10px] text-slate-400">Existing Customer</span>
          </button>

          {/* Sign Up Option */}
          <button
            type="button"
            onClick={onChooseSignup}
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold transition-all cursor-pointer group shadow-lg shadow-amber-500/20"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-950/20 flex items-center justify-center text-slate-950 group-hover:scale-105 transition-transform">
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-xs">Signup</span>
            <span className="text-[10px] text-slate-900/80 font-medium">New Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
