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
    <header className="sticky top-0 z-40 bg-slate-950 border-b border-slate-800 transition-all">
      {/* Top Utility Bar */}
      <div className="bg-slate-900 border-b border-slate-800/80 text-xs py-1 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-medium">24/7 Dispatch active across 15 Bengaluru zones</span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-slate-400">
            <a href="tel:+919886012345" className="hover:text-amber-400 transition-colors flex items-center gap-1.5 font-medium">
              <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
              <span>Helpline: +91 98860 12345</span>
            </a>
            <span className="text-slate-700">|</span>
            <button 
              onClick={openCancelModal}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Cancel Booking (No Fee)
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Brand Logo */}
          <div
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-3 cursor-pointer group shrink-0"
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-bold shrink-0">
              <Car className="w-5 h-5 stroke-[2.2]" />
              <div className="absolute -bottom-1 -right-1 bg-red-600 text-white rounded-full p-0.5 border border-slate-950">
                <ShieldCheck className="w-3 h-3" />
              </div>
            </div>
            <div>
              <div className="font-bold text-lg sm:text-xl tracking-tight text-white font-['Outfit']">
                Book Driver <span className="text-amber-400">Anna</span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-red-400 inline" /> Bengaluru Verified Drivers
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
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${isActive
                      ? 'text-amber-400 bg-amber-400/10 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                    }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">

            {/* Cancel Booking Quick Button */}
            <button
              onClick={openCancelModal}
              className="hidden xl:flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              title="Lookup and manage your booking"
            >
              <Ban className="w-3.5 h-3.5 text-slate-400" />
              <span>Cancel Booking</span>
            </button>

            {/* Book Now CTA */}
            <button
              onClick={() => openBookingModal('driver')}
              className="inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Book a Driver
            </button>

            {/* Client User Profile Pill & Logout */}
            {clientUser && (
              <div className="flex items-center gap-1.5 pl-2 sm:pl-3 border-l border-slate-800">
                <button 
                  type="button"
                  onClick={onOpenProfile}
                  className="flex items-center gap-1.5 sm:gap-2 py-1 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors cursor-pointer"
                  title={`View profile for ${clientUser.name}`}
                >
                  <div className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                    {clientUser.name ? clientUser.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="hidden sm:inline-block text-xs font-medium text-white max-w-[90px] truncate">
                    {clientUser.name ? clientUser.name.split(' ')[0] : 'Client'}
                  </span>
                </button>
                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-300 hover:text-white bg-slate-900 border border-slate-800 lg:hidden cursor-pointer shrink-0"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-950 border-b border-slate-800 px-4 pt-3 pb-6">
          <div className="flex flex-col gap-1.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${activePage === item.id
                    ? 'bg-amber-400/10 text-amber-400 font-semibold'
                    : 'text-slate-200 hover:bg-slate-900'
                  }`}
              >
                {item.label}
              </button>
            ))}

            {clientUser && (
              <div 
                onClick={() => {
                  if (onOpenProfile) onOpenProfile();
                  setMobileMenuOpen(false);
                }}
                className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between mt-2 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center">
                    {clientUser.name ? clientUser.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">
                      {clientUser.name}
                    </div>
                    <div className="text-[11px] text-slate-400">{clientUser.phone} • {clientUser.area}</div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-red-400 hover:bg-red-500/10 flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 flex flex-col gap-2 mt-2">
              <button
                onClick={() => {
                  openBookingModal('driver');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2.5 text-center text-slate-950 font-semibold bg-amber-400 hover:bg-amber-300 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors"
              >
                <SteeringWheel className="w-4 h-4 text-slate-950" />
                <span>Book a Driver</span>
              </button>

              <button
                onClick={() => {
                  openBookingModal('vehicle');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2.5 text-center text-slate-200 font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors"
              >
                <Car className="w-4 h-4 text-amber-400" />
                <span>Rent a Vehicle</span>
              </button>

              <button
                onClick={() => {
                  openBookingModal('class');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2.5 text-center text-slate-200 font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors"
              >
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                <span>Driving Classes</span>
              </button>

              <button
                onClick={() => {
                  openCancelModal();
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2 text-center text-slate-400 hover:text-white border border-slate-800 rounded-lg flex items-center justify-center gap-2 text-xs transition-colors"
              >
                <Ban className="w-3.5 h-3.5 text-slate-400" />
                <span>Cancel / Manage Booking</span>
              </button>

              <a
                href="tel:+919886012345"
                className="flex items-center justify-center gap-2 py-2 text-xs font-medium text-amber-400 bg-slate-900/50 rounded-lg border border-slate-800"
              >
                <PhoneCall className="w-3.5 h-3.5" /> Helpline: +91 98860 12345
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
