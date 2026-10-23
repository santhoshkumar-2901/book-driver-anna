import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, AlertCircle, Clock, MapPin, Calendar, CheckCircle2, 
  ArrowLeft, Car, Lock, Sparkles, RefreshCw, FileText
} from 'lucide-react';
import { SteeringWheel } from '../components/Icons';
import { apiClient } from '../services/apiClient';

export default function GuestPaymentPage({ bookingId: routeBookingId, onNavigateHome }) {
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null); // { code, message }
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let isMounted = true;
    document.title = 'Secure Payment Access | Book Driver Anna';

    // 1. Extract token from URL fragment (#token=<64-hex>)
    let rawToken = null;
    if (typeof window !== 'undefined' && window.location.hash) {
      const match = window.location.hash.match(/token=([0-9a-f]{64})/i);
      if (match && match[1]) {
        rawToken = match[1];
        // 2. Immediate History Scrubbing: scrub fragment from address bar so it does not persist in history
        try {
          window.history.replaceState(null, '', window.location.pathname);
        } catch (e) {}
      }
    }

    if (!rawToken) {
      if (isMounted) {
        setErrorState({
          code: 'MISSING_TOKEN',
          message: 'Access Denied: Payment access token is missing or incomplete in the URL.'
        });
        setLoading(false);
      }
      return;
    }

    // 3. Submit token in POST body for server-side validation and sanitized lookup
    apiClient.getGuestBookingSummary(rawToken)
      .then((res) => {
        if (!isMounted) return;
        if (res?.success && res?.data) {
          setSummary(res.data);
          setErrorState(null);
        } else {
          setErrorState({
            code: res?.error?.code || 'INVALID_LINK',
            message: res?.error?.message || 'Unable to retrieve booking payment summary.'
          });
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorState({
          code: err?.code || 'FETCH_ERROR',
          message: err?.message || 'Failed to validate payment link. Please try again.'
        });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [routeBookingId]);

  const handleHomeClick = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950">
      
      {/* Top Header / Breadcrumb Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleHomeClick}
            className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Home</span>
          </button>
          <span className="text-slate-600">/</span>
          <span className="text-xs sm:text-sm font-semibold text-slate-200">Payment Portal</span>
        </div>
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-full">
          <Lock className="w-3.5 h-3.5" />
          <span>256-bit Encrypted Link</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-10">
        <div className="w-full max-w-xl">

          {/* Loading State */}
          {loading && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center shadow-xl space-y-4 animate-in fade-in duration-200">
              <div className="w-12 h-12 border-3 border-amber-400/20 border-t-amber-400 rounded-full animate-spin mx-auto" />
              <h2 className="text-lg font-bold font-['Outfit'] text-slate-100">Verifying Payment Link</h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
                Validating cryptographic token security and retrieving authoritative booking details...
              </p>
            </div>
          )}

          {/* Error / Inactive Token State */}
          {!loading && errorState && (
            <div className="bg-slate-900/90 border border-red-500/30 rounded-2xl p-6 sm:p-8 text-center shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-full bg-red-950/80 border border-red-800/80 text-red-400 flex items-center justify-center mx-auto shadow-inner">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold font-['Outfit'] text-slate-100">
                  {errorState.code === 'TOKEN_EXPIRED' && 'Payment Link Expired'}
                  {errorState.code === 'TOKEN_REVOKED' && 'Payment Link Superseded'}
                  {errorState.code === 'BOOKING_CANCELLED' && 'Booking Cancelled'}
                  {errorState.code === 'MISSING_TOKEN' && 'Access Token Missing'}
                  {!['TOKEN_EXPIRED', 'TOKEN_REVOKED', 'BOOKING_CANCELLED', 'MISSING_TOKEN'].includes(errorState.code) && 'Unable to Access Payment Link'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
                  {errorState.message}
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 text-left space-y-1.5">
                <p className="font-semibold text-slate-300">Need assistance?</p>
                <p>
                  If you need to settle an outstanding fare or obtain a fresh payment link, please contact Book Driver Anna customer support or ask your Administrator to re-issue the link.
                </p>
              </div>

              <button
                onClick={handleHomeClick}
                className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Home</span>
              </button>
            </div>
          )}

          {/* Successful Summary State */}
          {!loading && !errorState && summary && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              
              {/* Card Banner */}
              <div className="bg-gradient-to-r from-amber-500/10 via-slate-800/40 to-slate-900 px-6 py-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400/90">Booking Reference</span>
                    <h1 className="text-base sm:text-lg font-bold font-['Outfit'] text-slate-100 tracking-wide">
                      {summary.bookingId}
                    </h1>
                  </div>
                </div>
                <div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                    summary.isPaid
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                      : 'bg-amber-950/80 text-amber-300 border-amber-700/80'
                  }`}>
                    {summary.isPaid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    <span>{summary.isPaid ? 'PAID' : 'PAYMENT DUE'}</span>
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 sm:p-7 space-y-6">

                {/* Amount Due Card */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Authoritative Total Fare</p>
                    <p className="text-2xl sm:text-3xl font-extrabold font-['Outfit'] text-amber-400">
                      ₹{summary.calculatedFare.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-slate-400 space-y-1">
                    <p className="flex items-center justify-end gap-1 text-slate-300 font-medium">
                      <span>Trip Status:</span>
                      <span className="text-amber-400 font-semibold">{summary.bookingStatus}</span>
                    </p>
                    {summary.expiresAt && !summary.isPaid && (
                      <p className="text-[10px] text-slate-500">
                        Link valid until: {new Date(summary.expiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Sanitized Trip Details */}
                <div className="space-y-3.5 text-xs sm:text-sm">
                  <div className="flex items-start gap-3 py-2 border-b border-slate-800/50">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div className="flex-1 flex justify-between">
                      <span className="text-slate-400">Service</span>
                      <span className="font-semibold text-slate-200">{summary.serviceName}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 py-2 border-b border-slate-800/50">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div className="flex-1 flex justify-between">
                      <span className="text-slate-400">Scheduled Date & Time</span>
                      <span className="font-semibold text-slate-200">{summary.date} • {summary.time}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 py-2 border-b border-slate-800/50">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 flex justify-between">
                      <span className="text-slate-400">Pickup Area</span>
                      <span className="font-semibold text-slate-200 text-right">{summary.pickupArea}</span>
                    </div>
                  </div>

                  {summary.dropLocation && (
                    <div className="flex items-start gap-3 py-2 border-b border-slate-800/50">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="flex-1 flex justify-between">
                        <span className="text-slate-400">Drop Destination</span>
                        <span className="font-semibold text-slate-200 text-right">{summary.dropLocation}</span>
                      </div>
                    </div>
                  )}

                  {summary.assignedDriverName && (
                    <div className="flex items-start gap-3 py-2">
                      <SteeringWheel className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1 flex justify-between">
                        <span className="text-slate-400">Assigned Driver Anna</span>
                        <span className="font-semibold text-slate-200">{summary.assignedDriverName}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Phase Notice / Action Gate */}
                {summary.isPaid ? (
                  <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-4 text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>This booking is fully paid</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Thank you for riding with Book Driver Anna. A payment receipt has been issued.
                    </p>
                  </div>
                ) : (
                  <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-4 text-center space-y-2.5">
                    <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-sm">
                      <Sparkles className="w-4 h-4" />
                      <span>Payment Checkout Groundwork (Phase 2 Active)</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Your guest booking access token has been cryptographically validated. The interactive dummy payment gateway simulator will be activated in Phase 3.
                    </p>
                  </div>
                )}

                {/* Back to Home CTA */}
                <div className="pt-2">
                  <button
                    onClick={handleHomeClick}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Return to Book Driver Anna Home</span>
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer copyright */}
      <footer className="py-4 text-center text-[11px] text-slate-500 border-t border-slate-900">
        Book Driver Anna • Secure Guest Payment Infrastructure
      </footer>
    </div>
  );
}
