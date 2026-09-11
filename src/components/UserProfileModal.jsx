import React, { useState, useEffect } from 'react';
import { 
  X, User, Phone, Mail, MapPin, Calendar, ShieldCheck, 
  Car, Clock, CheckCircle2, AlertCircle, Edit3, LogOut, 
  Sparkles, ArrowRight, Ban, Award, Check, Save, XCircle
} from 'lucide-react';
import { SteeringWheel } from './Icons';
import { BANGALORE_AREAS } from '../data/mockData';
import { useScrollLock } from '../utils/useScrollLock';
import { toDDMMYYYY } from '../utils/dateUtils';
import { apiClient } from '../services/apiClient';

// Helper to determine if the active user is one of the pre-seeded demo accounts
export const isDemoUser = (user) => {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();
  const id = (user.id || '').toUpperCase().trim();
  
  // Seeded demo IDs or emails
  if (['CLI-901', 'CLI-902', 'USR-8821', 'USR-8822'].includes(id)) return true;
  if (['rahul.sharma@example.com', 'priya@gmail.com'].includes(email)) return true;
  if (user.isDemo === true) return true;

  return false;
};

// The two default bookings that strictly and exclusively appear ONLY on demo users
export const DEFAULT_DEMO_BOOKINGS = [
  {
    id: 'BDA-DRV-9801',
    serviceType: 'driver',
    title: 'One Way Trip Driver',
    category: 'Personal Driver',
    date: '06/09/2026',
    time: '09:00 AM',
    pickup: 'Indiranagar',
    drop: 'Kempegowda Intl Airport (BLR T1/T2)',
    amount: '₹314',
    status: 'Pending'
  },
  {
    id: 'BDA-VEH-9802',
    serviceType: 'vehicle',
    title: 'Sedan Rental',
    category: 'Car Rental',
    date: 'Recent',
    time: '10:30 AM',
    pickup: 'Indiranagar',
    drop: 'Koramangala 5th Block',
    amount: '₹1,499',
    status: 'Cancelled'
  }
];

// Set of demo booking IDs to exclude for any non-demo users
const DEMO_BOOKING_IDS = new Set([
  'BDA-DRV-9801',
  'BDA-VEH-9802',
  'BDA-977047',
  'BDA-VEH-9DE337',
  'BDA-DRV-9802',
  'BDA-DRV-9803',
  'BDA-DRV-9804',
  'BDA-DRV-9805',
  'BDA-DRV-9806',
  'BDA-VEH-4101',
  'BDA-VEH-4102',
  'BDA-VEH-4103',
  'BDA-VEH-4104'
]);

