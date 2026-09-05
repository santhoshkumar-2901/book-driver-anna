import React, { useState } from 'react';
import { Car, PhoneCall, Menu, X, ShieldCheck, MapPin, GraduationCap, Ban, LogOut, User } from 'lucide-react';
import { SteeringWheel } from './Icons';

export default function Navbar({ 
  activePage, 
  setActivePage, 
  openBookingModal, 
  openCancelModal, 
  clientUser, 
  onLogout,
  onOpenProfile
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'services', label: 'Services & Rates' },
    { id: 'about', label: 'About & Standards' },
    { id: 'contact', label: 'Contact & Hubs' },
  ];

  const handleNavClick = (pageId) => {
    setActivePage(pageId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 max-w-full overflow-x-hidden">
      {/* Top Utility Bar */}
      <div className="bg-slate-900/80 border-b border-slate-800/80 text-slate-300 text-xs py-1.5 px-3 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4 overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs min-w-0 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-slate-400 shrink-0">Bengaluru Desk:</span>
            <span className="text-slate-200 font-medium truncate">Drivers, Rentals & Driving Academy</span>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-[11px] shrink-0">
            <a 
              href="tel:+919886012345" 
              className="flex items-center gap-1.5 text-slate-300 hover:text-amber-400 transition-colors"
            >
              <PhoneCall className="w-3 h-3 text-amber-500" />
              <span>24/7 Helpline: +91 98860 12345</span>
            </a>
            <span className="text-slate-700">|</span>
            <button 
              onClick={() => openBookingModal('class')}
              className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer flex items-center gap-1"
            >
              <GraduationCap className="w-3 h-3 text-amber-500" />
              <span>Driving Classes</span>
            </button>
            <span className="text-slate-700">|</span>
            <button 
              onClick={openCancelModal}
              className="text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
            >
              Manage / Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Header */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15 sm:h-18 gap-2">

          {/* Brand Logo */}
          <div
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group shrink-0 min-w-0"
          >
            <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-500 text-slate-950 font-bold shadow-sm shrink-0">
              <SteeringWheel className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-base sm:text-xl tracking-tight text-white font-['Outfit'] whitespace-nowrap">
                  Book Driver <span className="text-amber-500">Anna</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide flex items-center gap-1 truncate">
                <MapPin className="w-2.5 h-2.5 text-slate-500 inline shrink-0" /> Bengaluru Urban
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Header Action Items */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">

            {/* Cancel Booking Quick Link (Desktop) */}
            <button
              onClick={openCancelModal}
              className="hidden xl:inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5 text-slate-500" />
              <span>Cancel Trip</span>
            </button>

            {/* Book a Driver Primary Button - Desktop & Tablet */}
            <button
              onClick={() => openBookingModal('driver')}
              className="btn-primary hidden sm:inline-flex py-2 px-3.5 text-xs sm:text-sm"
            >
              <SteeringWheel className="w-4 h-4" />
              <span>Book a Driver</span>
            </button>

            {/* User Profile Pill & Logout (if logged in) */}
            {clientUser && (
              <div className="flex items-center gap-1 sm:gap-1.5 pl-1.5 sm:pl-3 border-l border-slate-800">
                <button 
                  type="button"
                  onClick={onOpenProfile}
                  className="flex items-center gap-1.5 sm:gap-2 py-1 sm:py-1.5 px-2 sm:px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 transition-colors cursor-pointer"
                  title={`Account: ${clientUser.name} (${clientUser.phone})`}
                >
                  <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-amber-500 font-bold text-[10px] sm:text-xs flex items-center justify-center shrink-0">
                    {clientUser.name ? clientUser.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="hidden md:inline-block text-xs font-semibold text-slate-200 max-w-[90px] truncate">
                    {clientUser.name ? clientUser.name.split(' ')[0] : 'Account'}
                  </span>
                </button>
                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            )}

            {/* Mobile / Tablet Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 lg:hidden cursor-pointer shrink-0"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-950 border-b border-slate-800 px-4 pt-3 pb-6 space-y-3">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activePage === item.id
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {clientUser && (
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <button 
                onClick={() => {
                  if (onOpenProfile) onOpenProfile();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-2.5 text-left text-xs text-slate-200 hover:text-amber-400 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-slate-800 text-amber-500 font-bold text-xs flex items-center justify-center">
                  {clientUser.name ? clientUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="font-semibold">{clientUser.name}</div>
                  <div className="text-[11px] text-slate-400">{clientUser.phone}</div>
                </div>
              </button>
              <button
                onClick={() => {
                  onLogout();
                  setMobileMenuOpen(false);
                }}
                className="btn-danger py-1 px-2.5 text-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
            <button
              onClick={() => {
                openBookingModal('driver');
                setMobileMenuOpen(false);
              }}
              className="btn-primary w-full"
            >
              <SteeringWheel className="w-4 h-4" />
              <span>Book a Driver Anna</span>
            </button>

            <button
              onClick={() => {
                openBookingModal('vehicle');
                setMobileMenuOpen(false);
              }}
              className="btn-secondary w-full"
            >
              <Car className="w-4 h-4 text-amber-500" />
              <span>Rent a Vehicle</span>
            </button>

            <button
              onClick={() => {
                openBookingModal('class');
                setMobileMenuOpen(false);
              }}
              className="btn-outline w-full"
            >
              <GraduationCap className="w-4 h-4 text-amber-500" />
              <span>Driving Classes</span>
            </button>

            <button
              onClick={() => {
                openCancelModal();
                setMobileMenuOpen(false);
              }}
              className="w-full py-2 text-center text-xs text-slate-400 hover:text-red-400 transition-colors flex items-center justify-center gap-1.5"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Cancel or Modify Booking</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
