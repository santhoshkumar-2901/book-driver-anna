import React, { useState, useEffect } from 'react';
import {
  Car, ShieldCheck, MapPin, Lock, Mail, Phone, User,
  Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, Sparkles,
  LogIn, UserPlus, Check
} from 'lucide-react';
import { SteeringWheel } from '../components/Icons';
import { BANGALORE_AREAS } from '../data/mockData';
import { apiClient } from '../services/apiClient';

// Default seeded demo clients for instant testing
const DEFAULT_REGISTERED_CLIENTS = [
  {
    id: 'CLI-901',
    name: 'Rahul Sharma',
    email: 'rahul.sharma@example.com',
    phone: '+91 98860 12345',
    area: 'Indiranagar',
    password: 'password123',
    createdAt: '2026-09-01'
  },
  {
    id: 'CLI-902',
    name: 'Priya Sharma',
    email: 'priya@gmail.com',
    phone: '+91 98441 56789',
    area: 'Koramangala',
    password: 'password123',
    createdAt: '2026-09-02'
  }
];

export default function ClientAuthPage({
  initialMode = 'login',
  onLoginSuccess,
  onChangeRole,
  onSwitchMode
}) {
  const [authMode, setAuthMode] = useState(initialMode); // 'login' or 'signup'

  // Login Form States
  const [loginIdentifier, setLoginIdentifier] = useState(''); // email or phone
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Signup Form States
  const [signupName, setSignupName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupArea, setSignupArea] = useState('Indiranagar');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Form input element refs for direct DOM clearing if browser injects values
  const loginIdentifierRef = React.useRef(null);
  const loginPasswordRef = React.useRef(null);
  const signupNameRef = React.useRef(null);
  const signupPhoneRef = React.useRef(null);
  const signupEmailRef = React.useRef(null);
  const signupPasswordRef = React.useRef(null);
  const signupConfirmPasswordRef = React.useRef(null);

  // Clear all previous input information from login and signup forms
  const resetForm = () => {
    setLoginIdentifier('');
    setLoginPassword('');
    setSignupName('');
    setSignupPhone('');
    setSignupEmail('');
    setSignupArea('Indiranagar');
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
    if (signupEmailRef.current) signupEmailRef.current.value = '';
    if (signupPasswordRef.current) signupPasswordRef.current.value = '';
    if (signupConfirmPasswordRef.current) signupConfirmPasswordRef.current.value = '';
  };

  // Sync mode from URL or prop changes and wipe all previous input info on visit/revisit
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

  // Seed default registered clients if not present
  useEffect(() => {
    try {
      const stored = localStorage.getItem('bda_registered_clients');
      if (!stored) {
        localStorage.setItem('bda_registered_clients', JSON.stringify(DEFAULT_REGISTERED_CLIENTS));
      }
    } catch (e) { }
  }, []);

  // Synchronize registered/authenticated customer with localStorage and notify Admin in real-time
  const syncUserToRegisteredClients = (user) => {
    if (!user) return;
    try {
      let list = DEFAULT_REGISTERED_CLIENTS;
      const raw = localStorage.getItem('bda_registered_clients');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
      }
      const cleanPhone = (user.phone || '').replace(/[^0-9]/g, '');
      const cleanEmail = (user.email || '').trim().toLowerCase();

      const idx = list.findIndex(u =>
        (u.id && user.id && u.id === user.id) ||
        (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail) ||
        (cleanPhone.length >= 10 && u.phone && u.phone.replace(/[^0-9]/g, '').endsWith(cleanPhone.slice(-10)))
      );

      const clientEntry = {
        id: user.id || ('CLI-' + Math.floor(1000 + Math.random() * 9000)),
        name: user.name,
        phone: user.phone,
        email: user.email,
        area: user.area || 'Indiranagar',
        status: user.status || 'Active',
        createdAt: user.createdAt || user.created_at || new Date().toISOString().split('T')[0]
      };

      let updatedList;
      if (idx !== -1) {
        updatedList = [...list];
        updatedList[idx] = { ...updatedList[idx], ...clientEntry };
      } else {
        updatedList = [clientEntry, ...list];
      }

      localStorage.setItem('bda_registered_clients', JSON.stringify(updatedList));
      window.dispatchEvent(new CustomEvent('bda_client_registered', { detail: clientEntry }));
    } catch (err) {
      console.error('Error syncing user to registered clients:', err);
    }
  };

  const switchMode = (newMode) => {
    setAuthMode(newMode);
    resetForm();
    if (onSwitchMode) {
      onSwitchMode(newMode);
    } else if (typeof window !== 'undefined') {
      window.history.pushState({}, '', newMode === 'signup' ? '/signup' : '/login');
    }
  };

  // 1-Click Quick Demo Login (for reviewer/testing convenience)
  const handleQuickDemoLogin = () => {
    setIsLoading(true);
    setErrorMessage('');
    setTimeout(() => {
      const demoUser = DEFAULT_REGISTERED_CLIENTS[0];
      const sessionData = {
        id: demoUser.id,
        name: demoUser.name,
        email: demoUser.email,
        phone: demoUser.phone,
        area: demoUser.area,
        token: 'bda_tok_' + Date.now(),
        loggedInAt: new Date().toISOString()
      };
      localStorage.setItem('bda_client_user', JSON.stringify(sessionData));
      syncUserToRegisteredClients(sessionData);
      setSuccessMessage(`Welcome back, ${demoUser.name}! Logging you in...`);
      // Wipe input boxes immediately so returning to signin page starts completely empty
      resetForm();
      setTimeout(() => {
        setIsLoading(false);
        onLoginSuccess(sessionData);
      }, 600);
    }, 400);
  };

  // Handle Client Sign In
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!loginIdentifier.trim()) {
      setErrorMessage('Please enter your email or registered phone number');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('Please enter your account password');
      return;
    }

    const submittedIdentifier = loginIdentifier.trim();
    const submittedPassword = loginPassword;

    setIsLoading(true);

    try {
      const res = await apiClient.login({
        identifier: submittedIdentifier,
        password: submittedPassword
      });

      if (res && res.data && res.data.user) {
        const sessionData = {
          ...res.data.user,
          token: res.data.token,
          loggedInAt: new Date().toISOString()
        };

        if (rememberMe) {
          localStorage.setItem('bda_client_user', JSON.stringify(sessionData));
        } else {
          sessionStorage.setItem('bda_client_user', JSON.stringify(sessionData));
        }

        syncUserToRegisteredClients(res.data.user);

        // Wipe input boxes immediately so returning to signin page starts completely empty
        resetForm();

        setSuccessMessage(`Welcome, ${res.data.user.name}! Opening Namma Bangalore services...`);
        setTimeout(() => {
          setIsLoading(false);
          onLoginSuccess(sessionData);
        }, 400);
        return;
      }
    } catch (apiErr) {
      let hasLocalProfileMatch = false;
      try {
        const stored = JSON.parse(localStorage.getItem('bda_registered_clients') || '[]');
        const allClients = [...stored, ...DEFAULT_REGISTERED_CLIENTS];
        const cleanInput = submittedIdentifier.toLowerCase();
        const cleanPhone = submittedIdentifier.replace(/[^0-9]/g, '');
        const matched = allClients.find(u =>
          (u.email && u.email.toLowerCase() === cleanInput) ||
          (cleanPhone.length >= 10 && u.phone && u.phone.replace(/[^0-9]/g, '').endsWith(cleanPhone.slice(-10)))
        );
        if (matched && (!matched.password || matched.password === submittedPassword)) {
          hasLocalProfileMatch = true;
        }
      } catch (e) { }

      if (!hasLocalProfileMatch && apiErr.code !== 'NETWORK_ERROR' && apiErr.status !== 500) {
        setIsLoading(false);
        setErrorMessage(apiErr.message || 'Login failed. Please check your credentials.');
        return;
      }
      console.warn('[AUTH] API response or offline state encountered. Checking registered client credentials.');
    }

    setTimeout(() => {
      let registeredUsers = [];
      try {
        registeredUsers = JSON.parse(localStorage.getItem('bda_registered_clients') || '[]');
      } catch (err) {
        registeredUsers = DEFAULT_REGISTERED_CLIENTS;
      }

      const cleanInput = submittedIdentifier.toLowerCase();
      const cleanPhone = submittedIdentifier.replace(/[^0-9]/g, '');

      // Check against stored registered clients
      const matchedUser = registeredUsers.find(u =>
        (u.email && u.email.toLowerCase() === cleanInput) ||
        (cleanPhone.length >= 10 && u.phone && u.phone.replace(/[^0-9]/g, '').endsWith(cleanPhone.slice(-10)))
      );

      if (matchedUser) {
        if (matchedUser.password && matchedUser.password !== submittedPassword) {
          setIsLoading(false);
          setErrorMessage('Incorrect password. Please verify and try again.');
          return;
        }

        const sessionData = {
          id: matchedUser.id,
          name: matchedUser.name,
          email: matchedUser.email,
          phone: matchedUser.phone,
          area: matchedUser.area || 'Indiranagar',
          token: 'bda_tok_' + Date.now(),
          loggedInAt: new Date().toISOString()
        };

        if (rememberMe) {
          localStorage.setItem('bda_client_user', JSON.stringify(sessionData));
        } else {
          sessionStorage.setItem('bda_client_user', JSON.stringify(sessionData));
        }

        syncUserToRegisteredClients(matchedUser);

        // Wipe input boxes immediately so returning to signin page starts completely empty
        resetForm();

        setSuccessMessage(`Welcome, ${matchedUser.name}! Opening Namma Bangalore services...`);
        setTimeout(() => {
          setIsLoading(false);
          onLoginSuccess(sessionData);
        }, 500);
      } else {
        setIsLoading(false);
        setErrorMessage('Invalid email/phone or password. Please verify your credentials or register.');
      }
    }, 500);
  };

  // Handle Client Sign Up / Registration
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!signupName.trim()) {
      setErrorMessage('Please enter your full name');
      return;
    }
    const cleanPhone = signupPhone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!signupEmail.trim() || !signupEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    if (!signupPassword || signupPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long');
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }
    if (!agreeTerms) {
      setErrorMessage('Please agree to the Terms of Service & Privacy Policy');
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiClient.register({
        name: signupName.trim(),
        email: signupEmail.trim(),
        phone: signupPhone.trim(),
        password: signupPassword,
        area: signupArea
      });

      if (res && res.data && res.data.user) {
        const sessionData = {
          ...res.data.user,
          token: res.data.token,
          loggedInAt: new Date().toISOString()
        };
        localStorage.setItem('bda_client_user', JSON.stringify(sessionData));
        syncUserToRegisteredClients(res.data.user);
        resetForm();
        setSuccessMessage(`Registration successful! Welcome to Book Driver Anna, ${res.data.user.name}!`);
        setTimeout(() => {
          setIsLoading(false);
          onLoginSuccess(sessionData);
        }, 500);
        return;
      }
    } catch (apiErr) {
      if (apiErr.code !== 'NETWORK_ERROR') {
        setIsLoading(false);
        setErrorMessage(apiErr.message || 'Registration failed.');
        return;
      }
    }

    setTimeout(() => {
      setIsLoading(false);

      let registeredClients = DEFAULT_REGISTERED_CLIENTS;
      try {
        const saved = localStorage.getItem('bda_registered_clients');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) registeredClients = parsed;
        }
      } catch (err) {
        registeredClients = DEFAULT_REGISTERED_CLIENTS;
      }

      // Check if email or phone already registered
      const cleanPhone = signupPhone.replace(/[^0-9]/g, '');
      const isDuplicate = registeredClients.some(u =>
        (u.email && u.email.toLowerCase() === signupEmail.trim().toLowerCase()) ||
        (u.phone && u.phone.replace(/[^0-9]/g, '').endsWith(cleanPhone.slice(-10)))
      );

      if (isDuplicate) {
        setErrorMessage('An account with this mobile number or email already exists. Please sign in.');
        return;
      }

      const formattedPhone = cleanPhone.startsWith('91') && cleanPhone.length === 12
        ? `+${cleanPhone.slice(0, 2)} ${cleanPhone.slice(2)}`
        : `+91 ${cleanPhone.slice(-10)}`;

      const newClient = {
        id: 'CLI-' + Math.floor(1000 + Math.random() * 9000),
        name: signupName.trim(),
        phone: formattedPhone,
        email: signupEmail.trim(),
        area: signupArea,
        status: 'Active',
        createdAt: new Date().toISOString().split('T')[0]
      };

      syncUserToRegisteredClients(newClient);
      resetForm();

      setSuccessMessage(`Account created successfully! Welcome, ${newClient.name}.`);
      if (onLoginSuccess) {
        onLoginSuccess(newClient);
      }
    }, 700);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-y-auto overflow-x-hidden font-sans selection:bg-amber-400 selection:text-slate-950 max-w-full">

      {/* Background Ambience & Grid */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-72 sm:w-96 h-72 sm:h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 max-w-7xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 pt-3 pb-1 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20 shrink-0">
            <Car className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-base sm:text-xl text-white font-['Outfit'] tracking-tight leading-none truncate">
              Book Driver <span className="text-amber-400">Anna</span>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="w-2.5 h-2.5 text-red-400 inline shrink-0" /> Namma Bengaluru Services
            </p>
          </div>
        </div>

        {onChangeRole && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              onChangeRole();
            }}
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
          <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 backdrop-blur-xl shadow-2xl transition-all duration-300">

            {/* Header / Mode Switcher */}
            <div className="text-center space-y-1 mb-3">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white font-['Outfit']">
                {authMode === 'login' ? 'Sign In to Your Account' : 'Create Client Account'}
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-400 max-w-xs mx-auto">
                {authMode === 'login'
                  ? 'Access verified drivers, vehicle rentals & driving classes across Bengaluru.'
                  : 'Join thousands of Bengalureans enjoying stress-free rides and doorstep classes.'}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 mb-3.5">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${authMode === 'login'
                  ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>

              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${authMode === 'signup'
                  ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Sign Up</span>
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
                A. LOGIN FORM
               ========================================================================= */}
            {authMode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-3" autoComplete="off">
                {/* Hidden dummy fields to absorb aggressive browser autofill */}
                <input
                  type="text"
                  name="bda_prevent_autofill_user"
                  tabIndex={-1}
                  aria-hidden="true"
                  autoComplete="off"
                  className="sr-only hidden"
                  readOnly
                />
                <input
                  type="password"
                  name="bda_prevent_autofill_pwd"
                  tabIndex={-1}
                  aria-hidden="true"
                  autoComplete="new-password"
                  className="sr-only hidden"
                  readOnly
                />

                {/* Email or Phone */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Email Address or Phone *
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      ref={loginIdentifierRef}
                      type="text"
                      name="bda_client_identity"
                      id="bda_client_identity"
                      required
                      autoComplete="off"
                      placeholder="e.g. rahul.sharma@example.com or 9886012345"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Password *
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      ref={loginPasswordRef}
                      type={showPassword ? 'text' : 'password'}
                      name="bda_client_security_key"
                      id="bda_client_security_key"
                      required
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
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
                      className="rounded bg-slate-950 border-slate-700 text-amber-400 focus:ring-amber-400 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Remember me</span>
                  </label>

                  <span className="text-amber-400/90 hover:underline cursor-pointer" onClick={() => alert("To reset password, please verify your mobile number via WhatsApp support (+91 98860 12345).")}>
                    Forgot Password?
                  </span>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer mt-1 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>Verifying credentials...</span>
                  ) : (
                    <>
                      <span>Sign In to Book Driver Anna</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Quick 1-Click Demo Login */}
                <div className="pt-2 border-t border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={handleQuickDemoLogin}
                    disabled={isLoading}
                    className="w-full py-1.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-400 font-bold text-xs border border-amber-500/30 hover:border-amber-400 transition-all flex items-center justify-center gap-2 cursor-pointer shadow"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    <span>⚡ 1-Click Quick Demo Login (Rahul Sharma)</span>
                  </button>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Click to instantly sign in without typing passwords
                  </p>
                </div>

              </form>
            ) : (
              /* =========================================================================
                  B. SIGNUP FORM
                 ========================================================================= */
              <form onSubmit={handleSignupSubmit} className="space-y-2" autoComplete="off">
                {/* Hidden dummy fields to absorb browser autofill */}
                <input
                  type="text"
                  name="bda_prevent_signup_user"
                  tabIndex={-1}
                  aria-hidden="true"
                  autoComplete="off"
                  className="sr-only hidden"
                  readOnly
                />
                <input
                  type="password"
                  name="bda_prevent_signup_pwd"
                  tabIndex={-1}
                  aria-hidden="true"
                  autoComplete="new-password"
                  className="sr-only hidden"
                  readOnly
                />

                {/* Full Name */}
                <div className="space-y-0.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      ref={signupNameRef}
                      type="text"
                      name="bda_client_reg_name"
                      required
                      autoComplete="off"
                      placeholder="e.g. Rahul Sharma"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>
                </div>

                {/* Mobile Number & Area */}
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
                        name="bda_client_reg_phone"
                        required
                        autoComplete="off"
                        placeholder="98860 12345"
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Bangalore Area *
                    </label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 text-red-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        value={signupArea}
                        onChange={(e) => setSignupArea(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 transition-colors appearance-none cursor-pointer"
                      >
                        {BANGALORE_AREAS.map((a, i) => (
                          <option key={i} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Email Address */}
                <div className="space-y-0.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      ref={signupEmailRef}
                      type="email"
                      name="bda_client_reg_email"
                      required
                      autoComplete="off"
                      placeholder="e.g. rahul.sharma@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>
                </div>

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        ref={signupPasswordRef}
                        type={showPassword ? 'text' : 'password'}
                        name="bda_client_reg_pwd"
                        required
                        autoComplete="new-password"
                        placeholder="Min 6 chars"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        ref={signupConfirmPasswordRef}
                        type={showPassword ? 'text' : 'password'}
                        name="bda_client_reg_cpwd"
                        required
                        autoComplete="new-password"
                        placeholder="Repeat password"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Terms Agreement */}
                <label className="flex items-start gap-2 text-[10px] text-slate-300 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-amber-400 focus:ring-amber-400 w-3 h-3 mt-0.5 cursor-pointer"
                  />
                  <span>
                    I agree to Book Driver Anna's <span className="text-amber-400 underline">Terms of Service</span> & Zero Cancellation Policy.
                  </span>
                </label>

                {/* Submit Signup Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer mt-1 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>Creating your account...</span>
                  ) : (
                    <>
                      <span>Complete Registration & Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

              </form>
            )}

          </div>

          {/* Micro Trust Indicators */}
          <div className="pt-2 sm:pt-2.5 flex items-center justify-center gap-4 text-[10px] sm:text-[11px] text-slate-400 font-semibold shrink-0">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-400" /> 256-Bit Encrypted</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-amber-400" /> Police Verified Annas</span>
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-red-400" /> Namma Bengaluru</span>
          </div>

        </div>
      </main>

      {/* Footer copyright */}
      <footer className="relative z-10 py-1.5 sm:py-2 text-center text-[10px] sm:text-xs text-slate-500 border-t border-slate-900 shrink-0">
        © {new Date().getFullYear()} Book Driver Anna. All rights reserved. • Serving all 28 Bengaluru assembly segments.
      </footer>

    </div>
  );
}
