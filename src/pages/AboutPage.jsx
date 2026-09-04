import React from 'react';
import { ShieldCheck, Award, MapPin, CheckCircle2 } from 'lucide-react';
import { SteeringWheel } from '../components/Icons';
import { FEATURED_DRIVERS } from '../data/mockData';

export default function AboutPage({ openBookingModal }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      
      {/* Header */}
      <div className="space-y-3 max-w-2xl">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400 text-xs font-medium">
          <MapPin className="w-3.5 h-3.5 text-amber-400" /> Bengaluru Operational Center
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white font-['Outfit']">
          About Book Driver Anna
        </h1>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Book Driver Anna connects vehicle owners in Bengaluru with experienced, background-verified private drivers and offers sanitized vehicle rentals and structured driving lessons.
        </p>
      </div>

      {/* Origin Story Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white font-['Outfit']">
            Reliable Drivers for Bengaluru Commutes
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Navigating peak traffic on the Outer Ring Road, Silk Board, or Old Madras Road can be exhausting. Finding a dependable acting driver on short notice without price haggling or safety uncertainty has traditionally been difficult.
          </p>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            We organized the acting driver service into a transparent platform where every driver partner is verified via official police records, assessed on manual and automatic transmissions, and dispatched promptly to your location.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-1">
              <div className="text-xl font-bold text-white font-['Outfit']">100%</div>
              <div className="text-xs text-slate-400">Police Record Verification</div>
            </div>
            <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-1">
              <div className="text-xl font-bold text-white font-['Outfit']">24/7</div>
              <div className="text-xs text-slate-400">Dispatch Across 15 Zones</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 p-5 space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Operational Center</div>
            <div className="text-base font-bold text-white">Indiranagar 100ft Road, Bengaluru</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Centrally coordinating driver partner dispatches, commercial vehicle inspections, and doorstep driving instructor sessions across all Bangalore localities.
            </p>
          </div>
        </div>
      </div>

      {/* Safety and Verification Standards */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white font-['Outfit']">
            Driver Partner Screening Process
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Every driver partner undergoes comprehensive background and skill verification before receiving trip assignments.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
          {[
            { step: '01', title: 'Police Clearance', desc: 'Criminal background check verified through state police databases.' },
            { step: '02', title: 'Driving Assessment', desc: 'Practical test covering manual, automatic, and multi-lane city traffic.' },
            { step: '03', title: 'Route Knowledge', desc: 'Assessment on Bangalore airport corridors, expressways, and bypass routes.' },
            { step: '04', title: 'Customer Decorum', desc: 'Professional conduct, non-smoking policy, and etiquette guidelines.' },
            { step: '05', title: 'Night Protocols', desc: 'Strict safety standards and breathalyzer compliance for late-night rides.' }
          ].map((s) => (
            <div key={s.step} className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
              <span className="text-lg font-bold text-amber-400 font-['Outfit']">{s.step}</span>
              <h4 className="font-bold text-white text-xs">{s.title}</h4>
              <p className="text-slate-400 leading-relaxed text-[11px]">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Driver Profiles */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white font-['Outfit']">
            Experienced Driver Partners
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Representative profiles of our licensed driver partners across Bengaluru
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURED_DRIVERS.slice(0, 3).map((driver) => (
            <div key={driver.id} className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <img src={driver.avatar} alt={driver.name} className="w-12 h-12 rounded-lg object-cover" />
                <div>
                  <h4 className="font-bold text-white text-sm">{driver.name}</h4>
                  <div className="text-xs text-slate-400">{driver.experience}</div>
                  <div className="text-[11px] text-amber-400">Rating: {driver.rating} / 5.0</div>
                </div>
              </div>
              <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                "{driver.tagline}"
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Booking CTA */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white font-['Outfit']">Ready to schedule a driver?</h3>
          <p className="text-xs text-slate-400 mt-0.5">Instant booking confirmation with zero cancellation penalties.</p>
        </div>

        <button
          onClick={() => openBookingModal('driver')}
          className="py-2.5 px-5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer shrink-0"
        >
          <SteeringWheel className="w-4 h-4 text-slate-950" />
          <span>Book a Driver</span>
        </button>
      </div>

    </div>
  );
}
