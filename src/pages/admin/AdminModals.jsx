import React from 'react';
import { UserPlus, X, AlertTriangle, Check, Trash2 } from 'lucide-react';
import { SteeringWheel } from '../../components/Icons';
import { BANGALORE_AREAS } from '../../data/mockData';

export default function AdminModals({
  // Modal 1: Add Client
  isAddUserModalOpen,
  setIsAddUserModalOpen,
  newUserName,
  setNewUserName,
  newUserPhone,
  setNewUserPhone,
  newUserEmail,
  setNewUserEmail,
  newUserArea,
  setNewUserArea,
  handleAddUserSubmit,

  // Modal 2: Add Driver
  isAddDriverModalOpen,
  setIsAddDriverModalOpen,
  newDriverName,
  setNewDriverName,
  newDriverPhone,
  setNewDriverPhone,
  newDriverDl,
  setNewDriverDl,
  newDriverArea,
  setNewDriverArea,
  newDriverExperience,
  setNewDriverExperience,
  newDriverVehicleType,
  setNewDriverVehicleType,
  handleAddDriverSubmit,

  // Modal 3: Delete User Verification
  userToDelete,
  handleCloseDeleteUserModal,
  deletionReason,
  setDeletionReason,
  customDeletionReason,
  setCustomDeletionReason,
  hasNoActiveTrips,
  setHasNoActiveTrips,
  hasSettledPayments,
  setHasSettledPayments,
  understandsIrreversible,
  setUnderstandsIrreversible,
  deleteConfirmText,
  setDeleteConfirmText,
  isSecurityPhraseValid,
  canExecuteDelete,
  handleConfirmDeleteUser
}) {
  return (
    <>
      {/* ========================================================================= */}
      {/* Modal 1: Add Client Modal */}
      {/* ========================================================================= */}
      {isAddUserModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in overflow-hidden overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddUserModalOpen(false);
          }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 max-w-md w-full max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-pan-y space-y-5 shadow-2xl relative">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-bold flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-['Outfit']">Add New Client Account</h3>
                  <p className="text-[11px] text-slate-400">Directly register a client into Bangalore database</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Client Full Name *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Vikram Reddy"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Mobile Number *</label>
                <input 
                  type="tel"
                  required
                  placeholder="98765 43210"
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Email Address *</label>
                <input 
                  type="email"
                  required
                  placeholder="e.g. name@email.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Bangalore Locality *</label>
                <select
                  value={newUserArea}
                  onChange={(e) => setNewUserArea(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  {BANGALORE_AREAS.map((area, i) => (
                    <option key={i} value={area}>{area}</option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-950 border border-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-extrabold text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-md shadow-amber-400/20 cursor-pointer"
                >
                  Save & Add Client
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal 2: Add Driver Anna Modal */}
      {/* ========================================================================= */}
      {isAddDriverModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in overflow-hidden overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddDriverModalOpen(false);
          }}
        >
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-5 sm:p-8 max-w-md w-full max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-pan-y space-y-5 shadow-2xl relative">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-400 text-slate-950 font-bold flex items-center justify-center">
                  <SteeringWheel className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-['Outfit']">Add Driver Partner Anna</h3>
                  <p className="text-[11px] text-slate-400">Directly register a verified driver into fleet database</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddDriverModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDriverSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Driver Partner Full Name *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar K."
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Mobile Phone Number *</label>
                <input 
                  type="tel"
                  required
                  placeholder="+91 99001 54321"
                  value={newDriverPhone}
                  onChange={(e) => setNewDriverPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Driving License (DL) Number *</label>
                <input 
                  type="text"
                  required
                  placeholder="KA-04-2018-0098765"
                  value={newDriverDl}
                  onChange={(e) => setNewDriverDl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Primary Hub / Area</label>
                  <select
                    value={newDriverArea}
                    onChange={(e) => setNewDriverArea(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                  >
                    {BANGALORE_AREAS.map((area, idx) => (
                      <option key={idx} value={area}>{area}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Driving Experience</label>
                  <select
                    value={newDriverExperience}
                    onChange={(e) => setNewDriverExperience(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                  >
                    <option value="3-5 Years">3-5 Years</option>
                    <option value="5-8 Years">5-8 Years</option>
                    <option value="8-12 Years">8-12 Years</option>
                    <option value="12+ Years">12+ Years</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Vehicle Specialization</label>
                <select
                  value={newDriverVehicleType}
                  onChange={(e) => setNewDriverVehicleType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                >
                  <option value="Manual & Automatic Cars">Manual & Automatic Cars</option>
                  <option value="Automatic Luxury & SUVs">Automatic Luxury & SUVs</option>
                  <option value="All Cars & Heavy Sedans">All Cars & Heavy Sedans</option>
                  <option value="Electric & Automatic Cars">Electric & Automatic Cars</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddDriverModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-950 border border-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-extrabold text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-md shadow-emerald-400/20 cursor-pointer"
                >
                  Save Driver Anna
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal 3: Remove User from DB Verification Modal */}
      {/* ========================================================================= */}
      {userToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in overflow-hidden overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseDeleteUserModal();
          }}
        >
          <div 
            className="bg-slate-900 border border-red-500/40 rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl shadow-red-950/60 relative overflow-hidden overscroll-contain touch-pan-y"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header (Fixed at top) */}
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 shrink-0 bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                      Security Protocol
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white font-['Outfit'] mt-0.5">
                    {Boolean(userToDelete.dlNumber || (userToDelete.id && userToDelete.id.startsWith('DRV-'))) 
                      ? 'Remove Driver Anna from Fleet Database' 
                      : 'Remove User from Database'}
                  </h3>
                </div>
              </div>
              <button 
                onClick={handleCloseDeleteUserModal}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Modal Content Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1 custom-scrollbar">
              
              {/* Target Account Profile Summary */}
              {(() => {
                const isDriver = Boolean(userToDelete.dlNumber || (userToDelete.id && userToDelete.id.startsWith('DRV-')));
                return (
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl font-black flex items-center justify-center text-xs shrink-0 ${
                        isDriver ? 'bg-emerald-400 text-slate-950' : 'bg-amber-400 text-slate-950'
                      }`}>
                        {isDriver ? (
                          <SteeringWheel className="w-5 h-5 stroke-[2.2]" />
                        ) : (
                          userToDelete.name ? userToDelete.name.charAt(0).toUpperCase() : 'U'
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-white flex items-center gap-1.5 truncate">
                          <span className="truncate">{userToDelete.name}</span>
                          <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-900 px-1 py-0.5 rounded border border-slate-800 shrink-0">
                            {userToDelete.id}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 truncate">
                          <span className="truncate">{userToDelete.phone}</span>
                          {isDriver && userToDelete.dlNumber && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-slate-300 font-bold">{userToDelete.dlNumber}</span>
                            </>
                          )}
                          <span>•</span>
                          <span className="text-amber-400 shrink-0">{userToDelete.area || 'Bangalore'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md shrink-0">
                      {isDriver ? 'Fleet Purge' : 'Client Purge'}
                    </div>
                  </div>
                );
              })()}

              {/* Question 1: Operational Reason */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-200">
                  <span className="text-amber-400 font-extrabold mr-1">1.</span>
                  Reason for removing this {Boolean(userToDelete.dlNumber || (userToDelete.id && userToDelete.id.startsWith('DRV-'))) ? 'driver partner' : 'client'}: <span className="text-red-400">*</span>
                </label>
                <select
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="">-- Select verified reason for removal --</option>
                  {Boolean(userToDelete.dlNumber || (userToDelete.id && userToDelete.id.startsWith('DRV-'))) ? (
                    <>
                      <option value="Driver partner voluntary resignation / left the fleet">
                        Driver partner voluntary resignation / left the fleet
                      </option>
                      <option value="Driving license (DL) expired, suspended, or revoked by RTO">
                        Driving license (DL) expired, suspended, or revoked by RTO
                      </option>
                      <option value="Severe violation of driver conduct, safety guidelines, or passenger dispute">
                        Severe violation of driver conduct, safety guidelines, or passenger dispute
                      </option>
                      <option value="Failed routine background KYC verification or vehicle compliance">
                        Failed routine background KYC verification or vehicle compliance
                      </option>
                      <option value="Driver account inactivity or duplicate demo partner purge">
                        Driver account inactivity or duplicate demo partner purge
                      </option>
                      <option value="Other administrative reason (specify below)">
                        Other administrative reason (specify below)
                      </option>
                    </>
                  ) : (
                    <>
                      <option value="Formal customer deletion request (Data Privacy / Right to be Forgotten)">
                        Formal customer deletion request (Data Privacy / Right to be Forgotten)
                      </option>
                      <option value="Confirmed fraudulent activity or suspicious booking pattern">
                        Confirmed fraudulent activity or suspicious booking pattern
                      </option>
                      <option value="Severe violation of terms, safety codes, or abuse towards drivers">
                        Severe violation of terms, safety codes, or abuse towards drivers
                      </option>
                      <option value="Account delinquency or repeated non-payment of fares">
                        Account delinquency or repeated non-payment of fares
                      </option>
                      <option value="Duplicate, fake, or obsolete demo test account purge">
                        Duplicate, fake, or obsolete demo test account purge
                      </option>
                      <option value="Other administrative reason (specify below)">
                        Other administrative reason (specify below)
                      </option>
                    </>
                  )}
                </select>

                {deletionReason === 'Other administrative reason (specify below)' && (
                  <div className="mt-1.5">
                    <input
                      type="text"
                      placeholder="Please enter detailed justification (min 5 characters) *"
                      value={customDeletionReason}
                      onChange={(e) => setCustomDeletionReason(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}
              </div>

              {/* Question 2: Safety Checklist */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-200">
                  <span className="text-amber-400 font-extrabold mr-1">2.</span>
                  Audit Verification Checklist <span className="text-red-400 font-normal">(Confirm all 3)</span>:
                </label>
                
                <div className="space-y-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-[11px]">
                  
                  {/* Checkbox 1 */}
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input 
                      type="checkbox"
                      checked={hasNoActiveTrips}
                      onChange={(e) => setHasNoActiveTrips(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-red-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-red-500"
                    />
                    <div className="text-slate-300 group-hover:text-white leading-relaxed">
                      {Boolean(userToDelete.dlNumber || (userToDelete.id && userToDelete.id.startsWith('DRV-'))) ? (
                        <>
                          <strong className="text-slate-200">No Active Duties:</strong> Zero in-progress, assigned, or scheduled customer ride dispatches.
                        </>
                      ) : (
                        <>
                          <strong className="text-slate-200">No Active Trips:</strong> Zero ongoing, upcoming, or pending driver/vehicle bookings.
                        </>
                      )}
                    </div>
                  </label>

                  {/* Checkbox 2 */}
                  <label className="flex items-start gap-2.5 cursor-pointer group pt-2 border-t border-slate-800/80">
                    <input 
                      type="checkbox"
                      checked={hasSettledPayments}
                      onChange={(e) => setHasSettledPayments(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-red-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-red-500"
                    />
                    <div className="text-slate-300 group-hover:text-white leading-relaxed">
                      {Boolean(userToDelete.dlNumber || (userToDelete.id && userToDelete.id.startsWith('DRV-'))) ? (
                        <>
                          <strong className="text-slate-200">Ledger Cleared:</strong> All driver payout disbursements, trip commissions, and cash fares are 100% settled.
                        </>
                      ) : (
                        <>
                          <strong className="text-slate-200">Ledger Cleared:</strong> All invoices, driver disbursements, and platform dues are 100% settled.
                        </>
                      )}
                    </div>
                  </label>

                  {/* Checkbox 3 */}
                  <label className="flex items-start gap-2.5 cursor-pointer group pt-2 border-t border-slate-800/80">
                    <input 
                      type="checkbox"
                      checked={understandsIrreversible}
                      onChange={(e) => setUnderstandsIrreversible(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-red-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-red-500"
                    />
                    <div className="text-slate-300 group-hover:text-white leading-relaxed">
                      <strong className="text-red-400">Irreversible Action:</strong> Understand this cannot be undone and purges the {Boolean(userToDelete.dlNumber || (userToDelete.id && userToDelete.id.startsWith('DRV-'))) ? 'driver partner' : 'client'} permanently from the database.
                    </div>
                  </label>

                </div>
              </div>

              {/* Question 3: Security Phrase Confirmation */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-200">
                  <span className="text-amber-400 font-extrabold mr-1">3.</span>
                  Type <span className="font-mono bg-slate-950 text-red-400 px-1 py-0.5 rounded border border-red-500/30 font-bold">DELETE</span> or <span className="font-mono bg-slate-950 text-amber-400 px-1 py-0.5 rounded border border-amber-500/30 font-bold">{userToDelete.name}</span> to authorize: <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input 
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={`Type "DELETE" or "${userToDelete.name}"`}
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none transition-colors ${
                      isSecurityPhraseValid
                        ? 'border-emerald-500/80 bg-emerald-950/10'
                        : 'border-slate-800 focus:border-red-400'
                    }`}
                  />
                  {isSecurityPhraseValid && (
                    <span className="absolute right-2.5 top-2 text-[10px] font-extrabold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      <Check className="w-3 h-3" /> Confirmed
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer Actions (Fixed at bottom) */}
            <div className="p-4 border-t border-slate-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0 bg-slate-900">
              <button
                type="button"
                onClick={handleCloseDeleteUserModal}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer text-center"
              >
                Cancel & Retain
              </button>

              <div className="flex flex-col sm:items-end gap-0.5">
                <button
                  type="button"
                  disabled={!canExecuteDelete}
                  onClick={handleConfirmDeleteUser}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    canExecuteDelete
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {Boolean(userToDelete.dlNumber || (userToDelete.id && userToDelete.id.startsWith('DRV-'))) 
                      ? 'Permanently Purge Driver Anna' 
                      : 'Permanently Purge User'}
                  </span>
                </button>
                {!canExecuteDelete && (
                  <span className="text-[9px] text-slate-500 text-center sm:text-right">
                    Answer reason, check 3 boxes & verify phrase
                  </span>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
