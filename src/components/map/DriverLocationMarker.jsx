import React, { useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

/**
 * Creates a distinct royal blue vehicle marker icon for the assigned driver.
 * Visually distinct from customer GPS (amber), pickup (emerald), and destination (rose).
 */
function createDriverLocationIcon() {
  return L.divIcon({
    className: 'bda-driver-marker-wrapper',
    html: `
      <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
        <!-- Subtle pulsing radar ring -->
        <div style="position: absolute; width: 100%; height: 100%; border-radius: 9999px; background-color: rgba(59, 130, 246, 0.25); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <!-- Outer protective shell -->
        <div style="position: relative; width: 26px; height: 26px; border-radius: 9999px; background: linear-gradient(135deg, #2563eb, #1d4ed8); border: 2.5px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; color: white;">
          <!-- Inline Car SVG Icon -->
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20]
  });
}

let cachedDriverIcon = null;
function getDriverLocationIcon() {
  if (!cachedDriverIcon && typeof L !== 'undefined' && L.divIcon) {
    cachedDriverIcon = createDriverLocationIcon();
  }
  return cachedDriverIcon || createDriverLocationIcon();
}

/**
 * DriverLocationMarker Component
 *
 * Renders the live position of the assigned driver on the customer map.
 * Consumes location data from Phase 10 realtime transport.
 * 
 * @param {Object} props
 * @param {Object} props.location - { latitude, longitude, timestamp, driverId }
 * @param {string} [props.label='Driver Anna'] - Driver name or label
 * @param {string} [props.subtitle='Live GPS Location'] - Subtitle in popup
 */
const MemoizedDriverLocationMarker = React.memo(function InnerDriverLocationMarker({
  location,
  label = 'Driver Anna',
  subtitle = 'Live GPS Location'
}) {
  const icon = useMemo(() => getDriverLocationIcon(), []);

  // Strict coordinate validation
  if (!location) return null;

  const lat = typeof location.latitude === 'number' ? location.latitude : Number(location.latitude);
  const lng = typeof location.longitude === 'number' ? location.longitude : Number(location.longitude);

  if (!isFinite(lat) || !isFinite(lng) || isNaN(lat) || isNaN(lng)) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  // Format timestamp if available
  let formattedTime = null;
  if (location.timestamp) {
    try {
      const d = new Date(location.timestamp);
      if (!isNaN(d.getTime())) {
        formattedTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    } catch (e) {}
  }

  return (
    <Marker position={[lat, lng]} icon={icon}>
      <Popup>
        <div className="text-xs font-sans p-1 text-slate-900 leading-tight min-w-[160px]">
          <div className="font-extrabold text-blue-700 flex items-center gap-1.5 mb-1 text-[13px]">
            <span>🚗</span>
            <span>{label}</span>
          </div>
          <div className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{subtitle}</span>
          </div>
          <div className="text-[10px] text-slate-600 font-mono flex items-center justify-between border-t border-slate-200 pt-1 mt-1">
            <span>Coordinates:</span>
            <span>{lat.toFixed(4)}, {lng.toFixed(4)}</span>
          </div>
          {formattedTime && (
            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-between">
              <span>Updated:</span>
              <span className="font-mono">{formattedTime}</span>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}, (prevProps, nextProps) => {
  if (prevProps.label !== nextProps.label || prevProps.subtitle !== nextProps.subtitle) {
    return false;
  }
  const prevLoc = prevProps.location;
  const nextLoc = nextProps.location;
  if (!prevLoc && !nextLoc) return true;
  if (!prevLoc || !nextLoc) return false;

  return (
    prevLoc.latitude === nextLoc.latitude &&
    prevLoc.longitude === nextLoc.longitude &&
    prevLoc.driverId === nextLoc.driverId
  );
});

export default function DriverLocationMarker(props) {
  return <MemoizedDriverLocationMarker {...props} />;
}
