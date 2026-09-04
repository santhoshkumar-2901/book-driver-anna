import React, { useState } from 'react';
import { 
  Car, CheckCircle2, Clock, ShieldCheck, MapPin, 
  Sparkles, Fuel, Users, ArrowRight, DollarSign, Filter, Moon, Compass, Briefcase, Navigation, Calendar, User, Phone, Check, Bus, GraduationCap, Award
} from 'lucide-react';
import { SteeringWheel } from '../components/Icons';
import { BOOK_DRIVER_TRIP_TYPES, VEHICLE_SERVICES, BANGALORE_AREAS, DRIVING_CLASSES, DRIVING_CLASS_HIGHLIGHTS } from '../data/mockData';

export default function ServicesPage({ openBookingModal }) {
  const [activeServiceTab, setActiveServiceTab] = useState('driver'); // 'driver', 'vehicle', 'class'
  const [vehicleCategoryFilter, setVehicleCategoryFilter] = useState('All');
  const categories = ['All', 'Sedan', 'SUV', '12 Seater', '24 Seater', '32 Seater'];

  const filteredVehicles = vehicleCategoryFilter === 'All'
    ? VEHICLE_SERVICES
    : VEHICLE_SERVICES.filter(v => v.category.toLowerCase() === vehicleCategoryFilter.toLowerCase());

  const handleOpenDriverOptionForm = (optionId) => {
    openBookingModal('driver', { driverTripOption: optionId });
  };

  const handleOpenVehicleForm = (veh) => {
    openBookingModal('vehicle', { 
      vehicleCategory: veh.category,
      vehicleName: veh.name,
      vehicleRate: veh.dailyRate
    });
  };

  const handleOpenClassForm = (cls) => {
    openBookingModal('class', { 
      selectedClassId: cls.id,
      classTransmission: cls.transmission.includes('Manual') ? 'Manual' : 'Automatic'
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      
      {/* Header Banner */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 text-amber-400 text-xs font-bold border border-amber-400/20">
          <Sparkles className="w-3.5 h-3.5" /> Namma Bengaluru Services
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white font-['Outfit']">
          Book Driver Anna & Vehicle Rentals
        </h1>
        <p className="text-slate-300 text-base leading-relaxed">
          Choose from <span className="text-amber-400 font-semibold">Book a Driver</span>, <span className="text-amber-400 font-semibold">Book a Vehicle</span>, or learn driving with certified instructors in our <span className="text-amber-400 font-semibold">Driving Classes</span>.
        </p>

        {/* Primary Service Selector */}
        <div className="inline-flex p-1.5 bg-slate-900 rounded-2xl border border-slate-800 shrink-0 mt-4 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveServiceTab('driver')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-extrabold transition-all whitespace-nowrap ${
              activeServiceTab === 'driver'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <SteeringWheel className="w-4 h-4" />
            <span>Book a Driver</span>
          </button>

          <button
            onClick={() => setActiveServiceTab('vehicle')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-extrabold transition-all whitespace-nowrap ${
              activeServiceTab === 'vehicle'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Book a Vehicle</span>
          </button>

          <button
            onClick={() => setActiveServiceTab('class')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-extrabold transition-all whitespace-nowrap ${
              activeServiceTab === 'class'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Driving Classes</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          SERVICE 1: BOOK A DRIVER (3 OPTIONS: ONE WAY, ROUND TRIP, OUTSTATION)
         ========================================================================= */}
      {activeServiceTab === 'driver' && (
        <div className="space-y-12 animate-in fade-in duration-300">
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" /> Driver Services Breakdown
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-['Outfit'] mt-1">
                  Book a Driver — Choose Your Trip Type
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mt-1">
                  Click any of the trip options below to fill out your customer booking form.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold hidden sm:inline">Have questions?</span>
                <a 
                  href="tel:+919886012345" 
                  className="py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 text-xs font-bold hover:border-amber-400 transition-colors flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-amber-400" /> 24x7 Support
                </a>
              </div>
            </div>
          </div>

          {/* 3 CORE TRIP CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* ONE WAY TRIP */}
            <div 
              onClick={() => handleOpenDriverOptionForm('one-way')}
              className="bg-slate-900 border border-slate-800 hover:border-amber-400 rounded-xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 cursor-pointer group relative overflow-hidden shadow-xl hover:shadow-amber-400/10"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="bg-amber-400/10 text-amber-400 border border-amber-400/30 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5" /> One Way
                  </span>
                  <span className="text-amber-400 font-extrabold text-sm font-['Outfit']">
                    Starts @ ₹249
                  </span>
                </div>

                <h3 className="text-2xl font-extrabold text-white font-['Outfit'] group-hover:text-amber-400 transition-colors">
                  One Way Trip
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Hire Anna to drive your car from your pickup location to your drop location across Bangalore or Kempegowda Airport.
                </p>

                {/* Option Highlights */}
                <div className="space-y-2 pt-2 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Form Highlights:</div>
                  <div className="flex items-center gap-2 text-xs text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>Pickup Location</strong> (Bangalore)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>Drop Location</strong> (Airport / City landmark)</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800 flex items-center justify-between mt-6">
                <span className="text-xs text-slate-400 font-medium">Point A to Point B</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleOpenDriverOptionForm('one-way'); }}
                  className="py-2.5 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow transition-colors flex items-center gap-1.5"
                >
                  <span>Book One Way</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ROUND TRIP */}
            <div 
              onClick={() => handleOpenDriverOptionForm('round-trip')}
              className="bg-slate-900 border border-slate-800 hover:border-amber-400 rounded-xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 cursor-pointer group relative overflow-hidden shadow-xl hover:shadow-amber-400/10"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="bg-amber-400/10 text-amber-400 border border-amber-400/30 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Round Trip
                  </span>
                  <span className="text-amber-400 font-extrabold text-sm font-['Outfit']">
                    Starts @ ₹199
                  </span>
                </div>

                <h3 className="text-2xl font-extrabold text-white font-['Outfit'] group-hover:text-amber-400 transition-colors">
                  Round Trip
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Hire Anna for in-city errands, shopping, hospital visits, night parties, or office commute & return home safely.
                </p>

                {/* Option Highlights */}
                <div className="space-y-2 pt-2 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Duration Packages:</div>
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {['2hr', '4hr', '6hr', '12hr'].map((dur) => (
                      <span key={dur} className="bg-slate-900 text-amber-400 border border-amber-400/30 text-center py-1 text-[11px] rounded-lg font-bold">
                        {dur}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300 pt-1">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Pickup Location & Return Home</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800 flex items-center justify-between mt-6">
                <span className="text-xs text-slate-400 font-medium">In-City Hourly</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleOpenDriverOptionForm('round-trip'); }}
                  className="py-2.5 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow transition-colors flex items-center gap-1.5"
                >
                  <span>Book Round Trip</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* OUTSTATION */}
            <div 
              onClick={() => handleOpenDriverOptionForm('outstation')}
              className="bg-slate-900 border border-slate-800 hover:border-amber-400 rounded-xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 cursor-pointer group relative overflow-hidden shadow-xl hover:shadow-amber-400/10"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="bg-amber-400/10 text-amber-400 border border-amber-400/30 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5" /> Outstation
                  </span>
                  <span className="text-amber-400 font-extrabold text-sm font-['Outfit']">
                    Starts @ ₹1,199
                  </span>
                </div>

                <h3 className="text-2xl font-extrabold text-white font-['Outfit'] group-hover:text-amber-400 transition-colors">
                  Outstation
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Hire an experienced highway & hill driver Anna for long-distance weekend trips to Coorg, Nandi Hills, Chikmagalur, Mysore, etc.
                </p>

                {/* Option Highlights */}
                <div className="space-y-2 pt-2 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Outstation Trip Packages:</div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {['Round trip (12-72hr)', 'One Way Drop (150-500km)'].map((pkg) => (
                      <span key={pkg} className="bg-slate-900 text-amber-400 border border-amber-400/30 text-center py-1 text-[10px] rounded-lg font-bold">
                        {pkg}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300 pt-1">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Both Round Trip & One Way Drops</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800 flex items-center justify-between mt-6">
                <span className="text-xs text-slate-400 font-medium">Highway & Hills</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleOpenDriverOptionForm('outstation'); }}
                  className="py-2.5 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow transition-colors flex items-center gap-1.5"
                >
                  <span>Book Outstation</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* =========================================================================
          SERVICE 2: BOOK A VEHICLE (SEDAN, SUV, 12 SEATER, 24 SEATER, 32 SEATER)
         ========================================================================= */}
      {activeServiceTab === 'vehicle' && (
        <div className="space-y-10 animate-in fade-in duration-300">
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Car className="w-4 h-4" /> Book a Vehicle Section
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-['Outfit']">
                Select Your Rental Vehicle (Clean Cars & Buses)
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
                Choose from Sedan, SUV, 12 Seater, 24 Seater, or 32 Seater options. Click any vehicle to fill out your booking form!
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a 
                href="tel:+919886012345" 
                className="py-3 px-5 rounded-2xl bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg hover:bg-amber-300 transition-colors flex items-center gap-2"
              >
                <Phone className="w-4 h-4 fill-slate-950" /> 24x7 Vehicle Helpdesk
              </a>
            </div>
          </div>

          {/* 5 Specific Vehicle Categories Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filter Category:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setVehicleCategoryFilter(cat)}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
                  vehicleCategoryFilter === cat
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Vehicle Cards Grid (5 Options: Sedan, SUV, 12 Seater, 24 Seater, 32 Seater) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredVehicles.map((veh) => (
              <div 
                key={veh.id}
                onClick={() => handleOpenVehicleForm(veh)}
                className="bg-slate-900 border border-slate-800 hover:border-amber-400 rounded-xl overflow-hidden flex flex-col justify-between transition-all duration-300 group cursor-pointer shadow-xl hover:shadow-amber-400/10"
              >
                <div>
                  <div className="relative h-56 overflow-hidden bg-slate-950">
                    <img 
                      src={veh.image} 
                      alt={veh.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-3 left-3 bg-slate-950/90 text-amber-400 font-extrabold text-[10px] px-3 py-1.5 rounded-full border border-amber-400/30">
                      {veh.badge}
                    </span>
                    <span className="absolute bottom-3 right-3 bg-slate-950/90 text-white font-mono font-bold text-xs px-3 py-1.5 rounded-xl border border-slate-800">
                      ₹{veh.dailyRate} / Day
                    </span>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <Car className="w-3.5 h-3.5" /> Category: {veh.category}
                      </div>
                      <h3 className="text-xl font-extrabold text-white font-['Outfit'] mt-1 group-hover:text-amber-400 transition-colors">
                        {veh.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{veh.description}</p>
                    </div>

                    {/* Specifications Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        <span>{veh.seats} Seats</span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                        <span>{veh.luggage}</span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300 flex items-center gap-1.5">
                        <Fuel className="w-3.5 h-3.5 text-amber-400" />
                        <span>{veh.fuel}</span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300 flex items-center gap-1.5">
                        <SteeringWheel className="w-3.5 h-3.5 text-amber-400" />
                        <span>{veh.transmission}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0 flex items-center justify-between border-t border-slate-800/80 mt-4">
                  <div className="text-[11px] text-slate-400">
                    Outstation Rate: <span className="text-amber-400 font-bold">₹{veh.outstationPerKm}/km</span>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenVehicleForm(veh); }}
                    className="py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow transition-colors flex items-center gap-1.5"
                  >
                    <span>Book {veh.category}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* =========================================================================
          SERVICE 3: DRIVING CLASSES & PERSONALIZED TRAINING
         ========================================================================= */}
      {activeServiceTab === 'class' && (
        <div className="space-y-12 animate-in fade-in duration-300">
          
          {/* Section Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                  <Award className="w-4 h-4" /> Dual-Control Certified & RTO Trained Annas
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-['Outfit'] mt-1">
                  Driving Classes with Driver Anna
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mt-1">
                  Learn driving without fear! Our patient, respectful Annas coach you 1-on-1 at your doorstep—either in dual-control cars or in your personal car.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openBookingModal('class')}
                  className="py-2.5 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold shadow-lg transition-all flex items-center gap-2"
                >
                  <GraduationCap className="w-4 h-4" /> Enroll Now
                </button>
              </div>
            </div>

            {/* Highlights Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800">
              {DRIVING_CLASS_HIGHLIGHTS.map((item, idx) => (
                <div key={idx} className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-0.5">
                  <div className="text-[10px] uppercase font-bold text-amber-400">{item.label}</div>
                  <div className="text-sm font-extrabold text-white font-['Outfit']">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Course Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {DRIVING_CLASSES.map((cls) => (
              <div 
                key={cls.id}
                className="bg-slate-900 border border-slate-800 hover:border-amber-400/50 rounded-xl overflow-hidden shadow-xl transition-all duration-300 flex flex-col justify-between group"
              >
                <div className="p-6 space-y-4">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="bg-amber-400/10 text-amber-400 border border-amber-400/20 px-3 py-1 rounded-full text-[11px] font-bold">
                      {cls.badge}
                    </span>
                    <span className="text-2xl font-black text-amber-400 font-['Outfit']">
                      ₹{cls.basePrice}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-white font-['Outfit'] group-hover:text-amber-400 transition-colors">
                      {cls.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" /> {cls.duration}
                    </p>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {cls.description}
                  </p>

                  {/* Vehicle & Transmission tags */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-medium flex items-center gap-1">
                      <Car className="w-3 h-3 text-amber-400" /> {cls.carOptions.join(' • ')}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-medium flex items-center gap-1">
                      <SteeringWheel className="w-3 h-3 text-amber-400" /> {cls.transmission}
                    </span>
                  </div>

                  {/* Syllabus / Features */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">What You Will Master:</div>
                    <ul className="space-y-1.5">
                      {cls.features.map((feat, fIdx) => (
                        <li key={fIdx} className="text-xs text-slate-300 flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="p-6 pt-0 border-t border-slate-800/80 mt-4 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Ideal For: <strong className="text-white">{cls.popularFor}</strong>
                  </span>

                  <button
                    onClick={() => handleOpenClassForm(cls)}
                    className="py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow transition-colors flex items-center gap-1.5"
                  >
                    <span>Enroll Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Why Learn With Anna Feature Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" /> The Driver Anna Promise
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white font-['Outfit']">
              Why Learn Driving with Book Driver Anna?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-1.5">
                <div className="font-bold text-amber-300 text-sm">Zero-Shouting & Polite Conduct</div>
                <p className="text-xs text-slate-400">Traditional driving instructors get impatient and yell. Annas are trained to be calm, encouraging, and respectful at all times.</p>
              </div>
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-1.5">
                <div className="font-bold text-amber-300 text-sm">Practice Your Exact Daily Routes</div>
                <p className="text-xs text-slate-400">Practice your home-to-work route, your children's school drop, and tricky basement parking ramps until it's second nature.</p>
              </div>
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-1.5">
                <div className="font-bold text-amber-300 text-sm">Doorstep Morning & Evening Batches</div>
                <p className="text-xs text-slate-400">No need to travel to a driving school. Anna reaches your home at 6:00 AM or 5:00 PM for daily 1-hour sessions.</p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* FOOTER CALLOUT */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4">
        <h3 className="text-2xl font-bold text-white font-['Outfit']">
          Need custom corporate or wedding driving arrangements?
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Call our Indiranagar 24x7 helpdesk. Our friendly Anna will customize the driver or car rental package for your exact needs!
        </p>
        <a 
          href="tel:+919886012345" 
          className="inline-flex items-center gap-2 py-3 px-6 rounded-2xl bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg hover:bg-amber-300 transition-colors"
        >
          <Phone className="w-4 h-4 fill-slate-950" /> Call Helpline: +91 98860 12345
        </a>
      </div>

    </div>
  );
}
