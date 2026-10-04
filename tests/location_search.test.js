import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from './testHelper.js';
import { GeocodingService, geocodingService } from '../server/services/geocodingService.js';

describe('Phase 4 — Location Search & Geocoding Proxy Suite', () => {
  let server, baseUrl;

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;
  });

  after(async () => {
    if (server) {
      await new Promise((res) => server.close(res));
    }
  });

  describe('1. GeocodingService Unit Tests (Provider Isolation & Normalization)', () => {
    test('1.1 Rejects empty or whitespace query with 400 INVALID_QUERY', async () => {
      const service = new GeocodingService();
      await assert.rejects(
        async () => service.search('   '),
        (err) => err.code === 'INVALID_QUERY' && err.status === 400
      );
    });

    test('1.2 Rejects query shorter than 2 characters with 400 INVALID_QUERY', async () => {
      const service = new GeocodingService();
      await assert.rejects(
        async () => service.search('a'),
        (err) => err.code === 'INVALID_QUERY' && err.status === 400
      );
    });

    test('1.3 Rejects oversized query (>200 characters) with 400 QUERY_TOO_LONG', async () => {
      const service = new GeocodingService();
      const longQuery = 'x'.repeat(201);
      await assert.rejects(
        async () => service.search(longQuery),
        (err) => err.code === 'QUERY_TOO_LONG' && err.status === 400
      );
    });

    test('1.4 Normalizes valid Nominatim responses and discards malformed entries', async () => {
      const mockRawData = [
        {
          place_id: 12345,
          display_name: 'Indiranagar, Bengaluru, Karnataka, India',
          lat: '12.9719',
          lon: '77.6412',
          type: 'suburb'
        },
        {
          place_id: 67890,
          display_name: '', // Empty display name - must be discarded
          lat: '12.9719',
          lon: '77.6412'
        },
        {
          place_id: 99999,
          display_name: 'Invalid Coordinates Place',
          lat: '999.00', // Invalid latitude - must be discarded
          lon: '77.6412'
        }
      ];

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => mockRawData
      });

      const service = new GeocodingService({ fetchFn: mockFetch });
      const { results, fromCache } = await service.search('Indiranagar');

      assert.strictEqual(fromCache, false);
      assert.strictEqual(results.length, 1, 'Must discard malformed records');
      assert.deepStrictEqual(results[0], {
        id: '12345',
        displayName: 'Indiranagar, Bengaluru, Karnataka, India',
        latitude: 12.9719,
        longitude: 77.6412,
        type: 'suburb'
      });
    });

    test('1.5 Returns cached results on second identical query without re-invoking provider', async () => {
      let fetchCallCount = 0;
      const mockFetch = async () => {
        fetchCallCount++;
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              place_id: 101,
              display_name: 'Koramangala, Bengaluru, India',
              lat: '12.9352',
              lon: '77.6245',
              type: 'suburb'
            }
          ]
        };
      };

      const service = new GeocodingService({ fetchFn: mockFetch });

      // First call
      const res1 = await service.search('  Koramangala  ');
      assert.strictEqual(res1.fromCache, false);
      assert.strictEqual(fetchCallCount, 1);

      // Second call with different casing/spacing - must resolve to cache
      const res2 = await service.search('koramangala');
      assert.strictEqual(res2.fromCache, true);
      assert.strictEqual(fetchCallCount, 1, 'Provider fetch must NOT be called on cache hit');
      assert.strictEqual(res2.results.length, 1);
    });

    test('1.6 Handles Nominatim 429 rate limit with PROVIDER_RATE_LIMITED', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 429
      });

      const service = new GeocodingService({ fetchFn: mockFetch });
      await assert.rejects(
        async () => service.search('Whitefield'),
        (err) => err.code === 'PROVIDER_RATE_LIMITED' && err.status === 429
      );
    });

    test('1.7 Handles Nominatim 503 service unavailable with PROVIDER_UNAVAILABLE', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 503
      });

      const service = new GeocodingService({ fetchFn: mockFetch });
      await assert.rejects(
        async () => service.search('Whitefield'),
        (err) => err.code === 'PROVIDER_UNAVAILABLE' && err.status === 503
      );
    });

    test('1.8 Handles outbound timeout (AbortError) with PROVIDER_TIMEOUT', async () => {
      const mockFetch = async () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      };

      const service = new GeocodingService({ fetchFn: mockFetch });
      await assert.rejects(
        async () => service.search('HSR Layout'),
        (err) => err.code === 'PROVIDER_TIMEOUT' && err.status === 504
      );
    });
  });

  describe('2. HTTP API Route Integration (/api/location/search)', () => {
    test('2.1 Rejects request without query parameter with 400', async () => {
      const res = await fetch(`${baseUrl}/api/location/search`);
      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_QUERY');
    });

    test('2.2 Rejects request with query shorter than 2 characters with 400', async () => {
      const res = await fetch(`${baseUrl}/api/location/search?q=x`);
      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_QUERY');
    });

    test('2.3 Rejects request with whitespace-only query with 400', async () => {
      const res = await fetch(`${baseUrl}/api/location/search?q=%20%20%20`);
      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_QUERY');
    });

    test('2.4 Pre-cached query returns 200 with structured data and meta', async () => {
      // Seed service cache for deterministic integration verification
      const normalizedKey = geocodingService.normalizeQuery('MG Road');
      geocodingService.setInCache(normalizedKey, [
        {
          id: 'test-mg-road',
          displayName: 'Mahatma Gandhi Road, Bengaluru, Karnataka, India',
          latitude: 12.9756,
          longitude: 77.6066,
          type: 'highway'
        }
      ]);

      const res = await fetch(`${baseUrl}/api/location/search?q=MG%20Road`);
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.meta.fromCache, true);
      assert.strictEqual(data.data.length, 1);
      assert.strictEqual(data.data[0].id, 'test-mg-road');
      assert.strictEqual(data.data[0].latitude, 12.9756);
      assert.strictEqual(data.data[0].longitude, 77.6066);
    });
  });

  describe('3. Frontend Component & Architectural Contract Verification', () => {
    test('3.1 LocationSearch uses apiClient.searchLocations and AbortController', () => {
      const componentPath = path.resolve('src/components/map/LocationSearch.jsx');
      const content = fs.readFileSync(componentPath, 'utf8');

      assert.match(content, /apiClient\.searchLocations/, 'Must call apiClient.searchLocations');
      assert.match(content, /new AbortController\(\)/, 'Must instantiate AbortController');
      assert.match(content, /abortControllerRef\.current\.abort\(\)/, 'Must abort stale requests');
      assert.match(content, /setTimeout/, 'Must debounce keystrokes with timer');
    });

    test('3.2 BookingModal embeds LocationSearch cleanly for location selection', () => {
      const modalPath = path.resolve('src/components/BookingModal.jsx');
      const content = fs.readFileSync(modalPath, 'utf8');

      assert.match(content, /<LocationSearch/, 'BookingModal must embed LocationSearch');
      assert.match(content, /handleSelectPickup|handleSelectDestination/, 'BookingModal must handle location selections');
    });

    test('3.3 No direct browser requests to Nominatim endpoint exist in src/', () => {
      const srcDir = path.resolve('src');
      const files = fs.readdirSync(srcDir, { recursive: true });
      for (const file of files) {
        if (typeof file === 'string' && (file.endsWith('.js') || file.endsWith('.jsx'))) {
          const filePath = path.join(srcDir, file);
          if (fs.statSync(filePath).isFile()) {
            const code = fs.readFileSync(filePath, 'utf8');
            assert.ok(
              !code.includes('nominatim.openstreetmap.org'),
              `Direct Nominatim URL forbidden in frontend file: ${file}`
            );
          }
        }
      }
    });
  });

  describe('4. Map Localization — India First & South India Priority Suite', () => {
    test('4.1 MapView exports DEFAULT_MAP_CENTER and DEFAULT_MAP_ZOOM focused on South India', () => {
      const componentPath = path.resolve('src/components/map/MapView.jsx');
      const content = fs.readFileSync(componentPath, 'utf8');

      assert.match(content, /export const DEFAULT_MAP_CENTER = \[13\.0,\s*78\.5\]/, 'Center must be [13.0, 78.5]');
      assert.match(content, /export const DEFAULT_MAP_ZOOM = 6/, 'Default zoom must be 6');
      assert.match(content, /invalidateSize/, 'Must call invalidateSize for responsive container sizing');
    });

    test('4.2 GeocodingService passes South India viewbox and bounded=0 to provider for geographic biasing', async () => {
      let requestedUrl = null;
      const mockFetch = async (url) => {
        requestedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => []
        };
      };

      const service = new GeocodingService({ fetchFn: mockFetch });
      await service.search('Anna Nagar');

      assert.ok(requestedUrl, 'Must dispatch provider request');
      const urlObj = new URL(requestedUrl);
      assert.strictEqual(urlObj.searchParams.get('viewbox'), '73.5,19.5,84.5,8.0');
      assert.strictEqual(urlObj.searchParams.get('bounded'), '0', 'bounded must be 0 to allow international searches without hard restriction');
    });

    test('4.3 Clean Indian address formatting preserves locality, city, district, state, and PIN code', async () => {
      const mockRawData = [
        {
          place_id: 112233,
          display_name: 'Anna Nagar West, Chennai, Chennai District, Tamil Nadu, 600040, India',
          lat: '13.0850',
          lon: '80.2100',
          type: 'suburb',
          address: {
            suburb: 'Anna Nagar West',
            city: 'Chennai',
            state_district: 'Chennai District',
            state: 'Tamil Nadu',
            postcode: '600040',
            country: 'India',
            country_code: 'in'
          }
        }
      ];

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => mockRawData
      });

      const service = new GeocodingService({ fetchFn: mockFetch });
      const { results } = await service.search('Anna Nagar West');

      assert.strictEqual(results.length, 1);
      assert.strictEqual(
        results[0].displayName,
        'Anna Nagar West, Chennai, Chennai District, Tamil Nadu - 600040, India'
      );
    });

    test('4.4 International searches preserve non-Indian locations without forced conversion', async () => {
      const mockRawData = [
        {
          place_id: 998877,
          display_name: 'London, Greater London, England, United Kingdom',
          lat: '51.5074',
          lon: '-0.1278',
          type: 'city',
          address: {
            city: 'London',
            state: 'England',
            country: 'United Kingdom',
            country_code: 'gb'
          }
        }
      ];

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => mockRawData
      });

      const service = new GeocodingService({ fetchFn: mockFetch });
      const { results } = await service.search('London');

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].displayName, 'London, Greater London, England, United Kingdom');
      assert.strictEqual(results[0].latitude, 51.5074);
      assert.strictEqual(results[0].longitude, -0.1278);
    });

    test('4.5 Reverse geocoding resolves coordinates via /api/location/reverse', async () => {
      const cacheKey = 'rev:13.08270,80.27070';
      geocodingService.setInCache(cacheKey, {
        id: 'rev-chennai-central',
        displayName: 'Chennai Central, Chennai, Tamil Nadu - 600003, India',
        latitude: 13.0827,
        longitude: 80.2707,
        type: 'railway'
      });

      const res = await fetch(`${baseUrl}/api/location/reverse?lat=13.0827&lng=80.2707`);
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.displayName, 'Chennai Central, Chennai, Tamil Nadu - 600003, India');
      assert.strictEqual(data.data.latitude, 13.0827);
      assert.strictEqual(data.data.longitude, 80.2707);
    });
  });

  describe('5. Small Area / Locality Search & Autocomplete Suite', () => {
    test('5.1 Exact small locality/suburb match outranks broad city/state matches', async () => {
      const mockRawData = [
        {
          place_id: 1,
          name: 'Tamil Nadu',
          display_name: 'Tamil Nadu, India',
          lat: '11.00',
          lon: '78.00',
          type: 'administrative',
          importance: 0.8,
          address: { state: 'Tamil Nadu', country: 'India', country_code: 'in' }
        },
        {
          place_id: 2,
          name: 'Chennai',
          display_name: 'Chennai, Tamil Nadu, India',
          lat: '13.08',
          lon: '80.27',
          type: 'city',
          importance: 0.75,
          address: { city: 'Chennai', state: 'Tamil Nadu', country: 'India', country_code: 'in' }
        },
        {
          place_id: 3,
          name: 'Porur',
          display_name: 'Porur, Chennai, Chennai District, Tamil Nadu, 600116, India',
          lat: '13.03',
          lon: '80.15',
          type: 'suburb',
          importance: 0.5,
          address: { suburb: 'Porur', city: 'Chennai', state: 'Tamil Nadu', postcode: '600116', country: 'India', country_code: 'in' }
        }
      ];

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => mockRawData
      });

      const service = new GeocodingService({ fetchFn: mockFetch });
      const { results } = await service.search('Porur');

      assert.ok(results.length >= 1);
      assert.strictEqual(results[0].title, 'Porur', 'Exact locality must be ranked #1 above broad city/state');
      assert.strictEqual(results[0].subtitle, 'Chennai, Tamil Nadu');
      assert.strictEqual(results[0].type, 'suburb');
    });

    test('5.2 Structured two-line locality display extracts clean title and subtitle', async () => {
      const mockRawData = [
        {
          place_id: 10,
          name: 'Pammal',
          display_name: 'Pammal, Pallavaram, Chengalpattu, Tamil Nadu, 600074, India',
          lat: '12.9696',
          lon: '80.1345',
          type: 'suburb',
          address: {
            suburb: 'Pammal',
            county: 'Pallavaram',
            state_district: 'Chengalpattu',
            state: 'Tamil Nadu',
            postcode: '600074',
            country: 'India',
            country_code: 'in'
          }
        },
        {
          place_id: 20,
          name: 'Kakkanad',
          display_name: 'Kakkanad, Ernakulam, Kanayannur, Ernakulam, Kerala, 682030, India',
          lat: '10.0158',
          lon: '76.3419',
          type: 'suburb',
          address: {
            suburb: 'Kakkanad',
            city_district: 'Ernakulam',
            state: 'Kerala',
            postcode: '682030',
            country: 'India',
            country_code: 'in'
          }
        }
      ];

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => mockRawData
      });

      const service = new GeocodingService({ fetchFn: mockFetch });
      const { results } = await service.search('Pammal');

      const pammal = results.find(r => r.title === 'Pammal');
      assert.ok(pammal);
      assert.strictEqual(pammal.title, 'Pammal');
      assert.strictEqual(pammal.subtitle, 'Chennai, Tamil Nadu');

      const kakkanad = results.find(r => r.title === 'Kakkanad');
      assert.ok(kakkanad);
      assert.strictEqual(kakkanad.title, 'Kakkanad');
      assert.strictEqual(kakkanad.subtitle, 'Kochi, Kerala');
    });

    test('5.3 Deduplication consolidates near-identical practical destinations within 3km', async () => {
      const mockRawData = [
        {
          place_id: 101,
          name: 'Medavakkam',
          display_name: 'Medavakkam, Tambaram, Sholinganallur, Tamil Nadu, 600100, India',
          lat: '12.918',
          lon: '80.192',
          type: 'suburb',
          address: { suburb: 'Medavakkam', city: 'Chennai', state: 'Tamil Nadu', postcode: '600100', country: 'India', country_code: 'in' }
        },
        {
          place_id: 102,
          name: 'Medavakkam',
          display_name: 'Medavakkam, Sivagami Nagar, First Street, Medavakkam, Sholinganallur, Tamil Nadu, 600100, India',
          lat: '12.919',
          lon: '80.193',
          type: 'bus_stop',
          address: { road: 'Medavakkam', suburb: 'Medavakkam', city: 'Chennai', state: 'Tamil Nadu', postcode: '600100', country: 'India', country_code: 'in' }
        }
      ];

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => mockRawData
      });

      const service = new GeocodingService({ fetchFn: mockFetch });
      const { results } = await service.search('Medavakkam');

      assert.strictEqual(results.length, 1, 'Near-identical locality records within 3km must be deduplicated');
      assert.strictEqual(results[0].title, 'Medavakkam');
      assert.strictEqual(results[0].type, 'suburb', 'More specific suburb record must take precedence over bus stop');
    });

    test('5.4 Viewport / user coordinates bias ambiguous localities (Ram Nagar)', async () => {
      const mockRawData = [
        {
          place_id: 201,
          name: 'Ram Nagar',
          display_name: 'Ram Nagar, Coimbatore, Tamil Nadu, India',
          lat: '11.0168',
          lon: '76.9558',
          type: 'suburb',
          address: { suburb: 'Ram Nagar', city: 'Coimbatore', state: 'Tamil Nadu', country: 'India', country_code: 'in' }
        },
        {
          place_id: 202,
          name: 'Ram Nagar',
          display_name: 'Ram Nagar, Chennai, Tamil Nadu, India',
          lat: '12.9800',
          lon: '80.1800',
          type: 'suburb',
          address: { suburb: 'Ram Nagar', city: 'Chennai', state: 'Tamil Nadu', country: 'India', country_code: 'in' }
        }
      ];

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => mockRawData
      });

      const service = new GeocodingService({ fetchFn: mockFetch });
      // When biased near Coimbatore coordinates (11.01, 76.95)
      const resCoimbatore = await service.search('Ram Nagar', { biasLat: 11.01, biasLng: 76.95 });
      assert.strictEqual(resCoimbatore.results[0].subtitle, 'Coimbatore, Tamil Nadu');

      // When biased near Chennai coordinates (13.08, 80.27)
      const resChennai = await service.search('Ram Nagar', { biasLat: 13.08, biasLng: 80.27 });
      assert.strictEqual(resChennai.results[0].subtitle, 'Chennai, Tamil Nadu');
    });

    test('5.5 /api/location/search accepts bias coordinates and passes them to service', async () => {
      const res = await fetch(`${baseUrl}/api/location/search?q=Adyar&biasLat=13.00&biasLng=80.25`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data));
    });

    test('5.6 LocationSearch component accepts biasCoords and supports two-line rendering', () => {
      const componentPath = path.resolve('src/components/map/LocationSearch.jsx');
      const content = fs.readFileSync(componentPath, 'utf8');

      assert.match(content, /biasCoords/, 'LocationSearch must accept biasCoords prop');
      assert.match(content, /item\.title/, 'LocationSearch must render item.title for first-line prominence');
      assert.match(content, /item\.subtitle/, 'LocationSearch must render item.subtitle for second-line context');
    });
  });
});
