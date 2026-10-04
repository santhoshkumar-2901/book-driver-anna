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

export const LOCALITY_TYPES = new Set([
  'suburb',
  'neighbourhood',
  'quarter',
  'residential',
  'hamlet',
  'village',
  'town',
  'locality',
  'isolated_dwelling',
  'borough',
  'commercial',
  'industrial'
]);

/**
 * Calculate great-circle distance between two coordinates in kilometers (Haversine formula)
 */
export function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

/**
 * Extract clean primary locality title (e.g. "Pammal") and secondary context (e.g. "Chennai, Tamil Nadu")
 */
export function extractLocalityComponents(item) {
  if (!item || typeof item !== 'object') {
    return { title: '', subtitle: '' };
  }

  const addr = item.address || {};
  let title = item.name || '';

  // Clean Zone / Ward prefixes (e.g. "Zone 13 Adyar" -> "Adyar", "Ward 104 Kondapur" -> "Kondapur")
  if (!title || /^(?:Zone|Ward)\s+\d+/i.test(title)) {
    const rawLocality = addr.suburb || addr.neighbourhood || addr.quarter || addr.village || addr.hamlet || addr.road || item.name || '';
    const match = rawLocality.match(/^(?:Zone|Ward)\s+\d+\s*(?:,\s*)?(.*)$/i);
    title = (match && match[1]) ? match[1].trim() : rawLocality;
  }

  let city = addr.city || addr.town || addr.municipality || addr.city_district || addr.county || addr.state_district || '';
  let state = addr.state || '';
  const countryCode = String(addr.country_code || '').toLowerCase();
  const postcode = addr.postcode || '';
  const displayName = String(item.display_name || '');

  // Resolve metro city context in India
  if (countryCode === 'in' || displayName.toLowerCase().includes('india')) {
    // Chennai metropolitan area (Pincodes 600xxx or Chennai/Chengalpattu/Kanchipuram/Thiruvallur districts)
    if (
      postcode.startsWith('600') ||
      displayName.includes('Chennai') ||
      ['pallavaram', 'tambaram', 'sholinganallur', 'alandur', 'maduravoyal', 'ambattur', 'avadi'].some(sub => city.toLowerCase().includes(sub) || displayName.toLowerCase().includes(sub))
    ) {
      if (title.toLowerCase() !== 'chennai') {
        city = 'Chennai';
      }
    } else if (displayName.includes('Bengaluru') || displayName.includes('Bangalore')) {
      if (title.toLowerCase() !== 'bengaluru') {
        city = 'Bengaluru';
      }
    } else if (displayName.includes('Hyderabad') || displayName.includes('Secunderabad')) {
      if (title.toLowerCase() !== 'hyderabad') {
        city = 'Hyderabad';
      }
    } else if (displayName.includes('Ernakulam') || displayName.includes('Kochi')) {
      if (title.toLowerCase() !== 'kochi') {
        city = 'Kochi';
      }
    } else if (displayName.includes('Coimbatore')) {
      if (title.toLowerCase() !== 'coimbatore') {
        city = 'Coimbatore';
      }
    } else if (displayName.includes('Visakhapatnam')) {
      if (title.toLowerCase() !== 'visakhapatnam') {
        city = 'Visakhapatnam';
      }
    } else if (displayName.includes('Vijayawada')) {
      if (title.toLowerCase() !== 'vijayawada') {
        city = 'Vijayawada';
      }
    }
  }

  const subtitleParts = [];
  if (city && city.toLowerCase() !== title.toLowerCase()) {
    subtitleParts.push(city);
  }
  if (state && state.toLowerCase() !== title.toLowerCase() && !subtitleParts.includes(state)) {
    subtitleParts.push(state);
  }

  const subtitle = subtitleParts.join(', ');
  return {
    title: title || displayName.split(',')[0].trim(),
    subtitle
  };
}

/**
 * Score results with first-class preference for exact and partial small locality matches
 */
