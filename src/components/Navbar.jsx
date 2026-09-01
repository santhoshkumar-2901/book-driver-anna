import React, { useState } from 'react';
import { Car, PhoneCall, Menu, X, ShieldCheck, MapPin, Sparkles } from 'lucide-react';
import { SteeringWheel } from './Icons';

export default function Navbar({ activePage, setActivePage, openBookingModal }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'services', label: 'Services' },
    { id: 'about', label: 'About Us' },
    { id: 'contact', label: 'Contact' },
  ];

  const handleNavClick = (pageId) => {
    setActivePage(pageId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 transition-all">
      {/* Top Banner - Namma Bengaluru Pride */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-red-600 text-slate-950 font-semibold text-xs py-1.5 px-4 text-center flex items-center justify-center gap-2 shadow-inner">
        <span className="bg-slate-950 text-amber-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full tracking-wider">Namma Bangalore #1</span>
        <span>Trusted Local Driver & Vehicle Rentals across Indiranagar, Whitefield, Koramangala & All Bengaluru!</span>
        <span className="hidden md:inline-flex items-center gap-1 font-bold ml-2 underline cursor-pointer" onClick={() => openBookingModal('driver')}>
          <Sparkles className="w-3 h-3" /> Quick Book Anna
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">

          {/* Brand Logo */}
          <div
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform duration-300">
              <Car className="w-7 h-7 stroke-[2.2]" />
              <div className="absolute -bottom-1 -right-1 bg-red-600 text-white rounded-full p-0.5 border border-slate-900">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-2xl tracking-tight text-white font-['Outfit'] group-hover:text-amber-400 transition-colors">
                  Book Driver <span className="text-amber-400">Anna</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium tracking-wide flex items-center gap-1">
                <MapPin className="w-3 h-3 text-red-400 inline" /> Namma Bengaluru Services
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-full border border-slate-800">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${isActive
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Action CTAs */}
          <div className="hidden lg:flex items-center gap-4">
            <a
              href="tel:+919886012345"
              className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-amber-400 transition-colors px-3 py-2 rounded-lg bg-slate-900 border border-slate-800"
            >
              <PhoneCall className="w-4 h-4 text-amber-400 animate-pulse" />
              <div>
                <div className="text-[10px] text-slate-500 uppercase leading-none">24x7 Helpline</div>
                <div className="font-bold text-slate-200">+91 98860 12345</div>
              </div>
            </a>

            <button
              onClick={() => openBookingModal('driver')}
              className="relative inline-flex items-center justify-center px-6 py-2.5 text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 rounded-full shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-105 active:scale-95 transition-all duration-200"
            >
              Book Now
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => openBookingModal('driver')}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 rounded-full shadow-md"
            >
              Book Now
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-300 hover:text-white bg-slate-900 border border-slate-800"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-950/95 backdrop-blur-xl border-b border-slate-800 px-4 pt-3 pb-6 animate-in slide-in-from-top duration-200">
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`text-left px-4 py-3 rounded-xl text-base font-semibold transition-colors ${activePage === item.id
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-200 hover:bg-slate-900'
                  }`}
              >
                {item.label}
              </button>
            ))}

            <div className="pt-3 border-t border-slate-800 flex flex-col gap-3 mt-2">
              <button
                onClick={() => {
                  openBookingModal('driver');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-3 text-center text-slate-950 font-bold bg-amber-400 rounded-xl shadow-lg flex items-center justify-center gap-2"
              >
                <SteeringWheel className="w-4 h-4 text-slate-950" />
                <span>Book Driver Anna</span>
              </button>

              <button
                onClick={() => {
                  openBookingModal('vehicle');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-3 text-center text-slate-100 font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center justify-center gap-2"
              >
                <Car className="w-4 h-4 text-amber-400" />
                <span>Book a Vehicle</span>
              </button>

              <a
                href="tel:+919886012345"
                className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-amber-400 bg-slate-900 rounded-xl border border-amber-500/20"
              >
                <PhoneCall className="w-4 h-4" /> Call 24x7 Helpline: +91 98860 12345
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
