import React, { useState, useEffect } from 'react';
import { 
  X, User, Phone, Mail, MapPin, Calendar, ShieldCheck, 
  Car, Clock, CheckCircle2, AlertCircle, Edit3, LogOut, 
  Sparkles, ArrowRight, Ban, Award, Check, Save
} from 'lucide-react';
import { SteeringWheel } from './Icons';
import { BANGALORE_AREAS } from '../data/mockData';
import { useScrollLock } from '../utils/useScrollLock';
import { toDDMMYYYY } from '../utils/dateUtils';

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

  // Load user bookings whenever modal opens
  useEffect(() => {
    if (!isOpen || !clientUser) return;

    const userPhoneClean = (clientUser.phone || '').replace(/[^0-9]/g, '');
    const userEmailClean = (clientUser.email || '').toLowerCase().trim();
    const userNameClean = (clientUser.name || '').toLowerCase().trim();

    const matched = [];

    // 1. Driver bookings
    try {
      const driverBookings = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
      driverBookings.forEach(b => {
        const bPhone = (b.phone || '').replace(/[^0-9]/g, '');
        const bEmail = (b.customerEmail || b.email || '').toLowerCase().trim();
        const bName = (b.customerName || '').toLowerCase().trim();

        const isMatch = 
          (userPhoneClean && bPhone.endsWith(userPhoneClean.slice(-10))) ||
          (userEmailClean && bEmail === userEmailClean) ||
          (userNameClean && bName === userNameClean);

        if (isMatch) {
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

    // 2. Vehicle bookings
    try {
      const vehicleBookings = JSON.parse(localStorage.getItem('bda_vehicle_bookings') || '[]');
      vehicleBookings.forEach(b => {
        const bPhone = (b.phone || '').replace(/[^0-9]/g, '');
        const bEmail = (b.email || '').toLowerCase().trim();
        const bName = (b.customerName || '').toLowerCase().trim();

        const isMatch = 
          (userPhoneClean && bPhone.endsWith(userPhoneClean.slice(-10))) ||
          (userEmailClean && bEmail === userEmailClean) ||
          (userNameClean && bName === userNameClean);

        if (isMatch) {
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

    // 3. Driving classes
    try {
      const classEnrollments = JSON.parse(localStorage.getItem('bda_class_enrollments') || '[]');
      classEnrollments.forEach(b => {
        const bPhone = (b.phone || '').replace(/[^0-9]/g, '');
        const bEmail = (b.email || '').toLowerCase().trim();
        const bName = (b.studentName || b.candidateName || '').toLowerCase().trim();

        const isMatch = 
          (userPhoneClean && bPhone.endsWith(userPhoneClean.slice(-10))) ||
          (userEmailClean && bEmail === userEmailClean) ||
          (userNameClean && bName === userNameClean);

        if (isMatch) {
          matched.push({
            id: b.enrollmentId || b.id,
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

    setUserBookings(matched);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-hidden touch-none overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl shadow-black/80 relative overflow-hidden overscroll-contain touch-pan-y"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4 shrink-0 bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-lg flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              {clientUser.name ? clientUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-white font-['Outfit'] truncate max-w-[200px] sm:max-w-[280px]">
                  {clientUser.name}
                </h3>
                <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  Verified
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Customer ID: <span className="font-mono text-slate-300 font-bold">{clientUser.id || 'CLI-USER'}</span> • Bengaluru
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
            title="Close Profile"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-Tab Navigation Bar */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-800/80 bg-slate-950/60 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'details'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bookings')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'bookings'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>My Bookings ({userBookings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('perks')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'perks'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Bangalore Benefits</span>
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
                <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Total Rides</div>
                  <div className="text-lg font-extrabold text-white mt-0.5">{userBookings.length} Trips</div>
                  <div className="text-[10px] text-emerald-400 font-semibold">Across Bengaluru</div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Primary Hub</div>
                  <div className="text-lg font-extrabold text-amber-400 mt-0.5 truncate">{clientUser.area || 'Indiranagar'}</div>
                  <div className="text-[10px] text-slate-400 font-semibold">Home Locality</div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Account Tier</div>
                  <div className="text-lg font-extrabold text-emerald-400 mt-0.5">Gold Commuter</div>
                  <div className="text-[10px] text-slate-400 font-semibold">Verified Client</div>
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
                  {userBookings.map((b, idx) => (
                    <div 
                      key={idx}
                      className="bg-slate-950/70 border border-slate-800/90 hover:border-amber-500/40 rounded-2xl p-3.5 space-y-2.5 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-bold text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded-md border border-slate-800">
                            {b.id}
                          </span>
                          <span className="font-bold text-white text-xs truncate">
                            {b.title}
                          </span>
                        </div>
                        <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold shrink-0">
                          {b.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1 border-t border-slate-800/60">
                        <div>
                          <span className="text-slate-500">Service:</span> <span className="font-semibold text-slate-200">{b.category}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Fare:</span> <span className="font-extrabold text-amber-400 font-mono">{b.amount}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Pickup:</span> <span className="font-medium text-slate-200">{b.pickup}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Scheduled:</span> <span className="font-medium text-slate-200">{b.date} {b.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 3: BANGALORE BENEFITS                                       */}
          {/* =============================================================== */}
          {activeTab === 'perks' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 border border-amber-500/20 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="font-extrabold text-white text-sm">Verified Bengaluru Customer Privileges</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  As a registered customer on Book Driver Anna, your bookings are prioritized with our highest-rated Anna drivers across all 25+ Bangalore hubs.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs">Zero Penalty Guarantee</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Change in plans? Cancel driver, vehicle rental, or driving class bookings with 0 penalty anytime before Anna arrives.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs">24x7 Priority Bangalore Helpline</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Direct phone & WhatsApp support with local Bengaluru coordinators at <a href="tel:+919886012345" className="text-amber-400 font-bold hover:underline font-mono">+91 98860 12345</a>.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs">Dedicated Doorstep Pickup</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Anna arrives on time at your apartment, villa, or office across Indiranagar, Koramangala, Whitefield, HSR, Electronic City and all BBMP limits.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-slate-800/80 flex items-center justify-between gap-3 shrink-0 bg-slate-900/90">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Are you sure you want to sign out?')) {
                onLogout();
                onClose();
              }
            }}
            className="py-2 px-3 sm:px-4 rounded-xl bg-slate-950 hover:bg-red-500/15 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (openBookingModal) openBookingModal('driver');
              }}
              className="py-2 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold shadow-md shadow-amber-400/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <SteeringWheel className="w-3.5 h-3.5" />
              <span>Book Driver Anna</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
