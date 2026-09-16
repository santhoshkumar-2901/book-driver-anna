import React from 'react';
import { 
  Users, UserPlus, UserCheck, Search, Filter, Trash2, Phone, Mail, MapPin, Calendar, ShieldCheck, Car, Award, CheckCircle2 
} from 'lucide-react';
import { SteeringWheel, WhatsAppIcon } from '../../components/Icons';
import { BANGALORE_AREAS } from '../../data/mockData';
import { toDDMMYYYY } from '../../utils/dateUtils';

export default function AdminUsersTab({
  userSubTab,
  setUserSubTab,
  setIsAddUserModalOpen,
  setIsAddDriverModalOpen,
  registeredUsers,
  registeredDrivers,
  userSearchQuery,
  setUserSearchQuery,
  userAreaFilter,
  setUserAreaFilter,
  handleOpenDeleteUserModal
}) {
  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-6 min-w-0">
        <div>
          <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-wider">
            Account Directory & CRM
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-['Outfit'] mt-2 flex items-center gap-3">
            <Users className="w-8 h-8 text-amber-400 shrink-0" />
            <span>Registered Accounts & Fleet</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Comprehensive directory of registered Bengaluru customers and verified Driver Partner Annas.
          </p>
        </div>

        {/* Contextual Action Button */}
        <div className="flex items-center gap-3">
          {userSubTab === 'customers' ? (
            <button
              onClick={() => setIsAddUserModalOpen(true)}
              className="py-3 px-5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-400/20 transition-all flex items-center gap-2 cursor-pointer w-full lg:w-auto justify-center"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add New Client</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAddDriverModalOpen(true)}
              className="py-3 px-5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-400/20 transition-all flex items-center gap-2 cursor-pointer w-full lg:w-auto justify-center"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Driver Anna</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tab Navigation Switcher (Customers vs Driver Annas Separated) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-2 rounded-2xl min-w-0">
        <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800/80 w-full sm:w-auto min-w-0">
          <button
            type="button"
            onClick={() => { setUserSubTab('customers'); setUserSearchQuery(''); setUserAreaFilter('All'); }}
            className={`flex-1 sm:flex-initial py-2.5 px-3 sm:px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer min-w-0 ${
              userSubTab === 'customers'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate min-w-0">Customers</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black shrink-0 ${
              userSubTab === 'customers' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'
            }`}>
              {registeredUsers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setUserSubTab('drivers'); setUserSearchQuery(''); setUserAreaFilter('All'); }}
            className={`flex-1 sm:flex-initial py-2.5 px-3 sm:px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer min-w-0 ${
              userSubTab === 'drivers'
                ? 'bg-emerald-400 text-slate-950 shadow-md shadow-emerald-400/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <SteeringWheel className="w-3.5 h-3.5 stroke-[2.4] shrink-0" />
            <span className="truncate min-w-0">Driver Annas</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black shrink-0 ${
              userSubTab === 'drivers' ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-slate-300'
            }`}>
              {registeredDrivers.length}
            </span>
          </button>
        </div>

        <div className="text-slate-400 text-[11px] font-medium hidden md:block px-2 truncate min-w-0">
          Active Category: <strong className="text-white">{userSubTab === 'customers' ? 'Customer Accounts' : 'Driver Partner Fleet'}</strong>
        </div>
      </div>

      {/* Metrics Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 min-w-0">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 min-w-0 overflow-hidden">
          <div className="text-[11px] sm:text-xs text-slate-400 uppercase font-bold tracking-wider truncate">Registered Clients</div>
          <div className="text-lg sm:text-2xl font-extrabold text-white font-['Outfit'] mt-1 truncate">{registeredUsers.length} Customers</div>
          <div className="text-[11px] text-amber-400 font-semibold mt-0.5 truncate">Verified Accounts</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 min-w-0 overflow-hidden">
          <div className="text-[11px] sm:text-xs text-slate-400 uppercase font-bold tracking-wider truncate">Driver Fleet</div>
          <div className="text-lg sm:text-2xl font-extrabold text-emerald-400 font-['Outfit'] mt-1 truncate">{registeredDrivers.length} Annas</div>
          <div className="text-[11px] text-slate-400 font-semibold mt-0.5 truncate">RTO Verified</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 min-w-0 overflow-hidden">
          <div className="text-[11px] sm:text-xs text-slate-400 uppercase font-bold tracking-wider truncate">BLR Localities</div>
          <div className="text-lg sm:text-2xl font-extrabold text-white font-['Outfit'] mt-1 truncate">
            {new Set([...registeredUsers.map(u => u.area), ...registeredDrivers.map(d => d.area)].filter(Boolean)).size} Hubs
          </div>
          <div className="text-[11px] text-slate-400 font-semibold mt-0.5 truncate">Indiranagar, Koramangala</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 min-w-0 overflow-hidden">
          <div className="text-[11px] sm:text-xs text-slate-400 uppercase font-bold tracking-wider truncate">Direct WhatsApp</div>
          <div className="text-lg sm:text-2xl font-extrabold text-emerald-400 font-['Outfit'] mt-1 truncate">Instant</div>
          <div className="text-[11px] text-slate-400 font-semibold mt-0.5 truncate">1-Click Dispatch</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4 min-w-0">
        {/* Search Bar */}
        <div className="relative w-full lg:w-80 xl:w-96 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder={
              userSubTab === 'customers'
                ? "Search client name, mobile, email, area..."
                : "Search driver name, mobile, DL, car type, area..."
            }
            value={userSearchQuery}
            onChange={(e) => setUserSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
          />
        </div>

        {/* Area Filter */}
        <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto min-w-0">
          <span className="text-xs text-slate-400 font-bold flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Area:
          </span>
          <select
            value={userAreaFilter}
            onChange={(e) => setUserAreaFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400 cursor-pointer w-full sm:w-auto flex-1 lg:flex-initial min-w-0 max-w-full truncate"
          >
            <option value="All">
              All Localities ({userSubTab === 'customers' ? registeredUsers.length : registeredDrivers.length})
            </option>
            {BANGALORE_AREAS.map((area, idx) => {
              const currentPool = userSubTab === 'customers' ? registeredUsers : registeredDrivers;
              const count = currentPool.filter(item => item.area === area).length;
              return (
                <option key={idx} value={area}>
                  {area} {count > 0 ? `(${count})` : ''}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* =============================================================== */}
      {/* SUB-TAB 1: CUSTOMERS (USERS) DIRECTORY                          */}
      {/* =============================================================== */}
      {userSubTab === 'customers' && (
        <div>
          {registeredUsers
            .filter(u => {
              const q = userSearchQuery.toLowerCase();
              const matchesSearch = 
                (u.name && u.name.toLowerCase().includes(q)) ||
                (u.phone && u.phone.includes(q)) ||
                (u.email && u.email.toLowerCase().includes(q)) ||
                (u.area && u.area.toLowerCase().includes(q)) ||
                (u.id && u.id.toLowerCase().includes(q));
              const matchesArea = userAreaFilter === 'All' || u.area === userAreaFilter;
              return matchesSearch && matchesArea;
            }).length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center space-y-3">
              <Users className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-lg font-bold text-white">No Registered Clients Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No registered customers match your search query or area filter. Try changing your filters or add a new client.
              </p>
              <button
                onClick={() => { setUserSearchQuery(''); setUserAreaFilter('All'); }}
                className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 min-w-0">
              {registeredUsers
                .filter(u => {
                  const q = userSearchQuery.toLowerCase();
                  const matchesSearch = 
                    (u.name && u.name.toLowerCase().includes(q)) ||
                    (u.phone && u.phone.includes(q)) ||
                    (u.email && u.email.toLowerCase().includes(q)) ||
                    (u.area && u.area.toLowerCase().includes(q)) ||
                    (u.id && u.id.toLowerCase().includes(q));
                  const matchesArea = userAreaFilter === 'All' || u.area === userAreaFilter;
                  return matchesSearch && matchesArea;
                })
                .map((user) => (
                <div 
                  key={user.id}
                  className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-3xl p-4 sm:p-5 space-y-4 transition-all shadow-md group relative flex flex-col justify-between min-w-0 overflow-hidden"
                >
                  <div>
                    {/* Top Row: Avatar, Name & Status */}
                    <div className="flex items-start justify-between gap-3 min-w-0">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-base flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                          {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-extrabold text-white font-['Outfit'] group-hover:text-amber-400 transition-colors truncate min-w-0">
                            {user.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap min-w-0">
                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 shrink-0">
                              {user.id}
                            </span>
                            <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold shrink-0">
                              {user.status || 'Active'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Delete User Button (Icon Only) */}
                      <button
                        onClick={() => handleOpenDeleteUserModal(user)}
                        title="Remove customer from DB"
                        aria-label="Remove customer from DB"
                        className="p-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/40 transition-all cursor-pointer flex items-center justify-center shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Contact & Location Details */}
                    <div className="mt-4 space-y-2 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 text-xs min-w-0">
                      <div className="flex items-center justify-between text-slate-300 gap-2 min-w-0">
                        <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                          <Phone className="w-3.5 h-3.5 text-emerald-400" /> Phone:
                        </span>
                        <a href={`tel:${user.phone}`} className="font-bold hover:text-amber-400 font-mono truncate min-w-0">
                          {user.phone}
                        </a>
                      </div>

                      <div className="flex items-center justify-between text-slate-300 gap-2 min-w-0">
                        <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                          <Mail className="w-3.5 h-3.5 text-blue-400" /> Email:
                        </span>
                        <span className="font-medium text-slate-200 truncate min-w-0" title={user.email}>
                          {user.email}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300 gap-2 min-w-0">
                        <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-red-400" /> Locality:
                        </span>
                        <span className="font-bold text-amber-400 truncate min-w-0">
                          {user.area || 'Bangalore Central'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800/60 gap-2 min-w-0">
                        <span className="flex items-center gap-1.5 shrink-0">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" /> Joined:
                        </span>
                        <span className="truncate">{toDDMMYYYY(user.createdAt || '2026-09-01')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-4 min-w-0">
                    <a
                      href={`tel:${user.phone}`}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center gap-1.5 border border-slate-700 shrink-0"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Call</span>
                    </a>

                    <button
                      onClick={() => {
                        const cleanPhone = user.phone ? user.phone.replace(/[^0-9]/g, '') : '';
                        const text = encodeURIComponent(
                          `Namaskara ${user.name}! 🙏\n\nThis is Book Driver Anna admin team.\nHow can we assist you with our Driver, Vehicle Rental or Driving Class services today?`
                        );
                        window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-900/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer min-w-0 truncate"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5 fill-current shrink-0" />
                      <span className="truncate">WhatsApp Client</span>
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =============================================================== */}
      {/* SUB-TAB 2: DRIVER PARTNER ANNAS DIRECTORY                       */}
      {/* =============================================================== */}
      {userSubTab === 'drivers' && (
        <div>
          {registeredDrivers
            .filter(d => {
              const q = userSearchQuery.toLowerCase();
              const matchesSearch = 
                (d.name && d.name.toLowerCase().includes(q)) ||
                (d.phone && d.phone.includes(q)) ||
                (d.dlNumber && d.dlNumber.toLowerCase().includes(q)) ||
                (d.vehicleType && d.vehicleType.toLowerCase().includes(q)) ||
                (d.area && d.area.toLowerCase().includes(q)) ||
                (d.id && d.id.toLowerCase().includes(q));
              const matchesArea = userAreaFilter === 'All' || d.area === userAreaFilter;
              return matchesSearch && matchesArea;
            }).length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center space-y-3">
              <SteeringWheel className="w-12 h-12 text-slate-600 mx-auto stroke-[1.8]" />
              <h3 className="text-lg font-bold text-white">No Driver Partners Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No driver partners match your search query or area filter. Try changing your filters or add a new driver.
              </p>
              <button
                onClick={() => { setUserSearchQuery(''); setUserAreaFilter('All'); }}
                className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 min-w-0">
              {registeredDrivers
                .filter(d => {
                  const q = userSearchQuery.toLowerCase();
                  const matchesSearch = 
                    (d.name && d.name.toLowerCase().includes(q)) ||
                    (d.phone && d.phone.includes(q)) ||
                    (d.dlNumber && d.dlNumber.toLowerCase().includes(q)) ||
                    (d.vehicleType && d.vehicleType.toLowerCase().includes(q)) ||
                    (d.area && d.area.toLowerCase().includes(q)) ||
                    (d.id && d.id.toLowerCase().includes(q));
                  const matchesArea = userAreaFilter === 'All' || d.area === userAreaFilter;
                  return matchesSearch && matchesArea;
                })
                .map((driver) => (
                <div 
                  key={driver.id}
                  className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-4 sm:p-5 space-y-4 transition-all shadow-md group relative flex flex-col justify-between min-w-0 overflow-hidden"
                >
                  <div>
                    {/* Top Row: Avatar, Name & Status */}
                    <div className="flex items-start justify-between gap-3 min-w-0">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 font-black text-base flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                          <SteeringWheel className="w-6 h-6 stroke-[2.2]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-extrabold text-white font-['Outfit'] group-hover:text-emerald-400 transition-colors truncate min-w-0">
                            {driver.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap min-w-0">
                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 shrink-0">
                              {driver.id}
                            </span>
                            <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold shrink-0">
                              {driver.status || 'Active'}
                            </span>
                            <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full shrink-0">
                              ★ {driver.rating || 4.95}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Delete Driver Button (Single Icon Only) */}
                      <button
                        onClick={() => handleOpenDeleteUserModal(driver)}
                        title="Remove driver partner from fleet DB"
                        aria-label="Remove driver partner from fleet DB"
                        className="p-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/40 transition-all cursor-pointer flex items-center justify-center shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Driver Details & Credentials */}
                    <div className="mt-4 space-y-2 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 text-xs min-w-0">
                      <div className="flex items-center justify-between text-slate-300 gap-2 min-w-0">
                        <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                          <Phone className="w-3.5 h-3.5 text-emerald-400" /> Mobile:
                        </span>
                        <a href={`tel:${driver.phone}`} className="font-bold hover:text-emerald-400 font-mono truncate min-w-0">
                          {driver.phone}
                        </a>
                      </div>

                      <div className="flex items-center justify-between text-slate-300 gap-2 min-w-0">
                        <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> License:
                        </span>
                        <span className="font-mono font-bold text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px] truncate min-w-0">
                          {driver.dlNumber || 'KA-RTO-VERIFIED'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300 gap-2 min-w-0">
                        <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                          <Car className="w-3.5 h-3.5 text-amber-400" /> Vehicles:
                        </span>
                        <span className="font-medium text-slate-300 truncate min-w-0" title={driver.vehicleType}>
                          {driver.vehicleType || 'Manual & Automatic Cars'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300 gap-2 min-w-0">
                        <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-red-400" /> Hub:
                        </span>
                        <span className="font-bold text-emerald-400 truncate min-w-0">
                          {driver.area || 'Indiranagar'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800/60 gap-2 min-w-0">
                        <span className="flex items-center gap-1.5 shrink-0">
                          <Award className="w-3.5 h-3.5 text-teal-400" /> Experience:
                        </span>
                        <span className="font-bold text-slate-300 truncate">{driver.experienceYears || '5+ Years'}</span>
                      </div>

                      <div className="flex items-center justify-between text-slate-400 text-[11px] gap-2 min-w-0">
                        <span className="flex items-center gap-1.5 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Trips:
                        </span>
                        <span className="font-extrabold text-white font-mono truncate">{driver.trips ? Number(driver.trips).toLocaleString() : '0'} Trips</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-4 min-w-0">
                    <a
                      href={`tel:${driver.phone}`}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center gap-1.5 border border-slate-700 shrink-0"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Call</span>
                    </a>

                    <button
                      onClick={() => {
                        const cleanPhone = driver.phone ? driver.phone.replace(/[^0-9]/g, '') : '';
                        const text = encodeURIComponent(
                          `Namaskara Anna ${driver.name}! 🙏\n\nThis is Book Driver Anna admin team.\nChecking in regarding your fleet status and upcoming ride dispatches.`
                        );
                        window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-900/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer min-w-0 truncate"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5 fill-current shrink-0" />
                      <span className="truncate">WhatsApp Anna</span>
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
