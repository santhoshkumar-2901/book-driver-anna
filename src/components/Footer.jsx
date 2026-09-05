import React from 'react';
import { Car, MapPin, Phone, Mail, Clock, ShieldCheck, ArrowRight } from 'lucide-react';
import { SteeringWheel } from './Icons';
import { BANGALORE_AREAS } from '../data/mockData';

export default function Footer({ setActivePage, openBookingModal, openCancelModal, clientUser, onLogout }) {
  const navigateTo = (pageId) => {
    setActivePage(pageId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-slate-950 border-t border-slate-800 pt-12 pb-8 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-10 border-b border-slate-800">
          
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigateTo('home')}>
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500 text-slate-950 font-bold shadow-sm">
                <SteeringWheel className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="font-bold text-xl text-white font-['Outfit']">
                Book Driver <span className="text-amber-500">Anna</span>
              </span>
            </div>

            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-sm">
              On-demand verified acting drivers, rental fleet vehicles, and professional driving instruction across Bengaluru Urban.
            </p>

            <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Police Verified</span>
              <span>•</span>
              <span>₹0 Cancellation Fee</span>
              <span>•</span>
              <span>24/7 Dispatch</span>
            </div>
          </div>

          {/* Our Services */}
          <div className="space-y-2.5">
            <h4 className="text-white font-semibold text-sm font-['Outfit'] border-l-2 border-amber-500 pl-2">
              Services
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <button 
                  onClick={() => openBookingModal('driver')} 
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Hourly In-City Driver
                </button>
              </li>
              <li>
                <button 
                  onClick={() => openBookingModal('driver')} 
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Night Party Driver
                </button>
              </li>
              <li>
                <button 
                  onClick={() => openBookingModal('driver')} 
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Outstation Highway Driver
                </button>
              </li>
              <li>
                <button 
                  onClick={() => openBookingModal('vehicle')} 
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Rental Fleet (Sedan & SUV)
                </button>
              </li>
              <li>
                <button 
                  onClick={() => openBookingModal('class')} 
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Driving Academy Lessons
                </button>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div className="space-y-2.5">
            <h4 className="text-white font-semibold text-sm font-['Outfit'] border-l-2 border-amber-500 pl-2">
              Navigation
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <button onClick={() => navigateTo('home')} className="hover:text-white transition-colors cursor-pointer">Home</button>
              </li>
              <li>
                <button onClick={() => navigateTo('services')} className="hover:text-white transition-colors cursor-pointer">Services & Official Rates</button>
              </li>
              <li>
                <button onClick={() => navigateTo('about')} className="hover:text-white transition-colors cursor-pointer">Screening Standards</button>
              </li>
              <li>
                <button onClick={() => navigateTo('contact')} className="hover:text-white transition-colors cursor-pointer">Contact & Hubs</button>
              </li>
              <li>
                <button onClick={openCancelModal} className="hover:text-red-400 transition-colors cursor-pointer">Manage / Cancel Trip</button>
              </li>
            </ul>
          </div>

          {/* Bengaluru Dispatch Info */}
          <div className="space-y-2.5">
            <h4 className="text-white font-semibold text-sm font-['Outfit'] border-l-2 border-amber-500 pl-2">
              Bengaluru Office
            </h4>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="text-slate-400">#42, 100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <a href="tel:+919886012345" className="hover:text-white font-mono">+91 98860 12345</a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <a href="mailto:support@bookdriveranna.com" className="hover:text-white text-slate-400">support@bookdriveranna.com</a>
              </div>
            </div>
          </div>

        </div>

        {/* Coverage Tags across Bangalore */}
        <div className="py-5 border-b border-slate-800">
          <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-2">
            Localities Covered:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BANGALORE_AREAS.map((area, index) => (
              <span key={index} className="text-[11px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-800">
                {area}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Book Driver Anna. All rights reserved. Operating in Bengaluru Urban.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-400 cursor-pointer">Privacy</span>
            <span className="hover:text-slate-400 cursor-pointer">Terms</span>
            <span className="hover:text-slate-400 cursor-pointer">Safety Policy</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
