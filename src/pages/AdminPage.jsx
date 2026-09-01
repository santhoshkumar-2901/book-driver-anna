import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Car, Users, TrendingUp, DollarSign, MapPin, Clock, 
  Calendar, ShieldCheck, CheckCircle2, AlertCircle, Search, Filter, 
  ChevronRight, Phone, ArrowUpRight, Check, X, Lock, Mail, User, Key, LogOut, ArrowRight, Eye, EyeOff
} from 'lucide-react';
import { SteeringWheel, WhatsAppIcon } from '../components/Icons';
import { BANGALORE_AREAS, FEATURED_DRIVERS, VEHICLE_SERVICES } from '../data/mockData';

// Default Mock Driver Bookings
const DEFAULT_DRIVER_BOOKINGS = [
  {
    id: 'BDA-DRV-9801',
    customerName: 'Rahul Dravid',
    phone: '+91 98450 12345',
    tripType: 'one-way',
    tripTitle: 'One Way Trip',
    pickupArea: 'Indiranagar',
    dropLocation: 'Kempegowda Intl Airport (BLR T1/T2)',
    passengers: '2',
    luggage: '3 bags',
    acPreference: 'AC',
    date: '2026-09-02',
    time: '06:30 AM',
    fare: 249,
    status: 'Pending',
    assignedDriver: '',
    bookedAt: '10 Mins ago'
  },
  {
    id: 'BDA-DRV-9802',
    customerName: 'Priya Sharma',
    phone: '+91 97312 88490',
    tripType: 'round-trip',
    tripTitle: 'Round Trip (4hr)',
    pickupArea: 'Koramangala',
    dropLocation: 'Koramangala 5th Block (Multiple Stops)',
    passengers: '1',
    luggage: '1 bag',
    acPreference: 'AC',
    date: '2026-09-01',
    time: '02:00 PM',
    fare: 349,
    status: 'Assigned',
    assignedDriver: "Manjunath 'Manja' Gowda",
    bookedAt: '35 Mins ago'
  },
  {
    id: 'BDA-DRV-9803',
    customerName: 'Vikram Mehta',
    phone: '+91 99001 54321',
    tripType: 'outstation',
    tripTitle: 'Outstation Trip (Round trip 46hr)',
    pickupArea: 'Whitefield',
    dropLocation: 'Coorg (Madikeri Homestay)',
    passengers: '4',
    luggage: '4 bags',
    acPreference: 'AC',
    date: '2026-09-05',
    time: '05:00 AM',
    fare: 2398,
    status: 'Assigned',
    assignedDriver: 'Ramesh Kumar K.',
    bookedAt: '2 Hours ago'
  },
  {
    id: 'BDA-DRV-9804',
    customerName: 'Sanjana Rao',
    phone: '+91 98861 09876',
    tripType: 'one-way',
    tripTitle: 'One Way Trip',
    pickupArea: 'HSR Layout',
    dropLocation: 'Electronic City Phase 1',
    passengers: '1',
    luggage: '0 bags',
    acPreference: 'Non-AC',
    date: '2026-09-01',
    time: '07:15 PM',
    fare: 249,
    status: 'Completed',
    assignedDriver: 'Venkatesh Prasad',
    bookedAt: '4 Hours ago'
  }
];

