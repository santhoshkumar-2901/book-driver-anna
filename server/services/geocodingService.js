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
        normalized.push({
          id: String(item.place_id || `${lat},${lon}`),
          displayName,
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
}

export const geocodingService = new GeocodingService();
