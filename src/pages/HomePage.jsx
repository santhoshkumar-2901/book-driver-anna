import React from 'react';
import { 
  Car, ShieldCheck, MapPin, Clock, Star, 
  ArrowRight, PhoneCall, CheckCircle2, Compass, GraduationCap, User
} from 'lucide-react';
import { SteeringWheel } from '../components/Icons';
import PriceEstimator from '../components/PriceEstimator';
import { FEATURED_DRIVERS, LOCAL_STATS, OUTSTATION_DESTINATIONS, DRIVING_CLASSES } from '../data/mockData';

export default function HomePage({ 
  setActivePage, 
  openBookingModal, 
  openDriverSpotlight,
  clientUser,
  onOpenProfile
}) {
  return (
    <div className="space-y-14 pb-16">

      {/* Authenticated Member Bar */}
      {clientUser && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div 
            onClick={onOpenProfile}
            className="bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3 transition-colors cursor-pointer"
            title="Click to view account and active bookings"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center shrink-0">
                {clientUser.name ? clientUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-400">Welcome,</span>
                  <span className="text-sm font-bold text-white truncate">
                    {clientUser.name}
                  </span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded font-medium">
                    Verified Account
                  </span>
                </div>
                <div className="text-xs text-slate-400 truncate flex items-center gap-2 mt-0.5">
                  <span>{clientUser.phone}</span>
                  <span>•</span>
                  <span>{clientUser.area || 'Indiranagar'}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenProfile) onOpenProfile();
              }}
              className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <User className="w-3.5 h-3.5" />
              <span>View Profile</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Hero Section */}
      <section className="pt-8 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-5">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>On-Demand Driver Services across Bengaluru</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white font-['Outfit'] tracking-tight leading-tight">
            Professional Drivers & Car Rentals in Bengaluru
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Hire police-verified drivers for your personal vehicle, rent commercial cars for outstation getaways, or enroll in 1-on-1 doorstep driving classes.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => openBookingModal('driver')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <SteeringWheel className="w-4 h-4 text-slate-950" />
              <span>Book a Driver</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => openBookingModal('vehicle')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-medium text-sm border border-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Car className="w-4 h-4 text-amber-400" />
              <span>Rent a Vehicle</span>
            </button>

            <button
              onClick={() => openBookingModal('class')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-medium text-sm border border-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 text-emerald-400" />
              <span>Driving Classes</span>
            </button>
          </div>

          {/* Trust Assurances */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Police-Verified Drivers</span>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-400" /> Zero Cancellation Fee</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> All 15 Bangalore Zones</span>
          </div>

        </div>

        {/* Fare Estimator Component */}
        <div className="mt-10 max-w-5xl mx-auto">
          <PriceEstimator openBookingModal={openBookingModal} />
        </div>
      </section>

      {/* Operational Highlights Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          {LOCAL_STATS.map((stat, idx) => (
            <div key={idx} className="space-y-1">
              <div className="text-xl sm:text-2xl font-bold text-white font-['Outfit']">{stat.value}</div>
              <div className="text-xs text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Core Services Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white font-['Outfit']">
              Service Offerings
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Choose the right transportation solution for your schedule and vehicle
            </p>
          </div>
          <button
            onClick={() => setActivePage('services')}
            className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1 cursor-pointer w-fit"
          >
            View Full Rate Card <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Driver Service */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center">
                <SteeringWheel className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Hire a Driver for Your Car</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Professional drivers for in-city hourly trips, airport transfers, late-night party returns, or outstation road trips.
                </p>
              </div>

              <div className="pt-2">
                <div className="text-xs font-medium text-amber-400 mb-2">Starting at ₹199 for 2 hours</div>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>In-City Hourly: 2hr, 4hr, 8hr, 12hr packages</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>One-Way Drops: Airport and city transit</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Outstation Trips: Mysore, Coorg, Ooty</span>
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => openBookingModal('driver')}
              className="w-full py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Book a Driver</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Vehicle Rental Service */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Vehicle Rentals with Driver</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Clean, well-maintained commercial vehicles ranging from 4-seater Sedans to 12-seater Tempo Travellers and buses.
                </p>
              </div>

              <div className="pt-2">
                <div className="text-xs font-medium text-amber-400 mb-2">Starting at ₹1,999 / day</div>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Sedans: Dzire & Etios (From ₹1,999/day)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>SUVs: Innova Crysta (From ₹3,499/day)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Group Travel: 12-seater Tempos & Coaches</span>
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => openBookingModal('vehicle')}
              className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-xs border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Rent a Vehicle</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Driving Classes Service */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Doorstep Driving Instruction</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  1-on-1 practical coaching at your doorstep. Choose between dual-control training vehicles or practice in your personal car.
                </p>
              </div>

              <div className="pt-2">
                <div className="text-xs font-medium text-amber-400 mb-2">Starting at ₹2,999 all-inclusive</div>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>15-Day Beginner Foundation Course</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>7-Day In-City Traffic Refresher</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Personal Car Route Training</span>
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => openBookingModal('class')}
              className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-xs border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Enroll in Driving Class</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </section>

      {/* Driving Classes Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white font-['Outfit']">
                Doorstep Driving Programs
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Structured courses tailored for new learners and license holders seeking confidence
              </p>
            </div>
            <button
              onClick={() => openBookingModal('class')}
              className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-colors shrink-0 cursor-pointer"
            >
              Enroll Now
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {DRIVING_CLASSES.map((cls) => (
              <div 
                key={cls.id}
                onClick={() => openBookingModal('class', { selectedClassId: cls.id })}
                className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg p-4 transition-colors cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-400">₹{cls.basePrice}</span>
                    <span className="text-[10px] text-slate-400">{cls.duration}</span>
                  </div>
                  <h3 className="font-bold text-white text-sm">{cls.name}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2">{cls.description}</p>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-amber-400 font-medium">
                  <span>Enroll</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Verified Drivers */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white font-['Outfit']">
              Verified Driver Partners
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Experienced, background-verified professionals fluent in regional languages
            </p>
          </div>
          <button
            onClick={() => setActivePage('about')}
            className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1 cursor-pointer w-fit"
          >
            Verification Standards <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURED_DRIVERS.map((driver) => (
            <div 
              key={driver.id} 
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <img 
                  src={driver.avatar} 
                  alt={driver.name} 
                  className="w-full h-40 rounded-lg object-cover"
                />
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-white">{driver.name}</h3>
                    <div className="flex items-center gap-1 text-xs font-semibold text-amber-400">
                      <Star className="w-3 h-3 fill-amber-400" /> {driver.rating}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{driver.experience}</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Specialty: {driver.specialty}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex gap-2">
                <button
                  onClick={() => openDriverSpotlight(driver)}
                  className="flex-1 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-800 transition-colors"
                >
                  Profile
                </button>
                <button
                  onClick={() => openBookingModal('driver')}
                  className="flex-1 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors"
                >
                  Book
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Outstation Trips */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white font-['Outfit']">
            Common Outstation Destinations
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Round-trip and one-way driver rates for popular weekend routes from Bengaluru
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {OUTSTATION_DESTINATIONS.slice(0, 4).map((dest, idx) => (
            <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-white">{dest.name}</span>
                <span className="text-xs text-slate-400 font-medium">
                  {dest.distance}
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> Approx. {dest.driveTime}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {dest.popularFor}
              </div>
              <button
                onClick={() => openBookingModal('driver')}
                className="w-full py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-200 hover:text-white font-medium text-xs rounded-lg border border-slate-800 transition-colors"
              >
                Book Outstation Driver
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Direct Contact & Support Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-lg sm:text-xl font-bold text-white font-['Outfit']">
              Need immediate driver assistance or a custom itinerary?
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Our dispatch desk operates 24 hours a day across Indiranagar, Koramangala, Whitefield, and Electronic City.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="tel:+919886012345"
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white font-medium text-xs rounded-lg border border-slate-700 flex items-center gap-2 transition-colors"
            >
              <PhoneCall className="w-4 h-4 text-amber-400" />
              <span>+91 98860 12345</span>
            </a>
            <button
              onClick={() => openBookingModal('driver')}
              className="py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Book a Driver
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