// Default Mock Vehicle Bookings
const DEFAULT_VEHICLE_BOOKINGS = [
  {
    id: 'BDA-VEH-4101',
    customerName: 'Kavitha N.',
    phone: '+91 98440 99887',
    vehicleName: 'Sedan (Dzire / Honda City)',
    category: 'Sedan',
    rentalType: 'Full Day (24 hrs)',
    pickupArea: 'Indiranagar',
    dropLocation: 'City Tour & Airport Return',
    passengers: '3',
    luggage: '2 bags',
    acPreference: 'AC',
    date: '2026-09-02',
    time: '08:00 AM',
    fare: 1999,
    status: 'Confirmed',
    vehicleRegNumber: 'KA-01-MJ-4321',
    bookedAt: '25 Mins ago'
  },
  {
    id: 'BDA-VEH-4102',
    customerName: 'Infosys Team (Deepak)',
    phone: '+91 99800 11223',
    vehicleName: 'SUV (Toyota Innova Crysta)',
    category: 'SUV',
    rentalType: 'Outstation Trip',
    pickupArea: 'Electronic City',
    dropLocation: 'Mysuru Expressway Run',
    passengers: '6',
    luggage: '5 bags',
    acPreference: 'AC',
    date: '2026-09-04',
    time: '06:00 AM',
    fare: 4549,
    status: 'Pending',
    vehicleRegNumber: 'Unassigned',
    bookedAt: '1 Hour ago'
  },
  {
    id: 'BDA-VEH-4103',
    customerName: 'Suresh Gowda',
    phone: '+91 97400 55443',
    vehicleName: '12 Seater Luxury Tempo',
    category: '12 Seater',
    rentalType: 'Outstation Trip',
    pickupArea: 'Yelahanka',
    dropLocation: 'Nandi Hills & Chikmagalur',
    passengers: '11',
    luggage: '8 bags',
    acPreference: 'AC',
    date: '2026-09-06',
    time: '04:30 AM',
    fare: 7148,
    status: 'Confirmed',
    vehicleRegNumber: 'KA-04-TP-9988',
    bookedAt: '3 Hours ago'
  }
];

