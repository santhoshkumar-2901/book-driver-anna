import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Car, MapPin, Navigation, Maximize2, RotateCw, Filter, 
  Layers, Radio, UserCheck, Clock, AlertCircle, CheckCircle2, 
  ChevronRight, RefreshCw, X, Eye, Phone, Calendar
} from 'lucide-react';
import MapView, { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '../../components/map/MapView';
import DriverLocationMarker from '../../components/map/DriverLocationMarker';
import PickupMarker from '../../components/map/PickupMarker';
import DestinationMarker from '../../components/map/DestinationMarker';
import RoutePolyline from '../../components/map/RoutePolyline';
import { apiClient } from '../../services/apiClient';

// Active operational statuses
const ACTIVE_BOOKING_STATUSES = new Set(['CONFIRMED', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS']);

// Terminal booking statuses that must be purged from map
const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

/**
 * Validates coordinate pair
 */
function isValidCoord(lat, lng) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return (
    isFinite(nLat) &&
    isFinite(nLng) &&
    !isNaN(nLat) &&
    !isNaN(nLng) &&
    nLat >= -90 &&
    nLat <= 90 &&
    nLng >= -180 &&
    nLng <= 180
  );
}

/**
 * Calculates Haversine distance in meters
 */
function getHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function AdminOperationalMapTab({ onSelectBooking }) {
  // 1. Core Data State
  const [drivers, setDrivers] = useState({}); // { [id]: driverObj }
  const [bookings, setBookings] = useState({}); // { [id]: bookingObj }
  const [routes, setRoutes] = useState({}); // { [bookingId]: { geometry, distance, duration, type, driverId } }
  
  // 2. UI & Filter State
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'online' | 'assigned' | 'active_trips' | 'unassigned'
  const [selectedEntity, setSelectedEntity] = useState(null); // { type: 'driver' | 'booking', id }
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState('connecting'); // 'connected' | 'reconnecting' | 'disconnected'
  
  // 3. Map Viewport State
  const [mapBounds, setMapBounds] = useState(null);
  const [manualCenter, setManualCenter] = useState(null);
  const hasFittedInitialBoundsRef = useRef(false);

  // 4. WebSocket & Route Cache Refs
  const socketRef = useRef(null);
  const isUnmountedRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const lastRouteFetchRef = useRef({}); // { [bookingId]: { lat, lng, type, timestamp } }
  const routeAbortControllersRef = useRef({});

  /**
   * Helper: Normalize coordinates for a driver
   */
  const getDriverCoords = useCallback((driver) => {
    if (!driver) return null;
    const lat = driver.current_latitude ?? driver.currentLatitude ?? driver.latitude;
    const lng = driver.current_longitude ?? driver.currentLongitude ?? driver.longitude;
    if (isValidCoord(lat, lng)) {
      return { latitude: Number(lat), longitude: Number(lng) };
    }
    return null;
  }, []);

  /**
   * Helper: Normalize coordinates for a booking
   */
  const getBookingCoords = useCallback((booking) => {
    if (!booking) return null;
    const pLat = booking.pickup_latitude ?? booking.pickupLat ?? booking.pickupLatitude;
    const pLng = booking.pickup_longitude ?? booking.pickupLng ?? booking.pickupLongitude;
    const dLat = booking.destination_latitude ?? booking.destLat ?? booking.destinationLatitude;
    const dLng = booking.destination_longitude ?? booking.destLng ?? booking.destinationLongitude;

    const hasPickup = isValidCoord(pLat, pLng);
    const hasDest = isValidCoord(dLat, dLng);

    return {
      pickup: hasPickup ? { latitude: Number(pLat), longitude: Number(pLng) } : null,
      destination: hasDest ? { latitude: Number(dLat), longitude: Number(dLng) } : null
    };
  }, []);

  /**
   * Calculate bounding box containing all operational objects
   */
  const computeOperationalBounds = useCallback((currentDrivers, currentBookings) => {
    const coords = [];

    // Driver locations
    Object.values(currentDrivers).forEach(driver => {
      const dCoords = getDriverCoords(driver);
      if (dCoords) coords.push([dCoords.latitude, dCoords.longitude]);
    });

    // Booking locations
    Object.values(currentBookings).forEach(booking => {
      if (!ACTIVE_BOOKING_STATUSES.has(booking.status)) return;
      const bCoords = getBookingCoords(booking);
      if (bCoords?.pickup) coords.push([bCoords.pickup.latitude, bCoords.pickup.longitude]);
      if (bCoords?.destination) coords.push([bCoords.destination.latitude, bCoords.destination.longitude]);
    });

    if (coords.length === 0) return null;

    const lats = coords.map(c => c[0]);
    const lngs = coords.map(c => c[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    if (minLat === maxLat && minLng === maxLng) {
      return [
        [minLat - 0.015, minLng - 0.015],
        [maxLat + 0.015, maxLng + 0.015]
      ];
    }

    return [
      [minLat, minLng],
      [maxLat, maxLng]
    ];
  }, [getDriverCoords, getBookingCoords]);

  /**
   * Explicit Fit Action: Re-centers viewport to encompass all active operational entities
   */
  const handleFitActiveOperations = useCallback(() => {
    const newBounds = computeOperationalBounds(drivers, bookings);
    if (newBounds) {
      setMapBounds(newBounds);
    } else {
      setManualCenter([...DEFAULT_MAP_CENTER]);
    }
  }, [drivers, bookings, computeOperationalBounds]);

  /**
   * Fetch Route for an assigned or active trip booking
   */
  const fetchBookingRoute = useCallback(async (booking, driver) => {
    if (!booking || !driver) return;
    const status = String(booking.status).toUpperCase();

    // Section 5: ARRIVED: Do not continue recalculating driver -> pickup route
    if (status === 'ARRIVED') {
      setRoutes(prev => {
        if (!prev[booking.id]) return prev;
        const copy = { ...prev };
        delete copy[booking.id];
        return copy;
      });
      return;
    }

    // Terminal states: Remove operational route
    if (TERMINAL_STATUSES.has(status)) {
      setRoutes(prev => {
        if (!prev[booking.id]) return prev;
        const copy = { ...prev };
        delete copy[booking.id];
        return copy;
      });
      return;
    }

    const driverCoords = getDriverCoords(driver);
    const bookingCoords = getBookingCoords(booking);
    if (!driverCoords) return;

    let routeParams = null;
    let routeType = null;

    if (status === 'ASSIGNED' && bookingCoords?.pickup) {
      routeParams = {
        pickupLat: driverCoords.latitude,
        pickupLng: driverCoords.longitude,
        destLat: bookingCoords.pickup.latitude,
        destLng: bookingCoords.pickup.longitude
      };
      routeType = 'ASSIGNED_APPROACH';
    } else if (status === 'IN_PROGRESS' && bookingCoords?.destination) {
      routeParams = {
        pickupLat: driverCoords.latitude,
        pickupLng: driverCoords.longitude,
        destLat: bookingCoords.destination.latitude,
        destLng: bookingCoords.destination.longitude
      };
      routeType = 'TRIP_ACTIVE';
    }

    if (!routeParams) return;

    // Movement threshold check (~25 meters) to avoid unnecessary route refetches
    const lastFetch = lastRouteFetchRef.current[booking.id];
    if (lastFetch && lastFetch.type === routeType) {
      const movedMeters = getHaversineDistanceMeters(
        lastFetch.lat,
        lastFetch.lng,
        driverCoords.latitude,
        driverCoords.longitude
      );
      if (movedMeters < 25) {
        return;
      }
    }

    // Cancel existing in-flight request for this booking
    if (routeAbortControllersRef.current[booking.id]) {
      routeAbortControllersRef.current[booking.id].abort();
    }
    const controller = new AbortController();
    routeAbortControllersRef.current[booking.id] = controller;

    lastRouteFetchRef.current[booking.id] = {
      lat: driverCoords.latitude,
      lng: driverCoords.longitude,
      type: routeType,
      timestamp: Date.now()
    };

    try {
      const res = await apiClient.getLocationRoute(routeParams, { signal: controller.signal });
      if (res?.success && res?.data?.geometry) {
        setRoutes(prev => ({
          ...prev,
          [booking.id]: {
            geometry: res.data.geometry,
            distance: res.data.distance,
            duration: res.data.duration,
            type: routeType,
            driverId: driver.id
          }
        }));
      }
    } catch (err) {
      if (err.name !== 'AbortError' && !controller.signal.aborted) {
        console.warn(`[AdminMap] Route calculation failed for booking ${booking.id}:`, err.message);
      }
    }
  }, [getDriverCoords, getBookingCoords]);

  /**
   * Initial Data Load: Fetch Drivers and Bookings from Authoritative Backend
   */
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [driversRes, bookingsRes] = await Promise.all([
        apiClient.getAdminDrivers(),
        apiClient.getAdminBookings()
      ]);

      const driversList = driversRes?.data?.drivers || [];
      const bookingsList = bookingsRes?.data?.bookings || [];

      const driversObj = {};
      driversList.forEach(d => {
        if (d && d.id) driversObj[d.id] = d;
      });

      const bookingsObj = {};
      bookingsList.forEach(b => {
        if (b && b.id && ACTIVE_BOOKING_STATUSES.has(b.status)) {
          bookingsObj[b.id] = b;
        }
      });

      setDrivers(driversObj);
      setBookings(bookingsObj);

      // Perform initial viewport fit ONCE
      if (!hasFittedInitialBoundsRef.current) {
        const bounds = computeOperationalBounds(driversObj, bookingsObj);
        if (bounds) {
          setMapBounds(bounds);
        }
        hasFittedInitialBoundsRef.current = true;
      }

      // Initial route calculations for active bookings with assigned drivers
      Object.values(bookingsObj).forEach(booking => {
        if (booking.assigned_driver_id && driversObj[booking.assigned_driver_id]) {
          fetchBookingRoute(booking, driversObj[booking.assigned_driver_id]);
        }
      });

    } catch (err) {
      console.error('[AdminMap] Failed to load operational data:', err);
      setLoadError(err.message || 'Failed to load operational fleet data');
    } finally {
      setIsLoading(false);
    }
  }, [computeOperationalBounds, fetchBookingRoute]);

  // Execute initial load on mount
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  /**
   * Realtime Connection for Live Fleet Updates
   */
  useEffect(() => {
    isUnmountedRef.current = false;
    const token = apiClient.getToken();

    if (!token) {
      setRealtimeStatus('disconnected');
      return;
    }

    const connectWebSocket = () => {
      if (isUnmountedRef.current) return;

      const wsUrl = apiClient.getRealtimeUrl();
      setRealtimeStatus(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting');

      try {
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (isUnmountedRef.current || socketRef.current !== ws) return;
          reconnectAttemptRef.current = 0;
          setRealtimeStatus('connected');

          // Authenticate admin socket
          try {
            ws.send(JSON.stringify({
              type: 'authenticate',
              token
            }));
          } catch (e) {
            console.warn('[AdminMap] Auth send failed:', e);
          }
        };

        ws.onmessage = (event) => {
          if (isUnmountedRef.current || socketRef.current !== ws) return;

          let msg;
          try {
            msg = JSON.parse(event.data);
          } catch (e) {
            return;
          }

          if (!msg || typeof msg !== 'object') return;

          // 1. DRIVER LOCATION UPDATE (without remounting map or resetting viewport!)
          if (msg.type === 'driver.location.updated' || msg.type === 'driver.location.initial') {
            const { driverId, latitude, longitude, timestamp } = msg;
            if (!driverId || !isValidCoord(latitude, longitude)) return;

            setDrivers(prev => {
              const existing = prev[driverId];
              if (!existing) {
                // If new driver record appears
                return {
                  ...prev,
                  [driverId]: {
                    id: driverId,
                    name: `Driver #${driverId}`,
                    status: 'Active',
                    current_latitude: Number(latitude),
                    current_longitude: Number(longitude),
                    last_location_update: timestamp || new Date().toISOString()
                  }
                };
              }

              // Update coordinates in place
              const updated = {
                ...existing,
                current_latitude: Number(latitude),
                current_longitude: Number(longitude),
                last_location_update: timestamp || new Date().toISOString()
              };

              // Check if driver is assigned to any active booking and refresh route if applicable
              setBookings(currentBookings => {
                const assignedBooking = Object.values(currentBookings).find(
                  b => b.assigned_driver_id === driverId && ACTIVE_BOOKING_STATUSES.has(b.status)
                );
                if (assignedBooking) {
                  fetchBookingRoute(assignedBooking, updated);
                }
                return currentBookings;
              });

              return {
                ...prev,
                [driverId]: updated
              };
            });
          }

          // 2. BOOKING ASSIGNMENT & STATUS UPDATE
          if (msg.type === 'booking.assignment.updated') {
            const { bookingId, assignedDriverId, assignedDriverName, status } = msg;
            if (!bookingId) return;

            const normalizedStatus = status ? String(status).toUpperCase() : null;

            // Terminal status handling: Immediately cleanup booking & route from operational map
            if (normalizedStatus && TERMINAL_STATUSES.has(normalizedStatus)) {
              setBookings(prev => {
                if (!prev[bookingId]) return prev;
                const copy = { ...prev };
                delete copy[bookingId];
                return copy;
              });
              setRoutes(prev => {
                if (!prev[bookingId]) return prev;
                const copy = { ...prev };
                delete copy[bookingId];
                return copy;
              });
              delete lastRouteFetchRef.current[bookingId];
              return;
            }

            // Active status or assignment change
            setBookings(prev => {
              const existing = prev[bookingId];
              if (!existing && normalizedStatus && !ACTIVE_BOOKING_STATUSES.has(normalizedStatus)) {
                return prev;
              }

              const prevDriverId = existing?.assigned_driver_id;
              const nextDriverId = assignedDriverId !== undefined ? assignedDriverId : prevDriverId;

              // If driver was unassigned or changed: clear old route
              if (prevDriverId && prevDriverId !== nextDriverId) {
                setRoutes(rPrev => {
                  if (!rPrev[bookingId]) return rPrev;
                  const copy = { ...rPrev };
                  delete copy[bookingId];
                  return copy;
                });
                delete lastRouteFetchRef.current[bookingId];
              }

              const updatedBooking = {
                ...(existing || { id: bookingId }),
                assigned_driver_id: nextDriverId || null,
                assigned_driver_name: assignedDriverName || existing?.assigned_driver_name || null,
                status: normalizedStatus || existing?.status || 'CONFIRMED'
              };

              // Trigger route update if applicable
              if (nextDriverId) {
                setDrivers(currentDrivers => {
                  const driver = currentDrivers[nextDriverId];
                  if (driver) {
                    fetchBookingRoute(updatedBooking, driver);
                  }
                  return currentDrivers;
                });
              }

              return {
                ...prev,
                [bookingId]: updatedBooking
              };
            });
          }
        };

        ws.onerror = () => {
          if (isUnmountedRef.current) return;
          setRealtimeStatus('reconnecting');
        };

        ws.onclose = () => {
          if (isUnmountedRef.current) return;
          setRealtimeStatus('disconnected');

          // Auto-reconnect with exponential backoff
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptRef.current), 10000);
          reconnectAttemptRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
        };

      } catch (err) {
        setRealtimeStatus('disconnected');
      }
    };

    connectWebSocket();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      Object.values(routeAbortControllersRef.current).forEach(c => c.abort());
    };
  }, [fetchBookingRoute]);

  // ---------------------------------------------------------------------------
  // FILTERING LOGIC
  // ---------------------------------------------------------------------------

  // Drivers with valid coordinates
  const validDriversList = useMemo(() => {
    return Object.values(drivers).filter(driver => Boolean(getDriverCoords(driver)));
  }, [drivers, getDriverCoords]);

  // Bookings that are active
  const activeBookingsList = useMemo(() => {
    return Object.values(bookings).filter(booking => ACTIVE_BOOKING_STATUSES.has(booking.status));
  }, [bookings]);

  // Map of driverId -> assigned booking
  const driverAssignmentMap = useMemo(() => {
    const map = {};
    activeBookingsList.forEach(b => {
      if (b.assigned_driver_id) {
        map[b.assigned_driver_id] = b;
      }
    });
    return map;
  }, [activeBookingsList]);

  // Filtered driver markers to display on map
  const displayedDrivers = useMemo(() => {
    return validDriversList.filter(driver => {
      const isAssigned = Boolean(driverAssignmentMap[driver.id]);
      const isOnline = driver.status === 'Active';
      const assignedBooking = driverAssignmentMap[driver.id];
      const isInProgress = assignedBooking?.status === 'IN_PROGRESS';

      if (activeFilter === 'online') return isOnline;
      if (activeFilter === 'assigned') return isAssigned;
      if (activeFilter === 'active_trips') return isInProgress;
      if (activeFilter === 'unassigned') return !isAssigned;
      return true; // 'all'
    });
  }, [validDriversList, driverAssignmentMap, activeFilter]);

  // Filtered bookings to display on map
  const displayedBookings = useMemo(() => {
    return activeBookingsList.filter(booking => {
      const isAssigned = Boolean(booking.assigned_driver_id);
      const isInProgress = booking.status === 'IN_PROGRESS';

      if (activeFilter === 'online') {
        if (!booking.assigned_driver_id) return false;
        const driver = drivers[booking.assigned_driver_id];
        return driver && driver.status === 'Active';
      }
      if (activeFilter === 'assigned') return isAssigned;
      if (activeFilter === 'active_trips') return isInProgress;
      if (activeFilter === 'unassigned') return !isAssigned;
      return true; // 'all'
    });
  }, [activeBookingsList, drivers, activeFilter]);

  // Operational metrics for summary pills
  const metrics = useMemo(() => {
    const totalDrivers = validDriversList.length;
    const onlineDrivers = validDriversList.filter(d => d.status === 'Active').length;
    const assignedDrivers = Object.keys(driverAssignmentMap).length;
    const totalActiveBookings = activeBookingsList.length;
    const activeTrips = activeBookingsList.filter(b => b.status === 'IN_PROGRESS').length;
    const unassignedBookings = activeBookingsList.filter(b => !b.assigned_driver_id).length;

    return {
      totalDrivers,
      onlineDrivers,
      assignedDrivers,
      totalActiveBookings,
      activeTrips,
      unassignedBookings
    };
  }, [validDriversList, driverAssignmentMap, activeBookingsList]);

  return (
    <div className="space-y-4 animate-fade-in text-slate-100" data-testid="admin-operational-map">
      
      {/* --------------------------------------------------------------------- */}
      {/* 1. HEADER & METRICS BAR */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="bg-amber-400/10 text-amber-400 text-[11px] font-bold px-3 py-0.5 rounded-full border border-amber-400/20 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3 h-3 animate-pulse text-amber-400" />
              Live Fleet Dispatch
            </span>
            <div className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
              realtimeStatus === 'connected' 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : realtimeStatus === 'reconnecting'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                realtimeStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`} />
              <span className="capitalize">{realtimeStatus}</span>
            </div>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white font-['Outfit'] mt-1.5 flex items-center gap-2">
            Admin Operational Map
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Realtime visual monitoring for active drivers, live GPS coordinates, bookings, and active trip routes.
          </p>
        </div>

        {/* Viewport Control Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleFitActiveOperations}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 shadow-sm flex items-center gap-2 transition-all cursor-pointer hover:border-slate-600"
            title="Fit map viewport to include all active operations"
          >
            <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Fit Active Operations</span>
          </button>

          <button
            onClick={loadInitialData}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh operational data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-300 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. STAT PILLS & QUICK FILTERS */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <button
          onClick={() => setActiveFilter('all')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-amber-400/10 border-amber-400/40 text-amber-300 shadow-lg shadow-amber-400/10'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>All Fleet</span>
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-black mt-1 font-['Outfit'] text-white">
            {metrics.totalDrivers}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            {metrics.totalActiveBookings} active bookings
          </div>
        </button>

        <button
          onClick={() => setActiveFilter('online')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
            activeFilter === 'online'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-lg shadow-emerald-500/10'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Online</span>
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-black mt-1 font-['Outfit'] text-emerald-400">
            {metrics.onlineDrivers}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            Drivers on duty
          </div>
        </button>

        <button
          onClick={() => setActiveFilter('assigned')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
            activeFilter === 'assigned'
              ? 'bg-blue-500/10 border-blue-500/40 text-blue-300 shadow-lg shadow-blue-500/10'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Assigned</span>
            <UserCheck className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-black mt-1 font-['Outfit'] text-blue-400">
            {metrics.assignedDrivers}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            Dispatched drivers
          </div>
        </button>

        <button
          onClick={() => setActiveFilter('active_trips')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
            activeFilter === 'active_trips'
              ? 'bg-purple-500/10 border-purple-500/40 text-purple-300 shadow-lg shadow-purple-500/10'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Active Trips</span>
            <Navigation className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-black mt-1 font-['Outfit'] text-purple-400">
            {metrics.activeTrips}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            In progress on road
          </div>
        </button>

        <button
          onClick={() => setActiveFilter('unassigned')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            activeFilter === 'unassigned'
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 shadow-lg shadow-rose-500/10'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Unassigned</span>
            <Clock className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-black mt-1 font-['Outfit'] text-rose-400">
            {metrics.unassignedBookings}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            Needs driver match
          </div>
        </button>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 3. MAIN INTERACTIVE MAP CONTAINER */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Map Viewport Area (Takes 3 columns on large screens) */}
        <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative bg-slate-950 flex flex-col">
          
          <MapView
            center={manualCenter || DEFAULT_MAP_CENTER}
            zoom={DEFAULT_MAP_ZOOM}
            bounds={mapBounds}
            height="min(55vh, 620px)"
            loading={isLoading}
            error={loadError}
            ariaLabel="Admin live fleet operational map"
          >
            {/* Layer A: Active Driver Markers */}
            {displayedDrivers.map(driver => {
              const coords = getDriverCoords(driver);
              if (!coords) return null;

              const assignedBooking = driverAssignmentMap[driver.id];
              const isAssigned = Boolean(assignedBooking);
              const subtitle = isAssigned
                ? `Assigned: #${assignedBooking.id} (${assignedBooking.status})`
                : driver.status === 'Active'
                  ? 'Available • Online'
                  : 'Off Duty';

              return (
                <DriverLocationMarker
                  key={`driver-marker-${driver.id}`}
                  location={{
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    timestamp: driver.last_location_update
                  }}
                  label={driver.name || `Driver #${driver.id}`}
                  subtitle={subtitle}
                />
              );
            })}

            {/* Layer B: Active Booking Pickup & Destination Markers */}
            {displayedBookings.map(booking => {
              const coords = getBookingCoords(booking);
              if (!coords) return null;

              const markers = [];

              if (coords.pickup) {
                markers.push(
                  <PickupMarker
                    key={`pickup-${booking.id}`}
                    location={{
                      latitude: coords.pickup.latitude,
                      longitude: coords.pickup.longitude,
                      displayName: `${booking.pickup_location || 'Pickup'} • Status: ${booking.status}`
                    }}
                    label={`Booking #${booking.id} Pickup`}
                  />
                );
              }

              if (coords.destination) {
                markers.push(
                  <DestinationMarker
                    key={`dest-${booking.id}`}
                    location={{
                      latitude: coords.destination.latitude,
                      longitude: coords.destination.longitude,
                      displayName: `${booking.drop_location || 'Destination'} • Status: ${booking.status}`
                    }}
                    label={`Booking #${booking.id} Destination`}
                  />
                );
              }

              return markers;
            })}

            {/* Layer C: Driver Routes */}
            {/* Section 5: ASSIGNED: Driver -> Pickup; IN_PROGRESS: Driver -> Destination */}
            {Object.entries(routes).map(([bookingId, routeData]) => {
              if (!routeData?.geometry) return null;
              
              // Do not show route if booking is filtered out
              if (!displayedBookings.some(b => String(b.id) === String(bookingId))) {
                return null;
              }

              const isApproach = routeData.type === 'ASSIGNED_APPROACH';
              const routeColor = isApproach ? '#3b82f6' : '#10b981';

              return (
                <RoutePolyline
                  key={`route-${bookingId}-${routeData.type}`}
                  geometry={routeData.geometry}
                  color={routeColor}
                  weight={4}
                  opacity={0.85}
                  dashArray={isApproach ? '6, 8' : null}
                />
              );
            })}
          </MapView>

          {/* Map Overlay Badge: Visual Legend */}
          <div className="absolute bottom-3 left-3 z-[400] bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-2 sm:p-2.5 text-[10px] sm:text-[11px] shadow-lg pointer-events-none flex flex-wrap items-center gap-2 sm:gap-3 max-w-[calc(100%-1.5rem)]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />
              <span className="text-slate-300 font-medium">Driver</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
              <span className="text-slate-300 font-medium">Pickup</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" />
              <span className="text-slate-300 font-medium">Destination</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-blue-400" />
              <span className="text-slate-300 font-medium">Approach Route</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-emerald-400 rounded-full" />
              <span className="text-slate-300 font-medium">Trip Route</span>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* Sidebar: Operational Entities List & Quick Inspector */}
        {/* ------------------------------------------------------------------- */}
        <div className="lg:col-span-1 flex flex-col h-[380px] sm:h-[450px] lg:h-[620px] bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
          
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Active Operations ({displayedBookings.length})
              </span>
            </div>
          </div>

          {/* List of active items */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
            {displayedBookings.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                No active bookings matching current filter.
              </div>
            ) : (
              displayedBookings.map(b => {
                const isSelected = selectedEntity?.type === 'booking' && selectedEntity.id === b.id;
                const assignedDriver = b.assigned_driver_id ? drivers[b.assigned_driver_id] : null;

                return (
                  <div
                    key={`booking-card-${b.id}`}
                    onClick={() => {
                      setSelectedEntity({ type: 'booking', id: b.id });
                      const coords = getBookingCoords(b);
                      if (coords?.pickup) {
                        setManualCenter([coords.pickup.latitude, coords.pickup.longitude]);
                      }
                    }}
                    className={`p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-400/10 border-amber-400 text-white shadow-md'
                        : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-800/50 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-extrabold font-mono text-amber-400">
                        #{b.id}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        b.status === 'IN_PROGRESS' 
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : b.status === 'ARRIVED'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : b.status === 'ASSIGNED'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {b.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate">{b.pickup_location || 'Pickup not set'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                        <span className="truncate">{b.drop_location || 'Destination not set'}</span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Car className="w-3 h-3 text-blue-400" />
                        <span className="truncate">{assignedDriver?.name || b.assigned_driver_name || 'Unassigned'}</span>
                      </span>

                      {onSelectBooking && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectBooking(b);
                          }}
                          className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-0.5"
                        >
                          <span>Manage</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Active Drivers Count */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/80 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
            <span>Drivers online:</span>
            <span className="font-bold text-white font-mono">{displayedDrivers.length} mapped</span>
          </div>

        </div>

      </div>

    </div>
  );
}
