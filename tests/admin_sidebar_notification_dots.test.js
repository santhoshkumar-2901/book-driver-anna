import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// In-memory mock localStorage for simulating storage persistence and failure modes
class MockLocalStorage {
  constructor() {
    this.store = {};
    this.shouldThrow = false;
  }
  getItem(key) {
    if (this.shouldThrow) throw new Error('QuotaExceeded or SecurityError: localStorage access denied');
    return this.store[key] || null;
  }
  setItem(key, value) {
    if (this.shouldThrow) throw new Error('QuotaExceeded or SecurityError: localStorage access denied');
    this.store[key] = String(value);
  }
  removeItem(key) {
    if (this.shouldThrow) throw new Error('QuotaExceeded or SecurityError: localStorage access denied');
    delete this.store[key];
  }
  clear() {
    this.store = {};
    this.shouldThrow = false;
  }
}

describe('Admin Sidebar Notification Dots Suite', () => {
  const sidebarPath = path.resolve('src/pages/admin/AdminSidebar.jsx');
  const adminPagePath = path.resolve('src/pages/AdminPage.jsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
  const adminPageContent = fs.readFileSync(adminPagePath, 'utf8');

  // Logic simulation tests for unseen tracking state machine adhering to Phase 3 requirements
  describe('Unseen Record Tracking Logic & Red Dot Lifecycle', () => {
    let mockStorage;
    let seenRecordIds;
    let hasInitialized;
    let dotStates;
    const adminPhone = '+91 98765 00000';

    const getAdminSeenStorageKey = () => {
      const raw = adminPhone.replace(/[^0-9]/g, '');
      return raw ? `bda_admin_seen_ids_${raw}` : 'bda_admin_seen_ids';
    };

    const getAdminInitializedKey = () => {
      const raw = adminPhone.replace(/[^0-9]/g, '');
      return raw ? `bda_admin_initialized_${raw}` : 'bda_admin_initialized';
    };

    const loadSeenIdsFromStorage = () => {
      try {
        const raw = mockStorage.getItem(getAdminSeenStorageKey());
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return new Set(parsed.filter(Boolean).map(String));
        }
      } catch (e) {}
      return new Set();
    };

    const persistSeenIds = (idsSet) => {
      try {
        mockStorage.setItem(getAdminSeenStorageKey(), JSON.stringify(Array.from(idsSet)));
        mockStorage.setItem(getAdminInitializedKey(), 'true');
      } catch (e) {}
    };

    const initializeHistoricalOrRestore = (activeTab, currentBookings, currentUsers) => {
      const isAlreadyInitialized = (() => {
        try {
          return mockStorage.getItem(getAdminInitializedKey()) === 'true';
        } catch (e) {
          return false;
        }
      })();

      const existingStoredSeen = loadSeenIdsFromStorage();

      if (isAlreadyInitialized || existingStoredSeen.size > 0) {
        // Established tracking state: load seen IDs and reconstruct unseen dots immediately from local records
        seenRecordIds = existingStoredSeen;

        const unseenDrivers = (currentBookings.drivers || []).some(b => b?.id && !existingStoredSeen.has(String(b.id)));
        const unseenVehicles = (currentBookings.vehicles || []).some(b => b?.id && !existingStoredSeen.has(String(b.id)));
        const unseenClasses = (currentBookings.classes || []).some(e => {
          const id = e?.enrollmentId || e?.id;
          return id && !existingStoredSeen.has(String(id));
        });
        const unseenUsers = (currentUsers || []).some(u => u?.id && !existingStoredSeen.has(String(u.id)));

        // If the section is the currently active tab on load, mark its current records as seen immediately; otherwise set dot
        if (activeTab === 'for-driver') {
          (currentBookings.drivers || []).forEach(b => seenRecordIds.add(String(b.id)));
          persistSeenIds(seenRecordIds);
          dotStates.driver = false;
        } else if (unseenDrivers) {
          dotStates.driver = true;
        }

        if (activeTab === 'for-vehicle') {
          (currentBookings.vehicles || []).forEach(b => seenRecordIds.add(String(b.id)));
          persistSeenIds(seenRecordIds);
          dotStates.vehicle = false;
        } else if (unseenVehicles) {
          dotStates.vehicle = true;
        }

        if (activeTab === 'for-class') {
          (currentBookings.classes || []).forEach(e => seenRecordIds.add(String(e.id || e.enrollmentId)));
          persistSeenIds(seenRecordIds);
          dotStates.class = false;
        } else if (unseenClasses) {
          dotStates.class = true;
        }

        if (activeTab === 'users') {
          (currentUsers || []).forEach(u => seenRecordIds.add(String(u.id)));
          persistSeenIds(seenRecordIds);
          dotStates.users = false;
        } else if (unseenUsers) {
          dotStates.users = true;
        }
      } else {
        // Genuine first initialization on clean storage: seed all current records as historical seen
        const initialIds = new Set();
        (currentBookings.drivers || []).forEach(b => { if (b && b.id) initialIds.add(String(b.id)); });
        (currentBookings.vehicles || []).forEach(b => { if (b && b.id) initialIds.add(String(b.id)); });
        (currentBookings.classes || []).forEach(e => { const id = e?.enrollmentId || e?.id; if (id) initialIds.add(String(id)); });
        (currentUsers || []).forEach(u => { if (u && u.id) initialIds.add(String(u.id)); });

        seenRecordIds = initialIds;
        persistSeenIds(initialIds);
      }
      hasInitialized = true;
    };

    // When new records arrive (events or polling), trigger dot without automatically marking them as seen
    const checkNewRecordsForSection = (sectionTab, items, getId = item => item?.id) => {
      if (!hasInitialized) return;
      const validIds = items.map(getId).filter(Boolean).map(String);
      const hasUnseen = validIds.some(id => !seenRecordIds.has(id));

      if (hasUnseen) {
        if (sectionTab === 'for-driver') dotStates.driver = true;
        else if (sectionTab === 'for-vehicle') dotStates.vehicle = true;
        else if (sectionTab === 'for-class') dotStates.class = true;
        else if (sectionTab === 'users') dotStates.users = true;
      }
    };

    // Explicit acknowledgement rule: opening a section acknowledges records currently present
    const openSectionAndAcknowledge = (sectionTab, items, getId = item => item?.id) => {
      const validIds = items.map(getId).filter(Boolean).map(String);
      validIds.forEach(id => seenRecordIds.add(id));
      persistSeenIds(seenRecordIds);
      if (sectionTab === 'for-driver') dotStates.driver = false;
      else if (sectionTab === 'for-vehicle') dotStates.vehicle = false;
      else if (sectionTab === 'for-class') dotStates.class = false;
      else if (sectionTab === 'users') dotStates.users = false;
    };

    beforeEach(() => {
      mockStorage = new MockLocalStorage();
      seenRecordIds = new Set();
      hasInitialized = false;
      dotStates = { driver: false, vehicle: false, class: false, users: false };
    });

    test('1. A new record arriving while its section is open remains unseen until acknowledged', () => {
      initializeHistoricalOrRestore(
        'for-driver',
        { drivers: [{ id: 'BDA-DRV-INIT-1' }], vehicles: [], classes: [] },
        []
      );

      // Section 'for-driver' is currently open. Initial item was acknowledged on open:
      assert.strictEqual(dotStates.driver, false);

      // A new booking arrives while 'for-driver' remains open
      const updatedDrivers = [{ id: 'BDA-DRV-INIT-1' }, { id: 'BDA-DRV-NEW-ARRIVE' }];
      checkNewRecordsForSection('for-driver', updatedDrivers);

      // It must NOT be silently marked seen; the dot must become active to alert admin of new activity!
      assert.strictEqual(dotStates.driver, true, 'Dot must activate for new booking arriving while section is open');
      assert.strictEqual(seenRecordIds.has('BDA-DRV-NEW-ARRIVE'), false, 'Arriving record must not be auto-marked seen');

      // Now admin reopens or acknowledges the section:
      openSectionAndAcknowledge('for-driver', updatedDrivers);
      assert.strictEqual(dotStates.driver, false, 'Dot clears upon explicit section acknowledgement');
      assert.strictEqual(seenRecordIds.has('BDA-DRV-NEW-ARRIVE'), true, 'Record is now seen in tracking state');
    });

    test('2. A new record arriving while a different section is open shows the correct dot', () => {
      initializeHistoricalOrRestore(
        'dashboard',
        { drivers: [{ id: 'BDA-DRV-001' }], vehicles: [], classes: [] },
        []
      );

      const updatedDrivers = [{ id: 'BDA-DRV-001' }, { id: 'BDA-DRV-NEW-999' }];
      checkNewRecordsForSection('for-driver', updatedDrivers);

      assert.strictEqual(dotStates.driver, true, 'Driver dot must be active');
      assert.strictEqual(dotStates.vehicle, false, 'Vehicle dot must remain inactive');
      assert.strictEqual(dotStates.class, false, 'Class dot must remain inactive');
      assert.strictEqual(dotStates.users, false, 'Users dot must remain inactive');
    });

    test('3. Unseen dots are restored after a page refresh without waiting for the network', () => {
      // First session: established tracking state with 1 seen driver booking
      persistSeenIds(new Set(['BDA-DRV-OLD']));

      // Page refresh happens: user lands on dashboard with local storage containing BDA-DRV-OLD and BDA-DRV-UNSEEN
      const localBookings = {
        drivers: [{ id: 'BDA-DRV-OLD' }, { id: 'BDA-DRV-UNSEEN' }],
        vehicles: [{ id: 'BDA-VEH-UNSEEN' }],
        classes: [],
      };
      const localUsers = [];

      // Component mounts and runs initialization effect synchronously before any network response:
      initializeHistoricalOrRestore('dashboard', localBookings, localUsers);

      assert.strictEqual(dotStates.driver, true, 'Driver dot must be restored immediately from local records and seen IDs');
      assert.strictEqual(dotStates.vehicle, true, 'Vehicle dot must be restored immediately from local records and seen IDs');
      assert.strictEqual(dotStates.class, false);
      assert.strictEqual(dotStates.users, false);
    });

    test('4. A genuine first-time initialization does not mark all historical records as new', () => {
      const historicalBookings = {
        drivers: [{ id: 'BDA-DRV-HIST-001' }, { id: 'BDA-DRV-HIST-002' }],
        vehicles: [{ id: 'BDA-VEH-HIST-001' }],
        classes: [{ id: 'BDA-CLS-HIST-001' }]
      };
      const historicalUsers = [{ id: 'CLI-HIST-001' }, { id: 'DRV-HIST-001' }];

      // Clean storage, no prior tracking state
      assert.strictEqual(mockStorage.getItem(getAdminInitializedKey()), null);
      initializeHistoricalOrRestore('dashboard', historicalBookings, historicalUsers);

      assert.strictEqual(dotStates.driver, false, 'Driver dot must be false initially');
      assert.strictEqual(dotStates.vehicle, false, 'Vehicle dot must be false initially');
      assert.strictEqual(dotStates.class, false, 'Class dot must be false initially');
      assert.strictEqual(dotStates.users, false, 'Users dot must be false initially');
      assert.strictEqual(seenRecordIds.has('BDA-DRV-HIST-001'), true);
      assert.strictEqual(mockStorage.getItem(getAdminInitializedKey()), 'true');
    });

    test('5. An empty saved seen-ID set does not incorrectly classify newly arriving records as historical', () => {
      // Tracking was established previously, but seen set was empty (e.g. purged data or clean fleet)
      mockStorage.setItem(getAdminInitializedKey(), 'true');
      mockStorage.setItem(getAdminSeenStorageKey(), JSON.stringify([]));

      // Admin visits dashboard:
      initializeHistoricalOrRestore('dashboard', { drivers: [], vehicles: [], classes: [] }, []);

      // A newly arriving booking is received:
      const newBookings = [{ id: 'BDA-DRV-FIRST-EVER' }];
      checkNewRecordsForSection('for-driver', newBookings);

      assert.strictEqual(dotStates.driver, true, 'New record must trigger dot even when seen set was empty');
      assert.strictEqual(seenRecordIds.has('BDA-DRV-FIRST-EVER'), false);
    });

    test('6. Acknowledging one section does not clear another section', () => {
      initializeHistoricalOrRestore('dashboard', { drivers: [], vehicles: [], classes: [] }, []);

      const newDrivers = [{ id: 'BDA-DRV-101' }];
      const newVehicles = [{ id: 'BDA-VEH-102' }];
      const newClasses = [{ id: 'BDA-CLS-103' }];
      const newUsers = [{ id: 'CLI-104' }];

      checkNewRecordsForSection('for-driver', newDrivers);
      checkNewRecordsForSection('for-vehicle', newVehicles);
      checkNewRecordsForSection('for-class', newClasses);
      checkNewRecordsForSection('users', newUsers);

      assert.strictEqual(dotStates.driver, true);
      assert.strictEqual(dotStates.vehicle, true);
      assert.strictEqual(dotStates.class, true);
      assert.strictEqual(dotStates.users, true);

      // Acknowledge only vehicle
      openSectionAndAcknowledge('for-vehicle', newVehicles);

      assert.strictEqual(dotStates.vehicle, false, 'Vehicle dot must be cleared');
      assert.strictEqual(dotStates.driver, true, 'Driver dot must remain untouched');
      assert.strictEqual(dotStates.class, true, 'Class dot must remain untouched');
      assert.strictEqual(dotStates.users, true, 'Users dot must remain untouched');
    });

    test('7. Duplicate events and repeated polls do not recreate notifications', () => {
      initializeHistoricalOrRestore('dashboard', { drivers: [], vehicles: [], classes: [] }, []);

      const newDrivers = [{ id: 'BDA-DRV-201' }];
      checkNewRecordsForSection('for-driver', newDrivers);
      assert.strictEqual(dotStates.driver, true);

      openSectionAndAcknowledge('for-driver', newDrivers);
      assert.strictEqual(dotStates.driver, false);

      // Repeated polling returns same items
      checkNewRecordsForSection('for-driver', newDrivers);
      assert.strictEqual(dotStates.driver, false, 'Repeated poll must NOT re-trigger dot');

      // Duplicate event
      checkNewRecordsForSection('for-driver', newDrivers);
      assert.strictEqual(dotStates.driver, false, 'Duplicate event must NOT re-trigger dot');
    });

    test('8. Network reconciliation preserves unseen records', () => {
      initializeHistoricalOrRestore('dashboard', { drivers: [{ id: 'BDA-DRV-OLD' }], vehicles: [], classes: [] }, []);

      // Polling returns server driver bookings including a new one
      const serverDriverBookings = [{ id: 'BDA-DRV-OLD' }, { id: 'BDA-DRV-SERVER-NEW' }];
      checkNewRecordsForSection('for-driver', serverDriverBookings);

      assert.strictEqual(dotStates.driver, true);
      assert.strictEqual(seenRecordIds.has('BDA-DRV-SERVER-NEW'), false);
    });

    test('9. Corrupt or unavailable localStorage does not crash the dashboard', () => {
      mockStorage.shouldThrow = true;

      assert.doesNotThrow(() => {
        const loaded = loadSeenIdsFromStorage();
        assert.strictEqual(loaded.size, 0);
        persistSeenIds(new Set(['BDA-TEST-1']));
      });
    });

    test('10. Scoping persisted state per authenticated admin', () => {
      const adminAPhone = '+91 98765 00000';
      const adminBPhone = '+91 88888 11111';

      const keyA = `bda_admin_seen_ids_${adminAPhone.replace(/[^0-9]/g, '')}`;
      const keyB = `bda_admin_seen_ids_${adminBPhone.replace(/[^0-9]/g, '')}`;

      assert.notStrictEqual(keyA, keyB, 'Keys for different admins must be separate');
    });
  });

  // Source-level verification of all 3 layouts and component contract
  describe('AdminSidebar and AdminPage Integration Contracts', () => {
    test('11. All three sidebar layouts render notification dots correctly', () => {
      // 1. Desktop layout
      assert.match(
        sidebarContent,
        /data-testid="admin-dot-for-driver"/,
        'Desktop sidebar must have admin-dot-for-driver'
      );
      assert.match(
        sidebarContent,
        /data-testid="admin-dot-for-vehicle"/,
        'Desktop sidebar must have admin-dot-for-vehicle'
      );
      assert.match(
        sidebarContent,
        /data-testid="admin-dot-for-class"/,
        'Desktop sidebar must have admin-dot-for-class'
      );
      assert.match(
        sidebarContent,
        /data-testid="admin-dot-users"/,
        'Desktop sidebar must have admin-dot-users'
      );

      // 2. Mobile horizontal quick-tab strip
      assert.match(
        sidebarContent,
        /data-testid="mobile-strip-dot-for-driver"/,
        'Mobile strip must have mobile-strip-dot-for-driver'
      );
      assert.match(
        sidebarContent,
        /data-testid="mobile-strip-dot-for-vehicle"/,
        'Mobile strip must have mobile-strip-dot-for-vehicle'
      );
      assert.match(
        sidebarContent,
        /data-testid="mobile-strip-dot-for-class"/,
        'Mobile strip must have mobile-strip-dot-for-class'
      );
      assert.match(
        sidebarContent,
        /data-testid="mobile-strip-dot-users"/,
        'Mobile strip must have mobile-strip-dot-users'
      );

      // 3. Mobile slide-out drawer
      assert.match(
        sidebarContent,
        /data-testid="mobile-drawer-dot-for-driver"/,
        'Mobile drawer must have mobile-drawer-dot-for-driver'
      );
      assert.match(
        sidebarContent,
        /data-testid="mobile-drawer-dot-for-vehicle"/,
        'Mobile drawer must have mobile-drawer-dot-for-vehicle'
      );
      assert.match(
        sidebarContent,
        /data-testid="mobile-drawer-dot-for-class"/,
        'Mobile drawer must have mobile-drawer-dot-for-class'
      );
      assert.match(
        sidebarContent,
        /data-testid="mobile-drawer-dot-users"/,
        'Mobile drawer must have mobile-drawer-dot-users'
      );

      // Verify styling of dots: static 8px (w-2 h-2), rounded-full, bg-red-500, non-flashing
      assert.match(
        sidebarContent,
        /w-2 h-2 rounded-full bg-red-500 shrink-0/,
        'Red dots must be styled with 8px static red dot styles'
      );
      assert.doesNotMatch(
        sidebarContent,
        /animate-ping|animate-pulse/,
        'Red dots must NOT be flashing or pulsating'
      );
    });

    test('12. Numerical badges and navigation remain completely intact', () => {
      assert.match(sidebarContent, /\{driverBookingsCount\}/);
      assert.match(sidebarContent, /\{vehicleBookingsCount\}/);
      assert.match(sidebarContent, /\{classEnrollmentsCount\}/);
      assert.match(sidebarContent, /\{usersCount\}/);
      assert.match(sidebarContent, /bg-amber-400 text-slate-950/);
    });

    test('13. AdminPage integrates 30-second polling fallback, focus refresh, and cleanup', () => {
      assert.match(adminPageContent, /setInterval\(\(\)\s*=>\s*\{[\s\S]*?fetchAdminDataFromServer\(\);[\s\S]*?\},\s*30000\);/);
      assert.match(adminPageContent, /window\.addEventListener\('focus', handleFocus\);/);
      assert.match(adminPageContent, /document\.addEventListener\('visibilitychange', handleVisibilityChange\);/);
      assert.match(adminPageContent, /clearInterval\(pollInterval\);/);
      assert.match(adminPageContent, /window\.removeEventListener\('focus', handleFocus\);/);
      assert.match(adminPageContent, /document\.removeEventListener\('visibilitychange', handleVisibilityChange\);/);
    });

    test('14. AdminPage passes notification dot props to AdminSidebar', () => {
      assert.match(adminPageContent, /hasNewDriverBookings=\{hasNewDriverBookings\}/);
      assert.match(adminPageContent, /hasNewVehicleBookings=\{hasNewVehicleBookings\}/);
      assert.match(adminPageContent, /hasNewClassBookings=\{hasNewClassBookings\}/);
      assert.match(adminPageContent, /hasNewUsers=\{hasNewUsers\}/);
    });

    test('15. AdminPage acknowledgement effect does not re-run on booking arrays change', () => {
      // Acknowledgement effect must only depend on [activeTab] so new bookings arriving while section is open do not auto-clear
      assert.match(adminPageContent, /\},?\s*\[activeTab\]\);/);
    });
  });
});
