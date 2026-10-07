import { isTiDB, queryOne, queryAll, execute, withTransaction } from '../db/database.js';
import { logAuditEvent } from './auditService.js';

/**
 * Server-Side Authoritative Pricing Calculation Engine & Admin Pricing Management
 * 
 * NEVER TRUST client-sent prices. Every booking fare is calculated
 * and validated authoritatively by this service using live database tariffs.
 */

export const DEFAULT_PRICING = [
  // 1. DRIVER SERVICES
  {
    id: 'driver_hourly_2hr',
    category: 'driver',
    name: 'In-City Hourly Driver (2 Hours)',
    price: 199,
    unit: '/ 2 hrs',
    description: 'Minimum 2-hour in-city acting driver package'
  },
  {
    id: 'driver_hourly_4hr',
    category: 'driver',
    name: 'In-City Hourly Driver (4 Hours)',
    price: 349,
    unit: '/ 4 hrs',
    description: '4-hour city errand, shopping & commute package'
  },
  {
    id: 'driver_hourly_6hr',
    category: 'driver',
    name: 'In-City Hourly Driver (6 Hours)',
    price: 499,
    unit: '/ 6 hrs',
    description: '6-hour flexible city travel and business commute package'
  },
  {
    id: 'driver_hourly_8hr',
    category: 'driver',
    name: 'In-City Hourly Driver (8 Hours)',
    price: 599,
    unit: '/ 8 hrs',
    description: '8-hour full day in-city driver package'
  },
  {
    id: 'driver_hourly_12hr',
    category: 'driver',
    name: 'In-City Hourly Driver (12 Hours)',
    price: 899,
    unit: '/ 12 hrs',
    description: '12-hour extended city driving package'
  },
  {
    id: 'driver_base_fare',
    category: 'driver',
    name: 'Base Fare',
    price: 100,
    unit: 'booking',
    description: 'Base starting fare for distance rides'
  },
  {
    id: 'driver_price_per_km',
    category: 'driver',
    name: 'Price Per KM',
    price: 15,
    unit: 'km',
    description: 'Distance rate per kilometer for driver services'
  },
  {
    id: 'driver_min_fare',
    category: 'driver',
    name: 'Minimum Fare',
    price: 150,
    unit: 'booking',
    description: 'Minimum charge for distance rides'
  },
  {
    id: 'driver_one_way_city',
    category: 'driver',
    name: 'One-Way City Drop',
    price: 299,
    unit: 'flat',
    description: 'Point A to Point B drop across Bangalore'
  },
  {
    id: 'driver_airport_drop',
    category: 'driver',
    name: 'Kempegowda Airport (BLR T1/T2) Drop',
    price: 899,
    unit: 'flat',
    description: 'Dedicated airport drop with zero return fare'
  },
  {
    id: 'driver_night_party',
    category: 'driver',
    name: 'Night Party Driver',
    price: 399,
    unit: '/ trip',
    description: 'Late-night safe ride home from Indiranagar/Koramangala'
  },
  {
    id: 'driver_outstation_12hr',
    category: 'driver',
    name: 'Outstation Driver (Round Trip 12hr)',
    price: 1199,
    unit: '/ 12 hrs',
    description: 'Day getaway highway driver to Nandi Hills, Mysore, etc.'
  },
  {
    id: 'driver_outstation_24hr',
    category: 'driver',
    name: 'Outstation Driver (Round Trip 24hr)',
    price: 1999,
    unit: '/ day',
    description: 'Weekend road trip driver package'
  },
  {
    id: 'driver_outstation_46hr',
    category: 'driver',
    name: 'Outstation Driver (Round Trip 46hr)',
    price: 3899,
    unit: '/ 46 hrs',
    description: 'Multi-day long getaway driver'
  },
  {
    id: 'driver_outstation_72hr',
    category: 'driver',
    name: 'Outstation Driver (Round Trip 72hr)',
    price: 5799,
    unit: '/ 72 hrs',
    description: 'Extended vacation tour driver'
  },
  {
    id: 'driver_outstation_150km',
    category: 'driver',
    name: 'Outstation Driver One-Way (Up to 150 km)',
    price: 1199,
    unit: 'flat',
    description: 'One-way intercity drop up to 150 km'
  },
  {
    id: 'driver_outstation_300km',
    category: 'driver',
    name: 'Outstation Driver One-Way (Up to 300 km)',
    price: 1799,
    unit: 'flat',
    description: 'One-way intercity drop up to 300 km'
  },
  {
    id: 'driver_outstation_500km',
    category: 'driver',
    name: 'Outstation Driver One-Way (Up to 500 km)',
    price: 2399,
    unit: 'flat',
    description: 'One-way intercity drop up to 500 km'
  },
  {
    id: 'driver_monthly',
    category: 'driver',
    name: 'Monthly Corporate Driver',
    price: 18000,
    unit: '/ month',
    description: 'Dedicated full-time driver contract with replacements'
  },

  // 2. FLEET VEHICLE RENTALS
  {
    id: 'vehicle_sedan_daily',
    category: 'vehicle',
    name: 'Sedan (Dzire / Honda City) Daily Rate',
    price: 1999,
    unit: '/ day',
    description: 'Comfortable 4-seater executive sedan with driver'
  },
  {
    id: 'vehicle_sedan_km',
    category: 'vehicle',
    name: 'Sedan Outstation Rate Per Km',
    price: 14,
    unit: '/ km',
    description: 'Outstation per-kilometer distance rate'
  },
  {
    id: 'vehicle_suv_daily',
    category: 'vehicle',
    name: '7-Seater SUV (Innova / Ertiga) Daily Rate',
    price: 3499,
    unit: '/ day',
    description: 'Spacious family 6-7 seater SUV with driver'
  },
  {
    id: 'vehicle_suv_km',
    category: 'vehicle',
    name: 'SUV Outstation Rate Per Km',
    price: 20,
    unit: '/ km',
    description: 'Outstation per-kilometer distance rate'
  },
  {
    id: 'vehicle_tempo_12_daily',
    category: 'vehicle',
    name: '12 Seater Luxury Tempo Daily Rate',
    price: 5499,
    unit: '/ day',
    description: 'Group travel 12-seater luxury tempo traveller'
  },
  {
    id: 'vehicle_tempo_12_km',
    category: 'vehicle',
    name: '12 Seater Outstation Rate Per Km',
    price: 26,
    unit: '/ km',
    description: 'Outstation per-kilometer distance rate'
  },
  {
    id: 'vehicle_bus_24_daily',
    category: 'vehicle',
    name: '24 Seater Executive Mini Bus Daily Rate',
    price: 7999,
    unit: '/ day',
    description: 'Executive 24-seater bus for functions & events'
  },
  {
    id: 'vehicle_bus_24_km',
    category: 'vehicle',
    name: '24 Seater Outstation Rate Per Km',
    price: 34,
    unit: '/ km',
    description: 'Outstation per-kilometer distance rate'
  },
  {
    id: 'vehicle_coach_32_daily',
    category: 'vehicle',
    name: '32 Seater Luxury Coach Daily Rate',
    price: 10999,
    unit: '/ day',
    description: 'VIP 32-seater luxury coach bus with air suspension'
  },
  {
    id: 'vehicle_coach_32_km',
    category: 'vehicle',
    name: '32 Seater Outstation Rate Per Km',
    price: 42,
    unit: '/ km',
    description: 'Outstation per-kilometer distance rate'
  },

  // 3. DRIVING ACADEMY COURSES
  {
    id: 'class_beginner',
    category: 'class',
    name: 'Beginner Comprehensive Course (15 Days)',
    price: 5999,
    unit: 'all-inclusive',
    description: '15-day course from zero experience to full Bangalore confidence'
  },
  {
    id: 'class_refresher',
    category: 'class',
    name: 'City Confidence & Refresher (7 Days)',
    price: 3499,
    unit: 'all-inclusive',
    description: '7-day traffic & peak-hour confidence builder course'
  },
  {
    id: 'class_own_car',
    category: 'class',
    name: 'Learn in Your Own Car (7 Days)',
    price: 2999,
    unit: 'all-inclusive',
    description: 'Doorstep personalized training in your personal vehicle'
  },
  {
    id: 'class_automatic',
    category: 'class',
    name: 'Automatic Car Specialization (7 Days)',
    price: 3999,
    unit: 'all-inclusive',
    description: 'AMT / CVT / DCT dual-pedal specialization course'
  }
];

