import React from 'react';
import { SteeringWheel } from '../components/Icons';

export default function AboutPage({ openBookingModal }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      
      {/* Header */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium">
          <span>Bengaluru Urban Transit Standards</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white font-['Outfit']">
          Operational Standards & Safety Verification
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Book Driver Anna was built to bring structure, background transparency, and professional accountability to on-demand driver services across Bengaluru.
        </p>
      </div>

      {/* Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Our Background</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Outfit']">
            Organized Urban Driving For Car Owners & Fleets
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Navigating Bangalore's dense corridors—from Outer Ring Road and Silk Board to Kempegowda Airport—demands experienced driving, patience, and absolute reliability.
          </p>
          <p className="text-sm text-slate-400 leading-relaxed">
            We vet, test, and onboard professional acting drivers across Karnataka. Every driver partner on the platform is treated with professional dignity and verified via strict criminal record and driving assessments.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="card-surface p-4 space-y-1">
              <div className="text-2xl font-bold text-white font-['Outfit']">100%</div>
              <div className="text-xs text-slate-400">Police & ID Cleared</div>
            </div>
            <div className="card-surface p-4 space-y-1">
              <div className="text-2xl font-bold text-emerald-400 font-['Outfit']">24/7</div>
              <div className="text-xs text-slate-400">Dispatch Support</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="rounded-xl overflow-hidden border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 aspect-[16/10] flex flex-col items-center justify-center p-8 text-center relative group">
            {/* TODO: Add real operations photography */}
            <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center mb-3 shadow-inner shadow-amber-400/10">
              <Car className="w-8 h-8" />
            </div>
            <h4 className="text-white font-bold text-sm font-['Outfit']">Bengaluru Road & Fleet Telemetry</h4>
            <p className="text-slate-400 text-xs mt-1 max-w-xs leading-relaxed">
              Live automated dispatch routing covering 15+ zones across the Bengaluru metropolitan area.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] text-amber-300 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Central Dispatch Hub
            </div>
          </div>
        </div>
      </div>

      {/* 5-Step Driver Screening Process */}
      <div className="card-surface p-6 sm:p-8 space-y-6">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Verification Workflow
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-white font-['Outfit'] mt-1">
            5-Step Driver Screening Protocol
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Rigorous background validation before any driver is dispatched to customers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {[
            { step: '01', title: 'Police Clearance', desc: 'Identity validation and criminal background check via official law enforcement records.' },
            { step: '02', title: 'Driving Assessment', desc: 'Manual and automatic transmission practical evaluation in dense peak-hour traffic.' },
            { step: '03', title: 'Bengaluru Route Exam', desc: 'Assessment of major arterials, toll roads, airport corridors, and bypass routes.' },
            { step: '04', title: 'Customer Decorum', desc: 'Training in professional etiquette, vehicle hygiene, and road safety regulations.' },
            { step: '05', title: 'Alcohol Screening', desc: 'Mandatory breathalyzer verification for late-night party return drivers.' }
          ].map((s) => (
            <div key={s.step} className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-1.5">
              <span className="text-lg font-bold text-amber-500 font-mono">{s.step}</span>
              <h4 className="font-semibold text-white">{s.title}</h4>
              <p className="text-slate-400 leading-relaxed text-[11px]">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>


      {/* CTA Box */}
      <div className="card-surface p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white font-['Outfit']">Reserve a Verified Driver</h3>
          <p className="text-xs text-slate-400 mt-0.5">Quick booking with immediate SMS confirmation</p>
        </div>

        <button
          onClick={() => openBookingModal('driver')}
          className="btn-primary"
        >
          <SteeringWheel className="w-4 h-4" />
          <span>Book a Driver</span>
        </button>
      </div>

    </div>
  );
}
