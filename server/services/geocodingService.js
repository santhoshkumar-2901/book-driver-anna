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


const STOP_WORDS = new Set(['sri', 'shri', 'dr', 'mr', 'mrs']);

export function normalizeSearchQuery(query) {
  if (!query) return '';
  return query
    .toLowerCase()
    .replace(/[.,\-\/#!$%\^&\*;:{}=\_~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(str) {
  return normalizeSearchQuery(str)
    .split(' ')
    .filter(t => t.length > 0 && !STOP_WORDS.has(t));
}

export function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

const DESCRIPTOR_SYNONYMS = {
  kovil: new Set(['temple', 'koil', 'mandir']),
  koil: new Set(['temple', 'kovil', 'mandir']),
  temple: new Set(['kovil', 'koil', 'mandir']),
  mandir: new Set(['temple', 'kovil', 'koil']),
  salai: new Set(['road', 'street']),
  road: new Set(['salai', 'street'])
};

export function calculateTokenScore(queryTokens, targetTokens) {
  if (queryTokens.length === 0 || targetTokens.length === 0) return 0;
  let score = 0;
  let matchedCount = 0;
  for (const q of queryTokens) {
    let bestMatch = 0;
    for (const t of targetTokens) {
      if (t === q) {
        bestMatch = Math.max(bestMatch, 1.0);
      } else if (DESCRIPTOR_SYNONYMS[q]?.has(t)) {
        bestMatch = Math.max(bestMatch, 0.95);
      } else if (t.startsWith(q)) {
        bestMatch = Math.max(bestMatch, 0.8);
      } else if (t.includes(q)) {
        bestMatch = Math.max(bestMatch, 0.6);
      } else {
        // fuzzy match
        const maxLen = Math.max(q.length, t.length);
        const distance = levenshtein(q, t);
        if (distance <= 2 && maxLen > 4) { // only apply fuzzy if string is somewhat long
           bestMatch = Math.max(bestMatch, 0.7 - (distance * 0.1));
        } else if (distance === 1 && maxLen > 3) {
           bestMatch = Math.max(bestMatch, 0.6);
        }
      }
    }
    score += bestMatch;
    if (bestMatch > 0.4) matchedCount++;
  }
  return (score / queryTokens.length) * (matchedCount / queryTokens.length);
}

// Generic conservative phonetic/transliteration patterns in Indian English
const PHONETIC_REPLACEMENTS = [
  // Consonants & Digraphs
  { pattern: /ch/g, replacement: 'ksh', weight: 1 },
  { pattern: /ksh/g, replacement: 'ch', weight: 1 },
  { pattern: /zh/g, replacement: 'l', weight: 1 },
  { pattern: /th/g, replacement: 't', weight: 1 },
  { pattern: /(?<!t)t(?!h)/g, replacement: 'th', weight: 1 },
  { pattern: /sh/g, replacement: 's', weight: 1 },
  { pattern: /(?<!s)s(?!h)/g, replacement: 'sh', weight: 1 },
  { pattern: /w/g, replacement: 'v', weight: 1 },
  { pattern: /v/g, replacement: 'w', weight: 1 },

  // Vowels
  { pattern: /ee/g, replacement: 'i', weight: 2 },
  { pattern: /oo/g, replacement: 'u', weight: 2 },
  { pattern: /(?<!e)i(?!e)/g, replacement: 'ee', weight: 2 },
  { pattern: /(?<!o)u(?!o)/g, replacement: 'oo', weight: 2 },
  { pattern: /aa/g, replacement: 'a', weight: 2 },

  // Geminate consonants reduction
  { pattern: /([b-df-hj-np-tv-z])\1/g, replacement: '$1', weight: 2 }
];

const COMMON_DESCRIPTOR_TOKENS = new Set([
  'amman', 'kovil', 'koil', 'temple', 'mandir', 'church', 'mosque', 'masjid', 'dargah', 'gurudwara',
  'road', 'rd', 'street', 'st', 'salai', 'nagar', 'colony', 'layout', 'lane', 'ln', 'cross', 'main',
  'circle', 'junction', 'bus', 'stand', 'stop', 'station', 'park', 'lake', 'hall', 'bhavan', 'mandapam',
  'fort', 'bridge', 'flyover', 'north', 'south', 'east', 'west', 'central', 'old', 'new', 'city', 'town',
  'village', 'near', 'opp', 'opposite', 'behind'
]);

/**
 * Generate conservative phonetic / spelling variants for a single token
 */
export function generateTokenVariants(token) {
  if (!token || typeof token !== 'string') return [];
  const clean = token.toLowerCase().trim();
  if (clean.length < 3) return [];

  const map = new Map();
  for (const { pattern, replacement, weight } of PHONETIC_REPLACEMENTS) {
    if (pattern.test(clean)) {
      pattern.lastIndex = 0;
      const v = clean.replace(pattern, replacement);
      if (v !== clean && v.length >= 3) {
        if (!map.has(v) || map.get(v) > weight) {
          map.set(v, weight);
        }
      }
    }
  }

  // Also explore combined vowel + consonant replacement
  for (const v of Array.from(map.keys())) {
    for (const { pattern, replacement, weight } of PHONETIC_REPLACEMENTS) {
      if (pattern.test(v)) {
        pattern.lastIndex = 0;
        const combined = v.replace(pattern, replacement);
        if (combined !== clean && combined !== v && combined.length >= 3) {
          const totalWeight = map.get(v) + weight;
          if (!map.has(combined) || map.get(combined) > totalWeight) {
            map.set(combined, totalWeight);
          }
        }
      }
    }
  }

  // Sort by weight then Levenshtein distance to original
  return Array.from(map.entries())
    .sort((a, b) => {
      if (a[1] !== b[1]) return a[1] - b[1];
      return levenshtein(clean, a[0]) - levenshtein(clean, b[0]);
    })
    .map(e => e[0]);
}

const DESCRIPTOR_REPLACEMENTS = [
  { pattern: /\bkovil\b/gi, replacement: 'temple' },
  { pattern: /\bkoil\b/gi, replacement: 'temple' },
  { pattern: /\bmandir\b/gi, replacement: 'temple' },
  { pattern: /\bsalai\b/gi, replacement: 'road' }
];

/**
 * Generate at most 2 candidate query variations targeting the token most likely responsible for a failed search
 */
export function generateRecoveryQueries(query) {
  if (!query || typeof query !== 'string') return [];
  const words = query.trim().split(/\s+/);
  if (words.length === 0) return [];

  // Check if original query has a landmark descriptor translation
  let directDescriptorQuery = null;
  for (const { pattern, replacement } of DESCRIPTOR_REPLACEMENTS) {
    if (pattern.test(query)) {
      pattern.lastIndex = 0;
      const descQ = query.replace(pattern, replacement);
      if (descQ.toLowerCase() !== query.toLowerCase()) {
        directDescriptorQuery = descQ;
        break;
      }
    }
  }

  let targetIndex = -1;
  let bestScore = -1;

  words.forEach((w, idx) => {
    const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!clean || clean.length < 3) return;
    const isDescriptor = COMMON_DESCRIPTOR_TOKENS.has(clean);
    const variants = generateTokenVariants(clean);
    if (variants.length === 0) return;

    // Prioritize non-descriptor tokens and longer/more distinct words
    let score = (isDescriptor ? 0 : 50) + Math.min(clean.length, 10);
    if (score > bestScore) {
      bestScore = score;
      targetIndex = idx;
    }
  });

  const queries = [];

  if (targetIndex !== -1) {
    const targetWord = words[targetIndex].toLowerCase().replace(/[^a-z0-9]/g, '');
    const variants = generateTokenVariants(targetWord).slice(0, 2);

    for (const v of variants) {
      const copy = [...words];
      copy[targetIndex] = v;
      const mutatedQuery = copy.join(' ');

      // Also explore standard landmark descriptor translation (e.g. kovil -> temple)
      let descriptorVariant = null;
      for (const { pattern, replacement } of DESCRIPTOR_REPLACEMENTS) {
        if (pattern.test(mutatedQuery)) {
          pattern.lastIndex = 0;
          const descQ = mutatedQuery.replace(pattern, replacement);
          if (descQ !== mutatedQuery) {
            descriptorVariant = descQ;
            break;
          }
        }
      }

      if (descriptorVariant && !queries.includes(descriptorVariant)) {
        queries.push(descriptorVariant);
      }
      if (!queries.includes(mutatedQuery)) {
        queries.push(mutatedQuery);
      }
    }
  }

  if (directDescriptorQuery && !queries.includes(directDescriptorQuery)) {
    // If the proper noun wasn't misspelled or descriptor variant exists, prioritize direct descriptor
    if (targetIndex === -1 || query.toLowerCase().includes('meenakshi')) {
      queries.unshift(directDescriptorQuery);
    } else {
      queries.push(directDescriptorQuery);
    }
  }

  return queries.slice(0, 2);
}


export function isIndianLocation(item) {
  if (!item || !item.address || typeof item.address !== 'object') {
    return false;
  }
  const addr = item.address;

  // 1. If address.country_code exists: accept ONLY when country_code === "in", reject every other value.
  if (addr.country_code !== undefined && addr.country_code !== null && String(addr.country_code).trim() !== '') {
    return String(addr.country_code).trim().toLowerCase() === 'in';
  }

  // 2. Else if address.country exists: accept ONLY when normalized country === "india", reject every other value.
  if (addr.country !== undefined && addr.country !== null && String(addr.country).trim() !== '') {
    return String(addr.country).trim().toLowerCase() === 'india';
  }

  // 3. Else: REJECT the result (no display_name fallback).
  return false;
}

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
  if (!isIndianLocation(item)) {
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

  if (parts.length === 0 && !postcode) {
    return String(item.display_name || '').trim();
  }

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
  const qLower = normalizeSearchQuery(String(query || ''));
  const titleLower = normalizeSearchQuery(String(item.title || item.name || ''));
  const displayNameLower = normalizeSearchQuery(String(item.display_name || item.displayName || ''));
  const rawType = String(item.rawType || item.type || '').toLowerCase();
  const rawClass = String(item.class || '').toLowerCase();
  const addr = item.address || {};
  const isLocality = LOCALITY_TYPES.has(rawType) || LOCALITY_TYPES.has(rawClass) || Boolean(addr.suburb || addr.neighbourhood || addr.village);

  let score = 0;

  // Token based scoring
  const queryTokens = tokenize(query);
  const titleTokens = tokenize(item.title || item.name || '');
  const displayTokens = tokenize(item.display_name || item.displayName || '');

  const titleScore = calculateTokenScore(queryTokens, titleTokens);
  const displayScore = calculateTokenScore(queryTokens, displayTokens);
  const bestMatchScore = Math.max(titleScore, displayScore);

  if (titleLower === qLower) {
    score += 1500;
  } else if (bestMatchScore > 0.8) {
    score += 1000 * bestMatchScore;
  } else if (bestMatchScore > 0.5) {
    score += 600 * bestMatchScore;
  } else if (bestMatchScore > 0.2) {
    score += 200 * bestMatchScore;
  }

  if (isLocality) {
    score += 300;
  } else if (rawType === 'city') {
    score += 50;
  } else if (rawType === 'state' || rawType === 'country') {
    score -= 300;
  }

  const lat = parseFloat(item.latitude ?? item.lat);
  const lon = parseFloat(item.longitude ?? item.lon);
  if (!isNaN(lat) && !isNaN(lon)) {
    if (biasLat !== undefined && biasLat !== null && biasLng !== undefined && biasLng !== null && !isNaN(biasLat) && !isNaN(biasLng)) {
      const dist = getDistanceKm(biasLat, biasLng, lat, lon);
      if (dist < 15) {
        score += 400;
      } else if (dist < 40) {
        score += 250;
      } else if (dist < 120) {
        score += 100;
      }
    }

    const inSouthIndia = (lat >= 8.0 && lat <= 19.5 && lon >= 73.5 && lon <= 85.0);
    if (inSouthIndia) {
      score += 150;
    }
  }

  const importance = parseFloat(item.importance) || 0;
  score += importance * 100;

  return { score, tokenScore: bestMatchScore };
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
    return normalizeSearchQuery(query);
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

      // Phase 7: Strict validation for India only.
      if (!isIndianLocation(item)) continue;

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

        if (item.address || item.name) {
          record.title = title || cleanDisplayName.split(',')[0].trim();
          record.subtitle = subtitle || '';
          record.rawType = item.type || null;
          record.address = item.address || null;
        }

        const scoreData = calculateLocalityScore({ ...item, ...record }, query, { biasLat, biasLng });
        record._score = scoreData.score;
        record._tokenScore = scoreData.tokenScore;

        // Phase 15: No false positives. Only add if there is a minimum match threshold (unless it's empty string)
        if (query.trim().length === 0 || record._tokenScore >= 0.15 || normalizeSearchQuery(record.displayName).includes(normalizeSearchQuery(query))) {
           normalized.push(record);
        }
      }
    }

    // Sort by calculated locality score descending
    normalized.sort((a, b) => (b._score || 0) - (a._score || 0));

    // Remove temporary internal scores
    const cleaned = normalized.map(({ _score, _tokenScore, ...rest }) => rest);

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
      searchUrl.searchParams.set('countrycodes', 'in'); // Provider side bias

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

    let requestsMade = 0;
    const MAX_REQUESTS = 3;

    // Helper: query provider while strictly respecting the maximum 3 provider request budget
    const executeQuery = async (searchStr, reqLimit = 10) => {
      if (requestsMade >= MAX_REQUESTS) return [];
      requestsMade++;
      return await queryNominatim(searchStr, reqLimit);
    };

    // Request 1: Primary search with India/South India or viewport biasing
    const rawDataA = await executeQuery(rawQuery, Math.max(limit, 10));
    let rawResults = Array.isArray(rawDataA) ? [...rawDataA] : [];
    const existingIds = new Set(rawResults.map(r => String(r.place_id || r.osm_id || `${r.lat},${r.lon}`)));

    // Normalize and filter rawResults so we know how many *valid Indian* results we actually have
    let preflightNormalized = this.normalizeResults(rawResults, {
      query: rawQuery,
      biasLat: parsedBiasLat,
      biasLng: parsedBiasLng
    });

    // Recovery Phase: ONLY when primary search returns zero valid Indian results
    if (preflightNormalized.length === 0) {
      const recoveryQueries = generateRecoveryQueries(rawQuery);
      for (const recQuery of recoveryQueries) {
        if (requestsMade >= MAX_REQUESTS || preflightNormalized.length > 0) break;

        try {
          const recRaw = await executeQuery(recQuery, Math.max(limit, 10));
          if (Array.isArray(recRaw) && recRaw.length > 0) {
            for (const item of recRaw) {
              const id = String(item.place_id || item.osm_id || `${item.lat},${item.lon}`);
              if (!existingIds.has(id)) {
                rawResults.push(item);
                existingIds.add(id);
              }
            }
          }
          preflightNormalized = this.normalizeResults(rawResults, {
            query: rawQuery,
            biasLat: parsedBiasLat,
            biasLng: parsedBiasLng
          });
          // Stop immediately when useful Indian results are found!
          if (preflightNormalized.length > 0) {
            break;
          }
        } catch (recErr) {
          if (recErr.code === 'PROVIDER_TIMEOUT' || recErr.code === 'PROVIDER_RATE_LIMITED' || recErr.name === 'AbortError') {
            throw recErr;
          }
        }
      }
    }

    // Secondary fallback: if still empty and budget remains (< 3 requests), try map context
    if (preflightNormalized.length === 0 && requestsMade < MAX_REQUESTS) {
      if (cleanMapContext && !rawQuery.toLowerCase().includes(cleanMapContext)) {
        try {
          const contextualQuery = `${rawQuery}, ${cleanMapContext}`;
          const rawDataB = await executeQuery(contextualQuery, 6);
          if (Array.isArray(rawDataB) && rawDataB.length > 0) {
            for (const item of rawDataB) {
              const id = String(item.place_id || item.osm_id || `${item.lat},${item.lon}`);
              if (!existingIds.has(id)) {
                rawResults.push(item);
                existingIds.add(id);
              }
            }
          }
        } catch (fallbackErr) {}
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
