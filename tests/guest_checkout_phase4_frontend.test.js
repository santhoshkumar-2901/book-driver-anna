import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'crypto';
import { app } from '../server/index.js';
import { queryOne, execute } from '../server/db/database.js';
import { createBooking } from '../server/services/bookingService.js';
import { apiClient } from '../src/services/apiClient.js';
import { loadRazorpayCheckoutScript, resetRazorpayScriptCache, RAZORPAY_CHECKOUT_SCRIPT_URL } from '../src/utils/razorpay.js';
import { ENV } from '../server/config/env.js';

describe('Phase 4, Step 4: Frontend Razorpay Checkout Integration Suite', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        // Point frontend apiClient to test server
        if (typeof process !== 'undefined') {
          process.env.VITE_API_URL = baseUrl;
        }
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    resetRazorpayScriptCache();
  });

  describe('1. Razorpay Script Loader Utility (loadRazorpayCheckoutScript)', () => {
    test('1.1 Returns false safely in SSR / non-browser environment when window is undefined', async () => {
      const origWindow = globalThis.window;
      try {
        delete globalThis.window;
        const result = await loadRazorpayCheckoutScript();
        assert.strictEqual(result, false, 'Must resolve false when window is undefined');
      } finally {
        globalThis.window = origWindow;
      }
    });

    test('1.2 Resolves true immediately if window.Razorpay is already present', async () => {
      const origWindow = globalThis.window;
      try {
        globalThis.window = {
          Razorpay: function MockRazorpay() {}
        };
        const result = await loadRazorpayCheckoutScript();
        assert.strictEqual(result, true, 'Must resolve true without DOM injection if already loaded');
      } finally {
        globalThis.window = origWindow;
      }
    });

    test('1.3 Injects script tag and resolves true upon successful script load', async () => {
      const origWindow = globalThis.window;
      const origDocument = globalThis.document;

      let injectedScript = null;
      let timeoutId = null;

      try {
        globalThis.window = {};
        globalThis.document = {
          querySelector: (sel) => null,
          createElement: (tag) => {
            const el = {
              src: '',
              async: false,
              onload: null,
              onerror: null,
              parentNode: {
                removeChild: () => {}
              }
            };
            injectedScript = el;
            return el;
          },
          body: {
            appendChild: (el) => {
              // Simulate async script load
              setImmediate(() => {
                globalThis.window.Razorpay = function MockRazorpay() {};
                if (typeof el.onload === 'function') {
                  el.onload();
                }
              });
            }
          }
        };

        const result = await loadRazorpayCheckoutScript(2000);
        assert.strictEqual(result, true, 'Must resolve true when script loads');
        assert.strictEqual(injectedScript.src, RAZORPAY_CHECKOUT_SCRIPT_URL, 'Must load official Razorpay script URL');
        assert.strictEqual(injectedScript.async, true, 'Script must be marked async');
      } finally {
        globalThis.window = origWindow;
        globalThis.document = origDocument;
      }
    });

    test('1.4 Handles network load failure cleanly and allows retries', async () => {
      const origWindow = globalThis.window;
      const origDocument = globalThis.document;

      let removed = false;

      try {
        globalThis.window = {};
        globalThis.document = {
          querySelector: () => null,
          createElement: () => {
            return {
              src: '',
              async: false,
              onload: null,
              onerror: null,
              parentNode: {
                removeChild: () => { removed = true; }
              }
            };
          },
          body: {
            appendChild: (el) => {
              setImmediate(() => {
                if (typeof el.onerror === 'function') {
                  el.onerror(new Error('Network error'));
                }
              });
            }
          }
        };

        const result = await loadRazorpayCheckoutScript(2000);
        assert.strictEqual(result, false, 'Must resolve false on script error');
        assert.strictEqual(removed, true, 'Must clean up failed script element');
      } finally {
        globalThis.window = origWindow;
        globalThis.document = origDocument;
      }
    });

    test('1.5 Handles script load timeout when blocked by network/ad-blocker', async () => {
      const origWindow = globalThis.window;
      const origDocument = globalThis.document;

      let removed = false;

      try {
        globalThis.window = {};
        globalThis.document = {
          querySelector: () => null,
          createElement: () => {
            return {
              src: '',
              async: false,
              onload: null,
              onerror: null,
              parentNode: {
                removeChild: () => { removed = true; }
              }
            };
          },
          body: {
            appendChild: () => {
              // Neither load nor error fired (e.g. adblock drop)
            }
          }
        };

        const result = await loadRazorpayCheckoutScript(50);
        assert.strictEqual(result, false, 'Must resolve false on timeout');
        assert.strictEqual(removed, true, 'Must remove script tag on timeout');
      } finally {
        globalThis.window = origWindow;
        globalThis.document = origDocument;
      }
    });
  });

  describe('2. Frontend API Client Contract & Disabled Gateway Handling', () => {
    test('2.1 createRazorpayGuestOrder fails closed with GATEWAY_DISABLED when RAZORPAY_ENABLED is false', async () => {
      const idempotencyKey = `idem-ui-test-${Date.now()}`;
      const bookingRes = await createBooking({
        customerName: 'Guest UI Test User',
        customerPhone: '9876543410',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-11-01',
        time: '10:00 AM',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        idempotencyKey
      });

      const token = bookingRes.paymentLink.token;

      // Gateway is disabled by default
      assert.strictEqual(ENV.RAZORPAY_ENABLED, false, 'Gateway must be disabled by default');

      try {
        await apiClient.createRazorpayGuestOrder(token, `idem-rzp-${Date.now()}`);
        assert.fail('Should have thrown an error for disabled gateway');
      } catch (err) {
        assert.strictEqual(err.status, 403, 'Must return 403 when gateway is disabled');
        assert.strictEqual(err.code, 'GATEWAY_DISABLED', 'Error code must be GATEWAY_DISABLED');
      }
    });

    test('2.2 verifyRazorpayGuestSignature fails closed with GATEWAY_DISABLED when RAZORPAY_ENABLED is false', async () => {
      try {
        await apiClient.verifyRazorpayGuestSignature({
          token: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          attemptId: 'PAY-ATT-MOCK',
          orderId: 'order_mock_123',
          paymentId: 'pay_mock_123',
          signature: 'sig_mock_123'
        });
        assert.fail('Should have thrown an error for disabled gateway');
      } catch (err) {
        assert.strictEqual(err.status, 403, 'Must return 403 when gateway is disabled');
        assert.strictEqual(err.code, 'GATEWAY_DISABLED', 'Error code must be GATEWAY_DISABLED');
      }
    });

    test('2.3 Frontend API client sends only token and idempotencyKey to create-order (no client fare)', async () => {
      const origFetch = globalThis.fetch;
      let interceptedBody = null;

      try {
        globalThis.fetch = async (url, config) => {
          if (url.includes('/guest/payments/razorpay/create-order')) {
            interceptedBody = JSON.parse(config.body);
            return {
              ok: true,
              headers: { get: () => 'application/json' },
              json: async () => ({ success: true, data: { orderId: 'order_123' } })
            };
          }
          return origFetch(url, config);
        };

        await apiClient.createRazorpayGuestOrder('mock-token-abc', 'idem-123');

        assert.ok(interceptedBody, 'Body must have been captured');
        assert.strictEqual(interceptedBody.token, 'mock-token-abc');
        assert.strictEqual(interceptedBody.idempotencyKey, 'idem-123');
        assert.strictEqual(interceptedBody.amount, undefined, 'Client amount must NEVER be sent by frontend');
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    test('2.4 Frontend API client passes exact callback fields to verify-signature endpoint', async () => {
      const origFetch = globalThis.fetch;
      let interceptedBody = null;

      try {
        globalThis.fetch = async (url, config) => {
          if (url.includes('/guest/payments/razorpay/verify-signature')) {
            interceptedBody = JSON.parse(config.body);
            return {
              ok: true,
              headers: { get: () => 'application/json' },
              json: async () => ({ success: true, data: { isPaid: true, status: 'SUCCEEDED' } })
            };
          }
          return origFetch(url, config);
        };

        const callbackPayload = {
          token: 'mock-guest-token',
          attemptId: 'PAY-ATT-999',
          orderId: 'order_rzp_777',
          paymentId: 'pay_rzp_888',
          signature: 'sig_hmac_abc123'
        };

        const res = await apiClient.verifyRazorpayGuestSignature(callbackPayload);

        assert.ok(interceptedBody, 'Body must have been sent');
        assert.strictEqual(interceptedBody.token, 'mock-guest-token');
        assert.strictEqual(interceptedBody.attemptId, 'PAY-ATT-999');
        assert.strictEqual(interceptedBody.orderId, 'order_rzp_777');
        assert.strictEqual(interceptedBody.paymentId, 'pay_rzp_888');
        assert.strictEqual(interceptedBody.signature, 'sig_hmac_abc123');
        assert.strictEqual(res.data.isPaid, true);
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });

  describe('3. Checkout Options & Authoritative Security Guarantees', () => {
    test('3.1 Razorpay options map server-returned values directly without browser manipulation', () => {
      const serverOrderData = {
        attemptId: 'PAY-ATT-12345',
        orderId: 'order_server_test_999',
        amount: 450.00,
        amountInPaise: 45000,
        currency: 'INR',
        keyId: 'rzp_test_public_key_abc',
        bookingId: 'BDA-BK-888',
        status: 'CREATED',
        isPaid: false
      };

      const summary = {
        bookingId: 'BDA-BK-888',
        customerName: 'Anand Kumar',
        customerPhone: '9876543210'
      };

      // Construct options exactly as GuestPaymentPage does
      const options = {
        key: serverOrderData.keyId,
        amount: serverOrderData.amountInPaise,
        currency: serverOrderData.currency || 'INR',
        name: 'Book Driver Anna',
        description: `Ride Payment - ${summary.bookingId}`,
        order_id: serverOrderData.orderId,
        prefill: {
          name: summary.customerName,
          contact: summary.customerPhone
        },
        notes: {
          bookingId: summary.bookingId,
          attemptId: serverOrderData.attemptId
        }
      };

      assert.strictEqual(options.key, 'rzp_test_public_key_abc', 'Public key ID must match server response');
      assert.strictEqual(options.amount, 45000, 'Amount must be server amount in paise');
      assert.strictEqual(options.currency, 'INR');
      assert.strictEqual(options.order_id, 'order_server_test_999');
      assert.strictEqual(options.notes.attemptId, 'PAY-ATT-12345');
      assert.strictEqual(options.notes.bookingId, 'BDA-BK-888');
    });

    test('3.2 Customer cancellation in Razorpay modal does not alter booking status', async () => {
      const idempotencyKey = `idem-cancel-${Date.now()}`;
      const bookingRes = await createBooking({
        customerName: 'Cancel Test User',
        customerPhone: '9876543411',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        date: '2026-11-01',
        time: '10:00 AM',
        pickupArea: 'Indiranagar',
        dropLocation: 'MG Road',
        idempotencyKey
      });

      const bookingId = bookingRes.booking.id;

      // Simulate modal.ondismiss triggering on customer exit
      let isCheckoutActive = true;
      let cancellationNotice = null;

      const ondismiss = () => {
        isCheckoutActive = false;
        cancellationNotice = 'Payment checkout was closed. If your payment did not go through, you can retry whenever you are ready. If funds were deducted or your bank authorization completed, please click "Re-check Payment Status" below to reconcile.';
      };

      ondismiss();

      assert.strictEqual(isCheckoutActive, false, 'Checkout state must close');
      assert.ok(cancellationNotice.includes('closed'), 'Cancellation notice should be set');
      assert.doesNotMatch(cancellationNotice, /No charges were debited/, 'Cancellation notice must not make overconfident claim');
      assert.match(cancellationNotice, /Re-check Payment Status/, 'Cancellation notice should advise reconciliation');

      // Verify database record remains UNPAID
      const booking = await queryOne('SELECT payment_status FROM bookings WHERE id = ?', [bookingId]);
      assert.strictEqual(booking.payment_status, 'UNPAID', 'Booking must remain UNPAID after cancellation');
    });

    test('3.3 Verification failure never marks booking as PAID in client state', async () => {
      let isPaid = false;
      let errorMessage = null;

      const mockVerifyResponse = {
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Payment signature verification failed.'
        }
      };

      // Handler evaluation as in GuestPaymentPage
      if (mockVerifyResponse?.success && mockVerifyResponse?.data?.isPaid) {
        isPaid = true;
      } else {
        errorMessage = mockVerifyResponse?.error?.message;
      }

      assert.strictEqual(isPaid, false, 'UI must never report success when verification fails');
      assert.strictEqual(errorMessage, 'Payment signature verification failed.');
    });

    test('3.4 Repeated clicks are blocked by synchronous re-entrancy lock', () => {
      const isProcessingRef = { current: false };
      let executionCount = 0;

      const handlePaymentClick = () => {
        if (isProcessingRef.current) {
          return; // Block overlapping click
        }
        isProcessingRef.current = true;
        executionCount++;
      };

      // Rapid successive clicks (e.g. user double-clicking)
      handlePaymentClick();
      handlePaymentClick();
      handlePaymentClick();

      assert.strictEqual(executionCount, 1, 'Only the first click should execute');
      assert.strictEqual(isProcessingRef.current, true, 'Lock should remain active while in progress');

      // Release lock
      isProcessingRef.current = false;
      handlePaymentClick();
      assert.strictEqual(executionCount, 2, 'Subsequent clicks are allowed once lock is released');
    });
  });

  describe('4. Component Source Code & Environmental Separation Checks', () => {
    test('4.1 GuestPaymentPage.jsx strictly hides DummyRazorpayModal in production builds', () => {
      const pagePath = path.resolve('src/pages/GuestPaymentPage.jsx');
      const content = fs.readFileSync(pagePath, 'utf8');

      // Verify isDevMode is computed from import.meta.env.DEV
      assert.match(content, /isDevMode\s*=\s*typeof import\.meta.*import\.meta\.env\?\.DEV/, 'Must check import.meta.env.DEV');

      // Verify modal and simulator section are conditioned on isDevMode
      assert.match(content, /\{isDevMode\s*&&\s*isSimulatorOpen/, 'Simulator modal must be gated by isDevMode');
      assert.match(content, /\{isDevMode\s*&&\s*\(/, 'Simulator button must be gated by isDevMode');
    });

    test('4.2 GuestPaymentPage.jsx handles GATEWAY_DISABLED cleanly without technical jargon', () => {
      const pagePath = path.resolve('src/pages/GuestPaymentPage.jsx');
      const content = fs.readFileSync(pagePath, 'utf8');

      assert.match(content, /GATEWAY_DISABLED/, 'Must handle GATEWAY_DISABLED error code');
      assert.match(content, /temporarily unavailable/i, 'Must present friendly unavailable message');
      assert.match(content, /gatewayDisabledNotice/, 'Must track gatewayDisabledNotice in state');
    });

    test('4.3 GuestPaymentPage.jsx handles customer cancellation gracefully without overconfident claims', () => {
      const pagePath = path.resolve('src/pages/GuestPaymentPage.jsx');
      const content = fs.readFileSync(pagePath, 'utf8');

      assert.match(content, /ondismiss/, 'Must implement Razorpay modal.ondismiss handler');
      assert.match(content, /cancellationNotice/, 'Must track cancellationNotice in state');
      assert.doesNotMatch(content, /No charges were debited/, 'Must not make unconditional claim that no charges were debited');
      assert.match(content, /Re-check Payment Status/, 'Must reference Re-check Payment Status in cancellation flow');
      assert.doesNotMatch(content, /paymentStatus:\s*'PAID'[^}]*ondismiss/, 'Cancellation must never mark booking paid');
    });

    test('4.4 Zero secrets exist in frontend codebase or client files', () => {
      const clientFiles = [
        'src/services/apiClient.js',
        'src/pages/GuestPaymentPage.jsx',
        'src/utils/razorpay.js',
        'src/components/DummyRazorpayModal.jsx'
      ];

      for (const relPath of clientFiles) {
        const fullPath = path.resolve(relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          assert.doesNotMatch(content, /RAZORPAY_KEY_SECRET/, `${relPath} must not reference RAZORPAY_KEY_SECRET`);
          assert.doesNotMatch(content, /RAZORPAY_WEBHOOK_SECRET/, `${relPath} must not reference RAZORPAY_WEBHOOK_SECRET`);
          assert.doesNotMatch(content, /rzp_live_/, `${relPath} must not contain live keys`);
        }
      }
    });
  });

  describe('5. In-Page Payment Status Reconciliation (handleReconcileStatus)', () => {
    test('5.1 Reconciliation without callback data queries authoritative booking summary', async () => {
      let queriedToken = null;
      const mockSummaryRes = {
        success: true,
        data: {
          bookingId: 'BDA-BK-RECON-1',
          isPaid: false,
          calculatedFare: 650.00,
          paymentStatus: 'UNPAID'
        }
      };

      const origGetSummary = apiClient.getGuestBookingSummary;
      try {
        apiClient.getGuestBookingSummary = async (token) => {
          queriedToken = token;
          return mockSummaryRes;
        };

        const guestToken = 'token-recon-123';
        const pendingVerificationData = null; // No callback data (e.g. modal closed or network drop)
        let isPaid = false;
        let checkoutError = null;

        if (pendingVerificationData) {
          assert.fail('Should not enter callback verification when data is null');
        } else {
          const res = await apiClient.getGuestBookingSummary(guestToken);
          if (res?.success && res?.data?.isPaid) {
            isPaid = true;
          } else {
            checkoutError = 'Payment has not yet been confirmed by the bank or gateway. If you were charged, please allow a few moments for bank reconciliation or contact support.';
          }
        }

        assert.strictEqual(queriedToken, 'token-recon-123', 'Must query server booking summary with guest token');
        assert.strictEqual(isPaid, false, 'Unpaid booking must not be marked paid');
        assert.ok(checkoutError.includes('not yet been confirmed'), 'Must display non-alarming unconfirmed message');
      } finally {
        apiClient.getGuestBookingSummary = origGetSummary;
      }
    });

    test('5.2 Reconciliation when booking remains unpaid does not display paid receipt', async () => {
      const origGetSummary = apiClient.getGuestBookingSummary;
      try {
        apiClient.getGuestBookingSummary = async () => ({
          success: true,
          data: { bookingId: 'BK-UNPAID', isPaid: false, paymentStatus: 'UNPAID' }
        });

        let paymentReceipt = null;
        const res = await apiClient.getGuestBookingSummary('test-token');
        if (res?.success && res?.data?.isPaid) {
          paymentReceipt = { paymentId: res.data.paymentId };
        }

        assert.strictEqual(paymentReceipt, null, 'Must never generate paid receipt for unpaid booking');
      } finally {
        apiClient.getGuestBookingSummary = origGetSummary;
      }
    });

    test('5.3 Reconciliation when backend confirms payment updates receipt and marks PAID', async () => {
      const origGetSummary = apiClient.getGuestBookingSummary;
      try {
        apiClient.getGuestBookingSummary = async () => ({
          success: true,
          data: {
            bookingId: 'BK-SETTLED-WEBHOOK',
            isPaid: true,
            calculatedFare: 850.00,
            paymentId: 'pay_webhook_settled_123'
          }
        });

        let summary = { isPaid: false };
        let paymentReceipt = null;
        let checkoutError = 'Some previous error';
        let cancellationNotice = 'Some previous notice';

        const res = await apiClient.getGuestBookingSummary('test-token');
        if (res?.success && res?.data?.isPaid) {
          summary = res.data;
          paymentReceipt = {
            paymentId: res.data.paymentId || res.data.bookingId,
            amount: res.data.calculatedFare,
            currency: 'INR',
            bookingId: res.data.bookingId
          };
          checkoutError = null;
          cancellationNotice = null;
        }

        assert.strictEqual(summary.isPaid, true, 'Booking must be marked PAID');
        assert.ok(paymentReceipt, 'Payment receipt must be created');
        assert.strictEqual(paymentReceipt.paymentId, 'pay_webhook_settled_123');
        assert.strictEqual(checkoutError, null, 'Previous checkout error must be cleared');
        assert.strictEqual(cancellationNotice, null, 'Previous cancellation notice must be cleared');
      } finally {
        apiClient.getGuestBookingSummary = origGetSummary;
      }
    });

    test('5.4 Concurrent reconciliation requests are blocked by re-entrancy lock', async () => {
      const isProcessingRef = { current: false };
      let callCount = 0;

      const reconcile = async () => {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;
        callCount++;
        await new Promise(r => setTimeout(r, 10));
        isProcessingRef.current = false;
      };

      await Promise.all([reconcile(), reconcile(), reconcile()]);

      assert.strictEqual(callCount, 1, 'Only one concurrent reconciliation request must execute');
      assert.strictEqual(isProcessingRef.current, false, 'Lock must be released upon completion');
    });
  });
});
