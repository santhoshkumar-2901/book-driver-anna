import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Driver UPI ID & Dynamic Scannable QR Code Suite', () => {
  const rootDir = process.cwd();
  const driverPortalPath = path.join(rootDir, 'src/pages/DriverPortalPage.jsx');
  const driverAuthPath = path.join(rootDir, 'src/pages/DriverAuthPage.jsx');
  const paymentModalPath = path.join(rootDir, 'src/components/RidePaymentModal.jsx');
  const adminPagePath = path.join(rootDir, 'src/pages/AdminPage.jsx');
  const userProfileModalPath = path.join(rootDir, 'src/components/UserProfileModal.jsx');

  test('1. DriverPortalPage contains UPI ID input, save action, and live QR preview', () => {
    const portalContent = fs.readFileSync(driverPortalPath, 'utf8');

    // Check for UPI state and save handler
    assert.ok(portalContent.includes('driverUpi'), 'DriverPortalPage should have driverUpi state');
    assert.ok(portalContent.includes('handleSaveUpi'), 'DriverPortalPage should have handleSaveUpi handler');
    
    // Check for QR generation API
    assert.ok(
      portalContent.includes('api.qrserver.com/v1/create-qr-code') || portalContent.includes('create-qr-code'),
      'DriverPortalPage should generate QR code via QR code API'
    );
    assert.ok(
      portalContent.includes('upi://pay?pa='),
      'DriverPortalPage should generate valid UPI URI schema with pa= (payee address)'
    );

    // Check for UI element labels and inputs
    assert.ok(
      portalContent.includes('Your Direct Payment UPI & Scannable QR'),
      'DriverPortalPage should display section for Direct Payment UPI & Scannable QR'
    );
    assert.ok(
      portalContent.includes('driver-upi-input'),
      'DriverPortalPage should have an input with id driver-upi-input'
    );
    assert.ok(
      portalContent.includes('save-driver-upi-btn'),
      'DriverPortalPage should have a save button with id save-driver-upi-btn'
    );
  });

  test('2. DriverAuthPage supports entering UPI ID upon driver registration', () => {
    const authContent = fs.readFileSync(driverAuthPath, 'utf8');

    assert.ok(authContent.includes('signupUpi'), 'DriverAuthPage should have signupUpi state');
    assert.ok(authContent.includes('driver-signup-upi'), 'DriverAuthPage should have id driver-signup-upi');
    assert.ok(authContent.includes('upiId'), 'DriverAuthPage should store upiId in registered driver profile');
  });

  test('3. RidePaymentModal dynamically generates scannable QR using assigned driver UPI', () => {
    const paymentContent = fs.readFileSync(paymentModalPath, 'utf8');

    // Check driver UPI resolution
    assert.ok(
      paymentContent.includes('resolvedDriverUpi'),
      'RidePaymentModal should resolve driver UPI from rideData or registered fleet'
    );
    assert.ok(
      paymentContent.includes('upi://pay?pa='),
      'RidePaymentModal should format UPI payment URI'
    );
    assert.ok(
      paymentContent.includes('api.qrserver.com/v1/create-qr-code') || paymentContent.includes('create-qr-code'),
      'RidePaymentModal should construct dynamic QR code image URL'
    );

    // Check dynamic QR image element replaces static icon
    assert.ok(
      paymentContent.includes('<img') && paymentContent.includes('dynamicQrCodeUrl'),
      'RidePaymentModal should render an <img> tag with dynamicQrCodeUrl'
    );
    assert.ok(
      paymentContent.includes('resolvedDriverUpi'),
      'RidePaymentModal should display the resolved driver UPI ID'
    );
  });

  test('4. AdminPage and UserProfileModal attach and propagate assignedDriverUpi', () => {
    const adminContent = fs.readFileSync(adminPagePath, 'utf8');
    const profileContent = fs.readFileSync(userProfileModalPath, 'utf8');

    assert.ok(
      adminContent.includes('assignedDriverUpi'),
      'AdminPage should assign driver UPI when assigning a driver to booking'
    );
    assert.ok(
      profileContent.includes('assignedDriverUpi'),
      'UserProfileModal should preserve and pass assignedDriverUpi to RidePaymentModal'
    );
  });
});
