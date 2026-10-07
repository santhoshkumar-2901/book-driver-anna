import { useState, useEffect, useRef, useCallback } from 'react';
import { broadcastBookingUpdate } from './broadcastSync.js';
import { apiClient } from '../services/apiClient.js';

/**
 * useDriverRealtimeLocation
 * 
 * Production React hook for subscribing to realtime driver GPS location updates
 * for an authorized booking over secure WebSocket transport.
 * 
 * Features:
 * - Native browser WebSocket transport (zero bloated client dependencies)
 * - Automatic connection authentication via JWT
 * - Booking-scoped subscription authorization
 * - Reconnection with exponential backoff on unexpected drops
 * - Immediate initial location hydration on authorized subscription
 * - Safe lifecycle cleanup on unmount (zero memory/socket leaks)
 * - Graceful failure handling without crashing booking or application flows
 * 
 * @param {Object} options
 * @param {string|null} options.bookingId - Target booking ID to track
 * @param {string|null} [options.driverId] - Optional assigned driver ID to enforce assignment scoping
 * @param {string|null} options.token - Authenticated JWT token
 * @param {boolean} [options.enabled=true] - Whether realtime tracking is active
 * @param {string|null} [options.serverUrl] - Optional custom WebSocket server URL (defaults to env or standard port)
 * 
 * @returns {Object} { location, connectionStatus, error, isConnected }
 */
