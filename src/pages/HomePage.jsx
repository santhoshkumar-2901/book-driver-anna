import React from 'react';
import { 
  Car, ShieldCheck, MapPin, Clock, Star, Sparkles, 
  ArrowRight, PhoneCall, CheckCircle2, Award, Users, HeartHandshake, Compass, Heart, Phone
} from 'lucide-react';
import { SteeringWheel } from '../components/Icons';
import PriceEstimator from '../components/PriceEstimator';
import { DRIVER_SERVICES, VEHICLE_SERVICES, FEATURED_DRIVERS, BANGALORE_TESTIMONIALS, LOCAL_STATS, OUTSTATION_DESTINATIONS } from '../data/mockData';

export default function HomePage({ setActivePage, openBookingModal, openDriverSpotlight }) {
  return (
    <div className="space-y-20 pb-16">
      
      {/* HERO SECTION */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Glowing gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent blur-3xl pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center space-y-6 max-w-4xl mx-auto">
            
            {/* Local Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-amber-500/30 text-amber-400 text-xs font-bold shadow-xl animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Namma Bengaluru's Most Loved Driver & Vehicle Rental</span>
              <span className="bg-amber-400 text-slate-950 text-[10px] px-2 py-0.5 rounded-full font-black uppercase">24x7 Active</span>
            </div>

            {/* Main Title */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white font-['Outfit'] tracking-tight leading-[1.1]">
              Sit Back & Relax. <br />
              Let <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">Driver Anna</span> Take The Wheel.
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
              Beat Bangalore's traffic in your own car or rent our clean vehicles. 
              Verified, polite, background-checked Annas at your doorstep in <span className="text-amber-400 font-semibold">15 minutes</span>.
            </p>

            {/* Dual Hero CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <button
                onClick={() => openBookingModal('driver')}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-extrabold text-base shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-105 transition-all flex items-center justify-center gap-3 group"
              >
                <SteeringWheel className="w-5 h-5" />
                <span>Book a Driver (For Your Car)</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => openBookingModal('vehicle')}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-base border border-slate-700 hover:border-slate-600 shadow-xl transition-all flex items-center justify-center gap-3"
              >
                <Car className="w-5 h-5 text-amber-400" />
                <span>Book a Vehicle (Rental Cars)</span>
              </button>
            </div>

            {/* Micro guarantees */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Police Verified Annas</span>
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-400" /> Zero Cancellation Charge</span>
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-red-400" /> All Bangalore Locations Covered</span>
            </div>

          </div>

          {/* INSTANT PRICE ESTIMATOR WIDGET */}
          <div className="mt-14 max-w-5xl mx-auto">
            <PriceEstimator openBookingModal={openBookingModal} />
          </div>

        </div>
      </section>

      {/* STATS BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          {LOCAL_STATS.map((stat, idx) => (
            <div key={idx} className="space-y-1">
              <div className="text-3xl sm:text-4xl font-extrabold text-amber-400 font-['Outfit']">{stat.value}</div>
              <div className="text-xs text-slate-400 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TWO MAIN SERVICES HIGHLIGHT (REQUIREMENT SPECIFIC) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="bg-amber-400/10 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider">
            Our Core Offerings
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-['Outfit']">
            Two Premier Services Built For Bengaluru
          </h2>
          <p className="text-slate-400 text-sm">
            Whether you already own a car or need a rental vehicle, Book Driver Anna has got you covered!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* SERVICE 1: BOOK A DRIVER */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/30 rounded-3xl p-8 relative overflow-hidden group hover:border-amber-400 transition-all shadow-xl">
            <div className="absolute top-0 right-0 bg-amber-400 text-slate-950 font-extrabold text-[11px] uppercase tracking-wider px-4 py-1.5 rounded-bl-2xl">
              Service #1
            </div>

            <div className="w-14 h-14 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold mb-6 shadow-lg shadow-amber-400/20">
              <SteeringWheel className="w-8 h-8 stroke-[2.2]" />
            </div>

            <h3 className="text-2xl font-extrabold text-white font-['Outfit'] mb-2">
              Book a Driver (Acting Driver)
            </h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Have your own car? Hire an experienced, courteous driver Anna to take you through Silk Board traffic, drop you at Bengaluru Airport, or drive you back safely after late-night parties.
            </p>

            <ul className="space-y-3 text-xs text-slate-300 mb-8">
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>Hourly City Driver:</strong> Starts @ ₹199 for 2 hours</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>Night Party Driver:</strong> Available 24/7 till 4 AM in Indiranagar/Kora</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>Outstation Driver:</strong> Trips to Coorg, Chikmagalur, Wayanad & Mysore</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>Manual & Automatic Experts:</strong> Experienced with luxury sedans & SUVs</span>
              </li>
            </ul>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => openBookingModal('driver')}
                className="py-3 px-6 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm shadow-md transition-all flex items-center gap-2"
              >
                <span>Book Driver Anna Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setActivePage('services')}
                className="text-xs font-bold text-slate-400 hover:text-white underline"
              >
                View Driver Rates
              </button>
            </div>
          </div>

          {/* SERVICE 2: BOOK A VEHICLE */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 relative overflow-hidden group hover:border-amber-400 transition-all shadow-xl">
            <div className="absolute top-0 right-0 bg-slate-800 text-slate-300 font-extrabold text-[11px] uppercase tracking-wider px-4 py-1.5 rounded-bl-2xl">
              Service #2
            </div>

            <div className="w-14 h-14 rounded-2xl bg-slate-800 text-amber-400 flex items-center justify-center font-bold mb-6 shadow-lg border border-slate-700">
              <Car className="w-8 h-8 stroke-[2.2]" />
            </div>

            <h3 className="text-2xl font-extrabold text-white font-['Outfit'] mb-2">
              Book a Vehicle (Car Rental)
            </h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Don't own a vehicle? Rent our sanitized, well-maintained fleet of Hatchbacks, Sedans, 7-Seater Innovas, or VIP Luxury cars for city travel, airport drops & outstation holidays.
            </p>

            <ul className="space-y-3 text-xs text-slate-300 mb-8">
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>Hatchback (Swift/i20):</strong> Compact & easy for Blr traffic @ ₹1,499/day</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>Sedan (Dzire/City):</strong> Executive comfort for airport drops @ ₹1,999/day</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>MUV / SUV (Innova Crysta):</strong> 7-Seater family trips @ ₹3,499/day</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>Choice of Options:</strong> Rent with Driver or Self-Drive options</span>
              </li>
            </ul>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => openBookingModal('vehicle')}
                className="py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-sm border border-slate-700 transition-all flex items-center gap-2"
              >
                <span>Explore Vehicles & Rent</span>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </button>

              <button
                onClick={() => setActivePage('services')}
                className="text-xs font-bold text-slate-400 hover:text-white underline"
              >
                View Vehicle Fleet
              </button>
            </div>
          </div>

        </div>

      </section>

      {/* MEET NAMMA ANNAS - DRIVER SPOTLIGHT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="bg-amber-400/10 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider flex items-center gap-1.5 w-fit">
              <Star className="w-3.5 h-3.5 fill-amber-400" /> Top Verified Drivers
            </span>
            <h2 className="text-3xl font-extrabold text-white font-['Outfit'] mt-2">
              Meet Namma Driver Annas
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Polite, police-verified, fluent in Kannada, English & Hindi with 5+ years experience
            </p>
          </div>

          <button
            onClick={() => setActivePage('about')}
            className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1"
          >
            Learn about our driver screening standards <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURED_DRIVERS.map((driver) => (
            <div 
              key={driver.id} 
              className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between hover:border-amber-400/60 transition-all duration-300 group"
            >
              <div className="space-y-4">
                <div className="relative">
                  <img 
                    src={driver.avatar} 
                    alt={driver.name} 
                    className="w-full h-44 rounded-2xl object-cover group-hover:scale-[1.02] transition-transform"
                  />
                  <span className="absolute bottom-2 left-2 bg-slate-950/90 text-amber-400 font-bold text-[10px] px-2.5 py-1 rounded-lg border border-amber-400/30">
                    {driver.badge}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-base text-white">{driver.name}</h3>
                    <div className="flex items-center gap-1 text-xs font-bold text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-amber-400" /> {driver.rating}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 font-medium">{driver.experience}</div>
                  <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                    {driver.trips}+ Successful Trips
                  </div>
                </div>

                <div className="text-xs text-slate-300 italic bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  "{driver.tagline}"
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80 mt-4 flex gap-2">
                <button
                  onClick={() => openDriverSpotlight(driver)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
                >
                  View Profile
                </button>
                <button
                  onClick={() => openBookingModal('driver')}
                  className="py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold shadow transition-colors"
                >
                  Book Anna
                </button>
              </div>
            </div>
          ))}
        </div>

      </section>

      {/* POPULAR OUTSTATION ROAD TRIPS FROM BANGALORE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="bg-amber-400/10 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider">
             Weekend Getaways
          </span>
          <h2 className="text-3xl font-extrabold text-white font-['Outfit']">
            Popular Road Trips From Bengaluru
          </h2>
          <p className="text-slate-400 text-xs">
            Hire an outstation Anna for comfortable long-distance drives across hill stations & highways
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {OUTSTATION_DESTINATIONS.slice(0, 4).map((dest, idx) => (
            <div key={idx} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 hover:border-amber-400 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-lg text-white font-['Outfit']">{dest.name}</span>
                <span className="text-xs bg-amber-400/10 text-amber-400 font-bold px-2 py-0.5 rounded">
                  {dest.distance}
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> Approx Drive: {dest.driveTime}
              </div>
              <div className="text-xs text-slate-300 font-medium flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" /> {dest.popularFor}
              </div>
              <button
                onClick={() => openBookingModal('driver')}
                className="w-full py-2 bg-slate-950 hover:bg-slate-800 text-amber-400 font-bold text-xs rounded-xl border border-amber-500/20 transition-colors mt-2"
              >
                Book Outstation Driver
              </button>
            </div>
          ))}
        </div>

      </section>

      {/* BANGALORE REVIEWS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="bg-amber-400/10 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider inline-flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" /> Loved by Bangalore People
          </span>
          <h2 className="text-3xl font-extrabold text-white font-['Outfit']">
            What Bengalureans Say About Us
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {BANGALORE_TESTIMONIALS.map((t) => (
            <div key={t.id} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed italic">
                  "{t.comment}"
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover border border-amber-400" />
                <div>
                  <div className="text-sm font-bold text-white">{t.name}</div>
                  <div className="text-[11px] text-slate-400">{t.role} • <span className="text-amber-400 font-semibold">{t.area}</span></div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </section>

      {/* BOTTOM CTA BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 rounded-3xl p-8 sm:p-12 text-slate-950 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="space-y-2 text-center md:text-left">
            <span className="bg-slate-950 text-amber-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
              Ready to ride in Bangalore?
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-['Outfit']">
              Need a Driver or Vehicle Right Now?
            </h2>
            <p className="text-slate-900 font-medium text-sm">
              Our driver Annas are waiting near Indiranagar, Koramangala, Whitefield & Electronic City!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <button
              onClick={() => openBookingModal('driver')}
              className="py-4 px-8 bg-slate-950 text-amber-400 hover:bg-slate-900 font-extrabold text-base rounded-2xl shadow-xl transition-transform hover:scale-105 flex items-center gap-2"
            >
              <SteeringWheel className="w-5 h-5 text-amber-400" />
              <span>Book Driver Anna</span>
            </button>
            <a
              href="tel:+919886012345"
              className="py-4 px-6 bg-slate-900/20 text-slate-950 hover:bg-slate-900/30 font-bold text-sm rounded-2xl border border-slate-950/40 flex items-center gap-2"
            >
              <Phone className="w-4 h-4 fill-slate-950 text-slate-950" />
              <span>Call +91 98860 12345</span>
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
