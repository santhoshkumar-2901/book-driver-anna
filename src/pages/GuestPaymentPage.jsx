import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, AlertCircle, Clock, MapPin, Calendar, CheckCircle2, 
  ArrowLeft, Car, Lock, Sparkles, RefreshCw, FileText, CreditCard, Loader2
} from 'lucide-react';
import { SteeringWheel } from '../components/Icons';
import { apiClient } from '../services/apiClient';
import DummyRazorpayModal from '../components/DummyRazorpayModal';

export default function GuestPaymentPage({ bookingId: routeBookingId, onNavigateHome }) {
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null); // { code, message }
  const [summary, setSummary] = useState(null);
  const [guestToken, setGuestToken] = useState(null);

  // Simulator Modal State
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [initiatingOrder, setInitiatingOrder] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [paymentReceipt, setPaymentReceipt] = useState(null);

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

    setGuestToken(rawToken);

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

  const handleLaunchCheckout = async () => {
    if (!guestToken || initiatingOrder) return;
    setInitiatingOrder(true);
    setOrderError(null);

    try {
      const res = await apiClient.createGuestPaymentOrder(guestToken);
      if (res?.success && res?.data) {
        setOrderData(res.data);
        setIsSimulatorOpen(true);
      } else {
        setOrderError(res?.error?.message || 'Failed to initialize test payment order.');
      }
    } catch (err) {
      setOrderError(err?.message || 'Could not launch payment simulator. Please try again.');
    } finally {
      setInitiatingOrder(false);
    }
  };

  const handlePaymentSuccess = (result) => {
    setPaymentReceipt(result);
    setIsSimulatorOpen(false);
    setSummary((prev) => (prev ? { ...prev, isPaid: true, paymentStatus: 'PAID' } : prev));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950">
      
      {/* Top Brand Banner */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black text-base shadow-md shadow-amber-400/20">
              <SteeringWheel className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="font-['Outfit'] font-extrabold text-base tracking-tight text-white block leading-none">
                BOOK DRIVER <span className="text-amber-400">ANNA</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase block mt-0.5">
                Secure Guest Payment Gateway
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Session</span>
            </span>
            <button
              onClick={handleHomeClick}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors px-2 py-1.5 rounded-lg cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="w-full max-w-lg">

          {/* Loading Skeleton */}
          {loading && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-2xl animate-pulse">
              <div className="w-12 h-12 rounded-full border-3 border-amber-400/20 border-t-amber-400 animate-spin mx-auto" />
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-slate-200">Validating Payment Token</p>
                <p className="text-xs text-slate-400">Checking cryptographic signature and booking records...</p>
              </div>
            </div>
          )}

          {/* Error / Invalidation State */}
          {!loading && errorState && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5 text-center animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold font-['Outfit'] text-slate-100">
                  {errorState.code === 'TOKEN_EXPIRED' && 'Payment Link Expired'}
                  {errorState.code === 'TOKEN_REVOKED' && 'Payment Link Revoked'}
                  {errorState.code === 'BOOKING_CANCELLED' && 'Booking Cancelled'}
                  {errorState.code === 'MISSING_TOKEN' && 'Access Token Missing'}
                  {!['TOKEN_EXPIRED', 'TOKEN_REVOKED', 'BOOKING_CANCELLED', 'MISSING_TOKEN'].includes(errorState.code) && 'Access Denied'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
                  {errorState.message}
                </p>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">Need support with this booking?</p>
                <p>To settle an outstanding fare or obtain a fresh secure link, please reach out to Book Driver Anna operations.</p>
              </div>

              <button
                onClick={handleHomeClick}
                className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-400/10"
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
                  <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>This booking is fully paid</span>
                    </div>
                    <div className="text-xs text-slate-300 space-y-1 text-center">
                      <p>Thank you for riding with Book Driver Anna. A payment receipt has been issued.</p>
                      {paymentReceipt?.paymentId && (
                        <p className="text-[11px] text-slate-400">
                          Transaction ID: <span className="font-mono text-emerald-300">{paymentReceipt.paymentId}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orderError && (
                      <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <span>{orderError}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleLaunchCheckout}
                      disabled={initiatingOrder}
                      className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 disabled:opacity-50"
                    >
                      {initiatingOrder ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Initializing Payment Simulator...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          <span>Pay Now — ₹{summary.calculatedFare.toFixed(2)} (Test Simulator)</span>
                        </>
                      )}
                    </button>

                    <p className="text-[11px] text-center text-slate-400">
                      🔒 Secure checkout simulator • Verified guest token session
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

      {/* Simulator Modal */}
      {isSimulatorOpen && orderData && (
        <DummyRazorpayModal
          isOpen={isSimulatorOpen}
          token={guestToken}
          orderData={orderData}
          onClose={() => setIsSimulatorOpen(false)}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

      {/* Footer copyright */}
      <footer className="py-4 text-center text-[11px] text-slate-500 border-t border-slate-900">
        Book Driver Anna • Secure Guest Payment Infrastructure
      </footer>
    </div>
  );
}