const DEFAULT_MAP = Object.fromEntries(DEFAULT_PRICING.map(item => [item.id, item]));

/**
 * Ensures the service_pricing table is created and populated with default tariff rows
 */
export async function ensureServicePricing() {
  try {
    if (isTiDB) {
      await execute(`
        CREATE TABLE IF NOT EXISTS service_pricing (
          id VARCHAR(64) NOT NULL PRIMARY KEY,
          category VARCHAR(32) NOT NULL,
          name VARCHAR(255) NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          unit VARCHAR(64) NULL,
          description TEXT NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_pricing_category (category)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } else {
      await execute(`
        CREATE TABLE IF NOT EXISTS service_pricing (
          id TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          name TEXT NOT NULL,
          price REAL NOT NULL,
          unit TEXT,
          description TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
  } catch (schemaErr) {
    console.warn('[PRICING] service_pricing schema initialization note:', schemaErr.message);
  }

  try {
    const existing = await queryAll('SELECT id FROM service_pricing');
    const existingIds = new Set((existing || []).map(r => r.id));

    for (const item of DEFAULT_PRICING) {
      if (!existingIds.has(item.id)) {
        const insertSql = isTiDB
          ? `INSERT IGNORE INTO service_pricing (id, category, name, price, unit, description) VALUES (?, ?, ?, ?, ?, ?)`
          : `INSERT OR IGNORE INTO service_pricing (id, category, name, price, unit, description) VALUES (?, ?, ?, ?, ?, ?)`;
        await execute(
          insertSql,
          [item.id, item.category, item.name, item.price, item.unit, item.description]
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[PRICING] Could not ensure default service pricing:', err.message);
  }
}

/**
 * Retrieves all pricing items from the database as a key-value dictionary and list
 */
export async function getAllPricing() {
  try {
    await ensureServicePricing();
    const rows = await queryAll('SELECT * FROM service_pricing ORDER BY category ASC, id ASC');
    if (!rows || rows.length === 0) {
      return { map: DEFAULT_MAP, list: DEFAULT_PRICING };
    }

    const map = {};
    for (const row of rows) {
      map[row.id] = {
        id: row.id,
        category: row.category,
        name: row.name,
        price: Number(row.price),
        unit: row.unit,
        description: row.description,
        updatedAt: row.updated_at
      };
    }

    // Merge any missing default keys
    for (const [key, defaultItem] of Object.entries(DEFAULT_MAP)) {
      if (!map[key]) {
        map[key] = { ...defaultItem };
      }
    }

    return { map, list: Object.values(map) };
  } catch (err) {
    console.warn('[PRICING] Error fetching pricing from DB, using fallback defaults:', err.message);
    return { map: DEFAULT_MAP, list: DEFAULT_PRICING };
  }
}

/**
 * Updates prices in the database with validation and audit logging
 */
export async function updateServicePricing(updates, userId = null, ipAddress = null) {
  if (!updates || typeof updates !== 'object') {
    throw Object.assign(new Error('Invalid pricing update payload.'), { statusCode: 400 });
  }

  // updates can be an array of { id, price } or an object { [id]: price }
  const itemsToUpdate = Array.isArray(updates)
    ? updates
    : Object.entries(updates).map(([id, val]) => ({
        id,
        price: typeof val === 'object' && val !== null ? val.price : val
      }));

  if (itemsToUpdate.length === 0) {
    throw Object.assign(new Error('No pricing items provided for update.'), { statusCode: 400 });
  }

  for (const item of itemsToUpdate) {
    if (item.price === null || item.price === undefined || item.price === '') {
      throw Object.assign(new Error(`Invalid price for item '${item.id}'. Price must be a finite non-negative number.`), { statusCode: 400 });
    }
    const numPrice = Number(item.price);
    if (!Number.isFinite(numPrice) || numPrice < 0) {
      throw Object.assign(new Error(`Invalid price for item '${item.id}'. Price must be a finite non-negative number.`), { statusCode: 400 });
    }
  }

  await ensureServicePricing();

  await withTransaction(async (tx) => {
    for (const item of itemsToUpdate) {
      const numPrice = Number(item.price);
      await tx.execute(
        `UPDATE service_pricing SET price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [numPrice, item.id]
      );
    }
  });

  if (userId) {
    await logAuditEvent({
      userId,
      action: 'ADMIN_UPDATED_PRICING',
      resourceType: 'pricing',
      resourceId: 'service_pricing',
      details: { updatedCount: itemsToUpdate.length, items: itemsToUpdate },
      ipAddress
    }).catch(() => {});
  }

  return await getAllPricing();
}

/**
 * Resets all pricing to factory defaults
 */
export async function resetServicePricing(userId = null, ipAddress = null) {
  await withTransaction(async (tx) => {
    for (const item of DEFAULT_PRICING) {
      if (isTiDB) {
        await tx.execute(
          `INSERT INTO service_pricing (id, category, name, price, unit, description, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE price = VALUES(price), unit = VALUES(unit), description = VALUES(description), updated_at = CURRENT_TIMESTAMP`,
          [item.id, item.category, item.name, item.price, item.unit, item.description]
        );
      } else {
        await tx.execute(
          `INSERT INTO service_pricing (id, category, name, price, unit, description, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET price = excluded.price, unit = excluded.unit, description = excluded.description, updated_at = CURRENT_TIMESTAMP`,
          [item.id, item.category, item.name, item.price, item.unit, item.description]
        );
      }
    }
  });

  if (userId) {
    await logAuditEvent({
      userId,
      action: 'ADMIN_RESET_PRICING',
      resourceType: 'pricing',
      resourceId: 'service_pricing',
      details: { resetTo: 'defaults' },
      ipAddress
    }).catch(() => {});
  }

  return await getAllPricing();
}

/**
 * Deterministically computes pricing version integer from pricing map state.
 * Returns 1 for default tariffs, and a deterministic positive integer for custom/updated tariffs.
 */
export function getPricingVersion(pricingMap = null) {
  if (!pricingMap || typeof pricingMap !== 'object') {
    return 1;
  }

  // Check if pricingMap matches default pricing
  let isDefault = true;
  for (const item of DEFAULT_PRICING) {
    const current = pricingMap[item.id];
    const currentPrice = typeof current === 'object' && current !== null ? current.price : current;
    if (currentPrice === undefined || Number(currentPrice) !== Number(item.price)) {
      isDefault = false;
      break;
    }
  }
  if (isDefault) return 1;

  // Generate deterministic positive integer version from sorted (id, price) pairs
  const sortedPairs = Object.keys(pricingMap)
    .sort()
    .map(k => {
      const val = pricingMap[k];
      const p = typeof val === 'object' && val !== null ? val.price : val;
      return `${k}:${p}`;
    })
    .join('|');

  let hash = 2166136261;
  for (let i = 0; i < sortedPairs.length; i++) {
    hash ^= sortedPairs.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const versionInt = Math.abs(hash >>> 0);
  return versionInt > 1 ? versionInt : 2;
}

/**
 * Resolves a pricing item from active database records (map or list)
 * Searches strictly by exact ID, exact normalized name within category, or exact name.
 * Disallows single generic tokens from fuzzy/substring matching to prevent collisions.
 */
export function resolvePricingItem(pricingSource, category = null, targetNames = [], targetIds = []) {
  if (!pricingSource) return null;

  const items = Array.isArray(pricingSource)
    ? pricingSource
    : (pricingSource.list || Object.values(pricingSource.map || pricingSource));

  const normalizedNames = targetNames.map(n => String(n || '').trim().toLowerCase()).filter(Boolean);
  const normalizedIds = targetIds.map(i => String(i || '').trim().toLowerCase()).filter(Boolean);
  const targetCategory = category ? String(category).trim().toLowerCase() : null;

  // 1. Exact ID Match (with Category match if category specified)
  const idMatches = [];
  for (const item of items) {
    if (!item) continue;
    const itemId = String(item.id || '').trim().toLowerCase();
    const itemCat = String(item.category || '').trim().toLowerCase();
    if (normalizedIds.includes(itemId)) {
      if (!targetCategory || itemCat === targetCategory) {
        idMatches.push(item);
      }
    }
  }

  if (idMatches.length === 1) {
    return idMatches[0];
  }
  if (idMatches.length > 1) {
    const firstPrice = idMatches[0].price;
    const hasConflict = idMatches.some(m => m.price !== firstPrice);
    if (hasConflict) {
      const err = new Error(`Conflicting pricing records found for ID '${idMatches[0].id}'.`);
      err.code = 'AMBIGUOUS_PRICING_ITEM';
      err.statusCode = 500;
      throw err;
    }
    return idMatches[0];
  }

  // 2. Exact Category + Normalized Name Match
  const exactNameCategoryMatches = [];
  for (const item of items) {
    if (!item) continue;
    const itemCat = String(item.category || '').trim().toLowerCase();
    if (targetCategory && itemCat !== targetCategory) continue;

    const itemName = String(item.name || '').trim().toLowerCase();
    if (normalizedNames.includes(itemName)) {
      exactNameCategoryMatches.push(item);
    }
  }

  if (exactNameCategoryMatches.length === 1) {
    return exactNameCategoryMatches[0];
  }
  if (exactNameCategoryMatches.length > 1) {
    const firstPrice = exactNameCategoryMatches[0].price;
    const hasConflict = exactNameCategoryMatches.some(m => m.price !== firstPrice);
    if (hasConflict) {
      const err = new Error(`Conflicting pricing records found for name '${exactNameCategoryMatches[0].name}'.`);
      err.code = 'AMBIGUOUS_PRICING_ITEM';
      err.statusCode = 500;
      throw err;
    }
    return exactNameCategoryMatches[0];
  }

  // 3. Exact Normalized Name Match (across any category if category was null)
  if (!targetCategory) {
    const exactNameMatches = [];
    for (const item of items) {
      if (!item) continue;
      const itemName = String(item.name || '').trim().toLowerCase();
      if (normalizedNames.includes(itemName)) {
        exactNameMatches.push(item);
      }
    }
    if (exactNameMatches.length === 1) {
      return exactNameMatches[0];
    }
    if (exactNameMatches.length > 1) {
      const firstPrice = exactNameMatches[0].price;
      const hasConflict = exactNameMatches.some(m => m.price !== firstPrice);
      if (hasConflict) {
        const err = new Error(`Conflicting pricing records found for name '${exactNameMatches[0].name}'.`);
        err.code = 'AMBIGUOUS_PRICING_ITEM';
        err.statusCode = 500;
        throw err;
      }
      return exactNameMatches[0];
    }
  }

  // 4. Safe Deterministic Fallback: Word-Boundary matching only for multi-word non-generic phrases
  const FORBIDDEN_GENERIC_TOKENS = new Set([
    'fare', 'rate', 'km', 'price', 'minimum', 'min', 'base', 'starting', 'driver', 'vehicle', 'class', 'drop', 'trip', 'hourly'
  ]);

  const candidates = [];
  for (const item of items) {
    if (!item) continue;
    const itemCat = String(item.category || '').trim().toLowerCase();
    if (targetCategory && itemCat !== targetCategory) continue;

    const itemName = String(item.name || '').trim().toLowerCase();
    for (const targetName of normalizedNames) {
      if (FORBIDDEN_GENERIC_TOKENS.has(targetName)) {
        continue; // Disallow matching on single generic token
      }
      const escaped = targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRegex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i');
      if (wordBoundaryRegex.test(itemName)) {
        if (!candidates.includes(item)) {
          candidates.push(item);
        }
      }
    }
  }

  if (candidates.length === 1) {
    return candidates[0];
  }
  if (candidates.length > 1) {
    const err = new Error(`Ambiguous pricing lookup: multiple candidates matched '${targetNames.join(', ')}'.`);
    err.code = 'AMBIGUOUS_PRICING_ITEM';
    err.statusCode = 500;
    throw err;
  }

  return null;
}

/**
 * Resolves active driver distance pricing configuration from live database records.
 * Fails safely with MISSING_PRICING_CONFIG if base_fare, price_per_km, or min_fare are missing.
 */
export function resolveDistancePricingConfig(pricingSource = null) {
  const baseItem = resolvePricingItem(pricingSource, 'driver', ['base fare', 'starting fare'], ['driver_base_fare', 'base_fare']);
  const kmItem = resolvePricingItem(pricingSource, 'driver', ['price per km', 'rate per km'], ['driver_price_per_km', 'price_per_km']);
  const minItem = resolvePricingItem(pricingSource, 'driver', ['minimum fare', 'min fare'], ['driver_min_fare', 'minimum_fare', 'driver_minimum_fare']);
  const waitingItem = resolvePricingItem(pricingSource, 'driver', ['waiting fare', 'waiting charge'], ['driver_waiting_min', 'waiting_fare']);
  const nightItem = resolvePricingItem(pricingSource, 'driver', ['night surcharge'], ['driver_night_surcharge', 'night_surcharge']);
  const discountItem = resolvePricingItem(pricingSource, 'driver', ['discount', 'standard discount'], ['driver_discount', 'discount_amount']);

  // If a pricingSource map was provided and base/km/min items are missing, fail safely
  if (pricingSource) {
    if (!baseItem || typeof baseItem.price !== 'number' || isNaN(baseItem.price)) {
      throw Object.assign(new Error("Missing required pricing configuration for 'driver_base_fare'."), {
        code: 'MISSING_PRICING_CONFIG',
        statusCode: 500
      });
    }
    if (!kmItem || typeof kmItem.price !== 'number' || isNaN(kmItem.price)) {
      throw Object.assign(new Error("Missing required pricing configuration for 'driver_price_per_km'."), {
        code: 'MISSING_PRICING_CONFIG',
        statusCode: 500
      });
    }
    if (!minItem || typeof minItem.price !== 'number' || isNaN(minItem.price)) {
      throw Object.assign(new Error("Missing required pricing configuration for 'driver_min_fare'."), {
        code: 'MISSING_PRICING_CONFIG',
        statusCode: 500
      });
    }
  }

  // Fallback to DEFAULT_MAP if pricingSource was null
  const baseFare = baseItem && typeof baseItem.price === 'number' ? baseItem.price : DEFAULT_MAP.driver_base_fare?.price;
  const pricePerKm = kmItem && typeof kmItem.price === 'number' ? kmItem.price : DEFAULT_MAP.driver_price_per_km?.price;
  const minimumFare = minItem && typeof minItem.price === 'number' ? minItem.price : DEFAULT_MAP.driver_min_fare?.price;

  if (typeof baseFare !== 'number' || typeof pricePerKm !== 'number' || typeof minimumFare !== 'number') {
    throw Object.assign(new Error("Incomplete driver distance pricing configuration."), {
      code: 'MISSING_PRICING_CONFIG',
      statusCode: 500
    });
  }

  const waitingRatePerMinute = waitingItem && typeof waitingItem.price === 'number' ? waitingItem.price : (DEFAULT_MAP.driver_waiting_min?.price ?? 0.00);
  const nightSurcharge = nightItem && typeof nightItem.price === 'number' ? nightItem.price : (DEFAULT_MAP.driver_night_surcharge?.price ?? 0.00);
  const discountAmount = discountItem && typeof discountItem.price === 'number' ? discountItem.price : (DEFAULT_MAP.driver_discount?.price ?? 0.00);

  return {
    baseFare: Number(baseFare),
    pricePerKm: Number(pricePerKm),
    minimumFare: Number(minimumFare),
    waitingRatePerMinute: Number(waitingRatePerMinute),
    nightSurcharge: Number(nightSurcharge),
    discountAmount: Number(discountAmount),
    currency: 'INR'
  };
}

/**
 * Authoritative Fare Calculation Engine
 * Optionally accepts live pricing map from database, with fallback to hardcoded defaults.
 * Integrates road distance (distanceKm) and duration (durationMinutes) authoritatively.
 */
export function calculateAuthoritativeFare(bookingDetails, pricingMap = null) {
  if (!bookingDetails || typeof bookingDetails !== 'object') {
    throw Object.assign(new Error('Booking details must be an object.'), { statusCode: 400, code: 'INVALID_INPUT' });
  }

  const {
    bookingCategory = 'driver',
    bookingType = null,
    selectedClassId = 'class-beginner',
    vehicleCategory = 'Sedan',
    driverTripOption = 'one-way',
    dropLocation = '',
    roundTripDuration = '4hr',
    outstationTripType = 'round-trip',
    outstationPackage = 'Round trip 24hr',
    distanceKm = null,
    durationMinutes = null,
    isDistancePricing = false,
    useDistancePricing = false,
    waitingMinutes = 0
  } = bookingDetails;

  // Validate distanceKm if supplied
  if (distanceKm !== null && distanceKm !== undefined) {
    const numDist = Number(distanceKm);
    if (!Number.isFinite(numDist) || isNaN(numDist) || numDist < 0) {
      const err = new Error('Invalid route distance provided for pricing.');
      err.code = 'INVALID_ROUTE_DATA';
      err.statusCode = 400;
      throw err;
    }
  }

  const p = (id, fallback) => {
    if (pricingMap) {
      if (pricingMap[id] && typeof pricingMap[id].price === 'number') {
        return pricingMap[id].price;
      }
      if (pricingMap[id] === null || pricingMap[id] === false) {
        const err = new Error(`Missing pricing configuration for tariff '${id}'.`);
        err.code = 'MISSING_PRICING_CONFIG';
        err.statusCode = 500;
        throw err;
      }
    }
    const def = DEFAULT_MAP[id];
    if (def && typeof def.price === 'number') {
      return def.price;
    }
    if (typeof fallback === 'number') {
      return fallback;
    }
    const err = new Error(`Missing pricing configuration for tariff '${id}'.`);
    err.code = 'MISSING_PRICING_CONFIG';
    err.statusCode = 500;
    throw err;
  };

  let basePrice = 299;

  // 1. Driving Class Pricing (all-inclusive flat rate)
  if (bookingCategory === 'class') {
    if (selectedClassId === 'class-beginner') basePrice = p('class_beginner', 5999);
    else if (selectedClassId === 'class-refresher') basePrice = p('class_refresher', 3499);
    else if (selectedClassId === 'class-own-car') basePrice = p('class_own_car', 2999);
    else if (selectedClassId === 'class-automatic') basePrice = p('class_automatic', 3999);
    else basePrice = p('class_beginner', 5999);

    const currentPricingVersion = getPricingVersion(pricingMap);
    return {
      basePrice,
      gst: 0,
      totalFare: basePrice,
      currency: 'INR',
      pricingVersion: currentPricingVersion,
      distanceKm: distanceKm !== null && distanceKm !== undefined ? Number(distanceKm) : null,
      durationMinutes: durationMinutes !== null && durationMinutes !== undefined ? Number(durationMinutes) : null
    };
  }

  // 2. Vehicle Rental Fleet Pricing
  if (bookingCategory === 'vehicle') {
    if (vehicleCategory === 'Sedan') basePrice = p('vehicle_sedan_daily', 1999);
    else if (vehicleCategory === 'SUV') basePrice = p('vehicle_suv_daily', 3499);
    else if (vehicleCategory === '12 Seater') basePrice = p('vehicle_tempo_12_daily', 5499);
    else if (vehicleCategory === '24 Seater') basePrice = p('vehicle_bus_24_daily', 7999);
    else if (vehicleCategory === '32 Seater') basePrice = p('vehicle_coach_32_daily', 10999);
    else basePrice = p('vehicle_sedan_daily', 1999);

    const gst = Math.round(basePrice * 0.05);
    const currentPricingVersion = getPricingVersion(pricingMap);
    return {
      basePrice,
      gst,
      totalFare: basePrice + gst,
      currency: 'INR',
      pricingVersion: currentPricingVersion,
      distanceKm: distanceKm !== null && distanceKm !== undefined ? Number(distanceKm) : null,
      durationMinutes: durationMinutes !== null && durationMinutes !== undefined ? Number(durationMinutes) : null
    };
  }

  // 3. Driver Service Pricing
  const isDistanceBased = Boolean(
    useDistancePricing ||
    isDistancePricing ||
    driverTripOption === 'distance' ||
    bookingType === 'distance'
  );

  const currentPricingVersion = getPricingVersion(pricingMap);

  if (isDistanceBased && distanceKm !== null && distanceKm !== undefined) {
    const numDist = Number(distanceKm);
    const config = resolveDistancePricingConfig(pricingMap);
    const distanceFare = Number((numDist * config.pricePerKm).toFixed(2));
    const subtotal = Number((config.baseFare + distanceFare).toFixed(2));
    let calculatedFare = subtotal;
    const minimumFareApplied = config.minimumFare > 0 && calculatedFare < config.minimumFare;
    if (minimumFareApplied) {
      calculatedFare = config.minimumFare;
    }

    const waitingMinutesCount = Math.max(0, parseInt(waitingMinutes, 10) || 0);
    const waitingFare = Number((waitingMinutesCount * config.waitingRatePerMinute).toFixed(2));
    calculatedFare = Number((calculatedFare + waitingFare).toFixed(2));

    if (config.nightSurcharge > 0) {
      calculatedFare = Number((calculatedFare + config.nightSurcharge).toFixed(2));
    }

    if (config.discountAmount > 0) {
      calculatedFare = Math.max(0, Number((calculatedFare - config.discountAmount).toFixed(2)));
    }

    return {
      distanceKm: Number(numDist.toFixed(2)),
      durationMinutes: durationMinutes !== null && durationMinutes !== undefined ? Math.max(1, Math.round(durationMinutes)) : null,
      baseFare: config.baseFare,
      pricePerKm: config.pricePerKm,
      distanceFare,
      minimumFare: config.minimumFare,
      minimumFareApplied,
      waitingMinutes: waitingMinutesCount,
      waitingFare,
      nightSurcharge: config.nightSurcharge,
      discountAmount: config.discountAmount,
      subtotal,
      calculatedFare,
      estimatedFare: calculatedFare,
      totalFare: calculatedFare,
      basePrice: config.baseFare,
      gst: 0,
      currency: config.currency,
      pricingVersion: currentPricingVersion,
      fareBreakdown: {
        baseFare: config.baseFare,
        pricePerKm: config.pricePerKm,
        distanceKm: Number(numDist.toFixed(2)),
        distanceFare,
        minimumFare: config.minimumFare,
        waitingMinutes: waitingMinutesCount,
        waitingFare,
        nightSurcharge: config.nightSurcharge,
        discountAmount: config.discountAmount,
        estimatedTotal: calculatedFare
      }
    };
  }

  if (driverTripOption === 'one-way') {
    // Airport drops have premium highway toll / distance tier
    const isAirport = typeof dropLocation === 'string' && dropLocation.toLowerCase().includes('airport');
    basePrice = isAirport ? p('driver_airport_drop', 899) : p('driver_one_way_city', 299);
  } else if (driverTripOption === 'round-trip') {
    if (roundTripDuration.includes('2hr')) basePrice = p('driver_hourly_2hr', 199);
    else if (roundTripDuration.includes('4hr')) basePrice = p('driver_hourly_4hr', 349);
    else if (roundTripDuration.includes('6hr')) basePrice = p('driver_hourly_6hr', 499);
    else if (roundTripDuration.includes('8hr')) basePrice = p('driver_hourly_8hr', 599);
    else if (roundTripDuration.includes('12hr')) basePrice = p('driver_hourly_12hr', 899);
    else basePrice = p('driver_hourly_4hr', 349);
  } else if (driverTripOption === 'outstation') {
    if (outstationTripType === 'one-way') {
      if (distanceKm !== null && distanceKm !== undefined && Number(distanceKm) > 0) {
        const dist = Number(distanceKm);
        if (dist > 500) {
          const err = new Error(`Outstation one-way trips currently support routes up to 500 km. Route distance of ${dist.toFixed(1)} km exceeds the maximum supported tier.`);
          err.code = 'UNSUPPORTED_OUTSTATION_DISTANCE';
          err.statusCode = 400;
          throw err;
        }
        if (dist <= 150) basePrice = p('driver_outstation_150km', 1199);
        else if (dist <= 300) basePrice = p('driver_outstation_300km', 1799);
        else basePrice = p('driver_outstation_500km', 2399);
      } else {
        if (outstationPackage.includes('150 km')) basePrice = p('driver_outstation_150km', 1199);
        else if (outstationPackage.includes('300 km')) basePrice = p('driver_outstation_300km', 1799);
        else if (outstationPackage.includes('500 km')) basePrice = p('driver_outstation_500km', 2399);
        else basePrice = p('driver_outstation_150km', 1499);
      }
    } else {
      if (outstationPackage.includes('12hr')) basePrice = p('driver_outstation_12hr', 1199);
      else if (outstationPackage.includes('24hr')) basePrice = p('driver_outstation_24hr', 1999);
      else if (outstationPackage.includes('46hr')) basePrice = p('driver_outstation_46hr', 3899);
      else if (outstationPackage.includes('72hr')) basePrice = p('driver_outstation_72hr', 5799);
      else basePrice = p('driver_outstation_24hr', 1999);
    }
  }

  const gst = Math.round(basePrice * 0.05);
  const totalFare = basePrice + gst;

  return {
    basePrice,
    gst,
    totalFare,
    currency: 'INR',
    distanceKm: distanceKm !== null && distanceKm !== undefined ? Number(Number(distanceKm).toFixed(2)) : null,
    durationMinutes: durationMinutes !== null && durationMinutes !== undefined ? Math.max(1, Math.round(durationMinutes)) : null,
    baseFare: basePrice,
    pricePerKm: 0,
    distanceFare: 0,
    minimumFare: 0,
    waitingMinutes: 0,
    waitingFare: 0,
    nightSurcharge: 0,
    discountAmount: 0,
    subtotal: basePrice,
    calculatedFare: totalFare,
    estimatedFare: totalFare,
    pricingVersion: currentPricingVersion,
    fareBreakdown: {
      baseFare: basePrice,
      pricePerKm: 0,
      distanceKm: distanceKm !== null && distanceKm !== undefined ? Number(Number(distanceKm).toFixed(2)) : null,
      distanceFare: 0,
      minimumFare: 0,
      waitingMinutes: 0,
      waitingFare: 0,
      nightSurcharge: 0,
      discountAmount: 0,
      estimatedTotal: totalFare
    }
  };
}
