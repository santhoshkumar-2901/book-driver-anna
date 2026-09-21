import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Home Screen Complete & Pay Fare Settlement Modal Suite', () => {
  const rootDir = process.cwd();
  const paymentModalPath = path.join(rootDir, 'src/components/RidePaymentModal.jsx');
  const activeRideBannerPath = path.join(rootDir, 'src/components/ActiveRideBanner.jsx');

  test('1. ActiveRideBanner provides Complete & Pay button that triggers payment modal', () => {
    const bannerContent = fs.readFileSync(activeRideBannerPath, 'utf8');
    assert.match(bannerContent, /Complete &.*Pay/i, 'ActiveRideBanner should have Complete & Pay button');
    assert.match(bannerContent, /onClick=\{onOpenPayment\}/, 'Complete & Pay button should invoke onOpenPayment');
  });

  test('2. RidePaymentModal defaults to settlement step on open', () => {
    const content = fs.readFileSync(paymentModalPath, 'utf8');
    assert.match(content, /useState\(['"]settlement['"]\)/, 'currentStep should default to settlement');
    assert.match(
      content,
      /setCurrentStep\(['"]settlement['"]\)/,
      'RidePaymentModal should reset currentStep to settlement when modal opens'
    );
  });

  test('3. Settlement view renders Trip Fare Settlement header, itemized receipt and proceed button', () => {
    const content = fs.readFileSync(paymentModalPath, 'utf8');
    assert.match(content, /Trip Fare Settlement/, 'Modal must display Trip Fare Settlement title');
    assert.match(content, /Itemized Fare Receipt/, 'Must display Itemized Fare Receipt breakdown');
    assert.match(content, /Official Fare Billing/, 'Must display Official Fare Billing indicator');
    assert.match(content, /id="proceed-to-payment-btn"/, 'Must have proceed button to advance from settlement to payment');
    assert.match(content, /setCurrentStep\(['"]payment['"]\)/, 'Proceed button must switch step to payment');
  });

  test('4. Payment view provides back to settlement navigation and payment submission', () => {
    const content = fs.readFileSync(paymentModalPath, 'utf8');
    assert.match(content, /id="back-to-settlement-btn"/, 'Must have back button to return to fare receipt');
    assert.match(content, /Back to Fare Receipt/, 'Must display Back to Fare Receipt label');
    assert.match(content, /id="ride-payment-submit-btn"/, 'Must contain final payment submit button in payment view');
  });
});
