import React from 'react';
import { Car, ShieldCheck, CheckCircle2, MapPin, ArrowRight, UserPlus, Sparkles } from 'lucide-react';
import { SteeringWheel } from './Icons';

export default function RoleSelectGate({ onSelectRole }) {
  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-y-auto overflow-x-hidden font-sans selection:bg-amber-400 selection:text-slate-950 max-w-full">
      
      {/* Background Ambience & Grid */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-72 sm:w-96 h-72 sm:h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-64 sm:w-80 h-64 sm:h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2 flex items-center justify-center sm:justify-start shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 shrink-0">
            <Car className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="font-extrabold text-lg sm:text-xl text-white font-['Outfit'] tracking-tight leading-none">
              Book Driver <span className="text-amber-400">Anna</span>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
              <MapPin className="w-2.5 h-2.5 text-red-400 inline" /> Namma Bengaluru Services
            </p>
          </div>
        </div>
      </header>

      {/* Central Role Selection Cards */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-3.5 sm:px-6 py-4 sm:py-6">
        <div className="w-full max-w-4xl my-auto space-y-4 sm:space-y-6">
          
          {/* Section Heading */}
          <div className="text-center space-y-1.5 px-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Welcome to Namma Bengaluru Fleet
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white font-['Outfit'] tracking-tight">
              Wanna Be a <span className="text-amber-400">Customer</span> or a <span className="text-emerald-400">Driver</span>?
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
              Please choose your role to sign in or create an account. You can easily switch roles at any time.
            </p>
          </div>

          {/* Two Interactive Selection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            
            {/* OPTION 1: CUSTOMER / USER */}
            <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-400/60 rounded-2xl sm:rounded-3xl p-5 sm:p-7 backdrop-blur-xl shadow-2xl transition-all duration-300 flex flex-col justify-between group relative hover:shadow-amber-500/10">
              <div className="space-y-4">
                
                {/* Top Badge & Icon */}
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
                    <Car className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2.5 py-1 rounded-full">
                    For Riders & Clients
                  </span>
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white font-['Outfit'] group-hover:text-amber-400 transition-colors">
                    I am a Customer / User
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Looking to hire a trusted private driver for your car, rent a self-drive vehicle, or learn to drive in Bangalore.
                  </p>
                </div>

                {/* Highlights */}
                <ul className="space-y-2 text-xs text-slate-300 pt-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Hourly, daily, one-way & outstation car drivers</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Self-drive & chauffeur car rentals (Innova, Sedans)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Doorstep car driving school & license test training</span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 mt-6 border-t border-slate-800/80 space-y-2.5">
                <button
                  type="button"
                  onClick={() => onSelectRole('user', 'login')}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-md shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Customer Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onSelectRole('user', 'signup')}
                  className="w-full py-2 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Create New Customer Account</span>
                </button>
              </div>

            </div>

            {/* OPTION 2: DRIVER / ANNA */}
            <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-400/60 rounded-3xl p-6 sm:p-7 backdrop-blur-xl shadow-2xl transition-all duration-300 flex flex-col justify-between group relative hover:shadow-emerald-500/10">
              <div className="space-y-4">
                
                {/* Top Badge & Icon */}
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                    <SteeringWheel className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 px-2.5 py-1 rounded-full">
                    For Driver Annas
                  </span>
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white font-['Outfit'] group-hover:text-emerald-400 transition-colors">
                    I am a Driver / Anna
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Drive Bangalore's finest cars, accept flexible city & outstation trips, and earn assured payouts with zero commission.
                  </p>
                </div>

                {/* Highlights */}
                <ul className="space-y-2 text-xs text-slate-300 pt-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Weekly direct bank payouts & daily duty bonuses</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Choose your favorite Bangalore operating zones</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>24/7 fleet dispatcher helpline & accident cover</span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 mt-6 border-t border-slate-800/80 space-y-2.5">
                <button
                  type="button"
                  onClick={() => onSelectRole('driver', 'login')}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-xs sm:text-sm shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Driver Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onSelectRole('driver', 'signup')}
                  className="w-full py-2 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Register as Driver Partner</span>
                </button>
              </div>

            </div>

          </div>

          {/* Micro Trust Indicators */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5 sm:gap-5 text-[10px] sm:text-xs text-slate-400 font-semibold text-center">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Police Verified Fleet</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> 1,800+ Active Drivers</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-red-400" /> Serving 25+ Bangalore Hubs</span>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-2.5 text-center text-[10px] sm:text-xs text-slate-500 border-t border-slate-900 shrink-0">
        © {new Date().getFullYear()} Book Driver Anna. All rights reserved. • Bengaluru, Karnataka
      </footer>

    </div>
  );
}
