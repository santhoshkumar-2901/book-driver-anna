import React from 'react';
import { 
  Car, ShieldCheck, MapPin, Clock, 
  ArrowRight, Compass, Phone, GraduationCap 
} from 'lucide-react';
import { SteeringWheel, WhatsAppIcon } from '../components/Icons';
import PriceEstimator from '../components/PriceEstimator';
import { LOCAL_STATS, OUTSTATION_DESTINATIONS, SUPPORT_HELPLINE } from '../data/mockData';

export default function HomePage({ 
  setActivePage, 
  openBookingModal 
}) {
  return (
    <div className="space-y-12 pb-16">
      
      {/* HERO SECTION */}
      <section className="pt-6 sm:pt-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
          
          <div className="text-center space-y-3 sm:space-y-4 max-w-3xl mx-auto">
            {/* Status Label */}
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 text-[11px] sm:text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
              <span className="truncate">On-Demand Transit Services across Bengaluru</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-2xl sm:text-5xl font-extrabold text-white font-['Outfit'] tracking-tight leading-tight">
              Professional Drivers & Vehicle Rentals in Bengaluru
            </h1>

            {/* Subtitle */}
            <p className="text-xs sm:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto">
              Hire background-checked personal drivers for your car, rent reliable fleet vehicles, 
              or enroll in practical driving lessons across all major Bangalore localities.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-2.5 pt-2 w-full max-w-md sm:max-w-none mx-auto">
              <button
                onClick={() => openBookingModal('driver')}
                className="btn-primary w-full sm:w-auto"
              >
                <SteeringWheel className="w-4 h-4" />
                <span>Book a Driver</span>
              </button>

              <button
                onClick={() => openBookingModal('vehicle')}
                className="btn-secondary w-full sm:w-auto"
              >
                <Car className="w-4 h-4 text-amber-500" />
                <span>Rent a Vehicle</span>
              </button>

              <button
                onClick={() => openBookingModal('class')}
                className="btn-outline w-full sm:w-auto"
              >
                <GraduationCap className="w-4 h-4 text-amber-500" />
                <span>Driving Classes</span>
              </button>
            </div>

            {/* Service Guarantees */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-[11px] sm:text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Police Verified Drivers</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-500" /> ₹0 Advance Cancellation Fee</span>
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> 25+ Hubs Across Bengaluru</span>
            </div>
          </div>

          {/* FARE ESTIMATOR WIDGET */}
          <div className="max-w-4xl mx-auto">
            <PriceEstimator openBookingModal={openBookingModal} />
          </div>

        </div>
      </section>

      {/* OPERATIONAL METRICS STRIP */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="card-surface p-6 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          {LOCAL_STATS.map((stat, idx) => (
            <div key={idx} className="space-y-1">
              <div className="text-2xl sm:text-3xl font-bold text-white font-['Outfit']">{stat.value}</div>
              <div className="text-xs text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CORE SERVICES GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Service Catalog
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Outfit'] mt-1">
            Built for Bangalore Commutes & Travel
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* SERVICE 1: BOOK A DRIVER */}
          <div className="card-surface p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                <SteeringWheel className="w-5 h-5 stroke-[2.2]" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white font-['Outfit']">
                  On-Demand Driver Anna
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Hire an acting driver for your personal vehicle. Ideal for traffic commutes, airport drops, party returns, or outstation tours.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Hourly In-City:</span>
                  <span className="font-semibold text-white">From ₹199 / 2 hrs</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Airport Transfer:</span>
                  <span className="font-semibold text-white">₹899 flat</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Outstation Driver:</span>
                  <span className="font-semibold text-white">From ₹1,199 / day</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Gear Compatibility:</span>
                  <span className="text-slate-400">Manual, AMT, Automatic, EV</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={() => openBookingModal('driver')}
                className="btn-primary flex-1 text-xs"
              >
                <span>Book Driver</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActivePage('services')}
                className="btn-ghost text-xs"
              >
                Rates
              </button>
            </div>
          </div>

          {/* SERVICE 2: VEHICLE RENTALS */}
          <div className="card-surface p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center font-bold">
                <Car className="w-5 h-5 text-amber-500 stroke-[2.2]" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white font-['Outfit']">
                  Fleet Vehicle Rentals
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Rent commercial fleet vehicles with verified drivers. Perfect for airport pickups, family functions, corporate transit, and outstation trips.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Compact Sedan (Dzire):</span>
                  <span className="font-semibold text-white">₹1,999 / day</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>7-Seater SUV (Innova):</span>
                  <span className="font-semibold text-white">₹3,499 / day</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>12-Seater Tempo:</span>
                  <span className="font-semibold text-white">₹5,499 / day</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Sanitization & Fuel:</span>
                  <span className="text-slate-400">Commercial permit & clean cabin</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={() => openBookingModal('vehicle')}
                className="btn-secondary flex-1 text-xs"
              >
                <span>Rent Vehicle</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
              </button>
              <button
                onClick={() => setActivePage('services')}
                className="btn-ghost text-xs"
              >
                Fleet
              </button>
            </div>
          </div>

          {/* SERVICE 3: DRIVING ACADEMY */}
          <div className="card-surface p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center font-bold">
                <GraduationCap className="w-5 h-5 text-amber-500 stroke-[2.2]" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white font-['Outfit']">
                  Driving Academy
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Learn driving with certified instructors at your doorstep. Practice in dual-control training cars or refine daily commute routes in your personal vehicle.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Beginner Course (15 Days):</span>
                  <span className="font-semibold text-white">₹5,999 all-inc</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Personal Car Refresher:</span>
                  <span className="font-semibold text-white">₹2,999 (7 Days)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Automatic Specialist:</span>
                  <span className="font-semibold text-white">₹3,999 (10 Days)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Pickup:</span>
                  <span className="text-slate-400">Doorstep across Bengaluru</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={() => openBookingModal('class')}
                className="btn-outline flex-1 text-xs"
              >
                <span>Enroll in Class</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
              </button>
              <button
                onClick={() => setActivePage('services')}
                className="btn-ghost text-xs"
              >
                Syllabus
              </button>
            </div>
          </div>

        </div>
      </section>



      {/* POPULAR OUTSTATION ROUTES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Highway & Intercity
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Outfit'] mt-0.5">
            Popular Outstation Routes From Bengaluru
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Experienced highway drivers for single drops or round trips across Karnataka, Kerala & Tamil Nadu.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {OUTSTATION_DESTINATIONS.slice(0, 4).map((dest, idx) => (
            <div key={idx} className="card-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-base text-white font-['Outfit']">{dest.name}</span>
                <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                  {dest.distance}
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" /> Approx: {dest.driveTime}
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {dest.popularFor}
              </div>
              <button
                onClick={() => openBookingModal('driver')}
                className="btn-outline w-full py-1.5 text-xs mt-1"
              >
                Book Route Driver
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* SUPPORT & HELPLINE SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="card-surface p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-slate-800">
          <div className="space-y-1.5 text-center md:text-left">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              24/7 Dispatch Desk
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-white font-['Outfit']">
              Need assistance booking a driver or fleet vehicle?
            </h3>
            <p className="text-slate-400 text-xs sm:text-sm">
              Our dispatch coordinators are available round the clock across Indiranagar, Koramangala, Whitefield, and Electronic City.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            <button
              onClick={() => openBookingModal('driver')}
              className="btn-primary"
            >
              <SteeringWheel className="w-4 h-4" />
              <span>Book a Driver</span>
            </button>
            <a
              href={`https://wa.me/${SUPPORT_HELPLINE.replace(/[^0-9]/g, '')}?text=${encodeURIComponent("Hello Book Driver Anna, I need assistance booking a driver or fleet vehicle.")}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat on WhatsApp"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm cursor-pointer"
            >
              <WhatsAppIcon className="w-4 h-4 fill-white" />
              <span>WhatsApp</span>
            </a>
            <a
              href={`tel:${SUPPORT_HELPLINE.replace(/\s+/g, '')}`}
              className="btn-secondary"
            >
              <Phone className="w-4 h-4 text-amber-500" />
              <span>{SUPPORT_HELPLINE}</span>
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}


