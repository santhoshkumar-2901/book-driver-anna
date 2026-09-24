import React, { useState, useEffect, lazy, Suspense } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';

// Lazy-loaded route-level pages for production bundle code-splitting
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ClientAuthPage = lazy(() => import('./pages/ClientAuthPage'));
const DriverAuthPage = lazy(() => import('./pages/DriverAuthPage'));
const DriverPortalPage = lazy(() => import('./pages/DriverPortalPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RouteLoadingFallback() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 space-y-3">
      <div className="w-9 h-9 border-3 border-amber-400/20 border-t-amber-400 rounded-full animate-spin" />
      <p className="text-xs text-slate-400 font-medium tracking-wide">Loading page...</p>
    </div>
  );
}
import BookingModal from './components/BookingModal';
import BookingSuccessModal from './components/BookingSuccessModal';
import DriverSpotlightModal from './components/DriverSpotlightModal';
import DrivingClassEnrollmentModal from './components/DrivingClassEnrollmentModal';
import CancelBookingModal from './components/CancelBookingModal';
import Chatbot from './components/Chatbot';
import RidePaymentModal from './components/RidePaymentModal';
import ActiveRideBanner from './components/ActiveRideBanner';
import UserProfileModal from './components/UserProfileModal';
import PostBookingAuthPromptModal from './components/PostBookingAuthPromptModal';
import { apiClient } from './services/apiClient';
import { broadcastBookingUpdate, onBookingUpdate } from './utils/broadcastSync';
import { SUPPORT_HELPLINE } from './data/mockData';
import { isDummyOrDemoUser } from './utils/userValidation';

/**
 * Resolves a given URL pathname into application route details:
 * - role: 'client' | 'driver' | 'admin'
 * - page: 'home' | 'about' | 'services' | 'contact' | 'client-auth' | 'driver-auth' | 'driver-portal' | 'admin'
 * - authRole: 'driver' | 'user' | null (used for initial role selection gate)
 * - resetAuth: boolean (whether to reset auth session mount key)
 */
export function resolveRoute(pathname = '') {
  if (!pathname || typeof pathname !== 'string') {
    return { role: 'client', page: 'home', authRole: 'user', resetAuth: false };
  }

  const clean = pathname.trim().replace(/\/+$/, '') || '/';

  if (clean === '/admin' || clean.startsWith('/admin/')) {
    return { role: 'admin', page: 'admin', authRole: null, resetAuth: true };
  }
  if (clean === '/driver/signup') {
    return { role: 'driver', page: 'driver-signup', authRole: 'driver', resetAuth: true };
  }
  if (clean === '/driver/login' || clean === '/driver-auth') {
    return { role: 'driver', page: 'driver-login', authRole: 'driver', resetAuth: true };
  }
  if (clean === '/driver/portal' || clean === '/driver-portal') {
    return { role: 'driver', page: 'driver-portal', authRole: 'driver', resetAuth: false };
  }
  if (clean === '/driver') {
    return { role: 'driver', page: 'driver-login', authRole: 'driver', resetAuth: true };
  }
  if (clean === '/signup') {
    return { role: 'client', page: 'signup', authRole: 'user', resetAuth: true };
  }
  if (clean === '/login' || clean === '/client-auth') {
    return { role: 'client', page: 'login', authRole: 'user', resetAuth: true };
  }
  if (clean === '/forgot-password') {
    return { role: 'client', page: 'forgot-password', authRole: 'user', resetAuth: true };
  }
  if (clean === '/reset-password') {
    return { role: 'client', page: 'reset-password', authRole: 'user', resetAuth: true };
  }
  if (clean === '/services') {
    return { role: 'client', page: 'services', authRole: 'user', resetAuth: false };
  }
  if (clean === '/about') {
    return { role: 'client', page: 'about', authRole: 'user', resetAuth: false };
  }
  if (clean === '/contact') {
    return { role: 'client', page: 'contact', authRole: 'user', resetAuth: false };
  }
  if (clean === '/') {
    return { role: 'client', page: 'home', authRole: 'user', resetAuth: false };
  }

  // Catch-all route for any unmapped path: render 404 Not Found page
  return { role: 'client', page: 'not-found', authRole: null, resetAuth: false };
}

/**
 * Reads and parses user session object from localStorage/sessionStorage.
 * Rejects and purges any legacy dummy, demo, or placeholder accounts.
 * Returns null if missing, invalid JSON, or during SSR.
 */
export function getInitialUser(storageKey) {
  if (typeof window === 'undefined') return null;
  try {
    const storedLocal = localStorage.getItem(storageKey);
    if (storedLocal) {
      const parsed = JSON.parse(storedLocal);
      if (isDummyOrDemoUser(parsed)) {
        localStorage.removeItem(storageKey);
        sessionStorage.removeItem(storageKey);
        localStorage.removeItem(storageKey.replace('_user', '_token'));
        return null;
      }
      return parsed;
    }
    const storedSession = sessionStorage.getItem(storageKey);
    if (storedSession) {
      const parsed = JSON.parse(storedSession);
      if (isDummyOrDemoUser(parsed)) {
        localStorage.removeItem(storageKey);
        sessionStorage.removeItem(storageKey);
        localStorage.removeItem(storageKey.replace('_user', '_token'));
        return null;
      }
      return parsed;
    }
  } catch (e) {}
  return null;
}

