import React, { useState } from 'react';
import { 
  CheckCircle2, Star, ShieldCheck, Phone, MapPin, Clock, Car, 
  CreditCard, Smartphone, Banknote, Wallet, QrCode, ArrowRight, 
  Sparkles, X, Heart, Award, Download, Printer, Check, ChevronRight,
  Info, AlertCircle, ThumbsUp, Send
} from 'lucide-react';
import { SteeringWheel } from './Icons';
import { useScrollLock } from '../utils/useScrollLock';

export default function RidePaymentModal({ 
  isOpen, 
  rideData, 
  onClose, 
  onPaymentSuccess 
}) {
  useScrollLock(isOpen);

  if (!isOpen || !rideData) return null;

  // Defaults
  const driverName = rideData.driverName || rideData.assignedDriver || rideData.assignedAnna || "Manjunath Gowda";
  const driverPhone = rideData.driverPhone || "+91 98860 12345";
  const driverRating = rideData.driverRating || 4.98;
  const driverTrips = rideData.driverTrips || 3420;
  const carModel = rideData.carModel || rideData.vehicleName || "Honda City (White) • KA-04-ME-5432";
  const pickup = rideData.pickupArea || rideData.pickup || "Indiranagar 100 Feet Road";
  const destination = rideData.dropLocation || rideData.destination || "Kempegowda Intl Airport (BLR T1)";
  const distance = rideData.distance || "18.4 km";
  const duration = rideData.duration || "42 mins";
  const baseCalculatedFare = Number(rideData.totalFare || rideData.fare || 549);

  // States
  const [selectedTip, setSelectedTip] = useState(0); // 0, 20, 50, 100, or custom
  const [customTip, setCustomTip] = useState('');
  const [isCustomTip, setIsCustomTip] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('upi'); // 'upi', 'card', 'cash', 'wallet'
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay'); // 'gpay', 'phonepe', 'paytm', 'qr'
  const [starRating, setStarRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedCompliments, setSelectedCompliments] = useState(['Smooth Driving', 'Clean Car']);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [showQrCode, setShowQrCode] = useState(false);

  // Card inputs
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 8812');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvv, setCardCvv] = useState('•••');

  // Fare calculations
  const effectiveTip = isCustomTip ? (Number(customTip) || 0) : selectedTip;
  const tollCharges = pickup.toLowerCase().includes('airport') || destination.toLowerCase().includes('airport') ? 115 : 0;
  const gstTax = Math.round(baseCalculatedFare * 0.05);
  const promoDiscount = baseCalculatedFare > 400 ? 50 : 0;
  const totalAmountToPay = Math.max(0, baseCalculatedFare + tollCharges + gstTax - promoDiscount + effectiveTip);

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
    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      setIsPaid(true);
      const generatedTxn = 'TXN-PAY-' + Math.floor(100000 + Math.random() * 900000);
      setTransactionId(generatedTxn);

      if (onPaymentSuccess) {
        onPaymentSuccess({
          rideId: rideData.id || rideData.bookingId,
          transactionId: generatedTxn,
          amountPaid: totalAmountToPay,
          paymentMethod,
          tip: effectiveTip,
          rating: starRating,
          compliments: selectedCompliments
        });
      }
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-hidden touch-none overscroll-contain">
      {/* Dark Blur Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-md transition-opacity touch-none overscroll-contain"
        onClick={isPaid ? onClose : undefined}
        onTouchMove={(e) => { e.preventDefault(); e.stopPropagation(); }}
      />

      {/* Main Card Container */}
      <div className="relative bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl z-10 animate-in zoom-in-95 duration-200 text-slate-100 flex flex-col max-h-[92vh] overscroll-contain touch-auto">
        
        {/* =========================================================================
            HEADER: RIDE COMPLETED BANNER
           ========================================================================= */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 p-3.5 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <SteeringWheel className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Trip Completed
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono">
                  {rideData.id || rideData.bookingId || "BDA-TRIP-8821"}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white font-['Outfit'] mt-0.5">
                {isPaid ? "Payment Receipt" : "Trip Fare Settlement"}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
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
                  Paid to <strong className="text-white">{driverName}</strong> via {paymentMethod.toUpperCase()}
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
          ) : (

            /* ==================== VIEW 2: FARE & PAYMENT SETTLEMENT ==================== */
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
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Car className="w-3 h-3 text-slate-400 inline" />
                      <span>{carModel}</span>
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

              {/* 5. Payment Method Selector */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-200 block uppercase tracking-wider">
                  Select Payment Method
                </label>

                {/* 4 Tabs: UPI, Cards, Cash, Wallet */}
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'upi'
                        ? 'bg-amber-400/15 text-amber-400 border-amber-400/60 font-bold shadow-sm'
                        : 'bg-slate-950 hover:bg-slate-800/80 text-slate-400 border-slate-800'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span className="text-[11px]">UPI / QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'bg-amber-400/15 text-amber-400 border-amber-400/60 font-bold shadow-sm'
                        : 'bg-slate-950 hover:bg-slate-800/80 text-slate-400 border-slate-800'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span className="text-[11px]">Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'bg-amber-400/15 text-amber-400 border-amber-400/60 font-bold shadow-sm'
                        : 'bg-slate-950 hover:bg-slate-800/80 text-slate-400 border-slate-800'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span className="text-[11px]">Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'wallet'
                        ? 'bg-amber-400/15 text-amber-400 border-amber-400/60 font-bold shadow-sm'
                        : 'bg-slate-950 hover:bg-slate-800/80 text-slate-400 border-slate-800'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    <span className="text-[11px]">FastPay</span>
                  </button>
                </div>

                {/* Sub-view for UPI */}
                {paymentMethod === 'upi' && (
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-3 animate-in fade-in duration-200">
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Choose UPI app or scan Anna's QR code:</span>
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
                      <div className="p-3 bg-white rounded-xl text-slate-950 text-center space-y-1.5">
                        <div className="w-32 h-32 mx-auto bg-slate-100 border-2 border-slate-300 rounded-lg flex items-center justify-center p-2">
                          <QrCode className="w-24 h-24 text-slate-900" />
                        </div>
                        <p className="text-[11px] font-bold">UPI ID: manjunath.anna@oksbi</p>
                        <p className="text-[10px] text-slate-500">Scan using any UPI app to pay ₹{totalAmountToPay}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {[
                          { id: 'gpay', name: 'Google Pay', icon: '🔵' },
                          { id: 'phonepe', name: 'PhonePe', icon: '🟣' },
                          { id: 'paytm', name: 'Paytm UPI', icon: '🔷' }
                        ].map(app => (
                          <button
                            key={app.id}
                            type="button"
                            onClick={() => setSelectedUpiApp(app.id)}
                            className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                              selectedUpiApp === app.id
                                ? 'bg-amber-400/10 border-amber-400 text-amber-300 font-bold'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <span className="text-sm block">{app.icon}</span>
                            <span className="text-[11px] mt-0.5 block">{app.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-view for Card */}
                {paymentMethod === 'card' && (
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2.5 animate-in fade-in duration-200">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-400">Card Number</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Expiry (MM/YY)</label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">CVV</label>
                        <input
                          type="password"
                          maxLength={3}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-view for Cash */}
                {paymentMethod === 'cash' && (
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1.5 text-xs text-slate-300 animate-in fade-in duration-200">
                    <div className="font-bold text-amber-400 flex items-center gap-1.5">
                      <Banknote className="w-4 h-4" /> Pay Direct Cash to Driver
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Please hand over exact cash of <strong className="text-white">₹{totalAmountToPay}</strong> directly to Anna. Anna will confirm receipt in his driver portal.
                    </p>
                  </div>
                )}

                {/* Sub-view for Wallet */}
                {paymentMethod === 'wallet' && (
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1.5 text-xs text-slate-300 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Wallet className="w-4 h-4 text-amber-400" /> Anna FastPay Wallet
                      </span>
                      <span className="font-mono text-emerald-400 font-extrabold text-xs">Balance: ₹1,500</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      ₹{totalAmountToPay} will be debited instantly from your wallet with 1-click checkout.
                    </p>
                  </div>
                )}
              </div>

              {/* 6. Rate Driver Anna (5 Stars & Compliments) */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
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
              </div>

              {/* 7. Action Button: Pay & Settle */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleProcessPayment}
                  disabled={isProcessing}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Contacting Bank Gateway & Authorizing...</span>
                    </>
                  ) : (
                    <>
                      <span>Pay ₹{totalAmountToPay} & Complete Trip</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>256-Bit Encrypted Settlement • Bank-Grade Security</span>
                </div>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
}
