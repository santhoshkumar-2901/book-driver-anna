import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

const THROTTLE_MS = 5000; // Minimum 5 seconds between backend GPS syncs

const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 10000
};

/**
 * Production Driver GPS Location Hook
 *
 * Provides continuous background tracking via navigator.geolocation.watchPosition(),
 * client-side throttling, strict watcher lifecycle cleanup, and error-state management.
 */
export function useDriverLocation({ enabled = false, onLocationUpdate = null } = {}) {
  // Tracking status: 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'timeout' | 'error'
  const [trackingStatus, setTrackingStatus] = useState('idle');
  const [currentCoords, setCurrentCoords] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const watchIdRef = useRef(null);
  const lastSentTimeRef = useRef(0);
  const isMountedRef = useRef(true);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } catch (err) {
        console.warn('[DRIVER GPS] clearWatch warning:', err);
      }
      watchIdRef.current = null;
    }
    if (isMountedRef.current) {
      setTrackingStatus('idle');
      setErrorMessage(null);
    }
  }, []);

  const startTracking = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      if (isMountedRef.current) {
        setTrackingStatus('unavailable');
        setErrorMessage('Geolocation is not supported by your browser or device.');
      }
      return;
    }

    // Guard against multiple active watchers
    if (watchIdRef.current !== null) {
      return;
    }

    setTrackingStatus('requesting');
    setErrorMessage(null);

    const handleSuccess = (position) => {
      if (!isMountedRef.current) return;

      const { latitude, longitude, accuracy } = position.coords || {};
      const timestamp = position.timestamp || Date.now();

      // Phase 20: Strict coordinate validation
      if (
        typeof latitude !== 'number' || typeof longitude !== 'number' ||
        isNaN(latitude) || isNaN(longitude) ||
        !isFinite(latitude) || !isFinite(longitude) ||
        latitude < -90 || latitude > 90 ||
        longitude < -180 || longitude > 180
      ) {
        setTrackingStatus('error');
        setErrorMessage('Device returned invalid GPS coordinates.');
        return;
      }

      // Phase 20: Stale coordinate detection (> 60 seconds old)
      const isStale = (Date.now() - timestamp) > 60000;

      // Stabilize coordinate state reference if coordinates have not changed
      setCurrentCoords(prev => {
        if (
          prev &&
          prev.latitude === latitude &&
          prev.longitude === longitude &&
          prev.accuracy === accuracy &&
          prev.isStale === isStale
        ) {
          return prev;
        }
        return { latitude, longitude, accuracy, timestamp, isStale };
      });
      setTrackingStatus('active');
      setErrorMessage(null);

      if (onLocationUpdate) {
        try {
          onLocationUpdate({ latitude, longitude, accuracy, timestamp, isStale });
        } catch (e) {}
      }

      // Client-side throttling: Avoid unrestricted stream of HTTP requests
      const now = Date.now();
      if (now - lastSentTimeRef.current >= THROTTLE_MS) {
        lastSentTimeRef.current = now;
        apiClient.updateDriverLocation({ latitude, longitude })
          .then(() => {
            if (isMountedRef.current) {
              setLastSyncTime(new Date());
            }
          })
          .catch((err) => {
            console.warn('[DRIVER GPS] Backend sync note:', err.message);
          });
      }
    };

    const handleError = (error) => {
      if (!isMountedRef.current) return;

      let status = 'error';
      let message = 'GPS tracking error occurred.';

      switch (error.code) {
        case 1: // PERMISSION_DENIED
          status = 'denied';
          message = 'Location permission denied. Please allow location access in your browser.';
          break;
        case 2: // POSITION_UNAVAILABLE
          status = 'unavailable';
          message = 'GPS position unavailable. Please check your device location settings.';
          break;
        case 3: // TIMEOUT
          status = 'timeout';
          message = 'Location request timed out. Retrying GPS lock...';
          break;
        default:
          status = 'error';
          message = error.message || 'Unable to retrieve your location.';
      }

      setTrackingStatus(status);
      setErrorMessage(message);

      // If permanently denied, stop watching to prevent repeated browser errors
      if (error.code === 1 && watchIdRef.current !== null) {
        try {
          navigator.geolocation.clearWatch(watchIdRef.current);
        } catch (e) {}
        watchIdRef.current = null;
      }
    };

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        GEOLOCATION_OPTIONS
      );
    } catch (err) {
      if (isMountedRef.current) {
        setTrackingStatus('error');
        setErrorMessage(err.message || 'Failed to start GPS tracking.');
      }
    }
  }, [onLocationUpdate]);

  const toggleTracking = useCallback(() => {
    if (watchIdRef.current !== null || trackingStatus === 'active' || trackingStatus === 'requesting') {
      stopTracking();
    } else {
      startTracking();
    }
  }, [trackingStatus, startTracking, stopTracking]);

  // Phase 20: Explicit retry action to recover from error or timeout
  const retryTracking = useCallback(() => {
    stopTracking();
    setTimeout(() => {
      startTracking();
    }, 50);
  }, [stopTracking, startTracking]);

  // Clean lifecycle cleanup on component unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          navigator.geolocation.clearWatch(watchIdRef.current);
        } catch (e) {}
        watchIdRef.current = null;
      }
    };
  }, []);

  return {
    trackingStatus,
    isTracking: trackingStatus === 'active' || trackingStatus === 'requesting',
    currentCoords,
    isStale: Boolean(currentCoords?.isStale),
    lastSyncTime,
    errorMessage,
    startTracking,
    stopTracking,
    toggleTracking,
    retryTracking
  };
}