export default function App() {
  // Initial role detection from pathname
  const getInitialRole = () => {
    if (typeof window !== 'undefined') {
      return resolveRoute(window.location.pathname).authRole;
    }
    return null;
  };

  // Check URL pathname for routing
  const getInitialPage = () => {
    if (typeof window !== 'undefined') {
      return resolveRoute(window.location.pathname).page;
    }
    return 'home';
  };

  const [clientUser, setClientUser] = useState(() => getInitialUser('bda_client_user'));
  const [driverUser, setDriverUser] = useState(() => getInitialUser('bda_driver_user'));
  const [selectedRole, setSelectedRole] = useState(getInitialRole);
  const [activePage, setActivePage] = useState(getInitialPage);
  // Unique auth session key to guarantee pristine, freshly mounted login & signup pages upon visit/revisit
  const [authSessionKey, setAuthSessionKey] = useState(1);

  // Sync URL changes via popstate
  useEffect(() => {
    const handlePopState = () => {
      const route = resolveRoute(window.location.pathname);
      setActivePage(route.page);
      if (route.authRole) {
        setSelectedRole(route.authRole);
      }
      if (route.resetAuth) {
        setAuthSessionKey(k => k + 1);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Check active session with backend API on mount and purge any stale dummy accounts
  useEffect(() => {
    // Proactively clean up any stale legacy dummy storage keys
    if (typeof window !== 'undefined') {
      try {
        const clientRaw = localStorage.getItem('bda_client_user');
        if (clientRaw) {
          const parsed = JSON.parse(clientRaw);
          if (isDummyOrDemoUser(parsed)) {
            localStorage.removeItem('bda_client_user');
            localStorage.removeItem('bda_client_token');
            sessionStorage.removeItem('bda_client_user');
            setClientUser(null);
          }
        }
        const driverRaw = localStorage.getItem('bda_driver_user');
        if (driverRaw) {
          const parsed = JSON.parse(driverRaw);
          if (isDummyOrDemoUser(parsed)) {
            localStorage.removeItem('bda_driver_user');
            localStorage.removeItem('bda_driver_token');
            sessionStorage.removeItem('bda_driver_user');
            setDriverUser(null);
          }
        }
      } catch (e) {}
    }

    apiClient.getMe().then(res => {
      if (res && res.data && res.data.user) {
        if (isDummyOrDemoUser(res.data.user)) {
          setClientUser(null);
          setDriverUser(null);
          localStorage.removeItem('bda_client_user');
          localStorage.removeItem('bda_client_token');
          localStorage.removeItem('bda_driver_user');
          localStorage.removeItem('bda_driver_token');
          sessionStorage.removeItem('bda_client_user');
          sessionStorage.removeItem('bda_driver_user');
          return;
        }

        if (res.data.user.role === 'customer') {
          setClientUser(res.data.user);
          localStorage.setItem('bda_client_user', JSON.stringify(res.data.user));
        } else if (res.data.user.role === 'driver') {
          setDriverUser(res.data.user);
          localStorage.setItem('bda_driver_user', JSON.stringify(res.data.user));
        }
      } else {
        setClientUser(null);
        setDriverUser(null);
        localStorage.removeItem('bda_client_user');
        localStorage.removeItem('bda_driver_user');
        sessionStorage.removeItem('bda_client_user');
        sessionStorage.removeItem('bda_driver_user');
      }
    }).catch(err => {
      // If server explicitly responds with unauthorized, invalid token, or account disabled:
      // Immediately reset and purge local session so visitors never remain logged in as unauthenticated users
      if (!err || err.status === 401 || err.status === 403 || err.code === 'UNAUTHORIZED' || err.code === 'INVALID_TOKEN' || err.code === 'ACCOUNT_DISABLED') {
        setClientUser(null);
        setDriverUser(null);
        localStorage.removeItem('bda_client_user');
        localStorage.removeItem('bda_client_token');
        localStorage.removeItem('bda_driver_user');
        localStorage.removeItem('bda_driver_token');
        sessionStorage.removeItem('bda_client_user');
        sessionStorage.removeItem('bda_driver_user');
      }
    });
  }, []);

  const changePage = (newPage) => {
    setActivePage(newPage);
    if (newPage === 'admin') {
      if (!window.location.pathname.startsWith('/admin')) {
        window.history.pushState({}, '', '/admin/dashboard');
      }
      setAuthSessionKey(k => k + 1);
    } else if (newPage === 'driver') {
      setSelectedRole('driver');
      window.history.pushState({}, '', '/driver');
      setAuthSessionKey(k => k + 1);
    } else if (newPage === 'driver-signup') {
      setSelectedRole('driver');
      window.history.pushState({}, '', '/driver/signup');
      setAuthSessionKey(k => k + 1);
    } else if (newPage === 'driver-login') {
      setSelectedRole('driver');
      window.history.pushState({}, '', '/driver/login');
      setAuthSessionKey(k => k + 1);
    } else if (newPage === 'driver-portal') {
      setSelectedRole('driver');
      window.history.pushState({}, '', '/driver/portal');
    } else if (newPage === 'signup') {
      setSelectedRole('user');
      window.history.pushState({}, '', '/signup');
      setAuthSessionKey(k => k + 1);
    } else if (newPage === 'login') {
      setSelectedRole('user');
      window.history.pushState({}, '', '/login');
      setAuthSessionKey(k => k + 1);
    } else if (newPage === 'forgot-password') {
      setSelectedRole('user');
      window.history.pushState({}, '', '/forgot-password');
      setAuthSessionKey(k => k + 1);
    } else if (newPage === 'reset-password') {
      setSelectedRole('user');
      if (!window.location.pathname.startsWith('/reset-password')) {
        window.history.pushState({}, '', '/reset-password');
      }
      setAuthSessionKey(k => k + 1);
    } else if (newPage === 'services') {
      window.history.pushState({}, '', '/services');
    } else if (newPage === 'about') {
      window.history.pushState({}, '', '/about');
    } else if (newPage === 'contact') {
      window.history.pushState({}, '', '/contact');
    } else {
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
      }
    }
  };

  // State to prompt auth after customer completes booking while unauthenticated
  const [isPostBookingPromptOpen, setIsPostBookingPromptOpen] = useState(false);
  const [postBookingPromptInfo, setPostBookingPromptInfo] = useState(null);
  const [pendingBookingSubmission, setPendingBookingSubmission] = useState(null);

  const handleClientLoginSuccess = async (userData) => {
    setClientUser(userData);
    setSelectedRole('user');
    setAuthSessionKey(k => k + 1);
    setIsPostBookingPromptOpen(false);

    // If customer was in the middle of confirming a booking or enrollment, finalize it now!
    if (pendingBookingSubmission) {
      const submission = pendingBookingSubmission;
      setPendingBookingSubmission(null);

      if (submission.kind === 'booking') {
        const b = submission.bookingDetails;
        const apiPayload = b.rawPayload ? {
          ...b.rawPayload,
          customerName: userData.name || b.customerName,
          customerPhone: userData.phone || b.customerPhone,
          customerEmail: userData.email || b.customerEmail
        } : {
          customerName: userData.name || b.customerName,
          customerPhone: userData.phone || b.customerPhone,
          customerEmail: userData.email || b.customerEmail,
          bookingCategory: b.bookingType || 'driver',
          selectedClassId: b.selectedClassId,
          vehicleCategory: b.vehicleCategory,
          driverTripOption: b.driverTripOption,
          dropLocation: b.dropLocation,
          roundTripDuration: b.roundTripDuration,
          outstationTripType: b.outstationTripType,
          outstationPackage: b.outstationPackage,
          outstationDestination: b.outstationDestination,
          pickupArea: b.pickupArea,
          date: new Date().toISOString().split('T')[0],
          time: b.bookingTime || '09:00 AM',
          paymentMode: b.paymentMode || 'cash'
        };

        // Create booking in backend database now that client is authenticated
        let serverBooking = null;
        try {
          const res = await apiClient.createBooking(apiPayload);
          if (res && res.data && res.data.booking) {
            serverBooking = res.data.booking;
          }
        } catch (err) {
          console.warn('[AUTH LOGIN] Backend booking creation note:', err.message);
        }

        const finalBooking = {
          ...b,
          id: serverBooking ? serverBooking.id : b.bookingId,
          bookingId: serverBooking ? serverBooking.id : b.bookingId,
          userId: userData.id || null,
          customerName: userData.name || b.customerName,
          customerPhone: userData.phone || b.customerPhone,
          customerEmail: userData.email || b.customerEmail,
          totalFare: serverBooking ? serverBooking.calculated_fare : b.totalFare,
          fare: serverBooking ? serverBooking.calculated_fare : b.totalFare,
          status: 'Pending'
        };

        // Close the booking modal, return to home, and complete the booking
        setIsBookingModalOpen(false);
        changePage('home');
        handleBookingComplete(finalBooking);
      } else if (submission.kind === 'enrollment') {
        if (submission.callback) {
          submission.callback(userData);
        }
        changePage('home');
        const classPass = {
          bookingId: submission.enrollmentData.enrollmentId,
          bookingType: 'class',
          serviceName: `Car Driving Academy Enrollment (${submission.enrollmentData.gearPreference || 'Manual'})`,
          category: 'Driving Class',
          tripSummary: `${submission.enrollmentData.gearPreference || 'Comprehensive'} Driving Course • Slot: ${submission.enrollmentData.preferredTime || 'Morning'}`,
          pickupArea: submission.enrollmentData.pickupLocation || submission.enrollmentData.address || 'Bengaluru',
          customerName: userData.name || submission.enrollmentData.fullName,
          customerPhone: userData.phone || submission.enrollmentData.mobileNumber,
          customerEmail: userData.email || submission.enrollmentData.emailAddress,
          date: submission.enrollmentData.preferredStartDate || new Date().toISOString().split('T')[0],
          time: submission.enrollmentData.preferredTime === 'Morning' ? '07:00 AM' : (submission.enrollmentData.preferredTime === 'Afternoon' ? '02:00 PM' : '06:00 PM'),
          totalFare: 5999,
          status: 'Pending',
          assignedAnna: 'Syed Nizamuddin (Certified Driving Instructor Anna)'
        };
        setActiveBookingPass(classPass);
      }
    } else if (activePage === 'login' || activePage === 'signup') {
      changePage('home');
    }
  };

  const handleClientLogout = async () => {
    try {
      await apiClient.logout();
    } catch (e) {}
    localStorage.removeItem('bda_client_user');
    sessionStorage.removeItem('bda_client_user');
    setClientUser(null);
    setSelectedRole('user');
    setAuthSessionKey(k => k + 1);
    changePage('home');
  };

  const handleDriverLoginSuccess = (driverData) => {
    setDriverUser(driverData);
    setSelectedRole('driver');
    setAuthSessionKey(k => k + 1);
    changePage('driver-portal');
  };

  const handleDriverLogout = async () => {
    try {
      await apiClient.logout();
    } catch (e) {}
    localStorage.removeItem('bda_driver_user');
    sessionStorage.removeItem('bda_driver_user');
    setDriverUser(null);
    setSelectedRole('driver');
    setAuthSessionKey(k => k + 1);
    changePage('driver-login');
  };

  // Booking modal states
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingModalType, setBookingModalType] = useState('driver'); // 'driver' or 'vehicle'
  const [bookingModalData, setBookingModalData] = useState({});

  // Dedicated Driving Class Enrollment Form modal states
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [enrollmentModalData, setEnrollmentModalData] = useState({});

  // Success reservation pass state
  const [activeBookingPass, setActiveBookingPass] = useState(null);

  // Driver spotlight state
  const [spotlightDriver, setSpotlightDriver] = useState(null);

  // Cancel booking modal states
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // Active Ride & Post-Ride Fare Settlement States
  const [activeRide, setActiveRide] = useState(() => {
    try {
      const saved = localStorage.getItem('bda_active_ride');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.status !== 'Completed' && parsed.status !== 'Cancelled') {
          return parsed;
        }
      }
    } catch (e) {}
    return null;
  });
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentRideData, setPaymentRideData] = useState(null);

  // Sync activeRide changes to localStorage
  useEffect(() => {
    try {
      if (activeRide && activeRide.status !== 'Completed' && activeRide.status !== 'Cancelled') {
        localStorage.setItem('bda_active_ride', JSON.stringify(activeRide));
      } else {
        localStorage.removeItem('bda_active_ride');
      }
    } catch (e) {}
  }, [activeRide]);

  // Client User Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Sync profile edits to state, storage & registered clients database
  const handleUpdateProfile = (updatedUser) => {
    setClientUser(updatedUser);
    try {
      localStorage.setItem('bda_client_user', JSON.stringify(updatedUser));
      sessionStorage.setItem('bda_client_user', JSON.stringify(updatedUser));
      const saved = JSON.parse(localStorage.getItem('bda_registered_clients') || '[]');
      const idx = saved.findIndex(u => (u.id && u.id === updatedUser.id) || (u.phone && u.phone === updatedUser.phone) || (u.email && u.email === updatedUser.email));
      if (idx !== -1) {
        saved[idx] = { ...saved[idx], ...updatedUser };
      } else {
        saved.push(updatedUser);
      }
      localStorage.setItem('bda_registered_clients', JSON.stringify(saved));
      window.dispatchEvent(new CustomEvent('bda_client_registered'));
    } catch (e) {
      console.error('Failed to sync updated profile:', e);
    }
  };

  // Listen for ride completed events (e.g. from driver portal or background dispatcher)
  useEffect(() => {
    const handleRideCompleted = (e) => {
      if (e && e.detail) {
        setPaymentRideData({
          ...e.detail,
          isPaid: true,
          status: 'Completed'
        });
        setIsPaymentModalOpen(true);
        setActiveRide(null);
        try {
          localStorage.removeItem('bda_active_ride');
        } catch (err) {}
      }
    };

    window.addEventListener('bda_ride_completed', handleRideCompleted);
    return () => window.removeEventListener('bda_ride_completed', handleRideCompleted);
  }, []);

  // Synchronize real-time driver assignment and booking status updates to active ride
  useEffect(() => {
    const unsubscribe = onBookingUpdate((detail) => {
      if (!detail || !detail.bookingId) return;
      setActiveRide((current) => {
        if (!current || current.id !== detail.bookingId) return current;
        const updated = {
          ...current,
          driverName: detail.assignedDriver || current.driverName,
          driverPhone: detail.assignedDriverPhone || current.driverPhone,
          status: detail.status || current.status
        };

        // If driver initiated fare settlement or completed ride, open customer payment modal automatically
        if (detail.status === 'Fare Settlement' || detail.status === 'Completed') {
          const isDone = detail.status === 'Completed';
          const numericFare = Number(String(detail.totalFare || current.fare || current.price || '749').replace(/[^0-9]/g, '')) || 749;
          setPaymentRideData({
            id: current.id,
            driverName: detail.assignedDriver || current.driverName || "Driver Assigned",
            driverPhone: detail.assignedDriverPhone || current.driverPhone || SUPPORT_HELPLINE,
            driverUpi: detail.assignedDriverUpi || current.assignedDriverUpi || detail.driverUpi || '',
            driverRating: 5.0,
            carModel: current.carModel || current.vehicleType || "Sedan",
            pickupArea: current.pickup || current.pickupLocation || "Pickup",
            dropLocation: current.dropoff || current.dropoffLocation || "Destination",
            distance: current.distance || "18 km",
            totalFare: numericFare,
            settlementMethod: detail.settlementMethod || 'online',
            isPaid: isDone,
            status: detail.status
          });
          setIsPaymentModalOpen(true);
          if (isDone) {
            try {
              localStorage.removeItem('bda_active_ride');
            } catch (err) {}
            return null;
          }
        }

        return updated;
      });
    });
    return unsubscribe;
  }, []);

  const openCancelModal = () => {
    setIsCancelModalOpen(true);
  };

  const openEnrollmentModal = (data = {}) => {
    setEnrollmentModalData({
      fullName: clientUser?.name || '',
      mobileNumber: clientUser?.phone || '',
      email: clientUser?.email || '',
      address: clientUser?.area ? `${clientUser.area}, Bengaluru` : '',
      ...data
    });
    setIsEnrollmentModalOpen(true);
  };

  const openBookingModal = (type = 'driver', data = {}) => {
    if (type === 'class' || type === 'driving-class') {
      openEnrollmentModal(data);
      return;
    }
    setBookingModalType(type);
    setBookingModalData({
      customerName: clientUser?.name || '',
      customerPhone: clientUser?.phone || '',
      customerEmail: clientUser?.email || '',
      pickupArea: clientUser?.area || 'Indiranagar',
      ...data
    });
    setIsBookingModalOpen(true);
  };

  // Prompt login or signup after customer books while unauthenticated
  const handleRequireAuthForBooking = (bookingDetails) => {
    // Explicitly close the booking modal so it is NOT open or scrolling behind the prompt!
    setIsBookingModalOpen(false);

    const serviceTitle = bookingDetails.bookingType === 'class'
      ? 'Driving Class'
      : bookingDetails.bookingType === 'vehicle'
      ? 'Rental Vehicle'
      : 'Personal Driver Anna';

    setPendingBookingSubmission({
      kind: 'booking',
      serviceTitle,
      bookingDetails: {
        ...bookingDetails,
        status: 'Confirmed'
      }
    });
    setPostBookingPromptInfo({
      bookingId: bookingDetails.bookingId,
      serviceTitle,
      customerName: bookingDetails.customerName
    });
    setIsPostBookingPromptOpen(true);
  };

  const handleRequireAuthForEnrollment = (enrollmentData, callback) => {
    // Explicitly close the enrollment modal so it is NOT open or scrolling behind the prompt!
    setIsEnrollmentModalOpen(false);

    setPendingBookingSubmission({
      kind: 'enrollment',
      serviceTitle: 'Driving Class Enrollment',
      enrollmentData,
      callback
    });
    setPostBookingPromptInfo({
      bookingId: enrollmentData.enrollmentId,
      serviceTitle: 'Driving Class Enrollment',
      customerName: enrollmentData.fullName
    });
    setIsPostBookingPromptOpen(true);
  };

  const handleChooseLoginAfterBooking = () => {
    setIsPostBookingPromptOpen(false);
    changePage('login');
  };

  const handleChooseSignupAfterBooking = () => {
    setIsPostBookingPromptOpen(false);
    changePage('signup');
  };

  const handleClosePostBookingPrompt = () => {
    setIsPostBookingPromptOpen(false);
    setPendingBookingSubmission(null);
    setPostBookingPromptInfo(null);
  };

  // Redirect authenticated users away from auth pages
  useEffect(() => {
    if (clientUser && (activePage === 'login' || activePage === 'signup' || activePage === 'forgot-password')) {
      changePage('home');
    }
    if (driverUser && (activePage === 'driver-login' || activePage === 'driver-signup')) {
      changePage('driver-portal');
    }
  }, [clientUser, driverUser, activePage]);

  // Handle client booking submission and update Admin Orders in real time via localStorage & CustomEvent
  const handleBookingComplete = (bookingDetails) => {
    setActiveBookingPass(bookingDetails);

    const bookingUserId = bookingDetails.userId || clientUser?.id || null;
    const bookingUserEmail = (bookingDetails.customerEmail || clientUser?.email || '').toLowerCase().trim();
    const bookingUserPhone = bookingDetails.customerPhone || clientUser?.phone || '';

    if (bookingDetails.bookingType === 'class') {
      const newClassBooking = {
        enrollmentId: bookingDetails.bookingId || ('BDA-CLS-' + Math.floor(1000 + Math.random() * 9000)),
        userId: bookingUserId,
        emailAddress: bookingUserEmail,
        fullName: bookingDetails.customerName,
        mobileNumber: bookingUserPhone,
        address: bookingDetails.pickupArea || 'Indiranagar, Bangalore',
        pickupLocation: bookingDetails.pickupArea || 'Indiranagar',
        courseName: bookingDetails.classCourseName || 'Beginner Driving Course',
        duration: bookingDetails.classDuration || '15 Days',
        trainingCar: bookingDetails.classTrainingCar || "Anna's Dual-Control Car",
        gearPreference: bookingDetails.classTransmission || 'Manual',
        preferredTime: bookingDetails.classTimeSlot || 'Morning',
        preferredStartDate: bookingDetails.bookingDate || new Date().toISOString().split('T')[0],
        courseFee: bookingDetails.totalFare || 5999,
        status: 'Pending',
        assignedInstructor: '',
        assignedInstructorPhone: '',
        bookedAt: 'Just Now'
      };

      const existingClasses = JSON.parse(localStorage.getItem('bda_class_enrollments') || '[]');
      const updatedClasses = [newClassBooking, ...existingClasses];
      localStorage.setItem('bda_class_enrollments', JSON.stringify(updatedClasses));
      broadcastBookingUpdate({ bookingId: newClassBooking.enrollmentId, status: 'Pending' });

    } else if (bookingDetails.bookingType === 'vehicle') {
      const newVehicleBooking = {
        id: bookingDetails.bookingId || ('BDA-VEH-' + Math.floor(1000 + Math.random() * 9000)),
        userId: bookingUserId,
        customerEmail: bookingUserEmail,
        customerName: bookingDetails.customerName,
        phone: bookingUserPhone,
        vehicleName: bookingDetails.vehicleCategory ? `${bookingDetails.vehicleCategory} Rental` : 'Sedan (Dzire / Honda City)',
        category: bookingDetails.vehicleCategory || 'Sedan',
        rentalType: 'Full Day Rental',
        pickupArea: bookingDetails.pickupArea || 'Indiranagar',
        dropLocation: bookingDetails.dropLocation || 'Bangalore City',
        passengers: bookingDetails.passengers || '2 Passengers',
        luggage: bookingDetails.luggage || '1 Bag',
        acPreference: bookingDetails.acPreference || 'AC',
        date: bookingDetails.bookingDate || new Date().toISOString().split('T')[0],
        time: bookingDetails.bookingTime || '09:00 AM',
        fare: bookingDetails.totalFare || 1999,
        status: 'Pending',
        vehicleRegNumber: 'Pending Assignment',
        bookedAt: 'Just Now'
      };

      const existingVehicle = JSON.parse(localStorage.getItem('bda_vehicle_bookings') || '[]');
      const updatedVehicle = [newVehicleBooking, ...existingVehicle];
      localStorage.setItem('bda_vehicle_bookings', JSON.stringify(updatedVehicle));
      broadcastBookingUpdate({ bookingId: newVehicleBooking.id, status: 'Pending' });

    } else {
      const newDriverBooking = {
        id: bookingDetails.bookingId || ('BDA-DRV-' + Math.floor(1000 + Math.random() * 9000)),
        userId: bookingUserId,
        customerEmail: bookingUserEmail,
        customerName: bookingDetails.customerName,
        phone: bookingUserPhone,
        tripType: bookingDetails.driverTripOption || 'one-way',
        tripTitle: bookingDetails.serviceName || 'One Way Trip',
        pickupArea: bookingDetails.pickupArea || 'Indiranagar',
        dropLocation: bookingDetails.dropLocation || 'Kempegowda Intl Airport (BLR T1/T2)',
        passengers: bookingDetails.passengers || undefined,
        luggage: bookingDetails.luggage || undefined,
        acPreference: bookingDetails.acPreference || undefined,
        date: bookingDetails.bookingDate || new Date().toISOString().split('T')[0],
        time: bookingDetails.bookingTime || '09:00 AM',
        fare: bookingDetails.totalFare || 349,
        status: 'Pending',
        assignedDriver: 'Pending Admin Acceptance',
        bookedAt: 'Just Now'
      };

      const existingDriver = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
      const updatedDriver = [newDriverBooking, ...existingDriver];
      localStorage.setItem('bda_driver_bookings', JSON.stringify(updatedDriver));
      broadcastBookingUpdate({ bookingId: newDriverBooking.id, status: 'Pending' });
    }

    // Set active ride for real-time tracking and post-ride fare settlement
    setActiveRide({
      id: bookingDetails.bookingId || ('BDA-DRV-' + Math.floor(1000 + Math.random() * 9000)),
      driverName: 'Pending Admin Acceptance',
      driverPhone: SUPPORT_HELPLINE,
      driverRating: 5.0,
      carModel: bookingDetails.vehicleCategory || (bookingDetails.bookingType === 'class' ? "Anna's Dual-Control Car" : 'Customer Vehicle'),
      pickupArea: bookingDetails.pickupArea || 'Pickup Location',
      dropLocation: bookingDetails.dropLocation || 'Drop Location',
      totalFare: bookingDetails.totalFare || 549,
      distance: bookingDetails.distance || 'City Route',
      duration: bookingDetails.duration || 'Scheduled Duration'
    });

    // Dispatch bda_order_created & bda_booking_updated so the Admin portal reflects the new order immediately
    window.dispatchEvent(new CustomEvent('bda_order_created'));
    window.dispatchEvent(new CustomEvent('bda_booking_updated'));
  };

  // 1. Dedicated layout for Admin Portal (/admin)
  if (activePage === 'admin') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-amber-400 selection:text-slate-950">
        <Suspense fallback={<RouteLoadingFallback />}>
          <AdminPage 
            key={`admin-page-${authSessionKey}`}
            onReturnToClient={() => changePage(clientUser ? 'home' : 'login')} 
          />
        </Suspense>
      </div>
    );
  }

  // 2. Dedicated layout for Driver Portal (for logged in drivers or /driver/portal)
  if (driverUser && (activePage === 'driver-portal' || activePage === 'driver')) {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <DriverPortalPage 
          driverUser={driverUser}
          onLogout={handleDriverLogout}
        />
      </Suspense>
    );
  }

  // 3. Driver Auth Pages (/driver, /driver/login, /driver/signup, /driver-auth, /driver/portal without session)
  if (activePage === 'driver' || activePage === 'driver-login' || activePage === 'driver-signup' || activePage === 'driver-auth' || activePage === 'driver-portal') {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <DriverAuthPage 
          key={`${activePage}-${authSessionKey}`}
          initialMode={activePage === 'driver-signup' ? 'signup' : 'login'}
          onLoginSuccess={handleDriverLoginSuccess}
          onSwitchMode={(mode) => changePage(mode === 'signup' ? 'driver-signup' : 'driver-login')}
        />
      </Suspense>
    );
  }

  // 4. Client Auth Pages (/login, /signup, /client-auth, /forgot-password)
  if (activePage === 'login' || activePage === 'signup' || activePage === 'client-auth' || activePage === 'forgot-password') {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <ClientAuthPage 
          key={`${activePage}-${authSessionKey}`}
          initialMode={activePage === 'signup' ? 'signup' : (activePage === 'forgot-password' ? 'forgot-password' : 'login')}
          onLoginSuccess={handleClientLoginSuccess}
          onSwitchMode={(mode) => changePage(mode === 'signup' ? 'signup' : (mode === 'forgot-password' ? 'forgot-password' : 'login'))}
          onBackToHome={() => changePage('home')}
          bookingBanner={
            pendingBookingSubmission?.serviceTitle || null
          }
          prefillData={
            pendingBookingSubmission?.bookingDetails
              ? {
                  name: pendingBookingSubmission.bookingDetails.customerName,
                  phone: pendingBookingSubmission.bookingDetails.customerPhone,
                  email: pendingBookingSubmission.bookingDetails.customerEmail,
                  area: pendingBookingSubmission.bookingDetails.pickupArea
                }
              : pendingBookingSubmission?.enrollmentData
              ? {
                  name: pendingBookingSubmission.enrollmentData.fullName,
                  phone: pendingBookingSubmission.enrollmentData.mobileNumber,
                  email: pendingBookingSubmission.enrollmentData.emailAddress,
                  area: pendingBookingSubmission.enrollmentData.pickupLocation
                }
              : {}
          }
        />
      </Suspense>
    );
  }

  // 5. Dedicated Reset Password Page (/reset-password?token=...)
  if (activePage === 'reset-password') {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <ResetPasswordPage onNavigate={(page) => changePage(page)} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans antialiased selection:bg-amber-400 selection:text-slate-950">
      
      {/* Header Navigation */}
      <Navbar 
        activePage={activePage} 
        setActivePage={changePage} 
        openBookingModal={openBookingModal} 
        openCancelModal={openCancelModal}
        clientUser={clientUser}
        onLogout={handleClientLogout}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenAuth={(mode = 'login') => {
          changePage(mode === 'signup' ? 'signup' : 'login');
        }}
      />

      {/* Main Dynamic View */}
      <main className="flex-grow">
        {activePage === 'home' && (
          <HomePage 
            setActivePage={changePage} 
            openBookingModal={openBookingModal} 
            openDriverSpotlight={setSpotlightDriver}
            clientUser={clientUser}
            onOpenProfile={() => setIsProfileModalOpen(true)}
          />
        )}

        <Suspense fallback={<RouteLoadingFallback />}>
          {activePage === 'services' && (
            <ServicesPage 
              openBookingModal={openBookingModal} 
            />
          )}

          {activePage === 'about' && (
            <AboutPage 
              openBookingModal={openBookingModal} 
            />
          )}

          {activePage === 'contact' && (
            <ContactPage 
              openBookingModal={openBookingModal} 
            />
          )}

          {activePage === 'not-found' && (
            <NotFound 
              onNavigateHome={() => changePage('home')}
              onNavigateServices={() => changePage('services')}
              onNavigateContact={() => changePage('contact')}
              openBookingModal={openBookingModal}
            />
          )}
        </Suspense>
      </main>

      {/* Footer */}
      <Footer 
        setActivePage={changePage} 
        openBookingModal={openBookingModal} 
        openCancelModal={openCancelModal}
        clientUser={clientUser}
        onLogout={handleClientLogout}
      />

      {/* Interactive Booking Wizard Modal */}
      <BookingModal 
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        clientUser={clientUser}
        initialType={bookingModalType}
        initialData={bookingModalData}
        onBookingComplete={handleBookingComplete}
        onOpenEnrollmentModal={openEnrollmentModal}
        onRequireAuth={handleRequireAuthForBooking}
      />

      {/* Professional Car Driving Class Enrollment Modal */}
      <DrivingClassEnrollmentModal
        isOpen={isEnrollmentModalOpen}
        onClose={() => setIsEnrollmentModalOpen(false)}
        initialData={enrollmentModalData}
        clientUser={clientUser}
        onRequireAuth={handleRequireAuthForEnrollment}
      />

      {/* Booking Success Confirmation Modal */}
      <BookingSuccessModal 
        booking={activeBookingPass}
        onClose={() => setActiveBookingPass(null)}
        onSimulateRidePayment={(booking) => {
          const rideForPayment = {
            id: booking.bookingId || booking.id,
            driverName: booking.assignedAnna || "Driver Assigned",
            driverPhone: booking.driverPhone || SUPPORT_HELPLINE,
            driverRating: 5.0,
            carModel: booking.vehicleCategory || "Customer Vehicle",
            pickupArea: booking.pickupArea || "Pickup Location",
            dropLocation: booking.dropLocation || "Drop Location",
            distance: booking.distance || "City Route",
            duration: booking.duration || "Scheduled Trip",
            totalFare: booking.totalFare || booking.fare || 499
          };
          setPaymentRideData(rideForPayment);
          setIsPaymentModalOpen(true);
        }}
      />

      {/* Global Cancel Booking / Enrollment Modal */}
      <CancelBookingModal 
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
      />

      {/* Driver Spotlight Profile Modal */}
      <DriverSpotlightModal 
        driver={spotlightDriver}
        onClose={() => setSpotlightDriver(null)}
        onBookDriver={(driver) => openBookingModal('driver', { preferredDriver: driver.name })}
      />

      {/* Sticky Bottom-Right Gemini AI Chatbot */}
      <Chatbot openBookingModal={openBookingModal} />

      {/* Floating Active Ride Tracking Banner */}
      <ActiveRideBanner 
        activeRide={activeRide}
        onOpenPayment={() => {
          setPaymentRideData(activeRide);
          setIsPaymentModalOpen(true);
        }}
      />

      {/* Post-Ride Digital Payment & Rating Modal */}
      <RidePaymentModal 
        isOpen={isPaymentModalOpen}
        rideData={paymentRideData}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentRideData(null);
        }}
        onPaymentSuccess={(details) => {
          setActiveRide(null);
          try {
            localStorage.removeItem('bda_active_ride');
          } catch (err) {}
        }}
      />

      {/* Client User Profile & Bookings Modal */}
      <UserProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        clientUser={clientUser}
        onUpdateProfile={handleUpdateProfile}
        onLogout={handleClientLogout}
        openBookingModal={openBookingModal}
      />

      {/* Post-Booking Modal: Prompt Customer to Login or Sign Up and go to responsible page */}
      <PostBookingAuthPromptModal
        isOpen={isPostBookingPromptOpen}
        bookingInfo={postBookingPromptInfo}
        onChooseLogin={handleChooseLoginAfterBooking}
        onChooseSignup={handleChooseSignupAfterBooking}
        onClose={handleClosePostBookingPrompt}
      />

    </div>
  );
}
