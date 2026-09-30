import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generateClientBookingIdempotencyKey } from '../src/utils/idempotency.js';
import { queryOne, queryAll, execute } from '../server/db/database.js';
import { createBooking } from '../server/services/bookingService.js';
import {
  authRateLimiter,
  bookingRateLimiter,
  generalRateLimiter,
  chatRateLimiter,
  lookupRateLimiter
} from '../server/middleware/rateLimiter.js';
import { RATE_LIMITS } from '../server/config/security.js';

describe('Phase 5B — Client Idempotency, Mock Data Removal & Rate-Limit Hardening Suite', () => {

  describe('B1: Client Booking Idempotency', () => {
    test('1.1 generateClientBookingIdempotencyKey returns a cryptographically strong UUID format', () => {
      const key1 = generateClientBookingIdempotencyKey();
      const key2 = generateClientBookingIdempotencyKey();

      assert.equal(typeof key1, 'string');
      assert.equal(typeof key2, 'string');
      assert.notEqual(key1, key2, 'Consecutive keys must be uniquely generated');

      // UUID format validation: 8-4-4-4-12 hex characters
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      assert.match(key1, uuidRegex, 'Idempotency key must match standard UUID format');
      assert.match(key2, uuidRegex, 'Idempotency key must match standard UUID format');
    });

    test('1.2 BookingModal tracks idempotencyKey in ref, resets on modal open, and preserves key on error', () => {
      const bookingModalPath = path.resolve(process.cwd(), 'src/components/BookingModal.jsx');
      const content = fs.readFileSync(bookingModalPath, 'utf8');

      // Verifies ref usage
      assert.match(content, /const idempotencyKeyRef = useRef\(null\);/, 'BookingModal must use idempotencyKeyRef');

      // Verifies generation when modal opens
      assert.match(
        content,
        /idempotencyKeyRef\.current = generateClientBookingIdempotencyKey\(\);/,
        'BookingModal must initialize idempotencyKeyRef when modal opens'
      );

      // Verifies reset on explicit resetForm
      assert.match(
        content,
        /idempotencyKeyRef\.current = null;/,
        'BookingModal must clear idempotencyKeyRef on reset'
      );

      // Verifies payload receives key
      assert.match(
        content,
        /payloadForApi\.idempotencyKey = currentIdempotencyKey;/,
        'BookingModal must pass idempotencyKey to API payload'
      );

      // Verifies catch does NOT clear the ref so retries reuse the key
      const catchBlock = content.slice(content.indexOf('catch (apiErr)'), content.indexOf('finally {'));
      assert.doesNotMatch(
        catchBlock,
        /idempotencyKeyRef\.current = null;/,
        'Catch block must NOT reset idempotency key on failure so retries reuse the same key'
      );
    });

    test('1.3 Backend enforces idempotency with duplicate detection on repeated submission', async () => {
      const testIdemKey = generateClientBookingIdempotencyKey();
      const bookingData = {
        userId: null,
        customerName: 'Idempotency Test User',
        customerPhone: '+91 9988776655',
        customerEmail: 'idempotent@test.com',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        date: '2026-10-15',
        time: '10:00 AM',
        paymentMode: 'cash',
        idempotencyKey: testIdemKey,
        ipAddress: '127.0.0.1'
      };

      // First submission
      const res1 = await createBooking(bookingData);
      assert.ok(res1.booking, 'First submission must create booking');
      assert.equal(res1.isDuplicate, false, 'First submission is not a duplicate');
      assert.equal(res1.booking.idempotency_key, testIdemKey);

      const firstBookingId = res1.booking.id;

      // Repeated submission with exact same idempotency key
      const res2 = await createBooking(bookingData);
      assert.ok(res2.booking, 'Repeated submission must return booking');
      assert.equal(res2.isDuplicate, true, 'Repeated submission must be flagged as duplicate');
      assert.equal(res2.booking.id, firstBookingId, 'Repeated submission must return the exact same booking ID');

      // Verify database contains only 1 record with this idempotency key
      const records = await queryAll('SELECT id FROM bookings WHERE idempotency_key = ?', [testIdemKey]);
      assert.equal(records.length, 1, 'Only one booking row must exist in DB for the idempotency key');
    });

    test('1.4 No synthetic BDA-XXXXXX booking ID is fabricated in frontend App or BookingModal', () => {
      const appContent = fs.readFileSync(path.resolve(process.cwd(), 'src/App.jsx'), 'utf8');
      const bookingModalContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/BookingModal.jsx'), 'utf8');

      // App.jsx must not fabricate BDA-DRV-, BDA-VEH-, or BDA-CLS- with Math.random()
      assert.doesNotMatch(
        appContent,
        /BDA-DRV-['"]\s*\+\s*Math\.floor/,
        'App.jsx must not synthesize fake BDA-DRV- booking IDs'
      );
      assert.doesNotMatch(
        appContent,
        /BDA-VEH-['"]\s*\+\s*Math\.floor/,
        'App.jsx must not synthesize fake BDA-VEH- booking IDs'
      );
      assert.doesNotMatch(
        appContent,
        /BDA-CLS-['"]\s*\+\s*Math\.floor/,
        'App.jsx must not synthesize fake BDA-CLS- booking IDs'
      );

      // BookingModal must never synthesize BDA-XXXX booking IDs
      assert.doesNotMatch(
        bookingModalContent,
        /BDA-['"]\s*\+\s*Math\.floor/,
        'BookingModal must never synthesize fake BDA- booking IDs'
      );
    });
  });

  describe('B2: Removal of Mock Driver Fallbacks & Verification', () => {
    test('2.1 AdminDriverTab contains zero references to DRV-SANMU or hardcoded mock driver list', () => {
      const driverTabContent = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/admin/AdminDriverTab.jsx'), 'utf8');

      assert.doesNotMatch(driverTabContent, /DRV-SANMU/, 'AdminDriverTab must not contain DRV-SANMU');
      assert.doesNotMatch(driverTabContent, /DRV-RAJESH/, 'AdminDriverTab must not contain DRV-RAJESH');
      assert.doesNotMatch(driverTabContent, /DRV-RAMESH/, 'AdminDriverTab must not contain DRV-RAMESH');
      assert.doesNotMatch(driverTabContent, /DRV-MANJU/, 'AdminDriverTab must not contain DRV-MANJU');
      assert.doesNotMatch(driverTabContent, /list\.push\(\s*\{\s*id:\s*['"]DRV-/, 'AdminDriverTab must not push mock driver objects');
    });

    test('2.2 Empty driver fleet produces explicit "No drivers available" state', () => {
      const driverTabContent = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/admin/AdminDriverTab.jsx'), 'utf8');
      assert.ok(
        driverTabContent.includes('No drivers available'),
        'AdminDriverTab must render "No drivers available" when fleet is empty'
      );

      const modalContent = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/admin/AssignDriverModal.jsx'), 'utf8');
      assert.ok(
        modalContent.includes('No registered drivers available in fleet'),
        'AssignDriverModal must render empty notice when registeredDrivers is empty'
      );
    });

    test('2.3 AdminPage syncs drivers from backend and blocks unverified driver assignment', () => {
      const adminPageContent = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/AdminPage.jsx'), 'utf8');

      // Verifies backend sync
      assert.match(
        adminPageContent,
        /apiClient\.getAdminDrivers\(\)/,
        'AdminPage must fetch drivers from backend using apiClient.getAdminDrivers()'
      );

      // Verifies strict validation of matched driver before assigning
      assert.match(
        adminPageContent,
        /if \(!matchedDriver \|\| !matchedDriver\.id\)/,
        'handleAcceptAndAssignDriver must reject assignment if driver is not in verified fleet'
      );
      assert.ok(
        adminPageContent.includes('Cannot assign driver: Please select a verified driver from the fleet'),
        'AdminPage must alert when attempting to assign unverified or fabricated driver'
      );
    });

    test('2.4 AssignDriverModal validates that selected driver exists in registered fleet', () => {
      const modalContent = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/admin/AssignDriverModal.jsx'), 'utf8');

      assert.match(
        modalContent,
        /if \(!registeredDrivers \|\| registeredDrivers\.length === 0\)/,
        'AssignDriverModal must block proceeding when fleet is empty'
      );
      assert.match(
        modalContent,
        /if \(!matched \|\| !matched\.id\)/,
        'AssignDriverModal must verify that driver exists in registeredDrivers'
      );
    });
  });

  describe('B3: Rate Limiting Review & Hardening', () => {
    test('3.1 Rate limiters are defined for sensitive routes with production configuration', () => {
      assert.equal(typeof authRateLimiter, 'function');
      assert.equal(typeof bookingRateLimiter, 'function');
      assert.equal(typeof generalRateLimiter, 'function');
      assert.equal(typeof chatRateLimiter, 'function');
      assert.equal(typeof lookupRateLimiter, 'function');

      // Rate limit configuration inspection
      assert.equal(RATE_LIMITS.AUTH.windowMs, 15 * 60 * 1000);
      assert.equal(RATE_LIMITS.BOOKINGS.windowMs, 60 * 60 * 1000);
      assert.equal(RATE_LIMITS.BOOKINGS.max, 20);
      assert.equal(RATE_LIMITS.LOOKUP.windowMs, 15 * 60 * 1000);
      assert.equal(RATE_LIMITS.LOOKUP.max, 20);
    });

    test('3.2 Test mode bypass is strictly restricted to automated test environment', () => {
      const rateLimiterContent = fs.readFileSync(path.resolve(process.cwd(), 'server/middleware/rateLimiter.js'), 'utf8');

      // Verify that every limiter enforces test environment check
      const skipMatches = rateLimiterContent.match(/skip:\s*\(req\)\s*=>\s*process\.env\.NODE_ENV === 'test' && !req\.headers\['x-test-rate-limit'\]/g);
      assert.ok(skipMatches && skipMatches.length >= 5, 'All 5 rate limiters must enforce test-only skip check');

      // Architectural documentation presence
      assert.ok(
        rateLimiterContent.includes('PRODUCTION RATE LIMITING ARCHITECTURAL NOTE'),
        'rateLimiter.js must include architectural documentation of MemoryStore limitations'
      );
      assert.ok(
        rateLimiterContent.includes('Upstash Redis'),
        'rateLimiter.js must document recommended Upstash Redis upgrade path'
      );
    });

    test('3.3 Sensitive routes retain their rate limiters in route declarations', () => {
      const authRoutes = fs.readFileSync(path.resolve(process.cwd(), 'server/routes/auth.js'), 'utf8');
      assert.ok(authRoutes.includes("router.post('/login', authRateLimiter,"), 'auth login must be rate limited');
      assert.ok(authRoutes.includes("router.post('/register', authRateLimiter,"), 'auth register must be rate limited');
      assert.ok(authRoutes.includes("router.post('/forgot-password', authRateLimiter,"), 'forgot-password must be rate limited');
      assert.ok(authRoutes.includes("router.post('/reset-password', authRateLimiter,"), 'reset-password must be rate limited');

      const bookingRoutes = fs.readFileSync(path.resolve(process.cwd(), 'server/routes/bookings.js'), 'utf8');
      assert.ok(bookingRoutes.includes("router.post('/', bookingRateLimiter,"), 'booking creation must be rate limited');
      assert.ok(bookingRoutes.includes("router.post('/lookup', lookupRateLimiter,"), 'booking lookup must be rate limited');

      const chatRoutes = fs.readFileSync(path.resolve(process.cwd(), 'server/routes/chat.js'), 'utf8');
      assert.ok(chatRoutes.includes("router.post('/', chatRateLimiter,"), 'chat must be rate limited');
    });
  });
});
