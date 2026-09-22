import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  X, 
  MapPin, 
  LogOut, 
  LogIn, 
  UserPlus, 
  Sun, 
  Moon, 
  Home, 
  Briefcase, 
  Info, 
  PhoneCall, 
  ShieldCheck, 
  ChevronRight, 
  User 
} from 'lucide-react';
import { SteeringWheel } from './Icons';
import { useTheme } from '../utils/themeContext';

export default function Navbar({
  activePage,
  setActivePage,
  openBookingModal,
  openCancelModal,
  clientUser,
  onLogout,
  onOpenProfile,
  onOpenAuth
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme, isDark } = useTheme();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'services', label: 'Services', icon: Briefcase },
    { id: 'about', label: 'About', icon: Info },
    { id: 'contact', label: 'Contact', icon: PhoneCall },
  ];

  const handleNavClick = (pageId) => {
    setActivePage(pageId);
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Close mobile drawer on Escape key and prevent background body scroll when open on mobile
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/95 backdrop-blur-md border-b border-slate-800 transition-colors">
      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-4">

          {/* Brand Logo - Responsive scaling across mobile, tablet, and desktop */}
          <div
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group shrink-0 min-w-0"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleNavClick('home')}
            aria-label="Book Driver Anna Home"
          >
            <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-500 text-slate-950 font-bold shadow-sm shrink-0 group-hover:scale-105 transition-transform">
              <SteeringWheel className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-base sm:text-lg lg:text-xl tracking-tight text-white font-['Outfit'] whitespace-nowrap">
                  Book Driver <span className="text-amber-500">Anna</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide hidden sm:flex items-center gap-1 truncate">
                <MapPin className="w-2.5 h-2.5 text-amber-500 inline shrink-0" /> Bengaluru Urban
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links (Visible on Laptop/Desktop: lg and up) */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2" aria-label="Main Navigation">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-800 text-amber-400 font-semibold shadow-inner'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900/80'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Action Items (Right Side): Adaptive for all screen sizes */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3 shrink-0">

            {/* Authenticated Client User Pill */}
            {clientUser ? (
              <div className="flex items-center gap-1 sm:gap-1.5 pl-1 sm:pl-2 border-l border-slate-800">
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="flex items-center gap-1.5 sm:gap-2 py-1 sm:py-1.5 px-2 sm:px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 transition-colors cursor-pointer min-h-[38px] sm:min-h-[40px]"
                  title={`Account: ${clientUser.name} (${clientUser.phone})`}
                  aria-label={`Open account profile for ${clientUser.name}`}
                >
                  <div className="w-6 h-6 rounded-full bg-slate-800 border border-amber-500/40 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                    {clientUser.name ? clientUser.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="hidden sm:inline-block text-xs font-semibold text-slate-200 max-w-[80px] md:max-w-[110px] truncate">
                    {clientUser.name ? clientUser.name.split(' ')[0] : 'Account'}
                  </span>
                </button>
                <button
                  onClick={onLogout}
                  title="Logout"
                  className="p-2 sm:p-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center"
                  aria-label="Logout"
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            ) : (
              /* Unauthenticated Auth Buttons */
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* On small phones, show compact Login button; on tablets/desktops show both Login & Signup */}
                <button
                  type="button"
                  onClick={() => onOpenAuth && onOpenAuth('login')}
                  className="flex items-center gap-1.5 py-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-semibold text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer min-h-[38px] sm:min-h-[40px]"
                >
                  <LogIn className="w-3.5 h-3.5 text-amber-500" />
                  <span className="inline">Login</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth && onOpenAuth('signup')}
                  className="hidden sm:inline-flex btn-primary py-1.5 px-3 sm:px-3.5 text-xs items-center gap-1.5 min-h-[38px] sm:min-h-[40px]"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Signup</span>
                </button>
              </div>
            )}

            {/* Theme Toggle Button (Icon-Only as verified by tests) */}
            <button
              type="button"
              id="navbar-theme-toggle-btn"
              onClick={toggleTheme}
              className="p-2 sm:p-2.5 rounded-lg text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer flex items-center justify-center shadow-sm shrink-0 min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] hover:scale-105 active:scale-95"
              title="Toggle Theme"
              aria-label="Toggle Theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400 stroke-[2.2]" />
              ) : (
                <Moon className="w-4 h-4 text-amber-500 stroke-[2.2]" />
              )}
            </button>

            {/* Mobile / Tablet Menu Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 sm:p-2.5 rounded-lg text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 lg:hidden cursor-pointer shrink-0 min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center transition-colors"
              aria-label="Toggle Navigation Menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-amber-400" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile / Tablet Navigation Overlay & Drawer */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop Scrim */}
          <div
            className="fixed inset-0 top-16 sm:top-20 bg-slate-950/70 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation Menu"
            className="relative z-40 lg:hidden bg-slate-950/98 border-b border-slate-800 shadow-2xl backdrop-blur-xl px-4 py-4 space-y-4 max-h-[calc(100dvh-4rem)] sm:max-h-[calc(100dvh-5rem)] overflow-y-auto"
          >
            {/* Primary Navigation Links */}
            <div className="flex flex-col gap-1.5" role="navigation" aria-label="Mobile Navigation">
              {navItems.map((item) => {
                const isActive = activePage === item.id;
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-600'}`} />
                  </button>
                );
              })}
            </div>

            {/* User Account / Auth Section in Mobile Drawer */}
            {clientUser ? (
              <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2.5">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-amber-500/40 text-amber-400 font-bold text-sm flex items-center justify-center shrink-0">
                      {clientUser.name ? clientUser.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-100 text-sm truncate">{clientUser.name}</div>
                      <div className="text-xs text-slate-400 truncate">{clientUser.phone}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="btn-danger py-1.5 px-3 text-xs shrink-0"
                    aria-label="Log out of account"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenProfile) onOpenProfile();
                    setMobileMenuOpen(false);
                  }}
                  className="btn-secondary w-full py-2.5 text-xs flex items-center justify-center gap-2"
                >
                  <User className="w-4 h-4 text-amber-500" />
                  <span>My Profile & Ride History</span>
                </button>
              </div>
            ) : (
              <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenAuth) onOpenAuth('login');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold text-slate-200 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-amber-500" />
                  <span>Log In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenAuth) onOpenAuth('signup');
                    setMobileMenuOpen(false);
                  }}
                  className="btn-primary py-2.5 px-3 text-xs flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Sign Up</span>
                </button>
              </div>
            )}

            {/* Quick Booking CTA */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  handleNavClick('home');
                  if (openBookingModal) openBookingModal('driver');
                }}
                className="btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-2"
              >
                <SteeringWheel className="w-4 h-4 stroke-[2.2]" />
                <span>Book a Professional Driver</span>
              </button>
            </div>

            {/* Bengaluru Verified Assurance Banner */}
            <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Bengaluru's Premier Verified Chauffeurs (24x7)</span>
            </div>
          </div>
        </>
      )}
    </header>
  );
}

