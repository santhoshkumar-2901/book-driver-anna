import React, { useState } from 'react';
import { SteeringWheel } from './Icons';
import { Car, Clock, ShieldCheck, MapPin, ArrowRight, CheckCircle2 } from 'lucide-react';
import { BANGALORE_AREAS, VEHICLE_SERVICES } from '../data/mockData';

export default function PriceEstimator({ openBookingModal }) {
  const [bookingType, setBookingType] = useState('driver'); // 'driver' or 'vehicle'
  
  // Driver estimator state
  const [pickupArea, setPickupArea] = useState('Indiranagar');
  const [driverDuration, setDriverDuration] = useState('4'); // hours
  const [driverTripCategory, setDriverTripCategory] = useState('hourly'); // 'hourly', 'night', 'outstation'

  // Vehicle estimator state
  const [selectedVehicle, setSelectedVehicle] = useState(VEHICLE_SERVICES[0]);
  const [vehicleTripType, setVehicleTripType] = useState('daily'); // 'hourly', 'daily', 'outstation'

  // Driver price calculation
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

  // Vehicle price calculation
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
    <div className="card-surface p-4 sm:p-6 shadow-sm">
      <div className="space-y-5 sm:space-y-6">
        
        {/* Header bar with Service Segment Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-800 pb-4 sm:pb-5">
          <div>
            <span className="text-slate-400 text-[11px] sm:text-xs font-semibold uppercase tracking-wider">
              Transparent Pricing Engine
            </span>
            <h3 className="text-lg sm:text-2xl font-bold text-white font-['Outfit'] mt-0.5">
              Estimate Ride Fare in Bengaluru
            </h3>
          </div>

          {/* Segmented Control */}
          <div className="inline-flex w-full sm:w-auto p-1 bg-slate-950 rounded-lg border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setBookingType('driver')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
                bookingType === 'driver'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SteeringWheel className="w-3.5 h-3.5" />
              <span>Personal Driver</span>
            </button>

            <button
              type="button"
              onClick={() => setBookingType('vehicle')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
                bookingType === 'vehicle'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Rental Vehicle</span>
            </button>
          </div>
        </div>

        {/* Dynamic Form Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Inputs (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Pickup Location */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                <span>Pickup Locality (Bengaluru)</span>
              </label>
              <select
                value={pickupArea}
                onChange={(e) => setPickupArea(e.target.value)}
                className="input-base cursor-pointer"
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Booking Duration</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { hours: '2', label: '2 Hours', badge: 'City Commute' },
                      { hours: '4', label: '4 Hours', badge: 'Shopping / Errands' },
                      { hours: '8', label: '8 Hours', badge: 'Full Day Duty' },
                      { hours: '12', label: '12 Hours', badge: 'Extended' }
                    ].map((item) => (
                      <button
                        key={item.hours}
                        type="button"
                        onClick={() => setDriverDuration(item.hours)}
                        className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          driverDuration === item.hours
                            ? 'bg-amber-500/10 border-amber-500 text-white font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-sm font-semibold">{item.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{item.badge}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2 text-xs">
                  <div className="font-semibold text-slate-300">Standard Driver Inclusions:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400 text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Police Verified Driver
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Manual & Automatic Experts
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Doorstep Hand-off
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Zero Advance Cancellation Fee
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* VEHICLE FLOW INPUTS */}
            {bookingType === 'vehicle' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Select Vehicle Class
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {VEHICLE_SERVICES.slice(0, 4).map((veh) => (
                      <button
                        key={veh.id}
                        type="button"
                        onClick={() => setSelectedVehicle(veh)}
                        className={`p-2.5 rounded-lg border text-left transition-colors flex items-center gap-3 cursor-pointer ${
                          selectedVehicle.id === veh.id
                            ? 'bg-amber-500/10 border-amber-500 text-white font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="w-12 h-10 rounded-md overflow-hidden bg-slate-900 shrink-0">
                          <img src={veh.image} alt={veh.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="overflow-hidden">
                          <div className="text-xs font-semibold truncate text-white">{veh.name}</div>
                          <div className="text-[10px] text-slate-400">{veh.category} • {veh.seats} Seats</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Rental Duration
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'hourly', label: 'Half Day (4 hrs)' },
                      { id: 'daily', label: 'Full Day (24 hrs)' },
                      { id: 'outstation', label: 'Outstation Trip' }
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setVehicleTripType(type.id)}
                        className={`py-2 px-3 rounded-lg border text-xs text-center font-medium transition-colors cursor-pointer ${
                          vehicleTripType === type.id
                            ? 'bg-amber-500 text-slate-950 font-bold border-amber-500'
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
          <div className="lg:col-span-5 bg-slate-950 rounded-xl p-5 border border-slate-800 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estimated Fare</span>
              <span className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Direct Billing
              </span>
            </div>

            {/* Price display */}
            <div className="py-1">
              <div className="text-xs text-slate-400">Total Calculated Fare</div>
              <div className="text-3xl sm:text-4xl font-extrabold text-white font-['Outfit'] mt-1">
                ₹{bookingType === 'driver' ? driverFare.total : vehicleFare.total}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Inclusive of standard service charges and 5% GST
              </div>
            </div>

            {/* Breakdown table */}
            <div className="bg-slate-900 rounded-lg p-3 text-xs space-y-2 border border-slate-800/80">
              <div className="flex justify-between text-slate-400">
                <span>Base Rate</span>
                <span className="font-semibold text-slate-200">
                  ₹{bookingType === 'driver' ? driverFare.base : vehicleFare.base}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>GST (5%)</span>
                <span className="font-semibold text-slate-200">
                  ₹{bookingType === 'driver' ? driverFare.gst : vehicleFare.gst}
                </span>
              </div>
              <div className="flex justify-between text-slate-300 border-t border-slate-800 pt-2 font-medium">
                <span>Pickup in {pickupArea}</span>
                <span className="text-emerald-400 font-semibold">Included</span>
              </div>
            </div>

            {/* Action CTA */}
            <button
              onClick={handleProceedBooking}
              className="btn-primary w-full py-3 text-sm justify-between"
            >
              <span>Book {bookingType === 'driver' ? 'Driver Anna' : selectedVehicle.name}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center text-[11px] text-slate-400">
              Instant confirmation SMS sent upon booking
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
