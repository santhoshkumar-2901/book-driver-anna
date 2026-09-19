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
import { X, ShieldCheck, Phone, CheckCircle2 } from 'lucide-react';
import { SteeringWheel } from './components/Icons';

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

  return { role: 'client', page: 'home', authRole: 'user', resetAuth: false };
}

/**
 * Reads and parses user session object from localStorage/sessionStorage.
 * Returns null if missing, invalid JSON, or during SSR.
 */
export function getInitialUser(storageKey) {
  if (typeof window === 'undefined') return null;
  try {
    const storedLocal = localStorage.getItem(storageKey);
    if (storedLocal) {
      return JSON.parse(storedLocal);
    }
    const storedSession = sessionStorage.getItem(storageKey);
    if (storedSession) {
      return JSON.parse(storedSession);
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

  // Check active session with backend API on mount
  useEffect(() => {
    apiClient.getMe().then(res => {
      if (res && res.data && res.data.user) {
        if (res.data.user.role === 'customer') {
          setClientUser(res.data.user);
          localStorage.setItem('bda_client_user', JSON.stringify(res.data.user));
        } else if (res.data.user.role === 'driver') {
          setDriverUser(res.data.user);
          localStorage.setItem('bda_driver_user', JSON.stringify(res.data.user));
        }
      }
    }).catch(() => {});
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

  const handleClientLoginSuccess = (userData) => {
    setClientUser(userData);
    setSelectedRole('user');
    setAuthSessionKey(k => k + 1);
    setIsPostBookingPromptOpen(false);

    // If customer was in the middle of confirming a booking or enrollment, finalize it now!
    if (pendingBookingSubmission) {
      const submission = pendingBookingSubmission;
      setPendingBookingSubmission(null);

      if (submission.kind === 'booking') {
        const finalBooking = {
          ...submission.bookingDetails,
          userId: userData.id || null,
          customerName: submission.bookingDetails.customerName || userData.name || '',
          customerPhone: submission.bookingDetails.customerPhone || userData.phone || '',
          customerEmail: submission.bookingDetails.customerEmail || userData.email || '',
          status: 'Pending',
          assignedAnna: 'Pending Admin Assignment'
        };

        // Close the booking modal, return to home, and complete the booking as Pending
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
          assignedAnna: 'Pending Instructor Assignment'
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
  const [activeRide, setActiveRide] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentRideData, setPaymentRideData] = useState(null);

  // Client User Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Real-time notification banner state when admin accepts & assigns
  const [assignedNotice, setAssignedNotice] = useState(null);

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
        setPaymentRideData(e.detail);
        setIsPaymentModalOpen(true);
        setActiveRide(null);
      }
    };

    window.addEventListener('bda_ride_completed', handleRideCompleted);
    return () => window.removeEventListener('bda_ride_completed', handleRideCompleted);
  }, []);

  // Real-time synchronization: When admin accepts & assigns, update client site immediately
  useEffect(() => {
    const syncClientBookings = () => {
      try {
        const driverBookings = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
        const vehicleBookings = JSON.parse(localStorage.getItem('bda_vehicle_bookings') || '[]');
        const classBookings = JSON.parse(localStorage.getItem('bda_class_enrollments') || '[]');
        const allBookings = [...driverBookings, ...vehicleBookings, ...classBookings];

        // 1. Dynamically update activeBookingPass if currently displayed in BookingSuccessModal
        setActiveBookingPass(prev => {
          if (!prev) return null;
          const currentId = prev.bookingId || prev.id || prev.enrollmentId;
          const match = allBookings.find(b => (b.id || b.enrollmentId || b.bookingId) === currentId);
          if (match) {
            const assignedName = match.assignedDriver || match.assignedInstructor || match.assignedAnna;
            const assignedPhone = match.assignedDriverPhone || match.assignedInstructorPhone || match.driverPhone;
            const isUpdated = 
              match.status !== prev.status ||
              assignedName !== prev.assignedAnna ||
              assignedPhone !== prev.driverPhone;

            if (isUpdated) {
              return {
                ...prev,
                status: match.status || prev.status,
                assignedAnna: assignedName || prev.assignedAnna,
                assignedDriver: assignedName || prev.assignedDriver,
                driverPhone: assignedPhone || prev.driverPhone,
                driverRating: match.driverRating || prev.driverRating || '5.0',
                vehicleRegNumber: match.vehicleRegNumber || prev.vehicleRegNumber
              };
            }
          }
          return prev;
        });

        // 2. If clientUser is active, verify if an assigned trip should activate activeRide
        if (clientUser) {
          const userPhoneClean = (clientUser.phone || '').replace(/[^0-9]/g, '');
          const userEmailClean = (clientUser.email || '').toLowerCase().trim();

          const myAssignedDriverBooking = driverBookings.find(b => {
            if (b.status !== 'Assigned' && b.status !== 'IN_PROGRESS') return false;
            const bUserId = b.userId ? String(b.userId).trim() : null;
            const bEmail = (b.customerEmail || b.email || '').toLowerCase().trim();
            const bPhone = (b.phone || '').replace(/[^0-9]/g, '');
            return (clientUser.id && bUserId === clientUser.id) ||
              (!bUserId && userEmailClean && bEmail === userEmailClean) ||
              (!bUserId && userPhoneClean && userPhoneClean.length >= 10 && bPhone.endsWith(userPhoneClean.slice(-10)));
          });

          if (myAssignedDriverBooking) {
            setActiveRide(prev => {
              if (prev && prev.id === myAssignedDriverBooking.id && prev.driverName === myAssignedDriverBooking.assignedDriver) {
                return prev;
              }
              return {
                id: myAssignedDriverBooking.id,
                driverName: myAssignedDriverBooking.assignedDriver || "Driver Assigned",
                driverPhone: myAssignedDriverBooking.assignedDriverPhone || "+91 80 2555 0199",
                driverRating: 5.0,
                carModel: myAssignedDriverBooking.vehicleCategory || "Customer Vehicle",
                pickupArea: myAssignedDriverBooking.pickupArea || "Pickup Location",
                dropLocation: myAssignedDriverBooking.dropLocation || "Kempegowda Intl Airport",
                totalFare: myAssignedDriverBooking.fare || 499,
                distance: "City Route",
                duration: "Scheduled Trip"
              };
            });
          }
        }
      } catch (e) {
        console.error('Error in client booking sync:', e);
      }
    };

    const handleDriverAssignedEvent = (e) => {
      syncClientBookings();
      if (e?.detail) {
        const { bookingId, driverName, driverPhone, status, booking } = e.detail;
        let isRelevant = true;
        if (clientUser && booking) {
          const userPhoneClean = (clientUser.phone || '').replace(/[^0-9]/g, '');
          const userEmailClean = (clientUser.email || '').toLowerCase().trim();
          const bUserId = booking.userId ? String(booking.userId).trim() : null;
          const bEmail = (booking.customerEmail || booking.email || '').toLowerCase().trim();
          const bPhone = (booking.phone || '').replace(/[^0-9]/g, '');
          isRelevant = (clientUser.id && bUserId === clientUser.id) ||
            (!bUserId && userEmailClean && bEmail === userEmailClean) ||
            (!bUserId && userPhoneClean && userPhoneClean.length >= 10 && bPhone.endsWith(userPhoneClean.slice(-10)));
        }

        if (isRelevant) {
          setAssignedNotice({
            bookingId,
            driverName: driverName || 'Driver Anna',
            driverPhone: driverPhone || '+91 80 2555 0199',
            status: status || 'Assigned'
          });
        }
      }
    };

    window.addEventListener('bda_booking_updated', syncClientBookings);
    window.addEventListener('bda_driver_assigned', handleDriverAssignedEvent);
    window.addEventListener('storage', syncClientBookings);

    let bc = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('bda_realtime_channel');
        bc.onmessage = (msg) => {
          syncClientBookings();
          if (msg.data?.type === 'BOOKING_ASSIGNED') {
            handleDriverAssignedEvent({ detail: msg.data });
          }
        };
      }
    } catch (e) {}

    const interval = setInterval(syncClientBookings, 4000);

    return () => {
      window.removeEventListener('bda_booking_updated', syncClientBookings);
      window.removeEventListener('bda_driver_assigned', handleDriverAssignedEvent);
      window.removeEventListener('storage', syncClientBookings);
      if (bc) bc.close();
      clearInterval(interval);
    };
  }, [clientUser]);

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
        status: 'Pending',
        assignedAnna: 'Pending Admin Assignment'
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

  // Redirect authenticated users away from auth pages
  useEffect(() => {
    if (clientUser && (activePage === 'login' || activePage === 'signup')) {
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
        id: bookingDetails.bookingId || ('BDA-CLS-' + Math.floor(1000 + Math.random() * 9000)),
        userId: bookingUserId,
        customerEmail: bookingUserEmail,
        customerName: bookingDetails.customerName,
        phone: bookingUserPhone,
        tripType: 'class',
        tripTitle: bookingDetails.serviceName || 'Driving Class',
        pickupArea: bookingDetails.pickupArea || 'Indiranagar',
        dropLocation: `Doorstep Training in ${bookingDetails.pickupArea || 'Bangalore'}`,
        classCourseName: bookingDetails.classCourseName || 'Beginner Course',
        classDuration: bookingDetails.classDuration || '15 Days',
        classTrainingCar: bookingDetails.classTrainingCar || "Anna's Dual-Control Car",
        classTransmission: bookingDetails.classTransmission || 'Manual',
        classTimeSlot: bookingDetails.classTimeSlot || 'Morning (07:00 AM - 08:00 AM)',
        date: bookingDetails.bookingDate || new Date().toISOString().split('T')[0],
        time: bookingDetails.bookingTime || '07:00 AM',
        fare: bookingDetails.totalFare || 5999,
        assignedDriver: bookingDetails.assignedInstructor || 'Instructor Assigned on Dispatch',
        assignedDriverPhone: bookingDetails.assignedInstructorPhone || '+91 80 2555 0199',
        bookedAt: 'Just Now'
      };

      const existingDriver = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
      const updatedDriver = [newClassBooking, ...existingDriver];
      localStorage.setItem('bda_driver_bookings', JSON.stringify(updatedDriver));
      window.dispatchEvent(new CustomEvent('bda_booking_updated'));

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
        status: bookingDetails.status || 'Pending',
        assignedDriver: bookingDetails.assignedAnna || 'Pending Admin Assignment',
        vehicleRegNumber: 'Unassigned',
        bookedAt: 'Just Now'
      };

      const existingVehicle = JSON.parse(localStorage.getItem('bda_vehicle_bookings') || '[]');
      const updatedVehicle = [newVehicleBooking, ...existingVehicle];
      localStorage.setItem('bda_vehicle_bookings', JSON.stringify(updatedVehicle));
      window.dispatchEvent(new CustomEvent('bda_booking_updated'));

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
        status: bookingDetails.status || 'Pending',
        assignedDriver: bookingDetails.assignedAnna || 'Pending Admin Dispatch',
        bookedAt: 'Just Now'
      };

      const existingDriver = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
      const updatedDriver = [newDriverBooking, ...existingDriver];
      localStorage.setItem('bda_driver_bookings', JSON.stringify(updatedDriver));
      window.dispatchEvent(new CustomEvent('bda_booking_updated'));
    }

    // Only set active ride tracking banner when booking is in progress or assigned
    if (bookingDetails.status === 'Assigned' || bookingDetails.status === 'IN_PROGRESS') {
      setActiveRide({
        id: bookingDetails.bookingId || ('BDA-DRV-' + Math.floor(1000 + Math.random() * 9000)),
        driverName: bookingDetails.assignedAnna || 'Driver Assigned on Dispatch',
        driverPhone: bookingDetails.driverPhone || '+91 80 2555 0199',
        driverRating: 5.0,
        carModel: bookingDetails.vehicleCategory || (bookingDetails.bookingType === 'class' ? "Anna's Dual-Control Car" : 'Customer Vehicle'),
        pickupArea: bookingDetails.pickupArea || 'Pickup Location',
        dropLocation: bookingDetails.dropLocation || 'Drop Location',
        totalFare: bookingDetails.totalFare || 549,
        distance: bookingDetails.distance || 'City Route',
        duration: bookingDetails.duration || 'Scheduled Duration'
      });
    }
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

  // 3. Driver Auth Pages (/driver, /driver/login, /driver/signup, /driver-auth)
  if (activePage === 'driver' || activePage === 'driver-login' || activePage === 'driver-signup' || activePage === 'driver-auth') {
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

  // 4. Client Auth Pages (/login, /signup, /client-auth)
  if (activePage === 'login' || activePage === 'signup' || activePage === 'client-auth') {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <ClientAuthPage 
          key={`${activePage}-${authSessionKey}`}
          initialMode={activePage === 'signup' ? 'signup' : 'login'}
          onLoginSuccess={handleClientLoginSuccess}
          onSwitchMode={(mode) => changePage(mode === 'signup' ? 'signup' : 'login')}
          onBackToHome={() => changePage('home')}
          bookingBanner={
            pendingBookingSubmission?.serviceTitle 
              ? `Please ${activePage === 'signup' ? 'sign up' : 'log in'} to confirm your booking for ${pendingBookingSubmission.serviceTitle} & access your pass.`
              : null
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
            driverPhone: booking.driverPhone || "+91 80 2555 0199",
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
        onClose={() => setIsPaymentModalOpen(false)}
        onPaymentSuccess={(details) => {
          setActiveRide(null);
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
        onViewTripTicket={(booking) => {
          setActiveBookingPass(booking);
        }}
      />

      {/* Post-Booking Modal: Prompt Customer to Login or Sign Up */}
      <PostBookingAuthPromptModal
        isOpen={isPostBookingPromptOpen}
        bookingInfo={postBookingPromptInfo}
        onChooseLogin={handleChooseLoginAfterBooking}
        onChooseSignup={handleChooseSignupAfterBooking}
      />

      {/* Real-Time Order Accepted & Assigned Notification Banner */}
      {assignedNotice && (
        <div className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg animate-in slide-in-from-top-4 duration-300">
          <div className="bg-slate-900 border-2 border-amber-400 rounded-2xl p-3.5 sm:p-4 shadow-2xl shadow-black/90 backdrop-blur-xl flex items-center justify-between gap-3 text-slate-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-extrabold flex items-center justify-center shrink-0 shadow-lg shadow-amber-400/20">
                <SteeringWheel className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    Booking Accepted & Assigned!
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-white truncate font-['Outfit']">
                  {assignedNotice.driverName} has been assigned to trip #{assignedNotice.bookingId}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  Call: <span className="font-mono text-amber-300 font-bold">{assignedNotice.driverPhone}</span> • Anna is on his way!
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  // Find full booking details and open ticket
                  const driverBookings = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
                  const match = driverBookings.find(b => b.id === assignedNotice.bookingId);
                  if (match) {
                    setActiveBookingPass({
                      bookingId: match.id,
                      status: match.status,
                      serviceName: match.tripTitle || 'Personal Driver',
                      pickupArea: match.pickupArea,
                      dropLocation: match.dropLocation,
                      bookingDate: match.date,
                      bookingTime: match.time,
                      totalFare: match.fare,
                      customerName: match.customerName,
                      customerPhone: match.phone,
                      assignedAnna: match.assignedDriver,
                      driverPhone: match.assignedDriverPhone
                    });
                  }
                  setAssignedNotice(null);
                }}
                className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-400/20 transition-all cursor-pointer shrink-0"
              >
                View Ticket
              </button>
              <button
                type="button"
                onClick={() => setAssignedNotice(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
