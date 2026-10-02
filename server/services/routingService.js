import { ENV } from '../config/env.js';

/**
 * Routing Service (Provider Abstraction)
 *
 * Implements road routing using OSRM (Open Source Routing Machine).
 * Complies with strict architectural standards:
 * - Centralized backend proxy (never called directly from browser)
 * - Custom User-Agent (BookDriverAnna/1.0)
 * - Configurable base URL (ENV.OSRM_BASE_URL)
 * - Strict coordinate validation (-90..90 lat, -180..180 lng)
 * - Same-location handling without unnecessary external calls
 * - Finite request timeout via AbortController (6s)
 * - Bounded TTL in-memory cache
 * - Normalization to application model and GeoJSON LineString geometry
 */
export class RoutingService {
  constructor({
    fetchFn = fetch,
    timeoutMs = (process.env.ROUTING_TIMEOUT_MS ? parseInt(process.env.ROUTING_TIMEOUT_MS, 10) : 12000),
    cacheTtlMs = 15 * 60 * 1000, // 15 minutes
    maxCacheSize = 500,
    baseUrl = (ENV.OSRM_BASE_URL || 'https://router.project-osrm.org').replace(/\/+$/, ''),
    userAgent = 'BookDriverAnna/1.0 (contact@bookdriveranna.com)'
  } = {}) {
    this.fetchFn = fetchFn;
    this.timeoutMs = timeoutMs;
    this.cacheTtlMs = cacheTtlMs;
    this.maxCacheSize = maxCacheSize;
    this.baseUrl = baseUrl;
    this.userAgent = userAgent;
    this.cache = new Map();
  }

  /**
   * Validate and parse coordinate inputs
   */
  validateCoordinates(lat, lng, name = 'Coordinate') {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (
      isNaN(parsedLat) || isNaN(parsedLng) ||
      !isFinite(parsedLat) || !isFinite(parsedLng)
    ) {
      const err = new Error(`${name} must contain valid numeric latitude and longitude values.`);
      err.code = 'INVALID_COORDINATES';
      err.status = 400;
      throw err;
    }

    if (parsedLat < -90 || parsedLat > 90) {
      const err = new Error(`${name} latitude must be between -90 and 90 degrees.`);
      err.code = 'INVALID_COORDINATES';
      err.status = 400;
      throw err;
    }

    if (parsedLng < -180 || parsedLng > 180) {
      const err = new Error(`${name} longitude must be between -180 and 180 degrees.`);
      err.code = 'INVALID_COORDINATES';
      err.status = 400;
      throw err;
    }

    return { lat: parsedLat, lng: parsedLng };
  }

  /**
   * Build normalized coordinate cache key
   */
  getCacheKey(pLat, pLng, dLat, dLng) {
    return `${pLat.toFixed(5)},${pLng.toFixed(5)}->${dLat.toFixed(5)},${dLng.toFixed(5)}`;
  }

  /**
   * Retrieve cached route data if valid and not expired
   */
  getFromCache(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.route;
  }

