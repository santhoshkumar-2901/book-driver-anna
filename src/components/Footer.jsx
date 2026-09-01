import React from 'react';
import { Car, MapPin, Phone, Mail, Clock, ShieldCheck, Heart, ArrowRight, Zap } from 'lucide-react';
import { BANGALORE_AREAS } from '../data/mockData';

export default function Footer({ setActivePage, openBookingModal }) {
  const navigateTo = (pageId) => {
    setActivePage(pageId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-slate-950 border-t border-slate-800/80 pt-16 pb-12 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800/80">
          
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigateTo('home')}>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-bold shadow-lg shadow-amber-500/20">
                <Car className="w-6 h-6 stroke-[2.2]" />
              </div>
              <span className="font-extrabold text-2xl text-white font-['Outfit']">
                Book Driver <span className="text-amber-400">Anna</span>
              </span>
            </div>

            <p className="text-slate-400 text-sm leading-relaxed max-w-md">
              Namma Bengaluru's most trusted on-demand driver and vehicle booking platform. 
              Whether navigating Silk Board traffic, returning safely from a night out in Indiranagar, 
              or taking a weekend trip to Coorg—our verified Annas are at your service 24x7.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <span className="bg-amber-400/10 text-amber-400 border border-amber-400/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> 100% Background Verified
              </span>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> 15 Min Pickup
              </span>
            </div>
          </div>

          {/* Our Services */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-base font-['Outfit'] border-l-2 border-amber-400 pl-2.5">
              Our Services
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button 
                  onClick={() => openBookingModal('driver')} 
                  className="hover:text-amber-400 transition-colors flex items-center gap-1.5 group"
                >
                  <ArrowRight className="w-3 h-3 text-amber-400 group-hover:translate-x-1 transition-transform" />
                  Hourly Driver in City
                </button>
              </li>
              <li>
                <button 
                  onClick={() => openBookingModal('driver')} 
                  className="hover:text-amber-400 transition-colors flex items-center gap-1.5 group"
                >
                  <ArrowRight className="w-3 h-3 text-amber-400 group-hover:translate-x-1 transition-transform" />
                  Night Party Driver (Indiranagar/Kora)
                </button>
              </li>
              <li>
                <button 
                  onClick={() => openBookingModal('driver')} 
                  className="hover:text-amber-400 transition-colors flex items-center gap-1.5 group"
                >
                  <ArrowRight className="w-3 h-3 text-amber-400 group-hover:translate-x-1 transition-transform" />
                  Outstation Driver (Coorg, Mysore)
                </button>
              </li>
              <li>
                <button 
                  onClick={() => openBookingModal('vehicle')} 
                  className="hover:text-amber-400 transition-colors flex items-center gap-1.5 group"
                >
                  <ArrowRight className="w-3 h-3 text-amber-400 group-hover:translate-x-1 transition-transform" />
                  Book Sedan / Swift Dzire
                </button>
              </li>
              <li>
                <button 
                  onClick={() => openBookingModal('vehicle')} 
                  className="hover:text-amber-400 transition-colors flex items-center gap-1.5 group"
                >
                  <ArrowRight className="w-3 h-3 text-amber-400 group-hover:translate-x-1 transition-transform" />
                  Book Innova Crysta SUV
                </button>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-base font-['Outfit'] border-l-2 border-amber-400 pl-2.5">
              Quick Navigation
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button onClick={() => navigateTo('home')} className="hover:text-white transition-colors">Home</button>
              </li>
              <li>
                <button onClick={() => navigateTo('services')} className="hover:text-white transition-colors">Services (Driver & Vehicle)</button>
              </li>
              <li>
                <button onClick={() => navigateTo('about')} className="hover:text-white transition-colors">About Us</button>
              </li>
              <li>
                <button onClick={() => navigateTo('contact')} className="hover:text-white transition-colors">Contact & Support</button>
              </li>
              <li>
                <button onClick={() => openBookingModal('driver')} className="text-amber-400 font-semibold hover:underline">Instant Booking Widget</button>
              </li>
            </ul>
          </div>

          {/* Bangalore HQ Info */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-base font-['Outfit'] border-l-2 border-amber-400 pl-2.5">
              Bengaluru Office
            </h4>
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>#42, 100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru, KA 560038</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                <a href="tel:+919886012345" className="hover:text-amber-400 font-semibold">+91 98860 12345</a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                <a href="mailto:support@bookdriveranna.com" className="hover:text-amber-400">support@bookdriveranna.com</a>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-emerald-400 font-medium">24 Hours / 365 Days Active</span>
              </div>
            </div>
          </div>

        </div>

        {/* Coverage Tags across Bangalore */}
        <div className="py-6 border-b border-slate-800/80">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">
            Serving All Bangalore Hubs & Tech Parks:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BANGALORE_AREAS.map((area, index) => (
              <span key={index} className="text-xs bg-slate-900 text-slate-400 px-2.5 py-1 rounded-md border border-slate-800 hover:border-slate-700 hover:text-slate-200 transition-colors flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-400" /> {area}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Book Driver Anna Technologies Pvt Ltd. Made with <Heart className="w-3.5 h-3.5 text-red-500 inline fill-red-500 mx-0.5" /> in Namma Bengaluru.</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-300 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-300 cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-300 cursor-pointer">Driver Safety Standards</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
