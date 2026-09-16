import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import AdminPage from './pages/AdminPage';
import ClientAuthPage from './pages/ClientAuthPage';
import DriverAuthPage from './pages/DriverAuthPage';
import DriverPortalPage from './pages/DriverPortalPage';
import RoleSelectGate from './components/RoleSelectGate';
import BookingModal from './components/BookingModal';
import BookingSuccessModal from './components/BookingSuccessModal';
import DriverSpotlightModal from './components/DriverSpotlightModal';
import DrivingClassEnrollmentModal from './components/DrivingClassEnrollmentModal';
import CancelBookingModal from './components/CancelBookingModal';
import Chatbot from './components/Chatbot';
import RidePaymentModal from './components/RidePaymentModal';
import ActiveRideBanner from './components/ActiveRideBanner';
import UserProfileModal from './components/UserProfileModal';
import { apiClient } from './services/apiClient';

/**
 * Resolves a given URL pathname into application route details:
 * - role: 'client' | 'driver' | 'admin'
 * - page: 'home' | 'about' | 'services' | 'contact' | 'client-auth' | 'driver-auth' | 'driver-portal' | 'admin'
 * - authRole: 'driver' | 'user' | null (used for initial role selection gate)
 * - resetAuth: boolean (whether to reset auth session mount key)
 */
