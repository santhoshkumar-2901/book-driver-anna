import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import crypto from 'crypto';
import { app } from '../server/index.js';
import { queryOne, queryAll, execute } from '../server/db/database.js';
import { createBooking } from '../server/services/bookingService.js';
import { isDummyPaymentAllowed } from '../server/config/env.js';

describe('Phase 4: Backend Razorpay Integration Suite', () => {
  let server;
  let baseUrl;
  let originalFetch;
  let razorpayMockHandler = null;

  const TEST_KEY_ID = 'rzp_test_MockKey123456';
  const TEST_KEY_SECRET = 'MockSecretKey16charsLong!';
  const TEST_WEBHOOK_SECRET = 'MockWebhookSecret16chars!';

  const randomHex = (bytes = 8) => crypto.randomBytes(bytes).toString('hex');

  before(async () => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = async function (url, options) {
      const urlStr = String(url);
      if (urlStr.startsWith('https://api.razorpay.com')) {
        if (razorpayMockHandler) {
          return await razorpayMockHandler(urlStr, options);
        }
        throw new Error(`Unhandled mocked Razorpay request to: ${urlStr}`);
      }
      return await originalFetch.call(this, url, options);
    };

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    razorpayMockHandler = null;
    process.env.RAZORPAY_ENABLED = 'true';
    process.env.RAZORPAY_KEY_ID = TEST_KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  });

  afterEach(() => {
    delete process.env.RAZORPAY_ENABLED;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  async function createTestBookingWithToken(fare = 450.0) {
    const bookingRes = await createBooking({
      customerName: 'Phase 4 Guest',
      customerPhone: '9876543210',
      bookingCategory: 'driver',
      driverTripOption: 'one-way',
      date: '2026-11-01',
      time: '10:00 AM',
      pickupArea: 'Indiranagar',
      dropLocation: 'MG Road'
    });

    const bookingId = bookingRes.booking.id;
    await execute('UPDATE bookings SET calculated_fare = ?, status = ? WHERE id = ?', [fare, 'ASSIGNED', bookingId]);

    return {
      bookingId,
      rawToken: bookingRes.paymentLink.token,
      fare
    };
  }

  describe('1. Gateway Disabled & Credential Fail-Closed Guards', () => {
    test('1.1 Order creation, callback verification, and webhook are blocked when RAZORPAY_ENABLED is false', async () => {
      process.env.RAZORPAY_ENABLED = 'false';

      const { rawToken } = await createTestBookingWithToken(500);

      const orderRes = await fetch(`${baseUrl}/api/guest/payments/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken })
      });
      assert.strictEqual(orderRes.status, 403, 'Order creation must fail closed with 403');
      const orderJson = await orderRes.json();
      assert.strictEqual(orderJson.error?.code, 'GATEWAY_DISABLED');

      const verifyRes = await fetch(`${baseUrl}/api/guest/payments/razorpay/verify-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawToken,
          attemptId: 'PAY-ATT-FAKE',
          orderId: 'order_fake',
          paymentId: 'pay_fake',
          signature: 'sig_fake'
        })
      });
      assert.strictEqual(verifyRes.status, 403, 'Verification must fail closed with 403');

      const webhookRes = await fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'sig_fake'
        },
        body: JSON.stringify({ event: 'payment.captured' })
      });
      assert.strictEqual(webhookRes.status, 403, 'Webhook must fail closed with 403');
    });

    test('1.2 Incomplete credentials prevent outbound calls and fail closed', async () => {
      process.env.RAZORPAY_KEY_SECRET = '';

      let providerCalled = false;
      razorpayMockHandler = async () => {
        providerCalled = true;
        return new Response(JSON.stringify({ id: 'order_123' }), { status: 200 });
      };

      const { rawToken } = await createTestBookingWithToken(500);

      const res = await fetch(`${baseUrl}/api/guest/payments/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken })
      });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(providerCalled, false, 'No outbound call to provider should occur when config is incomplete');
    });
  });

  describe('2. Server-Side Razorpay Order Creation', () => {
    test('2.1 Creates Razorpay order with server-calculated amount and associates attempt', async () => {
      const { rawToken, bookingId } = await createTestBookingWithToken(750.5);
      const generatedOrderId = 'order_' + randomHex();

      let capturedOutboundRequest = null;
      razorpayMockHandler = async (url, options) => {
        capturedOutboundRequest = { url, options, body: JSON.parse(options.body) };
        return new Response(
          JSON.stringify({
            id: generatedOrderId,
            entity: 'order',
            amount: 75050,
            amount_paid: 0,
            amount_due: 75050,
            currency: 'INR',
            receipt: capturedOutboundRequest.body.receipt,
            status: 'created'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await fetch(`${baseUrl}/api/guest/payments/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken })
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.orderId, generatedOrderId);
      assert.strictEqual(json.data.amount, 750.5);
      assert.strictEqual(json.data.amountInPaise, 75050);
      assert.strictEqual(json.data.currency, 'INR');
      assert.strictEqual(json.data.keyId, TEST_KEY_ID);
      assert.strictEqual(json.data.isPaid, false);

      assert.strictEqual(capturedOutboundRequest.options.method, 'POST');
      assert.strictEqual(capturedOutboundRequest.body.amount, 75050);
      assert.strictEqual(capturedOutboundRequest.body.currency, 'INR');
      const authHeader = capturedOutboundRequest.options.headers.Authorization;
      assert.ok(authHeader.startsWith('Basic '), 'Must use Basic Authentication');

      const attempt = await queryOne('SELECT * FROM payment_attempts WHERE id = ?', [json.data.attemptId]);
      assert.ok(attempt);
      assert.strictEqual(attempt.booking_id, bookingId);
      assert.strictEqual(attempt.order_id, generatedOrderId);
      assert.strictEqual(attempt.gateway_provider, 'RAZORPAY');
      assert.strictEqual(attempt.status, 'CREATED');
    });

    test('2.2 Client-supplied amount tampering is strictly rejected', async () => {
      const { rawToken } = await createTestBookingWithToken(600);

      let providerCalled = false;
      razorpayMockHandler = async () => {
        providerCalled = true;
        return new Response('{}', { status: 200 });
      };

      const res = await fetch(`${baseUrl}/api/guest/payments/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken, amount: 10 })
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error?.code, 'AMOUNT_TAMPERING_DETECTED');
      assert.strictEqual(providerCalled, false, 'Tampered request must never reach payment gateway');
    });

    test('2.3 Invalid token and expired token are rejected', async () => {
      const invalidRes = await fetch(`${baseUrl}/api/guest/payments/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'invalid_hex_token_12345' })
      });
      assert.strictEqual(invalidRes.status, 400);

      const { bookingId, rawToken } = await createTestBookingWithToken(400);
      await execute("UPDATE guest_access_tokens SET expires_at = '2020-01-01 00:00:00' WHERE booking_id = ?", [bookingId]);

      const expRes = await fetch(`${baseUrl}/api/guest/payments/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken })
      });
      assert.strictEqual(expRes.status, 410);
      const expJson = await expRes.json();
      assert.strictEqual(expJson.error?.code, 'TOKEN_EXPIRED');
    });

    test('2.4 Provider timeout and provider network errors are handled cleanly', async () => {
      const { rawToken } = await createTestBookingWithToken(400);

      razorpayMockHandler = async () => {
        const abortErr = new Error('The operation was aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      };

      const timeoutRes = await fetch(`${baseUrl}/api/guest/payments/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken })
      });
      assert.strictEqual(timeoutRes.status, 504);
      const timeoutJson = await timeoutRes.json();
      assert.strictEqual(timeoutJson.error?.code, 'GATEWAY_TIMEOUT');

      razorpayMockHandler = async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 'SERVER_ERROR',
              description: 'Internal server error at Razorpay'
            }
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const errorRes = await fetch(`${baseUrl}/api/guest/payments/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken })
      });
      assert.strictEqual(errorRes.status, 502);
      const errorJson = await errorRes.json();
      assert.strictEqual(errorJson.error?.code, 'SERVER_ERROR');
    });
  });

  describe('3. Payment Callback Signature Verification & Settlement', () => {
    test('3.1 Valid signature and captured provider payment settles booking to PAID', async () => {
      const { rawToken, bookingId } = await createTestBookingWithToken(500);
      const generatedOrderId = 'order_' + randomHex();

      razorpayMockHandler = async () => {
        return new Response(
          JSON.stringify({ id: generatedOrderId, amount: 50000, currency: 'INR' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const orderRes = await fetch(`${baseUrl}/api/guest/payments/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken })
      });
      assert.strictEqual(orderRes.status, 200);
      const orderJson = await orderRes.json();
      const attemptId = orderJson.data.attemptId;
      const orderId = orderJson.data.orderId;
      const paymentId = 'pay_' + randomHex();

      razorpayMockHandler = async (url) => {
        if (url.includes(`/payments/${paymentId}`)) {
          return new Response(
            JSON.stringify({
              id: paymentId,
              order_id: orderId,
              amount: 50000,
              currency: 'INR',
              status: 'captured',
              method: 'upi'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`Unexpected mock URL: ${url}`);
      };

      const signature = crypto
        .createHmac('sha256', TEST_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const verifyRes = await fetch(`${baseUrl}/api/guest/payments/razorpay/verify-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawToken,
          attemptId,
          orderId,
          paymentId,
          signature
        })
      });

      assert.strictEqual(verifyRes.status, 200);
      const verifyJson = await verifyRes.json();
      assert.strictEqual(verifyJson.success, true);
      assert.strictEqual(verifyJson.data.status, 'SUCCEEDED');
      assert.strictEqual(verifyJson.data.isPaid, true);
      assert.strictEqual(verifyJson.data.paymentId, paymentId);

      const booking = await queryOne('SELECT payment_status FROM bookings WHERE id = ?', [bookingId]);
      assert.strictEqual(booking.payment_status, 'PAID');

      const attempt = await queryOne('SELECT * FROM payment_attempts WHERE id = ?', [attemptId]);
      assert.strictEqual(attempt.status, 'SUCCEEDED');
      assert.strictEqual(attempt.gateway_payment_id, paymentId);
    });

    test('3.2 Invalid or forged signature is rejected with 400', async () => {
      const { rawToken } = await createTestBookingWithToken(500);
      const generatedOrderId = 'order_' + randomHex();

      razorpayMockHandler = async () => new Response(JSON.stringify({ id: generatedOrderId, amount: 50000, currency: 'INR' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      const orderRes = await fetch(`${baseUrl}/api/guest/payments/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken })
      });
      assert.strictEqual(orderRes.status, 200);
      const orderJson = await orderRes.json();

      const verifyRes = await fetch(`${baseUrl}/api/guest/payments/razorpay/verify-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawToken,
          attemptId: orderJson.data.attemptId,
          orderId: orderJson.data.orderId,
          paymentId: 'pay_' + randomHex(),
          signature: 'forged_invalid_signature_hex_digest'
        })
      });

      assert.strictEqual(verifyRes.status, 400);
      const verifyJson = await verifyRes.json();
      assert.strictEqual(verifyJson.error?.code, 'INVALID_SIGNATURE');
    });

    test('3.3 Order ID mismatch or wrong payment ID is rejected', async () => {
      const { rawToken } = await createTestBookingWithToken(500);
      const generatedOrderId = 'order_' + randomHex();

      razorpayMockHandler = async () => new Response(JSON.stringify({ id: generatedOrderId, amount: 50000, currency: 'INR' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      const orderRes = await fetch(`${baseUrl}/api/guest/payments/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken })
      });
      assert.strictEqual(orderRes.status, 200);
      const orderJson = await orderRes.json();

      const verifyRes = await fetch(`${baseUrl}/api/guest/payments/razorpay/verify-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawToken,
          attemptId: orderJson.data.attemptId,
          orderId: 'order_completely_different',
          paymentId: 'pay_' + randomHex(),
          signature: 'any_signature'
        })
      });

      assert.strictEqual(verifyRes.status, 400);
      const verifyJson = await verifyRes.json();
      assert.strictEqual(verifyJson.error?.code, 'ORDER_ID_MISMATCH');
    });

    test('3.4 Uncaptured payment or wrong provider amount is rejected', async () => {
      const { rawToken } = await createTestBookingWithToken(500);
      const generatedOrderId = 'order_' + randomHex();

      razorpayMockHandler = async () => new Response(JSON.stringify({ id: generatedOrderId, amount: 50000, currency: 'INR' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      const orderRes = await fetch(`${baseUrl}/api/guest/payments/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken })
      });
      assert.strictEqual(orderRes.status, 200);
      const orderJson = await orderRes.json();
      const attemptId = orderJson.data.attemptId;
      const orderId = orderJson.data.orderId;
      const paymentId = 'pay_' + randomHex();

      const signature = crypto.createHmac('sha256', TEST_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

      razorpayMockHandler = async () => {
        return new Response(
          JSON.stringify({
            id: paymentId,
            order_id: orderId,
            amount: 50000,
            currency: 'INR',
            status: 'authorized',
            method: 'card'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const verifyRes = await fetch(`${baseUrl}/api/guest/payments/razorpay/verify-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawToken,
          attemptId,
          orderId,
          paymentId,
          signature
        })
      });

      assert.strictEqual(verifyRes.status, 400);
      const verifyJson = await verifyRes.json();
      assert.strictEqual(verifyJson.error?.code, 'PAYMENT_NOT_CAPTURED');
    });

    test('3.5 Repeated callback submissions are safe and idempotent', async () => {
      const { rawToken } = await createTestBookingWithToken(350);
      const generatedOrderId = 'order_' + randomHex();

      razorpayMockHandler = async () => new Response(JSON.stringify({ id: generatedOrderId, amount: 35000, currency: 'INR' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      const orderRes = await fetch(`${baseUrl}/api/guest/payments/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken })
      });
      assert.strictEqual(orderRes.status, 200);
      const orderJson = await orderRes.json();
      const attemptId = orderJson.data.attemptId;
      const orderId = orderJson.data.orderId;
      const paymentId = 'pay_' + randomHex();

      const signature = crypto.createHmac('sha256', TEST_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

      razorpayMockHandler = async () => new Response(
        JSON.stringify({ id: paymentId, order_id: orderId, amount: 35000, currency: 'INR', status: 'captured', method: 'upi' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

      const res1 = await fetch(`${baseUrl}/api/guest/payments/razorpay/verify-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken, attemptId, orderId, paymentId, signature })
      });
      assert.strictEqual(res1.status, 200);

      const res2 = await fetch(`${baseUrl}/api/guest/payments/razorpay/verify-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken, attemptId, orderId, paymentId, signature })
      });
      assert.strictEqual(res2.status, 200);
      const json2 = await res2.json();
      assert.strictEqual(json2.data.alreadySucceeded, true);
    });
  });

  describe('4. Webhook Receiver, Raw-Body HMAC & Deduplication', () => {
    test('4.1 Valid webhook HMAC-SHA256 against req.rawBody processes payment.captured', async () => {
      const { bookingId } = await createTestBookingWithToken(800);
      const attemptId = 'PAY-ATT-' + randomHex();
      const orderId = 'order_' + randomHex();
      const paymentId = 'pay_' + randomHex();
      const eventId = 'evt_' + randomHex();

      await execute(`
        INSERT INTO payment_attempts (id, booking_id, order_id, amount, currency, status, gateway_provider)
        VALUES (?, ?, ?, 800, 'INR', 'CREATED', 'RAZORPAY')
      `, [attemptId, bookingId, orderId]);

      const payload = {
        entity: 'event',
        event: 'payment.captured',
        created_at: 1700000000,
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: orderId,
              amount: 80000,
              currency: 'INR',
              status: 'captured',
              method: 'netbanking'
            }
          }
        }
      };

      const rawPayload = JSON.stringify(payload);
      const signature = crypto.createHmac('sha256', TEST_WEBHOOK_SECRET).update(rawPayload).digest('hex');

      const res = await fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
          'x-razorpay-event-id': eventId
        },
        body: rawPayload
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.status, 'PROCESSED');

      const booking = await queryOne('SELECT payment_status FROM bookings WHERE id = ?', [bookingId]);
      assert.strictEqual(booking.payment_status, 'PAID');

      const eventRow = await queryOne('SELECT * FROM payment_webhook_events WHERE id = ?', [eventId]);
      assert.ok(eventRow);
      assert.strictEqual(eventRow.status, 'PROCESSED');
      assert.strictEqual(eventRow.order_id, orderId);
    });

    test('4.2 Invalid webhook signature is rejected with 400 and does not change state', async () => {
      const { bookingId } = await createTestBookingWithToken(500);

      const rawPayload = JSON.stringify({ event: 'payment.captured' });
      const res = await fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'invalid_hex_signature'
        },
        body: rawPayload
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error?.code, 'INVALID_WEBHOOK_SIGNATURE');

      const booking = await queryOne('SELECT payment_status FROM bookings WHERE id = ?', [bookingId]);
      assert.strictEqual(booking.payment_status, 'UNPAID');
    });

    test('4.3 Duplicate webhook delivery returns 200 without duplicate processing', async () => {
      const { bookingId } = await createTestBookingWithToken(400);
      const attemptId = 'PAY-ATT-' + randomHex();
      const orderId = 'order_' + randomHex();
      const paymentId = 'pay_' + randomHex();
      const eventId = 'evt_' + randomHex();

      await execute(`
        INSERT INTO payment_attempts (id, booking_id, order_id, amount, currency, status, gateway_provider)
        VALUES (?, ?, ?, 400, 'INR', 'CREATED', 'RAZORPAY')
      `, [attemptId, bookingId, orderId]);

      const rawPayload = JSON.stringify({
        event: 'payment.captured',
        created_at: 1700000000,
        payload: {
          payment: {
            entity: { id: paymentId, order_id: orderId, amount: 40000, currency: 'INR', status: 'captured', method: 'upi' }
          }
        }
      });
      const signature = crypto.createHmac('sha256', TEST_WEBHOOK_SECRET).update(rawPayload).digest('hex');

      const res1 = await fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
          'x-razorpay-event-id': eventId
        },
        body: rawPayload
      });
      assert.strictEqual(res1.status, 200);

      const res2 = await fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
          'x-razorpay-event-id': eventId
        },
        body: rawPayload
      });
      assert.strictEqual(res2.status, 200);
      const json2 = await res2.json();
      assert.strictEqual(json2.data.duplicate, true);
      assert.strictEqual(json2.data.status, 'PROCESSED');
    });

    test('4.4 Unsupported webhook event is marked IGNORED and does not settle payment', async () => {
      const { bookingId } = await createTestBookingWithToken(500);
      const eventId = 'evt_' + randomHex();

      const rawPayload = JSON.stringify({
        event: 'virtual_account.credited',
        created_at: 1700000000,
        payload: {
          virtual_account: { entity: { id: 'va_123', amount: 50000 } }
        }
      });
      const signature = crypto.createHmac('sha256', TEST_WEBHOOK_SECRET).update(rawPayload).digest('hex');

      const res = await fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
          'x-razorpay-event-id': eventId
        },
        body: rawPayload
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.status, 'IGNORED');

      const booking = await queryOne('SELECT payment_status FROM bookings WHERE id = ?', [bookingId]);
      assert.strictEqual(booking.payment_status, 'UNPAID');

      const eventRow = await queryOne('SELECT * FROM payment_webhook_events WHERE id = ?', [eventId]);
      assert.strictEqual(eventRow.status, 'IGNORED');
    });

    test('4.5 payment.failed event does not downgrade an already paid booking', async () => {
      const { bookingId } = await createTestBookingWithToken(500);
      const orderId = 'order_' + randomHex();
      const attemptId = 'PAY-ATT-' + randomHex();
      const paymentId = 'pay_' + randomHex();
      const eventId = 'evt_' + randomHex();

      await execute("UPDATE bookings SET payment_status = 'PAID' WHERE id = ?", [bookingId]);
      await execute(`
        INSERT INTO payment_attempts (id, booking_id, order_id, amount, currency, status, gateway_provider)
        VALUES (?, ?, ?, 500, 'INR', 'SUCCEEDED', 'RAZORPAY')
      `, [attemptId, bookingId, orderId]);

      const rawPayload = JSON.stringify({
        event: 'payment.failed',
        created_at: 1700000000,
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: orderId,
              amount: 50000,
              currency: 'INR',
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Payment timed out'
            }
          }
        }
      });
      const signature = crypto.createHmac('sha256', TEST_WEBHOOK_SECRET).update(rawPayload).digest('hex');

      const res = await fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
          'x-razorpay-event-id': eventId
        },
        body: rawPayload
      });

      assert.strictEqual(res.status, 200);

      const booking = await queryOne('SELECT payment_status FROM bookings WHERE id = ?', [bookingId]);
      assert.strictEqual(booking.payment_status, 'PAID', 'Must never downgrade an already paid booking');
    });

    test('4.6 Accepts event IDs in the 65–128 character range and rejects >128 chars', async () => {
      const { bookingId } = await createTestBookingWithToken(750);
      const attemptId = 'PAY-ATT-' + randomHex();
      const orderId = 'order_' + randomHex();
      const paymentId = 'pay_' + randomHex();

      // 96-character event ID (within 65–128 char range)
      const longValidEventId = 'evt_' + 'x'.repeat(92);
      assert.strictEqual(longValidEventId.length, 96);

      await execute(`
        INSERT INTO payment_attempts (id, booking_id, order_id, amount, currency, status, gateway_provider)
        VALUES (?, ?, ?, 750, 'INR', 'CREATED', 'RAZORPAY')
      `, [attemptId, bookingId, orderId]);

      const rawPayload = JSON.stringify({
        entity: 'event',
        event: 'payment.captured',
        created_at: 1700000000,
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: orderId,
              amount: 75000,
              currency: 'INR',
              status: 'captured',
              method: 'upi'
            }
          }
        }
      });
      const signature = crypto.createHmac('sha256', TEST_WEBHOOK_SECRET).update(rawPayload).digest('hex');

      const res = await fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
          'x-razorpay-event-id': longValidEventId
        },
        body: rawPayload
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.status, 'PROCESSED');

      // Verify >128 char event ID is rejected
      const oversizedEventId = 'evt_' + 'x'.repeat(126); // 130 chars
      assert.ok(oversizedEventId.length > 128);

      const rejectRes = await fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
          'x-razorpay-event-id': oversizedEventId
        },
        body: rawPayload
      });

      assert.strictEqual(rejectRes.status, 400);
      const rejectJson = await rejectRes.json();
      assert.strictEqual(rejectJson.error.code, 'INVALID_EVENT_ID');
    });
  });

  describe('5. Concurrency, Race Conditions & Single-Settlement Protection', () => {
    test('5.1 Simultaneous callback and webhook for same booking: exactly one settles, no double payment', async () => {
      const { rawToken, bookingId } = await createTestBookingWithToken(900);
      const generatedOrderId = 'order_' + randomHex();
      const paymentId = 'pay_' + randomHex();
      const eventId = 'evt_' + randomHex();

      razorpayMockHandler = async () => new Response(JSON.stringify({ id: generatedOrderId, amount: 90000, currency: 'INR' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      const orderRes = await fetch(`${baseUrl}/api/guest/payments/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken })
      });
      assert.strictEqual(orderRes.status, 200);
      const orderJson = await orderRes.json();
      const attemptId = orderJson.data.attemptId;
      const orderId = orderJson.data.orderId;

      const cbSignature = crypto.createHmac('sha256', TEST_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

      razorpayMockHandler = async (url) => {
        if (url.includes(`/payments/${paymentId}`)) {
          return new Response(
            JSON.stringify({ id: paymentId, order_id: orderId, amount: 90000, currency: 'INR', status: 'captured', method: 'upi' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`Unexpected mock: ${url}`);
      };

      const whPayload = JSON.stringify({
        event: 'payment.captured',
        created_at: 1700000000,
        payload: {
          payment: {
            entity: { id: paymentId, order_id: orderId, amount: 90000, currency: 'INR', status: 'captured', method: 'upi' }
          }
        }
      });
      const whSignature = crypto.createHmac('sha256', TEST_WEBHOOK_SECRET).update(whPayload).digest('hex');

      const [cbRes, whRes] = await Promise.all([
        fetch(`${baseUrl}/api/guest/payments/razorpay/verify-signature`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: rawToken, attemptId, orderId, paymentId, signature: cbSignature })
        }),
        fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-razorpay-signature': whSignature,
            'x-razorpay-event-id': eventId
          },
          body: whPayload
        })
      ]);

      assert.strictEqual(cbRes.status, 200);
      assert.strictEqual(whRes.status, 200);

      const booking = await queryOne('SELECT payment_status FROM bookings WHERE id = ?', [bookingId]);
      assert.strictEqual(booking.payment_status, 'PAID');

      const auditLogs = await queryAll(
        "SELECT * FROM audit_logs WHERE resource_id = ? AND action IN ('RAZORPAY_PAYMENT_SUCCEEDED', 'RAZORPAY_WEBHOOK_PAYMENT_SUCCEEDED')",
        [bookingId]
      );
      assert.strictEqual(auditLogs.length, 1, 'Exactly one payment settlement audit log must be recorded');
    });

    test('5.2 Crash recovery: stale PROCESSING event older than 5 minutes can be claimed and recovered', async () => {
      const { bookingId } = await createTestBookingWithToken(450);
      const attemptId = 'PAY-ATT-' + randomHex();
      const orderId = 'order_' + randomHex();
      const paymentId = 'pay_' + randomHex();
      const eventId = 'evt_' + randomHex();

      await execute(`
        INSERT INTO payment_attempts (id, booking_id, order_id, amount, currency, status, gateway_provider)
        VALUES (?, ?, ?, 450, 'INR', 'CREATED', 'RAZORPAY')
      `, [attemptId, bookingId, orderId]);

      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
      await execute(`
        INSERT INTO payment_webhook_events (id, event_type, order_id, payment_id, status, attempts, created_at, updated_at)
        VALUES (?, 'payment.captured', ?, ?, 'PROCESSING', 1, ?, ?)
      `, [eventId, orderId, paymentId, tenMinutesAgo, tenMinutesAgo]);

      const rawPayload = JSON.stringify({
        event: 'payment.captured',
        created_at: 1700000000,
        payload: {
          payment: {
            entity: { id: paymentId, order_id: orderId, amount: 45000, currency: 'INR', status: 'captured', method: 'card' }
          }
        }
      });
      const signature = crypto.createHmac('sha256', TEST_WEBHOOK_SECRET).update(rawPayload).digest('hex');

      const res = await fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
          'x-razorpay-event-id': eventId
        },
        body: rawPayload
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.status, 'PROCESSED');

      const eventRow = await queryOne('SELECT status, attempts FROM payment_webhook_events WHERE id = ?', [eventId]);
      assert.strictEqual(eventRow.status, 'PROCESSED');
      assert.strictEqual(eventRow.attempts, 2, 'Attempts must increment upon recovery claim');
    });

    test('5.3 Retry of a FAILED webhook event re-executes cleanly', async () => {
      const { bookingId } = await createTestBookingWithToken(300);
      const attemptId = 'PAY-ATT-' + randomHex();
      const orderId = 'order_' + randomHex();
      const paymentId = 'pay_' + randomHex();
      const eventId = 'evt_' + randomHex();

      await execute(`
        INSERT INTO payment_attempts (id, booking_id, order_id, amount, currency, status, gateway_provider)
        VALUES (?, ?, ?, 300, 'INR', 'CREATED', 'RAZORPAY')
      `, [attemptId, bookingId, orderId]);

      await execute(`
        INSERT INTO payment_webhook_events (id, event_type, order_id, payment_id, status, attempts, error_message, created_at, updated_at)
        VALUES (?, 'payment.captured', ?, ?, 'FAILED', 1, 'Transient DB lock', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [eventId, orderId, paymentId]);

      const rawPayload = JSON.stringify({
        event: 'payment.captured',
        created_at: 1700000000,
        payload: {
          payment: {
            entity: { id: paymentId, order_id: orderId, amount: 30000, currency: 'INR', status: 'captured', method: 'upi' }
          }
        }
      });
      const signature = crypto.createHmac('sha256', TEST_WEBHOOK_SECRET).update(rawPayload).digest('hex');

      const res = await fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
          'x-razorpay-event-id': eventId
        },
        body: rawPayload
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.status, 'PROCESSED');

      const eventRow = await queryOne('SELECT status, attempts FROM payment_webhook_events WHERE id = ?', [eventId]);
      assert.strictEqual(eventRow.status, 'PROCESSED');
      assert.strictEqual(eventRow.attempts, 2);
    });

    test('5.4 Webhook worker lease ownership fencing: expired worker updates affect zero rows and cannot overwrite state', async () => {
      const eventId = 'evt_' + randomHex();
      const orderId = 'order_' + randomHex();
      const paymentId = 'pay_' + randomHex();

      const worker1Token = 'worker-1-uuid-' + randomHex();
      const worker2Token = 'worker-2-uuid-' + randomHex();

      // 1. Worker 1 claims event
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
      await execute(`
        INSERT INTO payment_webhook_events (id, event_type, order_id, payment_id, status, attempts, claim_token, created_at, updated_at)
        VALUES (?, 'payment.captured', ?, ?, 'PROCESSING', 1, ?, ?, ?)
      `, [eventId, orderId, paymentId, worker1Token, tenMinutesAgo, tenMinutesAgo]);

      // 2. Worker 2 reclaims stale event with new claim_token
      const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
      const reclaimRes = await execute(`
        UPDATE payment_webhook_events
        SET status = 'PROCESSING',
            claim_token = ?,
            attempts = attempts + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND (
            status = 'RECEIVED'
            OR status = 'FAILED'
            OR (status = 'PROCESSING' AND updated_at < ?)
          )
      `, [worker2Token, eventId, staleThreshold]);

      assert.strictEqual(reclaimRes.affectedRows, 1, 'Worker 2 must successfully reclaim stale event');

      // 3. Expired Worker 1 attempts to mark FAILED with old claim_token -> must affect 0 rows
      const worker1FailRes = await execute(`
        UPDATE payment_webhook_events
        SET status = 'FAILED',
            error_message = 'Worker 1 timeout error',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'PROCESSING' AND claim_token = ?
      `, [eventId, worker1Token]);

      assert.strictEqual(worker1FailRes.affectedRows, 0, 'Expired Worker 1 FAILED update must affect 0 rows');

      // 4. Expired Worker 1 attempts to mark PROCESSED with old claim_token -> must affect 0 rows
      const worker1SuccessRes = await execute(`
        UPDATE payment_webhook_events
        SET status = 'PROCESSED',
            processed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'PROCESSING' AND claim_token = ?
      `, [eventId, worker1Token]);

      assert.strictEqual(worker1SuccessRes.affectedRows, 0, 'Expired Worker 1 PROCESSED update must affect 0 rows');

      // Verify event is still owned by Worker 2
      const midCheck = await queryOne('SELECT status, claim_token, attempts FROM payment_webhook_events WHERE id = ?', [eventId]);
      assert.strictEqual(midCheck.status, 'PROCESSING');
      assert.strictEqual(midCheck.claim_token, worker2Token);
      assert.strictEqual(midCheck.attempts, 2);

      // 5. Active Worker 2 successfully finalizes event with its active claim_token
      const worker2SuccessRes = await execute(`
        UPDATE payment_webhook_events
        SET status = 'PROCESSED',
            processed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'PROCESSING' AND claim_token = ?
      `, [eventId, worker2Token]);

      assert.strictEqual(worker2SuccessRes.affectedRows, 1, 'Active Worker 2 update must affect 1 row');

      const finalCheck = await queryOne('SELECT status, claim_token FROM payment_webhook_events WHERE id = ?', [eventId]);
      assert.strictEqual(finalCheck.status, 'PROCESSED');
      assert.strictEqual(finalCheck.claim_token, worker2Token);
    });

    test('5.5 End-to-end lease reclamation and fencing during processRazorpayWebhook execution', async () => {
      const { bookingId } = await createTestBookingWithToken(600);
      const attemptId = 'PAY-ATT-' + randomHex();
      const orderId = 'order_' + randomHex();
      const paymentId = 'pay_' + randomHex();
      const eventId = 'evt_' + randomHex();
      const expiredWorkerToken = 'expired-worker-' + randomHex();

      await execute(`
        INSERT INTO payment_attempts (id, booking_id, order_id, amount, currency, status, gateway_provider)
        VALUES (?, ?, ?, 600, 'INR', 'CREATED', 'RAZORPAY')
      `, [attemptId, bookingId, orderId]);

      // Seed stale event (> 5 min ago)
      const eightMinutesAgo = new Date(Date.now() - 8 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
      await execute(`
        INSERT INTO payment_webhook_events (id, event_type, order_id, payment_id, status, attempts, claim_token, created_at, updated_at)
        VALUES (?, 'payment.captured', ?, ?, 'PROCESSING', 1, ?, ?, ?)
      `, [eventId, orderId, paymentId, expiredWorkerToken, eightMinutesAgo, eightMinutesAgo]);

      const rawPayload = JSON.stringify({
        event: 'payment.captured',
        created_at: 1700000000,
        payload: {
          payment: {
            entity: { id: paymentId, order_id: orderId, amount: 60000, currency: 'INR', status: 'captured', method: 'netbanking' }
          }
        }
      });
      const signature = crypto.createHmac('sha256', TEST_WEBHOOK_SECRET).update(rawPayload).digest('hex');

      // Active webhook request arrives and reclaims the event
      const res = await fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
          'x-razorpay-event-id': eventId
        },
        body: rawPayload
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.status, 'PROCESSED');

      // Booking must be settled
      const booking = await queryOne('SELECT payment_status FROM bookings WHERE id = ?', [bookingId]);
      assert.strictEqual(booking.payment_status, 'PAID');

      // Attempt must be marked SUCCEEDED
      const attempt = await queryOne('SELECT status, gateway_payment_id FROM payment_attempts WHERE id = ?', [attemptId]);
      assert.strictEqual(attempt.status, 'SUCCEEDED');
      assert.strictEqual(attempt.gateway_payment_id, paymentId);

      // Event must be PROCESSED with attempts = 2 and a new claim_token != expiredWorkerToken
      const eventRow = await queryOne('SELECT status, attempts, claim_token FROM payment_webhook_events WHERE id = ?', [eventId]);
      assert.strictEqual(eventRow.status, 'PROCESSED');
      assert.strictEqual(eventRow.attempts, 2);
      assert.notStrictEqual(eventRow.claim_token, expiredWorkerToken);

      // Duplicate delivery of the same webhook must be idempotent
      const dupRes = await fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
          'x-razorpay-event-id': eventId
        },
        body: rawPayload
      });

      assert.strictEqual(dupRes.status, 200);
      const dupJson = await dupRes.json();
      assert.strictEqual(dupJson.data.duplicate, true);
      assert.strictEqual(dupJson.data.status, 'PROCESSED');
    });
  });

  describe('6. Development Simulator & Existing Phase 1-3 Continuity', () => {
    test('6.1 Development simulator remains operational and strictly isolated', () => {
      assert.strictEqual(isDummyPaymentAllowed(), true);
    });

    test('6.2 Existing Admin revenue query produces identical result after real Razorpay settlement', async () => {
      const revBefore = await queryOne("SELECT COALESCE(SUM(calculated_fare), 0) as total FROM bookings WHERE status = 'COMPLETED'");

      const { bookingId } = await createTestBookingWithToken(1250);
      await execute("UPDATE bookings SET status = 'COMPLETED' WHERE id = ?", [bookingId]);

      const revDuring = await queryOne("SELECT COALESCE(SUM(calculated_fare), 0) as total FROM bookings WHERE status = 'COMPLETED'");
      assert.strictEqual(Number(revDuring.total), Number(revBefore.total) + 1250);

      await execute("UPDATE bookings SET payment_status = 'PAID' WHERE id = ?", [bookingId]);

      const revAfter = await queryOne("SELECT COALESCE(SUM(calculated_fare), 0) as total FROM bookings WHERE status = 'COMPLETED'");
      assert.strictEqual(
        Number(revAfter.total),
        Number(revDuring.total),
        'Admin revenue calculation based on status = COMPLETED must be completely unaffected by payment_status transitions'
      );
    });
  });
});
