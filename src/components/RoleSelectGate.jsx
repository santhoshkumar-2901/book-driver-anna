import React from 'react';
import { Car, CheckCircle2, MapPin, ArrowRight, UserPlus } from 'lucide-react';
import { SteeringWheel } from './Icons';

export default function RoleSelectGate({ onSelectRole }) {
  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-amber-400 selection:text-slate-950">
      
      {/* Top Header Bar */}
      <header className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2 flex items-center justify-center sm:justify-start shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-400 text-slate-950 font-bold shrink-0">
            <Car className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="font-bold text-lg sm:text-xl text-white font-['Outfit'] tracking-tight leading-none">
              Book Driver <span className="text-amber-400">Anna</span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
              <MapPin className="w-2.5 h-2.5 text-red-400 inline" /> Bengaluru Services
            </p>
          </div>
        </div>
      </header>

      {/* Central Role Selection Cards */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-6">
        <div className="w-full max-w-3xl my-auto space-y-6">
          
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Outfit'] tracking-tight">
              Select Your Account Type
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              Choose your role to sign in or register. You can switch roles at any time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            
            {/* OPTION 1: CUSTOMER */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center">
                    <Car className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded">
                    Rider / Client
                  </span>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-white">
                    I am a Customer
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Book verified drivers for your personal car, rent vehicles, or enroll in doorstep driving lessons.
                  </p>
                </div>

                <ul className="space-y-1.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>In-city hourly & outstation drivers</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Commercial car rentals with drivers</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Doorstep driving academy training</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-2">
                <button
                  type="button"
                  onClick={() => onSelectRole('user', 'login')}
                  className="w-full py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Customer Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onSelectRole('user', 'signup')}
                  className="w-full py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white font-medium text-xs border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Client Account</span>
                </button>
              </div>
            </div>

            {/* OPTION 2: DRIVER PARTNER */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <SteeringWheel className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded">
                    Driver Partner
                  </span>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-white">
                    I am a Driver Partner
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Access your driver portal, view assigned trips, manage duty status, and track your daily payouts.
                  </p>
                </div>

                <ul className="space-y-1.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Real-time Bangalore trip assignments</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Transparent daily settlement & earnings</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Direct dispatch helpline support</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-2">
                <button
                  type="button"
                  onClick={() => onSelectRole('driver', 'login')}
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Driver Partner Login</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onSelectRole('driver', 'signup')}
                  className="w-full py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white font-medium text-xs border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register as Driver</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Footer info */}
      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-900 shrink-0">
        Book Driver Anna • Secure Authentication & Verification Portal
      </footer>
    </div>
  );
}
