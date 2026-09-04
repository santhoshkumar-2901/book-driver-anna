import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Car, Users, TrendingUp, DollarSign, MapPin, Clock, 
  Calendar, ShieldCheck, CheckCircle2, AlertCircle, Search, Filter, 
  ChevronRight, Phone, ArrowUpRight, Check, X, Lock, Mail, User, Key, LogOut, ArrowRight, Eye, EyeOff, GraduationCap, Ban,
  Trash2, UserPlus, AlertTriangle, ShieldAlert, Award, Star, UserCheck
} from 'lucide-react';
import { SteeringWheel, WhatsAppIcon } from '../components/Icons';
import { BANGALORE_AREAS, FEATURED_DRIVERS, VEHICLE_SERVICES, DEFAULT_REGISTERED_DRIVERS } from '../data/mockData';
import DrivingClassEnrollmentModal from '../components/DrivingClassEnrollmentModal';
import { toDDMMYYYY } from '../utils/dateUtils';
import useScrollLock from '../utils/useScrollLock';
import { apiClient } from '../services/apiClient';

// Default Mock Driver Bookings
const DEFAULT_DRIVER_BOOKINGS = [
  {
    id: 'BDA-DRV-9801',
    customerName: 'Rahul Dravid',
    phone: '+91 98450 12345',
    tripType: 'one-way',
    tripTitle: 'One Way Trip',
    pickupArea: 'Indiranagar',
    dropLocation: 'Kempegowda Intl Airport (BLR T1/T2)',
    passengers: '2',
    luggage: '3 bags',
    acPreference: 'AC',
    date: '2026-09-02',
    time: '06:30 AM',
    fare: 249,
    status: 'Pending',
    assignedDriver: '',
    bookedAt: '10 Mins ago'
  },
  {
    id: 'BDA-DRV-9802',
    customerName: 'Priya Sharma',
    phone: '+91 97312 88490',
    tripType: 'round-trip',
    tripTitle: 'Round Trip (4hr)',
    pickupArea: 'Koramangala',
    dropLocation: 'Koramangala 5th Block (Multiple Stops)',
    passengers: '1',
    luggage: '1 bag',
    acPreference: 'AC',
    date: '2026-09-01',
    time: '02:00 PM',
    fare: 349,
    status: 'Assigned',
    assignedDriver: "Manjunath 'Manja' Gowda",
    bookedAt: '35 Mins ago'
  },
  {
    id: 'BDA-DRV-9803',
    customerName: 'Vikram Mehta',
    phone: '+91 99001 54321',
    tripType: 'outstation',
    tripTitle: 'Outstation Trip (Round trip 46hr)',
    pickupArea: 'Whitefield',
    dropLocation: 'Coorg (Madikeri Homestay)',
    passengers: '4',
    luggage: '4 bags',
    acPreference: 'AC',
    date: '2026-09-05',
    time: '05:00 AM',
    fare: 2398,
    status: 'Assigned',
    assignedDriver: 'Ramesh Kumar K.',
    bookedAt: '2 Hours ago'
  },
  {
    id: 'BDA-DRV-9804',
    customerName: 'Sanjana Rao',
    phone: '+91 98861 09876',
    tripType: 'one-way',
    tripTitle: 'One Way Trip',
    pickupArea: 'HSR Layout',
    dropLocation: 'Electronic City Phase 1',
    passengers: '1',
    luggage: '0 bags',
    acPreference: 'Non-AC',
    date: '2026-09-01',
    time: '07:15 PM',
    fare: 249,
    status: 'Completed',
    assignedDriver: 'Venkatesh Prasad',
    bookedAt: '4 Hours ago'
  },
  {
    id: 'BDA-DRV-9805',
    customerName: 'Rajesh Shenoy',
    phone: '+91 98451 22334',
    tripType: 'round-trip',
    tripTitle: 'Round Trip (6hr)',
    pickupArea: 'Jayanagar',
    dropLocation: 'Bannerghatta National Park & Return',
    passengers: '3',
    luggage: '2 bags',
    acPreference: 'AC',
    vehicleType: 'Automatic',
    date: '2026-09-02',
    time: '09:00 AM',
    fare: 549,
    status: 'Cancelled',
    cancelReason: 'Change of family weekend travel plans',
    assignedDriver: '',
    assignedDriverPhone: '',
    bookedAt: '5 Hours ago'
  },
  {
    id: 'BDA-DRV-9806',
    customerName: 'Ananth Padmanabhan',
    phone: '+91 97422 67890',
    tripType: 'outstation',
    tripTitle: 'Outstation Trip (One Way Drop Up to 300 km)',
    pickupArea: 'Indiranagar',
    dropLocation: 'Mysuru (Gokulam)',
    passengers: '2',
    luggage: '2 bags',
    acPreference: 'AC',
    vehicleType: 'Manual',
    date: '2026-09-06',
    time: '06:30 AM',
    fare: 1889,
    status: 'Pending',
    assignedDriver: '',
    assignedDriverPhone: '',
    bookedAt: '40 Mins ago'
  }
];

// Default Mock Vehicle Bookings
const DEFAULT_VEHICLE_BOOKINGS = [
  {
    id: 'BDA-VEH-4101',
    customerName: 'Kavitha N.',
    phone: '+91 98440 99887',
    vehicleName: 'Sedan (Dzire / Honda City)',
    category: 'Sedan',
    rentalType: 'Full Day (24 hrs)',
    pickupArea: 'Indiranagar',
    dropLocation: 'City Tour & Airport Return',
    passengers: '3',
    luggage: '2 bags',
    acPreference: 'AC',
    date: '2026-09-02',
    time: '08:00 AM',
    fare: 1999,
    status: 'Confirmed',
    vehicleRegNumber: 'KA-01-MJ-4321',
    bookedAt: '25 Mins ago'
  },
  {
    id: 'BDA-VEH-4102',
    customerName: 'Infosys Team (Deepak)',
    phone: '+91 99800 11223',
    vehicleName: 'SUV (Toyota Innova Crysta)',
    category: 'SUV',
    rentalType: 'Outstation Trip',
    pickupArea: 'Electronic City',
    dropLocation: 'Mysuru Expressway Run',
    passengers: '6',
    luggage: '5 bags',
    acPreference: 'AC',
    date: '2026-09-04',
    time: '06:00 AM',
    fare: 4549,
    status: 'Pending',
    vehicleRegNumber: 'Unassigned',
    bookedAt: '1 Hour ago'
  },
  {
    id: 'BDA-VEH-4103',
    customerName: 'Suresh Gowda',
    phone: '+91 97400 55443',
    vehicleName: '12 Seater Luxury Tempo',
    category: '12 Seater',
    rentalType: 'Outstation Trip',
    pickupArea: 'Yelahanka',
    dropLocation: 'Nandi Hills & Chikmagalur',
    passengers: '11',
    luggage: '8 bags',
    acPreference: 'AC',
    date: '2026-09-06',
    time: '04:30 AM',
    fare: 7148,
    status: 'Confirmed',
    vehicleRegNumber: 'KA-04-TP-9988',
    bookedAt: '3 Hours ago'
  },
  {
    id: 'BDA-VEH-4104',
    customerName: 'Pooja Hegde',
    phone: '+91 99160 44556',
    vehicleName: 'Sedan (Dzire / Honda City)',
    category: 'Sedan',
    rentalType: 'Round Trip Rental',
    pickupArea: 'Malleshwaram',
    dropLocation: 'Mysuru Palace Tour',
    passengers: '2',
    luggage: '2 bags',
    acPreference: 'AC',
    date: '2026-09-03',
    time: '07:00 AM',
    fare: 2899,
    status: 'Cancelled',
    cancelReason: 'Flight delayed / Meeting rescheduled',
    vehicleRegNumber: 'Unassigned',
    bookedAt: '4 Hours ago'
  }
];

// Default Mock Class Enrollments
const DEFAULT_CLASS_ENROLLMENTS = [
  {
    enrollmentId: 'ENR-CLS-884102',
    fullName: 'Ananya Deshmukh',
    dateOfBirth: '12/04/1998',
    gender: 'Female',
    mobileNumber: '9845012345',
    emailAddress: 'ananya.d@gmail.com',
    address: '#42, 12th Main, Indiranagar, Bengaluru',
    drivingExperience: 'No Experience',
    gearPreference: 'Manual',
    learnersLicenseStatus: 'Yes',
    drivingLicenseStatus: 'No',
    preferredStartDate: '05/09/2026',
    preferredTime: 'Morning',
    pickupRequired: 'Yes',
    pickupLocation: 'Near Defence Colony Play Ground, Indiranagar',
    additionalNotes: 'Need a patient female/senior instructor if available.',
    submittedAt: '02/09/2026',
    status: 'In Training',
    assignedInstructor: 'Syed Nizamuddin',
    assignedInstructorPhone: '+91 98860 54321'
  },
  {
    enrollmentId: 'ENR-CLS-884103',
    fullName: 'Kiran Varun',
    dateOfBirth: '23/11/1995',
    gender: 'Male',
    mobileNumber: '9731288490',
    emailAddress: 'kiran.varun@yahoo.com',
    address: 'Flat 304, Prestige Ozone, Whitefield, Bengaluru',
    drivingExperience: 'Some Experience',
    gearPreference: 'Automatic',
    learnersLicenseStatus: 'Yes',
    drivingLicenseStatus: 'Yes',
    preferredStartDate: '07/09/2026',
    preferredTime: 'Evening',
    pickupRequired: 'No',
    pickupLocation: '',
    additionalNotes: 'Want refresher practice on Silk Board and Outer Ring Road flyovers.',
    submittedAt: '02/09/2026',
    status: 'In Training',
    assignedInstructor: 'Manjunath Gowda',
    assignedInstructorPhone: '+91 98451 99882'
  },
  {
    enrollmentId: 'ENR-CLS-884104',
    fullName: 'Deepa Srinivas',
    dateOfBirth: '19/08/2001',
    gender: 'Female',
    mobileNumber: '9900154321',
    emailAddress: 'deepa.s@outlook.com',
    address: '7th Cross, 4th Block, Koramangala, Bengaluru',
    drivingExperience: 'Beginner',
    gearPreference: 'Manual',
    learnersLicenseStatus: 'No',
    drivingLicenseStatus: 'No',
    preferredStartDate: '10/09/2026',
    preferredTime: 'Morning',
    pickupRequired: 'Yes',
    pickupLocation: 'Near Sony World Signal, Koramangala',
    additionalNotes: 'Need guidance for Learner License application as well.',
    submittedAt: '02/09/2026',
    status: 'Pending',
    assignedInstructor: '',
    assignedInstructorPhone: ''
  },
  {
    enrollmentId: 'ENR-CLS-884105',
    fullName: 'Rahul Nair',
    dateOfBirth: '14/06/1997',
    gender: 'Male',
    mobileNumber: '98452 77889',
    emailAddress: 'rahul.nair@techblr.com',
    address: '#18, 5th Main, BTM 2nd Stage, Bengaluru',
    drivingExperience: 'No Experience',
    gearPreference: 'Automatic',
    learnersLicenseStatus: 'No',
    drivingLicenseStatus: 'No',
    preferredStartDate: '08/09/2026',
    preferredTime: 'Morning',
    pickupRequired: 'Yes',
    pickupLocation: 'Near Udupi Garden Signal, BTM',
    additionalNotes: 'Want early morning 6:30 AM batch slot.',
    submittedAt: '02/09/2026',
    status: 'Cancelled',
    cancelReason: 'Work transfer to Hyderabad office',
    assignedInstructor: '',
    assignedInstructorPhone: ''
  }
];

