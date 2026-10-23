import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Clock, 
  CreditCard, Smartphone, Building, X, ArrowRight, Loader2
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

export default function DummyRazorpayModal({
  isOpen,
  token,
  orderData,
  onClose,
  onPaymentSuccess,
  onPaymentFailure,
  onPaymentPending
}) {
  const [selectedMethod, setSelectedMethod] = useState('upi');
  const [processingOutcome, setProcessingOutcome] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [pendingNotice, setPendingNotice] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedMethod('upi');
      setProcessingOutcome(null);
      setErrorNotice(null);
      setPendingNotice(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !processingOutcome) {
        handleCancel();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, processingOutcome]);

  if (!isOpen || !orderData) return null;

  const handleSimulateOutcome = async (outcome, failureReason = null) => {
    if (processingOutcome) return;
    setProcessingOutcome(outcome);
    setErrorNotice(null);
    setPendingNotice(null);

    try {
      const response = await apiClient.simulateGuestPaymentOutcome({
        token,
        attemptId: orderData.attemptId,
        orderId: orderData.orderId,
        outcome,
        paymentMethod: selectedMethod,
        failureReason: failureReason || (outcome === 'failure' ? 'DECLINED' : null)
      });

      if (response?.success && response?.data) {
        const result = response.data;
        if (result.status === 'SUCCEEDED' && result.isPaid) {
          if (onPaymentSuccess) onPaymentSuccess(result);
        } else if (result.status === 'FAILED') {
          setErrorNotice('Simulated Bank Decline: Transaction was not authorized by the simulated bank.');
          if (onPaymentFailure) onPaymentFailure(result);
        } else if (result.status === 'PENDING') {
          setPendingNotice('Simulated Gateway Timeout: Bank response is pending verification.');
          if (onPaymentPending) onPaymentPending(result);
        } else if (result.status === 'CANCELLED') {
          if (result.code === 'BOOKING_ALREADY_PAID') {
            setErrorNotice('Notice: This booking was already settled by another transaction.');
          }
          if (onClose) onClose();
        }
      } else {
        setErrorNotice(response?.error?.message || 'Simulation request encountered an error.');
      }
    } catch (err) {
      setErrorNotice(err?.message || 'Failed to simulate payment outcome.');
    } finally {
      setProcessingOutcome(null);
    }
  };

  const handleCancel = async () => {
    if (processingOutcome) return;
    try {
      await apiClient.simulateGuestPaymentOutcome({
        token,
        attemptId: orderData.attemptId,
        orderId: orderData.orderId,
        outcome: 'cancel',
        paymentMethod: selectedMethod
      }).catch(() => {});
    } finally {
      if (onClose) onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-test-title"
      >
        {/* Header Banner */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span id="modal-test-title">Test Mode Simulator</span>
          </div>
          <button
            onClick={handleCancel}
            disabled={Boolean(processingOutcome)}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Close test payment modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notice Sub-Banner */}
        <div className="bg-slate-950/90 border-b border-slate-800/80 px-5 py-2.5 text-[11px] text-amber-300/90 leading-tight">
          ⚠ Simulated testing environment. No real payment gateway is contacted, and no real money is charged.
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Booking & Fare Info */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Authoritative Total Fare</span>
              <p className="text-2xl font-extrabold font-['Outfit'] text-amber-400">
                ₹{Number(orderData.amount).toFixed(2)}
              </p>
            </div>
            <div className="text-right text-[11px] text-slate-400">
              <span className="text-slate-500 block">Booking ID</span>
              <span className="font-semibold text-slate-300">{orderData.bookingId}</span>
            </div>
          </div>

          {/* Instrument Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              Select Simulated Payment Instrument:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedMethod('upi')}
                disabled={Boolean(processingOutcome)}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  selectedMethod === 'upi'
                    ? 'bg-amber-400/10 border-amber-400 text-amber-300 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span className="text-[11px] font-bold">UPI</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('card')}
                disabled={Boolean(processingOutcome)}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  selectedMethod === 'card'
                    ? 'bg-amber-400/10 border-amber-400 text-amber-300 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span className="text-[11px] font-bold">Card</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('netbanking')}
                disabled={Boolean(processingOutcome)}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  selectedMethod === 'netbanking'
                    ? 'bg-amber-400/10 border-amber-400 text-amber-300 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Building className="w-4 h-4" />
                <span className="text-[11px] font-bold">Netbanking</span>
              </button>
            </div>
          </div>

          {/* Feedback Badges */}
          {errorNotice && (
            <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3 flex items-start gap-2.5 text-rose-300 text-xs">
              <XCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorNotice}</span>
            </div>
          )}

          {pendingNotice && (
            <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3 flex items-start gap-2.5 text-amber-300 text-xs">
              <Clock className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>{pendingNotice}</span>
            </div>
          )}

          {/* Action Simulation Triggers */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
              Trigger Simulated Checkout Outcome:
            </span>

            <button
              type="button"
              onClick={() => handleSimulateOutcome('success')}
              disabled={Boolean(processingOutcome)}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 disabled:opacity-50"
            >
              {processingOutcome === 'success' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Simulated Settlement...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simulate Payment Success (Authorize ₹{Number(orderData.amount).toFixed(2)})</span>
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleSimulateOutcome('failure', 'INSUFFICIENT_FUNDS')}
                disabled={Boolean(processingOutcome)}
                className="py-2.5 px-3 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Simulate Decline</span>
              </button>

              <button
                type="button"
                onClick={() => handleSimulateOutcome('timeout')}
                disabled={Boolean(processingOutcome)}
                className="py-2.5 px-3 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 text-amber-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Simulate Timeout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950/80 px-6 py-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted Token Access</span>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={Boolean(processingOutcome)}
            className="text-slate-400 hover:text-slate-200 underline font-medium cursor-pointer disabled:opacity-40"
          >
            Cancel and Return
          </button>
        </div>
      </div>
    </div>
  );
}
