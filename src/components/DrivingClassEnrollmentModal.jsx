import React, { useState, useEffect } from 'react';
import { 
  X, User, Calendar, Phone, Mail, MapPin, 
  Clock, CheckCircle2, AlertCircle, ShieldCheck, ArrowRight, Navigation, FileCheck, Ban
} from 'lucide-react';
import { SteeringWheel } from './Icons';
import DateInput from './DateInput';
import { toDDMMYYYY, toYYYYMMDD } from '../utils/dateUtils';
import { useScrollLock } from '../utils/useScrollLock';

export default function DrivingClassEnrollmentModal({ isOpen, onClose, onEnrollmentSuccess, initialData = {} }) {
  useScrollLock(isOpen);
  // 1. Personal Information State
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [address, setAddress] = useState('');

  // 2. Driving Information State
  const [drivingExperience, setDrivingExperience] = useState('');
  const [gearPreference, setGearPreference] = useState('');
  const [learnersLicenseStatus, setLearnersLicenseStatus] = useState('');
  const [drivingLicenseStatus, setDrivingLicenseStatus] = useState('');

  // 3. Class Preferences State
  const [preferredStartDate, setPreferredStartDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [pickupRequired, setPickupRequired] = useState('No'); // 'Yes' or 'No'
  const [pickupLocation, setPickupLocation] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // 4. Confirmation Checkboxes State
  const [confirmInformation, setConfirmInformation] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // UI / Status State
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEnrollment, setSubmittedEnrollment] = useState(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('Change of personal schedule / timing conflict');
  const [cancelCustomNotes, setCancelCustomNotes] = useState('');

  // Calculate today / minimum date limits for date pickers
  const todayStr = new Date().toISOString().split('T')[0];
  // Minimum 16 years old for driving school enrollment
  const maxDobStr = new Date(Date.now() - 16 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Pre-fill initial data if passed
  useEffect(() => {
    if (isOpen) {
      if (initialData.gearPreference) setGearPreference(initialData.gearPreference);
      if (initialData.preferredTime) setPreferredTime(initialData.preferredTime);
      setIsSubmitted(false);
      setErrors({});
    }
  }, [isOpen, initialData]);

  // Reset form
  const resetForm = () => {
    setFullName('');
    setDateOfBirth('');
    setGender('');
    setMobileNumber('');
    setEmailAddress('');
    setAddress('');
    setDrivingExperience('');
    setGearPreference('');
    setLearnersLicenseStatus('');
    setDrivingLicenseStatus('');
    setPreferredStartDate('');
    setPreferredTime('');
    setPickupRequired('No');
    setPickupLocation('');
    setAdditionalNotes('');
    setConfirmInformation(false);
    setAgreeTerms(false);
    setErrors({});
    setIsSubmitted(false);
    setSubmittedEnrollment(null);
    setIsCancelled(false);
    setShowCancelPrompt(false);
    setCancelReason('Change of personal schedule / timing conflict');
    setCancelCustomNotes('');
  };

  const handleCancelEnrollment = () => {
    if (!submittedEnrollment) return;
    const finalReason = cancelCustomNotes.trim() 
      ? `${cancelReason} (${cancelCustomNotes.trim()})` 
      : cancelReason;

    try {
      const existing = JSON.parse(localStorage.getItem('bda_class_enrollments') || '[]');
      const updated = existing.map(e => e.enrollmentId === submittedEnrollment.enrollmentId 
        ? { ...e, status: 'Cancelled', cancelReason: finalReason } 
        : e);
      localStorage.setItem('bda_class_enrollments', JSON.stringify(updated));

      const driverBookings = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
      const updatedDriverBookings = driverBookings.map(b => b.id === submittedEnrollment.enrollmentId 
        ? { ...b, status: 'Cancelled', cancelReason: finalReason } 
        : b);
      localStorage.setItem('bda_driver_bookings', JSON.stringify(updatedDriverBookings));

      window.dispatchEvent(new CustomEvent('bda_order_created'));
      window.dispatchEvent(new CustomEvent('bda_booking_updated'));
    } catch (e) {
      console.error(e);
    }

    setIsCancelled(true);
    setShowCancelPrompt(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Comprehensive Form Validation
  const validateForm = () => {
    const newErrors = {};

    // 1. Personal Information
    if (!fullName.trim()) {
      newErrors.fullName = 'Full Name is required';
    } else if (fullName.trim().length < 3) {
      newErrors.fullName = 'Please enter your complete legal name';
    }

    if (!dateOfBirth || !dateOfBirth.trim()) {
      newErrors.dateOfBirth = 'Date of Birth (DD/MM/YYYY) is required';
    } else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateOfBirth.trim())) {
      newErrors.dateOfBirth = 'Please enter date in DD/MM/YYYY format';
    } else {
      const [dd, mm, yyyy] = dateOfBirth.split('/').map(Number);
      const dobDate = new Date(yyyy, mm - 1, dd);
      const isValid = dobDate.getFullYear() === yyyy && dobDate.getMonth() === (mm - 1) && dobDate.getDate() === dd;
      if (!isValid || yyyy < 1920 || dobDate > new Date()) {
        newErrors.dateOfBirth = 'Please enter a valid calendar date';
      } else {
        const ageYears = (new Date() - dobDate) / (365.25 * 24 * 60 * 60 * 1000);
        if (ageYears < 16) {
          newErrors.dateOfBirth = 'Must be at least 16 years of age to enroll';
        }
      }
    }

    if (!gender) {
      newErrors.gender = 'Please select your gender';
    }

    const cleanPhone = mobileNumber.replace(/[^0-9]/g, '');
    if (!mobileNumber.trim()) {
      newErrors.mobileNumber = 'Mobile Number is required';
    } else if (cleanPhone.length !== 10) {
      newErrors.mobileNumber = 'Please enter a valid 10-digit mobile number';
    }

    if (emailAddress.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim())) {
      newErrors.emailAddress = 'Please enter a valid email address';
    }

    if (!address.trim()) {
      newErrors.address = 'Residential address is required';
    } else if (address.trim().length < 8) {
      newErrors.address = 'Please enter your complete residential address';
    }

    // 2. Driving Information
    if (!drivingExperience) {
      newErrors.drivingExperience = 'Please select your current driving experience level';
    }

    if (!gearPreference) {
      newErrors.gearPreference = 'Please select your gear transmission preference';
    }

    if (!learnersLicenseStatus) {
      newErrors.learnersLicenseStatus = "Please select whether you have a Learner's License";
    }

    if (!drivingLicenseStatus) {
      newErrors.drivingLicenseStatus = 'Please select whether you have a Driving License';
    }

    // 3. Class Preferences
    if (!preferredStartDate || !preferredStartDate.trim()) {
      newErrors.preferredStartDate = 'Preferred Start Date (DD/MM/YYYY) is required';
    } else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(preferredStartDate.trim())) {
      newErrors.preferredStartDate = 'Please enter date in DD/MM/YYYY format';
    } else {
      const [dd, mm, yyyy] = preferredStartDate.split('/').map(Number);
      const startDateObj = new Date(yyyy, mm - 1, dd);
      const isValid = startDateObj.getFullYear() === yyyy && startDateObj.getMonth() === (mm - 1) && startDateObj.getDate() === dd;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (!isValid) {
        newErrors.preferredStartDate = 'Please enter a valid calendar date';
      } else if (startDateObj < today) {
        newErrors.preferredStartDate = 'Preferred start date cannot be in the past';
      }
    }

    if (!preferredTime) {
      newErrors.preferredTime = 'Please select your preferred daily time slot';
    }

    if (!pickupRequired) {
      newErrors.pickupRequired = 'Please specify if pickup is required';
    }

    if (pickupRequired === 'Yes' && !pickupLocation.trim()) {
      newErrors.pickupLocation = 'Please specify your exact pickup location / landmark';
    }

    // 4. Confirmation Checkboxes
    if (!confirmInformation) {
      newErrors.confirmInformation = 'You must confirm that the information provided is correct';
    }

    if (!agreeTerms) {
      newErrors.agreeTerms = "You must agree to the driving school's terms and conditions";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      // Scroll modal to top of form
      const formEl = document.getElementById('driving-enrollment-form');
      if (formEl) formEl.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const enrollmentId = 'ENR-CLS-' + Math.floor(100000 + Math.random() * 900000);
    const formattedDob = toDDMMYYYY(dateOfBirth);
    const formattedStartDate = toDDMMYYYY(preferredStartDate);

    const enrollmentData = {
      enrollmentId,
      fullName: fullName.trim(),
      dateOfBirth: formattedDob,
      gender,
      mobileNumber: mobileNumber.trim(),
      emailAddress: emailAddress.trim() || undefined,
      address: address.trim(),
      drivingExperience,
      gearPreference,
      learnersLicenseStatus,
      drivingLicenseStatus,
      preferredStartDate: formattedStartDate,
      preferredTime,
      pickupRequired,
      pickupLocation: pickupRequired === 'Yes' ? pickupLocation.trim() : undefined,
      additionalNotes: additionalNotes.trim() || undefined,
      submittedAt: new Date().toISOString(),
      status: 'Enrollment Received'
    };

    // Save to local storage for Admin tracking
    try {
      const existing = JSON.parse(localStorage.getItem('bda_class_enrollments') || '[]');
      localStorage.setItem('bda_class_enrollments', JSON.stringify([enrollmentData, ...existing]));

      // Also create a pending booking entry in bda_driver_bookings so it appears in the admin order dispatcher
      const newAdminOrder = {
        id: enrollmentId,
        customerName: enrollmentData.fullName,
        phone: enrollmentData.mobileNumber,
        tripType: 'class',
        tripTitle: `Driving Class Enrollment (${enrollmentData.gearPreference})`,
        pickupArea: enrollmentData.pickupLocation || enrollmentData.address.split(',')[0] || 'Bangalore',
        dropLocation: 'Doorstep Driving School Training',
        classCourseName: `${enrollmentData.gearPreference} Driving Course`,
        classDuration: 'Comprehensive Batch',
        classTrainingCar: `${enrollmentData.gearPreference} Car`,
        classTransmission: enrollmentData.gearPreference,
        classTimeSlot: enrollmentData.preferredTime,
        date: formattedStartDate,
        time: enrollmentData.preferredTime === 'Morning' ? '07:00 AM' : (enrollmentData.preferredTime === 'Afternoon' ? '02:00 PM' : '06:00 PM'),
        fare: 5999,
        status: 'Pending',
        assignedDriver: 'Syed Nizamuddin',
        assignedDriverPhone: '+91 98860 54321',
        bookedAt: 'Just Now'
      };
      const existingBookings = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
      localStorage.setItem('bda_driver_bookings', JSON.stringify([newAdminOrder, ...existingBookings]));

      window.dispatchEvent(new CustomEvent('bda_booking_updated'));
    } catch (err) {
      console.error('Error storing enrollment:', err);
    }

    setSubmittedEnrollment(enrollmentData);
    setIsSubmitted(true);

    if (onEnrollmentSuccess) {
      onEnrollmentSuccess(enrollmentData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 overflow-hidden touch-none overscroll-contain">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity touch-none overscroll-contain"
        onClick={handleClose}
        onTouchMove={(e) => { e.preventDefault(); e.stopPropagation(); }}
      />

      {/* Modal Container */}
      <div className="relative bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl z-10 animate-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[92vh] overscroll-contain touch-auto">
        
        {/* =====================================================================
            HEADER BAR
           ===================================================================== */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 px-4 sm:px-6 py-3.5 sm:py-4 text-slate-950 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-950 text-amber-400 rounded-2xl shadow-inner">
              <SteeringWheel className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-extrabold text-xl font-['Outfit'] leading-tight tracking-tight">
                Car Driving Class Enrollment Form
              </h2>
              <p className="text-xs font-semibold text-slate-900/85 flex items-center gap-1.5">
                <span>Book Driver Anna Driving Academy</span>
                <span>•</span>
                <span className="inline-flex items-center gap-0.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Certified Instructors
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl bg-slate-950/15 hover:bg-slate-950/30 text-slate-950 transition-colors"
            title="Close Form"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* =====================================================================
            SUCCESS CONFIRMATION SCREEN
           ===================================================================== */}
        {isSubmitted ? (
          <div className="p-6 sm:p-10 space-y-6 text-center overflow-y-auto flex-1 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-xl text-emerald-400">
              <CheckCircle2 className="w-12 h-12 animate-bounce" />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <FileCheck className="w-3.5 h-3.5" /> Enrollment Submitted
              </div>
              
              {/* Exact user requested post-submission message */}
              <h3 className="text-xl sm:text-2xl font-extrabold text-white font-['Outfit'] leading-snug">
                Your enrollment request has been submitted successfully. Our team will contact you shortly.
              </h3>
            </div>

            {/* Reference & Summary Card */}
            {submittedEnrollment && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 max-w-lg mx-auto text-left space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-semibold">Enrollment Reference:</span>
                  <span className="font-mono font-black text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded border border-amber-400/20">
                    {submittedEnrollment.enrollmentId}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-semibold">Candidate Name:</span>
                  <span className="font-bold text-white">{submittedEnrollment.fullName}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-semibold">Contact Phone:</span>
                  <span className="font-bold text-white">{submittedEnrollment.mobileNumber}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-semibold">Learner's License:</span>
                  <span className="font-bold text-amber-300">{submittedEnrollment.learnersLicenseStatus}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-semibold">Driving License:</span>
                  <span className="font-bold text-amber-300">{submittedEnrollment.drivingLicenseStatus}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-semibold">Gear Preference:</span>
                  <span className="font-bold text-white">{submittedEnrollment.gearPreference}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-semibold">Pickup Required:</span>
                  <span className="font-bold text-white">
                    {submittedEnrollment.pickupRequired} {submittedEnrollment.pickupLocation ? `(${submittedEnrollment.pickupLocation})` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold">Preferred Schedule:</span>
                  <span className="font-bold text-white">
                    {toDDMMYYYY(submittedEnrollment.preferredStartDate)} ({submittedEnrollment.preferredTime})
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2.5 max-w-sm mx-auto w-full">
              <button
                onClick={handleClose}
                className="w-full py-3 px-6 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-400/20 transition-all flex items-center justify-center gap-2"
              >
                <span>Done / Back to Home</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Cancel Enrollment Workflow with "Why are you cancelling?" */}
              {!isCancelled ? (
                <>
                  {!showCancelPrompt ? (
                    <button
                      type="button"
                      onClick={() => setShowCancelPrompt(true)}
                      className="w-full py-2.5 px-4 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Cancel Enrollment (Zero Penalty)</span>
                    </button>
                  ) : (
                    <div className="p-4 bg-slate-950 border-2 border-red-500/50 rounded-2xl space-y-3 animate-in fade-in duration-200 text-left">
                      <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Why are you cancelling your driving class?</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Select Cancellation Reason *:
                        </label>
                        <select
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-red-400"
                        >
                          <option value="Change of personal schedule / timing conflict">Change of personal schedule / timing conflict</option>
                          <option value="Relocating to another area / city">Relocating to another area / city</option>
                          <option value="Enrolled by mistake / duplicate form">Enrolled by mistake / duplicate form</option>
                          <option value="Postponing training to next month">Postponing training to next month</option>
                          <option value="Personal or financial reasons">Personal or financial reasons</option>
                          <option value="Found another alternative">Found another alternative</option>
                          <option value="Other reason">Other reason</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Brief reason / details (optional):
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Office shift timings changed to evening..."
                          value={cancelCustomNotes}
                          onChange={(e) => setCancelCustomNotes(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-400"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCancelEnrollment}
                          className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-red-950"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Confirm Cancellation</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCancelPrompt(false)}
                          className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors"
                        >
                          Keep Active
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-center space-y-1">
                  <div className="text-xs font-bold text-red-400 flex items-center justify-center gap-1.5">
                    <Ban className="w-4 h-4" /> Driving Class Enrollment Cancelled
                  </div>
                  <p className="text-[11px] text-slate-400">Zero penalty incurred. Our academy desk has been updated.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* =====================================================================
              ENROLLMENT FORM
             ===================================================================== */
          <form 
            onSubmit={handleSubmit} 
            className="p-4 sm:p-8 space-y-6 sm:space-y-8 overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar flex-1 text-slate-100"
          >

            {/* Validation Error Alert Banner if form has errors */}
            {Object.keys(errors).length > 0 && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                <span>Please complete all required fields marked with an asterisk (*) before submitting.</span>
              </div>
            )}

            {/* -----------------------------------------------------------------
                SECTION 1: PERSONAL INFORMATION
               ----------------------------------------------------------------- */}
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h3 className="font-extrabold text-base text-white font-['Outfit'] tracking-tight">
                  Personal Information
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* 1. Full Name * */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-amber-400" /> Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.fullName) setErrors(prev => ({ ...prev, fullName: null }));
                    }}
                    placeholder="Enter your full legal name"
                    className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
                      errors.fullName ? 'border-red-500 focus:border-red-400 bg-red-500/5' : 'border-slate-700 focus:border-amber-400'
                    }`}
                  />
                  {errors.fullName && (
                    <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.fullName}
                    </p>
                  )}
                </div>

                {/* 2. Date of Birth (DD/MM/YYYY) * */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" /> Date of Birth <span className="text-red-400">*</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">DD/MM/YYYY</span>
                  </label>
                  <DateInput
                    value={dateOfBirth}
                    onChange={(val) => {
                      setDateOfBirth(val);
                      if (errors.dateOfBirth) setErrors(prev => ({ ...prev, dateOfBirth: null }));
                    }}
                    placeholder="DD/MM/YYYY"
                    maxDate={maxDobStr}
                    hasError={Boolean(errors.dateOfBirth)}
                  />
                  {errors.dateOfBirth && (
                    <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.dateOfBirth}
                    </p>
                  )}
                </div>

                {/* 3. Gender * */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Gender <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => {
                      setGender(e.target.value);
                      if (errors.gender) setErrors(prev => ({ ...prev, gender: null }));
                    }}
                    className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors ${
                      errors.gender ? 'border-red-500 focus:border-red-400 bg-red-500/5' : 'border-slate-700 focus:border-amber-400'
                    }`}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                  {errors.gender && (
                    <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.gender}
                    </p>
                  )}
                </div>

                {/* 4. Mobile Number * */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-amber-400" /> Mobile Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    maxLength="10"
                    value={mobileNumber}
                    onChange={(e) => {
                      setMobileNumber(e.target.value.replace(/[^0-9]/g, ''));
                      if (errors.mobileNumber) setErrors(prev => ({ ...prev, mobileNumber: null }));
                    }}
                    placeholder="10-digit mobile number"
                    className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
                      errors.mobileNumber ? 'border-red-500 focus:border-red-400 bg-red-500/5' : 'border-slate-700 focus:border-amber-400'
                    }`}
                  />
                  {errors.mobileNumber && (
                    <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.mobileNumber}
                    </p>
                  )}
                </div>

                {/* 5. Email Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-amber-400" /> Email Address
                  </label>
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => {
                      setEmailAddress(e.target.value);
                      if (errors.emailAddress) setErrors(prev => ({ ...prev, emailAddress: null }));
                    }}
                    placeholder="e.g. name@example.com"
                    className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
                      errors.emailAddress ? 'border-red-500 focus:border-red-400' : 'border-slate-700 focus:border-amber-400'
                    }`}
                  />
                  {errors.emailAddress && (
                    <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.emailAddress}
                    </p>
                  )}
                </div>

                {/* 6. Address * */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" /> Address <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows="2"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      if (errors.address) setErrors(prev => ({ ...prev, address: null }));
                    }}
                    placeholder="Enter your complete residential address"
                    className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
                      errors.address ? 'border-red-500 focus:border-red-400 bg-red-500/5' : 'border-slate-700 focus:border-amber-400'
                    }`}
                  />
                  {errors.address && (
                    <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.address}
                    </p>
                  )}
                </div>

              </div>
            </div>

            {/* -----------------------------------------------------------------
                SECTION 2: DRIVING INFORMATION
               ----------------------------------------------------------------- */}
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h3 className="font-extrabold text-base text-white font-['Outfit'] tracking-tight">
                  Driving Information
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* 1. Driving Experience * */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Driving Experience <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={drivingExperience}
                    onChange={(e) => {
                      setDrivingExperience(e.target.value);
                      if (errors.drivingExperience) setErrors(prev => ({ ...prev, drivingExperience: null }));
                    }}
                    className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors ${
                      errors.drivingExperience ? 'border-red-500 focus:border-red-400 bg-red-500/5' : 'border-slate-700 focus:border-amber-400'
                    }`}
                  >
                    <option value="">Select Experience Level</option>
                    <option value="No Experience">No Experience</option>
                    <option value="Beginner">Beginner</option>
                    <option value="Some Experience">Some Experience</option>
                    <option value="Experienced">Experienced</option>
                  </select>
                  {errors.drivingExperience && (
                    <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.drivingExperience}
                    </p>
                  )}
                </div>

                {/* 2. Gear Preference * */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Gear Preference <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={gearPreference}
                    onChange={(e) => {
                      setGearPreference(e.target.value);
                      if (errors.gearPreference) setErrors(prev => ({ ...prev, gearPreference: null }));
                    }}
                    className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors ${
                      errors.gearPreference ? 'border-red-500 focus:border-red-400 bg-red-500/5' : 'border-slate-700 focus:border-amber-400'
                    }`}
                  >
                    <option value="">Select Gear Preference</option>
                    <option value="Manual">Manual</option>
                    <option value="Automatic">Automatic</option>
                    <option value="No Preference">No Preference</option>
                  </select>
                  {errors.gearPreference && (
                    <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.gearPreference}
                    </p>
                  )}
                </div>

                {/* 3. Do you have a Learner's License? * */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Do you have a Learner's License? <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={learnersLicenseStatus}
                    onChange={(e) => {
                      setLearnersLicenseStatus(e.target.value);
                      if (errors.learnersLicenseStatus) setErrors(prev => ({ ...prev, learnersLicenseStatus: null }));
                    }}
                    className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors ${
                      errors.learnersLicenseStatus ? 'border-red-500 focus:border-red-400 bg-red-500/5' : 'border-slate-700 focus:border-amber-400'
                    }`}
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                  {errors.learnersLicenseStatus && (
                    <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.learnersLicenseStatus}
                    </p>
                  )}
                </div>

                {/* 4. Do you have a Driving License? * */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Do you have a Driving License? <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={drivingLicenseStatus}
                    onChange={(e) => {
                      setDrivingLicenseStatus(e.target.value);
                      if (errors.drivingLicenseStatus) setErrors(prev => ({ ...prev, drivingLicenseStatus: null }));
                    }}
                    className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors ${
                      errors.drivingLicenseStatus ? 'border-red-500 focus:border-red-400 bg-red-500/5' : 'border-slate-700 focus:border-amber-400'
                    }`}
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                  {errors.drivingLicenseStatus && (
                    <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.drivingLicenseStatus}
                    </p>
                  )}
                </div>

              </div>
            </div>

            {/* -----------------------------------------------------------------
                SECTION 3: CLASS PREFERENCES
               ----------------------------------------------------------------- */}
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <h3 className="font-extrabold text-base text-white font-['Outfit'] tracking-tight">
                  Class Preferences
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* 1. Preferred Start Date (DD/MM/YYYY) * */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" /> Preferred Start Date <span className="text-red-400">*</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">DD/MM/YYYY</span>
                  </label>
                  <DateInput
                    value={preferredStartDate}
                    onChange={(val) => {
                      setPreferredStartDate(val);
                      if (errors.preferredStartDate) setErrors(prev => ({ ...prev, preferredStartDate: null }));
                    }}
                    placeholder="DD/MM/YYYY"
                    minDate={todayStr}
                    hasError={Boolean(errors.preferredStartDate)}
                  />
                  {errors.preferredStartDate && (
                    <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.preferredStartDate}
                    </p>
                  )}
                </div>

                {/* 2. Preferred Time * */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" /> Preferred Time <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={preferredTime}
                    onChange={(e) => {
                      setPreferredTime(e.target.value);
                      if (errors.preferredTime) setErrors(prev => ({ ...prev, preferredTime: null }));
                    }}
                    className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors ${
                      errors.preferredTime ? 'border-red-500 focus:border-red-400 bg-red-500/5' : 'border-slate-700 focus:border-amber-400'
                    }`}
                  >
                    <option value="">Select Preferred Time</option>
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                    <option value="Evening">Evening</option>
                  </select>
                  {errors.preferredTime && (
                    <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.preferredTime}
                    </p>
                  )}
                </div>

                {/* 3. Pickup Required? * (Yes / No) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5 text-amber-400" /> Pickup Required? <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    {['Yes', 'No'].map((opt) => (
                      <label 
                        key={opt}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border cursor-pointer text-xs font-bold transition-all ${
                          pickupRequired === opt
                            ? 'bg-amber-400/15 border-amber-400 text-amber-300 shadow-sm'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="pickupRequired"
                          value={opt}
                          checked={pickupRequired === opt}
                          onChange={(e) => {
                            setPickupRequired(e.target.value);
                            if (e.target.value === 'No') {
                              setPickupLocation('');
                              if (errors.pickupLocation) setErrors(prev => ({ ...prev, pickupLocation: null }));
                            }
                          }}
                          className="w-3.5 h-3.5 accent-amber-400"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                  {errors.pickupRequired && (
                    <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.pickupRequired}
                    </p>
                  )}
                </div>

                {/* 4. Pickup Location — CONDITIONALLY DISPLAYED ONLY WHEN Pickup Required === 'Yes' */}
                {pickupRequired === 'Yes' && (
                  <div className="sm:col-span-2 animate-in fade-in duration-200">
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" /> Pickup Location <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={pickupLocation}
                      onChange={(e) => {
                        setPickupLocation(e.target.value);
                        if (errors.pickupLocation) setErrors(prev => ({ ...prev, pickupLocation: null }));
                      }}
                      placeholder="Enter pickup address / landmark"
                      className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
                        errors.pickupLocation ? 'border-red-500 focus:border-red-400 bg-red-500/5' : 'border-slate-700 focus:border-amber-400'
                      }`}
                    />
                    {errors.pickupLocation && (
                      <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {errors.pickupLocation}
                      </p>
                    )}
                  </div>
                )}

                {/* 5. Additional Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Additional Notes
                  </label>
                  <textarea
                    rows="2"
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Enter any additional requests or information..."
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>

              </div>
            </div>

            {/* -----------------------------------------------------------------
                SECTION 4: CONFIRMATION
               ----------------------------------------------------------------- */}
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold text-xs">
                  4
                </div>
                <h3 className="font-extrabold text-base text-white font-['Outfit'] tracking-tight">
                  Confirmation
                </h3>
              </div>

              <div className="space-y-3">
                {/* Checkbox 1 * */}
                <div>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={confirmInformation}
                      onChange={(e) => {
                        setConfirmInformation(e.target.checked);
                        if (errors.confirmInformation) setErrors(prev => ({ ...prev, confirmInformation: null }));
                      }}
                      className="mt-0.5 w-4 h-4 rounded border-slate-700 text-amber-400 accent-amber-400 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs text-slate-300 group-hover:text-white transition-colors select-none font-medium">
                      I confirm that the information provided is correct. <span className="text-red-400">*</span>
                    </span>
                  </label>
                  {errors.confirmInformation && (
                    <p className="text-[11px] text-red-400 font-medium mt-1 ml-7 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.confirmInformation}
                    </p>
                  )}
                </div>

                {/* Checkbox 2 * */}
                <div>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => {
                        setAgreeTerms(e.target.checked);
                        if (errors.agreeTerms) setErrors(prev => ({ ...prev, agreeTerms: null }));
                      }}
                      className="mt-0.5 w-4 h-4 rounded border-slate-700 text-amber-400 accent-amber-400 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs text-slate-300 group-hover:text-white transition-colors select-none font-medium">
                      I agree to the driving school's terms and conditions. <span className="text-red-400">*</span>
                    </span>
                  </label>
                  {errors.agreeTerms && (
                    <p className="text-[11px] text-red-400 font-medium mt-1 ml-7 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.agreeTerms}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* -----------------------------------------------------------------
                FORM SUBMIT BUTTON
               ----------------------------------------------------------------- */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-extrabold text-base shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2.5"
              >
                <SteeringWheel className="w-5 h-5 text-slate-950" />
                <span>Submit Enrollment</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
