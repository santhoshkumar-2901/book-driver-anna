import React, { useMemo } from 'react';
import { Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';

/**
 * Custom pulsing dot icon representing customer's current position.
 * Distinct from future vehicle/driver or destination markers.
 */
function createCustomerLocationIcon() {
  return L.divIcon({
    className: 'bda-customer-location-icon',
    html: `
      <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 100%; height: 100%; border-radius: 9999px; background-color: rgba(245, 158, 11, 0.35); transform: scale(1.1);"></div>
        <div style="position: relative; width: 14px; height: 14px; border-radius: 9999px; background-color: #f59e0b; border: 2.5px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14]
  });
}

/**
 * LocationMarker Component
 *
 * Renders the customer's current location pin and an optional accuracy circle
 * reflecting the browser-provided accuracy value in meters.
 */
export default function LocationMarker({ location, label = 'Your Current Location' }) {
  const icon = useMemo(() => createCustomerLocationIcon(), []);

  if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    return null;
  }

  const { latitude, longitude, accuracy } = location;

  return (
    <>
      {/* Accuracy circle representing browser-reported accuracy in meters */}
      {typeof accuracy === 'number' && accuracy > 0 && accuracy <= 5000 && (
        <Circle
          center={[latitude, longitude]}
          radius={accuracy}
          pathOptions={{
            color: '#f59e0b',
            fillColor: '#f59e0b',
            fillOpacity: 0.1,
            weight: 1,
            dashArray: '4, 4'
          }}
        />
      )}

      {/* Customer Location Pin */}
      <Marker position={[latitude, longitude]} icon={icon}>
        <Popup>
          <div className="text-xs font-sans p-0.5 text-slate-900 leading-tight">
            <div className="font-bold text-slate-950 flex items-center gap-1">
              <span>📍</span> {label}
            </div>
            {typeof accuracy === 'number' && (
              <div className="text-[11px] text-slate-600 mt-1 font-mono">
                Accuracy: ~{Math.round(accuracy)} m
              </div>
            )}
          </div>
        </Popup>
      </Marker>
    </>
  );
}
