/**
 * Geocoding Service (Provider Abstraction)
 *
 * Implements centralized location search using OpenStreetMap Nominatim.
 * Complies with strict usage policies:
 * - Centralized backend proxy (never called directly from browser)
 * - Descriptive custom User-Agent (BookDriverAnna/1.0)
 * - Request rate limit protection & bounded TTL cache
 * - Finite request timeout via AbortController (6s)
 * - Normalization and strict response validation
 * - Isolated provider interface (swappable without rewriting application)
 */

// Geographic bounding box for South India: <minLon>,<maxLat>,<maxLon>,<minLat>
// Spans Arabian Sea (~73.5°E) to Bay of Bengal (~84.5°E), and Northern Telangana/Andhra (~19.5°N) down to Kanyakumari (~8.0°N)
export const SOUTH_INDIA_VIEWBOX = '73.5,19.5,84.5,8.0';

export const SOUTH_INDIA_STATES = [
  'tamil nadu',
  'kerala',
  'karnataka',
  'andhra pradesh',
  'telangana',
  'puducherry',
  'pondicherry'
];

/**
 * Format Indian address cleanly preserving locality, city, district, state, and PIN code.
 * Falls back safely to display_name when address details are unavailable or for non-Indian addresses.
 */
export function formatCleanAddress(item) {
  if (!item || !item.address || typeof item.address !== 'object') {
    return String(item?.display_name || '').trim();
  }

  const addr = item.address;
  const isIndia = (
    addr.country_code?.toLowerCase() === 'in' ||
    addr.country?.toLowerCase() === 'india' ||
    String(item.display_name || '').toLowerCase().endsWith('india')
  );

  if (!isIndia) {
    return String(item.display_name || '').trim();
  }

  const locality = addr.road || addr.suburb || addr.neighbourhood || addr.residential || addr.subdivision || addr.village;
  const city = addr.city || addr.town || addr.municipality || addr.city_district;
  const district = addr.state_district || addr.district || addr.county;
  const state = addr.state;
  const postcode = addr.postcode;

  const parts = [];
  if (locality) parts.push(locality);
  if (city && !parts.includes(city)) parts.push(city);
  if (district && !parts.includes(district) && district !== city) parts.push(district);
  if (state && !parts.includes(state)) parts.push(state);

  let formatted = parts.join(', ');
  if (postcode) {
    formatted += (formatted ? ` - ${postcode}` : postcode);
  }
  formatted += (formatted ? ', India' : 'India');

  return formatted || String(item.display_name || '').trim();
}

export class GeocodingService {
  constructor({
    fetchFn = fetch,
    timeoutMs = 6000,
    cacheTtlMs = 10 * 60 * 1000, // 10 minutes
    maxCacheSize = 500,
    userAgent = 'BookDriverAnna/1.0 (contact@bookdriveranna.com)'
  } = {}) {
    this.fetchFn = fetchFn;
    this.timeoutMs = timeoutMs;
    this.cacheTtlMs = cacheTtlMs;
    this.maxCacheSize = maxCacheSize;
    this.userAgent = userAgent;
    this.cache = new Map();
  }

  /**
   * Normalize search query for cache key consistency
   */
  normalizeQuery(query) {
    if (!query || typeof query !== 'string') return '';
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Retrieve cached search results if valid and not expired
   */
  getFromCache(normalizedQuery) {
    const entry = this.cache.get(normalizedQuery);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.cacheTtlMs) {
      this.cache.delete(normalizedQuery);
      return null;
    }

    return entry.results;
  }

  /**
   * Store verified search results into bounded in-memory cache
   */
  setInCache(normalizedQuery, results) {
    // Evict oldest entry if maximum cache size reached
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(normalizedQuery, {
      timestamp: Date.now(),
      results
    });
  }

  /**
   * Clear cache (useful for testing or cache resets)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Validate and normalize external Nominatim search response
   */
  normalizeResults(rawResults) {
    if (!Array.isArray(rawResults)) {
      return [];
    }

    const normalized = [];
    for (const item of rawResults) {
      if (!item || typeof item !== 'object') continue;

      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      const displayName = String(item.display_name || '').trim();

      // Enforce strict coordinate boundaries and non-empty display name
      if (
        !isNaN(lat) &&
        !isNaN(lon) &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180 &&
        displayName.length > 0
      ) {
        const cleanDisplayName = formatCleanAddress(item);
        normalized.push({
          id: String(item.place_id || `${lat},${lon}`),
          displayName: cleanDisplayName || displayName,
          latitude: lat,
          longitude: lon,
          type: item.type || item.class || 'location'
        });
      }
    }

    return normalized;
  }

