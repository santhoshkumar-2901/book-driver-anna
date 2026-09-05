import React, { useState } from 'react';
import { 
  Car, ShieldCheck, CheckCircle2, MapPin, Phone, LogOut, ArrowUpRight, 
  DollarSign, TrendingUp, Calendar, Clock, Award, AlertCircle, Check, X, 
  ChevronRight, RefreshCw, Power
} from 'lucide-react';
import { SteeringWheel, WhatsAppIcon } from '../components/Icons';
import useScrollLock from '../utils/useScrollLock';

export default function DriverPortalPage({ 
  driverUser, 
  onLogout, 
  onGoToCustomerSite 
}) {
  const [isOnline, setIsOnline] = useState(driverUser?.isOnline ?? true);
  const [acceptedTrips, setAcceptedTrips] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);
  const [todayEarnings, setTodayEarnings] = useState(driverUser?.earningsToday || 2450);
  const [lifetimeTrips, setLifetimeTrips] = useState(driverUser?.trips || 3420);
  const [settlementTrip, setSettlementTrip] = useState(null);
  const [settlementMethod, setSettlementMethod] = useState('online'); // 'online' or 'cash'

  useScrollLock(Boolean(settlementTrip));

  const [availableDuties, setAvailableDuties] = useState([
    {
      id: "DUTY-8841",
      customerName: "Rahul Sharma",
      tripType: "Airport Drop (One-Way)",
      pickup: "Koramangala 4th Block, Bengaluru",
      destination: "Kempegowda Intl Airport (BLR T1)",
      scheduledTime: "Today, 03:30 PM",
      carModel: "Honda City (Automatic)",
      payout: "₹749",
      urgency: "High Demand",
      distance: "41 km"
    },
    {
      id: "DUTY-8842",
      customerName: "Priya Sharma",
      tripType: "In-City Hourly Errand (4 Hours)",
      pickup: "Indiranagar 100 Feet Road",
      destination: "MG Road, Malleshwaram & Return",
      scheduledTime: "Today, Immediate Pickup",
      carModel: "Hyundai Creta (Manual)",
      payout: "₹499",
      urgency: "Instant Dispatch",
      distance: "Multiple City Stops"
    },
    {
      id: "DUTY-8843",
      customerName: "Vikram Reddy",
      tripType: "Weekend Outstation Roundtrip",
      pickup: "Whitefield ITPL Main Road",
      destination: "Nandi Hills Sunrise & Return",
      scheduledTime: "Tomorrow, 05:00 AM",
      carModel: "Innova Crysta SUV",
      payout: "₹1,850",
      urgency: "Advance Booking",
      distance: "140 km Roundtrip"
    }
  ]);

  const handleAcceptDuty = (duty) => {
    if (!isOnline) {
      setToastMessage("Please switch your duty status to ONLINE to accept trips.");
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const acceptedDuty = { ...duty, status: 'Accepted' };
    setAcceptedTrips(prev => [acceptedDuty, ...prev]);
    setAvailableDuties(prev => prev.filter(d => d.id !== duty.id));
    setToastMessage(`✓ Duty ${duty.id} accepted! Customer ${duty.customerName} notified that Anna is on the way.`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleStartTrip = (tripId) => {
    setAcceptedTrips(prev => prev.map(t => t.id === tripId ? { ...t, status: 'In Progress' } : t));
    setToastMessage(`🚗 Trip ${tripId} started! Meter is running.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleConfirmSettlement = () => {
    if (!settlementTrip) return;
    const numericFare = Number(settlementTrip.payout.replace(/[^0-9]/g, '')) || 749;

    setTodayEarnings(prev => prev + numericFare);
    setLifetimeTrips(prev => prev + 1);

    // Notify customer app via CustomEvent
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bda_ride_completed', {
        detail: {
          id: settlementTrip.id,
          driverName: driverUser?.name || "Manjunath Gowda",
          driverPhone: driverUser?.phone || "+91 98860 12345",
          driverRating: driverUser?.rating || 4.98,
          carModel: settlementTrip.carModel,
          pickupArea: settlementTrip.pickup,
          dropLocation: settlementTrip.destination,
          distance: settlementTrip.distance,
          totalFare: numericFare,
          settlementMethod
        }
      }));
    }

    setAcceptedTrips(prev => prev.filter(t => t.id !== settlementTrip.id));
    setToastMessage(`✓ Trip ${settlementTrip.id} completed! Payout of ${settlementTrip.payout} recorded.`);
    setSettlementTrip(null);
    setTimeout(() => setToastMessage(null), 5000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-400 selection:text-slate-950 pb-16">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-slate-900 border-2 border-emerald-500/80 text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-top-4">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <div className="text-xs font-bold text-slate-200">{toastMessage}</div>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white ml-2 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md max-w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 shrink-0">
              <SteeringWheel className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-sm sm:text-lg text-white font-['Outfit'] leading-none truncate">
                Book Driver <span className="text-emerald-400">Anna</span>
              </div>
              <div className="text-[9px] sm:text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5 truncate">
                <Award className="w-2.5 h-2.5 inline shrink-0" /> Driver Portal
              </div>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            
            {/* Online/Offline Duty Toggle Button */}
            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer border shadow-sm ${
                isOnline
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </button>

            {/* Switch to Customer Site */}
            {onGoToCustomerSite && (
              <button
                onClick={onGoToCustomerSite}
                className="hidden sm:inline-flex text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-xl transition-all cursor-pointer items-center gap-1"
              >
                <span>Customer Site</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
              </button>
            )}

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="p-1.5 sm:p-2 rounded-xl text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0"
              title="Driver Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">Sign Out</span>
            </button>

          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Welcome Driver Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              {driverUser?.name ? driverUser.name.charAt(0).toUpperCase() : 'M'}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-white font-['Outfit']">
                  Namaskara, Anna {driverUser?.name || 'Manjunath Gowda'}!
                </h1>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  Verified Fleet Anna
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                <span>DL: <strong className="text-slate-200 font-mono">{driverUser?.dlNumber || 'KA-04-2021-0098745'}</strong></span>
                <span>•</span>
                <span>Hub: <strong className="text-amber-400">{driverUser?.area || 'Indiranagar & Central'}</strong></span>
                <span>•</span>
                <span>Rating: <strong className="text-emerald-400 font-extrabold">★ {driverUser?.rating || '4.98'}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Today's Earnings</div>
              <div className="text-base font-extrabold text-emerald-400 font-mono mt-0.5">
                ₹{todayEarnings}
              </div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Lifetime Trips</div>
              <div className="text-base font-extrabold text-white font-mono mt-0.5">
                {lifetimeTrips}
              </div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl text-center col-span-2 sm:col-span-1">
              <div className="text-[10px] uppercase font-bold text-slate-400">Next Payout</div>
              <div className="text-xs font-bold text-amber-400 mt-1">
                Monday (Direct Bank)
              </div>
            </div>
          </div>
        </div>

        {/* Accepted Active Trips (if any) */}
        {acceptedTrips.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-base font-extrabold text-white font-['Outfit']">Your Active Assigned Trips</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {acceptedTrips.map(trip => (
                <div key={trip.id} className="bg-emerald-950/20 border-2 border-emerald-500/40 rounded-3xl p-5 space-y-3 shadow-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {trip.id}
                        </span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          trip.status === 'In Progress'
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                            : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                        }`}>
                          {trip.status || 'Accepted'}
                        </span>
                      </div>
                      <h3 className="text-base font-black text-white font-['Outfit'] mt-1">{trip.tripType}</h3>
                    </div>
                    <div className="text-lg font-black text-emerald-400 font-mono">{trip.payout}</div>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <div><strong>Customer:</strong> {trip.customerName}</div>
                    <div><strong>Pickup:</strong> {trip.pickup}</div>
                    <div><strong>Destination:</strong> {trip.destination}</div>
                    <div><strong>Car:</strong> {trip.carModel}</div>
                  </div>
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                    <button 
                      onClick={() => alert(`Connecting to customer ${trip.customerName} at +91 98860 12345`)}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Call Customer</span>
                    </button>

                    {trip.status !== 'In Progress' ? (
                      <button
                        onClick={() => handleStartTrip(trip.id)}
                        className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20 hover:scale-[1.02] cursor-pointer text-center"
                      >
                        Start Trip (Run Meter)
                      </button>
                    ) : (
                      <button
                        onClick={() => setSettlementTrip(trip)}
                        className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-xs transition-all shadow-md shadow-emerald-500/20 hover:scale-[1.02] cursor-pointer text-center flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>End Ride & Settle Fare</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Available Bangalore Duties */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white font-['Outfit']">
                Available Bengaluru Customer Duties
              </h2>
              <p className="text-xs text-slate-400">
                Live customer bookings waiting for an Anna to accept
              </p>
            </div>
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{availableDuties.length} Duties Available</span>
            </div>
          </div>

          {availableDuties.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">All Current Duties Claimed!</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Keep your duty status set to ONLINE. New Bangalore trips will pop up automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {availableDuties.map(duty => (
                <div 
                  key={duty.id}
                  className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 space-y-4 transition-all shadow-md flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {duty.id}
                      </span>
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                        {duty.urgency}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-black text-white font-['Outfit'] group-hover:text-emerald-400 transition-colors">
                        {duty.tripType}
                      </h3>
                      <div className="text-lg font-black text-emerald-400 font-mono mt-1">
                        {duty.payout}
                      </div>
                    </div>

                    {/* Duty Specs */}
                    <div className="space-y-2 text-xs text-slate-300 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-slate-500 text-[10px] block uppercase font-bold">Pickup</span>
                          <span className="font-semibold text-slate-200">{duty.pickup}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 pt-1.5 border-t border-slate-800/60">
                        <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-slate-500 text-[10px] block uppercase font-bold">Drop / Stops</span>
                          <span className="font-semibold text-slate-200">{duty.destination}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/60 text-[11px] text-slate-400">
                        <span><Clock className="w-3 h-3 inline mr-1 text-amber-400" />{duty.scheduledTime}</span>
                        <span><Car className="w-3 h-3 inline mr-1 text-slate-400" />{duty.carModel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Accept Button */}
                  <button
                    onClick={() => handleAcceptDuty(duty)}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                  >
                    <SteeringWheel className="w-4 h-4 stroke-[2.2]" />
                    <span>Accept Duty (Anna)</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Verification Badges & Fleet Helpline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-2">
          
          {/* Verification Status Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Verified Documents & Clearances</span>
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center gap-2 text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Driving License (Active)</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center gap-2 text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Police Clearance (Passed)</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center gap-2 text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Aadhaar KYC (Verified)</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center gap-2 text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Commercial Accident Cover</span>
              </div>
            </div>
          </div>

          {/* Fleet Dispatcher Hotline */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-400" />
                <span>24/7 Fleet Dispatcher Support</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Facing route issues, customer delay, or emergency? Contact our Bengaluru control room immediately.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://wa.me/919886012345?text=Hi%20Dispatch%2C%20this%20is%20Driver%20Anna.%20Need%20assistance%20with%20duty."
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <WhatsAppIcon className="w-4 h-4 fill-current" />
                <span>WhatsApp Dispatcher</span>
              </a>
              <a
                href="tel:+919886012345"
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center gap-1.5 border border-slate-700"
              >
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>Call SOS</span>
              </a>
            </div>
          </div>

        </div>

        {/* Driver Ride Settlement Modal */}
        {settlementTrip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden touch-none overscroll-contain">
            <div 
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm touch-none overscroll-contain"
              onClick={() => setSettlementTrip(null)}
              onTouchMove={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            />
            <div className="relative bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto overscroll-contain touch-pan-y p-5 sm:p-6 shadow-2xl z-10 space-y-4 animate-in zoom-in-95 duration-200 text-slate-100">
              
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white font-['Outfit']">End Ride & Settle Fare</h3>
                    <p className="text-[10px] text-slate-400 font-mono">Trip #{settlementTrip.id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSettlementTrip(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Trip Recap */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <strong className="text-white">{settlementTrip.customerName}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Route:</span>
                  <span className="text-slate-200 truncate max-w-[200px]">{settlementTrip.pickup} ➔ {settlementTrip.destination}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="font-bold text-slate-300">Total Driver Payout:</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">{settlementTrip.payout}</span>
                </div>
              </div>

              {/* Fare Collection Options */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Select Fare Collection Method:
                </label>
                <div className="space-y-2 text-xs">
                  <label 
                    onClick={() => setSettlementMethod('online')}
                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                      settlementMethod === 'online'
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="settlementMethod" 
                      checked={settlementMethod === 'online'} 
                      onChange={() => setSettlementMethod('online')}
                      className="text-emerald-500" 
                    />
                    <div>
                      <div className="font-bold text-white">Customer Paid Online (UPI / Card / Wallet)</div>
                      <p className="text-[10px] text-slate-400">Customer completes payment on their screen</p>
                    </div>
                  </label>

                  <label 
                    onClick={() => setSettlementMethod('cash')}
                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                      settlementMethod === 'cash'
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="settlementMethod" 
                      checked={settlementMethod === 'cash'} 
                      onChange={() => setSettlementMethod('cash')}
                      className="text-emerald-500" 
                    />
                    <div>
                      <div className="font-bold text-white">Cash Collected by Anna ({settlementTrip.payout})</div>
                      <p className="text-[10px] text-slate-400">Customer handed over cash directly</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Confirm button */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSettlementTrip(null)}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSettlement}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm Ride End & Credit Fare</span>
                </button>
              </div>

            </div>
          </div>
        )}

      </main>

    </div>
  );
}
