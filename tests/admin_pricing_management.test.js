import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from './testHelper.js';
import { bootstrapAdmin } from '../server/scripts/bootstrapAdmin.js';
import { calculateAuthoritativeFare } from '../server/services/pricingService.js';

describe('Admin Pricing Section & Live Website Tariff Synchronization Suite', () => {
  let server, baseUrl;
  const testAdminEmail = `pricing_admin_${Date.now()}@bookdriveranna.com`;
  const testAdminPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
  const testAdminPassword = 'PricingAdminPass2026!';
  let adminToken = '';

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    await bootstrapAdmin({
      email: testAdminEmail,
      password: testAdminPassword,
      name: 'Pricing Test Admin',
      phone: testAdminPhone,
      area: 'Bengaluru Core'
    });

    // Log in as admin to retrieve JWT token
    const loginRes = await fetch(`${baseUrl}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testAdminEmail,
        password: testAdminPassword
      })
    });
    const loginData = await loginRes.json();
    adminToken = loginData.data?.token || '';
  });

  after(() => {
    server.close();
  });

  test('1. Public /api/pricing returns structured tariffs with list and key-value map', async () => {
    const res = await fetch(`${baseUrl}/api/pricing`);
    assert.strictEqual(res.status, 200, 'Public pricing endpoint should return HTTP 200');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.data.map, 'Pricing response must include key-value map');
    assert.ok(Array.isArray(data.data.list), 'Pricing response must include list array');
    assert.ok(data.data.map.driver_hourly_2hr, 'Must include driver_hourly_2hr');
    assert.ok(data.data.map.vehicle_sedan_daily, 'Must include vehicle_sedan_daily');
    assert.ok(data.data.map.class_beginner, 'Must include class_beginner');
  });

  test('2. Unauthenticated request to /api/admin/pricing is rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/api/admin/pricing`);
    assert.strictEqual(res.status, 401, 'Unauthenticated admin request must return 401');
  });

  test('3. Authenticated Admin can retrieve tariffs via /api/admin/pricing', async () => {
    const res = await fetch(`${baseUrl}/api/admin/pricing`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    assert.strictEqual(res.status, 200, 'Admin should receive 200 with valid JWT');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.data.map.driver_hourly_2hr.price > 0);
  });

  test('4. Admin can modify service tariffs and changes are saved to database', async () => {
    // Update In-City Hourly (2hr) from 199 to 249, and Sedan daily rate from 1999 to 2299
    const updateRes = await fetch(`${baseUrl}/api/admin/pricing`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        items: [
          { id: 'driver_hourly_2hr', price: 249 },
          { id: 'vehicle_sedan_daily', price: 2299 }
        ]
      })
    });

    assert.strictEqual(updateRes.status, 200, 'PUT /api/admin/pricing should return 200');
    const updateData = await updateRes.json();
    assert.strictEqual(updateData.success, true);
    assert.strictEqual(updateData.data.map.driver_hourly_2hr.price, 249, 'Updated driver price should be 249');
    assert.strictEqual(updateData.data.map.vehicle_sedan_daily.price, 2299, 'Updated sedan price should be 2299');

    // Verify public /api/pricing now serves the newly modified prices to website
    const publicRes = await fetch(`${baseUrl}/api/pricing`);
    const publicData = await publicRes.json();
    assert.strictEqual(publicData.data.map.driver_hourly_2hr.price, 249);
    assert.strictEqual(publicData.data.map.vehicle_sedan_daily.price, 2299);
  });

  test('5. Backend authoritative fare calculation uses the updated price', () => {
    const customPricingMap = {
      driver_hourly_2hr: { price: 249 }
    };
    const fare = calculateAuthoritativeFare({
      bookingCategory: 'driver',
      driverTripOption: 'round-trip',
      roundTripDuration: '2hr'
    }, customPricingMap);

    assert.strictEqual(fare.basePrice, 249, 'Base fare should use updated 249 rate');
    assert.strictEqual(fare.totalFare, 249 + Math.round(249 * 0.05));
  });

  test('6. Admin can reset tariffs back to factory defaults', async () => {
    const resetRes = await fetch(`${baseUrl}/api/admin/pricing/reset`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    assert.strictEqual(resetRes.status, 200, 'POST /api/admin/pricing/reset should return 200');
    const resetData = await resetRes.json();
    assert.strictEqual(resetData.success, true);
    assert.strictEqual(resetData.data.map.driver_hourly_2hr.price, 199, 'Price should be reset to default 199');
    assert.strictEqual(resetData.data.map.vehicle_sedan_daily.price, 1999, 'Sedan price should be reset to 1999');
  });

  test('7. AdminSidebar, AdminPage, and HomePage contain Pricing section wiring', () => {
    const sidebarCode = fs.readFileSync(path.resolve('src/pages/admin/AdminSidebar.jsx'), 'utf8');
    const adminPageCode = fs.readFileSync(path.resolve('src/pages/AdminPage.jsx'), 'utf8');
    const pricingTabCode = fs.readFileSync(path.resolve('src/pages/admin/AdminPricingTab.jsx'), 'utf8');
    const homePageCode = fs.readFileSync(path.resolve('src/pages/HomePage.jsx'), 'utf8');

    // Sidebar includes Pricing navigation
    assert.match(sidebarCode, /navigateToTab\(['"]pricing['"]\)/, 'AdminSidebar must have button navigating to pricing tab');
    assert.match(sidebarCode, /<span>Pricing<\/span>/, 'AdminSidebar must label the tab as Pricing');

    // AdminPage includes AdminPricingTab
    assert.match(adminPageCode, /import AdminPricingTab from/, 'AdminPage must import AdminPricingTab');
    assert.match(adminPageCode, /activeTab === ['"]pricing['"]/, 'AdminPage must render AdminPricingTab when activeTab is pricing');

    // AdminPricingTab has save and reset triggers
    assert.match(pricingTabCode, /handleSaveChanges/, 'AdminPricingTab must have handleSaveChanges handler');
    assert.match(pricingTabCode, /handleResetToDefaults/, 'AdminPricingTab must have reset to defaults handler');

    // HomePage uses dynamic pricing hook
    assert.match(homePageCode, /usePricing\(\)/, 'HomePage must consume usePricing hook');
  });

  test('8. Admin SPA route /admin/pricing is registered and correctly parsed', () => {
    const adminPageCode = fs.readFileSync(path.resolve('src/pages/AdminPage.jsx'), 'utf8');
    assert.match(adminPageCode, /['"]pricing['"]:\s*['"]\/admin\/pricing['"]/, 'ADMIN_TAB_ROUTES must map pricing to /admin/pricing');
    assert.match(adminPageCode, /clean === ['"]\/admin\/pricing['"]/, 'parseTabFromPath must map /admin/pricing to pricing tab');
  });

  test('9. BookingModal dynamically formats tariffs and calculates authoritative fares including 6hr package', () => {
    const modalCode = fs.readFileSync(path.resolve('src/components/BookingModal.jsx'), 'utf8');
    
    // BookingModal imports usePricing and formatPrice
    assert.match(modalCode, /usePricing\(\)/, 'BookingModal must call usePricing()');
    assert.match(modalCode, /formatPrice/, 'BookingModal must use formatPrice for dynamic rendering');
    assert.match(modalCode, /refreshPricing/, 'BookingModal must refresh pricing when opened');

    // 6hr duration supported in calculateAuthoritativeFare
    const fare6hr = calculateAuthoritativeFare({
      bookingCategory: 'driver',
      driverTripOption: 'round-trip',
      roundTripDuration: '6hr'
    });
    assert.strictEqual(fare6hr.basePrice, 499, '6hr round trip base fare must be 499');
    assert.strictEqual(fare6hr.totalFare, 499 + Math.round(499 * 0.05));

    // Driving classes have all-inclusive flat pricing with zero GST
    const classFare = calculateAuthoritativeFare({
      bookingCategory: 'class',
      selectedClassId: 'class-beginner'
    });
    assert.strictEqual(classFare.basePrice, 5999);
    assert.strictEqual(classFare.gst, 0, 'Driving classes must have 0 GST');
    assert.strictEqual(classFare.totalFare, 5999);
  });

  test('10. Health check endpoint reports hasPricingTable is true and database is healthy', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200, 'Health check should return HTTP 200');
    const health = await res.json();
    assert.strictEqual(health.status, 'healthy');
    assert.strictEqual(health.database.hasPricingTable, true, 'Health check must report hasPricingTable: true');
  });

  test('11. Database schema and initialization code auto-create service_pricing table for TiDB and SQLite', () => {
    const schemaSql = fs.readFileSync(path.resolve('server/db/schema.sql'), 'utf8');
    assert.ok(
      schemaSql.includes('CREATE TABLE IF NOT EXISTS service_pricing'),
      'server/db/schema.sql must define service_pricing table'
    );
    assert.ok(
      schemaSql.includes('idx_pricing_category'),
      'server/db/schema.sql must define index on service_pricing(category)'
    );

    const dbCode = fs.readFileSync(path.resolve('server/db/database.js'), 'utf8');
    assert.ok(
      dbCode.includes('CREATE TABLE IF NOT EXISTS service_pricing'),
      'server/db/database.js must auto-create service_pricing in TiDB connection initialization'
    );

    const pricingServiceCode = fs.readFileSync(path.resolve('server/services/pricingService.js'), 'utf8');
    assert.ok(
      pricingServiceCode.includes('CREATE TABLE IF NOT EXISTS service_pricing'),
      'server/services/pricingService.js must proactively create service_pricing table before querying'
    );
  });
});

