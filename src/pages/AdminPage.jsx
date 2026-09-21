import React, { useState, useEffect, useRef } from 'react';
import { Trash2, X } from 'lucide-react';
import { BANGALORE_AREAS, FEATURED_DRIVERS, VEHICLE_SERVICES, DEFAULT_REGISTERED_DRIVERS } from '../data/mockData';
import DrivingClassEnrollmentModal from '../components/DrivingClassEnrollmentModal';
import { toDDMMYYYY } from '../utils/dateUtils';
import useScrollLock from '../utils/useScrollLock';
import { apiClient } from '../services/apiClient';
import { broadcastBookingUpdate } from '../utils/broadcastSync';

import AdminAuthView from './admin/AdminAuthView';
import AdminSidebar from './admin/AdminSidebar';
import AdminDashboardTab from './admin/AdminDashboardTab';
import AdminDriverTab from './admin/AdminDriverTab';
import AdminVehicleTab from './admin/AdminVehicleTab';
import AdminClassTab from './admin/AdminClassTab';
import AdminUsersTab from './admin/AdminUsersTab';
import AdminModals from './admin/AdminModals';

// Initial state for bookings, rentals, academy enrollments, and clients (empty on clean boot)
const DEFAULT_DRIVER_BOOKINGS = [];
const DEFAULT_VEHICLE_BOOKINGS = [];
const DEFAULT_CLASS_ENROLLMENTS = [];
const DEFAULT_REGISTERED_CLIENTS = [];

export const sanitizeClients = (list) => {
  if (!Array.isArray(list)) return [];
  return list.filter(u => Boolean(u && (u.id || u.email || u.phone)));
};

export const sanitizeDrivers = (list) => {
  if (!Array.isArray(list)) return [];
  return list.filter(d => Boolean(d && (d.id || d.phone || d.name)));
};

// SPA Route Paths for Admin Sections
export const ADMIN_TAB_ROUTES = {
  'dashboard': '/admin/dashboard',
  'for-driver': '/admin/driver',
  'for-vehicle': '/admin/vehicle',
  'for-class': '/admin/class',
  'users': '/admin/users'
};

export const parseTabFromPath = (path) => {
  if (!path) return 'dashboard';
  const clean = path.toLowerCase().replace(/\/+$/, '');
  if (clean === '/admin' || clean === '/admin/dashboard' || clean === '/admin/overview') {
    return 'dashboard';
  }
  if (clean === '/admin/driver' || clean === '/admin/drivers' || clean === '/admin/for-driver' || clean === '/admin/driver-bookings') {
    return 'for-driver';
  }
  if (clean === '/admin/vehicle' || clean === '/admin/vehicles' || clean === '/admin/for-vehicle' || clean === '/admin/rentals') {
    return 'for-vehicle';
  }
  if (clean === '/admin/class' || clean === '/admin/classes' || clean === '/admin/for-class' || clean === '/admin/academy' || clean === '/admin/driving-class') {
    return 'for-class';
  }
  if (clean === '/admin/users' || clean === '/admin/user' || clean === '/admin/clients' || clean === '/admin/customers') {
    return 'users';
  }
  return 'dashboard';
};

