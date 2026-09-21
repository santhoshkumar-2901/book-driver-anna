import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Clock, KeyRound } from 'lucide-react';
import { apiClient } from '../services/apiClient';

export default function ResetPasswordPage({ onNavigateLogin, onNavigateHome }) {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(null); // null | true | false
  const [tokenErrorReason, setTokenErrorReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Extract token from URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawToken = params.get('token');

    if (!rawToken || !rawToken.trim()) {
      setIsVerifying(false);
      setTokenValid(false);
      setTokenErrorReason('No password reset token was provided in the link. Please request a new link.');
      return;
    }

    const cleanToken = rawToken.trim();
    setToken(cleanToken);

    // Verify token validity with backend
    async function verify() {
      try {
        const res = await apiClient.verifyResetToken(cleanToken);
        if (res && res.data && res.data.valid) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
          setTokenErrorReason(res?.data?.reason || 'This password reset link is invalid or has expired.');
        }
      } catch (err) {
        // Even if offline/network error, allow submission attempts if token seems plausible
        if (err.code === 'NETWORK_ERROR') {
          setTokenValid(true);
        } else {
          setTokenValid(false);
          setTokenErrorReason(err.message || 'Unable to verify reset link.');
        }
      } finally {
        setIsVerifying(false);
      }
    }

    verify();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!newPassword || newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.resetPassword({
        token,
        newPassword
      });

      setIsSuccess(true);
      // Auto redirect to login after 3 seconds
      setTimeout(() => {
        if (onNavigateLogin) {
          onNavigateLogin();
        } else {
          window.location.href = '/login';
        }
      }, 3000);
    } catch (err) {
      if (err.status === 429) {
        setErrorMessage('Too many password reset attempts. Please try again in 15 minutes.');
      } else if (err.code === 'TOKEN_ALREADY_USED') {
        setErrorMessage('This password reset link has already been used. Please request a new one.');
        setTokenValid(false);
      } else if (err.code === 'TOKEN_EXPIRED') {
        setErrorMessage('This reset link has expired (15-minute validity limit). Please request a new one.');
        setTokenValid(false);
      } else {
        setErrorMessage(err.message || 'Unable to reset password. Please try again or request a new reset link.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md my-auto relative z-10">
        <div className="bg-slate-900/95 border border-slate-800 hover:border-amber-500/40 rounded-2xl sm:rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl transition-all">
          
          {/* Brand Logo & Tagline */}
          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 mb-2">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">
              Set New Password
            </h1>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              Create a strong, secure password of at least 8 characters for your Book Driver Anna account.
            </p>
          </div>

          {/* Loading / Verifying State */}
          {isVerifying ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Verifying security token...</p>
            </div>
          ) : isSuccess ? (
            /* Success State */
            <div className="text-center py-4 space-y-4 animate-in fade-in">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-white font-['Outfit']">
                Password Successfully Changed
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                Your account password has been updated. All previous sessions have been invalidated for your safety.
              </p>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => onNavigateLogin ? onNavigateLogin() : (window.location.href = '/login')}
                  className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Proceed to Login</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : tokenValid === false ? (
            /* Invalid / Expired Token State */
            <div className="text-center py-4 space-y-4 animate-in fade-in">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-black text-white font-['Outfit']">
                Invalid or Expired Link
              </h2>
              <p className="text-xs text-red-300/90 leading-relaxed max-w-xs mx-auto">
                {tokenErrorReason || 'This password reset link is invalid, has already been used, or has expired after 15 minutes.'}
              </p>
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => onNavigateLogin ? onNavigateLogin() : (window.location.href = '/login')}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  Request a New Reset Link
                </button>
                {onNavigateHome && (
                  <button
                    type="button"
                    onClick={onNavigateHome}
                    className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Return to Homepage
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Reset Password Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  New Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="Min 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Confirm New Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                  />
                </div>
              </div>

              {/* Password Requirement Notes */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Security Requirements:</span>
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
                  <li className={newPassword.length >= 8 ? 'text-emerald-400 font-medium' : ''}>
                    At least 8 characters in length
                  </li>
                  <li className={newPassword && newPassword === confirmPassword ? 'text-emerald-400 font-medium' : ''}>
                    Passwords must match exactly
                  </li>
                </ul>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Updating password...</span>
                ) : (
                  <>
                    <span>Reset Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => onNavigateLogin ? onNavigateLogin() : (window.location.href = '/login')}
                  className="text-xs text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  ← Back to Login
                </button>
              </div>
            </form>
          )}

          {/* Micro Trust Indicators */}
          <div className="pt-4 mt-6 border-t border-slate-800/80 flex items-center justify-center gap-4 text-[11px] text-slate-400 font-semibold">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> End-to-End Encrypted</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-400" /> 15-Minute Link TTL</span>
          </div>

        </div>
      </div>
    </div>
  );
}