// Default Registered Clients / Users
const DEFAULT_REGISTERED_CLIENTS = [
  {
    id: 'CLI-901',
    name: 'Rahul Sharma',
    email: 'rahul.sharma@example.com',
    phone: '+91 98860 12345',
    area: 'Indiranagar',
    status: 'Active',
    createdAt: '2026-09-01'
  },
  {
    id: 'CLI-902',
    name: 'Priya Sharma',
    email: 'priya@gmail.com',
    phone: '+91 98441 56789',
    area: 'Koramangala',
    status: 'Active',
    createdAt: '2026-09-02'
  },
  {
    id: 'CLI-903',
    name: 'Anand Rao',
    email: 'anand.rao@outlook.com',
    phone: '+91 99002 33445',
    area: 'Whitefield',
    status: 'Active',
    createdAt: '2026-09-02'
  },
  {
    id: 'CLI-904',
    name: 'Deepika Nair',
    email: 'deepika.nair@gmail.com',
    phone: '+91 98450 67890',
    area: 'HSR Layout',
    status: 'Active',
    createdAt: '2026-09-03'
  },
  {
    id: 'CLI-905',
    name: 'Karthik Swamy',
    email: 'karthik.s@gmail.com',
    phone: '+91 97410 88990',
    area: 'Jayanagar',
    status: 'Active',
    createdAt: '2026-09-03'
  }
];

