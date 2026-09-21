import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { 
  isDutyAssignedToDriver, 
  isDutyAssignedToOtherDriver, 
  getDriverDuties, 
  formatDuty 
} from '../src/utils/driverDutyHelpers.js';

describe('Respective Driver Assigned Bookings Isolation & Sync Suite', () => {
  // Mock localStorage for Node.js test environment
  const mockStorage = new Map();
  global.localStorage = {
    getItem: (k) => mockStorage.get(k) || null,
    setItem: (k, v) => mockStorage.set(k, String(v)),
    removeItem: (k) => mockStorage.delete(k),
    clear: () => mockStorage.clear()
  };

  const driverManju = {
    id: 'DRV-MANJU-01',
    name: 'Manjunath Gowda',
    phone: '+91 98450 12345',
    upiId: 'manjunath.anna@oksbi',
    isOnline: true
  };

  const driverRamesh = {
    id: 'DRV-RAMESH-02',
    name: 'Ramesh Kumar',
    phone: '+91 98450 99999',
    upiId: 'ramesh.driver@paytm',
    isOnline: true
  };

  beforeEach(() => {
    mockStorage.clear();
  });

  test('1. isDutyAssignedToDriver matches respective driver by phone, name, ID, or UPI', () => {
    // Match by phone
    const bookingByPhone = {
      id: 'BDA-101',
      assignedDriver: 'Driver Assigned',
      assignedDriverPhone: '+91 98450 12345',
      status: 'Assigned'
    };
    assert.strictEqual(isDutyAssignedToDriver(bookingByPhone, driverManju), true);
    assert.strictEqual(isDutyAssignedToDriver(bookingByPhone, driverRamesh), false);

    // Match by name
    const bookingByName = {
      id: 'BDA-102',
      assignedDriver: 'manjunath gowda',
      assignedDriverPhone: '',
      status: 'Assigned'
    };
    assert.strictEqual(isDutyAssignedToDriver(bookingByName, driverManju), true);
    assert.strictEqual(isDutyAssignedToDriver(bookingByName, driverRamesh), false);

    // Match by UPI
    const bookingByUpi = {
      id: 'BDA-103',
      assignedDriverUpi: 'manjunath.anna@oksbi',
      status: 'Assigned'
    };
    assert.strictEqual(isDutyAssignedToDriver(bookingByUpi, driverManju), true);
    assert.strictEqual(isDutyAssignedToDriver(bookingByUpi, driverRamesh), false);
  });

  test('2. isDutyAssignedToOtherDriver detects duties assigned to a different driver', () => {
    const bookingForManju = {
      id: 'BDA-201',
      assignedDriver: 'Manjunath Gowda',
      assignedDriverPhone: '+91 98450 12345',
      status: 'Assigned'
    };

    // For Manju, it's HIS booking, NOT another driver's
    assert.strictEqual(isDutyAssignedToOtherDriver(bookingForManju, driverManju), false);

    // For Ramesh, it IS assigned to another driver (Manju)
    assert.strictEqual(isDutyAssignedToOtherDriver(bookingForManju, driverRamesh), true);

    // Unassigned pending booking
    const pendingBooking = {
      id: 'BDA-202',
      assignedDriver: 'Pending Admin Acceptance',
      assignedDriverPhone: '',
      status: 'Pending'
    };
    assert.strictEqual(isDutyAssignedToOtherDriver(pendingBooking, driverManju), false);
    assert.strictEqual(isDutyAssignedToOtherDriver(pendingBooking, driverRamesh), false);
  });

  test('3. After admin assigns a driver, that booking is shown ONLY to the respective driver', () => {
    const allBookings = [
      // Booking 1: Assigned by admin to Manjunath Gowda
      {
        id: 'BDA-ASSIGNED-MANJU',
        customerName: 'Ananya Sharma',
        customerPhone: '+91 98765 43210',
        pickupArea: 'Indiranagar 100ft Rd',
        dropLocation: 'Kempegowda Int. Airport',
        fare: 899,
        status: 'Assigned',
        assignedDriver: 'Manjunath Gowda',
        assignedDriverPhone: '+91 98450 12345',
        assignedDriverUpi: 'manjunath.anna@oksbi'
      },
      // Booking 2: Assigned by admin to Ramesh Kumar
      {
        id: 'BDA-ASSIGNED-RAMESH',
        customerName: 'Karthik Rao',
        customerPhone: '+91 91234 56789',
        pickupArea: 'Koramangala 4th Block',
        dropLocation: 'Whitefield ITPL',
        fare: 649,
        status: 'Assigned',
        assignedDriver: 'Ramesh Kumar',
        assignedDriverPhone: '+91 98450 99999',
        assignedDriverUpi: 'ramesh.driver@paytm'
      },
      // Booking 3: Truly unassigned, open pending duty
      {
        id: 'BDA-OPEN-DUTY',
        customerName: 'Pooja Hegde',
        customerPhone: '+91 99887 76655',
        pickupArea: 'MG Road',
        dropLocation: 'Electronic City',
        fare: 549,
        status: 'Pending',
        assignedDriver: 'Pending Admin Acceptance'
      }
    ];

    mockStorage.set('bda_driver_bookings', JSON.stringify(allBookings));

    // --- CHECK FOR DRIVER 1 (Manjunath Gowda) ---
    const manjuDuties = getDriverDuties(driverManju);
    
    // Manju should see BDA-ASSIGNED-MANJU in myAssigned
    assert.strictEqual(manjuDuties.myAssigned.length, 1);
    assert.strictEqual(manjuDuties.myAssigned[0].id, 'BDA-ASSIGNED-MANJU');
    assert.strictEqual(manjuDuties.myAssigned[0].customerName, 'Ananya Sharma');

    // Manju should NOT see Ramesh's duty in open pool, only the truly open duty
    assert.strictEqual(manjuDuties.openPool.length, 1);
    assert.strictEqual(manjuDuties.openPool[0].id, 'BDA-OPEN-DUTY');
    assert.ok(!manjuDuties.openPool.some(d => d.id === 'BDA-ASSIGNED-RAMESH'));

    // --- CHECK FOR DRIVER 2 (Ramesh Kumar) ---
    const rameshDuties = getDriverDuties(driverRamesh);

    // Ramesh should see BDA-ASSIGNED-RAMESH in myAssigned
    assert.strictEqual(rameshDuties.myAssigned.length, 1);
    assert.strictEqual(rameshDuties.myAssigned[0].id, 'BDA-ASSIGNED-RAMESH');
    assert.strictEqual(rameshDuties.myAssigned[0].customerName, 'Karthik Rao');

    // Ramesh should NOT see Manju's duty in open pool
    assert.strictEqual(rameshDuties.openPool.length, 1);
    assert.strictEqual(rameshDuties.openPool[0].id, 'BDA-OPEN-DUTY');
    assert.ok(!rameshDuties.openPool.some(d => d.id === 'BDA-ASSIGNED-MANJU'));
  });

  test('4. formatDuty accurately maps customer details, phone, and fare for driver portal', () => {
    const raw = {
      id: 'BDA-7788',
      customerName: 'Sanjay Dutt',
      customerPhone: '+91 98451 22334',
      pickupArea: 'HSR Layout',
      dropLocation: 'Hebbal',
      fare: 750,
      status: 'Assigned',
      assignedDriver: 'Manjunath Gowda'
    };

    const formatted = formatDuty(raw);
    assert.strictEqual(formatted.id, 'BDA-7788');
    assert.strictEqual(formatted.customerName, 'Sanjay Dutt');
    assert.strictEqual(formatted.customerPhone, '+91 98451 22334');
    assert.strictEqual(formatted.payout, '₹750');
    assert.strictEqual(formatted.status, 'Assigned');
    assert.strictEqual(formatted.assignedDriver, 'Manjunath Gowda');
  });
});
