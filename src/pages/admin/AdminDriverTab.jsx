import React from 'react';
import { 
  Search, Phone, Ban, GraduationCap, User, MapPin 
} from 'lucide-react';
import { SteeringWheel, WhatsAppIcon } from '../../components/Icons';
import { toDDMMYYYY } from '../../utils/dateUtils';

export default function AdminDriverTab({
  driverSearchQuery,
  setDriverSearchQuery,
  driverStatusFilter,
  setDriverStatusFilter,
  filteredDriverBookings,
  driverInputState,
  handleDriverInputChange,
  handleUpdateDriverStatus,
  handleAcceptAndAssignDriver,
  sendWhatsAppToClientForDriver
}) {
  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-6 min-w-0">
        <div>
          <span className="bg-amber-400/10 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider">
            Driver Fleet Management
          </span>
          <h1 className="text-3xl font-extrabold text-white font-['Outfit'] mt-2">
            For Driver (Driver Requests & Assignments)
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Type driver details, accept incoming client requests, and send WhatsApp confirmation to Client.
          </p>
        </div>

        {/* Search & Status Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto min-w-0">
          <div className="relative w-full sm:w-64 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search by customer, area, ref..."
              value={driverSearchQuery}
              onChange={(e) => setDriverSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-full sm:w-auto overflow-x-auto no-scrollbar min-w-0">
            {['All', 'Pending', 'Assigned', 'Cancelled'].map((st) => (
              <button
                key={st}
                onClick={() => setDriverStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex-1 sm:flex-initial text-center ${
                  driverStatusFilter === st
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

      {/* Driver Booking Cards */}
      <div className="space-y-4 min-w-0">
        {filteredDriverBookings.map((b) => (
          <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 sm:space-y-5 min-w-0 overflow-hidden">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4 min-w-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold shrink-0">
                  <SteeringWheel className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-extrabold text-base text-white truncate min-w-0">{b.customerName}</span>
                    <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20 font-mono shrink-0">
                      {b.id}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 min-w-0">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" /> <a href={`tel:${b.phone}`} className="hover:text-amber-400 font-mono truncate">{b.phone}</a>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60 shrink-0 w-full sm:w-auto">
                <span className={`text-xs font-black px-3 py-1 rounded-full shrink-0 ${
                  b.status === 'Cancelled'
                    ? 'bg-red-600 text-white border border-red-500 shadow-md shadow-red-600/30'
                    : b.status === 'Pending' 
                    ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' 
                    : b.status === 'Assigned' 
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  ● {b.status}
                </span>
                <div className="text-sm sm:text-base font-extrabold text-white font-['Outfit'] shrink-0">₹{b.fare}</div>
              </div>
            </div>

            {/* Cancelled Alert Banner if booking status is Cancelled */}
            {b.status === 'Cancelled' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-red-300 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Ban className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="truncate">
                    <strong className="text-red-400">Driver Booking Cancelled:</strong> {b.cancelReason ? `"${b.cancelReason}"` : 'Cancelled with zero penalty'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800 shrink-0 self-start sm:self-auto">Zero Charges Billed</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-xs min-w-0">
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1 min-w-0 overflow-hidden">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Trip Type & Package</div>
                <div className="font-extrabold text-white truncate min-w-0">{b.tripTitle}</div>
                <div className="text-slate-400 truncate min-w-0">{toDDMMYYYY(b.date)} • {b.time}</div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1 min-w-0 overflow-hidden">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Pickup & Drop Route</div>
                <div className="font-semibold text-slate-200 flex items-center gap-1 min-w-0">
                  <MapPin className="w-3 h-3 text-amber-400 shrink-0" /> <span className="truncate min-w-0">{b.pickupArea}</span>
                </div>
                <div className="text-slate-400 truncate min-w-0" title={b.dropLocation}>Drop: {b.dropLocation}</div>
              </div>

              {b.tripType === 'class' ? (
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1 min-w-0 overflow-hidden">
                  <div className="text-amber-400 font-bold uppercase text-[10px] flex items-center gap-1">
                    <GraduationCap className="w-3 h-3 shrink-0" /> Training Specs
                  </div>
                  <div className="font-semibold text-slate-200 truncate min-w-0">{b.classTrainingCar || "Dual-Control Car"} ({b.classTransmission || "Manual"})</div>
                  <div className="text-amber-400 font-semibold truncate min-w-0">{b.classTimeSlot || "Morning Slot"}</div>
                </div>
              ) : b.passengers ? (
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1 min-w-0 overflow-hidden">
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Passenger & Luggage</div>
                  <div className="font-semibold text-slate-200 truncate min-w-0">{b.passengers} Passengers • {b.luggage}</div>
                  <div className="text-amber-400 font-semibold truncate min-w-0">{b.acPreference} Vehicle</div>
                </div>
              ) : (
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1 min-w-0 overflow-hidden">
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Service Mode</div>
                  <div className="font-semibold text-slate-200 truncate min-w-0">{b.tripTitle || 'Driver Service'}</div>
                  <div className="text-amber-400 font-semibold truncate min-w-0">Customer's Own Car</div>
                </div>
              )}

              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1 min-w-0 overflow-hidden">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Assigned Driver Details</div>
                <div className="font-bold text-emerald-400 truncate min-w-0">
                  {b.assignedDriver ? b.assignedDriver : '⚠️ No Driver Assigned'}
                </div>
                <div className="text-[10px] text-slate-400 truncate min-w-0">
                  {b.assignedDriverPhone ? `📞 ${b.assignedDriverPhone}` : 'Police Verified Driver'}
                </div>
              </div>
            </div>

            {/* Driver Inputs & Action Controls */}
            <div className="pt-3 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 border-t border-slate-800/80 min-w-0">
              
              {/* 2 Input Boxes Typed by Admin for Driver Name & Driver Phone Number */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:w-auto min-w-0">
                <div className="relative w-full sm:w-44 min-w-0">
                  <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    placeholder="Driver Name"
                    value={driverInputState[b.id]?.name ?? (b.assignedDriver || '')}
                    onChange={(e) => handleDriverInputChange(b.id, 'name', e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-xs font-semibold text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-amber-400 w-full"
                  />
                </div>
                <div className="relative w-full sm:w-36 min-w-0">
                  <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    placeholder="Driver Phone"
                    value={driverInputState[b.id]?.phone ?? (b.assignedDriverPhone || '')}
                    onChange={(e) => handleDriverInputChange(b.id, 'phone', e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-xs font-semibold text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-amber-400 w-full font-mono"
                  />
                </div>
              </div>

              {/* Status Toggles & WhatsApp Action */}
              <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start sm:justify-end min-w-0">
                {b.status === 'Cancelled' ? (
                  <>
                    <span className="px-3.5 py-2 rounded-xl text-xs font-black bg-red-600 text-white border border-red-500 shadow-md shadow-red-600/30 flex items-center gap-1.5 shrink-0">
                      <Ban className="w-3.5 h-3.5" />
                      <span>Cancelled</span>
                    </span>

                    <button
                      onClick={() => sendWhatsAppToClientForDriver(b)}
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
                      onClick={() => handleUpdateDriverStatus(b.id, 'Pending')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex-1 sm:flex-initial text-center ${
                        b.status === 'Pending' ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      Pending
                    </button>
                    <button
                      onClick={() => handleAcceptAndAssignDriver(b.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex-1 sm:flex-initial text-center ${
                        b.status === 'Assigned' ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20' : 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-400 shadow-md shadow-amber-400/20'
                      }`}
                    >
                      Accept & Assign
                    </button>
                    <button
                      onClick={() => handleUpdateDriverStatus(b.id, 'Cancelled')}
                      className="px-3 py-2 rounded-xl text-xs font-bold border transition-colors bg-slate-950 text-slate-400 border-slate-800 hover:text-red-400 hover:border-red-500/40 cursor-pointer flex-1 sm:flex-initial text-center"
                    >
                      Cancel
                    </button>

                    {/* WhatsApp Button to send details ONLY to Client */}
                    <button
                      onClick={() => sendWhatsAppToClientForDriver(b)}
                      title={
                        b.status === 'Pending' 
                          ? "Please Accept & Assign order first to send WhatsApp to client" 
                          : "Send Accepted Order Details via WhatsApp to Client"
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
