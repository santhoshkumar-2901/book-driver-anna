import React from 'react';
import { ShieldCheck, Heart, Award, Users, MapPin, CheckCircle2, Car, Sparkles } from 'lucide-react';
import { SteeringWheel } from '../components/Icons';
import { LOCAL_STATS, FEATURED_DRIVERS } from '../data/mockData';

export default function AboutPage({ openBookingModal }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      
      {/* Hero Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 text-amber-400 text-xs font-bold border border-amber-400/20">
          <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" /> Born & Raised In Namma Bengaluru
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white font-['Outfit']">
          The Story Behind <span className="text-amber-400">Book Driver Anna</span>
        </h1>
        <p className="text-slate-300 text-base leading-relaxed">
          We built Book Driver Anna with a single promise: To make everyday commuting across Bangalore stress-free, 
          safe, and respectful for both car owners and our hardworking driver partners.
        </p>
      </div>

      {/* Origin Story Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-5">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Why We Started</span>
          <h2 className="text-3xl font-extrabold text-white font-['Outfit']">
            Solving Silk Board & Outer Ring Road Traffic One Trip At A Time
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Back in 2021, driving through Bangalore's notorious peak hour traffic from Electronic City to Manyata Tech Park left tech professionals exhausted before their work day even started. 
            Finding a reliable acting driver for a few hours was filled with uncertainty, price haggling, and safety concerns.
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            We launched <strong>Book Driver Anna</strong> to organize the acting driver market. We treat our drivers not as gig workers, but as <strong>"Anna"</strong>—a term of affection and respect in Karnataka. Every Anna on our platform is background-verified, police-checked, and compensated fairly.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="text-2xl font-extrabold text-amber-400 font-['Outfit']">100%</div>
              <div className="text-xs text-slate-400">Police Verified Annas</div>
            </div>
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="text-2xl font-extrabold text-emerald-400 font-['Outfit']">15 Mins</div>
              <div className="text-xs text-slate-400">Average Pickup Speed</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 relative">
          <div className="relative rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
            <img 
              src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80" 
              alt="Bangalore City Traffic & Drivers" 
              className="w-full h-[400px] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex items-end p-6">
              <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-amber-400/30">
                <div className="text-xs font-bold text-amber-400 uppercase">Headquarters</div>
                <div className="text-sm font-extrabold text-white">Indiranagar 100ft Road, Bengaluru</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Operating across 25+ Bangalore hubs</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5-Step Safety Guarantee */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-8">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="bg-amber-400/10 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Safety & Quality Standards
          </span>
          <h2 className="text-3xl font-extrabold text-white font-['Outfit']">
            Our 5-Step Driver Screening Process
          </h2>
          <p className="text-slate-400 text-xs">
            We accept only top 8% of driver applicants in Bengaluru
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs">
          {[
            { step: '01', title: 'Police Clearance', desc: 'Mandatory criminal record verification via KA Police portal.' },
            { step: '02', title: 'Driving Assessment', desc: 'Rigorous manual & automatic car test in dense city traffic.' },
            { step: '03', title: 'Local Route Exam', desc: 'Tested on Bangalore shortcuts, toll ways & airport routes.' },
            { step: '04', title: 'Etiquette Training', desc: 'Trained in polite customer care & zero-smoke decorum.' },
            { step: '05', title: '24/7 Alcohol Check', desc: 'Breathalyzer tests conducted before late night party drives.' }
          ].map((s) => (
            <div key={s.step} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 relative">
              <span className="text-2xl font-black text-amber-400 font-['Outfit']">{s.step}</span>
              <h4 className="font-bold text-white">{s.title}</h4>
              <p className="text-slate-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Driver Partner Testimonials & Pride */}
      <div className="space-y-8">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <h2 className="text-3xl font-extrabold text-white font-['Outfit']">
            Empowering Namma Driver Partners
          </h2>
          <p className="text-slate-400 text-xs">
            Book Driver Anna provides health insurance, dignity, and steady income to over 1,800 local families in Karnataka.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURED_DRIVERS.slice(0, 3).map((driver) => (
            <div key={driver.id} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex items-center gap-4">
                <img src={driver.avatar} alt={driver.name} className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-400" />
                <div>
                  <h4 className="font-bold text-white text-base">{driver.name}</h4>
                  <div className="text-xs text-amber-400 font-semibold">{driver.experience}</div>
                  <div className="text-[11px] text-slate-400">{driver.trips}+ Trips Completed</div>
                </div>
              </div>
              <p className="text-xs text-slate-300 italic bg-slate-950 p-3 rounded-xl border border-slate-800">
                "{driver.tagline}"
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA BANNER */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-3xl p-8 text-slate-950 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl font-extrabold font-['Outfit']">Experience Namma Anna's Service Today</h3>
          <p className="text-xs font-bold text-slate-900 mt-1">Book in 60 seconds with instant booking pass!</p>
        </div>

        <button
          onClick={() => openBookingModal('driver')}
          className="py-3.5 px-7 rounded-2xl bg-slate-950 text-amber-400 font-extrabold text-xs hover:bg-slate-900 shadow-xl flex items-center gap-2"
        >
          <SteeringWheel className="w-5 h-5 text-amber-400" />
          <span>Book Driver Anna Now</span>
        </button>
      </div>

    </div>
  );
}