export default function AdminPage({ onReturnToClient }) {
  // Persistent Authentication State (persists across page refreshes)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    return localStorage.getItem('bda_admin_logged_in') === 'true';
  });
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  
  // Auth Form Fields
  const [authEmail, setAuthEmail] = useState('admin@bookdriveranna.com');
  const [authPassword, setAuthPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false); // Show / Hide Password toggle state
  const [authFullName, setAuthFullName] = useState('Manjunath Anna');
  const [authPhone, setAuthPhone] = useState('+91 98860 12345');
  const [authSecretKey, setAuthSecretKey] = useState('ANNA2026');
  const [authError, setAuthError] = useState('');
  
  // Logged-in Admin Info
  const [loggedInAdminName, setLoggedInAdminName] = useState(() => {
    return localStorage.getItem('bda_admin_name') || 'Manjunath Anna';
  });
  const [loggedInAdminPhone, setLoggedInAdminPhone] = useState(() => {
    return localStorage.getItem('bda_admin_phone') || '+91 98860 12345';
  });

  // Sidebar Tab State (after login)
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'for-driver', 'for-vehicle'

  // Persistent Driver Bookings State
  const [driverBookings, setDriverBookings] = useState(() => {
    const saved = localStorage.getItem('bda_driver_bookings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasCancelled = parsed.some(b => b.status === 'Cancelled');
          if (!hasCancelled) {
            const cancelledExample = DEFAULT_DRIVER_BOOKINGS.find(b => b.status === 'Cancelled');
            if (cancelledExample) {
              const merged = [...parsed, cancelledExample];
              localStorage.setItem('bda_driver_bookings', JSON.stringify(merged));
              return merged;
            }
          }
          return parsed;
        }
      } catch (e) { console.error(e); }
    }
    localStorage.setItem('bda_driver_bookings', JSON.stringify(DEFAULT_DRIVER_BOOKINGS));
    return DEFAULT_DRIVER_BOOKINGS;
  });

  // Persistent Vehicle Bookings State
  const [vehicleBookings, setVehicleBookings] = useState(() => {
    const saved = localStorage.getItem('bda_vehicle_bookings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasCancelled = parsed.some(b => b.status === 'Cancelled');
          if (!hasCancelled) {
            const cancelledExample = DEFAULT_VEHICLE_BOOKINGS.find(b => b.status === 'Cancelled');
            if (cancelledExample) {
              const merged = [...parsed, cancelledExample];
              localStorage.setItem('bda_vehicle_bookings', JSON.stringify(merged));
              return merged;
            }
          }
          return parsed;
        }
      } catch (e) { console.error(e); }
    }
    localStorage.setItem('bda_vehicle_bookings', JSON.stringify(DEFAULT_VEHICLE_BOOKINGS));
    return DEFAULT_VEHICLE_BOOKINGS;
  });

  // Persistent Driving Class Enrollments State
  const [classEnrollments, setClassEnrollments] = useState(() => {
    const saved = localStorage.getItem('bda_class_enrollments');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasCancelled = parsed.some(e => e.status === 'Cancelled');
          if (!hasCancelled) {
            const cancelledExample = DEFAULT_CLASS_ENROLLMENTS.find(e => e.status === 'Cancelled');
            if (cancelledExample) {
              const merged = [...parsed, cancelledExample];
              localStorage.setItem('bda_class_enrollments', JSON.stringify(merged));
              return merged;
            }
          }
          return parsed;
        }
      } catch (e) { console.error(e); }
    }
    localStorage.setItem('bda_class_enrollments', JSON.stringify(DEFAULT_CLASS_ENROLLMENTS));
    return DEFAULT_CLASS_ENROLLMENTS;
  });

  const [isAdminEnrollmentModalOpen, setIsAdminEnrollmentModalOpen] = useState(false);

  // Persistent Registered Users / Clients State
  const [registeredUsers, setRegisteredUsers] = useState(() => {
    try {
      const saved = localStorage.getItem('bda_registered_clients');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    localStorage.setItem('bda_registered_clients', JSON.stringify(DEFAULT_REGISTERED_CLIENTS));
    return DEFAULT_REGISTERED_CLIENTS;
  });

  // Persistent Registered Driver Partners State
  const [registeredDrivers, setRegisteredDrivers] = useState(() => {
    try {
      const saved = localStorage.getItem('bda_registered_drivers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    localStorage.setItem('bda_registered_drivers', JSON.stringify(DEFAULT_REGISTERED_DRIVERS));
    return DEFAULT_REGISTERED_DRIVERS;
  });

  // Sub-Tab Switcher in Users Section: 'customers' | 'drivers'
  const [userSubTab, setUserSubTab] = useState('customers');

  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userAreaFilter, setUserAreaFilter] = useState('All');

  // Add Client Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserArea, setNewUserArea] = useState('Indiranagar');

  // Add Driver Anna Modal State
  const [isAddDriverModalOpen, setIsAddDriverModalOpen] = useState(false);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [newDriverDl, setNewDriverDl] = useState('');
  const [newDriverVehicleType, setNewDriverVehicleType] = useState('Manual & Automatic Cars');
  const [newDriverArea, setNewDriverArea] = useState('Indiranagar');
  const [newDriverExperience, setNewDriverExperience] = useState('5 Years');

  // State for Serious Questions Account Deletion Modal (Customer or Driver)
  const [userToDelete, setUserToDelete] = useState(null);
  const [deletionReason, setDeletionReason] = useState('');

  useScrollLock(Boolean(userToDelete || isAddUserModalOpen || isAddDriverModalOpen));
  const [customDeletionReason, setCustomDeletionReason] = useState('');
  const [hasNoActiveTrips, setHasNoActiveTrips] = useState(false);
  const [hasSettledPayments, setHasSettledPayments] = useState(false);
  const [understandsIrreversible, setUnderstandsIrreversible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [userActionToast, setUserActionToast] = useState(null);

  const handleOpenDeleteUserModal = (user) => {
    setUserToDelete(user);
    setDeletionReason('');
    setCustomDeletionReason('');
    setHasNoActiveTrips(false);
    setHasSettledPayments(false);
    setUnderstandsIrreversible(false);
    setDeleteConfirmText('');
  };

  const handleCloseDeleteUserModal = () => {
    setUserToDelete(null);
    setDeletionReason('');
    setCustomDeletionReason('');
    setHasNoActiveTrips(false);
    setHasSettledPayments(false);
    setUnderstandsIrreversible(false);
    setDeleteConfirmText('');
  };

  // Lock background scroll when user deletion modal is open
  useEffect(() => {
    if (userToDelete) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow || 'unset';
      };
    }
  }, [userToDelete]);

  const isSecurityPhraseValid = userToDelete && (
    deleteConfirmText.trim().toUpperCase() === 'DELETE' ||
    deleteConfirmText.trim().toLowerCase() === userToDelete.name.toLowerCase()
  );

  const isReasonValid = deletionReason && (
    deletionReason !== 'Other administrative reason (specify below)' ||
    customDeletionReason.trim().length >= 5
  );

  const canExecuteDelete = 
    Boolean(userToDelete) &&
    Boolean(isReasonValid) &&
    hasNoActiveTrips &&
    hasSettledPayments &&
    understandsIrreversible &&
    Boolean(isSecurityPhraseValid);

  const handleConfirmDeleteUser = () => {
    if (!userToDelete) return;
    const targetName = userToDelete.name;
    const targetId = userToDelete.id;
    const isDriverTarget = Boolean(userToDelete.dlNumber || (userToDelete.id && userToDelete.id.startsWith('DRV-')));

    if (isDriverTarget) {
      const updated = registeredDrivers.filter(d => d.id !== userToDelete.id);
      setRegisteredDrivers(updated);
      localStorage.setItem('bda_registered_drivers', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('bda_driver_registered'));

      // If active driver session matches, clear it
      try {
        const activeDriver = JSON.parse(localStorage.getItem('bda_driver_partner') || 'null');
        if (activeDriver && (activeDriver.id === userToDelete.id || activeDriver.phone === userToDelete.phone)) {
          localStorage.removeItem('bda_driver_partner');
          localStorage.removeItem('bda_active_driver_role');
          window.dispatchEvent(new CustomEvent('bda_auth_state_changed'));
        }
      } catch (e) {}

      setUserActionToast(`Driver Anna ${targetName} (${targetId}) was permanently removed from the fleet database.`);
    } else {
      const updated = registeredUsers.filter(u => u.id !== userToDelete.id);
      setRegisteredUsers(updated);
      localStorage.setItem('bda_registered_clients', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('bda_client_registered'));

      // Check if this user is active in current client session and clear if so
      try {
        const session = JSON.parse(localStorage.getItem('bda_client_session') || 'null');
        if (session && (session.id === userToDelete.id || session.phone === userToDelete.phone || session.email === userToDelete.email)) {
          localStorage.removeItem('bda_client_session');
          window.dispatchEvent(new CustomEvent('bda_auth_state_changed'));
        }
      } catch (e) {
        console.error('Session sync error on user removal:', e);
      }

      setUserActionToast(`Client ${targetName} (${targetId}) was permanently removed from the database.`);
    }

    handleCloseDeleteUserModal();

    setTimeout(() => {
      setUserActionToast(null);
    }, 5000);
  };

  // Real-time synchronization listener for client bookings submitted anywhere across tabs/app
  useEffect(() => {
    const loadBookingsFromStorage = () => {
      const savedDriver = localStorage.getItem('bda_driver_bookings');
      if (savedDriver) {
        try { setDriverBookings(JSON.parse(savedDriver)); } catch (e) {}
      }
      const savedVehicle = localStorage.getItem('bda_vehicle_bookings');
      if (savedVehicle) {
        try { setVehicleBookings(JSON.parse(savedVehicle)); } catch (e) {}
      }
      const savedClasses = localStorage.getItem('bda_class_enrollments');
      if (savedClasses) {
        try { setClassEnrollments(JSON.parse(savedClasses)); } catch (e) {}
      }
      const savedUsers = localStorage.getItem('bda_registered_clients');
      if (savedUsers) {
        try { setRegisteredUsers(JSON.parse(savedUsers)); } catch (e) {}
      }
      const savedDrivers = localStorage.getItem('bda_registered_drivers');
      if (savedDrivers) {
        try { setRegisteredDrivers(JSON.parse(savedDrivers)); } catch (e) {}
      }
    };

    window.addEventListener('bda_booking_updated', loadBookingsFromStorage);
    window.addEventListener('bda_order_created', loadBookingsFromStorage);
    window.addEventListener('bda_client_registered', loadBookingsFromStorage);
    window.addEventListener('bda_driver_registered', loadBookingsFromStorage);
    window.addEventListener('storage', loadBookingsFromStorage);

    return () => {
      window.removeEventListener('bda_booking_updated', loadBookingsFromStorage);
      window.removeEventListener('bda_order_created', loadBookingsFromStorage);
      window.removeEventListener('bda_client_registered', loadBookingsFromStorage);
      window.removeEventListener('bda_driver_registered', loadBookingsFromStorage);
      window.removeEventListener('storage', loadBookingsFromStorage);
    };
  }, []);

  // Save driver bookings to localStorage whenever updated
  useEffect(() => {
    localStorage.setItem('bda_driver_bookings', JSON.stringify(driverBookings));
  }, [driverBookings]);

  // Save vehicle bookings to localStorage whenever updated
  useEffect(() => {
    localStorage.setItem('bda_vehicle_bookings', JSON.stringify(vehicleBookings));
  }, [vehicleBookings]);

  // Save registered users to localStorage whenever updated
  useEffect(() => {
    localStorage.setItem('bda_registered_clients', JSON.stringify(registeredUsers));
  }, [registeredUsers]);

  // Save registered drivers to localStorage whenever updated
  useEffect(() => {
    localStorage.setItem('bda_registered_drivers', JSON.stringify(registeredDrivers));
  }, [registeredDrivers]);

  // Save class enrollments to localStorage whenever updated
  useEffect(() => {
    localStorage.setItem('bda_class_enrollments', JSON.stringify(classEnrollments));
  }, [classEnrollments]);

  // Search & Filters
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [driverStatusFilter, setDriverStatusFilter] = useState('All');

  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState('All');

  const [classSearchQuery, setClassSearchQuery] = useState('');
  const [classStatusFilter, setClassStatusFilter] = useState('All');

  // Handle Login & Registration with server-side authentication
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Please enter email and password');
      return;
    }

    try {
      const res = await apiClient.adminLogin({
        identifier: authEmail.trim(),
        password: authPassword.trim()
      });

      if (res && res.data && res.data.user) {
        setLoggedInAdminName(res.data.user.name);
        setLoggedInAdminPhone(res.data.user.phone);
        setIsAdminLoggedIn(true);
        localStorage.setItem('bda_admin_logged_in', 'true');
        localStorage.setItem('bda_admin_name', res.data.user.name);
        localStorage.setItem('bda_admin_phone', res.data.user.phone);
        return;
      }
    } catch (apiErr) {
      if (apiErr.code !== 'NETWORK_ERROR') {
        setAuthError(apiErr.message || 'Admin authentication failed.');
        return;
      }
    }

    let nameToSave = loggedInAdminName;
    let phoneToSave = loggedInAdminPhone;

    if (authMode === 'register') {
      if (!authFullName.trim()) {
        setAuthError('Please enter your full name');
        return;
      }
      if (!authPhone.trim()) {
        setAuthError('Please enter your admin phone number');
        return;
      }
      if (authSecretKey.trim() !== 'ANNA2026') {
        setAuthError('Invalid Admin Secret Key (Demo Key: ANNA2026)');
        return;
      }
      nameToSave = authFullName;
      phoneToSave = authPhone;
    } else {
      nameToSave = authFullName || 'Admin Anna';
      phoneToSave = authPhone || loggedInAdminPhone;
    }

    setLoggedInAdminName(nameToSave);
    setLoggedInAdminPhone(phoneToSave);
    setIsAdminLoggedIn(true);

    // Save session to localStorage
    localStorage.setItem('bda_admin_logged_in', 'true');
    localStorage.setItem('bda_admin_name', nameToSave);
    localStorage.setItem('bda_admin_phone', phoneToSave);
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch (e) {}
    localStorage.removeItem('bda_admin_logged_in');
    localStorage.removeItem('bda_admin_name');
    localStorage.removeItem('bda_admin_phone');
    setIsAdminLoggedIn(false);
    setActiveTab('dashboard');
  };

  // State map for admin-typed driver details (bookingId -> { name, phone })
  const [driverInputState, setDriverInputState] = useState({});

  const handleDriverInputChange = (bookingId, field, value) => {
    setDriverInputState(prev => ({
      ...prev,
      [bookingId]: {
        ...prev[bookingId],
        [field]: value
      }
    }));
  };

  // State map for admin-typed instructor details (enrollmentId -> { name, phone })
  const [instructorInputState, setInstructorInputState] = useState({});

  const handleInstructorInputChange = (enrollmentId, field, value) => {
    setInstructorInputState(prev => ({
      ...prev,
      [enrollmentId]: {
        ...prev[enrollmentId],
        [field]: value
      }
    }));

    setClassEnrollments(prev => {
      const updated = prev.map(e => {
        if (e.enrollmentId === enrollmentId) {
          return {
            ...e,
            assignedInstructor: field === 'name' ? value : (e.assignedInstructor || ''),
            assignedInstructorPhone: field === 'phone' ? value : (e.assignedInstructorPhone || '')
          };
        }
        return e;
      });
      localStorage.setItem('bda_class_enrollments', JSON.stringify(updated));
      return updated;
    });
  };

  // Accept & Assign driver booking with admin-typed driver name and phone
  const handleAcceptAndAssignDriver = (bookingId) => {
    const typedName = driverInputState[bookingId]?.name?.trim();
    const typedPhone = driverInputState[bookingId]?.phone?.trim();

    setDriverBookings(prev => prev.map(b => {
      if (b.id === bookingId) {
        const finalName = typedName || b.assignedDriver || "Manjunath Anna";
        const finalPhone = typedPhone || b.assignedDriverPhone || "+91 98860 12345";
        return {
          ...b,
          assignedDriver: finalName,
          assignedDriverPhone: finalPhone,
          status: 'Assigned'
        };
      }
      return b;
    }));
  };

  // WhatsApp Sender ONLY to Client (Enabled ONLY after Accept & Assign)
  const sendWhatsAppToClientForDriver = (booking) => {
    if (booking.status === 'Pending') {
      alert("⚠️ Please click 'Accept & Assign' first to assign the driver before sending WhatsApp message to client!");
      return;
    }

    const cleanClientPhone = booking.phone.replace(/[^0-9]/g, '');

    if (booking.status === 'Cancelled') {
      const cancelMsg = `🚖 *BOOK DRIVER ANNA - BOOKING CANCELLED* 🚖\n\n` +
        `Namaskara *${booking.customerName}*,\n` +
        `Your driver booking request (Ref: ${booking.id}) has been cancelled. Zero cancellation charges apply.\n\n` +
        `If this cancellation was unexpected or you need a replacement driver, please reach our 24x7 helpdesk at +91 98860 12345. Thank you!`;
      window.open(`https://api.whatsapp.com/send?phone=${cleanClientPhone}&text=${encodeURIComponent(cancelMsg)}`, '_blank');
      return;
    }

    const driverName = booking.assignedDriver || "Manjunath Anna";
    const driverPhone = booking.assignedDriverPhone || "+91 98860 12345";

    const message = `🚖 *BOOK DRIVER ANNA - TRIP ACCEPTED* 🚖\n\n` +
      `Namaskara *${booking.customerName}*,\n` +
      `Your driver booking request has been accepted & assigned!\n\n` +
      `📌 *Booking Ref:* ${booking.id}\n` +
      `👨‍✈️ *Assigned Driver:* ${driverName}\n` +
      `📞 *Driver Contact:* ${driverPhone}\n` +
      `📍 *Pickup Area:* ${booking.pickupArea}\n` +
      `🏁 *Drop Location:* ${booking.dropLocation}\n` +
      (booking.passengers ? `🚗 *Vehicle Specs:* ${booking.acPreference || 'AC'} (${booking.passengers}, ${booking.luggage || 'No Luggage'})\n` : '') +
      `📅 *Pickup Schedule:* ${toDDMMYYYY(booking.date)} at ${booking.time}\n` +
      `💰 *Estimated Fare:* ₹${booking.fare}\n\n` +
      `Thank you for choosing Book Driver Anna! Safe Journey!`;

    window.open(`https://api.whatsapp.com/send?phone=${cleanClientPhone}&text=${encodeURIComponent(message)}`, '_blank');
  };

  // WhatsApp Sender ONLY to Client for Vehicle (Enabled ONLY after Accept & Confirm)
  const sendWhatsAppToClientForVehicle = (booking) => {
    if (booking.status === 'Pending') {
      alert("⚠️ Please click 'Accept & Confirm' first before sending WhatsApp message to client!");
      return;
    }

    const cleanClientPhone = booking.phone.replace(/[^0-9]/g, '');

    if (booking.status === 'Cancelled') {
      const cancelMsg = `🚘 *BOOK DRIVER ANNA - VEHICLE BOOKING CANCELLED* 🚘\n\n` +
        `Namaskara *${booking.customerName}*,\n` +
        `Your vehicle rental booking (Ref: ${booking.id}) has been cancelled. Zero cancellation charges apply.\n\n` +
        `For queries or rebooking, call our 24x7 fleet desk at +91 98860 12345. Thank you!`;
      window.open(`https://api.whatsapp.com/send?phone=${cleanClientPhone}&text=${encodeURIComponent(cancelMsg)}`, '_blank');
      return;
    }

    const message = `🚘 *BOOK DRIVER ANNA - VEHICLE CONFIRMED* 🚘\n\n` +
      `Namaskara *${booking.customerName}*,\n` +
      `Your vehicle rental booking has been accepted & confirmed!\n\n` +
      `📌 *Booking Ref:* ${booking.id}\n` +
      `🚗 *Vehicle Reserved:* ${booking.vehicleName}\n` +
      `🔢 *Registration No:* ${booking.vehicleRegNumber || 'KA-01-MJ-4321'}\n` +
      `📍 *Pickup Location:* ${booking.pickupArea}\n` +
      `📅 *Pickup Schedule:* ${toDDMMYYYY(booking.date)} at ${booking.time}\n` +
      `💰 *Rental Fare:* ₹${booking.fare}\n\n` +
      `Thank you for choosing Book Driver Anna! Have a smooth drive!`;

    window.open(`https://api.whatsapp.com/send?phone=${cleanClientPhone}&text=${encodeURIComponent(message)}`, '_blank');
  };

  // Quick Action: Update driver booking status
  const handleUpdateDriverStatus = (bookingId, newStatus) => {
    setDriverBookings(prev => prev.map(b => {
      if (b.id === bookingId) {
        return { ...b, status: newStatus };
      }
      return b;
    }));
  };

  // Quick Action: Update vehicle booking status
  const handleUpdateVehicleStatus = (bookingId, newStatus) => {
    setVehicleBookings(prev => prev.map(b => {
      if (b.id === bookingId) {
        return { ...b, status: newStatus };
      }
      return b;
    }));
  };

  // Quick Action: Update class enrollment status (Pending, In Training, Completed, Cancelled)
  const handleUpdateClassStatus = (enrollmentId, newStatus) => {
    const typedName = instructorInputState[enrollmentId]?.name?.trim();
    const typedPhone = instructorInputState[enrollmentId]?.phone?.trim();

    setClassEnrollments(prev => {
      const updated = prev.map(e => {
        if (e.enrollmentId === enrollmentId) {
          return {
            ...e,
            status: newStatus,
            assignedInstructor: typedName !== undefined && typedName !== '' ? typedName : (e.assignedInstructor || ''),
            assignedInstructorPhone: typedPhone !== undefined && typedPhone !== '' ? typedPhone : (e.assignedInstructorPhone || '')
          };
        }
        return e;
      });
      localStorage.setItem('bda_class_enrollments', JSON.stringify(updated));
      return updated;
    });
  };

  // WhatsApp Sender to Candidate (Enabled for In Training, Completed, or Cancelled)
  const sendWhatsAppToCandidate = (enrollment) => {
    if (enrollment.status === 'Pending') {
      alert("⚠️ Candidate is currently in Pending status. Please set status to 'In Training' or 'Completed' first before sending WhatsApp message to client!");
      return;
    }

    const cleanPhone = (enrollment.mobileNumber || '').replace(/[^0-9]/g, '');

    if (enrollment.status === 'Cancelled') {
      const cancelMsg = `🎓 *BOOK DRIVER ANNA — ENROLLMENT CANCELLED* 🎓\n\n` +
        `Namaskara *${enrollment.fullName}*!\n` +
        `Your driving class enrollment (Ref: ${enrollment.enrollmentId}) has been cancelled. Zero cancellation charges apply.\n\n` +
        `For re-enrollment or queries, please reach our academy desk at +91 98860 12345. Thank you!`;
      window.open(`https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(cancelMsg)}`, '_blank');
      return;
    }

    const currentName = instructorInputState[enrollment.enrollmentId]?.name?.trim() || enrollment.assignedInstructor || "Syed Nizamuddin";
    const currentPhone = instructorInputState[enrollment.enrollmentId]?.phone?.trim() || enrollment.assignedInstructorPhone || "+91 98860 54321";

    const instructorText = `👨‍🏫 *Assigned Instructor Anna:* ${currentName} (${currentPhone})\n`;

    let headerStatus = `🎓 *BOOK DRIVER ANNA — DRIVING CLASS IN TRAINING* 🎓`;
    let statusGreeting = `Your car driving class training is now active and in progress with Book Driver Anna Academy.`;
    if (enrollment.status === 'Completed') {
      headerStatus = `🏆 *BOOK DRIVER ANNA — DRIVING COURSE COMPLETED* 🏆`;
      statusGreeting = `Congratulations! You have successfully completed your car driving course training with Book Driver Anna Academy!`;
    }

    const message = `${headerStatus}\n\n` +
      `Namaskara *${enrollment.fullName}*!\n` +
      `${statusGreeting}\n\n` +
      `📌 *Enrollment Ref:* ${enrollment.enrollmentId}\n` +
      `📊 *Training Status:* ${enrollment.status}\n` +
      `⚙️ *Gear Preference:* ${enrollment.gearPreference}\n` +
      `📅 *Start Date:* ${toDDMMYYYY(enrollment.preferredStartDate)}\n` +
      `⏰ *Daily Time Slot:* ${enrollment.preferredTime}\n` +
      `📍 *Doorstep Pickup:* ${enrollment.pickupRequired === 'Yes' ? 'Yes (' + (enrollment.pickupLocation || enrollment.address) + ')' : 'No (Center Session)'}\n` +
      `📄 *Learner's License:* ${enrollment.learnersLicenseStatus}\n` +
      `🪪 *Driving License:* ${enrollment.drivingLicenseStatus}\n` +
      instructorText +
      `\nFor any queries or schedule updates, reach our academy desk at +91 98860 12345. Happy & safe driving with Book Driver Anna! 🚗✨`;

    window.open(`https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
  };

  // Filtered driver bookings
  const filteredDriverBookings = driverBookings.filter(b => {
    const matchesSearch = b.customerName.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
                          b.id.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
                          b.pickupArea.toLowerCase().includes(driverSearchQuery.toLowerCase());
    const matchesStatus = driverStatusFilter === 'All' || b.status === driverStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered vehicle bookings
  const filteredVehicleBookings = vehicleBookings.filter(b => {
    const matchesSearch = b.customerName.toLowerCase().includes(vehicleSearchQuery.toLowerCase()) ||
                          b.id.toLowerCase().includes(vehicleSearchQuery.toLowerCase()) ||
                          b.vehicleName.toLowerCase().includes(vehicleSearchQuery.toLowerCase());
    const matchesStatus = vehicleStatusFilter === 'All' || b.status === vehicleStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered class enrollments
  const filteredClassEnrollments = classEnrollments.filter(e => {
    const matchesSearch = (e.fullName || '').toLowerCase().includes(classSearchQuery.toLowerCase()) ||
                          (e.enrollmentId || '').toLowerCase().includes(classSearchQuery.toLowerCase()) ||
                          (e.mobileNumber || '').includes(classSearchQuery) ||
                          (e.address || '').toLowerCase().includes(classSearchQuery.toLowerCase()) ||
                          (e.pickupLocation || '').toLowerCase().includes(classSearchQuery.toLowerCase());
    const matchesStatus = classStatusFilter === 'All' || e.status === classStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // =========================================================================
  // VIEW 1: ADMIN LOGIN / REGISTER SCREEN (If NOT logged in)
  // =========================================================================
  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden">

        {/* Top Header Bar with Search Bar Address Display */}
        <header className="max-w-5xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-400/20">
              <Car className="w-6 h-6 stroke-[2.2]" />
            </div>
            <span className="font-extrabold text-xl text-white font-['Outfit']">
              Book Driver <span className="text-amber-400">Anna</span>
            </span>
          </div>

          {/* Search/URL Address Indicator Bar */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-4 py-1.5 text-xs text-slate-400 w-full sm:w-80 font-mono">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-300 font-semibold truncate">localhost:3000/admin</span>
            <span className="ml-auto text-[10px] bg-slate-800 text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase">
              Secure
            </span>
          </div>

          <button 
            onClick={onReturnToClient}
            className="text-xs text-slate-400 hover:text-white font-semibold flex items-center gap-1 transition-colors"
          >
            Client Site <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
          </button>
        </header>

        {/* Center Admin Authentication Card */}
        <div className="max-w-md mx-auto w-full my-auto py-8 relative z-10">
          
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
            
            {/* Header Badge */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 bg-amber-400/10 text-amber-400 text-xs font-extrabold px-3 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" /> Admin Access Portal
              </div>
              <h2 className="text-2xl font-extrabold text-white font-['Outfit']">
                {authMode === 'login' ? 'Admin Login' : 'Admin Register'}
              </h2>
              <p className="text-slate-400 text-xs">
                {authMode === 'login' 
                  ? 'Sign in to access Bangalore driver & vehicle management dashboard.' 
                  : 'Register a new Administrator account to manage Annas and fleets.'}
              </p>
            </div>

            {/* Auth Tab Switcher (Login / Register) */}
            <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  authMode === 'login'
                    ? 'bg-amber-400 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  authMode === 'register'
                    ? 'bg-amber-400 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Register
              </button>
            </div>

            {/* Error Message Alert */}
            {authError && (
              <div className="bg-red-500/10 text-red-400 border border-red-500/20 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Authentication Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              
              {authMode === 'register' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Full Name *</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text"
                        required
                        placeholder="e.g. Manjunath Gowda"
                        value={authFullName}
                        onChange={(e) => setAuthFullName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Phone Number *</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="tel"
                        required
                        placeholder="+91 98860 12345"
                        value={authPhone}
                        onChange={(e) => setAuthPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Admin Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="email"
                    required
                    placeholder="admin@bookdriveranna.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Password Field with Show / Hide Toggle Button */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Password *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authMode === 'register' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Admin Security Passcode *</label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text"
                      required
                      placeholder="Enter secret key (e.g. ANNA2026)"
                      value={authSecretKey}
                      onChange={(e) => setAuthSecretKey(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">Demo Key: <span className="text-amber-400 font-mono">ANNA2026</span></p>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-400/20 transition-all flex items-center justify-center gap-2 mt-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{authMode === 'login' ? 'Enter Admin Dashboard' : 'Complete Admin Registration'}</span>
              </button>

            </form>

            {/* Quick Demo Credentials Footer */}
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center text-[11px] text-slate-400">
              💡 Demo Access: <span className="text-white font-semibold">admin@bookdriveranna.com</span> / <span className="text-white font-semibold">admin123</span>
            </div>

          </div>

        </div>

        {/* Page Footer */}
        <footer className="text-center text-xs text-slate-500 relative z-10">
          © {new Date().getFullYear()} Book Driver Anna Technologies. Admin Security Portal.
        </footer>

      </div>
    );
  }

  // =========================================================================
  // VIEW 2: LOGGED-IN ADMIN DASHBOARD (WITH SIDEBAR)
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      
      {/* --------------------------------------------------------------------- */}
      {/* SIDEBAR NAVIGATION (STICKY AT VIEWPORT HEIGHT) */}
      {/* --------------------------------------------------------------------- */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 md:h-screen md:sticky md:top-0">
        
        {/* Sidebar Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-400/20">
              <Car className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="font-extrabold text-lg text-white font-['Outfit'] leading-none">
                Book Driver <span className="text-amber-400">Anna</span>
              </div>
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mt-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Admin Portal
              </div>
            </div>
          </div>
        </div>

        {/* Logged in Admin Profile Badge */}
        <div className="p-4 mx-3 my-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-400 font-extrabold text-xs flex items-center justify-center">
            {loggedInAdminName.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-bold text-white truncate">{loggedInAdminName}</div>
            <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <Phone className="w-2.5 h-2.5 text-emerald-400" /> {loggedInAdminPhone}
            </div>
          </div>
        </div>

        {/* Sidebar Navigation Items (Dashboard, For Driver, For Vehicle) */}
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-1">
            Admin Management
          </div>

          {/* Sidebar Item 1: Dashboard */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-5 h-5" />
              <span>Dashboard</span>
            </div>
            {activeTab === 'dashboard' && <ChevronRight className="w-4 h-4" />}
          </button>

          {/* Sidebar Item 2: For Driver */}
          <button
            onClick={() => setActiveTab('for-driver')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
              activeTab === 'for-driver'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <SteeringWheel className="w-5 h-5" />
              <span>For Driver</span>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold ${
              activeTab === 'for-driver' 
                ? 'bg-slate-950 text-amber-400' 
                : 'bg-slate-800 text-amber-400 border border-slate-700'
            }`}>
              {driverBookings.length}
            </span>
          </button>

          {/* Sidebar Item 3: For Vehicle */}
          <button
            onClick={() => setActiveTab('for-vehicle')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
              activeTab === 'for-vehicle'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Car className="w-5 h-5" />
              <span>For Vehicle</span>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold ${
              activeTab === 'for-vehicle' 
                ? 'bg-slate-950 text-amber-400' 
                : 'bg-slate-800 text-amber-400 border border-slate-700'
            }`}>
              {vehicleBookings.length}
            </span>
          </button>

          {/* Sidebar Item 4: For Driving Class */}
          <button
            onClick={() => setActiveTab('for-class')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
              activeTab === 'for-class'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <GraduationCap className="w-5 h-5" />
              <span>For Driving Class</span>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold ${
              activeTab === 'for-class' 
                ? 'bg-slate-950 text-amber-400' 
                : 'bg-slate-800 text-amber-400 border border-slate-700'
            }`}>
              {classEnrollments.length}
            </span>
          </button>

          {/* Sidebar Item 5: Users */}
          <button
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5" />
              <span>Users</span>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold ${
              activeTab === 'users' 
                ? 'bg-slate-950 text-amber-400' 
                : 'bg-slate-800 text-amber-400 border border-slate-700'
            }`}>
              {registeredUsers.length + registeredDrivers.length}
            </span>
          </button>
        </nav>

        {/* Sidebar Footer Controls - Sticky in the bottom */}
        <div className="p-4 border-t border-slate-800 space-y-2 mt-auto sticky bottom-0 bg-slate-900/95 backdrop-blur-md shrink-0 shadow-lg shadow-black/50 z-20">
          
          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-red-400 text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-slate-800 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Admin Logout</span>
          </button>

          <button
            onClick={onReturnToClient}
            className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 text-amber-400" />
            <span>Return to Client Site</span>
          </button>

        </div>

      </aside>

      {/* --------------------------------------------------------------------- */}
      {/* MAIN ADMIN DASHBOARD CONTENT */}
      {/* --------------------------------------------------------------------- */}
      <main className="flex-1 p-6 sm:p-10 overflow-y-auto">
        
        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <span className="bg-amber-400/10 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider">
                  Operational Dashboard
                </span>
                <h1 className="text-3xl font-extrabold text-white font-['Outfit'] mt-2">
                  Bangalore Admin Dashboard
                </h1>
                <p className="text-slate-400 text-xs mt-1">
                  Live operational telemetry for Driver Annas, Client Bookings & Vehicle Fleets across Bangalore.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl text-slate-300 font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" /> Today: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
              
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Revenue</span>
                  <div className="w-9 h-9 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white font-['Outfit']">₹4,85,200</div>
                <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> +14.2% this month
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">Active Drivers</span>
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                    <SteeringWheel className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white font-['Outfit']">1,840</div>
                <div className="text-xs text-slate-400">100% Police Verified</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">Driver Requests</span>
                  <div className="w-9 h-9 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-['Outfit']">{driverBookings.length} Active</div>
                <div className="text-xs text-amber-400 font-semibold">
                  {driverBookings.filter(b => b.status === 'Pending').length} Pending Dispatch
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">Vehicle Rentals</span>
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                    <Car className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white font-['Outfit']">{vehicleBookings.length} Active</div>
                <div className="text-xs text-slate-400">
                  Sedan, SUV & Van
                </div>
              </div>

              {/* KPI 5: Driving Classes */}
              <div 
                onClick={() => setActiveTab('for-class')}
                className="bg-slate-900 border border-slate-800 hover:border-purple-500/50 rounded-3xl p-6 space-y-2 cursor-pointer transition-all group shadow-md"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">Driving Classes</span>
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-white flex items-center justify-center font-bold transition-colors">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white font-['Outfit']">{classEnrollments.length} Students</div>
                <div className="text-xs text-purple-400 font-semibold flex items-center justify-between">
                  <span>{classEnrollments.filter(e => e.status === 'Pending').length} Pending</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-amber-400 font-bold">Manage →</span>
                </div>
              </div>

              {/* KPI 6: Users & Drivers */}
              <div 
                onClick={() => setActiveTab('users')}
                className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-3xl p-6 space-y-2 cursor-pointer transition-all group shadow-md sm:col-span-2 lg:col-span-1"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">Users & Drivers</span>
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white flex items-center justify-center font-bold transition-colors">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white font-['Outfit']">
                  {registeredUsers.length + registeredDrivers.length} Accounts
                </div>
                <div className="text-xs text-emerald-400 font-semibold flex items-center justify-between">
                  <span>{registeredUsers.length} Clients · {registeredDrivers.length} Drivers</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-amber-400 font-bold">Directory →</span>
                </div>
              </div>

            </div>

            {/* Recent Driver Bookings with Single Combined WhatsApp Action */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-white font-['Outfit'] flex items-center gap-2">
                  <SteeringWheel className="w-5 h-5 text-amber-400" /> Recent Driver Booking Dispatches
                </h3>
                <button 
                  onClick={() => setActiveTab('for-driver')}
                  className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1"
                >
                  Manage All Drivers <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {driverBookings.map((b) => (
                  <div key={b.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-white">{b.customerName}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded">
                          {b.id}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-amber-400 shrink-0" /> {b.pickupArea} to {b.dropLocation}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {b.tripTitle} • ₹{b.fare}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`inline-block text-[11px] font-black px-3 py-1 rounded-full ${
                        b.status === 'Cancelled'
                          ? 'bg-red-600 text-white border border-red-500 shadow-md shadow-red-600/30'
                          : b.status === 'Pending' 
                          ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' 
                          : b.status === 'Assigned' 
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {b.status}
                      </span>

                      {/* WhatsApp Trigger Button to Client */}
                      <button
                        onClick={() => sendWhatsAppToClientForDriver(b)}
                        title={
                          b.status === 'Pending' 
                            ? "Please Accept & Assign order first to send WhatsApp to client" 
                            : b.status === 'Cancelled'
                            ? "Send Cancellation Notice via WhatsApp to Client"
                            : "Send trip confirmation WhatsApp to Client"
                        }
                        className={`text-[11px] font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all border ${
                          b.status === 'Pending'
                            ? 'bg-slate-950 text-slate-500 border-slate-800 opacity-60 cursor-not-allowed'
                            : b.status === 'Cancelled'
                            ? 'bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-900/40 border-red-400/40 cursor-pointer'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30 border-emerald-400/30 cursor-pointer'
                        }`}
                      >
                        <WhatsAppIcon className="w-3.5 h-3.5 fill-current" />
                        <span>{b.status === 'Cancelled' ? 'WhatsApp to Cancelled Client' : 'WhatsApp to Client'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: FOR DRIVER */}
        {activeTab === 'for-driver' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <span className="bg-amber-400/10 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider">
                  Driver Fleet Management
                </span>
                <h1 className="text-3xl font-extrabold text-white font-['Outfit'] mt-2">
                  For Driver (Driver Requests & Assignments)
                </h1>
                <p className="text-slate-400 text-xs mt-1">
                  Type driver details, accept incoming client requests, and send WhatsApp confirmation to Client.
                </p>
              </div>

              {/* Search & Status Filter */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    placeholder="Search by customer, area, ref..."
                    value={driverSearchQuery}
                    onChange={(e) => setDriverSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-full sm:w-auto">
                  {['All', 'Pending', 'Assigned', 'Cancelled'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setDriverStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        driverStatusFilter === st
                          ? 'bg-amber-400 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Driver Booking Cards */}
            <div className="space-y-4">
              {filteredDriverBookings.map((b) => (
                <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold shrink-0">
                        <SteeringWheel className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-base text-white">{b.customerName}</span>
                          <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                            {b.id}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" /> {b.phone}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-black px-3 py-1 rounded-full ${
                        b.status === 'Cancelled'
                          ? 'bg-red-600 text-white border border-red-500 shadow-md shadow-red-600/30'
                          : b.status === 'Pending' 
                          ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' 
                          : b.status === 'Assigned' 
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        ● {b.status}
                      </span>
                      <div className="text-sm font-extrabold text-white font-['Outfit']">₹{b.fare}</div>
                    </div>
                  </div>

                  {/* Cancelled Alert Banner if booking status is Cancelled */}
                  {b.status === 'Cancelled' && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3 flex items-center justify-between text-xs text-red-300">
                      <div className="flex items-center gap-2">
                        <Ban className="w-4 h-4 text-red-400 shrink-0" />
                        <span>
                          <strong className="text-red-400">Driver Booking Cancelled:</strong> {b.cancelReason ? `"${b.cancelReason}"` : 'Cancelled with zero penalty'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800">Zero Charges Billed</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Trip Type & Package</div>
                      <div className="font-extrabold text-white">{b.tripTitle}</div>
                      <div className="text-slate-400">{toDDMMYYYY(b.date)} • {b.time}</div>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Pickup & Drop Route</div>
                      <div className="font-semibold text-slate-200 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-400 shrink-0" /> {b.pickupArea}
                      </div>
                      <div className="text-slate-400 truncate">Drop: {b.dropLocation}</div>
                    </div>

                    {b.tripType === 'class' ? (
                      <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                        <div className="text-amber-400 font-bold uppercase text-[10px] flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" /> Training Specs
                        </div>
                        <div className="font-semibold text-slate-200">{b.classTrainingCar || "Dual-Control Car"} ({b.classTransmission || "Manual"})</div>
                        <div className="text-amber-400 font-semibold truncate">{b.classTimeSlot || "Morning Slot"}</div>
                      </div>
                    ) : b.passengers ? (
                      <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                        <div className="text-slate-400 font-bold uppercase text-[10px]">Passenger & Luggage</div>
                        <div className="font-semibold text-slate-200">{b.passengers} Passengers • {b.luggage}</div>
                        <div className="text-amber-400 font-semibold">{b.acPreference} Vehicle</div>
                      </div>
                    ) : (
                      <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                        <div className="text-slate-400 font-bold uppercase text-[10px]">Service Mode</div>
                        <div className="font-semibold text-slate-200">{b.tripTitle || 'Driver Service'}</div>
                        <div className="text-amber-400 font-semibold">Customer's Own Car</div>
                      </div>
                    )}

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Assigned Driver Details</div>
                      <div className="font-bold text-emerald-400 truncate">
                        {b.assignedDriver ? b.assignedDriver : '⚠️ No Driver Assigned'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {b.assignedDriverPhone ? `📞 ${b.assignedDriverPhone}` : 'Police Verified Driver'}
                      </div>
                    </div>
                  </div>

                  {/* Driver Inputs & Action Controls */}
                  <div className="pt-2 flex flex-col lg:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
                    
                    {/* 2 Input Boxes Typed by Admin for Driver Name & Driver Phone Number */}
                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
                      <div className="relative w-full sm:w-44">
                        <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                          type="text"
                          placeholder="Driver Name"
                          value={driverInputState[b.id]?.name ?? (b.assignedDriver || '')}
                          onChange={(e) => handleDriverInputChange(b.id, 'name', e.target.value)}
                          className="bg-slate-950 border border-slate-700 text-xs font-semibold text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-amber-400 w-full"
                        />
                      </div>
                      <div className="relative w-full sm:w-36">
                        <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                          type="text"
                          placeholder="Driver Phone"
                          value={driverInputState[b.id]?.phone ?? (b.assignedDriverPhone || '')}
                          onChange={(e) => handleDriverInputChange(b.id, 'phone', e.target.value)}
                          className="bg-slate-950 border border-slate-700 text-xs font-semibold text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-amber-400 w-full"
                        />
                      </div>
                    </div>

                    {/* Status Toggles & WhatsApp Action */}
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                      {b.status === 'Cancelled' ? (
                        <>
                          {/* Cancelled Order: NO Pending or Confirmed buttons, only red Cancelled indicator and red WhatsApp button */}
                          <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-red-600 text-white border border-red-500 shadow-md shadow-red-600/30 flex items-center gap-1.5">
                            <Ban className="w-3.5 h-3.5" />
                            <span>Cancelled</span>
                          </span>

                          <button
                            onClick={() => sendWhatsAppToClientForDriver(b)}
                            title="Send Cancellation Notice via WhatsApp to Client"
                            className="text-xs font-extrabold px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition-all border bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40 border-red-400/40 cursor-pointer"
                          >
                            <WhatsAppIcon className="w-4 h-4 fill-current" />
                            <span>WhatsApp to Cancelled Client</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleUpdateDriverStatus(b.id, 'Pending')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                              b.status === 'Pending' ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-950 text-slate-400 border-slate-800'
                            }`}
                          >
                            Set Pending
                          </button>
                          <button
                            onClick={() => handleAcceptAndAssignDriver(b.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                              b.status === 'Assigned' ? 'bg-blue-500 text-white border-blue-500' : 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-400'
                            }`}
                          >
                            Accept & Assign
                          </button>
                          <button
                            onClick={() => handleUpdateDriverStatus(b.id, 'Cancelled')}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors bg-slate-950 text-slate-400 border-slate-800 hover:text-red-400 hover:border-red-500/40"
                          >
                            Cancel
                          </button>

                          {/* WhatsApp Button to send details ONLY to Client */}
                          <button
                            onClick={() => sendWhatsAppToClientForDriver(b)}
                            title={
                              b.status === 'Pending' 
                                ? "Please Accept & Assign order first to send WhatsApp to client" 
                                : "Send Accepted Order Details via WhatsApp to Client"
                            }
                            className={`text-xs font-extrabold px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition-all border ${
                              b.status === 'Pending'
                                ? 'bg-slate-950 text-slate-500 border-slate-800 opacity-60 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 border-emerald-400/40 cursor-pointer'
                            }`}
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

          </div>
        )}

        {/* TAB 3: FOR VEHICLE */}
        {activeTab === 'for-vehicle' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <span className="bg-amber-400/10 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider">
                  Vehicle Rental Management
                </span>
                <h1 className="text-3xl font-extrabold text-white font-['Outfit'] mt-2">
                  For Vehicle (Fleet Bookings & Dispatch)
                </h1>
                <p className="text-slate-400 text-xs mt-1">
                  Track Sedan, SUV, and Tempo Traveller rental requests, assign vehicle registration numbers, and send WhatsApp notifications to Client.
                </p>
              </div>

              {/* Search & Status Filter */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    placeholder="Search vehicle, customer..."
                    value={vehicleSearchQuery}
                    onChange={(e) => setVehicleSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-full sm:w-auto">
                  {['All', 'Pending', 'Confirmed', 'Dispatched', 'Cancelled'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setVehicleStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        vehicleStatusFilter === st
                          ? 'bg-amber-400 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Vehicle Cards */}
            <div className="space-y-4">
              {filteredVehicleBookings.map((b) => (
                <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold shrink-0">
                        <Car className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-base text-white">{b.customerName}</span>
                          <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                            {b.id}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" /> {b.phone}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-black px-3 py-1 rounded-full ${
                        b.status === 'Cancelled'
                          ? 'bg-red-600 text-white border border-red-500 shadow-md shadow-red-600/30'
                          : b.status === 'Pending' 
                          ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' 
                          : b.status === 'Confirmed' 
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        ● {b.status}
                      </span>
                      <div className="text-sm font-extrabold text-amber-400 font-['Outfit']">₹{b.fare}</div>
                    </div>
                  </div>

                  {/* Cancelled Alert Banner if vehicle rental status is Cancelled */}
                  {b.status === 'Cancelled' && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3 flex items-center justify-between text-xs text-red-300">
                      <div className="flex items-center gap-2">
                        <Ban className="w-4 h-4 text-red-400 shrink-0" />
                        <span>
                          <strong className="text-red-400">Vehicle Rental Cancelled:</strong> {b.cancelReason ? `"${b.cancelReason}"` : 'Cancelled with zero penalty'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800">Fleet Released</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Vehicle Reserved</div>
                      <div className="font-extrabold text-white">{b.vehicleName}</div>
                      <div className="text-amber-400 font-semibold">{b.rentalType}</div>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Pickup Location & Time</div>
                      <div className="font-semibold text-slate-200 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-400 shrink-0" /> {b.pickupArea}
                      </div>
                      <div className="text-slate-400">{toDDMMYYYY(b.date)} • {b.time}</div>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Passenger & Luggage</div>
                      <div className="font-semibold text-slate-200">{b.passengers} Passengers • {b.luggage}</div>
                      <div className="text-emerald-400 font-semibold">{b.acPreference} Vehicle</div>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Assigned Reg Number</div>
                      <div className="font-mono font-bold text-amber-400">{b.vehicleRegNumber}</div>
                      <div className="text-[10px] text-slate-500">Sanitized Fleet Vehicle</div>
                    </div>
                  </div>

                  {/* Controls & Single Combined WhatsApp Dispatch Action */}
                  <div className="pt-2 flex flex-col lg:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
                    <div className="text-xs text-slate-400">
                      Booked: <span className="text-slate-300 font-semibold">{b.bookedAt}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                      {b.status === 'Cancelled' ? (
                        <>
                          {/* Cancelled Vehicle Order: NO Pending or Confirmed buttons, only red Cancelled indicator and red WhatsApp button */}
                          <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-red-600 text-white border border-red-500 shadow-md shadow-red-600/30 flex items-center gap-1.5">
                            <Ban className="w-3.5 h-3.5" />
                            <span>Cancelled</span>
                          </span>

                          <button
                            onClick={() => sendWhatsAppToClientForVehicle(b)}
                            title="Send Cancellation Notice via WhatsApp to Client"
                            className="text-xs font-extrabold px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition-all border bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40 border-red-400/40 cursor-pointer"
                          >
                            <WhatsAppIcon className="w-4 h-4 fill-current" />
                            <span>WhatsApp to Cancelled Client</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleUpdateVehicleStatus(b.id, 'Pending')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                              b.status === 'Pending' ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-950 text-slate-400 border-slate-800'
                            }`}
                          >
                            Set Pending
                          </button>
                          <button
                            onClick={() => handleUpdateVehicleStatus(b.id, 'Confirmed')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                              b.status === 'Confirmed' ? 'bg-blue-500 text-white border-blue-500' : 'bg-slate-950 text-slate-400 border-slate-800'
                            }`}
                          >
                            Accept & Confirm
                          </button>
                          <button
                            onClick={() => handleUpdateVehicleStatus(b.id, 'Cancelled')}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors bg-slate-950 text-slate-400 border-slate-800 hover:text-red-400 hover:border-red-500/40"
                          >
                            Cancel
                          </button>

                          {/* WhatsApp Button to send details ONLY to Client */}
                          <button
                            onClick={() => sendWhatsAppToClientForVehicle(b)}
                            title={
                              b.status === 'Pending' 
                                ? "Please Accept & Confirm order first to send WhatsApp to client" 
                                : "Send Confirmed Vehicle Details via WhatsApp to Client"
                            }
                            className={`text-xs font-extrabold px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition-all border ${
                              b.status === 'Pending'
                                ? 'bg-slate-950 text-slate-500 border-slate-800 opacity-60 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 border-emerald-400/40 cursor-pointer'
                            }`}
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

          </div>
        )}

        {/* =====================================================================
            TAB 4: FOR DRIVING CLASS ENROLLMENTS
           ===================================================================== */}
        {activeTab === 'for-class' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <span className="bg-purple-500/10 text-purple-400 text-xs font-bold px-3 py-1 rounded-full border border-purple-500/20 uppercase tracking-wider">
                  Academy Operations
                </span>
                <h1 className="text-3xl font-extrabold text-white font-['Outfit'] mt-2 flex items-center gap-3">
                  <GraduationCap className="w-8 h-8 text-amber-400" />
                  Driving Class Enrollments
                </h1>
                <p className="text-slate-400 text-xs mt-1">
                  Manage student admissions, verify Learner's / Driving license statuses, assign certified instructor Annas, and dispatch WhatsApp confirmations.
                </p>
              </div>

              {/* Action Button: Enroll New Student */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsAdminEnrollmentModalOpen(true)}
                  className="py-3 px-5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-400/20 transition-all flex items-center gap-2"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>+ Enroll New Student</span>
                </button>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Search by student name, phone, ref id, area..."
                  value={classSearchQuery}
                  onChange={(e) => setClassSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1 shrink-0 mr-1">
                  <Filter className="w-3 h-3 text-amber-400" /> Filter:
                </span>
                {['All', 'Pending', 'In Training', 'Completed', 'Cancelled'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setClassStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 ${
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
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Showing <span className="text-white font-bold">{filteredClassEnrollments.length}</span> enrollments</span>
              <span>Total Admissions: <span className="text-amber-400 font-bold">{classEnrollments.length}</span></span>
            </div>

            {/* Enrollment Cards List */}
            {filteredClassEnrollments.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto">
                  <GraduationCap className="w-7 h-7" />
                </div>
                <h3 className="font-extrabold text-white text-base">No driving class enrollments found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  No matching student enrollment records. Click below to add an enrollment.
                </p>
                <button
                  onClick={() => setIsAdminEnrollmentModalOpen(true)}
                  className="py-2.5 px-4 rounded-xl bg-amber-400 text-slate-950 font-extrabold text-xs inline-flex items-center gap-2 mt-2"
                >
                  <GraduationCap className="w-4 h-4" /> Enroll New Student
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredClassEnrollments.map((enr) => (
                  <div key={enr.enrollmentId} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
                    
                    {/* Top Row: Candidate Name, ID, Phone, Status Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold shrink-0">
                          <GraduationCap className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-base text-white">{enr.fullName}</span>
                            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                              {enr.enrollmentId}
                            </span>
                            {enr.gender && (
                              <span className="text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                {enr.gender}
                              </span>
                            )}
                            {enr.dateOfBirth && (
                              <span className="text-[11px] text-slate-400">
                                DOB: <span className="text-slate-300 font-semibold">{toDDMMYYYY(enr.dateOfBirth)}</span>
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-3 mt-1 flex-wrap">
                            <a href={`tel:${enr.mobileNumber}`} className="flex items-center gap-1 hover:text-white transition-colors">
                              <Phone className="w-3 h-3 text-emerald-400" /> +91 {enr.mobileNumber}
                            </a>
                            {enr.emailAddress && (
                              <span className="flex items-center gap-1 text-slate-400">
                                <Mail className="w-3 h-3 text-amber-400" /> {enr.emailAddress}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-black px-3 py-1 rounded-full ${
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
                      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3 flex items-center justify-between text-xs text-red-300">
                        <div className="flex items-center gap-2">
                          <Ban className="w-4 h-4 text-red-400 shrink-0" />
                          <span>
                            <strong className="text-red-400">Class Enrollment Cancelled:</strong> {enr.cancelReason ? `"${enr.cancelReason}"` : 'Admission cancelled with zero penalty'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800">Seat Released</span>
                      </div>
                    )}

                    {/* Middle Grid: License status, Driving Info, Class Preferences */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      
                      {/* Card 1: Experience & Gear */}
                      <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                        <div className="text-slate-400 font-bold uppercase text-[10px]">Training Preferences</div>
                        <div className="font-extrabold text-white text-sm">
                          {enr.gearPreference} Transmission
                        </div>
                        <div className="text-amber-400 font-semibold">
                          Experience: {enr.drivingExperience}
                        </div>
                      </div>

                      {/* Card 2: License Checks (User requested labels!) */}
                      <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1.5">
                        <div className="text-slate-400 font-bold uppercase text-[10px]">License Verifications</div>
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
                      <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                        <div className="text-slate-400 font-bold uppercase text-[10px]">Schedule & Doorstep Pickup</div>
                        <div className="font-semibold text-white">
                          Start: {toDDMMYYYY(enr.preferredStartDate)}
                        </div>
                        <div className="text-amber-400 font-semibold">
                          Slot: {enr.preferredTime}
                        </div>
                        <div className="text-slate-300 truncate">
                          Pickup: {enr.pickupRequired === 'Yes' ? `Yes (${enr.pickupLocation || 'Specified'})` : 'No (Center)'}
                        </div>
                      </div>

                    </div>

                    {/* Address & Additional Notes info */}
                    <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-400">
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-slate-300 font-semibold">Address:</span>
                        <span className="truncate">{enr.address}</span>
                      </div>
                      {enr.additionalNotes && (
                        <div className="text-slate-400 text-[11px] italic shrink-0">
                          Notes: "{enr.additionalNotes}"
                        </div>
                      )}
                    </div>

                    {/* Instructor Inputs & Action Controls */}
                    <div className="pt-2 flex flex-col lg:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
                      
                      {/* 2 Input Boxes Typed by Admin for Instructor Name & Instructor Phone Number (like in driver page) */}
                      <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
                        <div className="relative w-full sm:w-44">
                          <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input 
                            type="text"
                            placeholder="Instructor Name"
                            value={instructorInputState[enr.enrollmentId]?.name ?? (enr.assignedInstructor || '')}
                            onChange={(e) => handleInstructorInputChange(enr.enrollmentId, 'name', e.target.value)}
                            className="bg-slate-950 border border-slate-700 text-xs font-semibold text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-amber-400 w-full"
                          />
                        </div>
                        <div className="relative w-full sm:w-36">
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
                      <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                        {enr.status === 'Cancelled' ? (
                          <>
                            {/* Cancelled Class Enrollment: NO Pending, In Training, or Completed buttons, only red Cancelled indicator and red WhatsApp button */}
                            <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-red-600 text-white border border-red-500 shadow-md shadow-red-600/30 flex items-center gap-1.5">
                              <Ban className="w-3.5 h-3.5" />
                              <span>Cancelled</span>
                            </span>

                            {/* Send WhatsApp Cancellation directly to Candidate */}
                            <button
                              onClick={() => sendWhatsAppToCandidate(enr)}
                              className="text-xs font-extrabold px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition-all border bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40 border-red-400/40 cursor-pointer"
                              title="Send official cancellation update to client via WhatsApp"
                            >
                              <WhatsAppIcon className="w-4 h-4 fill-current" />
                              <span>WhatsApp to Cancelled Client</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleUpdateClassStatus(enr.enrollmentId, 'Pending')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                                enr.status === 'Pending' 
                                  ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-400/20' 
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              Pending
                            </button>
                            <button
                              onClick={() => handleUpdateClassStatus(enr.enrollmentId, 'In Training')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                                enr.status === 'In Training' 
                                  ? 'bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-500/20' 
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              In Training
                            </button>
                            <button
                              onClick={() => handleUpdateClassStatus(enr.enrollmentId, 'Completed')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                                enr.status === 'Completed' 
                                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20' 
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              Completed
                            </button>
                            <button
                              onClick={() => handleUpdateClassStatus(enr.enrollmentId, 'Cancelled')}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors bg-slate-950 text-slate-400 border-slate-800 hover:text-red-400 hover:border-red-500/40"
                            >
                              Cancel
                            </button>

                            {/* Send WhatsApp Confirmation directly to Candidate */}
                            <button
                              onClick={() => sendWhatsAppToCandidate(enr)}
                              disabled={enr.status === 'Pending'}
                              className={`text-xs font-extrabold px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition-all border ${
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
        )}

        {/* =====================================================================
            TAB 5: USERS / REGISTERED CLIENTS
           ===================================================================== */}
        {/* =====================================================================
            TAB 5: USERS & DRIVER PARTNERS (SEPARATED DIRECTORIES)
           ===================================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-wider">
                  Account Directory & CRM
                </span>
                <h1 className="text-3xl font-extrabold text-white font-['Outfit'] mt-2 flex items-center gap-3">
                  <Users className="w-8 h-8 text-amber-400" />
                  Registered Accounts & Fleet
                </h1>
                <p className="text-slate-400 text-xs mt-1">
                  Comprehensive directory of registered Bengaluru customers and verified Driver Partner Annas.
                </p>
              </div>

              {/* Contextual Action Button */}
              <div className="flex items-center gap-3">
                {userSubTab === 'customers' ? (
                  <button
                    onClick={() => setIsAddUserModalOpen(true)}
                    className="py-3 px-5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-400/20 transition-all flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ Add New Client</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsAddDriverModalOpen(true)}
                    className="py-3 px-5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-400/20 transition-all flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ Add Driver Anna</span>
                  </button>
                )}
              </div>
            </div>

            {/* Sub-Tab Navigation Switcher (Customers vs Driver Annas Separated) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-2 rounded-2xl">
              <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800/80 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => { setUserSubTab('customers'); setUserSearchQuery(''); setUserAreaFilter('All'); }}
                  className={`flex-1 sm:flex-initial py-2.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    userSubTab === 'customers'
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Customers (Users)</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    userSubTab === 'customers' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {registeredUsers.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setUserSubTab('drivers'); setUserSearchQuery(''); setUserAreaFilter('All'); }}
                  className={`flex-1 sm:flex-initial py-2.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    userSubTab === 'drivers'
                      ? 'bg-emerald-400 text-slate-950 shadow-md shadow-emerald-400/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <SteeringWheel className="w-3.5 h-3.5 stroke-[2.4]" />
                  <span>Driver Annas (Drivers)</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    userSubTab === 'drivers' ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {registeredDrivers.length}
                  </span>
                </button>
              </div>

              <div className="text-slate-400 text-[11px] font-medium hidden md:block px-2">
                Active Category: <strong className="text-white">{userSubTab === 'customers' ? 'Customer Accounts' : 'Driver Partner Fleet'}</strong>
              </div>
            </div>

            {/* Metrics Overview Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Registered Clients</div>
                <div className="text-2xl font-extrabold text-white font-['Outfit'] mt-1">{registeredUsers.length} Customers</div>
                <div className="text-[11px] text-amber-400 font-semibold mt-0.5">Verified Personal Accounts</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Driver Partner Fleet</div>
                <div className="text-2xl font-extrabold text-emerald-400 font-['Outfit'] mt-1">{registeredDrivers.length} Driver Annas</div>
                <div className="text-[11px] text-slate-400 font-semibold mt-0.5">RTO Verified Credentials</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Bengaluru Localities</div>
                <div className="text-2xl font-extrabold text-white font-['Outfit'] mt-1">
                  {new Set([...registeredUsers.map(u => u.area), ...registeredDrivers.map(d => d.area)].filter(Boolean)).size} Hubs
                </div>
                <div className="text-[11px] text-slate-400 font-semibold mt-0.5">Indiranagar, Koramangala, etc.</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Direct WhatsApp</div>
                <div className="text-2xl font-extrabold text-emerald-400 font-['Outfit'] mt-1">Instant</div>
                <div className="text-[11px] text-slate-400 font-semibold mt-0.5">1-Click Client & Driver Connect</div>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder={
                    userSubTab === 'customers'
                      ? "Search by client name, mobile, email, area..."
                      : "Search drivers by name, mobile, DL number, car type, area..."
                  }
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

              {/* Area Filter */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                <span className="text-xs text-slate-400 font-bold flex items-center gap-1 shrink-0">
                  <Filter className="w-3.5 h-3.5" /> Area:
                </span>
                <select
                  value={userAreaFilter}
                  onChange={(e) => setUserAreaFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="All">
                    All Localities ({userSubTab === 'customers' ? registeredUsers.length : registeredDrivers.length})
                  </option>
                  {BANGALORE_AREAS.map((area, idx) => {
                    const currentPool = userSubTab === 'customers' ? registeredUsers : registeredDrivers;
                    const count = currentPool.filter(item => item.area === area).length;
                    return (
                      <option key={idx} value={area}>
                        {area} {count > 0 ? `(${count})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* =============================================================== */}
            {/* SUB-TAB 1: CUSTOMERS (USERS) DIRECTORY                          */}
            {/* =============================================================== */}
            {userSubTab === 'customers' && (
              <div>
                {registeredUsers
                  .filter(u => {
                    const q = userSearchQuery.toLowerCase();
                    const matchesSearch = 
                      (u.name && u.name.toLowerCase().includes(q)) ||
                      (u.phone && u.phone.includes(q)) ||
                      (u.email && u.email.toLowerCase().includes(q)) ||
                      (u.area && u.area.toLowerCase().includes(q)) ||
                      (u.id && u.id.toLowerCase().includes(q));
                    const matchesArea = userAreaFilter === 'All' || u.area === userAreaFilter;
                    return matchesSearch && matchesArea;
                  }).length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
                    <Users className="w-12 h-12 text-slate-600 mx-auto" />
                    <h3 className="text-lg font-bold text-white">No Registered Clients Found</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      No registered customers match your search query or area filter. Try changing your filters or add a new client.
                    </p>
                    <button
                      onClick={() => { setUserSearchQuery(''); setUserAreaFilter('All'); }}
                      className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                    {registeredUsers
                      .filter(u => {
                        const q = userSearchQuery.toLowerCase();
                        const matchesSearch = 
                          (u.name && u.name.toLowerCase().includes(q)) ||
                          (u.phone && u.phone.includes(q)) ||
                          (u.email && u.email.toLowerCase().includes(q)) ||
                          (u.area && u.area.toLowerCase().includes(q)) ||
                          (u.id && u.id.toLowerCase().includes(q));
                        const matchesArea = userAreaFilter === 'All' || u.area === userAreaFilter;
                        return matchesSearch && matchesArea;
                      })
                      .map((user) => (
                      <div 
                        key={user.id}
                        className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-3xl p-5 space-y-4 transition-all shadow-md group relative flex flex-col justify-between"
                      >
                        <div>
                          {/* Top Row: Avatar, Name & Status */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-base flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div>
                                <h3 className="text-base font-extrabold text-white font-['Outfit'] group-hover:text-amber-400 transition-colors">
                                  {user.name}
                                </h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                                    {user.id}
                                  </span>
                                  <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                                    {user.status || 'Active'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Delete User Button (Icon Only) */}
                            <button
                              onClick={() => handleOpenDeleteUserModal(user)}
                              title="Remove customer from DB"
                              aria-label="Remove customer from DB"
                              className="p-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/40 transition-all cursor-pointer flex items-center justify-center shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Contact & Location Details */}
                          <div className="mt-4 space-y-2 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 text-xs">
                            <div className="flex items-center justify-between text-slate-300">
                              <span className="text-slate-500 flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-emerald-400" /> Phone:
                              </span>
                              <a href={`tel:${user.phone}`} className="font-bold hover:text-amber-400 font-mono">
                                {user.phone}
                              </a>
                            </div>

                            <div className="flex items-center justify-between text-slate-300">
                              <span className="text-slate-500 flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-blue-400" /> Email:
                              </span>
                              <span className="font-medium text-slate-200 truncate max-w-[170px]" title={user.email}>
                                {user.email}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-300">
                              <span className="text-slate-500 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-red-400" /> Locality:
                              </span>
                              <span className="font-bold text-amber-400">
                                {user.area || 'Bangalore Central'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800/60">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-500" /> Joined:
                              </span>
                              <span>{toDDMMYYYY(user.createdAt || '2026-09-01')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-4">
                          <a
                            href={`tel:${user.phone}`}
                            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center gap-1.5 border border-slate-700"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Call</span>
                          </a>

                          <button
                            onClick={() => {
                              const cleanPhone = user.phone ? user.phone.replace(/[^0-9]/g, '') : '';
                              const text = encodeURIComponent(
                                `Namaskara ${user.name}! 🙏\n\nThis is Book Driver Anna admin team.\nHow can we assist you with our Driver, Vehicle Rental or Driving Class services today?`
                              );
                              window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-900/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5 fill-current" />
                            <span>WhatsApp Client</span>
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* =============================================================== */}
            {/* SUB-TAB 2: DRIVER PARTNER ANNAS DIRECTORY                       */}
            {/* =============================================================== */}
            {userSubTab === 'drivers' && (
              <div>
                {registeredDrivers
                  .filter(d => {
                    const q = userSearchQuery.toLowerCase();
                    const matchesSearch = 
                      (d.name && d.name.toLowerCase().includes(q)) ||
                      (d.phone && d.phone.includes(q)) ||
                      (d.dlNumber && d.dlNumber.toLowerCase().includes(q)) ||
                      (d.vehicleType && d.vehicleType.toLowerCase().includes(q)) ||
                      (d.area && d.area.toLowerCase().includes(q)) ||
                      (d.id && d.id.toLowerCase().includes(q));
                    const matchesArea = userAreaFilter === 'All' || d.area === userAreaFilter;
                    return matchesSearch && matchesArea;
                  }).length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
                    <SteeringWheel className="w-12 h-12 text-slate-600 mx-auto stroke-[1.8]" />
                    <h3 className="text-lg font-bold text-white">No Driver Partners Found</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      No driver partners match your search query or area filter. Try changing your filters or add a new driver.
                    </p>
                    <button
                      onClick={() => { setUserSearchQuery(''); setUserAreaFilter('All'); }}
                      className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                    {registeredDrivers
                      .filter(d => {
                        const q = userSearchQuery.toLowerCase();
                        const matchesSearch = 
                          (d.name && d.name.toLowerCase().includes(q)) ||
                          (d.phone && d.phone.includes(q)) ||
                          (d.dlNumber && d.dlNumber.toLowerCase().includes(q)) ||
                          (d.vehicleType && d.vehicleType.toLowerCase().includes(q)) ||
                          (d.area && d.area.toLowerCase().includes(q)) ||
                          (d.id && d.id.toLowerCase().includes(q));
                        const matchesArea = userAreaFilter === 'All' || d.area === userAreaFilter;
                        return matchesSearch && matchesArea;
                      })
                      .map((driver) => (
                      <div 
                        key={driver.id}
                        className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 space-y-4 transition-all shadow-md group relative flex flex-col justify-between"
                      >
                        <div>
                          {/* Top Row: Avatar, Name & Status */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 font-black text-base flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                                <SteeringWheel className="w-6 h-6 stroke-[2.2]" />
                              </div>
                              <div>
                                <h3 className="text-base font-extrabold text-white font-['Outfit'] group-hover:text-emerald-400 transition-colors">
                                  {driver.name}
                                </h3>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                                    {driver.id}
                                  </span>
                                  <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                                    {driver.status || 'Active'}
                                  </span>
                                  <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                                    ★ {driver.rating || 4.95}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Delete Driver Button (Single Icon Only) */}
                            <button
                              onClick={() => handleOpenDeleteUserModal(driver)}
                              title="Remove driver partner from fleet DB"
                              aria-label="Remove driver partner from fleet DB"
                              className="p-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/40 transition-all cursor-pointer flex items-center justify-center shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Driver Details & Credentials */}
                          <div className="mt-4 space-y-2 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 text-xs">
                            <div className="flex items-center justify-between text-slate-300">
                              <span className="text-slate-500 flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-emerald-400" /> Driver Login Mobile:
                              </span>
                              <a href={`tel:${driver.phone}`} className="font-bold hover:text-emerald-400 font-mono">
                                {driver.phone}
                              </a>
                            </div>

                            <div className="flex items-center justify-between text-slate-300">
                              <span className="text-slate-500 flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Driving License:
                              </span>
                              <span className="font-mono font-bold text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                                {driver.dlNumber || 'KA-RTO-VERIFIED'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-300">
                              <span className="text-slate-500 flex items-center gap-1.5">
                                <Car className="w-3.5 h-3.5 text-amber-400" /> Vehicles:
                              </span>
                              <span className="font-medium text-slate-300 truncate max-w-[170px]" title={driver.vehicleType}>
                                {driver.vehicleType || 'Manual & Automatic Cars'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-300">
                              <span className="text-slate-500 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-red-400" /> Operating Hub:
                              </span>
                              <span className="font-bold text-emerald-400">
                                {driver.area || 'Indiranagar'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800/60">
                              <span className="flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5 text-teal-400" /> Experience:
                              </span>
                              <span className="font-bold text-slate-300">{driver.experienceYears || '5+ Years'}</span>
                            </div>

                            <div className="flex items-center justify-between text-slate-400 text-[11px]">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Completed Trips:
                              </span>
                              <span className="font-extrabold text-white font-mono">{driver.trips ? Number(driver.trips).toLocaleString() : '0'} Trips</span>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-4">
                          <a
                            href={`tel:${driver.phone}`}
                            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center gap-1.5 border border-slate-700"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Call</span>
                          </a>

                          <button
                            onClick={() => {
                              const cleanPhone = driver.phone ? driver.phone.replace(/[^0-9]/g, '') : '';
                              const text = encodeURIComponent(
                                `Namaskara Anna ${driver.name}! 🙏\n\nThis is Book Driver Anna admin team.\nChecking in regarding your fleet status and upcoming ride dispatches.`
                              );
                              window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-900/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5 fill-current" />
                            <span>WhatsApp Anna</span>
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Modal 1: Add Client Modal */}
            {isAddUserModalOpen && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in overflow-hidden touch-none overscroll-contain"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setIsAddUserModalOpen(false);
                }}
                onTouchMove={(e) => {
                  if (e.target === e.currentTarget) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
              >
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 max-w-md w-full max-h-[92vh] overflow-y-auto overscroll-contain touch-pan-y space-y-5 shadow-2xl relative">
                  
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

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!newUserName.trim() || !newUserPhone.trim() || !newUserEmail.trim()) {
                      alert('Please fill all required fields');
                      return;
                    }
                    const cleanPhone = newUserPhone.replace(/[^0-9]/g, '');
                    const formattedPhone = cleanPhone.startsWith('91') && cleanPhone.length === 12
                      ? `+${cleanPhone.slice(0, 2)} ${cleanPhone.slice(2)}`
                      : `+91 ${cleanPhone.slice(-10)}`;

                    const newUser = {
                      id: 'CLI-' + Math.floor(1000 + Math.random() * 9000),
                      name: newUserName.trim(),
                      phone: formattedPhone,
                      email: newUserEmail.trim(),
                      area: newUserArea,
                      status: 'Active',
                      createdAt: new Date().toISOString().split('T')[0]
                    };

                    const updated = [newUser, ...registeredUsers];
                    setRegisteredUsers(updated);
                    localStorage.setItem('bda_registered_clients', JSON.stringify(updated));
                    window.dispatchEvent(new CustomEvent('bda_client_registered'));
                    
                    setNewUserName('');
                    setNewUserPhone('');
                    setNewUserEmail('');
                    setNewUserArea('Indiranagar');
                    setIsAddUserModalOpen(false);
                  }} className="space-y-3.5">
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
                        placeholder="98860 54321"
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
                        placeholder="e.g. vikram@example.com"
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

            {/* Modal 2: Add Driver Anna Modal */}
            {isAddDriverModalOpen && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in overflow-hidden touch-none overscroll-contain"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setIsAddDriverModalOpen(false);
                }}
                onTouchMove={(e) => {
                  if (e.target === e.currentTarget) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
              >
                <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-5 sm:p-8 max-w-md w-full max-h-[92vh] overflow-y-auto overscroll-contain touch-pan-y space-y-5 shadow-2xl relative">
                  
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

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!newDriverName.trim() || !newDriverPhone.trim() || !newDriverDl.trim()) {
                      alert('Please fill all required driver fields');
                      return;
                    }
                    const cleanPhone = newDriverPhone.replace(/[^0-9]/g, '');
                    const formattedPhone = cleanPhone.startsWith('91') && cleanPhone.length === 12
                      ? `+${cleanPhone.slice(0, 2)} ${cleanPhone.slice(2)}`
                      : `+91 ${cleanPhone.slice(-10)}`;

                    const newDriver = {
                      id: 'DRV-' + Math.floor(1000 + Math.random() * 9000),
                      name: newDriverName.trim(),
                      phone: formattedPhone,
                      dlNumber: newDriverDl.trim().toUpperCase(),
                      vehicleType: newDriverVehicleType,
                      area: newDriverArea,
                      experienceYears: newDriverExperience,
                      rating: 5.0,
                      trips: 0,
                      status: 'Active',
                      createdAt: new Date().toISOString().split('T')[0]
                    };

                    const updated = [newDriver, ...registeredDrivers];
                    setRegisteredDrivers(updated);
                    localStorage.setItem('bda_registered_drivers', JSON.stringify(updated));
                    window.dispatchEvent(new CustomEvent('bda_driver_registered'));
                    
                    setNewDriverName('');
                    setNewDriverPhone('');
                    setNewDriverDl('');
                    setNewDriverVehicleType('Manual & Automatic Cars');
                    setNewDriverArea('Indiranagar');
                    setNewDriverExperience('5 Years');
                    setIsAddDriverModalOpen(false);
                  }} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300">Driver Full Name *</label>
                      <input 
                        type="text"
                        required
                        placeholder="e.g. Ramesh Gowda"
                        value={newDriverName}
                        onChange={(e) => setNewDriverName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300">Driver Login Mobile *</label>
                      <input 
                        type="tel"
                        required
                        placeholder="98860 12345"
                        value={newDriverPhone}
                        onChange={(e) => setNewDriverPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300">Driving License (DL Number) *</label>
                      <input 
                        type="text"
                        required
                        placeholder="e.g. KA-04-2022-0012345"
                        value={newDriverDl}
                        onChange={(e) => setNewDriverDl(e.target.value.toUpperCase())}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-400 uppercase"
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

          </div>
        )}

      </main>

      {/* Toast Notification */}
      {userActionToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-slate-900 border-2 border-red-500/80 text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-top-4">
          <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-red-400">Database Purge Successful</div>
            <div className="text-xs text-slate-200">{userActionToast}</div>
          </div>
          <button 
            onClick={() => setUserActionToast(null)}
            className="text-slate-400 hover:text-white ml-2 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Admin Driving Class Enrollment Modal */}
      <DrivingClassEnrollmentModal
        isOpen={isAdminEnrollmentModalOpen}
        onClose={() => setIsAdminEnrollmentModalOpen(false)}
        onEnrollmentSuccess={(newEnrollment) => {
          setClassEnrollments(prev => [newEnrollment, ...prev]);
        }}
      />

      {/* ========================================================================= */}
      {/* SERIOUS QUESTIONS: REMOVE USER FROM DB VERIFICATION MODAL */}
      {/* ========================================================================= */}
      {userToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in overflow-hidden touch-none overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseDeleteUserModal();
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <div 
            className="bg-slate-900 border border-red-500/40 rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl shadow-red-950/60 relative overflow-hidden overscroll-contain touch-pan-y"
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

    </div>
  );
}
