import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, AlertCircle, Clock, MapPin, Calendar, CheckCircle2, 
  ArrowLeft, Car, Lock, Sparkles, RefreshCw, FileText, CreditCard, Loader2,
  AlertTriangle, Info, ShieldAlert
} from 'lucide-react';
import { SteeringWheel } from '../components/Icons';
import { apiClient } from '../services/apiClient';
import { loadRazorpayCheckoutScript } from '../utils/razorpay';
import DummyRazorpayModal from '../components/DummyRazorpayModal';

export default function GuestPaymentPage({ bookingId: routeBookingId, onNavigateHome }) {
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null); // { code, message }
  const [summary, setSummary] = useState(null);
  const [guestToken, setGuestToken] = useState(null);

  // Real Razorpay Checkout State
  const [isRazorpayLoading, setIsRazorpayLoading] = useState(false);
  const [isCheckoutActive, setIsCheckoutActive] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [gatewayDisabledNotice, setGatewayDisabledNotice] = useState(null);
  const [cancellationNotice, setCancellationNotice] = useState(null);
  const [pendingVerificationData, setPendingVerificationData] = useState(null);
  const [paymentReceipt, setPaymentReceipt] = useState(null);

  // Re-entrancy protection ref (guards against rapid multi-clicks before state flush)
  const isProcessingRef = useRef(false);

  // Development/Test Environment Simulator State (strictly restricted to DEV)
  const isDevMode = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simulatorOrderData, setSimulatorOrderData] = useState(null);
  const [initiatingSimulator, setInitiatingSimulator] = useState(false);
  const [simulatorError, setSimulatorError] = useState(null);

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

  /**
   * Primary Flow: Real Razorpay Standard Checkout
   */
  const handleLaunchRazorpayCheckout = async () => {
    if (!guestToken || isProcessingRef.current || isRazorpayLoading || isVerifyingPayment) {
      return;
    }

    isProcessingRef.current = true;
    setIsRazorpayLoading(true);
    setCheckoutError(null);
    setCancellationNotice(null);
    setGatewayDisabledNotice(null);

    try {
      // 1. Request server-calculated order from backend using authenticated guest token
      const idempotencyKey = `idem-rzp-${guestToken.slice(0, 8)}-${Date.now()}`;
      let orderRes;
      try {
        orderRes = await apiClient.createRazorpayGuestOrder(guestToken, idempotencyKey);
      } catch (apiErr) {
        // Handle Gateway Disabled (403 GATEWAY_DISABLED) fail-closed response
        if (apiErr?.code === 'GATEWAY_DISABLED' || apiErr?.code === 'GATEWAY_NOT_CONFIGURED' || apiErr?.status === 403 || apiErr?.status === 503) {
          setGatewayDisabledNotice(
            'Online card and UPI payments are temporarily unavailable. You can pay your assigned Driver Anna directly via cash or UPI at the completion of your ride.'
          );
          return;
        }
        if (apiErr?.code === 'TOKEN_EXPIRED') {
          setErrorState({
            code: 'TOKEN_EXPIRED',
            message: 'This payment link has expired. To settle your outstanding fare, please contact Book Driver Anna support.'
          });
          return;
        }
        throw apiErr;
      }

      if (!orderRes?.success || !orderRes?.data) {
        if (orderRes?.error?.code === 'GATEWAY_DISABLED' || orderRes?.error?.code === 'GATEWAY_NOT_CONFIGURED') {
          setGatewayDisabledNotice(
            'Online card and UPI payments are temporarily unavailable. You can pay your assigned Driver Anna directly via cash or UPI at the completion of your ride.'
          );
          return;
        }
        setCheckoutError(orderRes?.error?.message || 'Failed to initialize payment order with gateway.');
        return;
      }

      const orderData = orderRes.data;

      // Handle already succeeded booking
      if (orderData.isPaid || orderData.alreadySucceeded) {
        setPaymentReceipt({
          paymentId: orderData.paymentId || orderData.orderId,
          amount: orderData.amount,
          currency: orderData.currency,
          bookingId: summary?.bookingId
        });
        setSummary((prev) => (prev ? { ...prev, isPaid: true, paymentStatus: 'PAID' } : prev));
        return;
      }

      // 2. Dynamically load official Razorpay Checkout SDK
      const scriptReady = await loadRazorpayCheckoutScript();
      if (!scriptReady || typeof window.Razorpay !== 'function') {
        setCheckoutError(
          'Unable to load the secure Razorpay payment gateway script. If you are using an ad-blocker or strict tracking protection, please allow checkout.razorpay.com and try again.'
        );
        return;
      }

      // 3. Configure Razorpay Standard Checkout options with server-supplied attributes
      const options = {
        key: orderData.keyId,
        amount: orderData.amountInPaise,
        currency: orderData.currency || 'INR',
        name: 'Book Driver Anna',
        description: `Ride Payment - ${summary?.bookingId || orderData.bookingId}`,
        image: '/favicon.ico',
        order_id: orderData.orderId,
        prefill: {
          name: summary?.customerName || '',
          contact: summary?.customerPhone || ''
        },
        notes: {
          bookingId: String(summary?.bookingId || orderData.bookingId),
          attemptId: orderData.attemptId
        },
        theme: {
          color: '#f59e0b'
        },
        modal: {
          ondismiss: () => {
            setIsCheckoutActive(false);
            setIsRazorpayLoading(false);
            isProcessingRef.current = false;
            setCancellationNotice('Payment checkout was closed. If your payment did not go through, you can retry whenever you are ready. If funds were deducted or your bank authorization completed, please click "Re-check Payment Status" below to reconcile.');
          },
          escape: true,
          backdropclose: false
        },
        handler: async (response) => {
          setIsCheckoutActive(false);
          const callbackPayload = {
            attemptId: orderData.attemptId,
            orderId: response?.razorpay_order_id || orderData.orderId,
            paymentId: response?.razorpay_payment_id,
            signature: response?.razorpay_signature
          };
          setPendingVerificationData(callbackPayload);
          await executeBackendSignatureVerification(callbackPayload);
        }
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', (failRes) => {
        const desc = failRes?.error?.description || failRes?.error?.reason || 'Transaction declined or failed at the bank.';
        setCheckoutError(`Payment Failed: ${desc}`);
        setIsCheckoutActive(false);
        setIsRazorpayLoading(false);
        isProcessingRef.current = false;
      });

      setIsCheckoutActive(true);
      rzp.open();
    } catch (err) {
      setCheckoutError(err?.message || 'An error occurred while launching payment checkout.');
    } finally {
      setIsRazorpayLoading(false);
      // If modal was not opened (e.g. error happened beforehand), reset lock
      if (!isCheckoutActive) {
        isProcessingRef.current = false;
      }
    }
  };

  /**
   * Authoritative Backend Verification of Checkout Signature
   */
  const executeBackendSignatureVerification = async ({ attemptId, orderId, paymentId, signature }) => {
    if (!guestToken) return;

    setIsVerifyingPayment(true);
    setCheckoutError(null);

    try {
      const verifyRes = await apiClient.verifyRazorpayGuestSignature({
        token: guestToken,
        attemptId,
        orderId,
        paymentId,
        signature
      });

      if (verifyRes?.success && verifyRes?.data?.isPaid) {
        setPaymentReceipt(verifyRes.data);
        setSummary((prev) => (prev ? { ...prev, isPaid: true, paymentStatus: 'PAID' } : prev));
        setPendingVerificationData(null);
        setCheckoutError(null);
        setCancellationNotice(null);
      } else {
        const errorMsg = verifyRes?.error?.message || 'Payment verification failed.';
        setCheckoutError(`Verification Notice: ${errorMsg}`);
      }
    } catch (err) {
      // Network or gateway error during verification
      setCheckoutError(
        `Network issue during verification: ${err?.message || 'Connection interrupted'}. If your account was debited, click "Re-check Payment Status" below to reconcile with the bank.`
      );
    } finally {
      setIsVerifyingPayment(false);
      isProcessingRef.current = false;
    }
  };

  /**
   * Reconcile/Retry Payment Status
   */
  const handleReconcileStatus = async () => {
    if (isVerifyingPayment || !guestToken || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setIsVerifyingPayment(true);

    try {
      if (pendingVerificationData) {
        await executeBackendSignatureVerification(pendingVerificationData);
        return;
      }

      const res = await apiClient.getGuestBookingSummary(guestToken);
      if (res?.success && res?.data?.isPaid) {
        setSummary(res.data);
        setPaymentReceipt({
          paymentId: res.data.paymentId || res.data.bookingId,
          amount: res.data.calculatedFare,
          currency: 'INR',
          bookingId: res.data.bookingId
        });
        setCheckoutError(null);
        setCancellationNotice(null);
      } else {
        setCheckoutError('Payment has not yet been confirmed by the bank or gateway. If you were charged, please allow a few moments for bank reconciliation or contact support.');
      }
    } catch (err) {
      setCheckoutError('Unable to re-check booking status at this time. Please check your network connection.');
    } finally {
      setIsVerifyingPayment(false);
      isProcessingRef.current = false;
    }
  };

  /**
   * Development-Only Phase 3 Simulator Launch
   */
  const handleLaunchDevSimulator = async () => {
    if (!isDevMode || !guestToken || initiatingSimulator) return;
    setInitiatingSimulator(true);
    setSimulatorError(null);

    try {
      const res = await apiClient.createGuestPaymentOrder(guestToken);
      if (res?.success && res?.data) {
        setSimulatorOrderData(res.data);
        setIsSimulatorOpen(true);
      } else {
        setSimulatorError(res?.error?.message || 'Failed to initialize test payment simulator.');
      }
    } catch (err) {
      setSimulatorError(err?.message || 'Could not launch payment simulator. Please try again.');
    } finally {
      setInitiatingSimulator(false);
    }
  };

  const handleSimulatorSuccess = (result) => {
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

                {/* Payment Action Section */}
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
                  <div className="space-y-4">
                    {/* Gateway Disabled Warning Notice */}
                    {gatewayDisabledNotice && (
                      <div className="bg-amber-950/50 border border-amber-800/70 rounded-xl p-4 text-xs text-amber-200 space-y-2 animate-in fade-in">
                        <div className="flex items-center gap-2 font-bold text-amber-300">
                          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                          <span>Online Payment Temporarily Unavailable</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">
                          {gatewayDisabledNotice}
                        </p>
                      </div>
                    )}

                    {/* Cancellation Feedback Notice */}
                    {cancellationNotice && (
                      <div className="bg-slate-800/70 border border-slate-700/70 rounded-xl p-3.5 text-xs text-slate-300 space-y-2">
                        <div className="flex items-start gap-2.5">
                          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          <span className="flex-1">{cancellationNotice}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleReconcileStatus}
                          disabled={isVerifyingPayment || isRazorpayLoading}
                          className="w-full mt-1 py-1.5 bg-slate-700/80 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingPayment ? 'animate-spin' : ''}`} />
                          <span>{isVerifyingPayment ? 'Re-checking Payment Status...' : 'Re-check Payment Status'}</span>
                        </button>
                      </div>
                    )}

                    {/* Error Banner */}
                    {checkoutError && (
                      <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3.5 text-xs text-rose-300 space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <span className="flex-1">{checkoutError}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleReconcileStatus}
                          disabled={isVerifyingPayment || isRazorpayLoading}
                          className="w-full mt-1 py-1.5 bg-rose-900/60 hover:bg-rose-900 text-rose-100 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingPayment ? 'animate-spin' : ''}`} />
                          <span>{isVerifyingPayment ? 'Re-checking Payment Status...' : 'Re-check Payment Status'}</span>
                        </button>
                      </div>
                    )}

                    {/* Primary Real Razorpay Checkout CTA */}
                    <button
                      type="button"
                      onClick={handleLaunchRazorpayCheckout}
                      disabled={isRazorpayLoading || isVerifyingPayment || isCheckoutActive || Boolean(gatewayDisabledNotice)}
                      className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-busy={isRazorpayLoading || isVerifyingPayment}
                    >
                      {isVerifyingPayment ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                          <span>Verifying Payment with Bank...</span>
                        </>
                      ) : isRazorpayLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                          <span>Connecting to Secure Gateway...</span>
                        </>
                      ) : isCheckoutActive ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                          <span>Checkout in Progress...</span>
                        </>
                      ) : gatewayDisabledNotice ? (
                        <>
                          <ShieldCheck className="w-4 h-4 text-slate-950" />
                          <span>Online Payment Unavailable</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4 text-slate-950" />
                          <span>Pay Now — ₹{summary.calculatedFare.toFixed(2)} (Razorpay)</span>
                        </>
                      )}
                    </button>

                    <p className="text-[11px] text-center text-slate-400 flex items-center justify-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-400/80" />
                      <span>256-bit SSL encrypted • Official Razorpay Standard Checkout</span>
                    </p>

                    {/* Direct Driver Alternative Payment Note */}
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 text-xs text-slate-400 space-y-1">
                      <p className="font-semibold text-slate-300">Direct Driver Settlement Option:</p>
                      <p className="text-[11px]">
                        Prefer to settle in person? You can also pay your assigned Driver Anna directly via Cash or driver UPI QR code upon safe completion of your trip.
                      </p>
                    </div>

                    {/* Development-Only Phase 3 Simulator Section (Strictly hidden in production) */}
                    {isDevMode && (
                      <div className="pt-3 border-t border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-amber-400/80 font-bold uppercase tracking-wider">
                          <span>[DEV ONLY] Test Environment</span>
                          <span className="bg-amber-400/10 text-amber-300 px-2 py-0.5 rounded border border-amber-400/20 text-[10px]">
                            Developer Mode
                          </span>
                        </div>
                        {simulatorError && (
                          <div className="bg-rose-950/40 border border-rose-800/60 rounded-lg p-2 text-xs text-rose-300 flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                            <span>{simulatorError}</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={handleLaunchDevSimulator}
                          disabled={initiatingSimulator}
                          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-semibold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {initiatingSimulator ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Launching Dev Simulator...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              <span>Launch Phase 3 Payment Simulator (Mock)</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
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

      {/* Development Simulator Modal */}
      {isDevMode && isSimulatorOpen && simulatorOrderData && (
        <DummyRazorpayModal
          isOpen={isSimulatorOpen}
          token={guestToken}
          orderData={simulatorOrderData}
          onClose={() => setIsSimulatorOpen(false)}
          onPaymentSuccess={handleSimulatorSuccess}
        />
      )}

      {/* Footer copyright */}
      <footer className="py-4 text-center text-[11px] text-slate-500 border-t border-slate-900">
        Book Driver Anna • Secure Guest Payment Infrastructure
      </footer>
    </div>
  );
}
