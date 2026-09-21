import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Admin Driver Section Select & Manual Write in Name Slot Suite', () => {
  const rootDir = process.cwd();
  const adminDriverTabPath = path.join(rootDir, 'src/pages/admin/AdminDriverTab.jsx');

  test('1. No separate 3rd slot added: Only 2 slots (Driver Name & Driver Phone)', () => {
    const content = fs.readFileSync(adminDriverTabPath, 'utf8');

    // Verify there is no separate <select id="driver-select-..."> slot
    assert.ok(
      !content.includes('id={`driver-select-${b.id}`}'),
      'Should NOT have a separate slot/input for selecting drivers'
    );
    assert.ok(
      content.includes('driver-name-input-'),
      'Should have driver-name-input slot'
    );
    assert.ok(
      content.includes('driver-phone-input-'),
      'Should have driver-phone-input slot'
    );
  });

  test('2. Driver Name slot allows selecting from registered drivers or manual typing', () => {
    const content = fs.readFileSync(adminDriverTabPath, 'utf8');

    // Dropdown toggle inside the driver name slot
    assert.ok(
      content.includes('driver-select-toggle-'),
      'Driver Name slot should have dropdown chevron toggle to select from registered drivers'
    );
    assert.ok(
      content.includes('openDriverDropdown'),
      'AdminDriverTab should track openDriverDropdown state'
    );
    assert.ok(
      content.includes('availableDrivers.map'),
      'Dropdown menu should display available fleet drivers'
    );
    assert.ok(
      content.includes('driver-dropdown-menu-'),
      'Dropdown menu should have driver-dropdown-menu id'
    );
  });

  test('3. Selecting a driver populates both Driver Name and Driver Phone slots', () => {
    const content = fs.readFileSync(adminDriverTabPath, 'utf8');

    assert.ok(
      content.includes("handleDriverInputChange(b.id, 'name', d.name"),
      'Selecting a driver should populate driver name'
    );
    assert.ok(
      content.includes("handleDriverInputChange(b.id, 'phone', d.phone"),
      'Selecting a driver should populate driver phone'
    );
  });

  test('4. Admin can manually write in Driver Name slot with datalist suggestions', () => {
    const content = fs.readFileSync(adminDriverTabPath, 'utf8');

    assert.ok(
      content.includes('drivers-datalist-'),
      'Driver Name slot should have datalist for autocomplete while manually typing'
    );
    assert.ok(
      content.includes('driver-name-input-'),
      'Driver Name slot input should exist'
    );
  });

  test('5. Cards do not hide dropdown overflow and Accept & Assign directly assigns', () => {
    const content = fs.readFileSync(adminDriverTabPath, 'utf8');

    assert.ok(
      !content.includes('space-y-4 sm:space-y-5 min-w-0 overflow-hidden'),
      'Card container should not have overflow-hidden cutting off dropdown'
    );
    assert.ok(
      content.includes('handleAcceptAndAssignDriver(b.id, currentName, currentPhone)'),
      'Clicking Accept & Assign should call handleAcceptAndAssignDriver directly when fields are filled'
    );
  });
});
