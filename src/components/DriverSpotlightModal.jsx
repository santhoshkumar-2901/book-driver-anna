import React from 'react';
import { X, Star, ShieldCheck, Award, MapPin, CheckCircle, Languages, ThumbsUp, Target } from 'lucide-react';
import { SteeringWheel } from './Icons';
import useScrollLock from '../utils/useScrollLock';

export default function DriverSpotlightModal({ driver, onClose, onBookDriver }) {
  useScrollLock(Boolean(driver));

  if (!driver) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      <div className="relative bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl w-full max-w-lg max-h-[92dvh] sm:max-h-[92vh] overflow-y-auto shadow-2xl z-10 animate-in zoom-in-95 duration-200 my-auto text-slate-100">
        
        {/* Header Photo Banner */}
        <div className="relative h-48 bg-gradient-to-r from-amber-500 to-amber-700 p-6 flex items-end">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-950/40 text-white hover:bg-slate-950/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4 relative z-10">
            <img 
              src={driver.avatar} 
              alt={driver.name}
              className="w-20 h-20 rounded-2xl object-cover border-4 border-slate-900 shadow-xl"
            />
            <div>
              <span className="bg-slate-950 text-amber-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-400/30">
                {driver.badge}
              </span>
              <h3 className="text-xl font-extrabold text-white font-['Outfit'] mt-1">
                {driver.name}
              </h3>
              <p className="text-xs text-slate-950 font-bold">
                {driver.experience}
              </p>
            </div>
          </div>
        </div>

        {/* Driver Details Body */}
        <div className="p-6 space-y-5">
          
          {/* Key Stats */}
          <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-center">
            <div>
              <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> Rating
              </div>
              <div className="text-base font-extrabold text-white mt-0.5 font-['Outfit']">{driver.rating} / 5.0</div>
            </div>

            <div className="border-x border-slate-800">
              <div className="text-xs text-slate-400">Total Trips</div>
              <div className="text-base font-extrabold text-amber-400 mt-0.5 font-['Outfit']">{driver.trips}+</div>
            </div>

            <div>
              <div className="text-xs text-slate-400">Police Status</div>
              <div className="text-xs font-bold text-emerald-400 mt-1 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified
              </div>
            </div>
          </div>

          {/* Tagline */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-amber-500/20 italic text-xs text-amber-200">
            "{driver.tagline}"
          </div>

          {/* Languages Spoken & Specialty */}
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 font-bold block mb-1.5 flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5 text-amber-400" /> Languages Spoken:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {driver.languages.map((lang, idx) => (
                  <span key={idx} className="bg-slate-950 text-slate-200 px-3 py-1 rounded-full border border-slate-800 font-semibold flex items-center gap-1">
                    <Languages className="w-3 h-3 text-amber-400" /> {lang}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <span className="text-slate-400 font-bold block mb-1">Special Expertise:</span>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-300 font-medium flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{driver.specialty}</span>
              </div>
            </div>
          </div>

          {/* Book Anna Button */}
          <button
            onClick={() => {
              onClose();
              onBookDriver(driver);
            }}
            className="w-full py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-400/20 transition-all flex items-center justify-center gap-2"
          >
            <SteeringWheel className="w-4 h-4" />
            <span>Request {driver.name.split(' ')[0]} Anna For My Trip</span>
          </button>

        </div>

      </div>
    </div>
  );
}