  /**
   * Store verified route into bounded in-memory cache
   */
  setInCache(key, route) {
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      timestamp: Date.now(),
      route
    });
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Fetch and normalize driving route from OSRM
   */
  async getRoute({ pickupLat, pickupLng, destLat, destLng }) {
    const pickup = this.validateCoordinates(pickupLat, pickupLng, 'Pickup');
    const dest = this.validateCoordinates(destLat, destLng, 'Destination');

    // 1. Same-location handling: if locations are identical within ~10 meters
    const latDiff = Math.abs(pickup.lat - dest.lat);
    const lngDiff = Math.abs(pickup.lng - dest.lng);
    if (latDiff < 0.0001 && lngDiff < 0.0001) {
      return {
        distanceMeters: 0,
        distanceKm: 0,
        durationSeconds: 0,
        durationMinutes: 0,
        geometry: {
          type: 'LineString',
          coordinates: [
            [pickup.lng, pickup.lat],
            [dest.lng, dest.lat]
          ]
        },
        fromCache: false
      };
    }

    // 2. Check in-memory bounded cache
    const cacheKey = this.getCacheKey(pickup.lat, pickup.lng, dest.lat, dest.lng);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    // 3. Construct OSRM driving route URL: {lng},{lat};{lng},{lat}
    const routeUrl = `${this.baseUrl}/route/v1/driving/${pickup.lng},${pickup.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;

    // 4. Dispatch request with finite AbortController timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response;
    try {
      response = await this.fetchFn(routeUrl, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
    } catch (networkErr) {
      clearTimeout(timeoutId);
      if (networkErr.name === 'AbortError') {
        const err = new Error('Routing request timed out. Please try again.');
        err.code = 'PROVIDER_TIMEOUT';
        err.status = 504;
        throw err;
      }
      const err = new Error('Failed to reach routing provider.');
      err.code = 'PROVIDER_NETWORK_ERROR';
      err.status = 502;
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    // 5. Handle provider HTTP status codes
    if (response.status === 429) {
      const err = new Error('Routing service temporarily unavailable. Please try again shortly.');
      err.code = 'PROVIDER_RATE_LIMITED';
      err.status = 429;
      throw err;
    }

    if (response.status >= 500) {
      const err = new Error('Routing service is currently unavailable. Please try again later.');
      err.code = 'PROVIDER_UNAVAILABLE';
      err.status = 503;
      throw err;
    }

    if (!response.ok) {
      const err = new Error(`Routing provider responded with status ${response.status}.`);
      err.code = 'PROVIDER_ERROR';
      err.status = response.status;
      throw err;
    }

    // 6. Parse and validate provider JSON payload
    let rawData;
    try {
      rawData = await response.json();
    } catch (parseErr) {
      const err = new Error('Routing provider returned malformed response.');
      err.code = 'PROVIDER_MALFORMED_RESPONSE';
      err.status = 502;
      throw err;
    }

    if (!rawData || typeof rawData !== 'object') {
      const err = new Error('Malformed response from routing provider.');
      err.code = 'PROVIDER_MALFORMED_RESPONSE';
      err.status = 502;
      throw err;
    }

    if (rawData.code === 'NoRoute') {
      const err = new Error('No road route could be found between these locations.');
      err.code = 'NO_ROUTE_FOUND';
      err.status = 404;
      throw err;
    }

    if (rawData.code !== 'Ok' || !Array.isArray(rawData.routes) || rawData.routes.length === 0) {
      const err = new Error(rawData.message || 'Unable to calculate a valid road route.');
      err.code = 'ROUTING_FAILED';
      err.status = 400;
      throw err;
    }

    const firstRoute = rawData.routes[0];
    if (
      !firstRoute ||
      typeof firstRoute.distance !== 'number' ||
      typeof firstRoute.duration !== 'number' ||
      !firstRoute.geometry ||
      firstRoute.geometry.type !== 'LineString' ||
      !Array.isArray(firstRoute.geometry.coordinates) ||
      firstRoute.geometry.coordinates.length < 2
    ) {
      const err = new Error('Routing provider returned invalid route geometry or metrics.');
      err.code = 'PROVIDER_MALFORMED_RESPONSE';
      err.status = 502;
      throw err;
    }

    // 7. Normalize into clean, stable application model
    const normalized = {
      distanceMeters: Math.round(firstRoute.distance),
      distanceKm: Number((firstRoute.distance / 1000).toFixed(2)),
      durationSeconds: Math.round(firstRoute.duration),
      durationMinutes: Math.max(1, Math.round(firstRoute.duration / 60)),
      geometry: {
        type: 'LineString',
        coordinates: firstRoute.geometry.coordinates
      }
    };

    // 8. Store in cache
    this.setInCache(cacheKey, normalized);

    return { ...normalized, fromCache: false };
  }
}

export const routingService = new RoutingService();
