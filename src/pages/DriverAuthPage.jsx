import React, { useState, useEffect } from 'react';
import { 
  Car, ShieldCheck, CheckCircle2, MapPin, ArrowRight, LogIn, UserPlus, 
  Sparkles, Lock, Phone, User, Eye, EyeOff, AlertCircle, Award, Check, QrCode
} from 'lucide-react';
import { SteeringWheel } from '../components/Icons';
import { BANGALORE_AREAS, DEFAULT_REGISTERED_DRIVERS } from '../data/mockData';
import { apiClient } from '../services/apiClient';

// Registered driver partners directory (empty on clean boot)
const DEFAULT_DRIVERS = [];


export default function DriverAuthPage({ 
  initialMode = 'login', 
  onLoginSuccess, 
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
  const [signupUpi, setSignupUpi] = useState('');
  const [signupVehicleType, setSignupVehicleType] = useState('Manual & Automatic Cars');
  const [signupArea, setSignupArea] = useState('Indiranagar');
  const [signupExperience, setSignupExperience] = useState('3-5 Years');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Form input element refs for direct DOM clearing if browser injects values
  const loginIdentifierRef = React.useRef(null);
  const loginPasswordRef = React.useRef(null);
  const signupNameRef = React.useRef(null);
  const signupPhoneRef = React.useRef(null);
  const signupDlRef = React.useRef(null);
  const signupPasswordRef = React.useRef(null);
  const signupConfirmPasswordRef = React.useRef(null);

  // Clear all previous input information from driver login and signup forms
  const resetForm = () => {
    setLoginIdentifier('');
    setLoginPassword('');
    setSignupName('');
    setSignupPhone('');
    setSignupDl('');
    setSignupUpi('');
    setSignupVehicleType('Manual & Automatic Cars');
    setSignupArea('Indiranagar');
    setSignupExperience('3-5 Years');
    setSignupPassword('');
    setSignupConfirmPassword('');
    setAgreeTerms(true);
    setShowPassword(false);
    setErrorMessage('');
    setSuccessMessage('');

    if (loginIdentifierRef.current) loginIdentifierRef.current.value = '';
    if (loginPasswordRef.current) loginPasswordRef.current.value = '';
    if (signupNameRef.current) signupNameRef.current.value = '';
    if (signupPhoneRef.current) signupPhoneRef.current.value = '';
    if (signupDlRef.current) signupDlRef.current.value = '';
    if (signupPasswordRef.current) signupPasswordRef.current.value = '';
    if (signupConfirmPasswordRef.current) signupConfirmPasswordRef.current.value = '';
  };

  useEffect(() => {
    setAuthMode(initialMode);
    resetForm();

    // Browser password managers / autofill engines inject credentials asynchronously 50-300ms after DOM mount
    const t1 = setTimeout(() => {
      resetForm();
    }, 60);
    const t2 = setTimeout(() => {
      resetForm();
    }, 250);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      resetForm();
    };
  }, [initialMode]);

  const switchMode = (mode) => {
    setAuthMode(mode);
    resetForm();
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

    const submittedIdentifier = loginIdentifier.trim();
    const submittedPassword = loginPassword.trim();

    setIsLoading(true);

    try {
      const res = await apiClient.driverLogin({
        identifier: submittedIdentifier,
        password: submittedPassword
      });

      if (res && res.data && res.data.user) {
        const driverData = {
          ...res.data.user,
          token: res.data.token,
          loggedInAt: new Date().toISOString()
        };
        localStorage.setItem('bda_driver_user', JSON.stringify(driverData));
        resetForm();
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

      const cleanInput = submittedIdentifier.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const matched = drivers.find(d => {
        const cleanPhone = (d.phone || '').replace(/[^0-9]/g, '');
        const cleanDl = (d.dlNumber || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return cleanPhone.includes(cleanInput) || cleanDl.includes(cleanInput);
      });

      if (matched) {
        resetForm();
        setSuccessMessage(`Welcome back, Anna ${matched.name}!`);
        if (onLoginSuccess) {
          onLoginSuccess(matched);
        }
      } else {
        setIsLoading(false);
        setErrorMessage('Driver account not found. Please register or verify your credentials.');
        return;
      }
    }, 600);
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
        upiId: signupUpi.trim() || 'anna.driver@oksbi',
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

      const sessionData = {
        ...newDriver,
        token: 'driver-session-' + Date.now(),
        loggedInAt: new Date().toISOString()
      };
      localStorage.setItem('bda_driver_user', JSON.stringify(sessionData));

      resetForm();
      setSuccessMessage(`Driver partner profile registered! Welcome to the fleet, Anna ${newDriver.name}.`);
      if (onLoginSuccess) {
        onLoginSuccess(sessionData);
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

        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Partner Fleet</span>
        </div>
      </header>

      {/* Central Auth Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-1.5 sm:py-2 overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-md my-auto">

          {/* Card Wrapper */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 backdrop-blur-xl shadow-2xl transition-all duration-300">
            
            {/* Header / Mode Switcher */}
            <div className="text-center space-y-1 mb-3">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white font-['Outfit']">
                {authMode === 'login' ? 'Login' : 'Signup'}
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-400 max-w-xs mx-auto">
                {authMode === 'login' 
                  ? 'Log in to access your Bengaluru trip dashboard & daily earnings.' 
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
                <span>Login</span>
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
                <span>Signup</span>
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
              <form onSubmit={handleLoginSubmit} className="space-y-3" autoComplete="off">
                {/* Hidden dummy fields to absorb aggressive browser autofill */}
                <input
                  type="text"
                  name="bda_prevent_driver_user"
                  tabIndex={-1}
                  aria-hidden="true"
                  autoComplete="off"
                  className="sr-only hidden"
                  readOnly
                />
                <input
                  type="password"
                  name="bda_prevent_driver_pwd"
                  tabIndex={-1}
                  aria-hidden="true"
                  autoComplete="new-password"
                  className="sr-only hidden"
                  readOnly
                />
                
                {/* Mobile or DL Number */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Mobile Number or Driving License (DL) *
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      ref={loginIdentifierRef}
                      type="text"
                      name="bda_driver_identity"
                      id="bda_driver_identity"
                      required
                      autoComplete="off"
                      placeholder="e.g. 98765 43210 or KA-04-2021-0098745"
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
                      ref={loginPasswordRef}
                      type={showPassword ? 'text' : 'password'}
                      name="bda_driver_security_pin"
                      id="bda_driver_security_pin"
                      required
                      autoComplete="new-password"
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

                  <span className="text-emerald-400/90 hover:underline cursor-pointer" onClick={() => alert("To reset your driver PIN, please contact Bangalore Fleet Dispatcher at +91 80 2555 0199.")}>
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
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Verifying driver credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Login</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>



              </form>
            ) : (
              /* =========================================================================
                  B. DRIVER SIGNUP FORM (/driver/signup)
                 ========================================================================= */
              <form onSubmit={handleSignupSubmit} className="space-y-2" autoComplete="off">
                {/* Hidden dummy fields to absorb browser autofill */}
                <input
                  type="text"
                  name="bda_prevent_drv_signup_user"
                  tabIndex={-1}
                  aria-hidden="true"
                  autoComplete="off"
                  className="sr-only hidden"
                  readOnly
                />
                <input
                  type="password"
                  name="bda_prevent_drv_signup_pwd"
                  tabIndex={-1}
                  aria-hidden="true"
                  autoComplete="new-password"
                  className="sr-only hidden"
                  readOnly
                />
                
                {/* Full Name */}
                <div className="space-y-0.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Full Name (as on Driving License) *
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      ref={signupNameRef}
                      type="text"
                      name="bda_drv_reg_name"
                      required
                      autoComplete="off"
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
                        ref={signupPhoneRef}
                        type="tel"
                        name="bda_drv_reg_phone"
                        required
                        autoComplete="off"
                        placeholder="98765 43210"
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
                        ref={signupDlRef}
                        type="text"
                        name="bda_drv_reg_dl"
                        required
                        autoComplete="off"
                        placeholder="KA-04-2022-0048123"
                        value={signupDl}
                        onChange={(e) => setSignupDl(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Driver UPI ID (For Direct Customer Ride Payment QR) */}
                <div className="space-y-0.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Payment UPI ID (GPay / PhonePe / Paytm)</span>
                    <span className="text-[10px] text-amber-400 font-normal">Auto QR Generator</span>
                  </label>
                  <div className="relative">
                    <QrCode className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="driver-signup-upi"
                      type="text"
                      name="bda_drv_reg_upi"
                      autoComplete="off"
                      placeholder="e.g. yourname@oksbi or phone@paytm"
                      value={signupUpi}
                      onChange={(e) => setSignupUpi(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors font-mono"
                    />
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
                      ref={signupPasswordRef}
                      type={showPassword ? 'text' : 'password'}
                      name="bda_drv_reg_pin"
                      required
                      autoComplete="new-password"
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
                    ref={signupConfirmPasswordRef}
                    type={showPassword ? 'text' : 'password'}
                    name="bda_drv_reg_cpin"
                    required
                    autoComplete="new-password"
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
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Registering driver profile...</span>
                    </>
                  ) : (
                    <>
                      <span>Signup</span>
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
