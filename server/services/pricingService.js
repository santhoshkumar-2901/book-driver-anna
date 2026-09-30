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
 * Authoritative Fare Calculation Engine
 * Optionally accepts live pricing map from database, with fallback to hardcoded defaults
 */
export function calculateAuthoritativeFare(bookingDetails, pricingMap = null) {
  const {
    bookingCategory = 'driver',
    selectedClassId = 'class-beginner',
    vehicleCategory = 'Sedan',
    driverTripOption = 'one-way',
    dropLocation = '',
    roundTripDuration = '4hr',
    outstationTripType = 'round-trip',
    outstationPackage = 'Round trip 24hr'
  } = bookingDetails;

  const p = (id, fallback) => {
    if (pricingMap && pricingMap[id] && typeof pricingMap[id].price === 'number') {
      return pricingMap[id].price;
    }
    const def = DEFAULT_MAP[id];
    return def ? def.price : fallback;
  };

  let basePrice = 299;

  // 1. Driving Class Pricing (all-inclusive flat rate)
  if (bookingCategory === 'class') {
    if (selectedClassId === 'class-beginner') basePrice = p('class_beginner', 5999);
    else if (selectedClassId === 'class-refresher') basePrice = p('class_refresher', 3499);
    else if (selectedClassId === 'class-own-car') basePrice = p('class_own_car', 2999);
    else if (selectedClassId === 'class-automatic') basePrice = p('class_automatic', 3999);
    else basePrice = p('class_beginner', 5999);

    return {
      basePrice,
      gst: 0,
      totalFare: basePrice,
      currency: 'INR'
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
    return {
      basePrice,
      gst,
      totalFare: basePrice + gst,
      currency: 'INR'
    };
  }

  // 3. Driver Service Pricing
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
      if (outstationPackage.includes('150 km')) basePrice = p('driver_outstation_150km', 1199);
      else if (outstationPackage.includes('300 km')) basePrice = p('driver_outstation_300km', 1799);
      else if (outstationPackage.includes('500 km')) basePrice = p('driver_outstation_500km', 2399);
      else basePrice = p('driver_outstation_150km', 1499);
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
    currency: 'INR'
  };
}
