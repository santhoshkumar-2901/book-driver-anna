import React, { useState, useEffect, useCallback } from 'react';
import { 
  User, Phone, Mail, MapPin, ShieldCheck, Award, Calendar, 
  Clock, Edit3, Save, X, Check, AlertCircle, RefreshCw, 
  Lock, Copy, CheckCircle2, QrCode, Sparkles, Car, Star
} from 'lucide-react';
import { BANGALORE_AREAS } from '../data/mockData';
import { isValidIndianPhone, isValidUpi } from '../utils/userValidation';
import { toDDMMYYYY } from '../utils/dateUtils';
import { apiClient } from '../services/apiClient';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function DriverProfileSection({
  driverUser,
  onProfileUpdated,
  onReturnToDuties
}) {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formArea, setFormArea] = useState('Indiranagar');
  const [formUpi, setFormUpi] = useState('');

  // Validation and submit state
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Fetch driver profile from server
  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await apiClient.getDriverProfile();
      if (res && res.success && res.data?.profile) {
        const p = res.data.profile;
        setProfile(p);
        setFormName(p.name || '');
        setFormPhone(p.phone ? p.phone.replace(/[^0-9]/g, '').slice(-10) : '');
        setFormEmail(p.email || '');
        setFormArea(p.hubArea || p.area || 'Indiranagar');
        setFormUpi(p.upiId || '');
      } else {
        throw new Error(res?.error?.message || 'Failed to load driver profile details.');
      }
    } catch (err) {
      console.error('[DRIVER PROFILE] Failed to fetch profile:', err);
      // Fallback to local session data if server endpoint returns error in offline mode
      if (driverUser) {
        const fallbackProfile = {
          id: driverUser.driverId || driverUser.id || 'DRV-ANNA',
          userId: driverUser.id || 'USR-DRV',
          name: driverUser.name || 'Driver Anna',
          email: driverUser.email || '',
          phone: driverUser.phone || '',
          area: driverUser.area || 'Indiranagar',
          hubArea: driverUser.area || 'Indiranagar',
          role: 'driver',
          status: 'Active',
          licenseNumber: driverUser.dlNumber || 'KA-04-2021-0098745',
          maskedLicenseNumber: driverUser.dlNumber 
            ? `${driverUser.dlNumber.slice(0, 5)}...${driverUser.dlNumber.slice(-4)}`
            : 'KA-04-XXXX-745',
          experienceYears: driverUser.experienceYears || '5+ Years',
          specialization: driverUser.vehicleType || 'Manual & Automatic Cars',
          rating: Number(driverUser.rating) || 4.95,
          tripsCompleted: Number(driverUser.trips) || 0,
          upiId: driverUser.upiId || '',
          createdAt: new Date().toISOString()
        };
        setProfile(fallbackProfile);
        setFormName(fallbackProfile.name);
        setFormPhone(fallbackProfile.phone ? fallbackProfile.phone.replace(/[^0-9]/g, '').slice(-10) : '');
        setFormEmail(fallbackProfile.email);
        setFormArea(fallbackProfile.hubArea);
        setFormUpi(fallbackProfile.upiId);
      } else {
        setLoadError(err.message || 'Unable to retrieve driver profile.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [driverUser]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleCopy = (text, fieldKey) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleStartEdit = () => {
    if (!profile) return;
    setFormName(profile.name || '');
    setFormPhone(profile.phone ? profile.phone.replace(/[^0-9]/g, '').slice(-10) : '');
    setFormEmail(profile.email || '');
    setFormArea(profile.hubArea || profile.area || 'Indiranagar');
    setFormUpi(profile.upiId || '');
    setFormErrors({});
    setSaveError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (!profile) return;
    setFormName(profile.name || '');
    setFormPhone(profile.phone ? profile.phone.replace(/[^0-9]/g, '').slice(-10) : '');
    setFormEmail(profile.email || '');
    setFormArea(profile.hubArea || profile.area || 'Indiranagar');
    setFormUpi(profile.upiId || '');
    setFormErrors({});
    setSaveError(null);
    setIsEditing(false);
  };

  const validateForm = () => {
    const errors = {};

    const cleanName = formName.trim();
    if (!cleanName || cleanName.length < 2) {
      errors.name = 'Full name must be at least 2 characters long.';
    } else if (cleanName.length > 100) {
      errors.name = 'Full name must not exceed 100 characters.';
    }

    const cleanPhone = formPhone.trim();
    if (!cleanPhone || !isValidIndianPhone(cleanPhone)) {
      errors.phone = 'Please enter a valid 10-digit Indian phone number.';
    }

    const cleanEmail = formEmail.trim();
    if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    const cleanUpi = formUpi.trim();
    if (cleanUpi && !isValidUpi(cleanUpi)) {
      errors.upi = 'Please enter a valid UPI ID (e.g. name@bank or phone@paytm).';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    if (isSaving) return; // Prevent duplicate submissions

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const payload = {
      name: formName.trim(),
      phone: formPhone.trim(),
      email: formEmail.trim().toLowerCase(),
      hubArea: formArea.trim(),
      area: formArea.trim(),
      upiId: formUpi.trim()
    };

    try {
      const res = await apiClient.updateDriverProfile(payload);
      if (res && res.success && res.data?.profile) {
        const updated = res.data.profile;
        setProfile(updated);
        setIsEditing(false);

        // Update local session
        try {
          const current = localStorage.getItem('bda_driver_user');
          const parsed = current ? JSON.parse(current) : {};
          const merged = {
            ...parsed,
            name: updated.name,
            phone: updated.phone,
            email: updated.email,
            area: updated.hubArea,
            upiId: updated.upiId
          };
          localStorage.setItem('bda_driver_user', JSON.stringify(merged));
          if (res.data.token) {
            localStorage.setItem('bda_driver_token', res.data.token);
            localStorage.setItem('bda_jwt_token', res.data.token);
          }
        } catch (e) {}

        if (onProfileUpdated) {
          onProfileUpdated(updated, res.data?.token);
        }
      } else {
        throw new Error(res?.error?.message || 'Failed to update profile.');
      }
    } catch (err) {
      console.error('[DRIVER PROFILE] Update failed:', err);
      setSaveError(err.message || 'An error occurred while saving profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center space-y-4 shadow-xl">
        <RefreshCw className="w-8 h-8 text-amber-400 mx-auto animate-spin" />
        <h3 className="text-base font-bold text-white font-['Outfit']">
          Loading Driver Profile...
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Securely fetching your verified credentials and fleet partner account details.
        </p>
      </div>
    );
  }

  if (loadError && !profile) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <div className="flex items-center gap-3 text-rose-400">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <h3 className="text-base font-bold">Failed to Load Profile</h3>
        </div>
        <p className="text-xs text-slate-300">{loadError}</p>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={fetchProfile}
            className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
          {onReturnToDuties && (
            <button
              onClick={onReturnToDuties}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition-all cursor-pointer"
            >
              Back to Duties
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Profile Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
          
          {/* Driver Text Header & Badges */}
          <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0 select-none">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : 'A'}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white font-['Outfit'] tracking-tight truncate">
                  {profile?.name || 'Driver Anna'}
                </h1>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0">
                  <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Verified Fleet Anna</span>
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0">
                  <Award className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>{profile?.role === 'driver' ? 'Partner Driver' : profile?.role}</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1 font-mono text-slate-300">
                  ID: <strong>{profile?.id || 'DRV-ID'}</strong>
                  <button
                    type="button"
                    onClick={() => handleCopy(profile?.id, 'driverId')}
                    className="p-1 hover:text-white transition-colors cursor-pointer"
                    title="Copy Driver ID"
                  >
                    {copiedField === 'driverId' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
                  </button>
                </span>
                <span className="hidden xs:inline">•</span>
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{profile?.hubArea || profile?.area || 'Indiranagar'} Hub</span>
                </span>
                <span className="hidden xs:inline">•</span>
                <span className="inline-flex items-center gap-1 text-emerald-400 font-extrabold">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                  <span>{profile?.rating || '5.0'} Rating</span>
                </span>
              </div>
            </div>
          </div>

          {/* Action Button: Edit or View Duties */}
          <div className="flex items-center gap-2.5 shrink-0">
            {!isEditing ? (
              <button
                id="edit-driver-profile-btn"
                onClick={handleStartEdit}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm transition-all shadow-md cursor-pointer flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            )}

            {onReturnToDuties && (
              <button
                onClick={onReturnToDuties}
                className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Car className="w-4 h-4 text-emerald-400" />
                <span>View Duties</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Save Error Alert */}
      {saveError && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-semibold flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Error updating profile:</strong> {saveError}
          </div>
          <button onClick={() => setSaveError(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Profile Grid Form / Display */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          
          {/* Card 1: Personal Information */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/15 text-amber-400 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-white font-['Outfit']">
                      Personal Information
                    </h2>
                    <p className="text-[11px] text-slate-400">Driver contact & identity details</p>
                  </div>
                </div>
                {isEditing && (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                    Editable
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-3.5">
                
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  {isEditing ? (
                    <div>
                      <input
                        id="driver-profile-name-input"
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="Driver Full Name"
                        className={`w-full bg-slate-950 border ${formErrors.name ? 'border-rose-500' : 'border-slate-800 focus:border-amber-400'} rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none transition-all`}
                        required
                      />
                      {formErrors.name && (
                        <p className="text-[11px] text-rose-400 mt-1">{formErrors.name}</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-white bg-slate-950/60 border border-slate-800/80 px-3.5 py-2.5 rounded-xl">
                      {profile?.name || '—'}
                    </div>
                  )}
                </div>

                {/* Mobile Phone Number */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Phone Number <span className="text-rose-400">*</span>
                  </label>
                  {isEditing ? (
                    <div>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">+91</span>
                        <input
                          id="driver-profile-phone-input"
                          type="tel"
                          value={formPhone}
                          onChange={(e) => setFormPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                          placeholder="9876543210"
                          className={`w-full bg-slate-950 border ${formErrors.phone ? 'border-rose-500' : 'border-slate-800 focus:border-amber-400'} rounded-xl pl-12 pr-3.5 py-2.5 text-xs sm:text-sm text-white font-mono focus:outline-none transition-all`}
                          required
                        />
                      </div>
                      {formErrors.phone && (
                        <p className="text-[11px] text-rose-400 mt-1">{formErrors.phone}</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-white bg-slate-950/60 border border-slate-800/80 px-3.5 py-2.5 rounded-xl flex items-center justify-between">
                      <span className="font-mono">{profile?.phone || '—'}</span>
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        Verified
                      </span>
                    </div>
                  )}
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Email Address
                  </label>
                  {isEditing ? (
                    <div>
                      <input
                        id="driver-profile-email-input"
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="driver@driveranna.com"
                        className={`w-full bg-slate-950 border ${formErrors.email ? 'border-rose-500' : 'border-slate-800 focus:border-amber-400'} rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none transition-all`}
                      />
                      {formErrors.email && (
                        <p className="text-[11px] text-rose-400 mt-1">{formErrors.email}</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-white bg-slate-950/60 border border-slate-800/80 px-3.5 py-2.5 rounded-xl truncate">
                      {profile?.email || '—'}
                    </div>
                  )}
                </div>

                {/* Hub Area */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Operating Hub / Preferred Area
                  </label>
                  {isEditing ? (
                    <select
                      id="driver-profile-area-select"
                      value={formArea}
                      onChange={(e) => setFormArea(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none transition-all cursor-pointer"
                    >
                      {BANGALORE_AREAS.map((a) => (
                        <option key={a} value={a} className="bg-slate-900 text-white">
                          {a}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-sm font-semibold text-white bg-slate-950/60 border border-slate-800/80 px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{profile?.hubArea || profile?.area || 'Indiranagar'}</span>
                    </div>
                  )}
                </div>

              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-800/70 text-[10px] text-slate-500">
              Personal contact details are used for dispatch notifications and customer ride coordination.
            </div>
          </div>

          {/* Card 2: Driver & Fleet Information */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-white font-['Outfit']">
                      Driver & Fleet Information
                    </h2>
                    <p className="text-[11px] text-slate-400">Professional qualifications & verification</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Admin Verified</span>
                </span>
              </div>

              <div className="mt-4 space-y-3.5">
                
                {/* Masked Driving License */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Driving License (DL) Number
                    </label>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      Masked for Privacy
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white bg-slate-950/60 border border-slate-800/80 px-3.5 py-2.5 rounded-xl font-mono flex items-center justify-between">
                    <span>{profile?.maskedLicenseNumber || 'KA-04-XXXX-745'}</span>
                    <span className="text-[11px] text-slate-500 font-normal">
                      Verified by RTO
                    </span>
                  </div>
                </div>

                {/* Driver Status */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Fleet Account Status
                  </label>
                  <div className="text-sm font-semibold text-white bg-slate-950/60 border border-slate-800/80 px-3.5 py-2.5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{profile?.status || 'Active'}</span>
                    </div>
                    <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">
                      Authorised to Drive
                    </span>
                  </div>
                </div>

                {/* Experience & Specialization Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Experience
                    </label>
                    <div className="text-sm font-bold text-slate-200 bg-slate-950/60 border border-slate-800/80 px-3 py-2 rounded-xl">
                      {profile?.experienceYears || '5+ Years'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Transmission
                    </label>
                    <div className="text-xs font-bold text-slate-200 bg-slate-950/60 border border-slate-800/80 px-3 py-2.5 rounded-xl truncate" title={profile?.specialization}>
                      {profile?.specialization || 'Manual & Automatic'}
                    </div>
                  </div>
                </div>

                {/* Rating & Lifetime Completed Trips */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Customer Rating
                    </label>
                    <div className="text-sm font-black text-amber-400 bg-slate-950/60 border border-slate-800/80 px-3 py-2 rounded-xl flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                      <span>{profile?.rating || '4.95'} / 5.0</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Trips Completed
                    </label>
                    <div className="text-sm font-black text-emerald-400 bg-slate-950/60 border border-slate-800/80 px-3 py-2 rounded-xl font-mono">
                      {profile?.tripsCompleted || 0} Trips
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-800/70 text-[10px] text-slate-500 flex items-center justify-between">
              <span>DL verification is locked by safety compliance.</span>
              <span className="text-amber-400/80">Support: +91 78991 20704</span>
            </div>
          </div>

          {/* Card 3: Account & Verification Details */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-white font-['Outfit']">
                      Account & Verification
                    </h2>
                    <p className="text-[11px] text-slate-400">Security & partner status</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                  Protected
                </span>
              </div>

              <div className="mt-4 space-y-3.5">
                
                {/* Driver Partner Public ID */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Public Driver Partner ID
                  </label>
                  <div className="text-sm font-mono font-bold text-cyan-300 bg-slate-950/60 border border-slate-800/80 px-3.5 py-2.5 rounded-xl flex items-center justify-between">
                    <span>{profile?.id || 'DRV-ID'}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(profile?.id, 'publicId')}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer font-sans"
                    >
                      {copiedField === 'publicId' ? (
                        <span className="text-emerald-400 font-bold text-[11px]">Copied!</span>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Account Role */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    System Role & Permissions
                  </label>
                  <div className="text-sm font-semibold text-white bg-slate-950/60 border border-slate-800/80 px-3.5 py-2.5 rounded-xl flex items-center justify-between">
                    <span className="capitalize">{profile?.role || 'driver'} Partner</span>
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                      Portal Access Only
                    </span>
                  </div>
                </div>

                {/* Member Since Date */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Member Since
                  </label>
                  <div className="text-sm font-medium text-slate-300 bg-slate-950/60 border border-slate-800/80 px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{toDDMMYYYY(profile?.createdAt) || 'Recent Partner'}</span>
                  </div>
                </div>

                {/* Safety & Compliance Badge */}
                <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-2xl flex items-start gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-200">KYC & Document Verification Passed</div>
                    <p className="text-[11px] text-slate-400">
                      Your identity and driving credentials have been audited and authenticated by Book Driver Anna operations.
                    </p>
                  </div>
                </div>

              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-800/70 text-[10px] text-slate-500">
              Account roles are managed exclusively by platform administrators.
            </div>
          </div>

          {/* Card 4: Payout & Settlement Information */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-white font-['Outfit']">
                      Payout & Direct Settlement
                    </h2>
                    <p className="text-[11px] text-slate-400">Personal UPI handle for customer fare collection</p>
                  </div>
                </div>
                {isEditing && (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                    Editable
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-3.5">
                
                {/* Personal UPI ID Input / Display */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Personal UPI ID (GPay / PhonePe / Paytm / BHIM)
                  </label>
                  {isEditing ? (
                    <div>
                      <input
                        id="driver-profile-upi-input"
                        type="text"
                        value={formUpi}
                        onChange={(e) => setFormUpi(e.target.value)}
                        placeholder="e.g. yourname@oksbi or 9845012345@paytm"
                        className={`w-full bg-slate-950 border ${formErrors.upi ? 'border-rose-500' : 'border-slate-800 focus:border-amber-400'} rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white font-mono focus:outline-none transition-all`}
                      />
                      {formErrors.upi && (
                        <p className="text-[11px] text-rose-400 mt-1">{formErrors.upi}</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm font-bold text-white bg-slate-950/60 border border-slate-800/80 px-3.5 py-2.5 rounded-xl font-mono flex items-center justify-between">
                      <span>{profile?.upiId || 'Not configured'}</span>
                      {profile?.upiId && (
                        <button
                          type="button"
                          onClick={() => handleCopy(profile?.upiId, 'upiId')}
                          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer font-sans"
                        >
                          {copiedField === 'upiId' ? (
                            <span className="text-emerald-400 font-bold text-[11px]">Copied!</span>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Direct Settlement Explanation */}
                <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>100% Direct Customer Settle</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    When you complete trips for customers, they scan your verified UPI QR code on the payment screen to settle the full ride fare directly into your bank account.
                  </p>
                </div>

                {/* Live QR Link Note */}
                <div className="text-[11px] text-slate-400 bg-purple-500/10 border border-purple-500/20 p-2.5 rounded-xl flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>
                    Your dynamic settlement QR code is generated on-demand at trip end.
                  </span>
                </div>

              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-800/70 text-[10px] text-slate-500">
              Zero commission deductions on customer tip payments.
            </div>
          </div>

        </div>

        {/* Edit Action Save / Cancel Floating Footer */}
        {isEditing && (
          <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl">
            <div className="text-xs text-slate-400 text-center sm:text-left">
              Make sure your phone and email are accurate. Changes will take effect immediately.
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                id="save-driver-profile-btn"
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Profile...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </form>

    </div>
  );
}
