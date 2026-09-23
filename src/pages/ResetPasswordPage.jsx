import React, { useState, useEffect } from 'react';
import {
  Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight,
  ShieldCheck, ArrowLeft, KeyRound
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

export default function ResetPasswordPage({ onNavigate = null }) {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('checking'); // 'checking' | 'valid' | 'invalid' | 'success'
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Read and verify token from URL query parameters on mount
  useEffect(() => {
    let rawToken = '';
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      rawToken = (searchParams.get('token') || '').trim();
    }

    if (!rawToken || rawToken.length !== 64) {
      setStatus('invalid');
      setErrorMessage('This password reset link is invalid or expired.');
      return;
    }

    setToken(rawToken);

    // Verify token validity with backend API
    let isCancelled = false;
    async function checkToken() {
      try {
        const res = await apiClient.verifyResetToken(rawToken);
        if (isCancelled) return;

        if (res && res.valid) {
          setStatus('valid');
        } else {
          setStatus('invalid');
          setErrorMessage(res?.message || 'This password reset link is invalid or expired.');
        }
      } catch (err) {
        if (isCancelled) return;
        setStatus('invalid');
        setErrorMessage(err.message || 'This password reset link is invalid or expired.');
      }
    }

    checkToken();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleNavigate = (page) => {
    if (onNavigate) {
      onNavigate(page);
    } else if (typeof window !== 'undefined') {
      const targetUrl = page === 'forgot-password' ? '/forgot-password' : (page === 'login' ? '/login' : '/');
      window.history.pushState({}, '', targetUrl);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // UX Validations
    if (!password || password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.resetPassword(token, password);
      setStatus('success');
      setSuccessMessage(res?.message || 'Your password has been reset successfully.');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden select-none">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-amber-400/5 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Account Security</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] tracking-tight">
            Book Driver Anna
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Professional Chauffeur & Driver Services, Bengaluru
          </p>
        </div>

        {/* Card Box */}
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl">
          {/* =========================================================================
              STATE 1: CHECKING TOKEN
             ========================================================================= */}
          {status === 'checking' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 border-3 border-amber-400/20 border-t-amber-400 rounded-full animate-spin" />
              <div>
                <h3 className="text-base font-bold text-white">Checking reset link...</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Verifying your secure password reset credentials
                </p>
              </div>
            </div>
          )}

          {/* =========================================================================
              STATE 2: INVALID OR EXPIRED TOKEN
             ========================================================================= */}
          {status === 'invalid' && (
            <div className="py-4 text-center space-y-4 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Reset Link Invalid
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
                  {errorMessage || 'This password reset link is invalid or expired.'}
                </p>
              </div>

              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  onClick={() => handleNavigate('forgot-password')}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Request New Reset Link</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('login')}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Login</span>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              STATE 3: VALID TOKEN - ENTER NEW PASSWORD
             ========================================================================= */}
          {status === 'valid' && (
            <form onSubmit={handleResetSubmit} className="space-y-4" autoComplete="off">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Reset your password
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Choose a new strong password for your account (minimum 8 characters).
                </p>
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* New Password */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  New Password *
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

              {/* Confirm New Password */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer mt-3 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Updating password...</span>
                  </>
                ) : (
                  <>
                    <span>Reset Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => handleNavigate('login')}
                  className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Remembered your credentials? <span className="text-amber-400 font-semibold underline">Back to login</span>
                </button>
              </div>
            </form>
          )}

          {/* =========================================================================
              STATE 4: PASSWORD RESET SUCCESSFUL
             ========================================================================= */}
          {status === 'success' && (
            <div className="py-4 text-center space-y-4 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Password Reset Complete
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xs mx-auto leading-relaxed">
                  {successMessage || 'Your password has been reset successfully.'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  You can now log in using your new password.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleNavigate('login')}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Log In with New Password</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Security Trust Badges */}
        <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-slate-500">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400/80" />
            <span>End-to-End Encrypted</span>
          </div>
          <span>•</span>
          <span>Single-Use Token</span>
          <span>•</span>
          <span>15-Minute Expiry</span>
        </div>
      </div>
    </div>
  );
}
