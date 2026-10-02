import React, { useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

/**
 * Custom emerald pin icon representing Pickup Location.
 * Distinct from destination, search results, and GPS markers.
 */
function createPickupIcon() {
  return L.divIcon({
    className: 'bda-pickup-marker-icon',
    html: `
      <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 100%; height: 100%; border-radius: 9999px; background-color: rgba(16, 185, 129, 0.25);"></div>
        <div style="position: relative; width: 16px; height: 16px; border-radius: 9999px; background-color: #10b981; border: 2.5px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"></div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18]
  });
}

let cachedPickupIcon = null;
function getPickupIcon() {
  if (!cachedPickupIcon && typeof L !== 'undefined' && L.divIcon) {
    cachedPickupIcon = createPickupIcon();
  }
  return cachedPickupIcon || createPickupIcon();
}

/**
 * PickupMarker Component
 *
 * Visually displays the selected pickup location pin on the map.
 */
function PickupMarker({ location, label = 'Pickup Location' }) {
  const icon = useMemo(() => getPickupIcon(), []);

  if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    return null;
  }

  const { latitude, longitude, displayName } = location;

  return (
    <Marker position={[latitude, longitude]} icon={icon}>
      <Popup>
        <div className="text-xs font-sans p-0.5 text-slate-900 leading-tight max-w-[220px]">
          <div className="font-bold text-emerald-700 flex items-center gap-1 mb-1">
            <span>📍</span> {label}
          </div>
          <div className="text-[11px] text-slate-700 font-medium">
            {displayName || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default React.memo(PickupMarker, (prev, next) => {
  if (prev.label !== next.label) return false;
  if (!prev.location && !next.location) return true;
  if (!prev.location || !next.location) return false;
  return (
    prev.location.latitude === next.location.latitude &&
    prev.location.longitude === next.location.longitude &&
    prev.location.displayName === next.location.displayName
  );
});
