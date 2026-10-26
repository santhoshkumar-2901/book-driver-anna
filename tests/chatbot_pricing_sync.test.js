import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from './testHelper.js';
import { 
  buildSystemPrompt, 
  queryGeminiAI, 
  getOfflineChatbotResponse,
  evaluatePricingFreshness 
} from '../server/services/geminiProxyService.js';
import { 
  getAllPricing, 
  updateServicePricing, 
  DEFAULT_PRICING 
} from '../server/services/pricingService.js';
import { getOfflineKnowledgeResponse } from '../src/services/geminiService.js';
import { ENV } from '../server/config/env.js';

describe('Chatbot Pricing Synchronization & Policy Hardening', () => {
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

  // 1. All active pricing categories and 19 keys in system prompt
  test('1. Generated system prompt includes all 19 active pricing keys across driver, vehicle, and class', async () => {
    const { map } = await getAllPricing();
    const prompt = buildSystemPrompt(map, true);

    for (const item of DEFAULT_PRICING) {
      assert.ok(
        prompt.includes(String(item.price)) || prompt.includes(item.price.toLocaleString('en-IN')),
        `Prompt must include price for key '${item.id}' (${item.price})`
      );
    }

    // Verify representations of all categories
    assert.ok(prompt.includes('DRIVER SERVICES'), 'Must group driver services');
    assert.ok(prompt.includes('VEHICLE RENTAL FLEET'), 'Must group vehicle fleet');
    assert.ok(prompt.includes('DOORSTEP DRIVING ACADEMY'), 'Must group driving academy');
  });

  // 2. Reflects admin price update dynamically without server redeployment
  test('2. Chatbot system prompt dynamically reflects admin price updates from database', async () => {
    const { map: initialMap } = await getAllPricing();
    const originalSedanPrice = initialMap.vehicle_sedan_daily.price;
    const testUpdatedPrice = 2499;

    try {
      // Simulate admin tariff update
      await updateServicePricing([{ id: 'vehicle_sedan_daily', price: testUpdatedPrice }], 'admin-test', '127.0.0.1');

      const { map: updatedMap } = await getAllPricing();
      const updatedPrompt = buildSystemPrompt(updatedMap, true);

      assert.strictEqual(updatedMap.vehicle_sedan_daily.price, testUpdatedPrice);
      assert.ok(
        updatedPrompt.includes('₹2,499') || updatedPrompt.includes('₹2499'),
        'System prompt must immediately reflect updated Sedan daily price'
      );
      assert.ok(
        !updatedPrompt.includes(`₹${originalSedanPrice}/day`),
        'System prompt must not retain old Sedan daily price'
      );
    } finally {
      // Revert to original price
      await updateServicePricing([{ id: 'vehicle_sedan_daily', price: originalSedanPrice }], 'admin-test', '127.0.0.1');
    }
  });

  // 3. No active backend prompt or fallback advertises retired outstation tiers
  test('3. Neither backend prompt nor backend offline fallback quotes retired outstation tiers (1,199 / 1,799 / 2,399)', async () => {
    const { map } = await getAllPricing();
    const prompt = buildSystemPrompt(map, true);

    const retiredPatterns = [/150\s*km\s*@\s*₹?1[,.]?199/i, /300\s*km\s*@\s*₹?1[,.]?799/i, /500\s*km\s*@\s*₹?2[,.]?399/i];
    for (const pattern of retiredPatterns) {
      assert.strictEqual(pattern.test(prompt), false, `Backend prompt must not contain retired tier matching ${pattern}`);
    }

    const offlineOutstation = getOfflineChatbotResponse('What are outstation driver rates?', map, true);
    for (const pattern of retiredPatterns) {
      assert.strictEqual(pattern.test(offlineOutstation.text), false, `Backend offline responder must not contain retired tier matching ${pattern}`);
    }
  });

  // 4. No active frontend fallback advertises retired tiers, arbitrary hourly rates, or arbitrary airport package
  test('4. Frontend fallback does not advertise retired tiers, arbitrary hourly rates, or ₹1,499 airport package', () => {
    const outstationReply = getOfflineKnowledgeResponse('Tell me outstation trip rates');
    assert.strictEqual(outstationReply.text.includes('1,199'), false, 'Frontend fallback must not advertise ₹1,199 tier');
    assert.strictEqual(outstationReply.text.includes('1,799'), false, 'Frontend fallback must not advertise ₹1,799 tier');
    assert.strictEqual(outstationReply.text.includes('2,399'), false, 'Frontend fallback must not advertise ₹2,399 tier');

    const vehicleReply = getOfflineKnowledgeResponse('How much to rent a car?');
    assert.strictEqual(vehicleReply.text.includes('399/hr'), false, 'Frontend fallback must not quote ungrounded ₹399/hr');
    assert.strictEqual(vehicleReply.text.includes('599/hr'), false, 'Frontend fallback must not quote ungrounded ₹599/hr');
    assert.strictEqual(vehicleReply.text.includes('999/hr'), false, 'Frontend fallback must not quote ungrounded ₹999/hr');

    const airportReply = getOfflineKnowledgeResponse('kempegowda airport drop price');
    assert.strictEqual(airportReply.text.includes('1,499'), false, 'Frontend fallback must not quote ungrounded ₹1,499 airport package');
  });

  // 5. All 5 vehicle classes and all 4 driving classes represented
  test('5. All 5 vehicle categories and 4 driving classes are represented in prompt and offline responses', async () => {
    const { map } = await getAllPricing();
    const prompt = buildSystemPrompt(map, true);

    const vehicleCategories = ['Sedan', 'SUV', 'Tempo', 'Mini Bus', 'Luxury Coach'];
    for (const cat of vehicleCategories) {
      assert.ok(prompt.includes(cat), `Prompt must represent vehicle category '${cat}'`);
    }

    const drivingClasses = ['Beginner Comprehensive', 'City Confidence', 'Learn in Your Own Car', 'Automatic Car Specialization'];
    for (const cls of drivingClasses) {
      assert.ok(prompt.includes(cls), `Prompt must represent driving class '${cls}'`);
    }

    const offlineVehicles = getOfflineChatbotResponse('rent vehicle fleet', map, true);
    for (const cat of vehicleCategories) {
      assert.ok(offlineVehicles.text.includes(cat), `Offline fallback must represent vehicle category '${cat}'`);
    }

    const offlineClasses = getOfflineChatbotResponse('driving classes', map, true);
    for (const cls of drivingClasses) {
      assert.ok(offlineClasses.text.includes(cls), `Offline fallback must represent driving class '${cls}'`);
    }
  });

  // 6. Missing pricing values do not cause invented prices
  test('6. Missing pricing entries fall back safely without inventing numbers', () => {
    const emptyMap = {};
    const prompt = buildSystemPrompt(emptyMap, false);

    assert.ok(prompt.includes('Real-time database tariffs could not be confirmed'), 'Must notify unconfirmed status');
    assert.ok(prompt.includes('support (+91 78991 20704)'), 'Must guide user to official support');

    const offline = getOfflineChatbotResponse('what are rates?', emptyMap, false);
    assert.ok(offline.text.includes('could not be confirmed right now'), 'Offline responder must warn if not live');
  });

  // 7. Database failure / default fallback is distinguished from confirmed live pricing
  test('7. Database failure/default fallback and partial pricing are explicitly distinguished from confirmed live pricing', () => {
    // 7.1 Full live pricing (all 19 expected keys have valid positive prices and valid updatedAt)
    const mockFullLive = {};
    for (const def of DEFAULT_PRICING) {
      mockFullLive[def.id] = { price: def.price, updatedAt: '2026-10-26T12:00:00Z' };
    }
    const fullEval = evaluatePricingFreshness(mockFullLive);
    assert.strictEqual(fullEval.status, 'LIVE');
    assert.strictEqual(fullEval.isLive, true);
    assert.strictEqual(fullEval.liveCount, 19);

    const livePrompt = buildSystemPrompt(mockFullLive, fullEval);
    assert.ok(livePrompt.includes('AUTHORITATIVE ACTIVE PRICING (Sourced live from database tariffs)'));

    // 7.2 Partial pricing (some keys from DB, some default without updatedAt)
    const mockPartial = {};
    for (let i = 0; i < 5; i++) {
      mockPartial[DEFAULT_PRICING[i].id] = { price: DEFAULT_PRICING[i].price, updatedAt: '2026-10-26T12:00:00Z' };
    }
    for (let i = 5; i < DEFAULT_PRICING.length; i++) {
      mockPartial[DEFAULT_PRICING[i].id] = { price: DEFAULT_PRICING[i].price }; // Missing updatedAt
    }
    const partialEval = evaluatePricingFreshness(mockPartial);
    assert.strictEqual(partialEval.status, 'PARTIAL');
    assert.strictEqual(partialEval.isLive, false);
    assert.strictEqual(partialEval.liveCount, 5);

    const partialPrompt = buildSystemPrompt(mockPartial, partialEval);
    assert.ok(partialPrompt.includes('Incomplete database tariffs detected (5/19 live)'));
    assert.ok(partialPrompt.includes('support (+91 78991 20704)'));

    // 7.3 Missing required key cannot be mislabeled as LIVE even if count >= 19 due to extra keys
    const mockMissingKey = {};
    for (let i = 0; i < 18; i++) {
      mockMissingKey[DEFAULT_PRICING[i].id] = { price: DEFAULT_PRICING[i].price, updatedAt: '2026-10-26T12:00:00Z' };
    }
    // Add 2 non-schema arbitrary keys with valid updatedAt
    mockMissingKey['custom_unauthorized_key_1'] = { price: 50, updatedAt: '2026-10-26T12:00:00Z' };
    mockMissingKey['custom_unauthorized_key_2'] = { price: 50, updatedAt: '2026-10-26T12:00:00Z' };
    const missingKeyEval = evaluatePricingFreshness(mockMissingKey);
    assert.strictEqual(missingKeyEval.status, 'PARTIAL', 'Missing 19th active key must remain PARTIAL, not LIVE');
    assert.strictEqual(missingKeyEval.isLive, false);
    assert.strictEqual(missingKeyEval.liveCount, 18);

    // 7.4 Malformed timestamp cannot be counted as live
    const mockMalformedTimestamp = {};
    for (const def of DEFAULT_PRICING) {
      mockMalformedTimestamp[def.id] = { price: def.price, updatedAt: '2026-10-26T12:00:00Z' };
    }
    mockMalformedTimestamp['driver_price_per_km'].updatedAt = 'NOT_A_VALID_DATE_STRING';
    const malformedTimestampEval = evaluatePricingFreshness(mockMalformedTimestamp);
    assert.strictEqual(malformedTimestampEval.status, 'PARTIAL', 'Malformed timestamp must not be counted as live');
    assert.strictEqual(malformedTimestampEval.isLive, false);
    assert.strictEqual(malformedTimestampEval.liveCount, 18);

    // 7.5 Valid zero-valued tariff qualifies as LIVE when all required keys and timestamps are valid
    const mockZeroTariffLive = {};
    for (const def of DEFAULT_PRICING) {
      mockZeroTariffLive[def.id] = { price: def.price, updatedAt: '2026-10-26T12:00:00Z' };
    }
    // Legitimate promotional base fare set to 0 by admin
    mockZeroTariffLive['driver_base_fare'].price = 0;
    const zeroTariffEval = evaluatePricingFreshness(mockZeroTariffLive);
    assert.strictEqual(zeroTariffEval.status, 'LIVE', 'Zero-valued tariff must qualify as LIVE in non-negative pricing schema');
    assert.strictEqual(zeroTariffEval.isLive, true);
    assert.strictEqual(zeroTariffEval.liveCount, 19);

    // 7.6 Negative prices, NaN, and non-numeric values are rejected from live count
    const mockInvalidPrice = {};
    for (const def of DEFAULT_PRICING) {
      mockInvalidPrice[def.id] = { price: def.price, updatedAt: '2026-10-26T12:00:00Z' };
    }
    mockInvalidPrice['driver_base_fare'].price = -100; // negative
    mockInvalidPrice['driver_min_fare'].price = NaN;   // NaN
    mockInvalidPrice['driver_monthly'].price = 'invalid_price'; // non-numeric
    const invalidPriceEval = evaluatePricingFreshness(mockInvalidPrice);
    assert.strictEqual(invalidPriceEval.status, 'PARTIAL', 'Negative, NaN, or non-numeric prices cannot qualify as live');
    assert.strictEqual(invalidPriceEval.isLive, false);
    assert.strictEqual(invalidPriceEval.liveCount, 16);

    // 7.7 Default fallback (database error or empty DB: zero items have updatedAt)
    const mockFallback = {};
    for (const def of DEFAULT_PRICING) {
      mockFallback[def.id] = { price: def.price }; // Zero items with updatedAt
    }
    const fallbackEval = evaluatePricingFreshness(mockFallback);
    assert.strictEqual(fallbackEval.status, 'FALLBACK_DEFAULTS');
    assert.strictEqual(fallbackEval.isLive, false);
    assert.strictEqual(fallbackEval.liveCount, 0);

    const fallbackPrompt = buildSystemPrompt(mockFallback, fallbackEval);
    assert.ok(fallbackPrompt.includes('Real-time database tariffs could not be confirmed'));

    // 7.8 Null or invalid pricing map
    const nullEval = evaluatePricingFreshness(null);
    assert.strictEqual(nullEval.status, 'UNAVAILABLE');
    assert.strictEqual(nullEval.isLive, false);

    const emptyEval = evaluatePricingFreshness({});
    assert.strictEqual(emptyEval.status, 'FALLBACK_DEFAULTS');
    assert.strictEqual(emptyEval.isLive, false);
  });

  // 8. Missing Gemini key and Gemini API errors trigger safe fallback behavior
  test('8. Safe fallback behavior works when Gemini key is missing, API throws error, or returns invalid response', async () => {
    // 8.1 When GEMINI_API_KEY is not configured
    const originalKey = ENV.GEMINI_API_KEY;
    const originalFetch = globalThis.fetch;

    try {
      ENV.GEMINI_API_KEY = '';
      const res = await queryGeminiAI('What is the price of driver service?');
      assert.ok(res && typeof res.text === 'string', 'Must return response object with text');
      assert.ok(res.text.includes('₹15/km'), 'Must return verified distance rate');
      assert.ok(!res.text.includes('₹1,199'), 'Must not return retired tier in fallback');

      // 8.2 When GEMINI_API_KEY is configured and fetch throws an error (e.g. network failure / timeout)
      ENV.GEMINI_API_KEY = 'test-gemini-key-123';
      globalThis.fetch = async () => {
        throw new Error('Network timeout connecting to Gemini API');
      };

      const errorFallbackRes = await queryGeminiAI('What are driver rates?');
      assert.ok(errorFallbackRes && typeof errorFallbackRes.text === 'string', 'Must gracefully fall back without throwing ReferenceError');
      assert.ok(errorFallbackRes.text.includes('₹15/km'), 'Fallback must contain authoritative tariffs');

      // 8.3 When GEMINI_API_KEY is configured and fetch returns HTTP 500 error status
      globalThis.fetch = async () => {
        return new Response(JSON.stringify({ error: { message: 'Internal Server Error' } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const http500FallbackRes = await queryGeminiAI('What are rental vehicle fleet options?');
      assert.ok(http500FallbackRes && typeof http500FallbackRes.text === 'string');
      assert.ok(http500FallbackRes.text.includes('Sedan'));

      // 8.4 When Gemini API returns 200 OK but with empty candidates (no usable text)
      globalThis.fetch = async () => {
        return new Response(JSON.stringify({ candidates: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const emptyCandidateRes = await queryGeminiAI('Tell me about driving classes');
      assert.ok(emptyCandidateRes && typeof emptyCandidateRes.text === 'string');
      assert.ok(emptyCandidateRes.text.includes('Beginner Comprehensive Course'));

      // 8.5 Offline fallback receives and correctly formats pricing freshness
      const fallbackWarningTest = getOfflineChatbotResponse('driver rates', null, false);
      assert.ok(fallbackWarningTest.text.includes('Live database tariffs could not be confirmed right now'));

      const fallbackLiveTest = getOfflineChatbotResponse('driver rates', null, true);
      assert.ok(!fallbackLiveTest.text.includes('Live database tariffs could not be confirmed right now'));
    } finally {
      ENV.GEMINI_API_KEY = originalKey;
      globalThis.fetch = originalFetch;
    }
  });

  // 9. Customer PII and booking records are never inserted into the system prompt
  test('9. Customer PII, tokens, and booking records are never inserted into system prompt', async () => {
    const { map } = await getAllPricing();
    const prompt = buildSystemPrompt(map, true);

    const sensitiveTerms = ['password', 'secret', 'token', 'jwt', 'customer_phone', 'customer_email', 'booking_id', 'users', 'SELECT *'];
    for (const term of sensitiveTerms) {
      assert.strictEqual(prompt.includes(term), false, `System prompt must not contain sensitive term '${term}'`);
    }
  });

  // 10. Existing API response shape, validation, and rate limiting remain unchanged
  test('10. POST /api/chat preserves request validation, rate limiting, and response contract', async () => {
    // 10.1 Rejects empty or missing message
    const emptyRes = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(emptyRes.status, 400);
    const emptyJson = await emptyRes.json();
    assert.strictEqual(emptyJson.success, false);
    assert.strictEqual(emptyJson.error.code, 'INVALID_INPUT');

    // 10.2 Valid request returns correct contract: { success: true, data: { text: string } }
    const validRes = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What is the sedan daily rental?' })
    });
    assert.strictEqual(validRes.status, 200);
    const validJson = await validRes.json();
    assert.strictEqual(validJson.success, true);
    assert.ok(typeof validJson.data.text === 'string');
    assert.ok(validJson.data.text.includes('Sedan'));
  });

  // 11. Policy responses do not promise automatic refunds or guaranteed 24/7 dispatch
  test('11. Policy instructions do not promise automatic refunds or guaranteed 24/7 dispatch', async () => {
    const { map } = await getAllPricing();
    const prompt = buildSystemPrompt(map, true);

    assert.ok(prompt.includes('Do not promise automatic refunds'), 'Must forbid promising automatic refunds');
    assert.ok(prompt.includes('Do not claim guaranteed 24/7 driver dispatch'), 'Must forbid claiming guaranteed 24/7 dispatch');
    assert.ok(prompt.includes('+91 78991 20704'), 'Must include official verified phone helpline');
  });
});
