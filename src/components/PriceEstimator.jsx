import React, { useState } from 'react';
import { SteeringWheel } from './Icons';
import { Car, Clock, ShieldCheck, MapPin, ArrowRight, CheckCircle2 } from 'lucide-react';
import { BANGALORE_AREAS, DRIVER_SERVICES, VEHICLE_SERVICES } from '../data/mockData';

export default function PriceEstimator({ openBookingModal }) {
  const [bookingType, setBookingType] = useState('driver'); // 'driver' or 'vehicle'
  
  // Driver estimator state
  const [pickupArea, setPickupArea] = useState('Indiranagar');
  const [driverDuration, setDriverDuration] = useState('4'); // hours
  const [driverTripCategory, setDriverTripCategory] = useState('hourly'); // 'hourly', 'night', 'outstation'

  // Vehicle estimator state
  const [selectedVehicle, setSelectedVehicle] = useState(VEHICLE_SERVICES[0]);
  const [vehicleTripType, setVehicleTripType] = useState('daily'); // 'hourly', 'daily', 'outstation'

  // Driver price calc
  const calculateDriverFare = () => {
    let base = 199;
    if (driverDuration === '2') base = 199;
    else if (driverDuration === '4') base = 349;
    else if (driverDuration === '8') base = 699;
    else if (driverDuration === '12') base = 899;

    if (driverTripCategory === 'night') base += 150;
    if (driverTripCategory === 'outstation') base = 1199;

    const gst = Math.round(base * 0.05);
    return { base, gst, total: base + gst };
  };

  // Vehicle price calc
  const calculateVehicleFare = () => {
    let base = selectedVehicle.dailyRate || 1999;
    if (vehicleTripType === 'hourly') base = Math.round(selectedVehicle.dailyRate * 0.6);
    else if (vehicleTripType === 'outstation') base = Math.round(selectedVehicle.dailyRate * 1.3);

    const gst = Math.round(base * 0.05);
    return { base, gst, total: base + gst };
  };

  const driverFare = calculateDriverFare();
  const vehicleFare = calculateVehicleFare();

  const handleProceedBooking = () => {
    if (bookingType === 'driver') {
      openBookingModal('driver', {
        pickupArea,
        driverDuration,
        estimatedFare: driverFare.total
      });
    } else {
      openBookingModal('vehicle', {
        pickupArea,
        vehicleCategory: selectedVehicle.category,
        vehicleName: selectedVehicle.name,
        estimatedFare: vehicleFare.total
      });
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
      
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-6">
        
        {/* Header bar with Service Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" /> Instant Fare Calculator
            </div>
            <h3 className="text-2xl font-extrabold text-white font-['Outfit'] mt-1">
              Estimate Your Bangalore Ride Fare
            </h3>
          </div>

          {/* Toggle Switch */}
          <div className="inline-flex p-1 bg-slate-950 rounded-2xl border border-slate-800 shrink-0">
            <button
              onClick={() => setBookingType('driver')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                bookingType === 'driver'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SteeringWheel className="w-4 h-4" />
              <span>Book Driver</span>
            </button>

            <button
              onClick={() => setBookingType('vehicle')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                bookingType === 'vehicle'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>Book Vehicle</span>
            </button>
          </div>
        </div>

        {/* Dynamic Form Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Inputs (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Pickup Location in Bangalore */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" /> Select Bangalore Pickup Location
              </label>
              <select
                value={pickupArea}
                onChange={(e) => setPickupArea(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3 text-white text-sm font-semibold focus:outline-none focus:border-amber-400 transition-colors"
              >
                {BANGALORE_AREAS.map((area, idx) => (
                  <option key={idx} value={area}>{area}</option>
                ))}
              </select>
            </div>

            {/* DRIVER FLOW INPUTS */}
            {bookingType === 'driver' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" /> Driver Needed For (Hours)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { hours: '2', label: '2 Hours', badge: 'Short Trip' },
                      { hours: '4', label: '4 Hours', badge: 'Office Run' },
                      { hours: '8', label: '8 Hours', badge: 'Full Day' },
                      { hours: '12', label: '12 Hours', badge: 'Extended' }
                    ].map((item) => (
                      <button
                        key={item.hours}
                        type="button"
                        onClick={() => setDriverDuration(item.hours)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          driverDuration === item.hours
                            ? 'bg-amber-400/10 border-amber-400 text-amber-400 font-bold shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-sm font-bold">{item.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{item.badge}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 space-y-2">
                  <div className="text-xs font-bold text-slate-300">Included with every Driver Anna:</div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Verified Background
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Auto/Manual Specialist
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Live GPS Tracking
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Silk Board Route Master
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* VEHICLE FLOW INPUTS */}
            {bookingType === 'vehicle' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Choose Vehicle Model
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {VEHICLE_SERVICES.slice(0, 4).map((veh) => (
                      <button
                        key={veh.id}
                        type="button"
                        onClick={() => setSelectedVehicle(veh)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                          selectedVehicle.id === veh.id
                            ? 'bg-amber-400/10 border-amber-400 text-amber-400 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="w-12 h-10 rounded-lg overflow-hidden shrink-0">
                          <img src={veh.image} alt={veh.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="overflow-hidden">
                          <div className="text-xs font-bold truncate text-white">{veh.name}</div>
                          <div className="text-[10px] text-slate-400">{veh.category} • {veh.seats} Seats</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Rental Duration Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'hourly', label: 'Half Day (4 hrs)' },
                      { id: 'daily', label: 'Full Day (24 hrs)' },
                      { id: 'outstation', label: 'Outstation Trip' }
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setVehicleTripType(type.id)}
                        className={`py-2 px-3 rounded-xl border text-xs text-center font-semibold transition-all ${
                          vehicleTripType === type.id
                            ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Right Price Output Card (5 cols) */}
          <div className="lg:col-span-5 bg-slate-950 rounded-2xl p-6 border border-slate-800 space-y-5 relative">
            
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estimated Fare</span>
              <span className="bg-emerald-500/10 text-emerald-400 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Guaranteed Fare
              </span>
            </div>

            {/* Price display */}
            <div className="text-center py-2">
              <div className="text-xs text-slate-400">Total All-Inclusive Estimate</div>
              <div className="text-4xl font-extrabold text-amber-400 font-['Outfit'] mt-1">
                ₹{bookingType === 'driver' ? driverFare.total : vehicleFare.total}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Includes Base Rate + 5% GST • No Toll/Fuel Surprise
              </div>
            </div>

            {/* Breakdown */}
            <div className="bg-slate-900/80 rounded-xl p-3.5 text-xs space-y-2 border border-slate-800">
              <div className="flex justify-between text-slate-400">
                <span>Base Service Fare</span>
                <span className="font-semibold text-slate-200">
                  ₹{bookingType === 'driver' ? driverFare.base : vehicleFare.base}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Taxes & GST (5%)</span>
                <span className="font-semibold text-slate-200">
                  ₹{bookingType === 'driver' ? driverFare.gst : vehicleFare.gst}
                </span>
              </div>
              <div className="flex justify-between text-slate-400 border-t border-slate-800 pt-2 font-bold text-slate-200">
                <span>Pickup in {pickupArea}</span>
                <span className="text-emerald-400">FREE Dispatch</span>
              </div>
            </div>

            {/* Book Now trigger */}
            <button
              onClick={handleProceedBooking}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-bold text-base shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
            >
              <span>Confirm & Book {bookingType === 'driver' ? 'Driver Anna' : selectedVehicle.name}</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="text-center text-[10px] text-slate-500">
              Instant SMS & WhatsApp confirmation sent immediately
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