export function calculateLocalityScore(item, query, { biasLat, biasLng } = {}) {
  const qLower = String(query || '').toLowerCase().trim();
  const titleLower = String(item.title || item.name || '').toLowerCase().trim();
  const displayNameLower = String(item.display_name || item.displayName || '').toLowerCase().trim();
  const rawType = String(item.rawType || item.type || '').toLowerCase();
  const rawClass = String(item.class || '').toLowerCase();
  const addr = item.address || {};
  const isLocality = LOCALITY_TYPES.has(rawType) || LOCALITY_TYPES.has(rawClass) || Boolean(addr.suburb || addr.neighbourhood || addr.village);

  let score = 0;

  // 1. Text match quality with small area / locality
  if (titleLower === qLower) {
    score += isLocality ? 1200 : 700;
  } else if (titleLower.startsWith(qLower)) {
    score += isLocality ? 800 : 450;
  } else if (titleLower.includes(qLower)) {
    score += isLocality ? 500 : 300;
  } else if (displayNameLower.includes(qLower)) {
    score += isLocality ? 250 : 100;
  }

  // 2. Type preference: small area / locality first-class boost
  if (isLocality) {
    score += 300;
  } else if (rawType === 'city') {
    score += 50;
  } else if (rawType === 'state' || rawType === 'country') {
    score -= 300;
  }

  // 3. Proximity bias if user coordinates or map viewport provided
  const lat = parseFloat(item.latitude ?? item.lat);
  const lon = parseFloat(item.longitude ?? item.lon);
  if (!isNaN(lat) && !isNaN(lon)) {
    if (biasLat !== undefined && biasLat !== null && biasLng !== undefined && biasLng !== null && !isNaN(biasLat) && !isNaN(biasLng)) {
      const dist = getDistanceKm(biasLat, biasLng, lat, lon);
      if (dist < 15) {
        score += 400; // Immediate neighborhood/city
      } else if (dist < 40) {
        score += 250;
      } else if (dist < 120) {
        score += 100;
      }
    }

    // South India regional priority
    const inSouthIndia = (lat >= 8.0 && lat <= 19.5 && lon >= 73.5 && lon <= 85.0);
    const countryCode = String(addr.country_code || '').toLowerCase();
    const isIndia = countryCode === 'in' || displayNameLower.endsWith('india') || displayNameLower.includes(', india');
    if (isIndia && inSouthIndia) {
      score += 150;
    } else if (isIndia) {
      score += 50;
    }
  }

  // 4. Provider importance
  const importance = parseFloat(item.importance) || 0;
  score += importance * 100;

  return score;
}

/**
 * Deduplicate results that represent essentially the same practical locality
 */
