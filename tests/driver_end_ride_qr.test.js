import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Driver End Ride Dynamic UPI QR Code Suite', () => {
  const rootDir = process.cwd();
  const driverPortalPath = path.join(rootDir, 'src/pages/DriverPortalPage.jsx');
  const appPath = path.join(rootDir, 'src/App.jsx');

  test('1. DriverPortalPage contains End Ride handler that triggers dynamic settlement QR', () => {
    const content = fs.readFileSync(driverPortalPath, 'utf8');

    // Handler and state checks
    assert.ok(content.includes('handleOpenSettlement'), 'DriverPortalPage should define handleOpenSettlement');
    assert.ok(content.includes('handleConfirmSettlement'), 'DriverPortalPage should define handleConfirmSettlement');
    assert.ok(content.includes('settlementTrip'), 'DriverPortalPage should track settlementTrip');
    assert.ok(content.includes('settlementMethod'), 'DriverPortalPage should track settlementMethod');

    // End Ride button wires to handleOpenSettlement
    assert.ok(
      content.includes('handleOpenSettlement(trip)'),
      'Clicking End Ride button should invoke handleOpenSettlement with active trip'
    );
  });

  test('2. Driver settlement modal generates scannable UPI QR code with trip fare for customer to scan', () => {
    const content = fs.readFileSync(driverPortalPath, 'utf8');

    // Dynamic QR URL generation with trip payout
    assert.ok(
      content.includes('settlementQrUrl'),
      'DriverPortalPage should compute settlementQrUrl for customer to scan'
    );
    assert.ok(
      content.includes('api.qrserver.com/v1/create-qr-code'),
      'DriverPortalPage should generate QR code via QR code API'
    );
    assert.ok(
      content.includes('driver-settlement-qr-img'),
      'Settlement modal must render QR code image with id driver-settlement-qr-img'
    );
    assert.ok(
      content.includes('Customer Scan & Pay'),
      'Modal should display clear Customer Scan & Pay banner'
    );
  });

  test('3. Settlement modal provides driver VPA copy, app indicators, and payment confirmation button', () => {
    const content = fs.readFileSync(driverPortalPath, 'utf8');

    assert.ok(content.includes('handleCopyUpi'), 'Modal should allow copying driver VPA');
    assert.ok(content.includes('copiedUpi'), 'Modal should display copied feedback');
    assert.ok(content.includes('confirm-settlement-btn'), 'Modal must have confirm settlement button');
    assert.ok(content.includes('GPay') && content.includes('PhonePe') && content.includes('Paytm'), 'Modal should list popular UPI payment apps');
  });

  test('4. End Ride broadcasts Fare Settlement so customer app can open payment view simultaneously', () => {
    const portalContent = fs.readFileSync(driverPortalPath, 'utf8');
    const appContent = fs.readFileSync(appPath, 'utf8');

    // Driver portal broadcasts Fare Settlement
    assert.ok(
      portalContent.includes("status: 'Fare Settlement'"),
      'DriverPortalPage should broadcast Fare Settlement status update'
    );

    // App.jsx responds to Fare Settlement
    assert.ok(
      appContent.includes("detail.status === 'Fare Settlement'"),
      'App.jsx should open customer payment modal when Fare Settlement status is received'
    );
  });
});
