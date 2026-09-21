// Cross-tab and cross-component real-time booking event sync
let channel = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel('bda_realtime_sync');
  }
} catch (e) {
  // BroadcastChannel unavailable
}

/**
 * Broadcast booking updates across all open tabs, windows, and components
 */
export function broadcastBookingUpdate(payload = {}) {
  // 1. Cross-tab BroadcastChannel
  try {
    if (channel) {
      channel.postMessage({ type: 'bda_booking_updated', payload });
    }
  } catch (e) {}

  // 2. Same-tab CustomEvent
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bda_booking_updated', { detail: payload }));
  }
}

/**
 * Subscribe to booking updates across tabs and within the active window
 * @param {Function} callback Callback executed when any booking changes
 * @returns {Function} Unsubscribe cleanup function
 */
export function onBookingUpdate(callback) {
  if (typeof window === 'undefined') return () => {};

  const handleCustom = (e) => {
    callback(e.detail);
  };

  const handleChannel = (e) => {
    if (e.data && e.data.type === 'bda_booking_updated') {
      callback(e.data.payload);
    }
  };

  const handleStorage = (e) => {
    if (e.key && (e.key.startsWith('bda_') || e.key.includes('booking'))) {
      callback({ source: 'storage', key: e.key });
    }
  };

  window.addEventListener('bda_booking_updated', handleCustom);
  window.addEventListener('storage', handleStorage);

  if (channel) {
    channel.addEventListener('message', handleChannel);
  }

  return () => {
    window.removeEventListener('bda_booking_updated', handleCustom);
    window.removeEventListener('storage', handleStorage);
    if (channel) {
      channel.removeEventListener('message', handleChannel);
    }
  };
}