export function deduplicateLocalityResults(results) {
  if (!Array.isArray(results) || results.length <= 1) return results;

  const deduplicated = [];
  for (const item of results) {
    const itemTitle = String(item.title || item.displayName.split(',')[0]).toLowerCase().trim();
    const itemSub = String(item.subtitle || '').toLowerCase().trim();

    const isDuplicate = deduplicated.some((existing) => {
      const existingTitle = String(existing.title || existing.displayName.split(',')[0]).toLowerCase().trim();
      const existingSub = String(existing.subtitle || '').toLowerCase().trim();

      // Same title and same subtitle context
      if (itemTitle === existingTitle && itemSub === existingSub) {
        return true;
      }

      // If one title is identical or substring, and locations are within 3km of each other
      const dist = getDistanceKm(existing.latitude, existing.longitude, item.latitude, item.longitude);
      if (dist < 3.0 && (itemTitle === existingTitle || itemTitle.includes(existingTitle) || existingTitle.includes(itemTitle))) {
        return true;
      }

      return false;
    });

    if (!isDuplicate) {
      deduplicated.push(item);
    }
  }

  return deduplicated;
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
   * Validate, rank, format, and deduplicate search results with small area priority
   */
  normalizeResults(rawResults, { query = '', biasLat, biasLng } = {}) {
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
        const { title, subtitle } = extractLocalityComponents(item);

        const record = {
          id: String(item.place_id || `${lat},${lon}`),
          displayName: cleanDisplayName || displayName,
          latitude: lat,
          longitude: lon,
          type: item.type || item.class || 'location'
        };

        // When item has address or name, attach rich locality structure
        if (item.address || item.name) {
          record.title = title || cleanDisplayName.split(',')[0].trim();
          record.subtitle = subtitle || '';
          record.rawType = item.type || null;
          record.address = item.address || null;
        }

        record._score = calculateLocalityScore({ ...item, ...record }, query, { biasLat, biasLng });
        normalized.push(record);
      }
    }

    // Sort by calculated locality score descending
    normalized.sort((a, b) => (b._score || 0) - (a._score || 0));

    // Remove temporary internal score
    const cleaned = normalized.map(({ _score, ...rest }) => rest);

    // Deduplicate nearby and identical practical destinations
    return deduplicateLocalityResults(cleaned);
  }

  /**
   * Execute location search with controlled query strategy (Query A & Query B),
   * viewport / user-location biasing, and locality prioritization.
   */
  async search(query, { limit = 8, biasLat, biasLng, mapContext } = {}) {
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
    const parsedBiasLat = (biasLat !== undefined && biasLat !== null && !isNaN(parseFloat(biasLat))) ? parseFloat(biasLat) : null;
    const parsedBiasLng = (biasLng !== undefined && biasLng !== null && !isNaN(parseFloat(biasLng))) ? parseFloat(biasLng) : null;
    const cleanMapContext = mapContext ? String(mapContext).trim().toLowerCase() : '';

    const cacheKey = (parsedBiasLat !== null || parsedBiasLng !== null || cleanMapContext)
      ? `${normalizedKey}|${parsedBiasLat !== null ? parsedBiasLat.toFixed(2) : ''},${parsedBiasLng !== null ? parsedBiasLng.toFixed(2) : ''}|${cleanMapContext}`
      : normalizedKey;

    // 1. Check in-memory bounded cache
    const cachedResults = this.getFromCache(cacheKey) || this.getFromCache(normalizedKey);
    if (cachedResults) {
      return { results: cachedResults, fromCache: true };
    }

    // 2. Determine viewbox: prefer current viewport/user location bounding box, fallback to South India
    let viewbox = SOUTH_INDIA_VIEWBOX;
    if (parsedBiasLat !== null && parsedBiasLng !== null) {
      const delta = 0.35; // ~38km bounding radius
      viewbox = `${(parsedBiasLng - delta).toFixed(4)},${(parsedBiasLat + delta).toFixed(4)},${(parsedBiasLng + delta).toFixed(4)},${(parsedBiasLat - delta).toFixed(4)}`;
    }

    // Provider query helper
    const queryNominatim = async (searchStr, requestLimit = 10) => {
      const searchUrl = new URL('https://nominatim.openstreetmap.org/search');
      searchUrl.searchParams.set('q', searchStr);
      searchUrl.searchParams.set('format', 'jsonv2');
      searchUrl.searchParams.set('limit', String(requestLimit));
      searchUrl.searchParams.set('addressdetails', '1');
      searchUrl.searchParams.set('viewbox', viewbox);
      searchUrl.searchParams.set('bounded', '0');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchFn(searchUrl.toString(), {
          method: 'GET',
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'application/json'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

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

        return await response.json();
      } catch (networkErr) {
        clearTimeout(timeoutId);
        if (networkErr.name === 'AbortError') {
          const err = new Error('Location search request timed out. Please try again.');
          err.code = 'PROVIDER_TIMEOUT';
          err.status = 504;
          throw err;
        }
        if (networkErr.code) throw networkErr;
        const err = new Error('Failed to reach location search provider.');
        err.code = 'PROVIDER_NETWORK_ERROR';
        err.status = 502;
        throw err;
      }
    };

    // Query A: Primary search with India/South India or viewport biasing
    const rawDataA = await queryNominatim(rawQuery, Math.max(limit, 10));
    let rawResults = Array.isArray(rawDataA) ? [...rawDataA] : [];

    // Query B (Controlled Fallback Strategy): If fewer than 2 results and a known map context (e.g. city) exists
    if (rawResults.length < 2 && cleanMapContext && !rawQuery.toLowerCase().includes(cleanMapContext)) {
      try {
        const contextualQuery = `${rawQuery}, ${cleanMapContext}`;
        const rawDataB = await queryNominatim(contextualQuery, 6);
        if (Array.isArray(rawDataB) && rawDataB.length > 0) {
          const existingIds = new Set(rawResults.map(r => String(r.place_id || `${r.lat},${r.lon}`)));
          for (const item of rawDataB) {
            const id = String(item.place_id || `${item.lat},${item.lon}`);
            if (!existingIds.has(id)) {
              rawResults.push(item);
              existingIds.add(id);
            }
          }
        }
      } catch (fallbackErr) {
        // Query B is a non-blocking enhancement
      }
    }

    const normalizedResults = this.normalizeResults(rawResults, {
      query: rawQuery,
      biasLat: parsedBiasLat,
      biasLng: parsedBiasLng
    }).slice(0, Math.min(limit, 10));

    // Store in cache
    this.setInCache(cacheKey, normalizedResults);

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
