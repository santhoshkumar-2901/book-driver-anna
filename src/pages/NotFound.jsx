import React, { useEffect, useState } from 'react';
import { Home, ArrowRight, Compass, Car, Phone, MapPin, AlertCircle } from 'lucide-react';
import { SteeringWheel } from '../components/Icons';

/**
 * Production 404 Not Found Page
 * Matches Book Driver Anna design language (typography, colors, spacing, borders, shadows).
 * Sets document.title on mount and provides clean navigation back to valid routes.
 */
export default function NotFound({ 
  onNavigateHome, 
  onNavigateServices, 
  onNavigateContact,
  openBookingModal 
}) {
  const [currentPath, setCurrentPath] = useState('');

  useEffect(() => {
    // Save previous document title and set 404 title
    const prevTitle = document.title;
    document.title = '404 - Page Not Found | Book Driver Anna';

    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname);
    }

    return () => {
      document.title = prevTitle || 'Book Driver Anna | Professional Drivers on Demand';
    };
  }, []);

  const handleGoHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const quickLinks = [
    {
      title: 'Our Driver Services',
      desc: 'City drives, outstation trips, airport transfers & monthly drivers.',
      action: onNavigateServices,
      icon: Car
    },
    {
      title: 'Book Driver Anna',
      desc: 'Get a verified, professional chauffeur dispatched in 15-20 mins.',
      action: () => openBookingModal?.('driver'),
      icon: SteeringWheel
    },
    {
      title: '24/7 Bengaluru Support',
      desc: 'Contact our central operations hub at Indiranagar or reach dispatch.',
      action: onNavigateContact,
      icon: Phone
    }
  ];

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center px-4 py-12 sm:py-20 bg-slate-950 text-slate-100 selection:bg-amber-400 selection:text-slate-950">
      <div className="max-w-2xl w-full text-center space-y-6">
        
        {/* Error Indicator & Path Badge */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Compass className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.2] animate-spin" style={{ animationDuration: '24s' }} />
          </div>

          {currentPath && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="truncate max-w-[260px] sm:max-w-md">Route: {currentPath}</span>
            </div>
          )}
        </div>

        {/* 404 Heading & Description */}
        <div className="space-y-3">
          <div className="text-6xl sm:text-8xl font-black text-amber-400 font-['Outfit'] tracking-tight select-none">
            404
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white font-['Outfit'] tracking-tight">
            Page Not Found
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto leading-relaxed">
            The page you're looking for doesn't exist or may have been moved.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            id="not-found-go-home-btn"
            onClick={handleGoHome}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 hover:shadow-amber-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Go Home</span>
          </button>

          {onNavigateServices && (
            <button
              type="button"
              id="not-found-services-btn"
              onClick={onNavigateServices}
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 hover:border-slate-700 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Car className="w-4 h-4 text-amber-400" />
              <span>Browse Services</span>
            </button>
          )}
        </div>

        {/* Quick Nav Cards */}
        <div className="pt-8 border-t border-slate-900 text-left">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 text-center sm:text-left">
            Or continue where you left off
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {quickLinks.map((link, idx) => {
              const Icon = link.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={link.action}
                  className="p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-amber-400/40 text-left transition-all group cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      {link.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {link.desc}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Visit</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dispatch Footnote */}
        <div className="pt-4 text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <MapPin className="w-3 h-3 text-slate-400 inline" />
          <span>Serving all 25+ neighborhoods across Bengaluru Urban</span>
        </div>

      </div>
    </div>
  );
}
