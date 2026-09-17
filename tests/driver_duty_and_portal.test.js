import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Driver Portal Isolation & Admin Online/Offline Duty Tracking', () => {
  const driverAuthPath = path.resolve('src/pages/DriverAuthPage.jsx');
  const driverPortalPath = path.resolve('src/pages/DriverPortalPage.jsx');
  const adminUsersTabPath = path.resolve('src/pages/admin/AdminUsersTab.jsx');
  const adminPagePath = path.resolve('src/pages/AdminPage.jsx');
  const appPath = path.resolve('src/App.jsx');

  test('1. DriverAuthPage must not have any Customer Portal links or buttons', () => {
    const content = fs.readFileSync(driverAuthPath, 'utf8');
    assert.doesNotMatch(content, /Customer Portal/i, 'DriverAuthPage should not have "Customer Portal" link');
    assert.doesNotMatch(content, /onGoToCustomerSite/, 'DriverAuthPage should not take onGoToCustomerSite prop');
    assert.doesNotMatch(content, /onChangeRole/, 'DriverAuthPage should not take onChangeRole prop');
    assert.match(content, /Partner Fleet/, 'DriverAuthPage header should display Partner Fleet chip');
  });

  test('2. DriverPortalPage must not have Customer Site link or onGoToCustomerSite prop', () => {
    const content = fs.readFileSync(driverPortalPath, 'utf8');
    assert.doesNotMatch(content, /<span>Customer Site<\/span>/i, 'DriverPortalPage should not have Customer Site button');
    assert.doesNotMatch(content, /onGoToCustomerSite/, 'DriverPortalPage should not take onGoToCustomerSite prop');
  });

  test('3. DriverPortalPage implements real-time Online/Offline duty toggle and sync', () => {
    const content = fs.readFileSync(driverPortalPath, 'utf8');
    assert.match(content, /handleToggleOnline/, 'DriverPortalPage should implement handleToggleOnline');
    assert.match(content, /bda_driver_status_updated/, 'DriverPortalPage should emit bda_driver_status_updated event');
    assert.match(content, /bda_registered_drivers/, 'DriverPortalPage should update bda_registered_drivers');
    assert.match(content, /bda_driver_user/, 'DriverPortalPage should update bda_driver_user');
  });

  test('4. App.jsx does not pass onGoToCustomerSite to DriverPortalPage or DriverAuthPage', () => {
    const content = fs.readFileSync(appPath, 'utf8');
    assert.doesNotMatch(content, /<DriverPortalPage[\s\S]*?onGoToCustomerSite/, 'App.jsx should not pass onGoToCustomerSite to DriverPortalPage');
    assert.doesNotMatch(content, /<DriverAuthPage[\s\S]*?onGoToCustomerSite/, 'App.jsx should not pass onGoToCustomerSite to DriverAuthPage');
  });

  test('5. AdminUsersTab displays Online/Offline status badges and duty filter', () => {
    const content = fs.readFileSync(adminUsersTabPath, 'utf8');
    assert.match(content, /ONLINE/, 'AdminUsersTab should render ONLINE badge for drivers');
    assert.match(content, /OFFLINE/, 'AdminUsersTab should render OFFLINE badge for drivers');
    assert.match(content, /driverDutyFilter/, 'AdminUsersTab should have driverDutyFilter state');
    assert.match(content, /onToggleDriverDuty/, 'AdminUsersTab should accept onToggleDriverDuty prop');
    assert.match(content, /Online \(/, 'AdminUsersTab should display Online count in duty filter');
    assert.match(content, /Offline \(/, 'AdminUsersTab should display Offline count in duty filter');
  });

  test('6. AdminPage synchronizes driver duty status and provides toggle action', () => {
    const content = fs.readFileSync(adminPagePath, 'utf8');
    assert.match(content, /bda_driver_status_updated/, 'AdminPage should listen for bda_driver_status_updated event');
    assert.match(content, /handleToggleDriverDuty/, 'AdminPage should implement handleToggleDriverDuty');
    assert.match(content, /onToggleDriverDuty=\{handleToggleDriverDuty\}/, 'AdminPage should pass onToggleDriverDuty to AdminUsersTab');
  });

  test('7. AdminAuthView provides Login only (no Register tab) and sets height to 100vh', () => {
    const adminAuthViewPath = path.resolve('src/pages/admin/AdminAuthView.jsx');
    const content = fs.readFileSync(adminAuthViewPath, 'utf8');
    assert.match(content, />\s*Login\s*</, 'AdminAuthView should display Login');
    assert.doesNotMatch(content, /Admin Register/, 'AdminAuthView should not display Admin Register');
    assert.doesNotMatch(content, /Registering Admin/, 'AdminAuthView should not have Registering Admin action');
    assert.doesNotMatch(content, /Admin Security Passcode/, 'AdminAuthView should not ask for Admin Security Passcode');
    assert.match(content, /h-\[100vh\]|h-screen/, 'AdminAuthView should set height to 100vh');
    assert.match(content, /overflow-hidden/, 'AdminAuthView should prevent overflow on 100vh');
  });
});
