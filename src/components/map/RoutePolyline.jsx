import React, { useMemo } from 'react';
import { Polyline } from 'react-leaflet';

/**
 * RoutePolyline Component
 *
 * Renders the road network route geometry on the Leaflet map.
 * Converts GeoJSON [longitude, latitude] coordinates to Leaflet [latitude, longitude].
 */
function RoutePolyline({
  geometry,
  color = '#f59e0b', // Brand amber
  weight = 4,
  opacity = 0.85,
  dashArray = null
}) {
  const positions = useMemo(() => {
    if (!geometry) return [];

    const rawCoords = Array.isArray(geometry) 
      ? geometry 
      : (geometry.type === 'LineString' && Array.isArray(geometry.coordinates) ? geometry.coordinates : []);

    return rawCoords
      .filter(coord => Array.isArray(coord) && coord.length >= 2 && !isNaN(coord[0]) && !isNaN(coord[1]))
      .map(([lng, lat]) => [lat, lng]);
  }, [geometry]);

  if (!positions || positions.length < 2) {
    return null;
  }

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color,
        weight,
        opacity,
        dashArray,
        lineCap: 'round',
        lineJoin: 'round'
      }}
    />
  );
}

export default React.memo(RoutePolyline, (prev, next) => {
  if (
    prev.color !== next.color ||
    prev.weight !== next.weight ||
    prev.opacity !== next.opacity ||
    prev.dashArray !== next.dashArray
  ) {
    return false;
  }
  if (prev.geometry === next.geometry) return true;
  if (!prev.geometry || !next.geometry) return false;
  // If coordinates length matches and endpoints match, treat as unchanged
  const prevCoords = prev.geometry?.coordinates || prev.geometry;
  const nextCoords = next.geometry?.coordinates || next.geometry;
  if (!Array.isArray(prevCoords) || !Array.isArray(nextCoords)) return false;
  if (prevCoords.length !== nextCoords.length) return false;
  if (prevCoords.length === 0) return true;
  return (
    prevCoords[0][0] === nextCoords[0][0] &&
    prevCoords[0][1] === nextCoords[0][1] &&
    prevCoords[prevCoords.length - 1][0] === nextCoords[nextCoords.length - 1][0] &&
    prevCoords[prevCoords.length - 1][1] === nextCoords[nextCoords.length - 1][1]
  );
});
