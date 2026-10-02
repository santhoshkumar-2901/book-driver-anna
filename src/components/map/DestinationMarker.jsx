import React, { useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

/**
 * Custom crimson pin icon representing Destination.
 * Distinct from pickup, search results, and GPS markers.
 */
function createDestinationIcon() {
  return L.divIcon({
    className: 'bda-destination-marker-icon',
    html: `
      <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 100%; height: 100%; border-radius: 9999px; background-color: rgba(244, 63, 94, 0.25);"></div>
        <div style="position: relative; width: 16px; height: 16px; border-radius: 9999px; background-color: #f43f5e; border: 2.5px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"></div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18]
  });
}

let cachedDestinationIcon = null;
function getDestinationIcon() {
  if (!cachedDestinationIcon && typeof L !== 'undefined' && L.divIcon) {
    cachedDestinationIcon = createDestinationIcon();
  }
  return cachedDestinationIcon || createDestinationIcon();
}

/**
 * DestinationMarker Component
 *
 * Visually displays the selected destination location pin on the map.
 */
function DestinationMarker({ location, label = 'Destination' }) {
  const icon = useMemo(() => getDestinationIcon(), []);

  if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    return null;
  }

  const { latitude, longitude, displayName } = location;

  return (
    <Marker position={[latitude, longitude]} icon={icon}>
      <Popup>
        <div className="text-xs font-sans p-0.5 text-slate-900 leading-tight max-w-[220px]">
          <div className="font-bold text-rose-700 flex items-center gap-1 mb-1">
            <span>🏁</span> {label}
          </div>
          <div className="text-[11px] text-slate-700 font-medium">
            {displayName || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default React.memo(DestinationMarker, (prev, next) => {
  if (prev.label !== next.label) return false;
  if (!prev.location && !next.location) return true;
  if (!prev.location || !next.location) return false;
  return (
    prev.location.latitude === next.location.latitude &&
    prev.location.longitude === next.location.longitude &&
    prev.location.displayName === next.location.displayName
  );
});
