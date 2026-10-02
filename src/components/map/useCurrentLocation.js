import { useState, useCallback } from 'react';

/**
 * useCurrentLocation Hook
 *
 * Provides on-demand, explicit browser geolocation using navigator.geolocation.getCurrentPosition.
 * Complies with strict privacy requirements:
 * - Never runs automatically on mount
 * - Never uses continuous watchPosition
 * - Coordinates are held strictly in memory
 * - No persistence to localStorage, cookies, or backend
 */
export function useCurrentLocation() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const requestLocation = useCallback(() => {
    // 1. Check if browser supports Geolocation API
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('Location services are not supported by your browser.');
      return;
    }

    // 2. Prevent duplicate concurrent requests
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLoading(false);
        setError(null);
        if (position && position.coords) {
          const { latitude, longitude, accuracy } = position.coords;
          setLocation({
            latitude,
            longitude,
            accuracy: typeof accuracy === 'number' ? accuracy : null,
            timestamp: position.timestamp || Date.now()
          });
        }
      },
      (geoError) => {
        setLoading(false);
        let message = 'Your location could not be determined. Please try again.';
        if (geoError) {
          switch (geoError.code) {
            case 1: // PERMISSION_DENIED
              message = 'Location permission was denied. Please allow location access in your browser settings.';
              break;
            case 2: // POSITION_UNAVAILABLE
              message = 'Your location could not be determined. Please try again.';
              break;
            case 3: // TIMEOUT
              message = 'Location request timed out. Please try again.';
              break;
            default:
              message = 'Unable to retrieve location. Please try again.';
          }
        }
        setError(message);
      },
      geoOptions
    );
  }, [loading]);

  const clearLocation = useCallback(() => {
    setLocation(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    location,
    loading,
    error,
    requestLocation,
    clearLocation
  };
}
