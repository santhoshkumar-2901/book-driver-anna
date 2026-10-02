import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Driver Profile Section — Frontend UI, Navigation & Security Verification Suite', () => {
  const rootDir = process.cwd();
  const profileSectionPath = path.join(rootDir, 'src/components/DriverProfileSection.jsx');
  const driverPortalPath = path.join(rootDir, 'src/pages/DriverPortalPage.jsx');
  const appPath = path.join(rootDir, 'src/App.jsx');
  const apiClientPath = path.join(rootDir, 'src/services/apiClient.js');

  test('1. DriverProfileSection component exists and is text/data based without any avatar/image functionality', () => {
    assert.ok(fs.existsSync(profileSectionPath), 'DriverProfileSection.jsx must exist');
    const content = fs.readFileSync(profileSectionPath, 'utf8');

    // Strict requirements: NO profile photo, avatar, image upload, camera button, image preview, image storage
    assert.doesNotMatch(content, /<input[^>]+type=["']file["']/, 'Must NOT contain file upload inputs');
    assert.doesNotMatch(content, /profile_image|avatar_url|avatarUrl|profileImage/, 'Must NOT reference image columns or avatar URLs');
    assert.doesNotMatch(content, /Camera|UploadPhoto|UploadImage/, 'Must NOT contain camera or photo upload triggers');
  });

  test('2. DriverProfileSection provides loading, error, edit, and cancel states', () => {
    const content = fs.readFileSync(profileSectionPath, 'utf8');

    // Loading state
    assert.match(content, /Loading Driver Profile|animate-spin/, 'Must handle loading state with spinner');

    // Error state
    assert.match(content, /loadError|Failed to Load Profile|Retry/, 'Must handle fetch error state with retry option');

    // Edit state
    assert.match(content, /isEditing|handleStartEdit|Edit Profile/, 'Must support toggling edit state');

    // Save & Duplicate Submission Prevention
    assert.match(content, /isSaving|disabled=\{isSaving\}/, 'Must disable submit button while saving to prevent duplicate submissions');

    // Cancel state
    assert.match(content, /handleCancelEdit|Cancel/, 'Must allow cancelling edits without saving');
  });

  test('3. DriverProfileSection includes required structured information cards', () => {
    const content = fs.readFileSync(profileSectionPath, 'utf8');

    // Personal Information
    assert.match(content, /Personal Information/, 'Must contain Personal Information card');
    assert.match(content, /driver-profile-name-input/, 'Must contain full name input');
    assert.match(content, /driver-profile-phone-input/, 'Must contain phone input');
    assert.match(content, /driver-profile-email-input/, 'Must contain email input');
    assert.match(content, /driver-profile-area-select/, 'Must contain area selector');

    // Driver & Fleet Information
    assert.match(content, /Driver & Fleet Information/, 'Must contain Driver & Fleet Information card');
    assert.match(content, /maskedLicenseNumber/, 'Must display masked license number');
    assert.match(content, /Admin Verified|Locked/i, 'Must display admin verification indicators for uneditable fields');

    // Account Information
    assert.match(content, /Account & Verification/, 'Must contain Account & Verification card');
    assert.match(content, /Public Driver Partner ID|DRV-ID/, 'Must display public driver identifier');

    // Payout & Settlement Information (Removed as requested)
    assert.doesNotMatch(content, /Payout & Direct Settlement/, 'Must NOT contain Payout & Settlement card');
    assert.doesNotMatch(content, /driver-profile-upi-input/, 'Must NOT contain UPI handle input');
  });

  test('4. DriverPortalPage navigation includes Profile tab and preserves existing duties', () => {
    const content = fs.readFileSync(driverPortalPath, 'utf8');

    assert.match(content, /driver-nav-duties-btn/, 'Must contain navigation button for Duties');
    assert.match(content, /driver-nav-profile-btn/, 'Must contain navigation button for Profile');
    assert.match(content, /portalTab === 'profile'/, 'Must switch views cleanly based on portalTab');
    assert.match(content, /<DriverProfileSection/, 'Must render DriverProfileSection component');

    // Verifies existing functionality was not broken
    assert.match(content, /useDriverLocation/, 'GPS location tracking must be preserved');
    assert.match(content, /handleToggleOnline/, 'Online/Offline status toggle must be preserved');
    assert.match(content, /acceptedTrips/, 'Active trips must be preserved');
    assert.match(content, /pastTrips/, 'Past trips history must be preserved');
    assert.match(content, /availableDuties/, 'Open customer duties must be preserved');
    assert.match(content, /settlementTrip/, 'Ride fare settlement modal must be preserved');
  });

  test('5. App.jsx resolveRoute supports /driver/profile', () => {
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.match(appContent, /\/driver\/profile/, 'App.jsx must recognize /driver/profile route');

    const resolveRouteFnCode = appContent
      .match(/export function resolveRoute\([\s\S]*?\n\}/)[0]
      .replace('export function resolveRoute', 'function resolveRoute');
    const resolveRoute = new Function(`${resolveRouteFnCode}; return resolveRoute;`)();

    const resolved = resolveRoute('/driver/profile');
    assert.equal(resolved.role, 'driver');
    assert.equal(resolved.page, 'driver-portal');
    assert.equal(resolved.authRole, 'driver');
  });

  test('6. apiClient provides getDriverProfile and updateDriverProfile methods', () => {
    const clientContent = fs.readFileSync(apiClientPath, 'utf8');
    assert.match(clientContent, /getDriverProfile:\s*\(\)\s*=>\s*request\('\/drivers\/me'/);
    assert.match(clientContent, /updateDriverProfile:\s*\(profileData\)\s*=>/);
  });
});
