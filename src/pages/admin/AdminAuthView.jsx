import React from 'react';
import { 
  Car, ShieldCheck, AlertCircle, User, Phone, Mail, Lock, Eye, EyeOff, Key, ArrowRight 
} from 'lucide-react';

export default function AdminAuthView({
  authMode,
  setAuthMode,
  isAuthSubmitting = false,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  showPassword,
  setShowPassword,
  authFullName,
  setAuthFullName,
  authPhone,
  setAuthPhone,
  authSecretKey,
  setAuthSecretKey,
  authError,
  authFormSeed,
  inputsUnlocked,
  setInputsUnlocked,
  authFullNameRef,
  authPhoneRef,
  authEmailRef,
  authPasswordRef,
  authSecretKeyRef,
  handleAuthSubmit,
  resetAuthForm,
  onReturnToClient
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-3.5 sm:p-6 lg:p-8 relative overflow-x-hidden overflow-y-auto">
      
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar with Search Bar Address Display */}
      <header className="max-w-5xl mx-auto w-full flex flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-400/20 shrink-0">
            <Car className="w-6 h-6 stroke-[2.2]" />
          </div>
          <span className="font-extrabold text-lg sm:text-xl text-white font-['Outfit']">
            Book Driver <span className="text-amber-400">Anna</span>
          </span>
        </div>

        <button 
          onClick={onReturnToClient}
          className="text-xs text-slate-400 hover:text-white font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
        >
          Client Site <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
        </button>
      </header>

      {/* Center Admin Authentication Card */}
      <div className="max-w-md mx-auto w-full my-auto py-6 sm:py-8 relative z-10">
        
        <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl space-y-5 sm:space-y-6">
          
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
              onClick={() => { setAuthMode('login'); resetAuthForm(); }}
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
              onClick={() => { setAuthMode('register'); resetAuthForm(); }}
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
          <form onSubmit={handleAuthSubmit} className="space-y-4" autoComplete="off" key={`auth-form-${authFormSeed}`}>
            
            {/* Invisible decoy fields to absorb aggressive browser autofill */}
            <div style={{ position: 'absolute', opacity: 0, height: 0, width: 0, zIndex: -1, overflow: 'hidden' }} tabIndex="-1" aria-hidden="true">
              <input type="text" name="bda_decoy_user_field" tabIndex="-1" autoComplete="off" />
              <input type="password" name="bda_decoy_pass_field" tabIndex="-1" autoComplete="new-password" />
            </div>

            {authMode === 'register' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Full Name *</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input 
                      ref={authFullNameRef}
                      type="text"
                      required
                      name={`bda_adm_name_${authFormSeed}`}
                      autoComplete="off"
                      readOnly={!inputsUnlocked}
                      onFocus={() => setInputsUnlocked(true)}
                      onClick={() => setInputsUnlocked(true)}
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
                      ref={authPhoneRef}
                      type="tel"
                      required
                      name={`bda_adm_phone_${authFormSeed}`}
                      autoComplete="off"
                      readOnly={!inputsUnlocked}
                      onFocus={() => setInputsUnlocked(true)}
                      onClick={() => setInputsUnlocked(true)}
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
                  ref={authEmailRef}
                  type="email"
                  required
                  name={`bda_adm_id_${authFormSeed}`}
                  autoComplete="one-time-code"
                  readOnly={!inputsUnlocked}
                  onFocus={() => setInputsUnlocked(true)}
                  onClick={() => setInputsUnlocked(true)}
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
                  ref={authPasswordRef}
                  type={showPassword ? 'text' : 'password'}
                  required
                  name={`bda_adm_sec_${authFormSeed}`}
                  autoComplete="new-password"
                  readOnly={!inputsUnlocked}
                  onFocus={() => setInputsUnlocked(true)}
                  onClick={() => setInputsUnlocked(true)}
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
                    ref={authSecretKeyRef}
                    type="text"
                    required
                    name={`bda_adm_code_${authFormSeed}`}
                    autoComplete="off"
                    readOnly={!inputsUnlocked}
                    onFocus={() => setInputsUnlocked(true)}
                    onClick={() => setInputsUnlocked(true)}
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
              disabled={isAuthSubmitting}
              className="w-full py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-400/20 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-50"
            >
              {isAuthSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>{authMode === 'login' ? 'Signing In...' : 'Registering Admin...'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{authMode === 'login' ? 'Enter Admin Dashboard' : 'Complete Admin Registration'}</span>
                </>
              )}
            </button>

          </form>

          {/* Quick Demo Credentials Footer */}
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 min-w-0">
            <span className="truncate min-w-0">💡 Demo: <span className="text-white font-semibold">admin@bookdriveranna.com</span> / <span className="text-white font-semibold">admin123</span></span>
            <button
              type="button"
              onClick={() => {
                setInputsUnlocked(true);
                setAuthEmail('admin@bookdriveranna.com');
                setAuthPassword('admin123');
                if (authMode === 'register') {
                  setAuthFullName('Admin Anna');
                  setAuthPhone('+91 98765 00000');
                  setAuthSecretKey('ANNA2026');
                }
              }}
              className="text-amber-400 hover:text-amber-300 font-bold underline shrink-0 cursor-pointer self-end sm:self-auto"
            >
              Auto-fill
            </button>
          </div>

        </div>

      </div>

      {/* Page Footer */}
      <footer className="text-center text-xs text-slate-500 relative z-10 py-2">
        © {new Date().getFullYear()} Book Driver Anna Technologies. Admin Security Portal.
      </footer>

    </div>
  );
}