export function resolveRoute(pathname = '') {
  if (!pathname || typeof pathname !== 'string') {
    return { role: 'client', page: 'home', authRole: null, resetAuth: false };
  }

  const clean = pathname.trim().replace(/\/+$/, '') || '/';

  if (clean === '/admin' || clean.startsWith('/admin/')) {
    return { role: 'admin', page: 'admin', authRole: null, resetAuth: true };
  }
  if (clean === '/driver/signup') {
    return { role: 'driver', page: 'driver-signup', authRole: 'driver', resetAuth: true };
  }
  if (clean === '/driver/login') {
    return { role: 'driver', page: 'driver-login', authRole: 'driver', resetAuth: true };
  }
  if (clean === '/driver-auth') {
    return { role: 'driver', page: 'driver-auth', authRole: 'driver', resetAuth: true };
  }
  if (clean === '/driver/portal' || clean === '/driver' || clean === '/driver-portal') {
    return { role: 'driver', page: 'driver-portal', authRole: 'driver', resetAuth: false };
  }
  if (clean === '/signup') {
    return { role: 'client', page: 'signup', authRole: 'user', resetAuth: true };
  }
  if (clean === '/login') {
    return { role: 'client', page: 'login', authRole: 'user', resetAuth: true };
  }
  if (clean === '/client-auth') {
    return { role: 'client', page: 'client-auth', authRole: 'user', resetAuth: true };
  }
  if (clean === '/services') {
    return { role: 'client', page: 'services', authRole: null, resetAuth: false };
  }
  if (clean === '/about') {
    return { role: 'client', page: 'about', authRole: null, resetAuth: false };
  }
  if (clean === '/contact') {
    return { role: 'client', page: 'contact', authRole: null, resetAuth: false };
  }
  if (clean === '/') {
    return { role: 'client', page: 'home', authRole: null, resetAuth: false };
  }

  return { role: 'client', page: 'home', authRole: null, resetAuth: false };
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
    } else if (newPage === 'role-select') {
      setSelectedRole(null);
      window.history.pushState({}, '', '/');
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

  const handleSelectRole = (role, mode = 'login') => {
    setSelectedRole(role);
    setAuthSessionKey(k => k + 1);
    if (role === 'driver') {
      changePage(mode === 'signup' ? 'driver-signup' : 'driver-login');
    } else {
      changePage(mode === 'signup' ? 'signup' : 'login');
    }
  };

  const handleChangeRole = () => {
    setSelectedRole(null);
    setAuthSessionKey(k => k + 1);
    changePage('role-select');
  };

  const handleClientLoginSuccess = (userData) => {
    setClientUser(userData);
    setSelectedRole('user');
    setAuthSessionKey(k => k + 1);
    changePage('home');
  };

  const handleClientLogout = async () => {
    try {
      await apiClient.logout();
    } catch (e) {}
    localStorage.removeItem('bda_client_user');
    sessionStorage.removeItem('bda_client_user');
    setClientUser(null);
    setSelectedRole(null);
    setAuthSessionKey(k => k + 1);
    changePage('role-select');
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
    setSelectedRole(null);
    setAuthSessionKey(k => k + 1);
    changePage('role-select');
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

  const handleSimulateDemoRide = () => {
    const demoRide = {
      id: "BDA-UBR-" + Math.floor(1000 + Math.random() * 9000),
      driverName: "Manjunath Gowda",
      driverPhone: "+91 98860 12345",
      driverRating: 4.98,
      driverTrips: 3420,
      carModel: "Honda City (White) • KA-04-ME-5432",
      pickupArea: "Indiranagar 100 Feet Road",
      dropLocation: "Kempegowda Intl Airport (BLR T1)",
      distance: "38.2 km",
      duration: "48 mins",
      totalFare: 749
    };
    setPaymentRideData(demoRide);
    setIsPaymentModalOpen(true);
  };

  const handleOpenRidePayment = () => {
    if (activeRide) {
      setPaymentRideData(activeRide);
    } else {
      handleSimulateDemoRide();
      return;
    }
    setIsPaymentModalOpen(true);
  };

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
        status: 'Pending',
        assignedDriver: 'Syed Nizamuddin',
        assignedDriverPhone: '+91 98860 54321',
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
        status: 'Pending',
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
        status: 'Pending',
        assignedDriver: '',
        bookedAt: 'Just Now'
      };

      const existingDriver = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
      const updatedDriver = [newDriverBooking, ...existingDriver];
      localStorage.setItem('bda_driver_bookings', JSON.stringify(updatedDriver));
      window.dispatchEvent(new CustomEvent('bda_booking_updated'));
    }

    // Set active ride for real-time tracking and post-ride fare settlement
    setActiveRide({
      id: bookingDetails.bookingId || ('BDA-DRV-' + Math.floor(1000 + Math.random() * 9000)),
      driverName: bookingDetails.assignedAnna || 'Manjunath Gowda',
      driverPhone: '+91 98860 12345',
      driverRating: 4.98,
      carModel: bookingDetails.vehicleCategory || (bookingDetails.bookingType === 'class' ? "Anna's Dual-Control Car" : 'Honda City • KA-04-ME-5432'),
      pickupArea: bookingDetails.pickupArea || 'Indiranagar',
      dropLocation: bookingDetails.dropLocation || 'Kempegowda Intl Airport (BLR T1)',
      totalFare: bookingDetails.totalFare || 549,
      distance: '22.4 km',
      duration: '45 mins'
    });
  };

  // 1. Dedicated layout for Admin Portal (/admin)
  if (activePage === 'admin') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-amber-400 selection:text-slate-950">
        <AdminPage 
          key={`admin-page-${authSessionKey}`}
          onReturnToClient={() => changePage(clientUser ? 'home' : (driverUser ? 'driver-portal' : 'role-select'))} 
        />
      </div>
    );
  }

  // 2. Dedicated layout for Driver Portal (for logged in drivers or /driver/portal)
  if (driverUser && (activePage === 'driver-portal' || (!clientUser && activePage !== 'home' && activePage !== 'services' && activePage !== 'about' && activePage !== 'contact'))) {
    return (
      <DriverPortalPage 
        driverUser={driverUser}
        onLogout={handleDriverLogout}
        onGoToCustomerSite={() => {
          setSelectedRole('user');
          changePage('home');
        }}
      />
    );
  }

  // 3. Driver Auth Pages (/driver/login, /driver/signup, /driver-auth)
  if (activePage === 'driver-login' || activePage === 'driver-signup' || activePage === 'driver-auth') {
    return (
      <DriverAuthPage 
        key={`${activePage}-${authSessionKey}`}
        initialMode={activePage === 'driver-signup' ? 'signup' : 'login'}
        onLoginSuccess={handleDriverLoginSuccess}
        onChangeRole={handleChangeRole}
        onSwitchMode={(mode) => changePage(mode === 'signup' ? 'driver-signup' : 'driver-login')}
      />
    );
  }

  // 4. Client Auth Pages (/login, /signup, /client-auth)
  if (activePage === 'login' || activePage === 'signup' || activePage === 'client-auth') {
    return (
      <ClientAuthPage 
        key={`${activePage}-${authSessionKey}`}
        initialMode={activePage === 'signup' ? 'signup' : 'login'}
        onLoginSuccess={handleClientLoginSuccess}
        onChangeRole={handleChangeRole}
        onSwitchMode={(mode) => changePage(mode === 'signup' ? 'signup' : 'login')}
      />
    );
  }

  // 5. If unauthenticated, gate with Role Choice or chosen role's auth
  if (!clientUser) {
    if (selectedRole === 'driver') {
      return (
        <DriverAuthPage 
          key={`driver-role-${activePage}-${authSessionKey}`}
          initialMode="login"
          onLoginSuccess={handleDriverLoginSuccess}
          onChangeRole={handleChangeRole}
          onSwitchMode={(mode) => changePage(mode === 'signup' ? 'driver-signup' : 'driver-login')}
        />
      );
    }

    if (selectedRole === 'user') {
      return (
        <ClientAuthPage 
          key={`user-role-${activePage}-${authSessionKey}`}
          initialMode="login"
          onLoginSuccess={handleClientLoginSuccess}
          onChangeRole={handleChangeRole}
          onSwitchMode={(mode) => changePage(mode === 'signup' ? 'signup' : 'login')}
        />
      );
    }

    // Default unauthenticated gate: ask whether visitor wants to be User or Driver!
    return (
      <RoleSelectGate 
        onSelectRole={handleSelectRole}
      />
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
      />

      {/* Professional Car Driving Class Enrollment Modal */}
      <DrivingClassEnrollmentModal
        isOpen={isEnrollmentModalOpen}
        onClose={() => setIsEnrollmentModalOpen(false)}
        initialData={enrollmentModalData}
      />

      {/* Booking Success Confirmation Modal */}
      <BookingSuccessModal 
        booking={activeBookingPass}
        onClose={() => setActiveBookingPass(null)}
        onSimulateRidePayment={(booking) => {
          const rideForPayment = {
            id: booking.bookingId || booking.id,
            driverName: booking.assignedAnna || "Manjunath Gowda",
            driverPhone: "+91 98860 12345",
            driverRating: 4.98,
            carModel: "Honda City • KA-04-ME-5432",
            pickupArea: booking.pickupArea || "Indiranagar",
            dropLocation: booking.dropLocation || "Kempegowda Intl Airport",
            distance: "21.6 km",
            duration: "45 mins",
            totalFare: booking.totalFare || 649
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
        onSimulateDemoRide={handleSimulateDemoRide}
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
      />

    </div>
  );
}
