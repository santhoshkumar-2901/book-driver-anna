import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { RoutingService } from '../server/services/routingService.js';
import { GeocodingService } from '../server/services/geocodingService.js';

describe('Antigravity Phase 22 — Performance Optimization Test Suite', () => {

  // ==========================================
  // 1. REACT RENDERING & STATE STABILIZATION
  // ==========================================
  test('1. useDriverRealtimeLocation dedupes identical stationary coordinates to prevent unnecessary rerenders', () => {
    const hookCode = fs.readFileSync(path.resolve('src/utils/useDriverRealtimeLocation.js'), 'utf8');
    assert.match(hookCode, /setLocation\(prev\s*=>\s*\{/, 'useDriverRealtimeLocation must use functional state update for coordinate stability');
    assert.match(hookCode, /prev\.latitude\s*===\s*msg\.latitude/, 'Must check latitude equality for deduplication');
    assert.match(hookCode, /prev\.longitude\s*===\s*msg\.longitude/, 'Must check longitude equality for deduplication');
    assert.match(hookCode, /return\s+prev;/, 'Must return previous location reference when stationary');
  });

  test('2. useDriverLocation stabilizes currentCoords state when GPS position is unchanged', () => {
    const hookCode = fs.readFileSync(path.resolve('src/utils/useDriverLocation.js'), 'utf8');
    assert.match(hookCode, /setCurrentCoords\(prev\s*=>\s*\{/, 'useDriverLocation must use functional state updater');
    assert.match(hookCode, /prev\.latitude\s*===\s*latitude/, 'Must verify latitude match before updating coordinate state');
    assert.match(hookCode, /prev\.longitude\s*===\s*longitude/, 'Must verify longitude match before updating coordinate state');
    assert.match(hookCode, /return\s+prev;/, 'Must return prev coords to prevent downstream re-renders');
  });

  // ==========================================
  // 2. NETWORK & POLLING THROTTLING
  // ==========================================
  test('3. useUserBookingBadge throttles backend HTTP requests to avoid flooding /api/bookings/my', () => {
    const badgeCode = fs.readFileSync(path.resolve('src/utils/useUserBookingBadge.js'), 'utf8');
    assert.match(badgeCode, /lastBackendFetchRef\s*=\s*useRef\(0\)/, 'Must track lastBackendFetchRef to throttle network calls');
    assert.match(badgeCode, /!force\s*&&\s*\(now\s*-\s*lastBackendFetchRef\.current\s*<\s*20000\)/, 'Must throttle repetitive calls within at least 20 seconds');
  });

  test('4. useUserBookingBadge increases heartbeat sync interval from 3.5s to 30s', () => {
    const badgeCode = fs.readFileSync(path.resolve('src/utils/useUserBookingBadge.js'), 'utf8');
    assert.ok(!badgeCode.includes('setInterval(evaluateBadge, 3500)'), 'Aggressive 3.5s interval must be replaced');
    assert.match(badgeCode, /setInterval\([^,]+,\s*30000\)/, 'Must use 30s heartbeat interval to conserve bandwidth');
  });

  test('5. useUserBookingBadge immediately updates on explicit broadcast and storage events', () => {
    const badgeCode = fs.readFileSync(path.resolve('src/utils/useUserBookingBadge.js'), 'utf8');
    assert.match(badgeCode, /evaluateBadge\(\{\s*force:\s*true\s*\}\)/, 'Explicit events must bypass throttle with force: true');
    assert.match(badgeCode, /onBookingUpdate\(/, 'Must listen to real-time broadcast updates');
    assert.match(badgeCode, /window\.addEventListener\('storage'/, 'Must listen to cross-tab storage changes');
  });

  // ==========================================
  // 3. MAP RENDERING & LEAFLET COMPONENT MEMOIZATION
  // ==========================================
  test('6. DriverLocationMarker is wrapped in React.memo with coordinate comparison', () => {
    const code = fs.readFileSync(path.resolve('src/components/map/DriverLocationMarker.jsx'), 'utf8');
    assert.match(code, /React\.memo\(/, 'DriverLocationMarker must use React.memo');
    assert.match(code, /prevLoc\.latitude\s*===\s*nextLoc\.latitude/, 'Must compare latitude in memo check');
    assert.match(code, /prevLoc\.longitude\s*===\s*nextLoc\.longitude/, 'Must compare longitude in memo check');
  });

  test('7. DriverLocationMarker caches driver L.divIcon singleton to prevent DOM icon re-allocations', () => {
    const code = fs.readFileSync(path.resolve('src/components/map/DriverLocationMarker.jsx'), 'utf8');
    assert.match(code, /let\s+cachedDriverIcon\s*=\s*null/, 'Must maintain cachedDriverIcon singleton');
    assert.match(code, /getDriverLocationIcon\(\)/, 'Must retrieve memoized driver icon');
  });

  test('8. RoutePolyline is wrapped in React.memo and compares path coordinates', () => {
    const code = fs.readFileSync(path.resolve('src/components/map/RoutePolyline.jsx'), 'utf8');
    assert.match(code, /export\s+default\s+React\.memo\(RoutePolyline/, 'RoutePolyline must be memoized');
    assert.match(code, /prev\.geometry\s*===\s*next\.geometry/, 'Must fast-path identical geometry references');
  });

  test('9. PickupMarker is wrapped in React.memo and caches pickup icon singleton', () => {
    const code = fs.readFileSync(path.resolve('src/components/map/PickupMarker.jsx'), 'utf8');
    assert.match(code, /export\s+default\s+React\.memo\(PickupMarker/, 'PickupMarker must be memoized');
    assert.match(code, /let\s+cachedPickupIcon\s*=\s*null/, 'Must maintain cachedPickupIcon singleton');
  });

  test('10. DestinationMarker is wrapped in React.memo and caches destination icon singleton', () => {
    const code = fs.readFileSync(path.resolve('src/components/map/DestinationMarker.jsx'), 'utf8');
    assert.match(code, /export\s+default\s+React\.memo\(DestinationMarker/, 'DestinationMarker must be memoized');
    assert.match(code, /let\s+cachedDestinationIcon\s*=\s*null/, 'Must maintain cachedDestinationIcon singleton');
  });

  // ==========================================
  // 4. BACKEND CONCURRENCY & INDEXES
  // ==========================================
  test('11. GET /api/admin/metrics executes independent aggregate queries concurrently via Promise.all', () => {
    const adminRoutesCode = fs.readFileSync(path.resolve('server/routes/admin.js'), 'utf8');
    assert.match(adminRoutesCode, /Promise\.all\(\[\s*queryOne\('SELECT COUNT\(\*\) as count FROM bookings'\)/, 'Metrics route must use Promise.all for aggregate queries');
  });

  test('12. GET /api/admin/diagnostics executes system count queries concurrently via Promise.all', () => {
    const adminRoutesCode = fs.readFileSync(path.resolve('server/routes/admin.js'), 'utf8');
    assert.match(adminRoutesCode, /Promise\.all\(\[\s*queryOne\('SELECT COUNT\(\*\) as count FROM drivers'\)/, 'Diagnostics route must use Promise.all');
  });

  test('13. Schema includes idx_bookings_status index to accelerate status lookups', () => {
    const schemaCode = fs.readFileSync(path.resolve('server/db/schema.js'), 'utf8');
    assert.match(schemaCode, /CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings\(status\);/, 'Schema must define idx_bookings_status index');
  });

  // ==========================================
  // 5. BUNDLE SIZE & CHUNK CONFIGURATION
  // ==========================================
  test('14. vite.config.js configures manualChunks to split heavy vendor dependencies', () => {
    const viteConfig = fs.readFileSync(path.resolve('vite.config.js'), 'utf8');
    assert.match(viteConfig, /manualChunks\(id\)/, 'vite.config.js must implement manualChunks');
    assert.match(viteConfig, /vendor-leaflet/, 'Must isolate Leaflet vendor bundle');
    assert.match(viteConfig, /vendor-icons/, 'Must isolate Lucide icons vendor bundle');
  });

  test('15. Production build output contains separated vendor-leaflet chunk', () => {
    const distAssets = fs.existsSync(path.resolve('dist/assets')) 
      ? fs.readdirSync(path.resolve('dist/assets')) 
      : [];
    const hasLeafletChunk = distAssets.some(file => file.startsWith('vendor-leaflet') && file.endsWith('.js'));
    assert.ok(hasLeafletChunk, 'Production build must emit separate vendor-leaflet JS chunk');
  });

  // ==========================================
  // 6. ROUTING SERVICE PERFORMANCE & CACHING
  // ==========================================
  test('16. RoutingService short-circuits identical coordinates without network calls', async () => {
    let networkCallCount = 0;
    const mockFetch = async () => {
      networkCallCount++;
      return { ok: true, json: async () => ({}) };
    };

    const routing = new RoutingService({ fetchFn: mockFetch });
    const result = await routing.getRoute({
      pickupLat: 12.9716,
      pickupLng: 77.5946,
      destLat: 12.9716,
      destLng: 77.5946
    });

    assert.strictEqual(networkCallCount, 0, 'Must not dispatch network call for identical locations');
    assert.strictEqual(result.distanceMeters, 0, 'Distance must be 0 for identical locations');
    assert.strictEqual(result.fromCache, false);
  });

  test('17. RoutingService caches responses in-memory by coordinate key', async () => {
    let networkCallCount = 0;
    const mockRouteResponse = {
      code: 'Ok',
      routes: [{
        distance: 5200,
        duration: 720,
        geometry: {
          type: 'LineString',
          coordinates: [[77.5946, 12.9716], [77.6412, 12.9784]]
        }
      }]
    };

    const mockFetch = async () => {
      networkCallCount++;
      return {
        ok: true,
        status: 200,
        json: async () => mockRouteResponse
      };
    };

    const routing = new RoutingService({ fetchFn: mockFetch });
    const params = { pickupLat: 12.9716, pickupLng: 77.5946, destLat: 12.9784, destLng: 77.6412 };

    const first = await routing.getRoute(params);
    assert.strictEqual(networkCallCount, 1, 'First call must hit network');
    assert.strictEqual(first.fromCache, false);

    const second = await routing.getRoute(params);
    assert.strictEqual(networkCallCount, 1, 'Second call must hit cache');
    assert.strictEqual(second.fromCache, true);
    assert.strictEqual(second.distanceMeters, 5200);
  });

  test('18. RoutingService evicts expired cache entries according to TTL', async () => {
    let networkCallCount = 0;
    const mockRouteResponse = {
      code: 'Ok',
      routes: [{
        distance: 1000,
        duration: 120,
        geometry: {
          type: 'LineString',
          coordinates: [[77.5, 12.9], [77.6, 12.9]]
        }
      }]
    };

    const mockFetch = async () => {
      networkCallCount++;
      return {
        ok: true,
        status: 200,
        json: async () => mockRouteResponse
      };
    };

    const routing = new RoutingService({ fetchFn: mockFetch, cacheTtlMs: 50 });
    const params = { pickupLat: 12.9, pickupLng: 77.5, destLat: 12.9, destLng: 77.6 };

    await routing.getRoute(params);
    assert.strictEqual(networkCallCount, 1);

    // Wait for TTL expiration
    await new Promise(resolve => setTimeout(resolve, 60));

    await routing.getRoute(params);
    assert.strictEqual(networkCallCount, 2, 'Must re-fetch after cache TTL expires');
  });

  test('19. RoutingService bounds cache size to prevent memory leaks', () => {
    const routing = new RoutingService({ maxCacheSize: 3 });
    routing.setInCache('k1', { val: 1 });
    routing.setInCache('k2', { val: 2 });
    routing.setInCache('k3', { val: 3 });
    assert.strictEqual(routing.cache.size, 3);

    // Adding 4th item should evict oldest (k1)
    routing.setInCache('k4', { val: 4 });
    assert.strictEqual(routing.cache.size, 3);
    assert.strictEqual(routing.cache.has('k1'), false, 'Oldest cache key must be evicted');
    assert.strictEqual(routing.cache.has('k4'), true);
  });

  // ==========================================
  // 7. LOCATION SEARCH PERFORMANCE & CACHING
  // ==========================================
  test('20. GeocodingService normalizes query strings to optimize cache hit rate', () => {
    const geocoding = new GeocodingService();
    assert.strictEqual(geocoding.normalizeQuery('  Koramangala   5th Block  '), 'koramangala 5th block');
    assert.strictEqual(geocoding.normalizeQuery('MG ROAD\n'), 'mg road');
  });

  test('21. GeocodingService caches normalized results in-memory', async () => {
    let networkCallCount = 0;
    const mockNominatim = [
      { place_id: 101, lat: '12.9352', lon: '77.6245', display_name: 'Koramangala, Bengaluru, India', address: { country_code: 'in' } }
    ];

    const mockFetch = async () => {
      networkCallCount++;
      return {
        ok: true,
        status: 200,
        json: async () => mockNominatim
      };
    };

    const geocoding = new GeocodingService({ fetchFn: mockFetch });
    const res1 = await geocoding.search('Koramangala');
    assert.strictEqual(networkCallCount, 1);
    assert.strictEqual(res1.fromCache, false);

    // Varied case and spacing should hit cache
    const res2 = await geocoding.search('  koramangala  ');
    assert.strictEqual(networkCallCount, 1, 'Normalized query must hit cache');
    assert.strictEqual(res2.fromCache, true);
  });

  test('22. GeocodingService bounds cache size to maxCacheSize', () => {
    const geocoding = new GeocodingService({ maxCacheSize: 2 });
    geocoding.setInCache('query1', []);
    geocoding.setInCache('query2', []);
    assert.strictEqual(geocoding.cache.size, 2);

    geocoding.setInCache('query3', []);
    assert.strictEqual(geocoding.cache.size, 2);
    assert.strictEqual(geocoding.cache.has('query1'), false, 'Oldest query must be evicted');
    assert.strictEqual(geocoding.cache.has('query3'), true);
  });

  test('23. LocationSearch component uses AbortController to cancel stale in-flight requests', () => {
    const searchCode = fs.readFileSync(path.resolve('src/components/map/LocationSearch.jsx'), 'utf8');
    assert.match(searchCode, /abortControllerRef\.current\.abort\(\)/, 'LocationSearch must abort previous in-flight requests');
    assert.match(searchCode, /signal:\s*abortController\.signal/, 'Must pass abort signal to apiClient');
  });

  test('24. LocationSearch component debounces user input before dispatching queries', () => {
    const searchCode = fs.readFileSync(path.resolve('src/components/map/LocationSearch.jsx'), 'utf8');
    assert.match(searchCode, /debounceTimerRef\.current\s*=\s*setTimeout\(/, 'Must set debounce timer');
    assert.match(searchCode, /clearTimeout\(debounceTimerRef\.current\)/, 'Must cancel previous timer on keystroke');
  });

  // ==========================================
  // 8. LIFECYCLE & MEMORY CLEANUP
  // ==========================================
  test('25. LocationSearch cleans up timers and aborts in-flight requests on unmount', () => {
    const searchCode = fs.readFileSync(path.resolve('src/components/map/LocationSearch.jsx'), 'utf8');
    assert.match(searchCode, /return\s*\(\)\s*=>\s*\{[\s\S]*clearTimeout\(debounceTimerRef\.current\)[\s\S]*abortControllerRef\.current\.abort\(\)/, 'Unmount hook must clean up timer and abort controller');
  });

  test('26. useDriverRealtimeLocation unsubscribes and closes WebSocket on unmount', () => {
    const realtimeCode = fs.readFileSync(path.resolve('src/utils/useDriverRealtimeLocation.js'), 'utf8');
    assert.match(realtimeCode, /socketRef\.current\.send\(JSON\.stringify\(\{\s*type:\s*'unsubscribe'/);
    assert.match(realtimeCode, /socketRef\.current\.close\(1000/);
    assert.match(realtimeCode, /socketRef\.current\s*=\s*null/);
  });

  test('27. useDriverLocation cleans up geolocation watch on unmount', () => {
    const driverLocCode = fs.readFileSync(path.resolve('src/utils/useDriverLocation.js'), 'utf8');
    assert.match(driverLocCode, /navigator\.geolocation\.clearWatch\(watchIdRef\.current\)/, 'Must clear GPS watch on unmount');
    assert.match(driverLocCode, /watchIdRef\.current\s*=\s*null/, 'Must reset watchIdRef');
  });
});
