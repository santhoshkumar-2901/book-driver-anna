import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Calendar, Clock, MapPin, Phone, User, ShieldCheck, Check, Sparkles, AlertCircle, Navigation, Compass, ArrowRight, Users, Snowflake, Sun, Banknote, Smartphone, Lock, Star, Briefcase, Car, GraduationCap, CheckCircle2, Loader2, Crosshair } from 'lucide-react';
import { SteeringWheel } from './Icons';
import { BANGALORE_AREAS, BOOK_DRIVER_TRIP_TYPES, DRIVING_CLASSES } from '../data/mockData';
import DateInput from './DateInput';
import { toDDMMYYYY, toYYYYMMDD, getTodayDDMMYYYY } from '../utils/dateUtils';
import { useScrollLock } from '../utils/useScrollLock';
import { apiClient } from '../services/apiClient';
import { usePricing } from '../context/PricingContext';
import { generateClientBookingIdempotencyKey } from '../utils/idempotency.js';
import { MapView, LocationMarker, LocationSearch, PickupMarker, DestinationMarker, RoutePolyline, DriverLocationMarker, useCurrentLocation } from './map';

export { generateClientBookingIdempotencyKey };

export default function BookingModal({ isOpen, onClose, clientUser = null, initialType = 'driver', initialData = {}, onBookingComplete, onOpenEnrollmentModal, onRequireAuth }) {
  useScrollLock(isOpen);

  // Service Type: 'driver', 'vehicle', or 'class'
  const [bookingCategory, setBookingCategory] = useState(initialType === 'driving-class' ? 'class' : initialType);

  // Driving Class specific states
  const [selectedClassId, setSelectedClassId] = useState(initialData.selectedClassId || 'class-beginner');
  const [classTrainingCar, setClassTrainingCar] = useState(initialData.classTrainingCar || "Anna's Dual-Control Car");
  const [classTransmission, setClassTransmission] = useState(initialData.classTransmission || 'Manual');
  const [classTimeSlot, setClassTimeSlot] = useState(initialData.classTimeSlot || 'Morning (07:00 AM - 08:00 AM)');

  // Driver trip options: 'one-way', 'round-trip', 'outstation'
  const [driverTripOption, setDriverTripOption] = useState(initialData.driverTripOption || 'one-way');
  
  // Vehicle Category options: 'Sedan', 'SUV', '12 Seater', '24 Seater', '32 Seater'
  const [vehicleCategory, setVehicleCategory] = useState(initialData.vehicleCategory || 'Sedan');

  // Dynamic fields per trip option (Drop Location uses BANGALORE_AREAS dropdown)
  const [dropLocation, setDropLocation] = useState(initialData.dropLocation || 'Kempegowda Intl Airport (BLR T1/T2)');
  const [roundTripDuration, setRoundTripDuration] = useState(initialData.roundTripDuration || '4hr'); // 2hr, 4hr, 6hr, 12hr
  const [outstationTripType, setOutstationTripType] = useState(initialData.outstationTripType || 'round-trip'); // 'round-trip' | 'one-way'
  const [outstationPackage, setOutstationPackage] = useState(
    initialData.outstationPackage || (initialData.outstationTripType === 'one-way' ? 'One Way (Up to 300 km)' : 'Round trip 24hr')
  );
  const [outstationDestination, setOutstationDestination] = useState(initialData.outstationDestination || 'Coorg (Madikeri)');

  // Passenger Count, Luggage Count & AC / Non-AC Preference
  const [passengerCount, setPassengerCount] = useState(''); // Empty initially so placeholder is shown
  const [luggageCount, setLuggageCount] = useState(''); // Empty initially so placeholder is shown
  const [acPreference, setAcPreference] = useState('AC'); // 'AC' or 'Non-AC'

  // Location & date/time
  const [pickupArea, setPickupArea] = useState(initialData.pickupArea || 'Indiranagar');
  const [streetAddress, setStreetAddress] = useState('');
  const [bookingDate, setBookingDate] = useState(getTodayDDMMYYYY());
  const [bookingTime, setBookingTime] = useState('09:00');
  
  // Customer Details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash', 'upi'

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const idempotencyKeyRef = useRef(null);

  // Customer Browser Geolocation (Phase 3 Foundation)
  const {
    location: customerLocation,
    loading: locationLoading,
    error: locationError,
    requestLocation,
    clearLocation
  } = useCurrentLocation();

  // Distinct Frontend Booking Location States (Phase 5)
  const [pickupLocation, setPickupLocation] = useState(null);
  const [destinationLocation, setDestinationLocation] = useState(null);
  const [isEditingPickup, setIsEditingPickup] = useState(false);
  const [isEditingDestination, setIsEditingDestination] = useState(false);

  // OSRM Routing State (Phase 6 - Informational Road Route)
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const routeAbortRef = useRef(null);

  // Authoritative Fare Estimate State (Phase 7 - Pricing Integration)
  const [fareEstimate, setFareEstimate] = useState(null);
  const [fareLoading, setFareLoading] = useState(false);
  const [fareError, setFareError] = useState(null);
  const fareAbortRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      clearLocation();
      setPickupLocation(null);
      setDestinationLocation(null);
      setIsEditingPickup(false);
      setIsEditingDestination(false);
      setRouteData(null);
      setRouteLoading(false);
      setRouteError(null);
      if (routeAbortRef.current) routeAbortRef.current.abort();
      setFareEstimate(null);
      setFareLoading(false);
      setFareError(null);
      if (fareAbortRef.current) fareAbortRef.current.abort();
    }
  }, [isOpen, clearLocation]);

  const handleSelectPickup = (item) => {
    setPickupLocation(item);
    setIsEditingPickup(false);
    if (item?.displayName) {
      setPickupArea(item.displayName.split(',')[0].trim());
    }
  };

  const handleClearPickup = () => {
    setPickupLocation(null);
    setIsEditingPickup(false);
    setRouteData(null);
    setRouteLoading(false);
    setRouteError(null);
    if (routeAbortRef.current) routeAbortRef.current.abort();
    setFareEstimate(null);
    setFareLoading(false);
    setFareError(null);
    if (fareAbortRef.current) fareAbortRef.current.abort();
  };

  const handleSelectDestination = (item) => {
    setDestinationLocation(item);
    setIsEditingDestination(false);
    if (item?.displayName) {
      setDropLocation(item.displayName.split(',')[0].trim());
    }
  };

  const handleClearDestination = () => {
    setDestinationLocation(null);
    setIsEditingDestination(false);
    setRouteData(null);
    setRouteLoading(false);
    setRouteError(null);
    if (routeAbortRef.current) routeAbortRef.current.abort();
    setFareEstimate(null);
    setFareLoading(false);
    setFareError(null);
    if (fareAbortRef.current) fareAbortRef.current.abort();
  };

  const handleUseCurrentLocationForPickup = () => {
    if (customerLocation) {
      setPickupLocation({
        id: 'gps-current-location',
        displayName: 'Current Location (GPS)',
        latitude: customerLocation.latitude,
        longitude: customerLocation.longitude,
        type: 'current_location'
      });
      setIsEditingPickup(false);
    } else {
      requestLocation();
    }
  };

  // Sync GPS to pickup if user requested location while setting pickup
  useEffect(() => {
    if (customerLocation && !pickupLocation && locationLoading === false) {
      // If customer location arrives and no pickup is set yet, leave as optional or ready
    }
  }, [customerLocation, pickupLocation, locationLoading]);

  // Phase 6: OSRM Routing between pickup and destination
  useEffect(() => {
    // 1. If either pickup or destination is missing or invalid, clear route
    if (
      !pickupLocation || typeof pickupLocation.latitude !== 'number' || typeof pickupLocation.longitude !== 'number' ||
      !destinationLocation || typeof destinationLocation.latitude !== 'number' || typeof destinationLocation.longitude !== 'number'
    ) {
      if (routeAbortRef.current) routeAbortRef.current.abort();
      setRouteData(null);
      setRouteLoading(false);
      setRouteError(null);
      return;
    }

    // 2. Abort any previous in-flight route request to prevent race conditions
    if (routeAbortRef.current) {
      routeAbortRef.current.abort();
    }
    const controller = new AbortController();
    routeAbortRef.current = controller;

    setRouteLoading(true);
    setRouteError(null);

    apiClient.getLocationRoute(
      {
        pickupLat: pickupLocation.latitude,
        pickupLng: pickupLocation.longitude,
        destLat: destinationLocation.latitude,
        destLng: destinationLocation.longitude
      },
      { signal: controller.signal }
    )
      .then((res) => {
        if (routeAbortRef.current === controller) {
          if (res && res.success && res.data) {
            setRouteData(res.data);
            setRouteError(null);
          } else {
            setRouteData(null);
            setRouteError('Unable to calculate road route.');
          }
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (routeAbortRef.current === controller) {
          setRouteData(null);
          setRouteError(err.message || 'Unable to calculate road route.');
        }
      })
      .finally(() => {
        if (routeAbortRef.current === controller) {
          setRouteLoading(false);
        }
      });

    const cleanupRouteEffect = () => {
      controller.abort();
    };
    return cleanupRouteEffect;
  }, [pickupLocation, destinationLocation]);

  // Phase 7: Authoritative Backend Fare Estimation based on Route & Service
  useEffect(() => {
    if (
      !routeData ||
      !pickupLocation || typeof pickupLocation.latitude !== 'number' || typeof pickupLocation.longitude !== 'number' ||
      !destinationLocation || typeof destinationLocation.latitude !== 'number' || typeof destinationLocation.longitude !== 'number'
    ) {
      if (fareAbortRef.current) fareAbortRef.current.abort();
      setFareEstimate(null);
      setFareLoading(false);
      setFareError(null);
      return;
    }

    if (fareAbortRef.current) {
      fareAbortRef.current.abort();
    }
    const controller = new AbortController();
    fareAbortRef.current = controller;

    setFareLoading(true);
    setFareError(null);

    apiClient.getBookingEstimate({
      pickupLat: pickupLocation.latitude,
      pickupLng: pickupLocation.longitude,
      destLat: destinationLocation.latitude,
      destLng: destinationLocation.longitude,
      bookingCategory,
      driverTripOption,
      vehicleCategory,
      selectedClassId,
      dropLocation: destinationLocation.displayName || dropLocation,
      pickupArea: pickupLocation.displayName || pickupArea
    }, { signal: controller.signal })
      .then((res) => {
        if (fareAbortRef.current === controller) {
          if (res?.success && res?.data) {
            setFareEstimate(res.data);
            setFareError(null);
          } else {
            setFareEstimate(null);
            setFareError('Unable to calculate fare estimate.');
          }
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (fareAbortRef.current === controller) {
          setFareEstimate(null);
          setFareError(err.message || 'Unable to calculate fare estimate.');
        }
      })
      .finally(() => {
        if (fareAbortRef.current === controller) {
          setFareLoading(false);
        }
      });

    const cleanupFareEffect = () => {
      controller.abort();
    };
    return cleanupFareEffect;
  }, [routeData, bookingCategory, driverTripOption, vehicleCategory, selectedClassId]);

  // Map Bounds calculation considering full route geometry or pickup/destination points
  const mapBounds = useMemo(() => {
    if (routeData?.geometry?.coordinates && Array.isArray(routeData.geometry.coordinates) && routeData.geometry.coordinates.length >= 2) {
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      for (const [lng, lat] of routeData.geometry.coordinates) {
        if (!isNaN(lat) && !isNaN(lng)) {
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
        }
      }
      if (minLat !== Infinity && maxLat !== -Infinity && minLng !== Infinity && maxLng !== -Infinity) {
        return [[minLat, minLng], [maxLat, maxLng]];
      }
    }

    if (
      pickupLocation && typeof pickupLocation.latitude === 'number' && typeof pickupLocation.longitude === 'number' &&
      destinationLocation && typeof destinationLocation.latitude === 'number' && typeof destinationLocation.longitude === 'number'
    ) {
      return [
        [pickupLocation.latitude, pickupLocation.longitude],
        [destinationLocation.latitude, destinationLocation.longitude]
      ];
    }
    return null;
  }, [routeData, pickupLocation, destinationLocation]);

  // Center on single location when bounds is null
  const mapCenter = useMemo(() => {
    if (mapBounds) return undefined;
    if (pickupLocation?.latitude && pickupLocation?.longitude) {
      return [pickupLocation.latitude, pickupLocation.longitude];
    }
    if (destinationLocation?.latitude && destinationLocation?.longitude) {
      return [destinationLocation.latitude, destinationLocation.longitude];
    }
    if (customerLocation?.latitude && customerLocation?.longitude) {
      return [customerLocation.latitude, customerLocation.longitude];
    }
    return undefined;
  }, [mapBounds, pickupLocation, destinationLocation, customerLocation]);

  const mapZoom = (mapBounds || pickupLocation || destinationLocation || customerLocation) ? 14 : undefined;

  useEffect(() => {
    if (initialType) {
      if (initialType === 'driving-class' || initialType === 'class') {
        setBookingCategory('class');
      } else {
        setBookingCategory(initialType);
      }
    }
    if (initialData.selectedClassId) setSelectedClassId(initialData.selectedClassId);
    if (initialData.classTrainingCar) setClassTrainingCar(initialData.classTrainingCar);
    if (initialData.classTransmission) setClassTransmission(initialData.classTransmission);
    if (initialData.classTimeSlot) setClassTimeSlot(initialData.classTimeSlot);
    if (initialData.driverTripOption) setDriverTripOption(initialData.driverTripOption);
    if (initialData.vehicleCategory) setVehicleCategory(initialData.vehicleCategory);
    if (initialData.pickupArea) setPickupArea(initialData.pickupArea);
    if (initialData.dropLocation) setDropLocation(initialData.dropLocation);
    if (initialData.roundTripDuration) setRoundTripDuration(initialData.roundTripDuration);
    else if (initialData.driverDuration) setRoundTripDuration(`${initialData.driverDuration}hr`);
    if (initialData.outstationTripType) setOutstationTripType(initialData.outstationTripType);
    if (initialData.outstationPackage) setOutstationPackage(initialData.outstationPackage);
    if (initialData.outstationDestination) setOutstationDestination(initialData.outstationDestination);
  }, [initialType, initialData, isOpen]);

  const resetForm = () => {
    idempotencyKeyRef.current = null;
    setCustomerName(clientUser?.name || '');
    setCustomerPhone(clientUser?.phone || '');
    setCustomerEmail(clientUser?.email || '');
    setPassengerCount('');
    setLuggageCount('');
    setStreetAddress('');
    setSpecialInstructions('');
    setFormError('');
    setIsSubmitting(false);
  };

  const { getPrice, formatPrice, refreshPricing } = usePricing();

  useEffect(() => {
    if (isOpen) {
      resetForm();
      idempotencyKeyRef.current = generateClientBookingIdempotencyKey();
      if (typeof refreshPricing === 'function') {
        refreshPricing();
      }
    } else {
      idempotencyKeyRef.current = null;
    }
  }, [isOpen, clientUser]);

  if (!isOpen) return null;

  // Dynamic fare calculation using live pricing tariffs
  const calculateTotalFare = () => {
    let base = 299;

    if (bookingCategory === 'class') {
      if (selectedClassId === 'class-beginner') base = getPrice('class_beginner', 5999);
      else if (selectedClassId === 'class-refresher') base = getPrice('class_refresher', 3499);
      else if (selectedClassId === 'class-own-car') base = getPrice('class_own_car', 2999);
      else if (selectedClassId === 'class-automatic') base = getPrice('class_automatic', 3999);
      else {
        const classKeyMap = {
          'class-beginner': 'class_beginner',
          'class-refresher': 'class_refresher',
          'class-own-car': 'class_own_car',
          'class-automatic': 'class_automatic'
        };
        const cls = DRIVING_CLASSES.find(c => c.id === selectedClassId) || DRIVING_CLASSES[0];
        base = getPrice(classKeyMap[cls.id] || 'class_beginner', cls.basePrice || 5999);
      }
      return { base, gst: 0, total: base };
    } else if (bookingCategory === 'vehicle') {
      if (vehicleCategory === 'Sedan') base = getPrice('vehicle_sedan_daily', 1999);
      else if (vehicleCategory === 'SUV') base = getPrice('vehicle_suv_daily', 3499);
      else if (vehicleCategory === '12 Seater') base = getPrice('vehicle_tempo_12_daily', 5499);
      else if (vehicleCategory === '24 Seater') base = getPrice('vehicle_bus_24_daily', 7999);
      else if (vehicleCategory === '32 Seater') base = getPrice('vehicle_coach_32_daily', 10999);
      else base = 1999;
    } else {
      if (driverTripOption === 'one-way') {
        base = (dropLocation && dropLocation.toLowerCase().includes('airport')) 
          ? getPrice('driver_airport_drop', 899) 
          : getPrice('driver_one_way_city', 299);
      } else if (driverTripOption === 'round-trip') {
        if (roundTripDuration.includes('2hr')) base = getPrice('driver_hourly_2hr', 199);
        else if (roundTripDuration.includes('4hr')) base = getPrice('driver_hourly_4hr', 349);
        else if (roundTripDuration.includes('6hr')) base = getPrice('driver_hourly_6hr', 499);
        else if (roundTripDuration.includes('8hr')) base = getPrice('driver_hourly_8hr', 599);
        else if (roundTripDuration.includes('12hr')) base = getPrice('driver_hourly_12hr', 899);
        else base = getPrice('driver_hourly_4hr', 349);
      } else {
        // Outstation Driver pricing
        if (outstationTripType === 'one-way') {
          if (outstationPackage.includes('150 km')) base = getPrice('driver_outstation_150km', 1199);
          else if (outstationPackage.includes('300 km')) base = getPrice('driver_outstation_300km', 1799);
          else if (outstationPackage.includes('500 km')) base = getPrice('driver_outstation_500km', 2399);
          else base = getPrice('driver_outstation_150km', 1499);
        } else {
          // Round Trip
          if (outstationPackage.includes('12hr')) base = getPrice('driver_outstation_12hr', 1199);
          else if (outstationPackage.includes('24hr')) base = getPrice('driver_outstation_24hr', 1999);
          else if (outstationPackage.includes('46hr')) base = getPrice('driver_outstation_46hr', 3899);
          else if (outstationPackage.includes('72hr')) base = getPrice('driver_outstation_72hr', 5799);
          else base = getPrice('driver_outstation_24hr', 1999);
        }
      }
    }
    const gst = Math.round(base * 0.05);
    return { base, gst, total: base + gst };
  };

  const fareInfo = calculateTotalFare();
  const effectiveBase = (fareEstimate && routeData && typeof fareEstimate.basePrice === 'number')
    ? fareEstimate.basePrice
    : fareInfo.base;
  const effectiveGst = (fareEstimate && routeData && typeof fareEstimate.gst === 'number')
    ? fareEstimate.gst
    : fareInfo.gst;
  const effectiveTotalFare = (fareEstimate && routeData && typeof fareEstimate.totalFare === 'number')
    ? fareEstimate.totalFare
    : fareInfo.total;

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    setFormError('');

    if (bookingCategory === 'vehicle' && (!passengerCount || parseInt(passengerCount) < 1)) {
      setFormError('Please enter the number of passengers traveling');
      return;
    }
    if (!customerName.trim()) {
      setFormError('Please enter your full customer name');
      return;
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 10) {
      setFormError('Please enter a valid 10-digit mobile number for SMS/WhatsApp updates');
      return;
    }

    const payloadForApi = {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail ? customerEmail.trim() : null,
      bookingCategory,
      selectedClassId,
      vehicleCategory,
      driverTripOption,
      dropLocation,
      roundTripDuration,
      outstationTripType,
      outstationPackage,
      outstationDestination,
      pickupArea,
      pickupLat: pickupLocation?.latitude,
      pickupLng: pickupLocation?.longitude,
      destLat: destinationLocation?.latitude,
      destLng: destinationLocation?.longitude,
      date: toYYYYMMDD(bookingDate),
      time: bookingTime,
      paymentMode
    };

    let tripSummary = '';
    let serviceName = '';

    if (bookingCategory === 'class') {
      const cls = DRIVING_CLASSES.find(c => c.id === selectedClassId) || DRIVING_CLASSES[0];
      serviceName = `Driving Class: ${cls.name}`;
      tripSummary = `${cls.name} (${cls.duration}) • ${classTrainingCar} (${classTransmission}) • Slot: ${classTimeSlot} • Area: ${pickupArea}`;
    } else if (bookingCategory === 'vehicle') {
      serviceName = `Book a Vehicle (${vehicleCategory})`;
      tripSummary = `Vehicle Rental: ${vehicleCategory} (Pickup: ${pickupArea} to Drop: ${dropLocation})`;
    } else {
      if (driverTripOption === 'one-way') {
        serviceName = 'One Way Trip Driver';
        tripSummary = `One Way Trip (Pickup: ${pickupArea} to Drop: ${dropLocation})`;
      } else if (driverTripOption === 'round-trip') {
        serviceName = 'Round Trip Driver';
        tripSummary = `Round Trip (${roundTripDuration} Package in ${pickupArea})`;
      } else {
        const tripKind = outstationTripType === 'one-way' ? 'One Way Drop' : 'Round Trip';
        serviceName = `Outstation Driver (${tripKind})`;
        tripSummary = `Outstation ${tripKind} (${outstationPackage} to ${outstationDestination})`;
      }
    }

    const bookingDetails = {
      bookingId: null,
      bookingType: bookingCategory,
      driverTripOption: bookingCategory === 'driver' ? driverTripOption : undefined,
      vehicleCategory: bookingCategory === 'vehicle' ? vehicleCategory : undefined,
      selectedClassId: bookingCategory === 'class' ? selectedClassId : undefined,
      classCourseName: bookingCategory === 'class' ? (DRIVING_CLASSES.find(c => c.id === selectedClassId)?.name || 'Beginner Course') : undefined,
      classDuration: bookingCategory === 'class' ? (DRIVING_CLASSES.find(c => c.id === selectedClassId)?.duration || '15 Days') : undefined,
      classTrainingCar: bookingCategory === 'class' ? classTrainingCar : undefined,
      classTransmission: bookingCategory === 'class' ? classTransmission : undefined,
      classTimeSlot: bookingCategory === 'class' ? classTimeSlot : undefined,
      serviceName,
      category: bookingCategory === 'class' ? 'Driving Class' : (bookingCategory === 'vehicle' ? 'Book a Vehicle' : 'Book a Driver'),
      tripSummary,
      pickupArea,
      dropLocation: bookingCategory === 'class' ? `Doorstep Training in ${pickupArea}` : dropLocation,
      roundTripDuration: bookingCategory === 'driver' && driverTripOption === 'round-trip' ? roundTripDuration : undefined,
      outstationTripType: bookingCategory === 'driver' && driverTripOption === 'outstation' ? outstationTripType : undefined,
      outstationPackage: bookingCategory === 'driver' && driverTripOption === 'outstation' ? outstationPackage : undefined,
      outstationDestination: bookingCategory === 'driver' && driverTripOption === 'outstation' ? outstationDestination : undefined,
      tripTitle: tripSummary,
      passengers: bookingCategory === 'vehicle' && passengerCount ? `${passengerCount} Passenger${parseInt(passengerCount) > 1 ? 's' : ''}` : undefined,
      luggage: bookingCategory === 'vehicle' && luggageCount ? `${luggageCount} Bag${parseInt(luggageCount) > 1 ? 's' : ''}` : undefined,
      acPreference: bookingCategory === 'vehicle' ? acPreference : undefined,
      streetAddress: streetAddress || `${pickupArea}, Bengaluru`,
      bookingDate: toDDMMYYYY(bookingDate),
      date: toDDMMYYYY(bookingDate),
      bookingTime,
      customerName,
      customerPhone,
      customerEmail,
      userId: clientUser?.id || null,
      paymentMode,
      totalFare: effectiveTotalFare,
      rawPayload: payloadForApi,
      assignedAnna: null
    };

    // Generate idempotency key if not already assigned for this submission attempt
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = generateClientBookingIdempotencyKey();
    }
    const currentIdempotencyKey = idempotencyKeyRef.current;
    bookingDetails.idempotencyKey = currentIdempotencyKey;
    payloadForApi.idempotencyKey = currentIdempotencyKey;

    // If client is not logged in, do NOT create server booking yet. Intercept and prompt login/signup!
    if (!clientUser && onRequireAuth) {
      onRequireAuth(bookingDetails);
      setIsSubmitting(false);
      onClose();
      return;
    }

    // Client IS logged in: call backend API for authoritative booking creation and slot locking
    setIsSubmitting(true);
    setFormError('');
    try {
      const serverRes = await apiClient.createBooking(payloadForApi);
      if (!serverRes?.data?.booking) {
        throw new Error('Booking could not be confirmed by the server.');
      }

      const serverBooking = serverRes.data.booking;
      bookingDetails.bookingId = serverBooking.id;
      bookingDetails.id = serverBooking.id;
      bookingDetails.totalFare = serverBooking.calculated_fare;
      bookingDetails.status = serverBooking.status || 'CONFIRMED';
      if (serverBooking.assigned_driver_name) {
        bookingDetails.assignedAnna = serverBooking.assigned_driver_name;
      }

      onBookingComplete(bookingDetails);
      resetForm();
      onClose();
    } catch (apiErr) {
      console.error('[BOOKING] API creation failed:', apiErr);
      setFormError(apiErr.message || 'Failed to create booking. Please try again.');
      // Keep idempotencyKeyRef.current unchanged so user retrying will submit with the EXACT same idempotency key
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-xl z-10 animate-in zoom-in-95 duration-150 my-auto flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        
        {/* Header bar */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-5 py-3.5 sm:py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-800 border border-slate-700 text-amber-500 flex items-center justify-center shrink-0">
              {bookingCategory === 'class' ? <GraduationCap className="w-5 h-5" /> : (bookingCategory === 'vehicle' ? <Car className="w-5 h-5" /> : <SteeringWheel className="w-5 h-5" />)}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm sm:text-lg font-['Outfit'] leading-tight truncate">
                {bookingCategory === 'class' ? 'Driving Class Enrollment' : (bookingCategory === 'vehicle' ? 'Vehicle Fleet Reservation' : 'Book Personal Driver Anna')}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                Direct dispatch service across Bengaluru Urban
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer shrink-0 ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
            aria-label="Close booking modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmitBooking} className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar flex-1">
          
          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* =========================================================================
              SERVICE 1: DRIVER TRIP OPTIONS (One Way, Round Trip, Outstation)
             ========================================================================= */}
          {bookingCategory === 'driver' && (
            <div>
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Select Driver Trip Option
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                {/* One Way */}
                <button
                  type="button"
                  onClick={() => setDriverTripOption('one-way')}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    driverTripOption === 'one-way'
                      ? 'bg-amber-400/10 border-amber-400 text-white shadow-lg'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white">One Way Trip</span>
                    <Navigation className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-[11px] text-slate-400">Pickup & Drop Location</p>
                </button>

                {/* Round Trip */}
                <button
                  type="button"
                  onClick={() => setDriverTripOption('round-trip')}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    driverTripOption === 'round-trip'
                      ? 'bg-amber-400/10 border-amber-400 text-white shadow-lg'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white">Round Trip</span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-[11px] text-slate-400">2hr, 4hr, 6hr, 12hr</p>
                </button>

                {/* Outstation */}
                <button
                  type="button"
                  onClick={() => setDriverTripOption('outstation')}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    driverTripOption === 'outstation'
                      ? 'bg-amber-400/10 border-amber-400 text-white shadow-lg'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white">Outstation</span>
                    <Compass className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-[11px] text-slate-400">12hr, 24hr, 46hr, 72hr</p>
                </button>

              </div>
            </div>
          )}

          {/* =========================================================================
              SERVICE 2: VEHICLE CATEGORY OPTIONS (Sedan, SUV, 12 Seater, 24 Seater, 32 Seater)
             ========================================================================= */}
          {bookingCategory === 'vehicle' && (
            <div>
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5" /> Select Vehicle Option (Sedan, SUV, 12, 24, 32 Seater)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {[
                  { id: 'Sedan', label: 'Sedan', cap: '4 Seater', priceKey: 'vehicle_sedan_daily', fallback: 1999 },
                  { id: 'SUV', label: 'SUV', cap: '6-7 Seater', priceKey: 'vehicle_suv_daily', fallback: 3499 },
                  { id: '12 Seater', label: '12 Seater', cap: 'Traveller', priceKey: 'vehicle_tempo_12_daily', fallback: 5499 },
                  { id: '24 Seater', label: '24 Seater', cap: 'Mini Bus', priceKey: 'vehicle_bus_24_daily', fallback: 7999 },
                  { id: '32 Seater', label: '32 Seater', cap: 'Coach Bus', priceKey: 'vehicle_coach_32_daily', fallback: 10999 }
                ].map((v) => {
                  const isSelected = vehicleCategory === v.id;
                  const displayPrice = formatPrice(v.priceKey, v.fallback);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVehicleCategory(v.id)}
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 border-amber-400 font-extrabold shadow-lg scale-[1.02]'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-extrabold text-xs">{v.label}</div>
                      <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>{v.cap}</div>
                      {/* Clean price text without any box/border background */}
                      <div className={`text-[11px] font-black mt-0.5 ${isSelected ? 'text-slate-950' : 'text-amber-400'}`}>
                        {displayPrice}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* DYNAMIC LOCATION FIELDS FOR DRIVER OPTIONS */}
          {bookingCategory === 'driver' && driverTripOption === 'one-way' && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4 animate-in fade-in duration-200">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-amber-400" /> One Way Locations
                </span>
                {/* Current Location Quick Action */}
                <button
                  type="button"
                  onClick={handleUseCurrentLocationForPickup}
                  disabled={locationLoading}
                  aria-label="Use current location for pickup"
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors py-1 px-2 rounded-lg hover:bg-amber-400/10 min-h-[36px] touch-manipulation"
                >
                  {locationLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Crosshair className="w-3.5 h-3.5" />
                  )}
                  <span>Use current location as pickup</span>
                </button>
              </div>

              {/* Geolocation Error Alert Banner if any */}
              {locationError && (
                <div
                  role="alert"
                  className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 flex items-start justify-between gap-2"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{locationError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={requestLocation}
                    className="px-2 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 text-[11px] font-semibold rounded-md shrink-0 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Pickup & Destination Independent Controls */}
              <div className="space-y-3">
                {/* 1. Pickup Location */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-400" /> Pickup Location *
                    </label>
                    {pickupLocation && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingPickup(!isEditingPickup)}
                          className="text-[11px] font-medium text-slate-400 hover:text-white"
                        >
                          {isEditingPickup ? 'Cancel' : 'Change'}
                        </button>
                        <span className="text-slate-700">•</span>
                        <button
                          type="button"
                          onClick={handleClearPickup}
                          className="text-[11px] font-medium text-red-400 hover:text-red-300"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {pickupLocation && !isEditingPickup ? (
                    <div className="p-2.5 bg-slate-900 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                      <div className="min-w-0 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
                        <p className="text-xs text-slate-100 font-medium truncate">
                          {pickupLocation.displayName}
                        </p>
                      </div>
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0 font-medium">
                        Selected
                      </span>
                    </div>
                  ) : (
                    <LocationSearch
                      id="pickup-location-search"
                      placeholder="Search pickup area, street, or landmark..."
                      onSelect={handleSelectPickup}
                    />
                  )}
                </div>

                {/* 2. Destination Location */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-rose-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-rose-400" /> Destination Location *
                    </label>
                    {destinationLocation && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingDestination(!isEditingDestination)}
                          className="text-[11px] font-medium text-slate-400 hover:text-white"
                        >
                          {isEditingDestination ? 'Cancel' : 'Change'}
                        </button>
                        <span className="text-slate-700">•</span>
                        <button
                          type="button"
                          onClick={handleClearDestination}
                          className="text-[11px] font-medium text-red-400 hover:text-red-300"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {destinationLocation && !isEditingDestination ? (
                    <div className="p-2.5 bg-slate-900 border border-rose-500/30 rounded-xl flex items-center justify-between">
                      <div className="min-w-0 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-400 shrink-0"></div>
                        <p className="text-xs text-slate-100 font-medium truncate">
                          {destinationLocation.displayName}
                        </p>
                      </div>
                      <span className="text-[10px] text-rose-400 bg-rose-950/60 border border-rose-500/30 px-2 py-0.5 rounded-full shrink-0 font-medium">
                        Selected
                      </span>
                    </div>
                  ) : (
                    <LocationSearch
                      id="destination-location-search"
                      placeholder="Search destination area, street, or landmark..."
                      onSelect={handleSelectDestination}
                    />
                  )}
                </div>
              </div>

              {/* OSRM Route & Authoritative Fare Status & Metrics (Phase 7 Integration) */}
              {routeLoading && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-xs text-amber-300">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                  <span>Calculating road route...</span>
                </div>
              )}

              {fareLoading && !routeLoading && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-xs text-amber-300">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                  <span>Calculating authoritative fare...</span>
                </div>
              )}

              {routeError && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-xs text-amber-300">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{routeError}</span>
                </div>
              )}

              {fareError && !routeError && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-xs text-amber-300">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{fareError}</span>
                </div>
              )}

              {routeData && !routeLoading && (
                <div className="p-2.5 bg-slate-900 border border-slate-700/80 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-200">
                    <span className="font-bold text-amber-400">Road Route:</span>
                    <span>{routeData.distanceKm} km</span>
                    <span className="text-slate-600">•</span>
                    <span>~{routeData.durationMinutes} min</span>
                    {fareEstimate && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="font-bold text-emerald-400">
                          Estimated Fare: ₹{fareEstimate.totalFare}
                        </span>
                      </>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {fareLoading ? 'Calculating fare...' : 'Authoritative Tariff'}
                  </span>
                </div>
              )}

              {/* Interactive Route Map Preview */}
              <div className="pt-1">
                <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    <span>Trip Locations & Route Map</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">OpenStreetMap</span>
                </div>

                <MapView
                  bounds={mapBounds}
                  center={mapCenter}
                  zoom={mapZoom}
                  height="220px"
                  className="border-slate-800"
                >
                  {customerLocation && <LocationMarker location={customerLocation} />}
                  {pickupLocation && <PickupMarker location={pickupLocation} />}
                  {destinationLocation && <DestinationMarker location={destinationLocation} />}
                  {routeData?.geometry && <RoutePolyline geometry={routeData.geometry} />}
                  {initialData?.driverLocation && (
                    <DriverLocationMarker
                      location={initialData.driverLocation}
                      label={initialData?.assignedDriverName || 'Assigned Driver'}
                    />
                  )}
                </MapView>
              </div>
            </div>
          )}

          {bookingCategory === 'driver' && driverTripOption === 'round-trip' && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4 animate-in fade-in duration-200">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> Round Trip Duration (2hr, 4hr, 6hr, 12hr)
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: '2hr', label: '2hr', priceKey: 'driver_hourly_2hr', fallback: 199 },
                  { id: '4hr', label: '4hr', priceKey: 'driver_hourly_4hr', fallback: 349 },
                  { id: '6hr', label: '6hr', priceKey: 'driver_hourly_6hr', fallback: 499 },
                  { id: '12hr', label: '12hr', priceKey: 'driver_hourly_12hr', fallback: 899 }
                ].map((dur) => {
                  const isSelected = roundTripDuration === dur.id;
                  const displayPrice = formatPrice(dur.priceKey, dur.fallback);
                  return (
                    <button
                      key={dur.id}
                      type="button"
                      onClick={() => setRoundTripDuration(dur.id)}
                      className={`py-3 px-2 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 border-amber-400 font-extrabold shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{dur.label}</div>
                      <div className={`text-[10px] font-black mt-0.5 ${isSelected ? 'text-slate-950' : 'text-amber-400'}`}>{displayPrice}</div>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-400" /> Pickup Location in Bangalore *
                </label>
                <select
                  value={pickupArea}
                  onChange={(e) => setPickupArea(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  {BANGALORE_AREAS.map((a, i) => (
                    <option key={i} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {bookingCategory === 'driver' && driverTripOption === 'outstation' && (
            <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4 animate-in fade-in duration-200">
              
              {/* Trip Nature: Round Trip vs One Way Drop */}
              <div>
                <label className="block text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" /> Outstation Trip Mode *
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setOutstationTripType('round-trip');
                      if (!outstationPackage.includes('Round trip')) {
                        setOutstationPackage('Round trip 24hr');
                      }
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer ${
                      outstationTripType === 'round-trip'
                        ? 'bg-amber-400 text-slate-950 font-extrabold shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>⇄ Round Trip</span>
                    <span className={`text-[10px] ${outstationTripType === 'round-trip' ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                      (Both Ways Return)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOutstationTripType('one-way');
                      if (!outstationPackage.includes('One Way')) {
                        setOutstationPackage('One Way (Up to 300 km)');
                      }
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer ${
                      outstationTripType === 'one-way'
                        ? 'bg-amber-400 text-slate-950 font-extrabold shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>➔ One Way Drop</span>
                    <span className={`text-[10px] ${outstationTripType === 'one-way' ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                      (Single Outstation Drop)
                    </span>
                  </button>
                </div>
              </div>

              {/* Package selector based on chosen mode */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex flex-wrap items-center justify-between gap-1">
                  <span>
                    {outstationTripType === 'one-way' 
                      ? 'Select One Way Drop Package' 
                      : 'Select Round Trip Duration'}
                  </span>
                  <span className="text-[11px] text-amber-400 font-normal">
                    {outstationTripType === 'one-way' ? 'Includes Anna Return Bus Allowance' : 'Includes Fuel/Food Guidelines'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(outstationTripType === 'one-way' ? [
                    { id: 'One Way (Up to 150 km)', label: 'Up to 150 km', sub: 'Mysuru, Hassan', priceKey: 'driver_outstation_150km', fallback: 1199 },
                    { id: 'One Way (Up to 300 km)', label: 'Up to 300 km', sub: 'Coorg, Chikmagalur', priceKey: 'driver_outstation_300km', fallback: 1799 },
                    { id: 'One Way (Up to 500 km)', label: 'Up to 500 km', sub: 'Wayanad, Ooty, Chennai', priceKey: 'driver_outstation_500km', fallback: 2399 },
                    { id: 'One Way Custom Drop', label: 'Custom Drop', sub: 'Any Destination Spot', priceKey: 'driver_outstation_150km', fallback: 1499 }
                  ] : [
                    { id: 'Round trip 12hr', label: 'Round trip 12hr', sub: 'Day Trip (Nandi Hills)', priceKey: 'driver_outstation_12hr', fallback: 1199 },
                    { id: 'Round trip 24hr', label: 'Round trip 24hr', sub: '1-Day Getaway', priceKey: 'driver_outstation_24hr', fallback: 1999 },
                    { id: 'Round trip 46hr', label: 'Round trip 46hr', sub: 'Weekend Vacation', priceKey: 'driver_outstation_46hr', fallback: 3899 },
                    { id: 'Round trip 72hr', label: 'Round trip 72hr', sub: '3-Day Road Trip', priceKey: 'driver_outstation_72hr', fallback: 5799 }
                  ]).map((pkg) => {
                    const isSelected = outstationPackage === pkg.id;
                    const displayPrice = formatPrice(pkg.priceKey, pkg.fallback);
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setOutstationPackage(pkg.id)}
                        className={`py-3 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 border-amber-400 font-extrabold shadow-md'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold">{pkg.label}</div>
                        <div className={`text-[10px] truncate ${isSelected ? 'text-slate-800' : 'text-slate-400'}`}>{pkg.sub}</div>
                        <div className={`text-[11px] font-black mt-1 ${isSelected ? 'text-slate-950' : 'text-amber-400'}`}>{displayPrice}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" /> Bangalore Pickup Location *
                  </label>
                  <select
                    value={pickupArea}
                    onChange={(e) => setPickupArea(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {BANGALORE_AREAS.map((a, i) => (
                      <option key={i} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" /> Outstation Destination Spot *
                  </label>
                  <input
                    type="text"
                    required
                    value={outstationDestination}
                    onChange={(e) => setOutstationDestination(e.target.value)}
                    placeholder="e.g. Coorg, Nandi Hills, Chikmagalur, Mysuru, Ooty"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* DYNAMIC LOCATION FIELDS FOR VEHICLE BOOKING */}
          {bookingCategory === 'vehicle' && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4 animate-in fade-in duration-200">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-amber-400" /> {vehicleCategory} Pickup & Drop Details
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Pickup Area Dropdown */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" /> Pickup Area in Bangalore *
                  </label>
                  <select
                    value={pickupArea}
                    onChange={(e) => setPickupArea(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {BANGALORE_AREAS.map((a, i) => (
                      <option key={i} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Drop Area Dropdown */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" /> Drop Location in Bangalore *
                  </label>
                  <select
                    value={dropLocation}
                    onChange={(e) => setDropLocation(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {BANGALORE_AREAS.map((a, i) => (
                      <option key={i} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              SERVICE 3: DRIVING CLASSES & COURSES (Beginner, Refresher, Own Car, Auto)
             ========================================================================= */}
          {bookingCategory === 'class' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4" /> 1. Select Driving Course Package
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DRIVING_CLASSES.map((cls) => {
                  const isSelected = selectedClassId === cls.id;
                  const classPriceKey = {
                    'class-beginner': 'class_beginner',
                    'class-refresher': 'class_refresher',
                    'class-own-car': 'class_own_car',
                    'class-automatic': 'class_automatic'
                  }[cls.id] || 'class_beginner';
                  const displayPrice = formatPrice(classPriceKey, cls.basePrice);
                  return (
                    <div
                      key={cls.id}
                      onClick={() => setSelectedClassId(cls.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-400/10 border-amber-400 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-400 border border-amber-500/30">
                          {cls.badge}
                        </span>
                        <span className="text-base font-black text-amber-400">{displayPrice}</span>
                      </div>
                      <h4 className="font-extrabold text-sm text-white">{cls.name}</h4>
                      <p className="text-[11px] text-slate-400 font-medium">{cls.duration}</p>
                      <p className="text-xs text-slate-300 mt-2 leading-relaxed">{cls.description}</p>
                    </div>
                  );
                })}
              </div>

              {/* Training Car & Transmission Preferences */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <SteeringWheel className="w-3.5 h-3.5 text-amber-400" /> 2. Vehicle & Transmission Preference
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Car Option */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                      <Car className="w-3.5 h-3.5 text-amber-400" /> Training Vehicle *
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      {["Anna's Dual-Control Car", "Your Own Car"].map((carOpt) => (
                        <button
                          key={carOpt}
                          type="button"
                          onClick={() => setClassTrainingCar(carOpt)}
                          className={`p-2.5 rounded-xl border text-center font-bold text-[11px] transition-all ${
                            classTrainingCar === carOpt
                              ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {carOpt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Transmission */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                      <SteeringWheel className="w-3.5 h-3.5 text-amber-400" /> Gear Transmission *
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      {['Manual', 'Automatic'].map((trans) => (
                        <button
                          key={trans}
                          type="button"
                          onClick={() => setClassTransmission(trans)}
                          className={`p-2.5 rounded-xl border text-center font-bold text-[11px] transition-all ${
                            classTransmission === trans
                              ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {trans}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Batch Time Slot & Doorstep Area */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" /> Preferred Daily Time Slot *
                    </label>
                    <select
                      value={classTimeSlot}
                      onChange={(e) => setClassTimeSlot(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="Early Morning (06:00 AM - 07:00 AM)">Early Morning (06:00 AM - 07:00 AM)</option>
                      <option value="Morning (07:00 AM - 08:00 AM)">Morning (07:00 AM - 08:00 AM)</option>
                      <option value="Mid-Morning (09:00 AM - 10:00 AM)">Mid-Morning (09:00 AM - 10:00 AM)</option>
                      <option value="Evening (05:00 PM - 06:00 PM)">Evening (05:00 PM - 06:00 PM)</option>
                      <option value="Late Evening (06:00 PM - 07:00 PM)">Late Evening (06:00 PM - 07:00 PM)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" /> Doorstep Training Area in Bangalore *
                    </label>
                    <select
                      value={pickupArea}
                      onChange={(e) => setPickupArea(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      {BANGALORE_AREAS.map((a, i) => (
                        <option key={i} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NUMBER OF PASSENGERS, LUGGAGE & AC PREFERENCE SECTION - Vehicle Rental Only */}
          {bookingCategory === 'vehicle' && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                {/* 1. Number of Passengers - Starts empty with Placeholder */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-400" /> No. of Passengers *
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="50"
                    required
                    value={passengerCount}
                    onChange={(e) => setPassengerCount(e.target.value)}
                    placeholder="e.g. 2, 6, 12, 24"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* 2. Number of Luggage Bags - Starts empty with Placeholder */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-amber-400" /> No. of Luggage
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="50"
                    value={luggageCount}
                    onChange={(e) => setLuggageCount(e.target.value)}
                    placeholder="e.g. 2 bags"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* 3. AC or Non-AC Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Snowflake className="w-3.5 h-3.5 text-amber-400" /> AC Preference *
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setAcPreference('AC')}
                      className={`py-2 px-1.5 rounded-xl border text-center transition-all ${
                        acPreference === 'AC'
                          ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-[11px] flex items-center justify-center gap-1">
                        <Snowflake className="w-3 h-3 text-cyan-400" /> AC
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAcPreference('Non-AC')}
                      className={`py-2 px-1.5 rounded-xl border text-center transition-all ${
                        acPreference === 'Non-AC'
                          ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-[11px] flex items-center justify-center gap-1">
                        <Sun className="w-3 h-3 text-amber-400" /> Non-AC
                      </div>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* DATE & TIME & ADDRESS */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" /> {bookingCategory === 'class' ? 'Course Start Date, Preferred Time & Doorstep Address' : 'Pickup Date, Time & Doorstep Address'}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
                  <span>{bookingCategory === 'class' ? 'Start Date *' : 'Pickup Date *'}</span>
                  <span className="text-[10px] text-slate-500 font-mono">DD/MM/YYYY</span>
                </label>
                <DateInput
                  value={bookingDate}
                  onChange={setBookingDate}
                  placeholder="DD/MM/YYYY"
                  minDate={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Pickup Time *</label>
                <input
                  type="time"
                  value={bookingTime}
                  onChange={(e) => setBookingTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Exact Landmark / Doorstep Address</label>
              <input
                type="text"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="e.g. Near Metro Station / Flat 302, Green Palms, 100ft Road"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* CUSTOMER INFORMATION */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" /> Customer Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Mobile Number (WhatsApp) *</label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Special Notes for Driver / Captain (Optional)</label>
              <input
                type="text"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Extra legroom needed / Call before arrival"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* PAYMENT METHOD & FARE SUMMARY (2 PAYMENT OPTIONS: Cash & UPI) */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-300">Payment Option</span>
              <div className="text-right">
                <span className="text-sm font-extrabold text-amber-400 font-['Outfit']">
                  Total ₹{effectiveTotalFare.toLocaleString('en-IN')}
                </span>
                {effectiveGst > 0 ? (
                  <span className="block text-[10px] text-slate-400 font-medium">
                    (₹{effectiveBase.toLocaleString('en-IN')} base + ₹{effectiveGst.toLocaleString('en-IN')} 5% GST)
                  </span>
                ) : (
                  <span className="block text-[10px] text-emerald-400 font-medium">
                    (All-Inclusive Package)
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <button
                type="button"
                onClick={() => setPaymentMode('cash')}
                className={`py-3 px-2 sm:px-3 rounded-xl border text-center font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 min-h-[48px] touch-manipulation cursor-pointer ${
                  paymentMode === 'cash'
                    ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-[11px] sm:text-xs text-center">{bookingCategory === 'class' ? 'Pay to Instructor' : 'Cash'}</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('upi')}
                className={`py-3 px-2 sm:px-3 rounded-xl border text-center font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 min-h-[48px] touch-manipulation cursor-pointer ${
                  paymentMode === 'upi'
                    ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                <Smartphone className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-[11px] sm:text-xs text-center">GPay / PhonePe / UPI</span>
              </button>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-3.5 text-sm sm:text-base justify-center min-h-[48px] touch-manipulation disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Confirming Booking...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <span className="truncate">Confirm {bookingCategory === 'class' ? 'Driving Class Enrollment' : (bookingCategory === 'vehicle' ? `${vehicleCategory} Booking` : 'Driver Booking')} (₹{effectiveTotalFare.toLocaleString('en-IN')})</span>
              </>
            )}
          </button>

          <p className="text-center text-[10px] text-slate-500 flex items-center justify-center gap-1">
            <Lock className="w-3 h-3 text-emerald-400" /> Free Cancellation up to 30 minutes before departure • Zero cancellation penalty
          </p>

        </form>
      </div>
    </div>
  );
}
