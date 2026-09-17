import React from 'react';
import { 
  Calendar, DollarSign, TrendingUp, Users, Car, GraduationCap, ChevronRight, MapPin 
} from 'lucide-react';
import { SteeringWheel, WhatsAppIcon } from '../../components/Icons';

export default function AdminDashboardTab({
  navigateToTab,
  driverBookings,
  vehicleBookings,
  classEnrollments,
  registeredUsers,
  registeredDrivers,
  sendWhatsAppToClientForDriver
}) {
  const allBookings = [...(driverBookings || []), ...(vehicleBookings || []), ...(classEnrollments || [])];
  const calculatedRevenue = allBookings.reduce((sum, b) => {
    const rawVal = b.fare ?? b.totalFare ?? b.price ?? b.amount ?? 0;
    const val = typeof rawVal === 'string' ? Number(rawVal.replace(/[^0-9.]/g, '')) : Number(rawVal);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
  const totalDriversCount = registeredDrivers ? registeredDrivers.length : 0;
  const verifiedDriversCount = registeredDrivers ? registeredDrivers.filter(d => d.status === 'Approved' || d.status === 'Active' || d.status === 'Active / Verified').length : 0;

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5 sm:pb-6">
        <div>
          <span className="bg-amber-400/10 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider">
            Operational Dashboard
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-['Outfit'] mt-2">
            Bangalore Admin Dashboard
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Live operational telemetry for Driver Annas, Client Bookings & Vehicle Fleets across Bangalore.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl text-slate-300 font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" /> Today: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* KPI Cards (2-col mobile, 2-col large phone, 3-col tablet/laptop, 6-col large desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-2.5 sm:gap-4 lg:gap-5 min-w-0">
        
        <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 space-y-2 shadow-sm min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 min-w-0">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Total Revenue</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold shrink-0">
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl xl:text-3xl font-extrabold text-white font-['Outfit'] truncate min-w-0">₹{calculatedRevenue.toLocaleString('en-IN')}</div>
          <div className="text-[11px] sm:text-xs text-emerald-400 font-semibold flex items-center gap-1 truncate min-w-0">
            <TrendingUp className="w-3.5 h-3.5 shrink-0" /> Live Revenue
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 space-y-2 shadow-sm min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 min-w-0">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Active Drivers</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <SteeringWheel className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl xl:text-3xl font-extrabold text-white font-['Outfit'] truncate min-w-0">{totalDriversCount} Drivers</div>
          <div className="text-[11px] sm:text-xs text-slate-400 truncate min-w-0">{verifiedDriversCount} Cleared for Duty</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 space-y-2 shadow-sm min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 min-w-0">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Driver Requests</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold shrink-0">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl xl:text-3xl font-extrabold text-amber-400 font-['Outfit'] truncate min-w-0">{driverBookings.length} Active</div>
          <div className="text-[11px] sm:text-xs text-amber-400 font-semibold truncate min-w-0">
            {driverBookings.filter(b => b.status === 'Pending').length} Pending Dispatch
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 space-y-2 shadow-sm min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 min-w-0">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Vehicle Rentals</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold shrink-0">
              <Car className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl xl:text-3xl font-extrabold text-white font-['Outfit'] truncate min-w-0">{vehicleBookings.length} Active</div>
          <div className="text-[11px] sm:text-xs text-slate-400 truncate min-w-0">
            Sedan, SUV & Van
          </div>
        </div>

        {/* KPI 5: Driving Classes */}
        <div 
          onClick={() => navigateToTab('for-class')}
          className="bg-slate-900 border border-slate-800 hover:border-purple-500/50 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 space-y-2 cursor-pointer transition-all group shadow-sm min-w-0 overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-400 min-w-0">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Driving Classes</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-white flex items-center justify-center font-bold transition-colors shrink-0">
              <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl xl:text-3xl font-extrabold text-white font-['Outfit'] truncate min-w-0">{classEnrollments.length} Students</div>
          <div className="text-[11px] sm:text-xs text-purple-400 font-semibold flex items-center justify-between min-w-0">
            <span className="truncate min-w-0">{classEnrollments.filter(e => e.status === 'Pending').length} Pending</span>
            <span className="text-[10px] text-slate-400 group-hover:text-amber-400 font-bold shrink-0 ml-1">Manage →</span>
          </div>
        </div>

        {/* KPI 6: Users & Drivers */}
        <div 
          onClick={() => navigateToTab('users')}
          className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 space-y-2 cursor-pointer transition-all group shadow-sm min-w-0 overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-400 min-w-0">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Users & Drivers</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white flex items-center justify-center font-bold transition-colors shrink-0">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl xl:text-3xl font-extrabold text-white font-['Outfit'] truncate min-w-0">
            {registeredUsers.length + registeredDrivers.length} Accounts
          </div>
          <div className="text-[11px] sm:text-xs text-emerald-400 font-semibold flex items-center justify-between min-w-0">
            <span className="truncate min-w-0">{registeredUsers.length} Clients · {registeredDrivers.length} Drivers</span>
            <span className="text-[10px] text-slate-400 group-hover:text-amber-400 font-bold shrink-0 ml-1">→</span>
          </div>
        </div>

      </div>

      {/* Recent Driver Bookings with Single Combined WhatsApp Action */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 sm:space-y-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-base sm:text-lg font-extrabold text-white font-['Outfit'] flex items-center gap-2">
            <SteeringWheel className="w-5 h-5 text-amber-400 shrink-0" /> Recent Driver Booking Dispatches
          </h3>
          <button 
            onClick={() => navigateToTab('for-driver')}
            className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            Manage All Drivers <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 min-w-0">
          {driverBookings.map((b) => (
            <div key={b.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 overflow-hidden">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="font-extrabold text-sm text-white truncate min-w-0">{b.customerName}</span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded font-mono shrink-0">
                    {b.id}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5 min-w-0">
                  <MapPin className="w-3 h-3 text-amber-400 shrink-0" /> <span className="truncate min-w-0">{b.pickupArea} to {b.dropLocation}</span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium truncate min-w-0">
                  {b.tripTitle} • <strong className="text-white">₹{b.fare}</strong>
                </div>
              </div>

              <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-900 w-full sm:w-auto">
                <span className={`inline-block text-[11px] font-black px-3 py-1 rounded-full shrink-0 ${
                  b.status === 'Cancelled'
                    ? 'bg-red-600 text-white border border-red-500 shadow-md shadow-red-600/30'
                    : b.status === 'Pending' 
                    ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' 
                    : b.status === 'Assigned' 
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {b.status}
                </span>

                {/* WhatsApp Trigger Button to Client */}
                <button
                  onClick={() => sendWhatsAppToClientForDriver(b)}
                  title={
                    b.status === 'Pending' 
                      ? "Please Accept & Assign order first to send WhatsApp to client" 
                      : b.status === 'Cancelled'
                      ? "Send Cancellation Notice via WhatsApp to Client"
                      : "Send trip confirmation WhatsApp to Client"
                  }
                  className={`text-[11px] font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all border shrink-0 ${
                    b.status === 'Pending'
                      ? 'bg-slate-950 text-slate-500 border-slate-800 opacity-60 cursor-not-allowed'
                      : b.status === 'Cancelled'
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-900/40 border-red-400/40 cursor-pointer'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30 border-emerald-400/30 cursor-pointer'
                  }`}
                >
                  <WhatsAppIcon className="w-3.5 h-3.5 fill-current" />
                  <span>{b.status === 'Cancelled' ? 'WhatsApp to Client' : 'WhatsApp'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
