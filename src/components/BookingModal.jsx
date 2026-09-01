import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Phone, User, ShieldCheck, Check, Sparkles, AlertCircle, Navigation, Compass, ArrowRight, Users, Snowflake, Sun, Banknote, Smartphone, Lock, Star, Briefcase, Car } from 'lucide-react';
import { SteeringWheel } from './Icons';
import { BANGALORE_AREAS, BOOK_DRIVER_TRIP_TYPES } from '../data/mockData';

export default function BookingModal({ isOpen, onClose, initialType = 'driver', initialData = {}, onBookingComplete }) {
  // Service Type: 'driver' or 'vehicle'
  const [bookingCategory, setBookingCategory] = useState(initialType); // 'driver' or 'vehicle'

  // Driver trip options: 'one-way', 'round-trip', 'outstation'
  const [driverTripOption, setDriverTripOption] = useState(initialData.driverTripOption || 'one-way');
  
  // Vehicle Category options: 'Sedan', 'SUV', '12 Seater', '24 Seater', '32 Seater'
  const [vehicleCategory, setVehicleCategory] = useState(initialData.vehicleCategory || 'Sedan');

  // Dynamic fields per trip option (Drop Location uses BANGALORE_AREAS dropdown)
  const [dropLocation, setDropLocation] = useState(initialData.dropLocation || 'Kempegowda Intl Airport (BLR T1/T2)');
  const [roundTripDuration, setRoundTripDuration] = useState(initialData.roundTripDuration || '4hr'); // 2hr, 4hr, 6hr, 12hr
  const [outstationPackage, setOutstationPackage] = useState(initialData.outstationPackage || 'Round trip 24hr'); // 12hr, 24hr, 46hr, 72hr
  const [outstationDestination, setOutstationDestination] = useState(initialData.outstationDestination || 'Coorg (Madikeri)');

  // Passenger Count, Luggage Count & AC / Non-AC Preference
  const [passengerCount, setPassengerCount] = useState(''); // Empty initially so placeholder is shown
  const [luggageCount, setLuggageCount] = useState(''); // Empty initially so placeholder is shown
  const [acPreference, setAcPreference] = useState('AC'); // 'AC' or 'Non-AC'

  // Location & date/time
  const [pickupArea, setPickupArea] = useState(initialData.pickupArea || 'Indiranagar');
  const [streetAddress, setStreetAddress] = useState('');
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookingTime, setBookingTime] = useState('09:00');
  
  // Customer Details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash', 'upi'

  const [formError, setFormError] = useState('');

  // Lock background body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (initialType) setBookingCategory(initialType);
    if (initialData.driverTripOption) setDriverTripOption(initialData.driverTripOption);
    if (initialData.vehicleCategory) setVehicleCategory(initialData.vehicleCategory);
    if (initialData.pickupArea) setPickupArea(initialData.pickupArea);
    if (initialData.dropLocation) setDropLocation(initialData.dropLocation);
    if (initialData.roundTripDuration) setRoundTripDuration(initialData.roundTripDuration);
    if (initialData.outstationPackage) setOutstationPackage(initialData.outstationPackage);
    if (initialData.outstationDestination) setOutstationDestination(initialData.outstationDestination);
  }, [initialType, initialData, isOpen]);

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setPassengerCount('');
    setLuggageCount('');
    setStreetAddress('');
    setSpecialInstructions('');
    setFormError('');
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Dynamic fare calculation
  const calculateTotalFare = () => {
    let base = 299;

    if (bookingCategory === 'vehicle') {
      if (vehicleCategory === 'Sedan') base = 1999;
      else if (vehicleCategory === 'SUV') base = 3499;
      else if (vehicleCategory === '12 Seater') base = 5499;
      else if (vehicleCategory === '24 Seater') base = 7999;
      else if (vehicleCategory === '32 Seater') base = 10999;
    } else {
      if (driverTripOption === 'one-way') {
        base = dropLocation.includes('Airport') ? 899 : 299;
      } else if (driverTripOption === 'round-trip') {
        if (roundTripDuration.includes('4hr')) base = 349;
        else if (roundTripDuration.includes('8hr')) base = 599;
        else if (roundTripDuration.includes('12hr')) base = 899;
        else base = 1299;
      } else {
        if (outstationPackage.includes('24hr')) base = 1499;
        else if (outstationPackage.includes('36hr')) base = 2199;
        else base = 2799;
      }
    }
    const gst = Math.round(base * 0.05);
    return { base, gst, total: base + gst };
  };

  const fareInfo = calculateTotalFare();

  const handleSubmitBooking = (e) => {
    e.preventDefault();
    setFormError('');

    if (!passengerCount || parseInt(passengerCount) < 1) {
      setFormError('Please enter the number of passengers traveling');
      return;
    }
    if (!customerName.trim()) {
      setFormError('Please enter your full customer name');
      return;
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 10) {
      setFormError('Please enter a valid 10-digit mobile number for SMS/WhatsApp updates');
      return;
    }

    const bookingId = 'BDA-' + Math.floor(100000 + Math.random() * 900000);

    let tripSummary = '';
    let serviceName = '';

    if (bookingCategory === 'vehicle') {
      serviceName = `Book a Vehicle (${vehicleCategory})`;
      tripSummary = `Vehicle Rental: ${vehicleCategory} (Pickup: ${pickupArea} to Drop: ${dropLocation})`;
    } else {
      if (driverTripOption === 'one-way') {
        serviceName = 'One Way Trip Driver';
        tripSummary = `One Way Trip (Pickup: ${pickupArea} to Drop: ${dropLocation})`;
      } else if (driverTripOption === 'round-trip') {
        serviceName = 'Round Trip Driver';
        tripSummary = `Round Trip (${roundTripDuration} Package in ${pickupArea})`;
      } else {
        serviceName = 'Outstation Driver';
        tripSummary = `Outstation Trip (${outstationPackage} to ${outstationDestination})`;
      }
    }

    const bookingDetails = {
      bookingId,
      bookingType: bookingCategory,
      driverTripOption: bookingCategory === 'driver' ? driverTripOption : undefined,
      vehicleCategory: bookingCategory === 'vehicle' ? vehicleCategory : undefined,
      serviceName,
      category: bookingCategory === 'vehicle' ? 'Book a Vehicle' : 'Book a Driver',
      tripSummary,
      pickupArea,
      dropLocation,
      roundTripDuration: bookingCategory === 'driver' && driverTripOption === 'round-trip' ? roundTripDuration : undefined,
      outstationPackage: bookingCategory === 'driver' && driverTripOption === 'outstation' ? outstationPackage : undefined,
      outstationDestination: bookingCategory === 'driver' && driverTripOption === 'outstation' ? outstationDestination : undefined,
      passengers: `${passengerCount} Passenger${parseInt(passengerCount) > 1 ? 's' : ''}`,
      luggage: luggageCount ? `${luggageCount} Bag${parseInt(luggageCount) > 1 ? 's' : ''}` : 'No Luggage',
      acPreference,
      streetAddress: streetAddress || `${pickupArea}, Bengaluru`,
      bookingDate,
      bookingTime,
      customerName,
      customerPhone,
      customerEmail,
      paymentMode,
      totalFare: fareInfo.total,
      assignedAnna: bookingCategory === 'vehicle' ? "Manjunath Gowda (Assigned Vehicle Captain)" : "Manjunath Gowda (Assigned Driver)"
    };

    // Send WhatsApp notification with all details directly to Admin's registered WhatsApp number
    const adminPhone = (localStorage.getItem('bda_admin_phone') || '+91 98860 12345').replace(/[^0-9]/g, '');
    const adminMessage = `🚖 *NEW CLIENT BOOKING CONFIRMED* 🚖\n\n` +
      `📌 *Booking Ref:* ${bookingId}\n` +
      `👤 *Customer Name:* ${customerName}\n` +
      `📞 *Customer Phone:* ${customerPhone}\n` +
      `🚕 *Service Required:* ${serviceName}\n` +
      `📍 *Pickup Area:* ${pickupArea}\n` +
      `🏁 *Drop Location:* ${dropLocation}\n` +
      `👥 *Passengers:* ${passengerCount} Passenger(s)\n` +
      `💼 *Luggage:* ${luggageCount ? luggageCount + ' Bag(s)' : 'No Luggage'}\n` +
      `❄️ *Vehicle Preference:* ${acPreference}\n` +
      `📅 *Pickup Schedule:* ${bookingDate} at ${bookingTime}\n` +
      `💰 *Total Estimated Fare:* ₹${fareInfo.total}\n\n` +
      `Please log into the Admin Dashboard to assign driver & confirm!`;

    window.open(`https://api.whatsapp.com/send?phone=${adminPhone}&text=${encodeURIComponent(adminMessage)}`, '_blank');

    onBookingComplete(bookingDetails);
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl z-10 animate-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[90vh]">
        
        {/* Header bar */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 px-6 py-4 text-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-950 text-amber-400 rounded-xl">
              {bookingCategory === 'vehicle' ? <Car className="w-5 h-5" /> : <SteeringWheel className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="font-extrabold text-xl font-['Outfit'] leading-tight">
                {bookingCategory === 'vehicle' ? 'Book a Vehicle — Rental Fleet' : 'Book Driver Anna'}
              </h2>
              <p className="text-xs font-semibold text-slate-900/80">
                Namma Bengaluru Customer Booking Form
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-950/20 hover:bg-slate-950/40 text-slate-950 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmitBooking} className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* =========================================================================
              SERVICE 1: DRIVER TRIP OPTIONS (One Way, Round Trip, Outstation)
             ========================================================================= */}
          {bookingCategory === 'driver' && (
            <div>
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Select Driver Trip Option
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                {/* One Way */}
                <button
                  type="button"
                  onClick={() => setDriverTripOption('one-way')}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    driverTripOption === 'one-way'
                      ? 'bg-amber-400/10 border-amber-400 text-white shadow-lg'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white">One Way Trip</span>
                    <Navigation className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-[11px] text-slate-400">Pickup & Drop Location</p>
                </button>

                {/* Round Trip */}
                <button
                  type="button"
                  onClick={() => setDriverTripOption('round-trip')}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    driverTripOption === 'round-trip'
                      ? 'bg-amber-400/10 border-amber-400 text-white shadow-lg'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white">Round Trip</span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-[11px] text-slate-400">2hr, 4hr, 6hr, 12hr</p>
                </button>

                {/* Outstation */}
                <button
                  type="button"
                  onClick={() => setDriverTripOption('outstation')}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    driverTripOption === 'outstation'
                      ? 'bg-amber-400/10 border-amber-400 text-white shadow-lg'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white">Outstation</span>
                    <Compass className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-[11px] text-slate-400">12hr, 24hr, 46hr, 72hr</p>
                </button>

              </div>
            </div>
          )}

          {/* =========================================================================
              SERVICE 2: VEHICLE CATEGORY OPTIONS (Sedan, SUV, 12 Seater, 24 Seater, 32 Seater)
             ========================================================================= */}
          {bookingCategory === 'vehicle' && (
            <div>
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5" /> Select Vehicle Option (Sedan, SUV, 12, 24, 32 Seater)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: 'Sedan', label: 'Sedan', cap: '4 Seater', price: '₹1,999' },
                  { id: 'SUV', label: 'SUV', cap: '6-7 Seater', price: '₹3,499' },
                  { id: '12 Seater', label: '12 Seater', cap: 'Traveller', price: '₹5,499' },
                  { id: '24 Seater', label: '24 Seater', cap: 'Mini Bus', price: '₹7,999' },
                  { id: '32 Seater', label: '32 Seater', cap: 'Coach Bus', price: '₹10,999' }
                ].map((v) => {
                  const isSelected = vehicleCategory === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVehicleCategory(v.id)}
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 border-amber-400 font-extrabold shadow-lg scale-[1.02]'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-extrabold text-xs">{v.label}</div>
                      <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>{v.cap}</div>
                      {/* Clean price text without any box/border background */}
                      <div className={`text-[11px] font-black mt-0.5 ${isSelected ? 'text-slate-950' : 'text-amber-400'}`}>
                        {v.price}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* DYNAMIC LOCATION FIELDS FOR DRIVER OPTIONS */}
          {bookingCategory === 'driver' && driverTripOption === 'one-way' && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4 animate-in fade-in duration-200">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-amber-400" /> One Way Locations
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Pickup Location Dropdown */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" /> Pickup Location *
                  </label>
                  <select
                    value={pickupArea}
                    onChange={(e) => setPickupArea(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {BANGALORE_AREAS.map((a, i) => (
                      <option key={i} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Drop Location Dropdown */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" /> Drop Location *
                  </label>
                  <select
                    value={dropLocation}
                    onChange={(e) => setDropLocation(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {BANGALORE_AREAS.map((a, i) => (
                      <option key={i} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {bookingCategory === 'driver' && driverTripOption === 'round-trip' && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4 animate-in fade-in duration-200">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> Round Trip Duration (2hr, 4hr, 6hr, 12hr)
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: '2hr', label: '2hr', price: '₹199' },
                  { id: '4hr', label: '4hr', price: '₹349' },
                  { id: '6hr', label: '6hr', price: '₹499' },
                  { id: '12hr', label: '12hr', price: '₹899' }
                ].map((dur) => {
                  const isSelected = roundTripDuration === dur.id;
                  return (
                    <button
                      key={dur.id}
                      type="button"
                      onClick={() => setRoundTripDuration(dur.id)}
                      className={`py-3 px-2 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 border-amber-400 font-extrabold shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{dur.label}</div>
                      <div className={`text-[10px] font-black mt-0.5 ${isSelected ? 'text-slate-950' : 'text-amber-400'}`}>{dur.price}</div>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-400" /> Pickup Location in Bangalore *
                </label>
                <select
                  value={pickupArea}
                  onChange={(e) => setPickupArea(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  {BANGALORE_AREAS.map((a, i) => (
                    <option key={i} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {bookingCategory === 'driver' && driverTripOption === 'outstation' && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4 animate-in fade-in duration-200">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-amber-400" /> Outstation Packages (Round trip 12hr, 24hr, 46hr, 72hr)
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'Round trip 12hr', label: 'Round trip 12hr', price: '₹1,199' },
                  { id: 'Round trip 24hr', label: 'Round trip 24hr', price: '₹1,999' },
                  { id: 'Round trip 46hr', label: 'Round trip 46hr', price: '₹3,899' },
                  { id: 'Round trip 72hr', label: 'Round trip 72hr', price: '₹5,799' }
                ].map((pkg) => {
                  const isSelected = outstationPackage === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setOutstationPackage(pkg.id)}
                      className={`py-3 px-2 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 border-amber-400 font-extrabold shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{pkg.label}</div>
                      <div className={`text-[10px] font-black mt-0.5 ${isSelected ? 'text-slate-950' : 'text-amber-400'}`}>{pkg.price}</div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" /> Bangalore Pickup Location *
                  </label>
                  <select
                    value={pickupArea}
                    onChange={(e) => setPickupArea(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {BANGALORE_AREAS.map((a, i) => (
                      <option key={i} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" /> Outstation Destination Spot *
                  </label>
                  <input
                    type="text"
                    required
                    value={outstationDestination}
                    onChange={(e) => setOutstationDestination(e.target.value)}
                    placeholder="e.g. Coorg, Nandi Hills, Chikmagalur, Mysuru"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* DYNAMIC LOCATION FIELDS FOR VEHICLE BOOKING */}
          {bookingCategory === 'vehicle' && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4 animate-in fade-in duration-200">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-amber-400" /> {vehicleCategory} Pickup & Drop Details
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Pickup Area Dropdown */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" /> Pickup Area in Bangalore *
                  </label>
                  <select
                    value={pickupArea}
                    onChange={(e) => setPickupArea(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {BANGALORE_AREAS.map((a, i) => (
                      <option key={i} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Drop Area Dropdown */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" /> Drop Location in Bangalore *
                  </label>
                  <select
                    value={dropLocation}
                    onChange={(e) => setDropLocation(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {BANGALORE_AREAS.map((a, i) => (
                      <option key={i} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* NUMBER OF PASSENGERS, LUGGAGE & AC PREFERENCE SECTION */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              {/* 1. Number of Passengers - Starts empty with Placeholder */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-400" /> No. of Passengers *
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={passengerCount}
                  onChange={(e) => setPassengerCount(e.target.value)}
                  placeholder="e.g. 2, 6, 12, 24"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* 2. Number of Luggage Bags - Starts empty with Placeholder */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-amber-400" /> No. of Luggage
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={luggageCount}
                  onChange={(e) => setLuggageCount(e.target.value)}
                  placeholder="e.g. 2 bags"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* 3. AC or Non-AC Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Snowflake className="w-3.5 h-3.5 text-amber-400" /> AC Preference *
                </label>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setAcPreference('AC')}
                    className={`py-2 px-1.5 rounded-xl border text-center transition-all ${
                      acPreference === 'AC'
                        ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-[11px] flex items-center justify-center gap-1">
                      <Snowflake className="w-3 h-3 text-cyan-400" /> AC
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAcPreference('Non-AC')}
                    className={`py-2 px-1.5 rounded-xl border text-center transition-all ${
                      acPreference === 'Non-AC'
                        ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-[11px] flex items-center justify-center gap-1">
                      <Sun className="w-3 h-3 text-amber-400" /> Non-AC
                    </div>
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* DATE & TIME & ADDRESS */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" /> Pickup Date, Time & Doorstep Address
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Pickup Date *</label>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Pickup Time *</label>
                <input
                  type="time"
                  value={bookingTime}
                  onChange={(e) => setBookingTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Exact Landmark / Doorstep Address</label>
              <input
                type="text"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="e.g. Near Metro Station / Flat 302, Green Palms, 100ft Road"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* CUSTOMER INFORMATION */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" /> Customer Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Mobile Number (WhatsApp) *</label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Special Notes for Driver / Captain (Optional)</label>
              <input
                type="text"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Extra legroom needed / Call before arrival"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* PAYMENT METHOD & FARE SUMMARY (2 PAYMENT OPTIONS: Cash & UPI) */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-300">Payment Option</span>
              <span className="text-sm font-extrabold text-amber-400 font-['Outfit']">
                Total ₹{fareInfo.total}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <button
                type="button"
                onClick={() => setPaymentMode('cash')}
                className={`py-3 px-3 rounded-xl border text-center font-bold transition-all flex items-center justify-center gap-1.5 ${
                  paymentMode === 'cash'
                    ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-500" />
                <span>Cash to Driver</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('upi')}
                className={`py-3 px-3 rounded-xl border text-center font-bold transition-all flex items-center justify-center gap-1.5 ${
                  paymentMode === 'upi'
                    ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                <Smartphone className="w-4 h-4 text-purple-400" />
                <span>GPay / PhonePe / UPI</span>
              </button>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-extrabold text-base shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>Confirm {bookingCategory === 'vehicle' ? `${vehicleCategory} Booking` : 'Driver Booking'} (₹{fareInfo.total})</span>
          </button>

          <p className="text-center text-[10px] text-slate-500 flex items-center justify-center gap-1">
            <Lock className="w-3 h-3 text-emerald-400" /> Free Cancellation up to 30 minutes before departure • Zero cancellation penalty
          </p>

        </form>
      </div>
    </div>
  );
}
