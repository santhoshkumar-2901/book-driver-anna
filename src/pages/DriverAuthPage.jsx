import React, { useState, useEffect } from 'react';
import { 
  Car, ShieldCheck, CheckCircle2, MapPin, ArrowRight, LogIn, UserPlus, 
  Sparkles, Lock, Phone, User, Eye, EyeOff, AlertCircle, Award, Check
} from 'lucide-react';
import { SteeringWheel } from '../components/Icons';
import { BANGALORE_AREAS, DEFAULT_REGISTERED_DRIVERS } from '../data/mockData';
import { apiClient } from '../services/apiClient';

// Shared mock registered driver accounts
const DEFAULT_DRIVERS = DEFAULT_REGISTERED_DRIVERS;


export default function DriverAuthPage({ 
  initialMode = 'login', 
  onLoginSuccess, 
  onChangeRole,
  onSwitchMode 
}) {
  const [authMode, setAuthMode] = useState(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Signup form state
  const [signupName, setSignupName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupDl, setSignupDl] = useState('');
  const [signupVehicleType, setSignupVehicleType] = useState('Manual & Automatic Cars');
  const [signupArea, setSignupArea] = useState('Indiranagar');
  const [signupExperience, setSignupExperience] = useState('3-5 Years');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);

  useEffect(() => {
    setAuthMode(initialMode);
  }, [initialMode]);

  const switchMode = (mode) => {
    setAuthMode(mode);
    setErrorMessage('');
    setSuccessMessage('');
    if (onSwitchMode) onSwitchMode(mode);
  };

  // Login submission
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setErrorMessage('Please enter your mobile/DL number and password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiClient.driverLogin({
        identifier: loginIdentifier.trim(),
        password: loginPassword
      });

      if (res && res.data && res.data.user) {
        const driverData = {
          ...res.data.user,
          token: res.data.token,
          loggedInAt: new Date().toISOString()
        };
        localStorage.setItem('bda_driver_user', JSON.stringify(driverData));
        setSuccessMessage(`Welcome back, Anna ${res.data.user.name}!`);
        setTimeout(() => {
          setIsLoading(false);
          if (onLoginSuccess) onLoginSuccess(driverData);
        }, 400);
        return;
      }
    } catch (apiErr) {
      if (apiErr.code !== 'NETWORK_ERROR') {
        setIsLoading(false);
        setErrorMessage(apiErr.message || 'Driver authentication failed. Please check credentials.');
        return;
      }
    }

    setTimeout(() => {
      setIsLoading(false);
      
      // Look up drivers in localStorage
      let drivers = DEFAULT_DRIVERS;
      try {
        const saved = localStorage.getItem('bda_registered_drivers');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) drivers = parsed;
        }
      } catch (err) {}

      const cleanInput = loginIdentifier.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const matched = drivers.find(d => {
        const cleanPhone = (d.phone || '').replace(/[^0-9]/g, '');
        const cleanDl = (d.dlNumber || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return cleanPhone.includes(cleanInput) || cleanDl.includes(cleanInput);
      });

      if (matched) {
        setSuccessMessage(`Welcome back, Anna ${matched.name}!`);
        if (onLoginSuccess) {
          onLoginSuccess(matched);
        }
      } else {
        // Allow demo driver if not found
        const fallbackDriver = {
          ...DEFAULT_DRIVERS[0],
          name: "Manjunath Gowda",
          phone: loginIdentifier.startsWith('+91') ? loginIdentifier : `+91 ${loginIdentifier}`
        };
        setSuccessMessage(`Verified successfully. Welcome, Anna ${fallbackDriver.name}!`);
        if (onLoginSuccess) {
          onLoginSuccess(fallbackDriver);
        }
      }
    }, 600);
  };

  // 1-Click Quick Demo Driver Login
  const handleQuickDemoLogin = () => {
    setIsLoading(true);
    setErrorMessage('');
    setTimeout(() => {
      setIsLoading(false);
      const demoDriver = DEFAULT_DRIVERS[0];
      setSuccessMessage(`Logged in as Top Rated Anna: ${demoDriver.name}`);
      if (onLoginSuccess) {
        onLoginSuccess(demoDriver);
      }
    }, 400);
  };

  // Signup submission
  const handleSignupSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!signupName.trim() || !signupPhone.trim() || !signupDl.trim() || !signupPassword.trim()) {
      setErrorMessage('Please fill in all mandatory driver verification details.');
      return;
    }

    if (signupPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!agreeTerms) {
      setErrorMessage('Please accept the Driver Code of Conduct & Background Verification consent.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);

      const cleanPhone = signupPhone.replace(/[^0-9]/g, '');
      const formattedPhone = cleanPhone.startsWith('91') && cleanPhone.length === 12
        ? `+${cleanPhone.slice(0, 2)} ${cleanPhone.slice(2)}`
        : `+91 ${cleanPhone.slice(-10)}`;

      const newDriver = {
        id: 'DRV-' + Math.floor(1000 + Math.random() * 9000),
        name: signupName.trim(),
        phone: formattedPhone,
        dlNumber: signupDl.trim().toUpperCase(),
        vehicleType: signupVehicleType,
        area: signupArea,
        experienceYears: signupExperience,
        rating: 5.0,
        trips: 0,
        status: 'Active',
        earningsToday: 0,
        isOnline: true,
        createdAt: new Date().toISOString()
      };

      // Save to localStorage
      try {
        let drivers = DEFAULT_DRIVERS;
        const saved = localStorage.getItem('bda_registered_drivers');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) drivers = parsed;
        }
        const updated = [newDriver, ...drivers];
        localStorage.setItem('bda_registered_drivers', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('bda_driver_registered'));
      } catch (err) {}

      setSuccessMessage(`Driver partner profile registered! Welcome to the fleet, Anna ${newDriver.name}.`);
      if (onLoginSuccess) {
        onLoginSuccess(newDriver);
      }
    }, 700);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-y-auto overflow-x-hidden font-sans selection:bg-emerald-400 selection:text-slate-950 max-w-full">
      
      {/* Background Ambience & Grid */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-emerald-500/15 via-emerald-500/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-72 sm:w-96 h-72 sm:h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 max-w-7xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 pt-3 pb-1 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20 shrink-0">
            <SteeringWheel className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-base sm:text-xl text-white font-['Outfit'] tracking-tight leading-none truncate">
              Book Driver <span className="text-emerald-400">Anna</span>
            </div>
            <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5 truncate">
              <Award className="w-2.5 h-2.5 text-emerald-400 inline shrink-0" /> Driver Partner Portal
            </p>
          </div>
        </div>

        {onChangeRole && (
          <button
            type="button"
            onClick={onChangeRole}
            className="text-[10px] sm:text-[11px] font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
          >
            <span>← Role</span>
          </button>
        )}
      </header>

      {/* Central Auth Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-1.5 sm:py-2 overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-md my-auto">

          {/* Card Wrapper */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 backdrop-blur-xl shadow-2xl transition-all duration-300">
            
            {/* Header / Mode Switcher */}
            <div className="text-center space-y-1 mb-3">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white font-['Outfit']">
                {authMode === 'login' ? 'Driver Partner Sign In' : 'Register as Driver Anna'}
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-400 max-w-xs mx-auto">
                {authMode === 'login' 
                  ? 'Sign in to access your Bengaluru trip dashboard & daily earnings.' 
                  : 'Join 1,800+ verified drivers. Drive Bangalore cars with assured payouts.'}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 mb-3.5">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-emerald-400 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Driver Sign In</span>
              </button>

              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === 'signup'
                    ? 'bg-emerald-400 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Driver Registration</span>
              </button>
            </div>

            {/* Error & Success Banners */}
            {errorMessage && (
              <div className="mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* =========================================================================
                A. DRIVER LOGIN FORM (/driver/login)
               ========================================================================= */}
            {authMode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-3">
                
                {/* Mobile or DL Number */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Mobile Number or Driving License (DL) *
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 98860 12345 or KA-04-2021-0098745"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Driver PIN / Password *
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between pt-0.5 text-[11px]">
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-emerald-400 focus:ring-emerald-400 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Remember this device</span>
                  </label>

                  <span className="text-emerald-400/90 hover:underline cursor-pointer" onClick={() => alert("To reset your driver PIN, please contact Bangalore Fleet Dispatcher at +91 98860 12345.")}>
                    Forgot PIN?
                  </span>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer mt-1 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>Verifying driver credentials...</span>
                  ) : (
                    <>
                      <span>Sign In as Driver Anna</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Quick 1-Click Demo Driver Login */}
                <div className="pt-2 border-t border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={handleQuickDemoLogin}
                    disabled={isLoading}
                    className="w-full py-1.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-emerald-400 font-bold text-xs border border-emerald-500/30 hover:border-emerald-400 transition-all flex items-center justify-center gap-2 cursor-pointer shadow"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                    <span>⚡ 1-Click Demo Driver Login (Manjunath Gowda)</span>
                  </button>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Click to sign in immediately with active demo driver profile
                  </p>
                </div>

              </form>
            ) : (
              /* =========================================================================
                  B. DRIVER SIGNUP FORM (/driver/signup)
                 ========================================================================= */
              <form onSubmit={handleSignupSubmit} className="space-y-2">
                
                {/* Full Name */}
                <div className="space-y-0.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Full Name (as on Driving License) *
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Manjunath Gowda"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors"
                    />
                  </div>
                </div>

                {/* Mobile Number & DL Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Mobile Number *
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        placeholder="98860 12345"
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      DL Number *
                    </label>
                    <div className="relative">
                      <Award className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="KA-04-2022-0048123"
                        value={signupDl}
                        onChange={(e) => setSignupDl(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Vehicle Experience & Preferred Area */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Car Experience *
                    </label>
                    <select
                      value={signupVehicleType}
                      onChange={(e) => setSignupVehicleType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400 transition-colors cursor-pointer"
                    >
                      <option value="Manual & Automatic Cars">Manual & Automatic Cars</option>
                      <option value="Manual Hatchback & Sedan">Manual Hatchback & Sedan</option>
                      <option value="Automatic Luxury & SUVs">Automatic Luxury & SUVs</option>
                      <option value="Commercial / All Vehicles">Commercial / All Vehicles</option>
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Preferred Hub *
                    </label>
                    <select
                      value={signupArea}
                      onChange={(e) => setSignupArea(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400 transition-colors cursor-pointer"
                    >
                      {BANGALORE_AREAS.map((a, i) => (
                        <option key={i} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Driving Years & PIN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Experience *
                    </label>
                    <select
                      value={signupExperience}
                      onChange={(e) => setSignupExperience(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400 transition-colors cursor-pointer"
                    >
                      <option value="1-2 Years">1-2 Years</option>
                      <option value="3-5 Years">3-5 Years</option>
                      <option value="5-10 Years">5-10 Years</option>
                      <option value="10+ Years">10+ Years</option>
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Create PIN (Password) *
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Min 6 chars"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors"
                    />
                  </div>
                </div>

                {/* Confirm PIN */}
                <div className="space-y-0.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Confirm PIN *
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Repeat PIN / password"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors"
                  />
                </div>

                {/* Terms Agreement */}
                <label className="flex items-start gap-2 text-[10px] text-slate-300 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-emerald-400 focus:ring-emerald-400 w-3 h-3 mt-0.5 cursor-pointer"
                  />
                  <span>
                    I agree to Book Driver Anna's <span className="text-emerald-400 underline">Driver Code of Conduct</span> & consent to police background verification.
                  </span>
                </label>

                {/* Submit Signup Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer mt-1 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>Registering driver profile...</span>
                  ) : (
                    <>
                      <span>Complete Registration & Join Fleet</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

              </form>
            )}

          </div>

          {/* Micro Trust Indicators */}
          <div className="pt-2 sm:pt-2.5 flex items-center justify-center gap-4 text-[10px] sm:text-[11px] text-slate-400 font-semibold shrink-0">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-400" /> Weekly Payouts</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-amber-400" /> Zero Commission</span>
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-red-400" /> 25+ Bangalore Hubs</span>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-1.5 sm:py-2 text-center text-[10px] sm:text-xs text-slate-500 border-t border-slate-900 shrink-0">
        © {new Date().getFullYear()} Book Driver Anna Driver Fleet. All rights reserved. • Bengaluru, Karnataka
      </footer>

    </div>
  );
}