export default function UserProfileModal({ 
  isOpen, 
  onClose, 
  clientUser, 
  onUpdateProfile, 
  onLogout,
  openBookingModal 
}) {
  useScrollLock(isOpen);

  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'bookings' | 'perks'
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');

  // Form edit states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formArea, setFormArea] = useState('Indiranagar');

  // Bookings list state
  const [userBookings, setUserBookings] = useState([]);

  useEffect(() => {
    if (clientUser) {
      setFormName(clientUser.name || '');
      setFormEmail(clientUser.email || '');
      setFormPhone(clientUser.phone || '');
      setFormArea(clientUser.area || 'Indiranagar');
    }
  }, [clientUser]);

  // Load user bookings whenever modal opens or bookings are updated
  useEffect(() => {
    if (!isOpen || !clientUser) return;

    // 1. If this is a seeded demo user, show the 2 demo bookings
    if (isDemoUser(clientUser)) {
      setUserBookings(DEFAULT_DEMO_BOOKINGS);
      return;
    }

    // 2. For newly registered or real users:
    // Start empty by default so new accounts have 0 bookings until they place an order
    let isCancelled = false;

    const fetchBookings = async () => {
      const userPhoneClean = (clientUser.phone || '').replace(/[^0-9]/g, '');
      const userEmailClean = (clientUser.email || '').toLowerCase().trim();
      const currentUserId = clientUser.id ? String(clientUser.id).trim() : null;

      const matched = [];
      const seenIds = new Set();

      // First attempt: Query authoritative bookings from backend API
      try {
        const res = await apiClient.getMyBookings();
        if (!isCancelled && res && res.data && Array.isArray(res.data.bookings)) {
          res.data.bookings.forEach(b => {
            // Strictly exclude any demo bookings for regular/new accounts
            if (DEMO_BOOKING_IDS.has(b.id)) return;
            if (!seenIds.has(b.id)) {
              seenIds.add(b.id);
              matched.push({
                id: b.id,
                serviceType: b.booking_type || 'driver',
                title: b.service_name || 'Driver Anna Duty',
                category: b.booking_type === 'vehicle' ? 'Car Rental' : (b.booking_type === 'class' ? 'Driving School' : 'Personal Driver'),
                date: b.date || 'Recent',
                time: b.time || '',
                pickup: b.pickup_area || 'Indiranagar',
                drop: b.drop_location || '',
                amount: b.calculated_fare ? `₹${b.calculated_fare}` : '₹299',
                status: b.status || 'Confirmed'
              });
            }
          });
        }
      } catch (err) {
        // Backend lookup fallback
      }

      // Check local storage for any bookings created during the active browser session
      // STRICT requirement: Only match if booking explicitly has this user's userId or verified email/phone,
      // and NEVER include demo bookings or match by name alone.
      try {
        const driverBookings = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
        driverBookings.forEach(b => {
          if (DEMO_BOOKING_IDS.has(b.id)) return;
          if (b.isDemo) return;

          const bUserId = b.userId ? String(b.userId).trim() : null;
          const bEmail = (b.customerEmail || b.email || '').toLowerCase().trim();
          const bPhone = (b.phone || '').replace(/[^0-9]/g, '');

          const isOwner = 
            (currentUserId && bUserId && bUserId === currentUserId) ||
            (!bUserId && userEmailClean && bEmail === userEmailClean) ||
            (!bUserId && userPhoneClean && userPhoneClean.length >= 10 && bPhone.endsWith(userPhoneClean.slice(-10)));

          if (isOwner && !seenIds.has(b.id)) {
            seenIds.add(b.id);
            matched.push({
              id: b.id,
              serviceType: 'driver',
              title: b.tripTitle || 'Driver Anna Duty',
              category: 'Personal Driver',
              date: b.date || b.bookingDate || 'Recent',
              time: b.time || b.bookingTime || '',
              pickup: b.pickupArea || 'Indiranagar',
              drop: b.dropLocation || '',
              amount: b.estimatedPrice || b.fare || '₹299',
              status: b.status || 'Confirmed'
            });
          }
        });
      } catch (e) {}

      try {
        const vehicleBookings = JSON.parse(localStorage.getItem('bda_vehicle_bookings') || '[]');
        vehicleBookings.forEach(b => {
          if (DEMO_BOOKING_IDS.has(b.id)) return;
          if (b.isDemo) return;

          const bUserId = b.userId ? String(b.userId).trim() : null;
          const bEmail = (b.customerEmail || b.email || '').toLowerCase().trim();
          const bPhone = (b.phone || '').replace(/[^0-9]/g, '');

          const isOwner = 
            (currentUserId && bUserId && bUserId === currentUserId) ||
            (!bUserId && userEmailClean && bEmail === userEmailClean) ||
            (!bUserId && userPhoneClean && userPhoneClean.length >= 10 && bPhone.endsWith(userPhoneClean.slice(-10)));

          if (isOwner && !seenIds.has(b.id)) {
            seenIds.add(b.id);
            matched.push({
              id: b.id,
              serviceType: 'vehicle',
              title: b.vehicleName || 'Rental Vehicle',
              category: 'Car Rental',
              date: b.startDate || 'Recent',
              time: b.pickupTime || '',
              pickup: b.pickupLocation || b.pickupArea || 'Bengaluru',
              drop: b.dropLocation || '',
              amount: b.totalPrice ? `₹${b.totalPrice}` : '₹1,499',
              status: b.status || 'Confirmed'
            });
          }
        });
      } catch (e) {}

      try {
        const classEnrollments = JSON.parse(localStorage.getItem('bda_class_enrollments') || '[]');
        classEnrollments.forEach(b => {
          const bId = b.enrollmentId || b.id;
          if (DEMO_BOOKING_IDS.has(bId)) return;
          if (b.isDemo) return;

          const bUserId = b.userId ? String(b.userId).trim() : null;
          const bEmail = (b.customerEmail || b.email || '').toLowerCase().trim();
          const bPhone = (b.phone || '').replace(/[^0-9]/g, '');

          const isOwner = 
            (currentUserId && bUserId && bUserId === currentUserId) ||
            (!bUserId && userEmailClean && bEmail === userEmailClean) ||
            (!bUserId && userPhoneClean && userPhoneClean.length >= 10 && bPhone.endsWith(userPhoneClean.slice(-10)));

          if (isOwner && !seenIds.has(bId)) {
            seenIds.add(bId);
            matched.push({
              id: bId,
              serviceType: 'class',
              title: b.courseName || 'Driving Class Session',
              category: 'Driving School',
              date: b.startDate || 'Upcoming',
              time: b.preferredSlot || '',
              pickup: b.pickupArea || 'Doorstep',
              drop: '',
              amount: b.courseFee || '₹3,999',
              status: b.status || 'Active'
            });
          }
        });
      } catch (e) {}

      if (!isCancelled) {
        setUserBookings(matched);
      }
    };

    fetchBookings();

    const handleBookingsUpdated = () => {
      fetchBookings();
    };

    window.addEventListener('bda_booking_updated', handleBookingsUpdated);
    return () => {
      isCancelled = true;
      window.removeEventListener('bda_booking_updated', handleBookingsUpdated);
    };
  }, [isOpen, clientUser]);

  if (!isOpen || !clientUser) return null;

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      alert('Name and Email are required.');
      return;
    }

    const updatedUser = {
      ...clientUser,
      name: formName.trim(),
      email: formEmail.trim(),
      area: formArea
    };

    if (onUpdateProfile) {
      onUpdateProfile(updatedUser);
    }

    setIsEditing(false);
    setSaveSuccess('Your profile details were updated successfully!');
    setTimeout(() => {
      setSaveSuccess('');
    }, 4000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-xl relative overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 sm:px-5 py-3.5 sm:py-4 shrink-0 bg-slate-900 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-800 border border-slate-700 text-amber-500 font-bold text-sm sm:text-base flex items-center justify-center shrink-0">
              {clientUser.name ? clientUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white font-['Outfit'] truncate max-w-[150px] sm:max-w-[280px]">
                  {clientUser.name}
                </h3>
                <span className="text-[9px] sm:text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                  Verified Client
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                Customer ID: <span className="font-mono text-slate-300">{clientUser.id || 'CLI-USER'}</span> • Bengaluru
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 sm:p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer shrink-0"
            title="Close Profile"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-Tab Navigation Bar */}
        <div className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 border-b border-slate-800 bg-slate-950 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'details'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bookings')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'bookings'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>My Bookings ({userBookings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('perks')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'perks'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Policies & Support</span>
          </button>
        </div>

        {/* Success Toast */}
        {saveSuccess && (
          <div className="mx-5 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-400 font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1 custom-scrollbar">

          {/* =============================================================== */}
          {/* TAB 1: PROFILE DETAILS                                          */}
          {/* =============================================================== */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              
              {/* Quick Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Rides</div>
                  <div className="text-base font-bold text-white mt-0.5">{userBookings.length} Trips</div>
                  <div className="text-[10px] text-slate-400">Bengaluru Urban</div>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Primary Hub</div>
                  <div className="text-base font-bold text-slate-200 mt-0.5 truncate">{clientUser.area || 'Indiranagar'}</div>
                  <div className="text-[10px] text-slate-400">Registered Locality</div>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Account Status</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">Active Client</div>
                  <div className="text-[10px] text-slate-400">Verified Mobile</div>
                </div>
              </div>

              {/* Form / Profile Info Box */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-amber-400" />
                    <span className="font-extrabold text-white text-sm">Personal Information</span>
                  </div>
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-white font-bold text-xs transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Details</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="py-1.5 px-3 rounded-xl bg-slate-800 text-slate-400 hover:text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {!isEditing ? (
                  /* Read Only View */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" /> Full Name:
                      </div>
                      <div className="font-bold text-white text-sm mt-0.5">{clientUser.name}</div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-400" /> Mobile Number:
                      </div>
                      <div className="font-bold text-white text-sm font-mono mt-0.5">{clientUser.phone}</div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-blue-400" /> Email Address:
                      </div>
                      <div className="font-bold text-white text-xs mt-0.5 truncate">{clientUser.email}</div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-red-400" /> Operating Locality:
                      </div>
                      <div className="font-bold text-amber-400 text-xs mt-0.5">{clientUser.area || 'Indiranagar'}</div>
                    </div>

                  </div>
                ) : (
                  /* Edit Form Mode */
                  <form onSubmit={handleSaveProfile} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">Full Name *</label>
                      <input 
                        type="text"
                        required
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-300">Email Address *</label>
                        <input 
                          type="email"
                          required
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-300">Primary Locality</label>
                        <select
                          value={formArea}
                          onChange={(e) => setFormArea(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                        >
                          {BANGALORE_AREAS.map((area, idx) => (
                            <option key={idx} value={area}>{area}</option>
                          ))}
                        </select>
                      </div>
                    </div>



                    <div className="pt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="py-2 px-3.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="py-2 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-400/20 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 2: MY BOOKINGS                                              */}
          {/* =============================================================== */}
          {activeTab === 'bookings' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  Your Bookings & Trip History
                </h4>
                <button
                  onClick={() => {
                    onClose();
                    if (openBookingModal) openBookingModal('driver');
                  }}
                  className="text-amber-400 hover:text-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>+ Book New Ride</span>
                </button>
              </div>

              {userBookings.length === 0 ? (
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                    <SteeringWheel className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div className="text-white font-bold text-sm">No Active or Past Bookings Found</div>
                  <p className="text-slate-400 text-xs max-w-xs mx-auto">
                    You haven't placed any bookings under mobile number <span className="font-mono text-slate-200">{clientUser.phone}</span> yet.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      if (openBookingModal) openBookingModal('driver');
                    }}
                    className="py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-400/20 transition-all inline-flex items-center gap-1.5 cursor-pointer mt-2"
                  >
                    <SteeringWheel className="w-4 h-4" />
                    <span>Book Driver Anna Now</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {userBookings.map((b, idx) => {
                    const statusStr = (b.status || '').toLowerCase();
                    const isCancelled = statusStr.includes('cancel');
                    const isPending = statusStr.includes('pending');

                    return (
                      <div 
                        key={idx}
                        className={`rounded-2xl p-3.5 space-y-2.5 transition-all ${
                          isCancelled
                            ? 'bg-red-950/20 border border-red-900/50 hover:border-red-500/50'
                            : 'bg-slate-950/70 border border-slate-800/90 hover:border-amber-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded-md border ${
                              isCancelled
                                ? 'bg-red-950/60 text-red-300 border-red-900/60'
                                : 'bg-slate-900 text-slate-300 border border-slate-800'
                            }`}>
                              {b.id}
                            </span>
                            <span className={`font-bold text-xs truncate ${
                              isCancelled ? 'text-slate-300 line-through decoration-red-400/70' : 'text-white'
                            }`}>
                              {b.title}
                            </span>
                          </div>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold shrink-0 border flex items-center gap-1 ${
                            isCancelled
                              ? 'bg-red-500/15 text-red-400 border-red-500/40 shadow-sm shadow-red-500/10'
                              : isPending
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          }`}>
                            {isCancelled && <XCircle className="w-3 h-3 text-red-400 shrink-0" />}
                            <span>{b.status}</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1 border-t border-slate-800/60">
                          <div>
                            <span className="text-slate-500">Service:</span> <span className="font-semibold text-slate-200">{b.category}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Fare:</span>{' '}
                            <span className={`font-mono ${isCancelled ? 'line-through text-slate-500' : 'font-extrabold text-amber-400'}`}>
                              {b.amount}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Pickup:</span> <span className="font-medium text-slate-200">{b.pickup}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Scheduled:</span> <span className="font-medium text-slate-200">{b.date} {b.time}</span>
                          </div>
                        </div>

                        {isCancelled && (
                          <div className="flex items-center justify-between text-[10px] text-red-400/90 bg-red-950/40 px-2.5 py-1.5 rounded-xl border border-red-900/40">
                            <span className="flex items-center gap-1.5 font-medium">
                              <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                              <span>Booking Cancelled • Zero Cancellation Fee</span>
                            </span>
                            <span className="font-mono text-[9px] uppercase tracking-wider text-red-400/80 font-bold bg-red-950/80 px-1.5 py-0.5 rounded border border-red-900/50">
                              Cancelled
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 3: SERVICE POLICIES & SUPPORT                               */}
          {/* =============================================================== */}
          {activeTab === 'perks' && (
            <div className="space-y-4">
              <div className="card-surface p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white text-sm">Customer Commitments & Trip Policies</span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  All bookings on Book Driver Anna adhere to standard urban transit standards across Bengaluru.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-start gap-3">
                  <div className="w-8 h-8 rounded-md bg-slate-900 border border-slate-800 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white text-xs">Zero Advance Cancellation Fee</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Need to reschedule or cancel? You can cancel driver, vehicle, or driving class bookings with ₹0 penalty anytime prior to driver dispatch.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-start gap-3">
                  <div className="w-8 h-8 rounded-md bg-slate-900 border border-slate-800 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white text-xs">24/7 Bengaluru Dispatch Support</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Direct phone assistance with our Indiranagar operations team at <a href="tel:+919886012345" className="text-amber-500 font-mono hover:underline">+91 98860 12345</a>.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-start gap-3">
                  <div className="w-8 h-8 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white text-xs">Verified Doorstep Dispatch</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Drivers reach your apartment, residence, or office across all 25+ Bangalore localities with proper photo ID and DL verification.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-900">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Are you sure you want to sign out?')) {
                onLogout();
                onClose();
              }
            }}
            className="btn-danger py-2 px-3 text-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              if (openBookingModal) openBookingModal('driver');
            }}
            className="btn-primary py-2 px-4 text-xs"
          >
            <SteeringWheel className="w-3.5 h-3.5" />
            <span>Book Driver Anna</span>
          </button>
        </div>

      </div>
    </div>
  );
}
