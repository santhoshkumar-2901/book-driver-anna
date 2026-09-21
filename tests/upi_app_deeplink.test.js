import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('UPI Payment App Deep Linking & Intent Launch Suite', () => {
  const rootDir = process.cwd();
  const paymentModalPath = path.join(rootDir, 'src/components/RidePaymentModal.jsx');

  test('1. RidePaymentModal contains deep linking schemes for GPay, PhonePe, Paytm and Universal UPI', () => {
    const content = fs.readFileSync(paymentModalPath, 'utf8');

    // Google Pay scheme
    assert.ok(content.includes('tez://upi/pay'), 'RidePaymentModal should support tez://upi/pay for Google Pay');
    
    // PhonePe scheme
    assert.ok(content.includes('phonepe://pay'), 'RidePaymentModal should support phonepe://pay for PhonePe');
    
    // Paytm scheme
    assert.ok(content.includes('paytmmp://pay'), 'RidePaymentModal should support paytmmp://pay for Paytm');
    
    // Universal UPI scheme
    assert.ok(content.includes('upi://pay?'), 'RidePaymentModal should support standard universal upi://pay scheme');
  });

  test('2. RidePaymentModal defines launchUpiPaymentApp and invokes it on payment submission', () => {
    const content = fs.readFileSync(paymentModalPath, 'utf8');

    assert.ok(content.includes('launchUpiPaymentApp'), 'RidePaymentModal should define launchUpiPaymentApp');
    assert.ok(content.includes('getUpiDeepLink'), 'RidePaymentModal should define getUpiDeepLink');
    assert.ok(
      content.includes('launchUpiPaymentApp(selectedUpiApp)'),
      'RidePaymentModal should call launchUpiPaymentApp with selected app in handleProcessPayment'
    );
  });

  test('3. RidePaymentModal provides direct app launch buttons and redirect notice', () => {
    const content = fs.readFileSync(paymentModalPath, 'utf8');

    assert.ok(content.includes('upiRedirectNotice'), 'RidePaymentModal should have upiRedirectNotice state');
    assert.ok(
      content.includes('Opening') && content.includes('UPI app'),
      'RidePaymentModal should show redirect notice when launching UPI app'
    );
    assert.ok(
      content.includes('ride-payment-submit-btn'),
      'RidePaymentModal should have submit button with id ride-payment-submit-btn'
    );
  });
});