export default function AdminPage({ onReturnToClient }) {
  // Persistent Authentication State (persists across page refreshes)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    return localStorage.getItem('bda_admin_logged_in') === 'true';
  });
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  // Auth Form Fields (cleared upon submit and mode switches)
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Show / Hide Password toggle state
  const [authFullName, setAuthFullName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authSecretKey, setAuthSecretKey] = useState('');
  const [authError, setAuthError] = useState('');

  // Dynamic form seed to ensure unique non-autofilled input names on mount/visit
  const [authFormSeed, setAuthFormSeed] = useState(() => Math.random().toString(36).substring(2, 9));
  // Keep inputs readOnly on initial mount so browser password managers completely skip them, unlock on user interaction
  const [inputsUnlocked, setInputsUnlocked] = useState(false);

  // Input element refs for direct DOM clearing if browser autofill engines inject values
  const authFullNameRef = useRef(null);
  const authPhoneRef = useRef(null);
  const authEmailRef = useRef(null);
  const authPasswordRef = useRef(null);
  const authSecretKeyRef = useRef(null);

  // Clear all previous input values from login and register forms
  const resetAuthForm = () => {
    setAuthEmail('');
    setAuthPassword('');
    setAuthFullName('');
    setAuthPhone('');
    setAuthSecretKey('');
    setShowPassword(false);
    setAuthError('');
    setInputsUnlocked(false);

    if (authFullNameRef.current) authFullNameRef.current.value = '';
    if (authPhoneRef.current) authPhoneRef.current.value = '';
    if (authEmailRef.current) authEmailRef.current.value = '';
    if (authPasswordRef.current) authPasswordRef.current.value = '';
    if (authSecretKeyRef.current) authSecretKeyRef.current.value = '';
  };

  // Wipe all previous input values on mount and mode changes to prevent browser password managers from pre-filling
  useEffect(() => {
    resetAuthForm();
    setAuthFormSeed(Math.random().toString(36).substring(2, 9));

    // Browser password managers / autofill engines inject credentials asynchronously 50-1000ms after DOM mount
    const timeouts = [50, 150, 300, 600, 1000].map(delay =>
      setTimeout(() => {
        if (!inputsUnlocked) {
          resetAuthForm();
        }
      }, delay)
    );

    const handleWindowFocus = () => {
      if (!inputsUnlocked) {
        resetAuthForm();
      }
    };
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pageshow', handleWindowFocus);

    return () => {
      timeouts.forEach(t => clearTimeout(t));
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pageshow', handleWindowFocus);
      resetAuthForm();
    };
  }, [isAdminLoggedIn, authMode]);
  
  // Logged-in Admin Info
  const [loggedInAdminName, setLoggedInAdminName] = useState(() => {
    return localStorage.getItem('bda_admin_name') || 'Admin Anna';
  });
  const [loggedInAdminPhone, setLoggedInAdminPhone] = useState(() => {
    return localStorage.getItem('bda_admin_phone') || '+91 98765 00000';
  });

  // Sidebar Tab State (after login) - derived from URL path for full SPA experience
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseTabFromPath(window.location.pathname);
    }
    return 'dashboard';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // SPA Navigation Helper
  const navigateToTab = (newTab, replace = false) => {
    setActiveTab(newTab);
    setIsMobileSidebarOpen(false);

    if (typeof window !== 'undefined') {
      const targetPath = ADMIN_TAB_ROUTES[newTab] || '/admin/dashboard';
      if (window.location.pathname !== targetPath) {
        if (replace) {
          window.history.replaceState({ adminTab: newTab }, '', targetPath);
        } else {
          window.history.pushState({ adminTab: newTab }, '', targetPath);
        }
      }
      const tabTitles = {
        'dashboard': 'Admin Dashboard • Book Driver Anna',
        'for-driver': 'Driver Bookings Management • Admin • Book Driver Anna',
        'for-vehicle': 'Vehicle Rentals Management • Admin • Book Driver Anna',
        'for-class': 'Driving Academy Enrollments • Admin • Book Driver Anna',
        'users': 'Customers & Fleet Partners • Admin • Book Driver Anna'
      };
      document.title = tabTitles[newTab] || 'Admin Portal • Book Driver Anna';
    }
  };

  // Synchronize activeTab on initial mount and handle browser back/forward navigation in SPA
  useEffect(() => {
    const syncFromUrl = () => {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path === '/admin' || path.startsWith('/admin/')) {
          const tab = parseTabFromPath(path);
          setActiveTab(tab);
          const tabTitles = {
            'dashboard': 'Admin Dashboard • Book Driver Anna',
            'for-driver': 'Driver Bookings Management • Admin • Book Driver Anna',
            'for-vehicle': 'Vehicle Rentals Management • Admin • Book Driver Anna',
            'for-class': 'Driving Academy Enrollments • Admin • Book Driver Anna',
            'users': 'Customers & Fleet Partners • Admin • Book Driver Anna'
          };
          document.title = tabTitles[tab] || 'Admin Portal • Book Driver Anna';
        }
      }
    };

    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  // Update URL if user lands on plain /admin or /admin/
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      const tab = parseTabFromPath(currentPath);
      if (currentPath === '/admin' || currentPath === '/admin/') {
        window.history.replaceState({ adminTab: tab }, '', ADMIN_TAB_ROUTES[tab]);
      }
    }
  }, [isAdminLoggedIn]);

  // Ensure authentic admin token is active whenever admin portal is accessed
  useEffect(() => {
    if (isAdminLoggedIn) {
      const storedToken = localStorage.getItem('bda_admin_token');
      if (!storedToken) {
        apiClient.adminSession({ phone: loggedInAdminPhone })
          .catch(() => {});
      }
    }
  }, [isAdminLoggedIn, loggedInAdminPhone]);

  // Persistent Driver Bookings State
  const [driverBookings, setDriverBookings] = useState(() => {
    const saved = localStorage.getItem('bda_driver_bookings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Cleanse legacy fake placeholders and exclude driving classes from driver bookings
          const sanitized = parsed
            .filter(b => b.tripType !== 'class' && b.booking_type !== 'class' && (!b.id || !b.id.startsWith('BDA-CLS-')))
            .map(b => ({
              ...b,
              assignedDriver: (b.assignedDriver && b.assignedDriver !== 'Driver Assigned on Dispatch' && b.assignedDriver !== 'Driver Assigned' && b.assignedDriver !== 'Pending Admin Acceptance') ? b.assignedDriver : '',
              assignedDriverPhone: (b.assignedDriverPhone && b.assignedDriverPhone !== '+91 80 2555 0199') ? b.assignedDriverPhone : ''
            }));
          const hasCancelled = sanitized.some(b => b.status === 'Cancelled');
          if (!hasCancelled) {
            const cancelledExample = DEFAULT_DRIVER_BOOKINGS.find(b => b.status === 'Cancelled');
            if (cancelledExample) {
              const merged = [...sanitized, cancelledExample];
              localStorage.setItem('bda_driver_bookings', JSON.stringify(merged));
              return merged;
            }
          }
          localStorage.setItem('bda_driver_bookings', JSON.stringify(sanitized));
          return sanitized;
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
        const clean = sanitizeClients(parsed);
        localStorage.setItem('bda_registered_clients', JSON.stringify(clean));
        return clean;
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
        const clean = sanitizeDrivers(parsed);
        localStorage.setItem('bda_registered_drivers', JSON.stringify(clean));
        return clean;
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

  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [isPurgingData, setIsPurgingData] = useState(false);

  const handleConfirmPurgeData = async () => {
    setIsPurgingData(true);
    try {
      await apiClient.clearAllData().catch((err) => {
        console.warn('[PURGE] Backend clear notice:', err.message);
      });
      localStorage.setItem('bda_driver_bookings', JSON.stringify([]));
      localStorage.setItem('bda_vehicle_bookings', JSON.stringify([]));
      localStorage.setItem('bda_class_enrollments', JSON.stringify([]));
      localStorage.setItem('bda_registered_clients', JSON.stringify([]));
      localStorage.setItem('bda_registered_drivers', JSON.stringify([]));
      setDriverBookings([]);
      setVehicleBookings([]);
      setClassEnrollments([]);
      setRegisteredUsers([]);
      setRegisteredDrivers([]);
      window.dispatchEvent(new CustomEvent('bda_booking_updated'));
      setIsPurgeModalOpen(false);
      triggerToast('All test bookings, dummy clients, and driver profiles permanently cleared. Ready for live Bangalore production.');
    } catch (err) {
      alert('Failed to clear data: ' + err.message);
    } finally {
      setIsPurgingData(false);
    }
  };

  useScrollLock(Boolean(userToDelete || isAddUserModalOpen || isAddDriverModalOpen || isMobileSidebarOpen || isPurgeModalOpen));
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
    const loadBookingsFromStorage = (e) => {
      // If a specific booking update is broadcast, apply directly to state & storage
      if (e?.detail?.bookingId) {
        const { bookingId, status, assignedDriver, assignedDriverPhone } = e.detail;
        const validDriverName = (assignedDriver && assignedDriver !== 'Pending Admin Acceptance' && !assignedDriver.includes('Assigned on Dispatch') && assignedDriver !== 'Driver Assigned') ? assignedDriver : undefined;
        
        if (validDriverName || assignedDriverPhone) {
          setDriverInputState(prev => ({
            ...prev,
            [bookingId]: {
              name: validDriverName ?? prev[bookingId]?.name ?? '',
              phone: assignedDriverPhone ?? prev[bookingId]?.phone ?? ''
            }
          }));
        }

        setDriverBookings(prev => {
          const updated = prev.map(b => {
            if (b.id === bookingId) {
              return {
                ...b,
                status: status || b.status,
                assignedDriver: validDriverName !== undefined ? validDriverName : (b.assignedDriver === 'Pending Admin Acceptance' ? '' : b.assignedDriver),
                assignedDriverPhone: assignedDriverPhone !== undefined ? assignedDriverPhone : b.assignedDriverPhone
              };
            }
            return b;
          });
          localStorage.setItem('bda_driver_bookings', JSON.stringify(updated));
          return updated;
        });
        return;
      }

      const savedDriver = localStorage.getItem('bda_driver_bookings');
      if (savedDriver) {
        try { 
          const list = JSON.parse(savedDriver);
          setDriverBookings(Array.isArray(list) ? list.filter(b => b.tripType !== 'class' && b.booking_type !== 'class' && (!b.id || !b.id.startsWith('BDA-CLS-'))) : []); 
        } catch (e) {}
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
        try { setRegisteredUsers(sanitizeClients(JSON.parse(savedUsers))); } catch (e) {}
      }
      const savedDrivers = localStorage.getItem('bda_registered_drivers');
      if (savedDrivers) {
        try { setRegisteredDrivers(sanitizeDrivers(JSON.parse(savedDrivers))); } catch (e) {}
      }
    };

    const handleDriverStatusSync = (e) => {
      if (e?.detail) {
        const { driverId, phone, isOnline } = e.detail;
        setRegisteredDrivers(prev => {
          const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
          return prev.map(d => {
            const dPhone = (d.phone || '').replace(/[^0-9]/g, '');
            if ((driverId && d.id === driverId) || (cleanPhone && dPhone && (dPhone === cleanPhone || dPhone.includes(cleanPhone) || cleanPhone.includes(dPhone)))) {
              return { ...d, isOnline };
            }
            return d;
          });
        });
      }
      loadBookingsFromStorage();
    };

    window.addEventListener('bda_booking_updated', loadBookingsFromStorage);
    window.addEventListener('bda_order_created', loadBookingsFromStorage);
    window.addEventListener('bda_client_registered', loadBookingsFromStorage);
    window.addEventListener('bda_driver_registered', loadBookingsFromStorage);
    window.addEventListener('bda_driver_status_updated', handleDriverStatusSync);
    window.addEventListener('storage', loadBookingsFromStorage);

    return () => {
      window.removeEventListener('bda_booking_updated', loadBookingsFromStorage);
      window.removeEventListener('bda_order_created', loadBookingsFromStorage);
      window.removeEventListener('bda_client_registered', loadBookingsFromStorage);
      window.removeEventListener('bda_driver_registered', loadBookingsFromStorage);
      window.removeEventListener('bda_driver_status_updated', handleDriverStatusSync);
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

  // Sync users with backend server database when admin is logged in
  useEffect(() => {
    if (!isAdminLoggedIn) return;
    apiClient.getAdminUsers()
      .then((res) => {
        if (res && res.data && Array.isArray(res.data.users)) {
          setRegisteredUsers((prev) => {
            const serverUsers = res.data.users
              .filter(u => {
                const email = (u.email || '').toLowerCase();
                return (
                  !email.startsWith('newuser_') &&
                  !email.startsWith('brand_new_user_') &&
                  !email.startsWith('test_new_client_') &&
                  !email.startsWith('user_a_') &&
                  !email.startsWith('user_b_')
                );
              })
              .map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                phone: u.phone,
                area: u.area || 'Indiranagar',
                status: u.status || 'Active',
                createdAt: u.created_at || u.createdAt || new Date().toISOString().split('T')[0]
              }));

            const cleanPrev = sanitizeClients(prev || []);
            const map = new Map();
            cleanPrev.forEach(u => map.set(u.id || u.phone || u.email, u));
            serverUsers.forEach(u => {
              const key = u.id || u.phone || u.email;
              map.set(key, { ...(map.get(key) || {}), ...u });
            });

            const merged = sanitizeClients(Array.from(map.values()));
            localStorage.setItem('bda_registered_clients', JSON.stringify(merged));
            return merged;
          });
        }
      })
  }, [isAdminLoggedIn]);

  // Sync server bookings with admin dashboard when admin is logged in
  useEffect(() => {
    if (!isAdminLoggedIn) return;
    apiClient.getAdminBookings()
      .then((res) => {
        if (res && res.data && Array.isArray(res.data.bookings)) {
          const serverDriverBookings = [];
          const serverVehicleBookings = [];
          const serverClassEnrollments = [];

          res.data.bookings.forEach((b) => {
            const rawStatus = (b.status || 'PENDING').toUpperCase();
            const formattedStatus = 
              rawStatus === 'ASSIGNED' ? 'Assigned' :
              rawStatus === 'CONFIRMED' ? 'Confirmed' :
              rawStatus === 'CANCELLED' ? 'Cancelled' : 'Pending';

            if (b.booking_type === 'vehicle') {
              serverVehicleBookings.push({
                id: b.id,
                customerName: b.customer_name,
                phone: b.customer_phone,
                email: b.customer_email,
                category: b.trip_type,
                vehicleName: b.service_name,
                pickupArea: b.pickup_area,
                dropLocation: b.drop_location,
                date: b.date,
                time: b.time,
                fare: b.calculated_fare,
                paymentMode: b.payment_mode,
                status: formattedStatus
              });
            } else if (b.booking_type === 'class' || (b.id && b.id.startsWith('BDA-CLS-'))) {
              serverClassEnrollments.push({
                enrollmentId: b.id,
                fullName: b.customer_name,
                mobileNumber: b.customer_phone,
                emailAddress: b.customer_email,
                address: b.pickup_area || '',
                pickupLocation: b.pickup_area || '',
                preferredStartDate: b.date,
                preferredTime: b.time || 'Morning',
                courseFee: b.calculated_fare,
                status: formattedStatus,
                assignedInstructor: b.assigned_driver_name || '',
                assignedInstructorPhone: b.assigned_driver_phone || ''
              });
            } else {
              const cleanDriverName = (b.assigned_driver_name && b.assigned_driver_name !== 'Driver Assigned on Dispatch' && b.assigned_driver_name !== 'Driver Assigned' && b.assigned_driver_name !== 'Pending Admin Acceptance') ? b.assigned_driver_name : '';
              const cleanDriverPhone = (b.assigned_driver_phone && b.assigned_driver_phone !== '+91 80 2555 0199') ? b.assigned_driver_phone : '';

              serverDriverBookings.push({
                id: b.id,
                customerName: b.customer_name,
                phone: b.customer_phone,
                email: b.customer_email,
                tripType: b.trip_type,
                tripTitle: b.service_name,
                pickupArea: b.pickup_area,
                dropLocation: b.drop_location,
                date: b.date,
                time: b.time,
                fare: b.calculated_fare,
                paymentMode: b.payment_mode,
                status: formattedStatus,
                assignedDriver: cleanDriverName,
                assignedDriverPhone: cleanDriverPhone
              });
            }
          });

          if (serverDriverBookings.length > 0) {
            setDriverBookings(prev => {
              const map = new Map();
              (prev || []).forEach(b => map.set(b.id, b));
              serverDriverBookings.forEach(b => {
                const existing = map.get(b.id);

                // Authoritative status resolution:
                // Server status takes precedence when server is Assigned, Confirmed, or Cancelled.
                // If local status was Assigned or Cancelled, keep it if server is still Pending.
                let finalStatus = b.status || 'Pending';
                if (b.status === 'Assigned' || existing?.status === 'Assigned') {
                  finalStatus = 'Assigned';
                } else if (b.status === 'Cancelled' || existing?.status === 'Cancelled') {
                  finalStatus = 'Cancelled';
                } else if (b.status === 'Confirmed' || existing?.status === 'Confirmed') {
                  finalStatus = 'Confirmed';
                }

                const isInvalidName = (n) => 
                  !n || 
                  n === 'Pending Admin Acceptance' || 
                  n === 'Driver Assigned on Dispatch' || 
                  n === 'Driver Assigned' || 
                  n.includes('Assigned on Dispatch');

                let validName = '';
                if (!isInvalidName(b.assignedDriver)) {
                  validName = b.assignedDriver;
                } else if (!isInvalidName(existing?.assignedDriver)) {
                  validName = existing.assignedDriver;
                }

                let validPhone = '';
                if (b.assignedDriverPhone && b.assignedDriverPhone !== '+91 80 2555 0199') {
                  validPhone = b.assignedDriverPhone;
                } else if (existing?.assignedDriverPhone && existing.assignedDriverPhone !== '+91 80 2555 0199') {
                  validPhone = existing.assignedDriverPhone;
                }

                if (validName || validPhone) {
                  setDriverInputState(inp => ({
                    ...inp,
                    [b.id]: {
                      name: validName || inp[b.id]?.name || '',
                      phone: validPhone || inp[b.id]?.phone || ''
                    }
                  }));
                }

                map.set(b.id, { 
                  ...(existing || {}), 
                  ...b, 
                  assignedDriver: validName,
                  assignedDriverPhone: validPhone,
                  status: finalStatus 
                });
              });
              // Filter out any class enrollments that might have lingered
              const merged = Array.from(map.values()).filter(b => b.tripType !== 'class' && b.booking_type !== 'class' && (!b.id || !b.id.startsWith('BDA-CLS-')));
              localStorage.setItem('bda_driver_bookings', JSON.stringify(merged));
              return merged;
            });
          }

          if (serverVehicleBookings.length > 0) {
            setVehicleBookings(prev => {
              const map = new Map();
              (prev || []).forEach(b => map.set(b.id, b));
              serverVehicleBookings.forEach(b => {
                const existing = map.get(b.id);
                let finalStatus = b.status || 'Pending';
                if (b.status === 'Confirmed' || existing?.status === 'Confirmed') {
                  finalStatus = 'Confirmed';
                } else if (b.status === 'Cancelled' || existing?.status === 'Cancelled') {
                  finalStatus = 'Cancelled';
                } else if (b.status === 'Assigned' || existing?.status === 'Assigned') {
                  finalStatus = 'Assigned';
                }
                map.set(b.id, { ...(existing || {}), ...b, status: finalStatus });
              });
              const merged = Array.from(map.values());
              localStorage.setItem('bda_vehicle_bookings', JSON.stringify(merged));
              return merged;
            });
          }

          if (serverClassEnrollments.length > 0) {
            setClassEnrollments(prev => {
              const map = new Map();
              (prev || []).forEach(e => map.set(e.enrollmentId, e));
              serverClassEnrollments.forEach(e => {
                const existing = map.get(e.enrollmentId);
                let finalStatus = e.status || 'Pending';
                if (e.status === 'Confirmed' || existing?.status === 'Confirmed') finalStatus = 'Confirmed';
                else if (e.status === 'Cancelled' || existing?.status === 'Cancelled') finalStatus = 'Cancelled';
                else if (e.status === 'In Training' || existing?.status === 'In Training') finalStatus = 'In Training';

                map.set(e.enrollmentId, {
                  ...(existing || {}),
                  ...e,
                  status: finalStatus,
                  assignedInstructor: e.assignedInstructor || existing?.assignedInstructor || '',
                  assignedInstructorPhone: e.assignedInstructorPhone || existing?.assignedInstructorPhone || ''
                });
              });
              const merged = Array.from(map.values());
              localStorage.setItem('bda_class_enrollments', JSON.stringify(merged));
              return merged;
            });
          }
        }
      })
      .catch(() => {});
  }, [isAdminLoggedIn]);

  // Search & Filters
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [driverStatusFilter, setDriverStatusFilter] = useState('All');

  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState('All');

  const [classSearchQuery, setClassSearchQuery] = useState('');
  const [classStatusFilter, setClassStatusFilter] = useState('All');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  // Handle Login & Registration with server-side authentication
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    const submittedEmail = authEmail.trim();
    const submittedPassword = authPassword.trim();
    const submittedFullName = authFullName.trim();
    const submittedPhone = authPhone.trim();
    const submittedSecretKey = authSecretKey.trim();

    if (!submittedEmail || !submittedPassword) {
      setAuthError('Please enter email and password');
      return;
    }

    if (authMode === 'register') {
      if (!submittedFullName) {
        setAuthError('Please enter your full name');
        return;
      }
      if (!submittedPhone) {
        setAuthError('Please enter your mobile phone number');
        return;
      }
      if (submittedPassword.length < 6) {
        setAuthError('Password must be at least 6 characters long');
        return;
      }
      if (submittedSecretKey !== 'ANNA2026') {
        setAuthError('Invalid Admin Secret Key.');
        return;
      }
    }

    setIsAuthSubmitting(true);
    try {
      if (authMode === 'register') {
        const nameToSave = submittedFullName;
      const phoneToSave = submittedPhone;
      const emailLower = submittedEmail.toLowerCase();

      // Clear input fields immediately after successful form validation and submission
      resetAuthForm();

      // Attempt backend admin registration in database (TiDB / SQLite)
      try {
        await apiClient.adminRegister({
          name: nameToSave,
          email: emailLower,
          phone: phoneToSave,
          password: submittedPassword,
          secretKey: submittedSecretKey
        });
      } catch (err) {
        console.warn('[ADMIN AUTH] Remote admin registration error/fallback:', err.message);
      }

      // Save newly registered admin locally so they can always log in via offline fallback mode
      try {
        let registeredAdmins = [];
        const saved = localStorage.getItem('bda_registered_admins');
        if (saved) registeredAdmins = JSON.parse(saved);
        registeredAdmins = registeredAdmins.filter(a => a.email !== emailLower);
        registeredAdmins.push({
          name: nameToSave,
          phone: phoneToSave,
          email: emailLower,
          password: submittedPassword
        });
        localStorage.setItem('bda_registered_admins', JSON.stringify(registeredAdmins));
      } catch (e) {}

      setLoggedInAdminName(nameToSave);
      setLoggedInAdminPhone(phoneToSave);
      setIsAdminLoggedIn(true);
      localStorage.setItem('bda_admin_logged_in', 'true');
      localStorage.setItem('bda_admin_name', nameToSave);
      localStorage.setItem('bda_admin_phone', phoneToSave);

      const requestedTab = parseTabFromPath(window.location.pathname);
      navigateToTab(requestedTab, true);
      return;
    }

    try {
      const res = await apiClient.adminLogin({
        identifier: submittedEmail,
        password: submittedPassword
      });

      if (res && res.data && res.data.user) {
        // Clear input fields immediately upon successful login
        resetAuthForm();

        setLoggedInAdminName(res.data.user.name);
        setLoggedInAdminPhone(res.data.user.phone);
        setIsAdminLoggedIn(true);
        localStorage.setItem('bda_admin_logged_in', 'true');
        localStorage.setItem('bda_admin_name', res.data.user.name);
        localStorage.setItem('bda_admin_phone', res.data.user.phone);
        const requestedTab = parseTabFromPath(window.location.pathname);
        navigateToTab(requestedTab, true);
        return;
      }
    } catch (apiErr) {
      // 1. Invalid credentials from backend (401)
      if (apiErr.status === 401 || apiErr.code === 'INVALID_CREDENTIALS') {
        setAuthError(apiErr.message || 'Invalid admin email or password.');
        return;
      } else if (apiErr.status === 403 || apiErr.code === 'INSUFFICIENT_PRIVILEGES') {
        setAuthError('Access denied: You do not have administrator privileges.');
        return;
      } else if (apiErr.status === 429) {
        setAuthError(apiErr.message || 'Too many login attempts. Please wait a few minutes.');
        return;
      } else if (apiErr.code !== 'NETWORK_ERROR' && apiErr.status !== 500) {
        setAuthError(apiErr.message || 'Admin authentication failed.');
        return;
      }

      // If network error or 500, proceed to offline fallback check below
      console.warn('[ADMIN AUTH] Backend unreachable; checking local fallback.');
    }

    // In offline fallback mode, verify credentials against locally registered admin
    const emailLower = submittedEmail.toLowerCase();
    let isMatch = false;
    let nameToSave = 'Administrator';
    let phoneToSave = '+91 80 2555 0199';

    try {
      const saved = localStorage.getItem('bda_registered_admins');
      if (saved) {
        const registeredAdmins = JSON.parse(saved);
        const found = registeredAdmins.find(a => a.email === emailLower && a.password === submittedPassword);
        if (found) {
          isMatch = true;
          nameToSave = found.name;
          phoneToSave = found.phone;
        }
      }
    } catch (e) {}

    if (!isMatch) {
      setAuthError('Invalid administrator credentials.');
      return;
    }

    // Clear input fields immediately after fallback match
    resetAuthForm();

    setLoggedInAdminName(nameToSave);
    setLoggedInAdminPhone(phoneToSave);
    setIsAdminLoggedIn(true);

    // Save session to localStorage
    localStorage.setItem('bda_admin_logged_in', 'true');
    localStorage.setItem('bda_admin_name', nameToSave);
    localStorage.setItem('bda_admin_phone', phoneToSave);

    // Navigate to the requested tab from URL
    const requestedTab = parseTabFromPath(window.location.pathname);
    navigateToTab(requestedTab, true);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setIsMobileSidebarOpen(false);
    resetAuthForm();
    try {
      await apiClient.logout();
    } catch (e) {}
    localStorage.removeItem('bda_admin_logged_in');
    localStorage.removeItem('bda_admin_name');
    localStorage.removeItem('bda_admin_phone');
    setIsAdminLoggedIn(false);
    setActiveTab('dashboard');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/admin/dashboard');
      document.title = 'Admin Portal • Book Driver Anna';
    }
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
  const handleAcceptAndAssignDriver = async (bookingId, overrideName = null, overridePhone = null) => {
    const typedName = (overrideName !== null ? overrideName : driverInputState[bookingId]?.name)?.trim();
    const typedPhone = (overridePhone !== null ? overridePhone : driverInputState[bookingId]?.phone)?.trim();
    
    if (!typedName || !typedPhone) {
      console.warn('[ADMIN] Cannot accept & assign driver without valid driver name and phone.');
      return false;
    }

    const finalName = typedName;
    const finalPhone = typedPhone;

    // Look up assigned driver UPI from registered drivers fleet
    const matchedDriver = registeredDrivers.find(d => {
      const dClean = (d.phone || '').replace(/[^0-9]/g, '');
      const tClean = finalPhone.replace(/[^0-9]/g, '');
      return (tClean && dClean && (tClean === dClean || tClean.includes(dClean) || dClean.includes(tClean))) ||
             (d.name && d.name.toLowerCase().trim() === finalName.toLowerCase().trim());
    });
    const finalUpi = matchedDriver?.upiId || `${finalName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'driver'}@oksbi`;

    // Update input state as well so the inputs reflect the assigned driver
    setDriverInputState(prev => ({
      ...prev,
      [bookingId]: {
        name: finalName,
        phone: finalPhone
      }
    }));

    // Synchronously update localStorage so immediate listeners or storage readers see the updated booking
    try {
      const currentList = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
      const updatedList = currentList.map(b => (b.id === bookingId ? {
        ...b,
        assignedDriver: finalName,
        assignedDriverPhone: finalPhone,
        assignedDriverUpi: finalUpi,
        status: 'Assigned'
      } : b));
      localStorage.setItem('bda_driver_bookings', JSON.stringify(updatedList));
    } catch (e) {}

    // 1. Update React state immediately
    setDriverBookings(prev => {
      const updated = prev.map(b => {
        if (b.id === bookingId) {
          return {
            ...b,
            assignedDriver: finalName,
            assignedDriverPhone: finalPhone,
            assignedDriverUpi: finalUpi,
            status: 'Assigned'
          };
        }
        return b;
      });
      localStorage.setItem('bda_driver_bookings', JSON.stringify(updated));
      return updated;
    });

    // 2. Broadcast booking update event to client listeners across all tabs and windows
    broadcastBookingUpdate({
      bookingId,
      status: 'Assigned',
      assignedDriver: finalName,
      assignedDriverPhone: finalPhone,
      assignedDriverUpi: finalUpi
    });

    // 3. Persist to authoritative backend database with driver details
    try {
      if (!localStorage.getItem('bda_admin_token')) {
        await apiClient.adminSession({ phone: loggedInAdminPhone }).catch(() => {});
      }
      await apiClient.updateAdminBooking(bookingId, {
        status: 'ASSIGNED',
        driverName: finalName,
        driverPhone: finalPhone,
        assignedDriverName: finalName,
        assignedDriverPhone: finalPhone
      });
    } catch (err) {
      console.warn('[ADMIN] Backend booking status update note:', err.message);
    }

    return true;
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
        `If this cancellation was unexpected or you need a replacement driver, please reach our 24x7 helpdesk at +91 80 2555 0199. Thank you!`;
      window.open(`https://api.whatsapp.com/send?phone=${cleanClientPhone}&text=${encodeURIComponent(cancelMsg)}`, '_blank');
      return;
    }

    const driverName = booking.assignedDriver || "Driver Assigned";
    const driverPhone = booking.assignedDriverPhone || "+91 80 2555 0199";

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
        `For queries or rebooking, call our 24x7 fleet desk at +91 80 2555 0199. Thank you!`;
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
  const handleUpdateDriverStatus = async (bookingId, newStatus) => {
    const dbStatus = newStatus === 'Assigned' ? 'ASSIGNED' : (newStatus === 'Cancelled' ? 'CANCELLED' : (newStatus === 'Pending' ? 'PENDING' : 'CONFIRMED'));
    
    try {
      const cur = JSON.parse(localStorage.getItem('bda_driver_bookings') || '[]');
      const upd = cur.map(b => (b.id === bookingId ? { ...b, status: newStatus } : b));
      localStorage.setItem('bda_driver_bookings', JSON.stringify(upd));
    } catch (e) {}

    setDriverBookings(prev => {
      const updated = prev.map(b => (b.id === bookingId ? { ...b, status: newStatus } : b));
      localStorage.setItem('bda_driver_bookings', JSON.stringify(updated));
      return updated;
    });
    broadcastBookingUpdate({ bookingId, status: newStatus });
    try {
      await apiClient.updateAdminBooking(bookingId, { status: dbStatus });
    } catch (err) {
      console.warn('[ADMIN] Driver status update note:', err.message);
    }
  };

  // Quick Action: Update vehicle booking status
  const handleUpdateVehicleStatus = async (bookingId, newStatus) => {
    const dbStatus = newStatus === 'Confirmed' ? 'CONFIRMED' : (newStatus === 'Cancelled' ? 'CANCELLED' : (newStatus === 'Pending' ? 'PENDING' : 'ASSIGNED'));
    
    try {
      const cur = JSON.parse(localStorage.getItem('bda_vehicle_bookings') || '[]');
      const upd = cur.map(b => (b.id === bookingId ? { ...b, status: newStatus } : b));
      localStorage.setItem('bda_vehicle_bookings', JSON.stringify(upd));
    } catch (e) {}

    setVehicleBookings(prev => {
      const updated = prev.map(b => (b.id === bookingId ? { ...b, status: newStatus } : b));
      localStorage.setItem('bda_vehicle_bookings', JSON.stringify(updated));
      return updated;
    });
    broadcastBookingUpdate({ bookingId, status: newStatus });
    try {
      await apiClient.updateAdminBooking(bookingId, { status: dbStatus });
    } catch (err) {
      console.warn('[ADMIN] Vehicle status update note:', err.message);
    }
  };

  // Quick Action: Update class enrollment status (Pending, In Training, Completed, Cancelled)
  const handleUpdateClassStatus = async (enrollmentId, newStatus) => {
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

    setDriverBookings(prev => {
      const updated = prev.map(b => (b.id === enrollmentId ? { ...b, status: newStatus } : b));
      localStorage.setItem('bda_driver_bookings', JSON.stringify(updated));
      return updated;
    });

    broadcastBookingUpdate({ bookingId: enrollmentId, status: newStatus });

    try {
      const dbStatus = newStatus === 'Completed' ? 'COMPLETED' : (newStatus === 'Cancelled' ? 'CANCELLED' : 'CONFIRMED');
      await apiClient.updateAdminBooking(enrollmentId, { status: dbStatus });
    } catch (err) {}
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
        `For re-enrollment or queries, please reach our academy desk at +91 80 2555 0199. Thank you!`;
      window.open(`https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(cancelMsg)}`, '_blank');
      return;
    }

    const currentName = instructorInputState[enrollment.enrollmentId]?.name?.trim() || enrollment.assignedInstructor || "Instructor Assigned";
    const currentPhone = instructorInputState[enrollment.enrollmentId]?.phone?.trim() || enrollment.assignedInstructorPhone || "+91 80 2555 0199";

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
      `\nFor any queries or schedule updates, reach our academy desk at +91 80 2555 0199. Happy & safe driving with Book Driver Anna! 🚗✨`;

    window.open(`https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
  };

  // Filtered driver bookings (Strictly personal driver duties, exclude driving class enrollments)
  const filteredDriverBookings = driverBookings.filter(b => {
    if (b.tripType === 'class' || b.booking_type === 'class' || (b.id && b.id.startsWith('BDA-CLS-'))) {
      return false;
    }
    const matchesSearch = (b.customerName || '').toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
                          (b.id || '').toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
                          (b.pickupArea || '').toLowerCase().includes(driverSearchQuery.toLowerCase());
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

  // Handle Add User Form Submission
  const handleAddUserSubmit = (e) => {
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
  };

  // Handle Add Driver Form Submission
  const handleAddDriverSubmit = (e) => {
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
      isOnline: true,
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
  };

  // Toggle Driver Online/Offline Duty Status directly from Admin
  const handleToggleDriverDuty = (driverId) => {
    setRegisteredDrivers(prev => {
      const updated = prev.map(d => {
        if (d.id === driverId) {
          const newOnline = !(d.isOnline !== false);
          return { ...d, isOnline: newOnline };
        }
        return d;
      });
      localStorage.setItem('bda_registered_drivers', JSON.stringify(updated));
      const targetDriver = updated.find(d => d.id === driverId);
      window.dispatchEvent(new CustomEvent('bda_driver_status_updated', {
        detail: {
          driverId,
          phone: targetDriver?.phone,
          isOnline: targetDriver?.isOnline
        }
      }));
      return updated;
    });
  };

  // Render Admin Authentication View if not logged in
  if (!isAdminLoggedIn) {
    return (
      <AdminAuthView
        authMode={authMode}
        setAuthMode={setAuthMode}
        isAuthSubmitting={isAuthSubmitting}
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        authFullName={authFullName}
        setAuthFullName={setAuthFullName}
        authPhone={authPhone}
        setAuthPhone={setAuthPhone}
        authSecretKey={authSecretKey}
        setAuthSecretKey={setAuthSecretKey}
        authError={authError}
        authFormSeed={authFormSeed}
        inputsUnlocked={inputsUnlocked}
        setInputsUnlocked={setInputsUnlocked}
        authFullNameRef={authFullNameRef}
        authPhoneRef={authPhoneRef}
        authEmailRef={authEmailRef}
        authPasswordRef={authPasswordRef}
        authSecretKeyRef={authSecretKeyRef}
        handleAuthSubmit={handleAuthSubmit}
        resetAuthForm={resetAuthForm}
        onReturnToClient={onReturnToClient}
      />
    );
  }

  // Render Logged-in Admin Dashboard with Sidebar Navigation and Tab Views
  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      <AdminSidebar
        activeTab={activeTab}
        navigateToTab={navigateToTab}
        loggedInAdminName={loggedInAdminName}
        loggedInAdminPhone={loggedInAdminPhone}
        driverBookingsCount={driverBookings.filter(b => b.tripType !== 'class' && b.booking_type !== 'class' && (!b.id || !b.id.startsWith('BDA-CLS-'))).length}
        vehicleBookingsCount={vehicleBookings.length}
        classEnrollmentsCount={classEnrollments.length}
        usersCount={registeredUsers.length + registeredDrivers.length}
        isMobileSidebarOpen={isMobileSidebarOpen}
        setIsMobileSidebarOpen={setIsMobileSidebarOpen}
        handleLogout={handleLogout}
        onReturnToClient={onReturnToClient}
        onOpenPurgeModal={() => setIsPurgeModalOpen(true)}
      />

      <main className="flex-1 min-w-0 w-full lg:h-full lg:overflow-y-auto p-3.5 sm:p-6 lg:p-8 xl:p-10 max-w-full overflow-x-hidden">
        {activeTab === 'dashboard' && (
          <AdminDashboardTab
            navigateToTab={navigateToTab}
            driverBookings={driverBookings.filter(b => b.tripType !== 'class' && b.booking_type !== 'class' && (!b.id || !b.id.startsWith('BDA-CLS-')))}
            vehicleBookings={vehicleBookings}
            classEnrollments={classEnrollments}
            registeredUsers={registeredUsers}
            registeredDrivers={registeredDrivers}
            sendWhatsAppToClientForDriver={sendWhatsAppToClientForDriver}
          />
        )}

        {activeTab === 'for-driver' && (
          <AdminDriverTab
            driverSearchQuery={driverSearchQuery}
            setDriverSearchQuery={setDriverSearchQuery}
            driverStatusFilter={driverStatusFilter}
            setDriverStatusFilter={setDriverStatusFilter}
            filteredDriverBookings={filteredDriverBookings}
            driverInputState={driverInputState}
            handleDriverInputChange={handleDriverInputChange}
            handleUpdateDriverStatus={handleUpdateDriverStatus}
            handleAcceptAndAssignDriver={handleAcceptAndAssignDriver}
            registeredDrivers={registeredDrivers}
            sendWhatsAppToClientForDriver={sendWhatsAppToClientForDriver}
          />
        )}

        {activeTab === 'for-vehicle' && (
          <AdminVehicleTab
            vehicleSearchQuery={vehicleSearchQuery}
            setVehicleSearchQuery={setVehicleSearchQuery}
            vehicleStatusFilter={vehicleStatusFilter}
            setVehicleStatusFilter={setVehicleStatusFilter}
            filteredVehicleBookings={filteredVehicleBookings}
            handleUpdateVehicleStatus={handleUpdateVehicleStatus}
            sendWhatsAppToClientForVehicle={sendWhatsAppToClientForVehicle}
          />
        )}

        {activeTab === 'for-class' && (
          <AdminClassTab
            setIsAdminEnrollmentModalOpen={setIsAdminEnrollmentModalOpen}
            classSearchQuery={classSearchQuery}
            setClassSearchQuery={setClassSearchQuery}
            classStatusFilter={classStatusFilter}
            setClassStatusFilter={setClassStatusFilter}
            filteredClassEnrollments={filteredClassEnrollments}
            classEnrollments={classEnrollments}
            instructorInputState={instructorInputState}
            handleInstructorInputChange={handleInstructorInputChange}
            handleUpdateClassStatus={handleUpdateClassStatus}
            sendWhatsAppToCandidate={sendWhatsAppToCandidate}
          />
        )}

        {activeTab === 'users' && (
          <AdminUsersTab
            userSubTab={userSubTab}
            setUserSubTab={setUserSubTab}
            setIsAddUserModalOpen={setIsAddUserModalOpen}
            setIsAddDriverModalOpen={setIsAddDriverModalOpen}
            registeredUsers={registeredUsers}
            registeredDrivers={registeredDrivers}
            userSearchQuery={userSearchQuery}
            setUserSearchQuery={setUserSearchQuery}
            userAreaFilter={userAreaFilter}
            setUserAreaFilter={setUserAreaFilter}
            handleOpenDeleteUserModal={handleOpenDeleteUserModal}
            onToggleDriverDuty={handleToggleDriverDuty}
          />
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

      {/* Admin Modals (Add Client, Add Driver, Delete User Confirmation) */}
      <AdminModals
        isAddUserModalOpen={isAddUserModalOpen}
        setIsAddUserModalOpen={setIsAddUserModalOpen}
        newUserName={newUserName}
        setNewUserName={setNewUserName}
        newUserPhone={newUserPhone}
        setNewUserPhone={setNewUserPhone}
        newUserEmail={newUserEmail}
        setNewUserEmail={setNewUserEmail}
        newUserArea={newUserArea}
        setNewUserArea={setNewUserArea}
        handleAddUserSubmit={handleAddUserSubmit}

        isAddDriverModalOpen={isAddDriverModalOpen}
        setIsAddDriverModalOpen={setIsAddDriverModalOpen}
        newDriverName={newDriverName}
        setNewDriverName={setNewDriverName}
        newDriverPhone={newDriverPhone}
        setNewDriverPhone={setNewDriverPhone}
        newDriverDl={newDriverDl}
        setNewDriverDl={setNewDriverDl}
        newDriverArea={newDriverArea}
        setNewDriverArea={setNewDriverArea}
        newDriverExperience={newDriverExperience}
        setNewDriverExperience={setNewDriverExperience}
        newDriverVehicleType={newDriverVehicleType}
        setNewDriverVehicleType={setNewDriverVehicleType}
        handleAddDriverSubmit={handleAddDriverSubmit}

        userToDelete={userToDelete}
        handleCloseDeleteUserModal={handleCloseDeleteUserModal}
        deletionReason={deletionReason}
        setDeletionReason={setDeletionReason}
        customDeletionReason={customDeletionReason}
        setCustomDeletionReason={setCustomDeletionReason}
        hasNoActiveTrips={hasNoActiveTrips}
        setHasNoActiveTrips={setHasNoActiveTrips}
        hasSettledPayments={hasSettledPayments}
        setHasSettledPayments={setHasSettledPayments}
        understandsIrreversible={understandsIrreversible}
        setUnderstandsIrreversible={setUnderstandsIrreversible}
        deleteConfirmText={deleteConfirmText}
        setDeleteConfirmText={setDeleteConfirmText}
        isSecurityPhraseValid={isSecurityPhraseValid}
        canExecuteDelete={canExecuteDelete}
        handleConfirmDeleteUser={handleConfirmDeleteUser}
        isPurgeModalOpen={isPurgeModalOpen}
        setIsPurgeModalOpen={setIsPurgeModalOpen}
        handleConfirmPurgeData={handleConfirmPurgeData}
        isPurgingData={isPurgingData}
      />
    </div>
  );
}
