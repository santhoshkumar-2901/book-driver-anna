import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, Star, ShieldCheck, Phone, MapPin, Clock, Car, 
  Smartphone, Banknote, QrCode, ArrowRight, ArrowLeft,
  Sparkles, X, Heart, Award, Download, Printer, Check, ChevronRight,
  Info, AlertCircle, ThumbsUp, Send, MessageSquare, ExternalLink
} from 'lucide-react';
import { SteeringWheel } from './Icons';
import { useScrollLock } from '../utils/useScrollLock';
import { SUPPORT_HELPLINE } from '../data/mockData';

export default function RidePaymentModal({ 
  isOpen, 
  rideData, 
  onClose, 
  onPaymentSuccess 
}) {
  useScrollLock(isOpen);

  if (!isOpen || !rideData) return null;

  // Defaults
  const rawDriver = rideData.driverName || rideData.assignedDriver || rideData.assignedAnna;
  const driverName = (rawDriver && rawDriver !== 'Pending Admin Acceptance' && !rawDriver.toLowerCase().includes('pending'))
    ? rawDriver
    : "Driver Anna";
  const driverPhone = rideData.driverPhone || SUPPORT_HELPLINE;
  const driverRating = rideData.driverRating || 5.0;
  const driverTrips = rideData.driverTrips || 0;
  const carModel = rideData.carModel || rideData.vehicleName || "Customer Vehicle";
  const pickup = rideData.pickupArea || rideData.pickup || "Pickup Location";
  const destination = rideData.dropLocation || rideData.destination || "Drop Location";
  const distance = rideData.distance || "City Route";
  const duration = rideData.duration || "Trip Duration";
  const baseCalculatedFare = Number(rideData.totalFare || rideData.fare || 549);

  // Driver UPI ID resolution (drivers put their UPI ID in /driver, generating dynamic QR)
  const resolvedDriverUpi = (() => {
    if (rideData.driverUpi) return rideData.driverUpi;
    if (rideData.assignedDriverUpi) return rideData.assignedDriverUpi;
    try {
      const savedFleet = JSON.parse(localStorage.getItem('bda_registered_drivers') || '[]');
      const cleanPhone = (driverPhone || '').replace(/[^0-9]/g, '');
      const matched = savedFleet.find(d => {
        const dPhone = (d.phone || '').replace(/[^0-9]/g, '');
        return (cleanPhone && dPhone && (cleanPhone === dPhone || cleanPhone.includes(dPhone) || dPhone.includes(cleanPhone))) ||
               (d.name && driverName && d.name.toLowerCase().trim() === driverName.toLowerCase().trim());
      });
      if (matched?.upiId) return matched.upiId;
    } catch (e) {}
    try {
      const activeDriver = JSON.parse(localStorage.getItem('bda_driver_user') || 'null');
      if (activeDriver?.upiId) return activeDriver.upiId;
    } catch (e) {}
    const sanitizedHandle = (driverName || 'driver').toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${sanitizedHandle || 'driver'}@oksbi`;
  })();

  // States
  const [currentStep, setCurrentStep] = useState('settlement'); // 'settlement' | 'payment'
  const [selectedTip, setSelectedTip] = useState(0); // 0, 20, 50, 100, or custom
  const [customTip, setCustomTip] = useState('');
  const [isCustomTip, setIsCustomTip] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('upi'); // 'upi' | 'cash' only
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay'); // 'gpay', 'phonepe', 'paytm', 'qr'
  const [starRating, setStarRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedCompliments, setSelectedCompliments] = useState(['Smooth Driving', 'Clean Car']);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [showQrCode, setShowQrCode] = useState(true);
  const [upiRedirectNotice, setUpiRedirectNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const alreadyPaid = Boolean(
        rideData?.isPaid || 
        rideData?.status === 'Completed' || 
        rideData?.status === 'COMPLETED' || 
        rideData?.paymentCompleted ||
        rideData?.settlementMethod
      );
      if (alreadyPaid) {
        setIsPaid(true);
        setCurrentStep('receipt');
        if (!transactionId) {
          setTransactionId(rideData?.transactionId || `TXN-BDA-${Date.now().toString(36).toUpperCase()}`);
        }
      } else {
        setCurrentStep('settlement');
        setIsPaid(false);
      }
      setIsProcessing(false);
      setUpiRedirectNotice(false);
    }
  }, [isOpen, rideData?.id, rideData?.bookingId, rideData?.isPaid, rideData?.status, rideData?.settlementMethod]);

  // Support Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fare calculations
  const effectiveTip = isCustomTip ? (Number(customTip) || 0) : selectedTip;
  const tollCharges = pickup.toLowerCase().includes('airport') || destination.toLowerCase().includes('airport') ? 115 : 0;
  const gstTax = Math.round(baseCalculatedFare * 0.05);
  const promoDiscount = baseCalculatedFare > 400 ? 50 : 0;
  const totalAmountToPay = Math.max(0, baseCalculatedFare + tollCharges + gstTax - promoDiscount + effectiveTip);

  // Available UPI Applications
  const UPI_APPS = [
    { id: 'gpay', name: 'Google Pay', icon: '🔵' },
    { id: 'phonepe', name: 'PhonePe', icon: '🟣' },
    { id: 'paytm', name: 'Paytm UPI', icon: '🔷' },
    { id: 'generic', name: 'Any UPI App', icon: '⚡' }
  ];

  // Dynamic UPI payment URL and scannable QR Code image URL generated from driver UPI
  const upiPayUri = `upi://pay?pa=${encodeURIComponent(resolvedDriverUpi)}&pn=${encodeURIComponent(driverName)}&am=${totalAmountToPay}&cu=INR&tn=${encodeURIComponent(`BDA Ride ${rideData.id || ''}`.trim())}`;
  const upiParams = `pa=${encodeURIComponent(resolvedDriverUpi)}&pn=${encodeURIComponent(driverName)}&am=${totalAmountToPay}&cu=INR&tn=${encodeURIComponent(`BDA Ride ${rideData.id || ''}`.trim())}`;
  const dynamicQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiPayUri)}`;

  const getUpiDeepLink = (appId = selectedUpiApp) => {
    switch (appId) {
      case 'gpay':
        return `tez://upi/pay?${upiParams}`;
      case 'phonepe':
        return `phonepe://pay?${upiParams}`;
      case 'paytm':
        return `paytmmp://pay?${upiParams}`;
      case 'generic':
      default:
        return `upi://pay?${upiParams}`;
    }
  };

  const getUpiAppName = (appId = selectedUpiApp) => {
    switch (appId) {
      case 'gpay': return 'Google Pay';
      case 'phonepe': return 'PhonePe';
      case 'paytm': return 'Paytm';
      case 'generic': return 'UPI App';
      default: return 'UPI Payment App';
    }
  };

  const launchUpiPaymentApp = (appId = selectedUpiApp) => {
    const specificAppUri = getUpiDeepLink(appId);
    const standardUpiUri = `upi://pay?${upiParams}`;

    setUpiRedirectNotice(true);

    try {
      // 1. Attempt to launch native app scheme
      const a = document.createElement('a');
      a.href = specificAppUri;
      a.target = '_self';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // 2. Also trigger universal upi:// standard fallback
      if (appId !== 'generic' && specificAppUri !== standardUpiUri) {
        setTimeout(() => {
          try {
            window.location.href = standardUpiUri;
          } catch (e) {}
        }, 600);
      }
    } catch (err) {
      try {
        window.location.href = standardUpiUri;
      } catch (e) {}
    }
  };

  // Compliments bank
  const COMPLIMENT_OPTIONS = [
    { id: 'smooth', label: 'Smooth Driving', icon: '🚗' },
    { id: 'clean', label: 'Super Clean Car', icon: '✨' },
    { id: 'punctual', label: 'Punctual Anna', icon: '⏱️' },
    { id: 'route', label: 'Expert Route Choice', icon: '🗺️' },
    { id: 'polite', label: 'Polite & Respectful', icon: '🤝' },
    { id: 'safe', label: 'Safe at Night', icon: '🛡️' }
  ];

  const toggleCompliment = (label) => {
    if (selectedCompliments.includes(label)) {
      setSelectedCompliments(prev => prev.filter(c => c !== label));
    } else {
      setSelectedCompliments(prev => [...prev, label]);
    }
  };

  const handleTipSelect = (amt) => {
    setIsCustomTip(false);
    setSelectedTip(amt);
  };

  const handleProcessPayment = (e) => {
    if (e) e.preventDefault();

    if (paymentMethod === 'upi') {
      // Launch user's chosen payment app (GPay / PhonePe / Paytm / any UPI)
      launchUpiPaymentApp(selectedUpiApp);
    }

    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      setIsPaid(true);
      setUpiRedirectNotice(false);
      const generatedTxn = 'TXN-PAY-' + Math.floor(100000 + Math.random() * 900000);
      setTransactionId(generatedTxn);

      if (onPaymentSuccess) {
        onPaymentSuccess({
          rideId: rideData.id || rideData.bookingId,
          transactionId: generatedTxn,
          amountPaid: totalAmountToPay,
          paymentMethod,
          driverUpi: resolvedDriverUpi,
          tip: effectiveTip,
          rating: starRating,
          compliments: selectedCompliments,
          review: feedbackNotes.trim()
        });
      }
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      {/* Dark Blur Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-md transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Main Card Container */}
      <div className="relative bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl z-10 animate-in zoom-in-95 duration-200 text-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto">
        
        {/* =========================================================================
            HEADER: RIDE COMPLETED BANNER
           ========================================================================= */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 p-3 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <SteeringWheel className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Trip Completed
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate">
                  {rideData.id || rideData.bookingId || "BDA-TRIP-8821"}
                </span>
              </div>
              <h2 className="text-sm sm:text-lg font-black text-white font-['Outfit'] mt-0.5 truncate">
                {isPaid ? "Payment Receipt" : currentStep === 'payment' ? "Payment & Rating" : "Trip Fare Settlement"}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* =========================================================================
            BODY CONTENT (SCROLLABLE)
           ========================================================================= */}
        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar flex-1">
          
          {/* ==================== VIEW 1: SUCCESS CONFIRMATION ==================== */}
          {isPaid ? (
            <div className="space-y-5 text-center py-2 animate-in fade-in zoom-in-95">
              
              {/* Success Badge */}
              <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10 animate-bounce">
                <Check className="w-10 h-10 text-emerald-400 stroke-[3]" />
              </div>

              <div>
                <div className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1 rounded-full uppercase tracking-wider mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Payment Successful
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">
                  ₹{totalAmountToPay}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Paid to <strong className="text-white">{driverName}</strong> via {paymentMethod === 'upi' ? `UPI (${resolvedDriverUpi})` : 'Cash to Driver'}
                </p>
                <div className="mt-2 inline-block font-mono text-[11px] bg-slate-950 text-amber-400 border border-slate-800 px-2.5 py-1 rounded-lg">
                  Ref ID: {transactionId}
                </div>
              </div>

              {/* Driver Thank You Card */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-left flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center font-bold text-lg font-['Outfit']">
                    MG
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>{driverName}</span>
                      <span className="flex items-center text-amber-400 text-[11px]">
                        <Star className="w-3 h-3 fill-amber-400 inline ml-0.5" /> {driverRating}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {starRating} ★ Rating submitted • {effectiveTip > 0 ? `₹${effectiveTip} tip included` : 'No tip'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
                    Duty Settled
                  </span>
                </div>
              </div>

              {/* Trip Route Recapped */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-300 space-y-2 text-left">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="truncate"><strong>From:</strong> {pickup}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="truncate"><strong>To:</strong> {destination}</span>
                </div>
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Distance: {distance}</span>
                  <span>Duration: {duration}</span>
                  <span>Car: {carModel.split('•')[0]}</span>
                </div>
              </div>

              {/* Optional Review Display */}
              {feedbackNotes.trim() && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 text-left space-y-1.5 animate-in fade-in duration-200">
                  <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3 text-amber-400" /> Your Driver Review
                  </div>
                  <p className="text-xs text-slate-300 italic leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                    "{feedbackNotes.trim()}"
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => alert(`Invoice #${transactionId} generated. Receipt sent to your registered email.`)}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Download Invoice</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 hover:scale-[1.01] transition-all cursor-pointer text-center"
                >
                  Done & Return Home
                </button>
              </div>

            </div>
          ) : currentStep === 'settlement' ? (

            /* ==================== VIEW 2A: TRIP FARE SETTLEMENT & ITEMIZED RECEIPT ==================== */
            <>
              {/* 1. Driver Profile & Vehicle Card */}
              <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black text-lg font-['Outfit'] shadow-md shadow-amber-500/10 shrink-0">
                    {driverName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-white">{driverName}</span>
                      <span className="text-[11px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-400" /> {driverRating}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Car className="w-3 h-3 text-slate-400 inline" />
                        <span>{carModel}</span>
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-emerald-400 font-mono text-[10px] bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-800/60 font-semibold truncate max-w-[170px]" title={`Driver UPI: ${resolvedDriverUpi}`}>
                        UPI: {resolvedDriverUpi}
                      </span>
                    </div>
                  </div>
                </div>

                <a 
                  href={`tel:${driverPhone}`}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1 text-xs font-bold transition-colors shrink-0"
                  title="Call Driver Anna"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Call Anna</span>
                </a>
              </div>

              {/* 2. Route & Trip Details */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="flex flex-col items-center mt-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="w-0.5 h-6 bg-slate-700 my-0.5" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Pickup Location</span>
                      <div className="font-semibold text-white truncate">{pickup}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Drop Location</span>
                      <div className="font-semibold text-white truncate">{destination}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-amber-400" /> {duration}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-red-400" /> {distance}</span>
                  <span className="text-emerald-400 font-semibold">Verified Route</span>
                </div>
              </div>

              {/* 3. Itemized Fare Receipt Breakdown */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-xs font-bold text-white font-['Outfit'] uppercase tracking-wider">
                    Itemized Fare Receipt
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">Official Fare Billing</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Base Fare & Minimum Ride Fee</span>
                    <span className="font-mono text-white">₹{Math.round(baseCalculatedFare * 0.35)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span>Distance & Running Time ({distance}, {duration})</span>
                    <span className="font-mono text-white">₹{Math.round(baseCalculatedFare * 0.65)}</span>
                  </div>

                  {tollCharges > 0 && (
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="flex items-center gap-1 text-amber-300">
                        <Info className="w-3 h-3" /> Bangalore Airport Expressway Toll
                      </span>
                      <span className="font-mono text-amber-300">₹{tollCharges}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-300">
                    <span>GST & Government Taxes (5%)</span>
                    <span className="font-mono text-white">₹{gstTax}</span>
                  </div>

                  {promoDiscount > 0 && (
                    <div className="flex items-center justify-between text-emerald-400 font-semibold">
                      <span>Namma Bengaluru Welcome Discount</span>
                      <span className="font-mono">-₹{promoDiscount}</span>
                    </div>
                  )}

                  {effectiveTip > 0 && (
                    <div className="flex items-center justify-between text-amber-400 font-semibold">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3 fill-amber-400 inline" /> Driver Anna Tip
                      </span>
                      <span className="font-mono">+₹{effectiveTip}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Payable</span>
                    <div className="text-[10px] text-slate-500">Includes all taxes & driver payout</div>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                    ₹{totalAmountToPay}
                  </div>
                </div>
              </div>

              {/* Step 1 Action Button: Proceed to Pay & Rate Driver */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  id="proceed-to-payment-btn"
                  onClick={() => setCurrentStep('payment')}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Proceed to Pay ₹{totalAmountToPay} & Rate Driver</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div className="text-center text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Direct Anna Settlement • Official Fare Billing Guarantee</span>
                </div>
              </div>
            </>
          ) : (

            /* ==================== VIEW 2B: PAYMENT METHOD & REVIEW ==================== */
            <>
              {/* Back Navigation Bar */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  id="back-to-settlement-btn"
                  onClick={() => setCurrentStep('settlement')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Fare Receipt</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Total:</span>
                  <span className="text-sm font-mono font-black text-amber-400">₹{totalAmountToPay}</span>
                </div>
              </div>

              {/* 4. Add a Tip for Anna */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-red-400" />
                    <span>Add a Tip for Driver Anna</span>
                  </label>
                  <span className="text-[10px] text-slate-400">100% goes directly to {driverName}</span>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {[0, 20, 50, 100].map(tipAmt => (
                    <button
                      key={tipAmt}
                      type="button"
                      onClick={() => handleTipSelect(tipAmt)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        !isCustomTip && selectedTip === tipAmt
                          ? 'bg-amber-400 text-slate-950 border-amber-400 font-extrabold shadow-md shadow-amber-500/20 scale-[1.02]'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                      }`}
                    >
                      {tipAmt === 0 ? 'No Tip' : `+₹${tipAmt}`}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomTip(true);
                      setSelectedTip(0);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isCustomTip
                        ? 'bg-amber-400 text-slate-950 border-amber-400 font-extrabold shadow-md shadow-amber-500/20'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {isCustomTip && (
                  <div className="flex items-center gap-2 pt-1 animate-in fade-in">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">₹</span>
                      <input
                        type="number"
                        min="10"
                        max="1000"
                        placeholder="Enter custom tip (e.g. 75)"
                        value={customTip}
                        onChange={(e) => setCustomTip(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!customTip) handleTipSelect(0);
                      }}
                      className="text-xs text-slate-400 hover:text-white px-2 py-1"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>

              {/* 5. Payment Method Selector (UPI and Cash Only) */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-200 block uppercase tracking-wider">
                  Select Payment Method
                </label>

                {/* 2 Tabs: UPI / QR and Cash */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'upi'
                        ? 'bg-amber-400/15 text-amber-400 border-amber-400/60 font-bold shadow-sm'
                        : 'bg-slate-950 hover:bg-slate-800/80 text-slate-400 border-slate-800'
                    }`}
                  >
                    <Smartphone className="w-5 h-5" />
                    <span className="text-xs font-semibold">UPI / QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'bg-amber-400/15 text-amber-400 border-amber-400/60 font-bold shadow-sm'
                        : 'bg-slate-950 hover:bg-slate-800/80 text-slate-400 border-slate-800'
                    }`}
                  >
                    <Banknote className="w-5 h-5" />
                    <span className="text-xs font-semibold">Cash to Driver</span>
                  </button>
                </div>

                {/* Sub-view for UPI */}
                {paymentMethod === 'upi' && (
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-3 animate-in fade-in duration-200">
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Choose UPI app or scan Driver's QR code:</span>
                      <button 
                        type="button" 
                        onClick={() => setShowQrCode(!showQrCode)} 
                        className="text-amber-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{showQrCode ? "Hide QR" : "Show Driver QR"}</span>
                      </button>
                    </div>

                    {showQrCode ? (
                      <div className="p-3.5 bg-white rounded-xl text-slate-950 text-center space-y-2 shadow-inner">
                        <div className="w-36 h-36 mx-auto bg-white border-2 border-slate-300 rounded-xl flex items-center justify-center p-1.5 shadow-sm overflow-hidden">
                          <img 
                            src={dynamicQrCodeUrl} 
                            alt={`Scannable UPI QR for ${resolvedDriverUpi}`} 
                            className="w-full h-full object-contain"
                            loading="eager"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-slate-900 tracking-tight flex items-center justify-center gap-1.5">
                            <span>Driver UPI:</span>
                            <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs font-black select-all">
                              {resolvedDriverUpi}
                            </span>
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Scan using Google Pay, PhonePe, Paytm or any UPI app to pay ₹{totalAmountToPay} directly to {driverName}
                          </p>
                        </div>

                        {/* Direct App Launch Button */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => launchUpiPaymentApp(selectedUpiApp)}
                            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Pay ₹{totalAmountToPay} in {getUpiAppName(selectedUpiApp)}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Quick app switcher pills */}
                        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                          {UPI_APPS.map(app => (
                            <button
                              key={app.id}
                              type="button"
                              onClick={() => setSelectedUpiApp(app.id)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                selectedUpiApp === app.id
                                  ? 'bg-slate-900 text-amber-300 border-slate-900 shadow-sm font-black'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              <span>{app.icon}</span>
                              <span>{app.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          {UPI_APPS.map(app => (
                            <button
                              key={app.id}
                              type="button"
                              onClick={() => {
                                setSelectedUpiApp(app.id);
                                launchUpiPaymentApp(app.id);
                              }}
                              className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                                selectedUpiApp === app.id
                                  ? 'bg-amber-400/15 border-amber-400 text-amber-300 font-bold shadow-sm ring-1 ring-amber-400/40'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                              }`}
                            >
                              <span className="text-base block">{app.icon}</span>
                              <span className="text-[11px] mt-1 block font-semibold">{app.name}</span>
                              <span className="text-[9px] text-amber-400/80 block mt-0.5">Tap to Open</span>
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => launchUpiPaymentApp(selectedUpiApp)}
                          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                        >
                          <Smartphone className="w-4 h-4" />
                          <span>Open & Pay ₹{totalAmountToPay} in {getUpiAppName(selectedUpiApp)}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>

                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 truncate mr-2">
                            <span className="text-slate-400 text-[11px] shrink-0">Pay to UPI:</span>
                            <span className="font-mono text-amber-300 font-bold text-[11px] truncate select-all">{resolvedDriverUpi}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowQrCode(true)}
                            className="text-amber-400 hover:underline text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <QrCode className="w-3 h-3" /> View QR
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-view for Cash */}
                {paymentMethod === 'cash' && (
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1.5 text-xs text-slate-300 animate-in fade-in duration-200">
                    <div className="font-bold text-amber-400 flex items-center gap-1.5">
                      <Banknote className="w-4 h-4" /> Pay Direct Cash to Driver
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Please hand over exact cash of <strong className="text-white font-bold">₹{totalAmountToPay}</strong> directly to Anna upon reaching your destination.
                    </p>
                  </div>
                )}
              </div>

              {/* 6. Rate Driver Anna & Optional Manual Review */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3.5">
                <div className="text-center space-y-1">
                  <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Rate Your Ride with {driverName.split(' ')[0]}
                  </div>
                  <p className="text-[11px] text-slate-400">Your ratings help keep Bangalore's fleet safe & courteous</p>
                </div>

                {/* Star rating picker */}
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setStarRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 transition-transform hover:scale-125 cursor-pointer"
                      title={`${star} Star${star > 1 ? 's' : ''}`}
                    >
                      <Star 
                        className={`w-7 h-7 ${
                          (hoverRating || starRating) >= star 
                            ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' 
                            : 'text-slate-700'
                        }`} 
                      />
                    </button>
                  ))}
                </div>

                {/* Compliments Badges */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] text-slate-400 text-center font-semibold uppercase">
                    Add Compliments for Anna
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {COMPLIMENT_OPTIONS.map(comp => (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={() => toggleCompliment(comp.label)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 border ${
                          selectedCompliments.includes(comp.label)
                            ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 scale-[1.02]'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                        }`}
                      >
                        <span>{comp.icon}</span>
                        <span>{comp.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual Review (Optional) */}
                <div className="space-y-1.5 pt-2.5 border-t border-slate-850">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                      <span>Write a Review</span>
                      <span className="text-[10px] font-semibold text-amber-400/90 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                        Optional
                      </span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {feedbackNotes.length}/300
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={300}
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    placeholder="Share feedback or write a review about your ride experience (optional)..."
                    className="w-full bg-slate-900/90 border border-slate-800 focus:border-amber-400/80 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/40 resize-none transition-all leading-relaxed"
                  />
                </div>
              </div>

              {/* 7. Action Button: Pay & Settle */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  id="ride-payment-submit-btn"
                  onClick={handleProcessPayment}
                  disabled={isProcessing}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>
                        {paymentMethod === 'upi'
                          ? `Opening ${getUpiAppName(selectedUpiApp)}...`
                          : 'Processing Settlement...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        {paymentMethod === 'cash'
                          ? `Confirm Cash ₹${totalAmountToPay} & Complete`
                          : `Pay ₹${totalAmountToPay} via ${getUpiAppName(selectedUpiApp)} & Complete`}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {upiRedirectNotice && (
                  <div className="p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs text-center space-y-1 animate-in fade-in duration-200">
                    <div className="font-bold flex items-center justify-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 animate-bounce text-amber-400" />
                      <span>Opening {getUpiAppName(selectedUpiApp)} on your device...</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      If your UPI app did not launch automatically,{' '}
                      <button 
                        type="button" 
                        onClick={() => launchUpiPaymentApp(selectedUpiApp)} 
                        className="underline font-bold text-amber-400 hover:text-white cursor-pointer"
                      >
                        tap here to open {getUpiAppName(selectedUpiApp)}
                      </button>
                      {' '}or scan the QR code above.
                    </p>
                  </div>
                )}

                <div className="text-center text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Direct & Secure Driver Settlement • Verified Ride</span>
                </div>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
}
