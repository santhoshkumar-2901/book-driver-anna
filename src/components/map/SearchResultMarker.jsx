import React, { useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

/**
 * Custom pin icon for searched/selected locations.
 * Distinct from the customer's amber GPS dot (LocationMarker).
 */
function createSearchResultIcon() {
  return L.divIcon({
    className: 'bda-search-result-icon',
    html: `
      <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 100%; height: 100%; border-radius: 9999px; background-color: rgba(59, 130, 246, 0.25);"></div>
        <div style="position: relative; width: 14px; height: 14px; border-radius: 9999px; background-color: #3b82f6; border: 2.5px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16]
  });
}

/**
 * SearchResultMarker Component
 *
 * Visually displays a location selected via text search on the map.
 */
export default function SearchResultMarker({ location }) {
  const icon = useMemo(() => createSearchResultIcon(), []);

  if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    return null;
  }

  const { latitude, longitude, displayName } = location;

  return (
    <Marker position={[latitude, longitude]} icon={icon}>
      <Popup>
        <div className="text-xs font-sans p-0.5 text-slate-900 leading-tight max-w-[220px]">
          <div className="font-bold text-blue-700 flex items-center gap-1 mb-1">
            <span>🔍</span> Selected Search Location
          </div>
          <div className="text-[11px] text-slate-700 font-medium">
            {displayName || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
