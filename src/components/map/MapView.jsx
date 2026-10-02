import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { AlertCircle, Loader2, MapPin } from 'lucide-react';

// Configure Leaflet default marker icons for Vite asset bundling
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Default center: Bengaluru (Bangalore) coordinates
export const DEFAULT_MAP_CENTER = [12.9716, 77.5946];
export const DEFAULT_MAP_ZOOM = 12;

/**
 * Controller to smoothly pan/zoom when center, zoom, or bounds props change
 */
function MapViewController({ center, zoom, bounds }) {
  const map = useMap();
  const prevCenterRef = React.useRef(null);
  const prevBoundsRef = React.useRef(null);

  useEffect(() => {
    // 1. If explicit coordinate bounds are provided, fit the map view to them
    if (bounds && Array.isArray(bounds) && bounds.length === 2) {
      const [[lat1, lng1], [lat2, lng2]] = bounds;
      if (!isNaN(lat1) && !isNaN(lng1) && !isNaN(lat2) && !isNaN(lng2)) {
        const boundsKey = `${lat1.toFixed(5)},${lng1.toFixed(5)},${lat2.toFixed(5)},${lng2.toFixed(5)}`;
        if (prevBoundsRef.current !== boundsKey) {
          prevBoundsRef.current = boundsKey;
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        }
        return;
      }
    }

    // 2. Otherwise center on single coordinate point if provided
    if (center && Array.isArray(center) && center.length === 2) {
      const [lat, lng] = center;
      if (!isNaN(lat) && !isNaN(lng)) {
        const prev = prevCenterRef.current;
        if (!prev || prev[0] !== lat || prev[1] !== lng) {
          prevCenterRef.current = [lat, lng];
          map.setView([lat, lng], zoom || map.getZoom(), {
            animate: true,
            duration: 0.8
          });
        }
      }
    }
  }, [center, zoom, bounds, map]);

  return null;
}

/**
 * Reusable MapView Component
 *
 * Provides an isolated, responsive Leaflet map using OpenStreetMap tiles.
 * Designed to cleanly accept future layers (markers, routes, drivers) without rewriting.
 */
export default function MapView({
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  bounds = null,
  className = '',
  height = '320px',
  loading = false,
  error = null,
  children,
  onMapReady,
  interactive = true,
  ariaLabel = 'Interactive route map'
}) {
  const [mapError] = useState(null);

  const displayError = error || mapError;

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner flex flex-col ${className}`}
      style={{ height, minHeight: '220px' }}
      role="region"
      aria-label={ariaLabel}
    >
      {/* Loading Indicator Overlay */}
      {loading && (
        <div className="absolute inset-0 z-[1000] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center transition-opacity">
          <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-900/90 border border-slate-700/60 rounded-xl text-slate-200 text-xs shadow-lg">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            <span>Loading map data...</span>
          </div>
        </div>
      )}

      {/* Error Fallback Overlay */}
      {displayError ? (
        <div className="absolute inset-0 z-[1000] bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-2.5">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-200 mb-1">Map preview unavailable</p>
          <p className="text-[11px] text-slate-400 max-w-xs">{displayError}</p>
        </div>
      ) : (
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={interactive}
          dragging={interactive}
          touchZoom={interactive}
          doubleClickZoom={interactive}
          zoomControl={interactive}
          attributionControl={true}
          whenReady={(mapInstance) => {
            if (onMapReady) onMapReady(mapInstance.target);
          }}
          className="w-full h-full z-0 outline-none"
          style={{ height: '100%', width: '100%' }}
        >
          <MapViewController center={center} zoom={zoom} bounds={bounds} />
          
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            eventHandlers={{
              tileerror: () => {
                // If tiles fail to load, log warning and set graceful fallback notice
                console.warn('[MapView] Some map tiles could not be loaded.');
              }
            }}
          />

          {children}
        </MapContainer>
      )}
    </div>
  );
}