  /**
   * Execute location search with validation, cache check, and Nominatim dispatch
   */
  async search(query, { limit = 5 } = {}) {
    const rawQuery = String(query || '').trim();
    if (!rawQuery || rawQuery.length < 2) {
      const err = new Error('Search query must be at least 2 characters long.');
      err.code = 'INVALID_QUERY';
      err.status = 400;
      throw err;
    }

    if (rawQuery.length > 200) {
      const err = new Error('Search query exceeds maximum allowed length of 200 characters.');
      err.code = 'QUERY_TOO_LONG';
      err.status = 400;
      throw err;
    }

    const normalizedKey = this.normalizeQuery(rawQuery);

    // 1. Check in-memory bounded cache
    const cachedResults = this.getFromCache(normalizedKey);
    if (cachedResults) {
      return { results: cachedResults, fromCache: true };
    }

    // 2. Prepare Nominatim request URL
    const searchUrl = new URL('https://nominatim.openstreetmap.org/search');
    searchUrl.searchParams.set('q', rawQuery);
    searchUrl.searchParams.set('format', 'jsonv2');
    searchUrl.searchParams.set('limit', String(Math.min(limit, 10)));
    searchUrl.searchParams.set('addressdetails', '1');
    // India First, South India Priority: bias results toward South India without hard-restricting international matches
    searchUrl.searchParams.set('viewbox', SOUTH_INDIA_VIEWBOX);
    searchUrl.searchParams.set('bounded', '0');

    // 3. Dispatch request with finite AbortController timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response;
    try {
      response = await this.fetchFn(searchUrl.toString(), {
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
        const err = new Error('Location search request timed out. Please try again.');
        err.code = 'PROVIDER_TIMEOUT';
        err.status = 504;
        throw err;
      }
      const err = new Error('Failed to reach location search provider.');
      err.code = 'PROVIDER_NETWORK_ERROR';
      err.status = 502;
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    // 4. Handle provider HTTP status codes
    if (response.status === 429) {
      const err = new Error('Location search temporarily unavailable. Please try again shortly.');
      err.code = 'PROVIDER_RATE_LIMITED';
      err.status = 429;
      throw err;
    }

    if (response.status >= 500) {
      const err = new Error('Location search service is currently unavailable. Please try again later.');
      err.code = 'PROVIDER_UNAVAILABLE';
      err.status = 503;
      throw err;
    }

    if (!response.ok) {
      const err = new Error(`Location provider responded with error status ${response.status}.`);
      err.code = 'PROVIDER_ERROR';
      err.status = response.status;
      throw err;
    }

    // 5. Parse and normalize provider response
    let rawData;
    try {
      rawData = await response.json();
    } catch (parseErr) {
      const err = new Error('Location search provider returned malformed response.');
      err.code = 'PROVIDER_MALFORMED_RESPONSE';
      err.status = 502;
      throw err;
    }

    const normalizedResults = this.normalizeResults(rawData);

    // 6. Store valid results in cache
    this.setInCache(normalizedKey, normalizedResults);

    return { results: normalizedResults, fromCache: false };
  }

  /**
   * Execute reverse geocoding from coordinates to structured address
   */
  async reverseGeocode(latitude, longitude) {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      const err = new Error('Invalid coordinates for reverse geocoding.');
      err.code = 'INVALID_COORDINATES';
      err.status = 400;
      throw err;
    }

    const cacheKey = `rev:${lat.toFixed(5)},${lon.toFixed(5)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return { result: cached, fromCache: true };
    }

    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response;
    try {
      response = await this.fetchFn(url.toString(), {
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
        const err = new Error('Reverse geocoding request timed out.');
        err.code = 'PROVIDER_TIMEOUT';
        err.status = 504;
        throw err;
      }
      const err = new Error('Failed to reach reverse geocoding provider.');
      err.code = 'PROVIDER_NETWORK_ERROR';
      err.status = 502;
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 429) {
      const err = new Error('Location lookup temporarily rate limited.');
      err.code = 'PROVIDER_RATE_LIMITED';
      err.status = 429;
      throw err;
    }

    if (response.status >= 500) {
      const err = new Error('Location lookup service unavailable.');
      err.code = 'PROVIDER_UNAVAILABLE';
      err.status = 503;
      throw err;
    }

    if (!response.ok) {
      const err = new Error(`Location lookup failed with status ${response.status}.`);
      err.code = 'PROVIDER_ERROR';
      err.status = response.status;
      throw err;
    }

    let rawData;
    try {
      rawData = await response.json();
    } catch (parseErr) {
      const err = new Error('Reverse geocoding provider returned malformed response.');
      err.code = 'PROVIDER_MALFORMED_RESPONSE';
      err.status = 502;
      throw err;
    }

    const cleanDisplayName = formatCleanAddress(rawData);
    const result = {
      id: String(rawData.place_id || `${lat},${lon}`),
      displayName: cleanDisplayName || String(rawData.display_name || '').trim(),
      latitude: lat,
      longitude: lon,
      type: rawData.type || rawData.class || 'location',
      address: rawData.address || null
    };

    this.setInCache(cacheKey, result);
    return { result, fromCache: false };
  }
}

export const geocodingService = new GeocodingService();