export default function AdminPage({ onReturnToClient }) {
  // Persistent Authentication State (persists across page refreshes)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    return localStorage.getItem('bda_admin_logged_in') === 'true';
  });
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  
  // Auth Form Fields
  const [authEmail, setAuthEmail] = useState('admin@bookdriveranna.com');
  const [authPassword, setAuthPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false); // Show / Hide Password toggle state
  const [authFullName, setAuthFullName] = useState('Manjunath Anna');
  const [authPhone, setAuthPhone] = useState('+91 98860 12345');
  const [authSecretKey, setAuthSecretKey] = useState('ANNA2026');
  const [authError, setAuthError] = useState('');
  
  // Logged-in Admin Info
  const [loggedInAdminName, setLoggedInAdminName] = useState(() => {
    return localStorage.getItem('bda_admin_name') || 'Manjunath Anna';
  });
  const [loggedInAdminPhone, setLoggedInAdminPhone] = useState(() => {
    return localStorage.getItem('bda_admin_phone') || '+91 98860 12345';
  });

  // Sidebar Tab State (after login)
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'for-driver', 'for-vehicle'

  // Persistent Driver Bookings State
  const [driverBookings, setDriverBookings] = useState(() => {
    const saved = localStorage.getItem('bda_driver_bookings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    localStorage.setItem('bda_driver_bookings', JSON.stringify(DEFAULT_DRIVER_BOOKINGS));
    return DEFAULT_DRIVER_BOOKINGS;
  });

  // Persistent Vehicle Bookings State
  const [vehicleBookings, setVehicleBookings] = useState(() => {
    const saved = localStorage.getItem('bda_vehicle_bookings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    localStorage.setItem('bda_vehicle_bookings', JSON.stringify(DEFAULT_VEHICLE_BOOKINGS));
    return DEFAULT_VEHICLE_BOOKINGS;
  });

  // Real-time synchronization listener for client bookings submitted anywhere across tabs/app
  useEffect(() => {
    const loadBookingsFromStorage = () => {
      const savedDriver = localStorage.getItem('bda_driver_bookings');
      if (savedDriver) {
        try { setDriverBookings(JSON.parse(savedDriver)); } catch (e) {}
      }
      const savedVehicle = localStorage.getItem('bda_vehicle_bookings');
      if (savedVehicle) {
        try { setVehicleBookings(JSON.parse(savedVehicle)); } catch (e) {}
      }
    };

    window.addEventListener('bda_booking_updated', loadBookingsFromStorage);
    window.addEventListener('storage', loadBookingsFromStorage);

    return () => {
      window.removeEventListener('bda_booking_updated', loadBookingsFromStorage);
      window.removeEventListener('storage', loadBookingsFromStorage);
    };
  }, []);

  // Save driver bookings to localStorage whenever updated
  useEffect(() => {
    localStorage.setItem('bda_driver_bookings', JSON.stringify(driverBookings));
  }, [driverBookings]);

  // Save vehicle bookings to localStorage whenever updated
  useEffect(() => {
    localStorage.setItem('bda_vehicle_bookings', JSON.stringify(vehicleBookings));
  }, [vehicleBookings]);

  // Search & Filters
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [driverStatusFilter, setDriverStatusFilter] = useState('All');

  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState('All');

  // Handle Login & Registration with localStorage persistence
  const handleAuthSubmit = (e) => {
    e.preventDefault();
    setAuthError('');

    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Please enter email and password');
      return;
    }

    let nameToSave = loggedInAdminName;
    let phoneToSave = loggedInAdminPhone;

    if (authMode === 'register') {
      if (!authFullName.trim()) {
        setAuthError('Please enter your full name');
        return;
      }
      if (!authPhone.trim()) {
        setAuthError('Please enter your admin phone number');
        return;
      }
      if (authSecretKey.trim() !== 'ANNA2026') {
        setAuthError('Invalid Admin Secret Key (Demo Key: ANNA2026)');
        return;
      }
      nameToSave = authFullName;
      phoneToSave = authPhone;
    } else {
      nameToSave = authFullName || 'Admin Anna';
      phoneToSave = authPhone || loggedInAdminPhone;
    }

    setLoggedInAdminName(nameToSave);
    setLoggedInAdminPhone(phoneToSave);
    setIsAdminLoggedIn(true);

    // Save session to localStorage
    localStorage.setItem('bda_admin_logged_in', 'true');
    localStorage.setItem('bda_admin_name', nameToSave);
    localStorage.setItem('bda_admin_phone', phoneToSave);
  };

  const handleLogout = () => {
    localStorage.removeItem('bda_admin_logged_in');
    localStorage.removeItem('bda_admin_name');
    localStorage.removeItem('bda_admin_phone');
    setIsAdminLoggedIn(false);
    setActiveTab('dashboard');
  };

  // State map for admin-typed driver details (bookingId -> { name, phone })
  const [driverInputState, setDriverInputState] = useState({});

  const handleDriverInputChange = (bookingId, field, value) => {
    setDriverInputState(prev => ({
      ...prev,
      [bookingId]: {
        ...prev[bookingId],
        [field]: value
      }
    }));
  };

  // Accept & Assign driver booking with admin-typed driver name and phone
  const handleAcceptAndAssignDriver = (bookingId) => {
    const typedName = driverInputState[bookingId]?.name?.trim();
    const typedPhone = driverInputState[bookingId]?.phone?.trim();

    setDriverBookings(prev => prev.map(b => {
      if (b.id === bookingId) {
        const finalName = typedName || b.assignedDriver || "Manjunath Anna";
        const finalPhone = typedPhone || b.assignedDriverPhone || "+91 98860 12345";
        return {
          ...b,
          assignedDriver: finalName,
          assignedDriverPhone: finalPhone,
          status: 'Assigned'
        };
      }
      return b;
    }));
  };

  // WhatsApp Sender ONLY to Client (Enabled ONLY after Accept & Assign)
  const sendWhatsAppToClientForDriver = (booking) => {
    if (booking.status === 'Pending') {
      alert("⚠️ Please click 'Accept & Assign' first to assign the driver before sending WhatsApp message to client!");
      return;
    }

    const cleanClientPhone = booking.phone.replace(/[^0-9]/g, '');
    const driverName = booking.assignedDriver || "Manjunath Anna";
    const driverPhone = booking.assignedDriverPhone || "+91 98860 12345";

    const message = `🚖 *BOOK DRIVER ANNA - TRIP ACCEPTED* 🚖\n\n` +
      `Namaskara *${booking.customerName}*,\n` +
      `Your driver booking request has been accepted & assigned!\n\n` +
      `📌 *Booking Ref:* ${booking.id}\n` +
      `👨‍✈️ *Assigned Driver:* ${driverName}\n` +
      `📞 *Driver Contact:* ${driverPhone}\n` +
      `📍 *Pickup Area:* ${booking.pickupArea}\n` +
      `🏁 *Drop Location:* ${booking.dropLocation}\n` +
      `🚗 *Vehicle Specs:* ${booking.acPreference} (${booking.passengers}, ${booking.luggage})\n` +
      `📅 *Pickup Schedule:* ${booking.date} at ${booking.time}\n` +
      `💰 *Estimated Fare:* ₹${booking.fare}\n\n` +
      `Thank you for choosing Book Driver Anna! Safe Journey!`;

    window.open(`https://api.whatsapp.com/send?phone=${cleanClientPhone}&text=${encodeURIComponent(message)}`, '_blank');
  };

  // WhatsApp Sender ONLY to Client for Vehicle (Enabled ONLY after Accept & Confirm)
  const sendWhatsAppToClientForVehicle = (booking) => {
    if (booking.status === 'Pending') {
      alert("⚠️ Please click 'Accept & Confirm' first before sending WhatsApp message to client!");
      return;
    }

    const cleanClientPhone = booking.phone.replace(/[^0-9]/g, '');

    const message = `🚘 *BOOK DRIVER ANNA - VEHICLE CONFIRMED* 🚘\n\n` +
      `Namaskara *${booking.customerName}*,\n` +
      `Your vehicle rental booking has been accepted & confirmed!\n\n` +
      `📌 *Booking Ref:* ${booking.id}\n` +
      `🚗 *Vehicle Reserved:* ${booking.vehicleName}\n` +
      `🔢 *Registration No:* ${booking.vehicleRegNumber || 'KA-01-MJ-4321'}\n` +
      `📍 *Pickup Location:* ${booking.pickupArea}\n` +
      `📅 *Pickup Schedule:* ${booking.date} at ${booking.time}\n` +
      `💰 *Rental Fare:* ₹${booking.fare}\n\n` +
      `Thank you for choosing Book Driver Anna! Have a smooth drive!`;

    window.open(`https://api.whatsapp.com/send?phone=${cleanClientPhone}&text=${encodeURIComponent(message)}`, '_blank');
  };

  // Quick Action: Update driver booking status
  const handleUpdateDriverStatus = (bookingId, newStatus) => {
    setDriverBookings(prev => prev.map(b => {
      if (b.id === bookingId) {
        return { ...b, status: newStatus };
      }
      return b;
    }));
  };

  // Quick Action: Update vehicle booking status
  const handleUpdateVehicleStatus = (bookingId, newStatus) => {
    setVehicleBookings(prev => prev.map(b => {
      if (b.id === bookingId) {
        return { ...b, status: newStatus };
      }
      return b;
    }));
  };

  // Filtered driver bookings
  const filteredDriverBookings = driverBookings.filter(b => {
    const matchesSearch = b.customerName.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
                          b.id.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
                          b.pickupArea.toLowerCase().includes(driverSearchQuery.toLowerCase());
    const matchesStatus = driverStatusFilter === 'All' || b.status === driverStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered vehicle bookings
  const filteredVehicleBookings = vehicleBookings.filter(b => {
    const matchesSearch = b.customerName.toLowerCase().includes(vehicleSearchQuery.toLowerCase()) ||
                          b.id.toLowerCase().includes(vehicleSearchQuery.toLowerCase()) ||
                          b.vehicleName.toLowerCase().includes(vehicleSearchQuery.toLowerCase());
    const matchesStatus = vehicleStatusFilter === 'All' || b.status === vehicleStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // =========================================================================
  // VIEW 1: ADMIN LOGIN / REGISTER SCREEN (If NOT logged in)
  // =========================================================================
  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden">
        
        {/* Background Decorative Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Bar with Search Bar Address Display */}
        <header className="max-w-5xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-400/20">
              <Car className="w-6 h-6 stroke-[2.2]" />
            </div>
            <span className="font-extrabold text-xl text-white font-['Outfit']">
              Book Driver <span className="text-amber-400">Anna</span>
            </span>
          </div>

          {/* Search/URL Address Indicator Bar */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-4 py-1.5 text-xs text-slate-400 w-full sm:w-80 font-mono">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-300 font-semibold truncate">localhost:3000/admin</span>
            <span className="ml-auto text-[10px] bg-slate-800 text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase">
              Secure
            </span>
          </div>

          <button 
            onClick={onReturnToClient}
            className="text-xs text-slate-400 hover:text-white font-semibold flex items-center gap-1 transition-colors"
          >
            Client Site <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
          </button>
        </header>

        {/* Center Admin Authentication Card */}
        <div className="max-w-md mx-auto w-full my-auto py-8 relative z-10">
          
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
            
            {/* Header Badge */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 bg-amber-400/10 text-amber-400 text-xs font-extrabold px-3 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" /> Admin Access Portal
              </div>
              <h2 className="text-2xl font-extrabold text-white font-['Outfit']">
                {authMode === 'login' ? 'Admin Login' : 'Admin Register'}
              </h2>
              <p className="text-slate-400 text-xs">
                {authMode === 'login' 
                  ? 'Sign in to access Bangalore driver & vehicle management dashboard.' 
                  : 'Register a new Administrator account to manage Annas and fleets.'}
              </p>
            </div>

            {/* Auth Tab Switcher (Login / Register) */}
            <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  authMode === 'login'
                    ? 'bg-amber-400 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  authMode === 'register'
                    ? 'bg-amber-400 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Register
              </button>
            </div>

            {/* Error Message Alert */}
            {authError && (
              <div className="bg-red-500/10 text-red-400 border border-red-500/20 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Authentication Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              
              {authMode === 'register' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Full Name *</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text"
                        required
                        placeholder="e.g. Manjunath Gowda"
                        value={authFullName}
                        onChange={(e) => setAuthFullName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Phone Number *</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="tel"
                        required
                        placeholder="+91 98860 12345"
                        value={authPhone}
                        onChange={(e) => setAuthPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Admin Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="email"
                    required
                    placeholder="admin@bookdriveranna.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Password Field with Show / Hide Toggle Button */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Password *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authMode === 'register' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Admin Security Passcode *</label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text"
                      required
                      placeholder="Enter secret key (e.g. ANNA2026)"
                      value={authSecretKey}
                      onChange={(e) => setAuthSecretKey(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">Demo Key: <span className="text-amber-400 font-mono">ANNA2026</span></p>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-400/20 transition-all flex items-center justify-center gap-2 mt-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{authMode === 'login' ? 'Enter Admin Dashboard' : 'Complete Admin Registration'}</span>
              </button>

            </form>

            {/* Quick Demo Credentials Footer */}
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center text-[11px] text-slate-400">
              💡 Demo Access: <span className="text-white font-semibold">admin@bookdriveranna.com</span> / <span className="text-white font-semibold">admin123</span>
            </div>

          </div>

        </div>

        {/* Page Footer */}
        <footer className="text-center text-xs text-slate-500 relative z-10">
          © {new Date().getFullYear()} Book Driver Anna Technologies. Admin Security Portal.
        </footer>

      </div>
    );
  }

  // =========================================================================
  // VIEW 2: LOGGED-IN ADMIN DASHBOARD (WITH SIDEBAR)
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      
      {/* --------------------------------------------------------------------- */}
      {/* SIDEBAR NAVIGATION */}
      {/* --------------------------------------------------------------------- */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        
        {/* Sidebar Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
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
        <div className="p-4 mx-3 my-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-400 font-extrabold text-xs flex items-center justify-center">
            {loggedInAdminName.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-bold text-white truncate">{loggedInAdminName}</div>
            <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <Phone className="w-2.5 h-2.5 text-emerald-400" /> {loggedInAdminPhone}
            </div>
          </div>
        </div>

        {/* Sidebar Navigation Items (Dashboard, For Driver, For Vehicle) */}
        <nav className="p-4 space-y-2 flex-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-1">
            Admin Management
          </div>

          {/* Sidebar Item 1: Dashboard */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-5 h-5" />
              <span>Dashboard</span>
            </div>
            {activeTab === 'dashboard' && <ChevronRight className="w-4 h-4" />}
          </button>

          {/* Sidebar Item 2: For Driver */}
          <button
            onClick={() => setActiveTab('for-driver')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
              activeTab === 'for-driver'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <SteeringWheel className="w-5 h-5" />
              <span>For Driver</span>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold ${
              activeTab === 'for-driver' 
                ? 'bg-slate-950 text-amber-400' 
                : 'bg-slate-800 text-amber-400 border border-slate-700'
            }`}>
              {driverBookings.length}
            </span>
          </button>

          {/* Sidebar Item 3: For Vehicle */}
          <button
            onClick={() => setActiveTab('for-vehicle')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
              activeTab === 'for-vehicle'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Car className="w-5 h-5" />
              <span>For Vehicle</span>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold ${
              activeTab === 'for-vehicle' 
                ? 'bg-slate-950 text-amber-400' 
                : 'bg-slate-800 text-amber-400 border border-slate-700'
            }`}>
              {vehicleBookings.length}
            </span>
          </button>
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          
          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-red-400 text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-slate-800"
          >
            <LogOut className="w-4 h-4" />
            <span>Admin Logout</span>
          </button>

          <button
            onClick={onReturnToClient}
            className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center justify-center gap-2 border border-slate-700"
          >
            <ArrowUpRight className="w-4 h-4 text-amber-400" />
            <span>Return to Client Site</span>
          </button>

        </div>

      </aside>

      {/* --------------------------------------------------------------------- */}
      {/* MAIN ADMIN DASHBOARD CONTENT */}
      {/* --------------------------------------------------------------------- */}
      <main className="flex-1 p-6 sm:p-10 overflow-y-auto">
        
        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <span className="bg-amber-400/10 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider">
                  Operational Dashboard
                </span>
                <h1 className="text-3xl font-extrabold text-white font-['Outfit'] mt-2">
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

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Revenue</span>
                  <div className="w-9 h-9 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-white font-['Outfit']">₹4,85,200</div>
                <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> +14.2% this month
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">Active Driver Annas</span>
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                    <SteeringWheel className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-white font-['Outfit']">1,840</div>
                <div className="text-xs text-slate-400">100% Police Background Verified</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">Driver Requests</span>
                  <div className="w-9 h-9 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-amber-400 font-['Outfit']">{driverBookings.length} Active</div>
                <div className="text-xs text-amber-400 font-semibold">
                  {driverBookings.filter(b => b.status === 'Pending').length} Pending Dispatch
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">Vehicle Rentals</span>
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                    <Car className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-white font-['Outfit']">{vehicleBookings.length} Active</div>
                <div className="text-xs text-slate-400">
                  Sedan, SUV & Tempo Traveller
                </div>
              </div>

            </div>

            {/* Recent Driver Bookings with Single Combined WhatsApp Action */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-white font-['Outfit'] flex items-center gap-2">
                  <SteeringWheel className="w-5 h-5 text-amber-400" /> Recent Driver Booking Dispatches
                </h3>
                <button 
                  onClick={() => setActiveTab('for-driver')}
                  className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1"
                >
                  Manage All Drivers <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {driverBookings.map((b) => (
                  <div key={b.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-white">{b.customerName}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded">
                          {b.id}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-amber-400 shrink-0" /> {b.pickupArea} to {b.dropLocation}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {b.tripTitle} • ₹{b.fare}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`inline-block text-[11px] font-extrabold px-3 py-1 rounded-full ${
                        b.status === 'Pending' 
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
                        title={b.status === 'Pending' ? "Please Accept & Assign order first to send WhatsApp to client" : "Send trip confirmation WhatsApp to Client"}
                        className={`text-[11px] font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all border ${
                          b.status === 'Pending'
                            ? 'bg-slate-950 text-slate-500 border-slate-800 opacity-60 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30 border-emerald-400/30'
                        }`}
                      >
                        <WhatsAppIcon className="w-3.5 h-3.5 fill-current" />
                        <span>WhatsApp to Client</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: FOR DRIVER */}
        {activeTab === 'for-driver' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
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
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    placeholder="Search by customer, area, ref..."
                    value={driverSearchQuery}
                    onChange={(e) => setDriverSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-full sm:w-auto">
                  {['All', 'Pending', 'Assigned', 'Completed'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setDriverStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
            <div className="space-y-4">
              {filteredDriverBookings.map((b) => (
                <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold shrink-0">
                        <SteeringWheel className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-base text-white">{b.customerName}</span>
                          <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                            {b.id}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" /> {b.phone}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                        b.status === 'Pending' 
                          ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' 
                          : b.status === 'Assigned' 
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        ● {b.status}
                      </span>
                      <div className="text-sm font-extrabold text-white font-['Outfit']">₹{b.fare}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Trip Type & Package</div>
                      <div className="font-extrabold text-white">{b.tripTitle}</div>
                      <div className="text-slate-400">{b.date} • {b.time}</div>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Pickup & Drop Route</div>
                      <div className="font-semibold text-slate-200 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-400 shrink-0" /> {b.pickupArea}
                      </div>
                      <div className="text-slate-400 truncate">Drop: {b.dropLocation}</div>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Passenger & Luggage</div>
                      <div className="font-semibold text-slate-200">{b.passengers} Passengers • {b.luggage}</div>
                      <div className="text-amber-400 font-semibold">{b.acPreference} Vehicle</div>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Assigned Driver Details</div>
                      <div className="font-bold text-emerald-400 truncate">
                        {b.assignedDriver ? b.assignedDriver : '⚠️ No Driver Assigned'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {b.assignedDriverPhone ? `📞 ${b.assignedDriverPhone}` : 'Police Verified Driver'}
                      </div>
                    </div>
                  </div>

                  {/* Driver Inputs & Action Controls */}
                  <div className="pt-2 flex flex-col lg:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
                    
                    {/* 2 Input Boxes Typed by Admin for Driver Name & Driver Phone Number */}
                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
                      <div className="relative w-full sm:w-44">
                        <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                          type="text"
                          placeholder="Driver Name"
                          value={driverInputState[b.id]?.name ?? (b.assignedDriver || '')}
                          onChange={(e) => handleDriverInputChange(b.id, 'name', e.target.value)}
                          className="bg-slate-950 border border-slate-700 text-xs font-semibold text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-amber-400 w-full"
                        />
                      </div>
                      <div className="relative w-full sm:w-36">
                        <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                          type="text"
                          placeholder="Driver Phone"
                          value={driverInputState[b.id]?.phone ?? (b.assignedDriverPhone || '')}
                          onChange={(e) => handleDriverInputChange(b.id, 'phone', e.target.value)}
                          className="bg-slate-950 border border-slate-700 text-xs font-semibold text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-amber-400 w-full"
                        />
                      </div>
                    </div>

                    {/* Status Toggles & WhatsApp Action */}
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                      <button
                        onClick={() => handleUpdateDriverStatus(b.id, 'Pending')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                          b.status === 'Pending' ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        Set Pending
                      </button>
                      <button
                        onClick={() => handleAcceptAndAssignDriver(b.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                          b.status === 'Assigned' ? 'bg-blue-500 text-white border-blue-500' : 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-400'
                        }`}
                      >
                        Accept & Assign
                      </button>

                      {/* WhatsApp Button to send details ONLY to Client */}
                      <button
                        onClick={() => sendWhatsAppToClientForDriver(b)}
                        title={b.status === 'Pending' ? "Please Accept & Assign order first to send WhatsApp to client" : "Send Accepted Order Details via WhatsApp to Client"}
                        className={`text-xs font-extrabold px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition-all border ${
                          b.status === 'Pending'
                            ? 'bg-slate-950 text-slate-500 border-slate-800 opacity-60 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 border-emerald-400/40'
                        }`}
                      >
                        <WhatsAppIcon className="w-4 h-4 fill-current" />
                        <span>WhatsApp to Client</span>
                      </button>
                    </div>

                  </div>

                </div>
              ))}
            </div>

          </div>
        )}

        {/* TAB 3: FOR VEHICLE */}
        {activeTab === 'for-vehicle' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <span className="bg-amber-400/10 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider">
                  Vehicle Rental Management
                </span>
                <h1 className="text-3xl font-extrabold text-white font-['Outfit'] mt-2">
                  For Vehicle (Fleet Bookings & Dispatch)
                </h1>
                <p className="text-slate-400 text-xs mt-1">
                  Track Sedan, SUV, and Tempo Traveller rental requests, assign vehicle registration numbers, and send WhatsApp notifications to Client.
                </p>
              </div>

              {/* Search & Status Filter */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    placeholder="Search vehicle, customer..."
                    value={vehicleSearchQuery}
                    onChange={(e) => setVehicleSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-full sm:w-auto">
                  {['All', 'Pending', 'Confirmed', 'Dispatched'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setVehicleStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
            <div className="space-y-4">
              {filteredVehicleBookings.map((b) => (
                <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold shrink-0">
                        <Car className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-base text-white">{b.customerName}</span>
                          <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                            {b.id}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" /> {b.phone}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                        b.status === 'Pending' 
                          ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' 
                          : b.status === 'Confirmed' 
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        ● {b.status}
                      </span>
                      <div className="text-sm font-extrabold text-amber-400 font-['Outfit']">₹{b.fare}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Vehicle Reserved</div>
                      <div className="font-extrabold text-white">{b.vehicleName}</div>
                      <div className="text-amber-400 font-semibold">{b.rentalType}</div>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Pickup Location & Time</div>
                      <div className="font-semibold text-slate-200 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-400 shrink-0" /> {b.pickupArea}
                      </div>
                      <div className="text-slate-400">{b.date} • {b.time}</div>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Passenger & Luggage</div>
                      <div className="font-semibold text-slate-200">{b.passengers} Passengers • {b.luggage}</div>
                      <div className="text-emerald-400 font-semibold">{b.acPreference} Vehicle</div>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Assigned Reg Number</div>
                      <div className="font-mono font-bold text-amber-400">{b.vehicleRegNumber}</div>
                      <div className="text-[10px] text-slate-500">Sanitized Fleet Vehicle</div>
                    </div>
                  </div>

                  {/* Controls & Single Combined WhatsApp Dispatch Action */}
                  <div className="pt-2 flex flex-col lg:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
                    <div className="text-xs text-slate-400">
                      Booked: <span className="text-slate-300 font-semibold">{b.bookedAt}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                      <button
                        onClick={() => handleUpdateVehicleStatus(b.id, 'Pending')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                          b.status === 'Pending' ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        Set Pending
                      </button>
                      <button
                        onClick={() => handleUpdateVehicleStatus(b.id, 'Confirmed')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                          b.status === 'Confirmed' ? 'bg-blue-500 text-white border-blue-500' : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        Accept & Confirm
                      </button>

                      {/* WhatsApp Button to send details ONLY to Client */}
                      <button
                        onClick={() => sendWhatsAppToClientForVehicle(b)}
                        title={b.status === 'Pending' ? "Please Accept & Confirm order first to send WhatsApp to client" : "Send Confirmed Vehicle Details via WhatsApp to Client"}
                        className={`text-xs font-extrabold px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition-all border ${
                          b.status === 'Pending'
                            ? 'bg-slate-950 text-slate-500 border-slate-800 opacity-60 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 border-emerald-400/40'
                        }`}
                      >
                        <WhatsAppIcon className="w-4 h-4 fill-current" />
                        <span>WhatsApp to Client</span>
                      </button>
                    </div>

                  </div>

                </div>
              ))}
            </div>

          </div>
        )}

      </main>

    </div>
  );
}
