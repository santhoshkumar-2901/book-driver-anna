import React, { useState } from 'react';
import { SteeringWheel } from './Icons';
import { Car, Clock, ShieldCheck, MapPin, ArrowRight, CheckCircle2 } from 'lucide-react';
import { BANGALORE_AREAS, VEHICLE_SERVICES } from '../data/mockData';

export default function PriceEstimator({ openBookingModal }) {
  const [bookingType, setBookingType] = useState('driver');
  
  const [pickupArea, setPickupArea] = useState('Indiranagar');
  const [driverDuration, setDriverDuration] = useState('4');
  const [driverTripCategory, setDriverTripCategory] = useState('hourly');

  const [selectedVehicle, setSelectedVehicle] = useState(VEHICLE_SERVICES[0]);
  const [vehicleTripType, setVehicleTripType] = useState('daily');

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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm">
      <div className="space-y-6">
        
        {/* Header and Toggle */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Transparent Bengaluru Fare Calculator</span>
            </div>
            <h3 className="text-xl font-bold text-white font-['Outfit'] mt-1">
              Estimate Trip Fare
            </h3>
          </div>

          <div className="inline-flex p-1 bg-slate-950 rounded-lg border border-slate-800 shrink-0">
            <button
              onClick={() => setBookingType('driver')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                bookingType === 'driver'
                  ? 'bg-amber-400 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SteeringWheel className="w-3.5 h-3.5" />
              <span>Driver for Car</span>
            </button>

            <button
              onClick={() => setBookingType('vehicle')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                bookingType === 'vehicle'
                  ? 'bg-amber-400 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Rental Vehicle</span>
            </button>
          </div>
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          <div className="lg:col-span-7 space-y-4">
            
            <div>
              <label htmlFor="pickup-area-select" className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> Pickup Area in Bengaluru
              </label>
              <select
                id="pickup-area-select"
                value={pickupArea}
                onChange={(e) => setPickupArea(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-white text-xs sm:text-sm font-medium focus:border-amber-400 transition-colors"
              >
                {BANGALORE_AREAS.map((area, idx) => (
                  <option key={idx} value={area}>{area}</option>
                ))}
              </select>
            </div>

            {/* Driver Options */}
            {bookingType === 'driver' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Required Duration
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { hours: '2', label: '2 Hours', badge: 'Short Run' },
                      { hours: '4', label: '4 Hours', badge: 'Half Day' },
                      { hours: '8', label: '8 Hours', badge: 'Full Day' },
                      { hours: '12', label: '12 Hours', badge: 'Extended' }
                    ].map((item) => (
                      <button
                        key={item.hours}
                        type="button"
                        onClick={() => setDriverDuration(item.hours)}
                        className={`p-2.5 rounded-lg border text-center transition-colors cursor-pointer ${
                          driverDuration === item.hours
                            ? 'bg-amber-400/10 border-amber-400 text-amber-400 font-semibold'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold">{item.label}</div>
                        <div className="text-[10px] text-slate-400">{item.badge}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950 rounded-lg p-3.5 border border-slate-800 space-y-2">
                  <div className="text-xs font-medium text-slate-300">Service Standards:</div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Police Background Verified
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Manual & Automatic Experts
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Zero Surge Pricing
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Free Dispatch in Bengaluru
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Vehicle Options */}
            {bookingType === 'vehicle' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Vehicle Model
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {VEHICLE_SERVICES.slice(0, 4).map((veh) => (
                      <button
                        key={veh.id}
                        type="button"
                        onClick={() => setSelectedVehicle(veh)}
                        className={`p-2.5 rounded-lg border text-left transition-colors flex items-center gap-3 cursor-pointer ${
                          selectedVehicle.id === veh.id
                            ? 'bg-amber-400/10 border-amber-400 text-amber-400'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="w-10 h-8 rounded overflow-hidden shrink-0">
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
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Duration Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'hourly', label: 'Half Day (4 hrs)' },
                      { id: 'daily', label: 'Full Day (24 hrs)' },
                      { id: 'outstation', label: 'Outstation' }
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setVehicleTripType(type.id)}
                        className={`py-2 px-2.5 rounded-lg border text-xs text-center font-medium transition-colors cursor-pointer ${
                          vehicleTripType === type.id
                            ? 'bg-amber-400 text-slate-950 border-amber-400 font-semibold'
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

          {/* Right Price Summary Card */}
          <div className="lg:col-span-5 bg-slate-950 rounded-lg p-5 border border-slate-800 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-medium text-slate-400">Fare Breakdown</span>
              <span className="text-[11px] font-medium text-emerald-400">
                Official Tariff
              </span>
            </div>

            <div className="text-center py-1">
              <div className="text-xs text-slate-400">Estimated Total</div>
              <div className="text-3xl font-extrabold text-white font-['Outfit'] mt-1">
                ₹{bookingType === 'driver' ? driverFare.total : vehicleFare.total}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Base Fare + 5% GST • No Peak Surcharges
              </div>
            </div>

            <div className="bg-slate-900 rounded-lg p-3 text-xs space-y-2 border border-slate-800">
              <div className="flex justify-between text-slate-400">
                <span>Base Fare</span>
                <span className="font-medium text-slate-200">
                  ₹{bookingType === 'driver' ? driverFare.base : vehicleFare.base}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Taxes & GST (5%)</span>
                <span className="font-medium text-slate-200">
                  ₹{bookingType === 'driver' ? driverFare.gst : vehicleFare.gst}
                </span>
              </div>
              <div className="flex justify-between text-slate-400 border-t border-slate-800 pt-1.5 text-slate-200">
                <span>Dispatch to {pickupArea}</span>
                <span className="text-emerald-400 font-medium">Included</span>
              </div>
            </div>

            <button
              onClick={handleProceedBooking}
              className="w-full py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue Booking</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center text-[10px] text-slate-500">
              Free cancellation up to 30 minutes before arrival
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
