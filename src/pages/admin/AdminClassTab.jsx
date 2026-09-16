import React from 'react';
import { 
  GraduationCap, Search, Filter, Phone, Mail, Ban, MapPin, User 
} from 'lucide-react';
import { WhatsAppIcon } from '../../components/Icons';
import { toDDMMYYYY } from '../../utils/dateUtils';

export default function AdminClassTab({
  setIsAdminEnrollmentModalOpen,
  classSearchQuery,
  setClassSearchQuery,
  classStatusFilter,
  setClassStatusFilter,
  filteredClassEnrollments,
  classEnrollments,
  instructorInputState,
  handleInstructorInputChange,
  handleUpdateClassStatus,
  sendWhatsAppToCandidate
}) {
  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-6 min-w-0">
        <div>
          <span className="bg-purple-500/10 text-purple-400 text-xs font-bold px-3 py-1 rounded-full border border-purple-500/20 uppercase tracking-wider">
            Academy Operations
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-['Outfit'] mt-2 flex items-center gap-2.5 sm:gap-3">
            <GraduationCap className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400 shrink-0" />
            <span>Driving Class Enrollments</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Manage student admissions, verify Learner's / Driving license statuses, assign certified instructor Annas, and dispatch WhatsApp confirmations.
          </p>
        </div>

        {/* Action Button: Enroll New Student */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAdminEnrollmentModalOpen(true)}
            className="py-2.5 sm:py-3 px-4 sm:px-5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-400/20 transition-all flex items-center gap-2 w-full sm:w-auto justify-center cursor-pointer"
          >
            <GraduationCap className="w-4 h-4" />
            <span>+ Enroll New Student</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4 min-w-0">
        {/* Search Bar */}
        <div className="relative w-full lg:w-80 xl:w-96 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Search by student name, phone, ref id, area..."
            value={classSearchQuery}
            onChange={(e) => setClassSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl sm:rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar min-w-0">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1 shrink-0 mr-1">
            <Filter className="w-3 h-3 text-amber-400" /> Filter:
          </span>
          {['All', 'Pending', 'In Training', 'Completed', 'Cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => setClassStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 whitespace-nowrap flex-1 sm:flex-initial text-center ${
                classStatusFilter === st
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Enrollments Count */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1 min-w-0">
        <span>Showing <span className="text-white font-bold">{filteredClassEnrollments.length}</span> enrollments</span>
        <span>Total Admissions: <span className="text-amber-400 font-bold">{classEnrollments.length}</span></span>
      </div>

      {/* Enrollment Cards List */}
      {filteredClassEnrollments.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-white text-base">No driving class enrollments found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No matching student enrollment records. Click below to add an enrollment.
          </p>
          <button
            onClick={() => setIsAdminEnrollmentModalOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-amber-400 text-slate-950 font-extrabold text-xs inline-flex items-center gap-2 mt-2 cursor-pointer"
          >
            <GraduationCap className="w-4 h-4" /> Enroll New Student
          </button>
        </div>
      ) : (
        <div className="space-y-4 min-w-0">
          {filteredClassEnrollments.map((enr) => (
            <div key={enr.enrollmentId} className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 sm:space-y-5 min-w-0 overflow-hidden">
              
              {/* Top Row: Candidate Name, ID, Phone, Status Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-extrabold text-base text-white truncate min-w-0">{enr.fullName}</span>
                      <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20 shrink-0">
                        {enr.enrollmentId}
                      </span>
                      {enr.gender && (
                        <span className="text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded shrink-0">
                          {enr.gender}
                        </span>
                      )}
                      {enr.dateOfBirth && (
                        <span className="text-[11px] text-slate-400 shrink-0">
                          DOB: <span className="text-slate-300 font-semibold">{toDDMMYYYY(enr.dateOfBirth)}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-3 mt-1 flex-wrap min-w-0">
                      <a href={`tel:${enr.mobileNumber}`} className="flex items-center gap-1 hover:text-white transition-colors">
                        <Phone className="w-3 h-3 text-emerald-400 shrink-0" /> +91 {enr.mobileNumber}
                      </a>
                      {enr.emailAddress && (
                        <span className="flex items-center gap-1 text-slate-400 truncate min-w-0">
                          <Mail className="w-3 h-3 text-amber-400 shrink-0" /> <span className="truncate">{enr.emailAddress}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60 shrink-0 w-full sm:w-auto">
                  <span className={`text-xs font-black px-3 py-1 rounded-full shrink-0 ${
                    enr.status === 'Cancelled'
                      ? 'bg-red-600 text-white border border-red-500 shadow-md shadow-red-600/30'
                      : enr.status === 'Pending' 
                      ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' 
                      : enr.status === 'In Training'
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    ● {enr.status || 'Pending'}
                  </span>
                </div>
              </div>

              {/* Cancelled Alert Banner if class enrollment status is Cancelled */}
              {enr.status === 'Cancelled' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-red-300 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Ban className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="min-w-0">
                      <strong className="text-red-400">Class Enrollment Cancelled:</strong> {enr.cancelReason ? `"${enr.cancelReason}"` : 'Admission cancelled with zero penalty'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800 shrink-0 self-start sm:self-auto">Seat Released</span>
                </div>
              )}

              {/* Middle Grid: License status, Driving Info, Class Preferences */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-xs min-w-0">
                
                {/* Card 1: Experience & Gear */}
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1 min-w-0 overflow-hidden">
                  <div className="text-slate-400 font-bold uppercase text-[10px] truncate">Training Preferences</div>
                  <div className="font-extrabold text-white text-sm truncate">
                    {enr.gearPreference} Transmission
                  </div>
                  <div className="text-amber-400 font-semibold truncate">
                    Experience: {enr.drivingExperience}
                  </div>
                </div>

                {/* Card 2: License Checks */}
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1.5 min-w-0 overflow-hidden">
                  <div className="text-slate-400 font-bold uppercase text-[10px] truncate">License Verifications</div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Learner's License:</span>
                    <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      enr.learnersLicenseStatus === 'Yes' 
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-slate-800 text-slate-300'
                    }`}>
                      {enr.learnersLicenseStatus || 'No'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Driving License:</span>
                    <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      enr.drivingLicenseStatus === 'Yes' 
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-slate-800 text-slate-300'
                    }`}>
                      {enr.drivingLicenseStatus || 'No'}
                    </span>
                  </div>
                </div>

                {/* Card 3: Batch Schedule & Pickup */}
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1 sm:col-span-2 lg:col-span-1 min-w-0 overflow-hidden">
                  <div className="text-slate-400 font-bold uppercase text-[10px] truncate">Schedule & Doorstep Pickup</div>
                  <div className="font-semibold text-white truncate">
                    Start: {toDDMMYYYY(enr.preferredStartDate)}
                  </div>
                  <div className="text-amber-400 font-semibold truncate">
                    Slot: {enr.preferredTime}
                  </div>
                  <div className="text-slate-300 truncate">
                    Pickup: {enr.pickupRequired === 'Yes' ? `Yes (${enr.pickupLocation || 'Specified'})` : 'No (Center)'}
                  </div>
                </div>

              </div>

              {/* Address & Additional Notes info */}
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-400 min-w-0">
                <div className="flex items-center gap-1.5 truncate min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-slate-300 font-semibold shrink-0">Address:</span>
                  <span className="truncate min-w-0">{enr.address}</span>
                </div>
                {enr.additionalNotes && (
                  <div className="text-slate-400 text-[11px] italic shrink-0">
                    Notes: "{enr.additionalNotes}"
                  </div>
                )}
              </div>

              {/* Instructor Inputs & Action Controls */}
              <div className="pt-2 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 border-t border-slate-800/80 min-w-0">
                
                {/* 2 Input Boxes Typed by Admin for Instructor Name & Instructor Phone Number */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:w-auto min-w-0">
                  <div className="relative w-full sm:w-44 min-w-0">
                    <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text"
                      placeholder="Instructor Name"
                      value={instructorInputState[enr.enrollmentId]?.name ?? (enr.assignedInstructor || '')}
                      onChange={(e) => handleInstructorInputChange(enr.enrollmentId, 'name', e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-xs font-semibold text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-amber-400 w-full"
                    />
                  </div>
                  <div className="relative w-full sm:w-36 min-w-0">
                    <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text"
                      placeholder="Instructor Phone"
                      value={instructorInputState[enr.enrollmentId]?.phone ?? (enr.assignedInstructorPhone || '')}
                      onChange={(e) => handleInstructorInputChange(enr.enrollmentId, 'phone', e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-xs font-semibold text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-amber-400 w-full"
                    />
                  </div>
                </div>

                {/* Status Toggles: Pending, In Training, Completed, Cancelled & WhatsApp Action */}
                <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start sm:justify-end">
                  {enr.status === 'Cancelled' ? (
                    <>
                      <span className="px-3.5 py-2 rounded-xl text-xs font-black bg-red-600 text-white border border-red-500 shadow-md shadow-red-600/30 flex items-center gap-1.5 shrink-0">
                        <Ban className="w-3.5 h-3.5" />
                        <span>Cancelled</span>
                      </span>

                      {/* Send WhatsApp Cancellation directly to Candidate */}
                      <button
                        onClick={() => sendWhatsAppToCandidate(enr)}
                        className="text-xs font-extrabold px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all border bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40 border-red-400/40 cursor-pointer w-full sm:w-auto justify-center shrink-0"
                        title="Send official cancellation update to client via WhatsApp"
                      >
                        <WhatsAppIcon className="w-4 h-4 fill-current" />
                        <span>WhatsApp to Client</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleUpdateClassStatus(enr.enrollmentId, 'Pending')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex-1 sm:flex-initial text-center ${
                          enr.status === 'Pending' 
                          ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-400/20' 
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        Pending
                      </button>
                      <button
                        onClick={() => handleUpdateClassStatus(enr.enrollmentId, 'In Training')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex-1 sm:flex-initial text-center ${
                          enr.status === 'In Training' 
                          ? 'bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-500/20' 
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        In Training
                      </button>
                      <button
                        onClick={() => handleUpdateClassStatus(enr.enrollmentId, 'Completed')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex-1 sm:flex-initial text-center ${
                          enr.status === 'Completed' 
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20' 
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        Completed
                      </button>
                      <button
                        onClick={() => handleUpdateClassStatus(enr.enrollmentId, 'Cancelled')}
                        className="px-3 py-2 rounded-xl text-xs font-bold border transition-colors bg-slate-950 text-slate-400 border-slate-800 hover:text-red-400 hover:border-red-500/40 cursor-pointer flex-1 sm:flex-initial text-center"
                      >
                        Cancel
                      </button>

                      {/* Send WhatsApp Confirmation directly to Candidate */}
                      <button
                        onClick={() => sendWhatsAppToCandidate(enr)}
                        disabled={enr.status === 'Pending'}
                        className={`text-xs font-extrabold px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all border w-full sm:w-auto justify-center shrink-0 ${
                          enr.status === 'Pending'
                            ? 'bg-slate-950 text-slate-600 border-slate-800/80 cursor-not-allowed opacity-50'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 border-emerald-400/40 cursor-pointer'
                        }`}
                        title={
                          enr.status === 'Pending'
                            ? "Please set status to 'In Training' or 'Completed' first before sending WhatsApp message to client"
                            : "Send official training update to client via WhatsApp"
                        }
                      >
                        <WhatsAppIcon className="w-4 h-4 fill-current" />
                        <span>WhatsApp to Client</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