export function useDriverRealtimeLocation({
  bookingId,
  driverId = null,
  token,
  enabled = true,
  serverUrl = null
} = {}) {
  const [location, setLocation] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const isUnmountedRef = useRef(false);
  const isAuthenticatedRef = useRef(false);
  const isSubscribedRef = useRef(false);

  // Determine standard WebSocket URL from environment or host
  const getWebSocketUrl = useCallback(() => {
    if (serverUrl) return serverUrl;
    
    // Vite client env variable
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_REALTIME_URL) {
      return import.meta.env.VITE_REALTIME_URL;
    }

    if (typeof window !== 'undefined') {
      const isSecure = window.location.protocol === 'https:';
      const protocol = isSecure ? 'wss:' : 'ws:';
      const hostname = window.location.hostname || 'localhost';
      return `${protocol}//${hostname}:5001/realtime`;
    }

    return 'ws://localhost:5001/realtime';
  }, [serverUrl]);

  useEffect(() => {
    isUnmountedRef.current = false;

    // If disabled or missing required booking or token, ensure disconnected state and clean up location
    if (!enabled || !bookingId || !token) {
      if (socketRef.current) {
        try {
          if (isSubscribedRef.current && bookingId && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'unsubscribe', bookingId }));
          }
          socketRef.current.close(1000, 'Tracking disabled');
        } catch (e) {}
        socketRef.current = null;
      }
      setLocation(null);
      setConnectionStatus('disconnected');
      return;
    }

    // Always reset location on fresh connection or reassignment
    setLocation(null);

    const connect = () => {
      if (isUnmountedRef.current) return;

      const wsUrl = getWebSocketUrl();
      setConnectionStatus(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting');
      setError(null);
      isAuthenticatedRef.current = false;
      isSubscribedRef.current = false;

      let ws;
      try {
        ws = new WebSocket(wsUrl);
        socketRef.current = ws;
      } catch (err) {
        if (isUnmountedRef.current) return;
        setConnectionStatus('error');
        setError(`Failed to create WebSocket: ${err.message}`);
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        if (isUnmountedRef.current || socketRef.current !== ws) return;
        reconnectAttemptRef.current = 0;

        // Step 1: Send authentication message
        try {
          ws.send(JSON.stringify({
            type: 'authenticate',
            token
          }));
        } catch (e) {
          setError('Failed to transmit authentication credentials');
        }
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current || socketRef.current !== ws) return;

        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (err) {
          return;
        }

        if (!msg || typeof msg !== 'object') return;

        switch (msg.type) {
          case 'authenticated':
            isAuthenticatedRef.current = true;
            // Step 2: Send subscription message for this booking
            if (bookingId && !isSubscribedRef.current) {
              try {
                ws.send(JSON.stringify({
                  type: 'subscribe',
                  bookingId
                }));
              } catch (e) {}
            }
            break;

          case 'subscribed':
            if (msg.bookingId === bookingId) {
              isSubscribedRef.current = true;
              setConnectionStatus('connected');
              setError(null);

              // Hydrate authoritative state after reconnect to recover any missed events
              if (reconnectAttemptRef.current > 0 || !location) {
                apiClient.getBookingDriverLocation(bookingId).then(res => {
                  if (isUnmountedRef.current) return;
                  if (res?.data?.location && typeof res.data.location.latitude === 'number') {
                    const httpLoc = res.data.location;
                    if (!driverId || !httpLoc.driverId || httpLoc.driverId === driverId) {
                      setLocation(prev => {
                        if (prev) {
                          const prevTime = new Date(prev.timestamp || 0).getTime();
                          const newTime = new Date(httpLoc.timestamp || httpLoc.updatedAt || Date.now()).getTime();
                          if (!isNaN(prevTime) && !isNaN(newTime) && newTime < prevTime) {
                            return prev;
                          }
                        }
                        return {
                          driverId: httpLoc.driverId || driverId,
                          bookingId,
                          latitude: httpLoc.latitude,
                          longitude: httpLoc.longitude,
                          timestamp: httpLoc.timestamp || httpLoc.updatedAt || new Date().toISOString()
                        };
                      });
                    }
                  }
                }).catch(() => {});
              }
            }
            break;

          case 'driver.location.initial':
          case 'driver.location.updated':
            if (
              msg.bookingId === bookingId &&
              typeof msg.latitude === 'number' &&
              typeof msg.longitude === 'number' &&
              !isNaN(msg.latitude) &&
              !isNaN(msg.longitude) &&
              isFinite(msg.latitude) &&
              isFinite(msg.longitude) &&
              msg.latitude >= -90 &&
              msg.latitude <= 90 &&
              msg.longitude >= -180 &&
              msg.longitude <= 180
            ) {
              // Ignore updates from previous or mismatched drivers
              if (driverId && msg.driverId && msg.driverId !== driverId) {
                return;
              }
              // Update latest position: setLocation({ driverId, bookingId, latitude, longitude, timestamp })
              // Stale GPS protection: ignore updates with older timestamps
              setLocation(prev => {
                if (prev) {
                  const prevTime = new Date(prev.timestamp || 0).getTime();
                  const newTime = new Date(msg.timestamp || Date.now()).getTime();
                  if (!isNaN(prevTime) && !isNaN(newTime) && newTime < prevTime) {
                    return prev;
                  }
                  if (
                    prev.driverId === msg.driverId &&
                    prev.bookingId === msg.bookingId &&
                    prev.latitude === msg.latitude &&
                    prev.longitude === msg.longitude
                  ) {
                    if (!isNaN(prevTime) && !isNaN(newTime) && newTime - prevTime < 15000) {
                      return prev;
                    }
                  }
                }
                return {
                  driverId: msg.driverId,
                  bookingId: msg.bookingId,
                  latitude: msg.latitude,
                  longitude: msg.longitude,
                  timestamp: msg.timestamp || new Date().toISOString()
                };
              });
            }
            break;

          case 'booking.assignment.updated':
            if (msg.bookingId === bookingId) {
              const upperStatus = String(msg.status || '').toUpperCase();
              if (upperStatus === 'COMPLETED' || upperStatus === 'CANCELLED') {
                // Terminal state arrived: clear driver location immediately to prevent race
                setLocation(null);
              } else if (!msg.assignedDriverId) {
                // Driver was unassigned
                setLocation(null);
              } else if (driverId && msg.assignedDriverId !== driverId) {
                // Reassigned to a different driver
                setLocation(null);
              }

              // Synchronize status and assignment updates across active modals/listeners
              try {
                broadcastBookingUpdate({
                  bookingId: msg.bookingId,
                  status: msg.status,
                  assignedDriverId: msg.assignedDriverId,
                  assignedDriverName: msg.assignedDriverName,
                  timestamp: msg.timestamp
                });
              } catch (e) {}
            }
            break;

          case 'error':
            setError(msg.message || msg.code || 'Realtime error');
            if (msg.code === 'UNAUTHORIZED' || msg.code === 'FORBIDDEN') {
              setConnectionStatus('error');
            }
            break;

          case 'pong':
            break;

          default:
            break;
        }
      };

      ws.onerror = (evt) => {
        if (isUnmountedRef.current || socketRef.current !== ws) return;
        setConnectionStatus('error');
        setError('Realtime transport connection error');
      };

      ws.onclose = (evt) => {
        if (isUnmountedRef.current || socketRef.current !== ws) return;
        isAuthenticatedRef.current = false;
        isSubscribedRef.current = false;
        socketRef.current = null;

        // Code 1000 = normal closure (intentional close/unmount)
        if (evt.code === 1000) {
          setConnectionStatus('disconnected');
          return;
        }

        // Code 4001 = authentication failure, do not reconnect in a loop
        if (evt.code === 4001) {
          setConnectionStatus('error');
          setError('Authentication rejected by realtime service.');
          return;
        }

        // Unexpected drop: attempt reconnect with backoff
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (isUnmountedRef.current || !enabled) return;

      const maxAttempts = 6;
      if (reconnectAttemptRef.current >= maxAttempts) {
        setConnectionStatus('error');
        setError('Realtime service currently unavailable. Operating in fallback mode.');
        return;
      }

      const attempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = attempt;
      // Exponential backoff: 1s, 2s, 4s, 8s, 10s max
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);

      setConnectionStatus('reconnecting');
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    // Initial connection
    connect();

    // Cleanup on unmount or dependency change
    return () => {
      isUnmountedRef.current = true;
      clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        try {
          if (isSubscribedRef.current && bookingId && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'unsubscribe', bookingId }));
          }
          socketRef.current.close(1000, 'Component unmounted or tracking changed');
        } catch (e) {}
        socketRef.current = null;
      }
    };
  }, [bookingId, token, enabled, driverId, getWebSocketUrl]);

  // HTTP Fallback Polling Effect (Phase 6 Serverless & Reliability Hardening)
  // When WebSocket is disconnected or in error, automatically poll GET /api/bookings/:id/driver-location
  useEffect(() => {
    if (!enabled || !bookingId || !token || connectionStatus === 'connected') {
      return;
    }

    let isPollingActive = true;
    const pollFallback = async () => {
      try {
        const res = await apiClient.getBookingDriverLocation(bookingId);
        if (!isPollingActive || isUnmountedRef.current) return;
        if (res && res.data) {
          const { trackingActive, location: httpLoc, status: httpStatus } = res.data;
          if (trackingActive === false) {
            setLocation(null);
            return;
          }
          if (httpLoc && typeof httpLoc.latitude === 'number' && typeof httpLoc.longitude === 'number') {
            if (driverId && httpLoc.driverId && httpLoc.driverId !== driverId) {
              return;
            }
            setLocation(prev => {
              if (prev) {
                const prevTime = new Date(prev.timestamp || 0).getTime();
                const newTime = new Date(httpLoc.timestamp || httpLoc.updatedAt || Date.now()).getTime();
                if (!isNaN(prevTime) && !isNaN(newTime) && newTime < prevTime) {
                  return prev;
                }
              }
              return {
                driverId: httpLoc.driverId || driverId,
                bookingId,
                latitude: httpLoc.latitude,
                longitude: httpLoc.longitude,
                timestamp: httpLoc.timestamp || httpLoc.updatedAt || new Date().toISOString()
              };
            });
          }
          if (httpStatus) {
            broadcastBookingUpdate({
              bookingId,
              status: httpStatus
            });
          }
        }
      } catch (e) {
        // Safe fallback - non-blocking
      }
    };

    let timerId = null;
    const scheduleNextPoll = () => {
      if (!isPollingActive) return;
      timerId = setTimeout(async () => {
        if (!isPollingActive) return;
        await pollFallback();
        scheduleNextPoll();
      }, 10000);
    };

    pollFallback().then(scheduleNextPoll);

    return () => {
      isPollingActive = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [enabled, bookingId, token, driverId, connectionStatus]);

  // Phase 20: Freshness detection (LIVE vs STALE vs UNAVAILABLE) without polling
  const evaluateFreshness = () => {
    if (!location || !location.timestamp) {
      return 'UNAVAILABLE';
    }
    const ageMs = Date.now() - new Date(location.timestamp).getTime();
    if (isNaN(ageMs) || ageMs > 45000) {
      return 'STALE';
    }
    return 'LIVE';
  };

  const freshness = evaluateFreshness();

  // Phase 20: Explicit recovery action to reconnect after error or max attempts reached
  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    if (socketRef.current) {
      try {
        socketRef.current.close(1000, 'Manual reconnect requested');
      } catch (e) {}
      socketRef.current = null;
    }
    // Re-trigger connection if enabled
    if (!isUnmountedRef.current && enabled && bookingId && token) {
      setConnectionStatus('connecting');
      setError(null);
      const wsUrl = getWebSocketUrl();
      try {
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;
      } catch (err) {
        setConnectionStatus('error');
        setError(err.message);
      }
    }
  }, [enabled, bookingId, token, getWebSocketUrl]);

  return {
    location,
    connectionStatus,
    freshness,
    isLive: freshness === 'LIVE',
    isStale: freshness === 'STALE',
    isUnavailable: freshness === 'UNAVAILABLE',
    error,
    isConnected: connectionStatus === 'connected',
    reconnect
  };
}
