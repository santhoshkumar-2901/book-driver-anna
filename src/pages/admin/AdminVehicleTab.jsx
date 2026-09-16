import React from 'react';
import { 
  Search, Car, Phone, Ban, MapPin 
} from 'lucide-react';
import { WhatsAppIcon } from '../../components/Icons';
import { toDDMMYYYY } from '../../utils/dateUtils';

export default function AdminVehicleTab({
  vehicleSearchQuery,
  setVehicleSearchQuery,
  vehicleStatusFilter,
  setVehicleStatusFilter,
  filteredVehicleBookings,
  handleUpdateVehicleStatus,
  sendWhatsAppToClientForVehicle
}) {
  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-6 min-w-0">
        <div>
          <span className="bg-amber-400/10 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider">
            Vehicle Rental Management
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-['Outfit'] mt-2">
            For Vehicle (Fleet Bookings & Dispatch)
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Track Sedan, SUV, and Tempo Traveller rental requests, assign vehicle registration numbers, and send WhatsApp notifications to Client.
          </p>
        </div>

        {/* Search & Status Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto min-w-0">
          <div className="relative w-full sm:w-64 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search vehicle, customer..."
              value={vehicleSearchQuery}
              onChange={(e) => setVehicleSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-full sm:w-auto overflow-x-auto no-scrollbar min-w-0">
            {['All', 'Pending', 'Confirmed', 'Dispatched', 'Cancelled'].map((st) => (
              <button
                key={st}
                onClick={() => setVehicleStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex-1 sm:flex-initial text-center ${
                  vehicleStatusFilter === st
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Vehicle Cards */}
      <div className="space-y-4 min-w-0">
        {filteredVehicleBookings.map((b) => (
          <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 sm:space-y-5 min-w-0 overflow-hidden">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4 min-w-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold shrink-0">
                  <Car className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-extrabold text-base text-white truncate min-w-0">{b.customerName}</span>
                    <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20 shrink-0">
                      {b.id}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 min-w-0">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" /> <span className="truncate min-w-0">{b.phone}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60 shrink-0 w-full sm:w-auto">
                <span className={`text-xs font-black px-3 py-1 rounded-full shrink-0 ${
                  b.status === 'Cancelled'
                    ? 'bg-red-600 text-white border border-red-500 shadow-md shadow-red-600/30'
                    : b.status === 'Pending' 
                    ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' 
                    : b.status === 'Confirmed' 
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  ● {b.status}
                </span>
                <div className="text-sm font-extrabold text-amber-400 font-['Outfit'] shrink-0">₹{b.fare}</div>
              </div>
            </div>

            {/* Cancelled Alert Banner if vehicle rental status is Cancelled */}
            {b.status === 'Cancelled' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-red-300 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Ban className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="min-w-0">
                    <strong className="text-red-400">Vehicle Rental Cancelled:</strong> {b.cancelReason ? `"${b.cancelReason}"` : 'Cancelled with zero penalty'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800 shrink-0 self-start sm:self-auto">Fleet Released</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-xs min-w-0">
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1 min-w-0 overflow-hidden">
                <div className="text-slate-400 font-bold uppercase text-[10px] truncate">Vehicle Reserved</div>
                <div className="font-extrabold text-white truncate">{b.vehicleName}</div>
                <div className="text-amber-400 font-semibold truncate">{b.rentalType}</div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1 min-w-0 overflow-hidden">
                <div className="text-slate-400 font-bold uppercase text-[10px] truncate">Pickup Location & Time</div>
                <div className="font-semibold text-slate-200 flex items-center gap-1 truncate min-w-0">
                  <MapPin className="w-3 h-3 text-amber-400 shrink-0" /> <span className="truncate min-w-0">{b.pickupArea}</span>
                </div>
                <div className="text-slate-400 truncate">{toDDMMYYYY(b.date)} • {b.time}</div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1 min-w-0 overflow-hidden">
                <div className="text-slate-400 font-bold uppercase text-[10px] truncate">Passenger & Luggage</div>
                <div className="font-semibold text-slate-200 truncate">{b.passengers} Passengers • {b.luggage}</div>
                <div className="text-emerald-400 font-semibold truncate">{b.acPreference} Vehicle</div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1 min-w-0 overflow-hidden">
                <div className="text-slate-400 font-bold uppercase text-[10px] truncate">Assigned Reg Number</div>
                <div className="font-mono font-bold text-amber-400 truncate">{b.vehicleRegNumber}</div>
                <div className="text-[10px] text-slate-500 truncate">Sanitized Fleet Vehicle</div>
              </div>
            </div>

            {/* Controls & Single Combined WhatsApp Dispatch Action */}
            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-slate-800/80 min-w-0">
              <div className="text-xs text-slate-400 shrink-0">
                Booked: <span className="text-slate-300 font-semibold">{b.bookedAt}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                {b.status === 'Cancelled' ? (
                  <>
                    <span className="px-3.5 py-2 rounded-xl text-xs font-black bg-red-600 text-white border border-red-500 shadow-md shadow-red-600/30 flex items-center gap-1.5 shrink-0">
                      <Ban className="w-3.5 h-3.5" />
                      <span>Cancelled</span>
                    </span>

                    <button
                      onClick={() => sendWhatsAppToClientForVehicle(b)}
                      title="Send Cancellation Notice via WhatsApp to Client"
                      className="text-xs font-extrabold px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all border bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40 border-red-400/40 cursor-pointer w-full sm:w-auto justify-center shrink-0"
                    >
                      <WhatsAppIcon className="w-4 h-4 fill-current" />
                      <span>WhatsApp to Client</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleUpdateVehicleStatus(b.id, 'Pending')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex-1 sm:flex-initial text-center ${
                        b.status === 'Pending' ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      Set Pending
                    </button>
                    <button
                      onClick={() => handleUpdateVehicleStatus(b.id, 'Confirmed')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex-1 sm:flex-initial text-center ${
                        b.status === 'Confirmed' ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      Accept & Confirm
                    </button>
                    <button
                      onClick={() => handleUpdateVehicleStatus(b.id, 'Cancelled')}
                      className="px-3 py-2 rounded-xl text-xs font-bold border transition-colors bg-slate-950 text-slate-400 border-slate-800 hover:text-red-400 hover:border-red-500/40 cursor-pointer flex-1 sm:flex-initial text-center"
                    >
                      Cancel
                    </button>

                    {/* WhatsApp Button to send details ONLY to Client */}
                    <button
                      onClick={() => sendWhatsAppToClientForVehicle(b)}
                      title={
                        b.status === 'Pending' 
                          ? "Please Accept & Confirm order first to send WhatsApp to client" 
                          : "Send Confirmed Vehicle Details via WhatsApp to Client"
                      }
                      className={`text-xs font-extrabold px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all border w-full sm:w-auto justify-center shrink-0 ${
                        b.status === 'Pending'
                          ? 'bg-slate-950 text-slate-500 border-slate-800 opacity-60 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 border-emerald-400/40 cursor-pointer'
                      }`}
                    >
                      <WhatsAppIcon className="w-4 h-4 fill-current" />
                      <span>WhatsApp to Client</span>
                    </button>
                  </>
                )}
              </div>

            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
