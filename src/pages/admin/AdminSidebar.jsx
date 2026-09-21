import React from 'react';
import { 
  Car, ShieldCheck, Phone, LayoutDashboard, ChevronRight, GraduationCap, Users, LogOut, ArrowUpRight, Menu, X, Trash2 
} from 'lucide-react';
import { SteeringWheel } from '../../components/Icons';

export default function AdminSidebar({
  activeTab,
  navigateToTab,
  loggedInAdminName,
  loggedInAdminPhone,
  driverBookingsCount,
  vehicleBookingsCount,
  classEnrollmentsCount,
  usersCount,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  handleLogout,
  onReturnToClient,
  onOpenPurgeModal
}) {
  return (
    <>
      {/* --------------------------------------------------------------------- */}
      {/* DESKTOP SIDEBAR NAVIGATION (PINNED ON SCREENS >= lg) */}
      {/* --------------------------------------------------------------------- */}
      <aside className="hidden lg:flex lg:w-64 bg-slate-900 border-r border-slate-800 flex-col shrink-0 h-full select-none z-20">
        
        {/* Sidebar Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-400/20">
              <Car className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="font-extrabold text-lg text-white font-['Outfit'] leading-none">
                Book Driver <span className="text-amber-400">Anna</span>
              </div>
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mt-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Admin Portal
              </div>
            </div>
          </div>
        </div>

        {/* Logged in Admin Profile Badge */}
        <div className="p-3.5 mx-3 my-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-400 font-extrabold text-xs flex items-center justify-center shrink-0">
            {loggedInAdminName ? loggedInAdminName.charAt(0) : 'A'}
          </div>
          <div className="overflow-hidden min-w-0">
            <div className="text-xs font-bold text-white truncate">{loggedInAdminName}</div>
            <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1 truncate">
              <Phone className="w-2.5 h-2.5 text-emerald-400 shrink-0" /> {loggedInAdminPhone}
            </div>
          </div>
        </div>

        {/* Sidebar Navigation Items (Dashboard, For Driver, For Vehicle, For Class, Users) */}
        <nav className="p-3 space-y-1.5 flex-1 min-h-0 overflow-y-auto no-scrollbar">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-1">
            Admin Management
          </div>

          {/* Sidebar Item 1: Dashboard */}
          <button
            onClick={() => navigateToTab('dashboard')}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Dashboard</span>
            </div>
            {activeTab === 'dashboard' && <ChevronRight className="w-4 h-4 shrink-0" />}
          </button>

          {/* Sidebar Item 2: For Driver */}
          <button
            onClick={() => navigateToTab('for-driver')}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'for-driver'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <SteeringWheel className="w-4 h-4 shrink-0" />
              <span>For Driver</span>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold ${
              activeTab === 'for-driver' 
                ? 'bg-slate-950 text-amber-400' 
                : 'bg-slate-800 text-amber-400 border border-slate-700'
            }`}>
              {driverBookingsCount}
            </span>
          </button>

          {/* Sidebar Item 3: For Vehicle */}
          <button
            onClick={() => navigateToTab('for-vehicle')}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'for-vehicle'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Car className="w-4 h-4 shrink-0" />
              <span>For Vehicle</span>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold ${
              activeTab === 'for-vehicle' 
                ? 'bg-slate-950 text-amber-400' 
                : 'bg-slate-800 text-amber-400 border border-slate-700'
            }`}>
              {vehicleBookingsCount}
            </span>
          </button>

          {/* Sidebar Item 4: For Driving Class */}
          <button
            onClick={() => navigateToTab('for-class')}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'for-class'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <GraduationCap className="w-4 h-4 shrink-0" />
              <span>For Driving Class</span>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold ${
              activeTab === 'for-class' 
                ? 'bg-slate-950 text-amber-400' 
                : 'bg-slate-800 text-amber-400 border border-slate-700'
            }`}>
              {classEnrollmentsCount}
            </span>
          </button>

          {/* Sidebar Item 5: Users */}
          <button
            onClick={() => navigateToTab('users')}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 shrink-0" />
              <span>Users</span>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold ${
              activeTab === 'users' 
                ? 'bg-slate-950 text-amber-400' 
                : 'bg-slate-800 text-amber-400 border border-slate-700'
            }`}>
              {usersCount}
            </span>
          </button>
        </nav>

        {/* Sidebar Footer Controls - Always Visible at bottom */}
        <div className="p-4 border-t border-slate-800 space-y-2 shrink-0 bg-slate-900/95">
          <button
            onClick={onOpenPurgeModal}
            className="w-full py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-red-500/30 cursor-pointer"
            title="Wipe all test bookings and demo data for production launch"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Data for Production</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-red-400 text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-slate-800 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Admin Logout</span>
          </button>

          <button
            onClick={onReturnToClient}
            className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 text-amber-400" />
            <span>Return to Client Site</span>
          </button>
        </div>

      </aside>

      {/* --------------------------------------------------------------------- */}
      {/* MOBILE & TABLET ADMIN TOP HEADER BAR (< lg) */}
      {/* --------------------------------------------------------------------- */}
      <div className="lg:hidden sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shrink-0">
        
        {/* Top Header Bar */}
        <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            {/* Mobile Hamburger Drawer Toggle Button */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-colors cursor-pointer"
              title="Open Admin Sidebar"
              aria-label="Open Admin Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-400/20 shrink-0">
              <Car className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="font-extrabold text-xs text-white font-['Outfit'] leading-tight">
                Driver <span className="text-amber-400">Anna</span>
              </div>
              <div className="text-[8px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-0.5">
                <ShieldCheck className="w-2.5 h-2.5" /> Admin
              </div>
            </div>
          </div>

          {/* Quick Actions (Admin Initials, Return to Site, Logout) */}
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-400 font-extrabold text-[10px] flex items-center justify-center shrink-0" title={loggedInAdminName}>
              {loggedInAdminName ? loggedInAdminName.charAt(0) : 'A'}
            </div>
            <button
              onClick={onReturnToClient}
              title="Return to Client Site"
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
            </button>
            <button
              onClick={handleLogout}
              title="Admin Logout"
              className="p-1.5 rounded-lg bg-slate-950 text-red-400 hover:text-red-300 border border-slate-800 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mobile Horizontal Quick-Tab Strip */}
        <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => navigateToTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => navigateToTab('for-driver')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'for-driver'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <SteeringWheel className="w-3.5 h-3.5" />
            <span>For Driver</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeTab === 'for-driver' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-amber-400'
            }`}>
              {driverBookingsCount}
            </span>
          </button>

          <button
            onClick={() => navigateToTab('for-vehicle')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'for-vehicle'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>For Vehicle</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeTab === 'for-vehicle' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-amber-400'
            }`}>
              {vehicleBookingsCount}
            </span>
          </button>

          <button
            onClick={() => navigateToTab('for-class')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'for-class'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Classes</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeTab === 'for-class' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-amber-400'
            }`}>
              {classEnrollmentsCount}
            </span>
          </button>

          <button
            onClick={() => navigateToTab('users')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'users'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeTab === 'users' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-amber-400'
            }`}>
              {usersCount}
            </span>
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* MOBILE & TABLET SIDEBAR SLIDE-OUT DRAWER (< lg) */}
      {/* --------------------------------------------------------------------- */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm animate-fade-in transition-opacity"
            onClick={() => setIsMobileSidebarOpen(false)}
          />

          {/* Drawer Sidebar Panel */}
          <aside className="relative z-50 w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 flex flex-col h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-400/20 shrink-0">
                  <Car className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <div className="font-extrabold text-sm text-white font-['Outfit'] leading-tight">
                    Book Driver <span className="text-amber-400">Anna</span>
                  </div>
                  <div className="text-[9px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Admin Portal
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close Admin Sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Admin Profile Card */}
            <div className="p-3 mx-3 my-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-400 font-extrabold text-xs flex items-center justify-center shrink-0">
                {loggedInAdminName ? loggedInAdminName.charAt(0) : 'A'}
              </div>
              <div className="overflow-hidden min-w-0">
                <div className="text-xs font-bold text-white truncate">{loggedInAdminName}</div>
                <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1 truncate">
                  <Phone className="w-2.5 h-2.5 text-emerald-400 shrink-0" /> {loggedInAdminPhone}
                </div>
              </div>
            </div>

            {/* Navigation List in Mobile Drawer */}
            <nav className="p-3 space-y-1.5 flex-1 min-h-0 overflow-y-auto no-scrollbar">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-1">
                Admin Management
              </div>

              <button
                onClick={() => navigateToTab('dashboard')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span>Dashboard</span>
                </div>
                {activeTab === 'dashboard' && <ChevronRight className="w-4 h-4 shrink-0" />}
              </button>

              <button
                onClick={() => navigateToTab('for-driver')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'for-driver'
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <SteeringWheel className="w-4 h-4 shrink-0" />
                  <span>For Driver</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                  activeTab === 'for-driver' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-amber-400'
                }`}>
                  {driverBookingsCount}
                </span>
              </button>

              <button
                onClick={() => navigateToTab('for-vehicle')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'for-vehicle'
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Car className="w-4 h-4 shrink-0" />
                  <span>For Vehicle</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                  activeTab === 'for-vehicle' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-amber-400'
                }`}>
                  {vehicleBookingsCount}
                </span>
              </button>

              <button
                onClick={() => navigateToTab('for-class')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'for-class'
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <GraduationCap className="w-4 h-4 shrink-0" />
                  <span>For Driving Class</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                  activeTab === 'for-class' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-amber-400'
                }`}>
                  {classEnrollmentsCount}
                </span>
              </button>

              <button
                onClick={() => navigateToTab('users')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Users</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                  activeTab === 'users' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-amber-400'
                }`}>
                  {usersCount}
                </span>
              </button>
            </nav>

            {/* Mobile Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-800 space-y-2 shrink-0 bg-slate-900/95">
              <button
                onClick={() => { setIsMobileSidebarOpen(false); onOpenPurgeModal(); }}
                className="w-full py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-red-500/30 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Data for Production</span>
              </button>

              <button
                onClick={() => { setIsMobileSidebarOpen(false); handleLogout(); }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-red-400 text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-slate-800 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Admin Logout</span>
              </button>

              <button
                onClick={() => { setIsMobileSidebarOpen(false); onReturnToClient(); }}
                className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4 text-amber-400" />
                <span>Return to Client Site</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
