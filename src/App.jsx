import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import AdminPage from './pages/AdminPage';
import BookingModal from './components/BookingModal';
import BookingSuccessModal from './components/BookingSuccessModal';
import DriverSpotlightModal from './components/DriverSpotlightModal';

export default function App() {
  // Check URL pathname for /admin routing
  const getInitialPage = () => {
    if (typeof window !== 'undefined' && (window.location.pathname === '/admin' || window.location.pathname === '/admin/')) {
      return 'admin';
    }
    return 'home';
  };

  const [activePage, setActivePage] = useState(getInitialPage);

  // Sync URL changes
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
        setActivePage('admin');
      } else {
        setActivePage('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const changePage = (newPage) => {
    setActivePage(newPage);
    if (newPage === 'admin') {
      window.history.pushState({}, '', '/admin');
    } else {
      if (window.location.pathname === '/admin') {
        window.history.pushState({}, '', '/');
      }
    }
  };
  
  // Booking modal states
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingModalType, setBookingModalType] = useState('driver'); // 'driver' or 'vehicle'
  const [bookingModalData, setBookingModalData] = useState({});

  // Success reservation pass state
  const [activeBookingPass, setActiveBookingPass] = useState(null);

  // Driver spotlight state
  const [spotlightDriver, setSpotlightDriver] = useState(null);

  const openBookingModal = (type = 'driver', data = {}) => {
    setBookingModalType(type);
    setBookingModalData(data);
    setIsBookingModalOpen(true);
  };

  // Handle client booking submission and update Admin Orders in real time via localStorage & CustomEvent
  const handleBookingComplete = (bookingDetails) => {
    setActiveBookingPass(bookingDetails);

    if (bookingDetails.bookingType === 'vehicle') {
      const newVehicleBooking = {
        id: bookingDetails.bookingId || ('BDA-VEH-' + Math.floor(1000 + Math.random() * 9000)),
        customerName: bookingDetails.customerName,
        phone: bookingDetails.customerPhone || '+91 98765 43210',
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
        customerName: bookingDetails.customerName,
        phone: bookingDetails.customerPhone || '+91 98765 43210',
        tripType: bookingDetails.driverTripOption || 'one-way',
        tripTitle: bookingDetails.serviceName || 'One Way Trip',
        pickupArea: bookingDetails.pickupArea || 'Indiranagar',
        dropLocation: bookingDetails.dropLocation || 'Kempegowda Intl Airport (BLR T1/T2)',
        passengers: bookingDetails.passengers || '1 Passenger',
        luggage: bookingDetails.luggage || '1 Bag',
        acPreference: bookingDetails.acPreference || 'AC',
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
  };

  // Dedicated layout for Admin Portal (/admin)
  if (activePage === 'admin') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-amber-400 selection:text-slate-950">
        <AdminPage 
          onReturnToClient={() => changePage('home')} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans antialiased selection:bg-amber-400 selection:text-slate-950">
      
      {/* Header Navigation */}
      <Navbar 
        activePage={activePage} 
        setActivePage={changePage} 
        openBookingModal={openBookingModal} 
      />

      {/* Main Dynamic View */}
      <main className="flex-grow">
        {activePage === 'home' && (
          <HomePage 
            setActivePage={changePage} 
            openBookingModal={openBookingModal} 
            openDriverSpotlight={setSpotlightDriver}
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
      />

      {/* Interactive Booking Wizard Modal */}
      <BookingModal 
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        initialType={bookingModalType}
        initialData={bookingModalData}
        onBookingComplete={handleBookingComplete}
      />

      {/* Booking Success Confirmation Modal */}
      <BookingSuccessModal 
        booking={activeBookingPass}
        onClose={() => setActiveBookingPass(null)}
      />

      {/* Driver Spotlight Profile Modal */}
      <DriverSpotlightModal 
        driver={spotlightDriver}
        onClose={() => setSpotlightDriver(null)}
        onBookDriver={(driver) => openBookingModal('driver', { preferredDriver: driver.name })}
      />

    </div>
  );
}
