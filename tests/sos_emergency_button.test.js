import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Part 2: SOS / Emergency Button & Confirmation Suite', () => {
  const sosButtonPath = path.resolve('src/components/SOSButton.jsx');
  const activeRideBannerPath = path.resolve('src/components/ActiveRideBanner.jsx');
  const driverPortalPagePath = path.resolve('src/pages/DriverPortalPage.jsx');

  test('1. SOSButton component exists and uses distinct red/alert styling', () => {
    assert.ok(fs.existsSync(sosButtonPath), 'SOSButton.jsx component should exist');
    const content = fs.readFileSync(sosButtonPath, 'utf8');
    assert.match(content, /bg-red-600/, 'SOS button should use red alert styling distinct from amber');
    assert.match(content, /ShieldAlert/, 'SOS button should display safety/alert icon');
    assert.match(content, /SUPPORT_HELPLINE/, 'SOSButton should import SUPPORT_HELPLINE');
  });

  test('2. SOSButton opens a calm confirmation panel without immediately firing dial or copy', () => {
    const content = fs.readFileSync(sosButtonPath, 'utf8');
    assert.match(content, /isOpen &&/, 'Should conditionally render confirmation modal on tap');
    assert.match(content, /role="dialog"/, 'Confirmation panel should be an accessible dialog');
    assert.match(content, /Dismiss \/ I am safe|setIsOpen\(false\)/, 'Should provide calm cancel/dismiss action');
  });

  test('3. Confirmation panel provides Call Helpline and Copy Trip Details actions', () => {
    const content = fs.readFileSync(sosButtonPath, 'utf8');
    assert.match(content, /tel:\$\{SUPPORT_HELPLINE/, 'Should link to tel: with SUPPORT_HELPLINE');
    assert.match(content, /handleCopyTripDetails/, 'Should provide Copy Trip Details action');
    assert.match(content, /Booking ID:/, 'Copied details should format booking ID');
    assert.match(content, /Driver:/, 'Copied details should format driver name');
    assert.match(content, /Vehicle:/, 'Copied details should format vehicle details');
    assert.match(content, /Status:/, 'Copied details should format ride status');
  });

  test('4. ActiveRideBanner imports and displays SOSButton during active customer rides', () => {
    const content = fs.readFileSync(activeRideBannerPath, 'utf8');
    assert.match(content, /import SOSButton from '\.\/SOSButton'/, 'ActiveRideBanner should import SOSButton');
    assert.match(content, /<SOSButton trip=\{activeRide\}/, 'ActiveRideBanner should render SOSButton with activeRide prop');
  });

  test('5. DriverPortalPage imports and displays SOSButton during active driver duties', () => {
    const content = fs.readFileSync(driverPortalPagePath, 'utf8');
    assert.match(content, /import SOSButton from '\.\.\/components\/SOSButton'/, 'DriverPortalPage should import SOSButton');
    assert.match(content, /<SOSButton trip=\{trip\}/, 'DriverPortalPage should render SOSButton on active duty cards');
  });
});
