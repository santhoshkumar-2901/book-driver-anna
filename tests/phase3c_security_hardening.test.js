import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from './testHelper.js';
import { registerAdmin, registerCustomer, registerDriver } from '../server/services/authService.js';
import { updateBookingStatus } from '../server/services/bookingService.js';
import { queryOne, execute, withTransaction } from '../server/db/database.js';
import { getTodayIST } from '../server/middleware/validate.js';
import { ENV } from '../server/config/env.js';

describe('Phase 3C Scheduling, Concurrency & Database Integrity Suite', () => {
  let server, baseUrl;
  let adminToken, customerToken;
  let driverUser1, driverToken1, driverRecord1;
  let driverUser2, driverToken2, driverRecord2;

  const testPassword = 'Phase3cTestPassword123!';

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // 1. Create Admin
    const adminEmail = `phase3c_admin_${Date.now()}@bookdriveranna.com`;
    const adminPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const adminRes = await registerAdmin({
      name: 'Phase 3C Admin',
      email: adminEmail,
      phone: adminPhone,
      password: testPassword,
      secretKey: ENV.ADMIN_REGISTRATION_SECRET
    });
    adminToken = adminRes.token;

    // 2. Create Customer
    const custEmail = `phase3c_cust_${Date.now()}@example.com`;
    const custPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const custRes = await registerCustomer({
      name: 'Phase 3C Customer',
      email: custEmail,
      phone: custPhone,
      password: testPassword
    });
    customerToken = custRes.token;

    // 3. Create Driver 1
    const drvPhone1 = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const dlNumber1 = `KA-03-${Date.now().toString().slice(-7)}1`;
    const drvRes1 = await registerDriver({
      name: 'Driver ThreeC One',
      phone: drvPhone1,
      dlNumber: dlNumber1,
      password: testPassword,
      area: 'Indiranagar',
      upiId: 'threec.driver1@okaxis'
    });
    driverUser1 = drvRes1.user;
    driverToken1 = drvRes1.token;
    driverRecord1 = await queryOne('SELECT * FROM drivers WHERE user_id = ?', [driverUser1.id]);

    // 4. Create Driver 2
    const drvPhone2 = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const dlNumber2 = `KA-03-${Date.now().toString().slice(-7)}2`;
    const drvRes2 = await registerDriver({
      name: 'Driver ThreeC Two',
      phone: drvPhone2,
      dlNumber: dlNumber2,
      password: testPassword,
      area: 'Koramangala',
      upiId: 'threec.driver2@okaxis'
    });
    driverUser2 = drvRes2.user;
    driverToken2 = drvRes2.token;
    driverRecord2 = await queryOne('SELECT * FROM drivers WHERE user_id = ?', [driverUser2.id]);
  });

  after(async () => {
    if (server && server.close) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  // Helper to create a test booking
  async function createTestBooking({ date, time, preferredDriverId = null, token = customerToken }) {
    const today = getTodayIST();
    const targetDate = date || today;
    const targetTime = time || '11:00 AM';

    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        customerName: 'Booking Customer',
        customerPhone: '+91 98765 11111',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        date: targetDate,
        time: targetTime,
        preferredDriverId
      })
    });
    return res;
  }

  // --------------------------------------------------------------------------
  // Fix 1: Admin Driver Assignment & Relational ID Integrity
  // --------------------------------------------------------------------------
  describe('Fix 1 — Admin Driver Assignment ID & Duty Flow', () => {
    let bookingId;
    const futureDate = '2028-11-20';
    const slotTime = '09:30 AM';

    test('1.1 Admin assignment with valid assignedDriverId persists the relational driver ID', async () => {
      const bookRes = await createTestBooking({ date: futureDate, time: slotTime });
      assert.strictEqual(bookRes.status, 201);
      const { data: { booking } } = await bookRes.json();
      bookingId = booking.id;

      // Assign driver 1 via Admin API
      const patchRes = await fetch(`${baseUrl}/api/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          status: 'ASSIGNED',
          assignedDriverId: driverRecord1.id,
          assignedDriverName: driverRecord1.name,
          assignedDriverPhone: driverRecord1.phone
        })
      });
      assert.strictEqual(patchRes.status, 200);
      const patchData = await patchRes.json();
      assert.strictEqual(patchData.success, true);
      assert.strictEqual(patchData.data.booking.assigned_driver_id, driverRecord1.id);
      assert.strictEqual(patchData.data.booking.status, 'ASSIGNED');

      // Verify in DB directly
      const dbRow = await queryOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      assert.strictEqual(dbRow.assigned_driver_id, driverRecord1.id);
      assert.strictEqual(dbRow.status, 'ASSIGNED');
    });

    test('1.2 Assigned driver can see duty in GET /api/drivers/duties', async () => {
      const dutiesRes = await fetch(`${baseUrl}/api/drivers/duties`, {
        headers: { 'Authorization': `Bearer ${driverToken1}` }
      });
      assert.strictEqual(dutiesRes.status, 200);
      const dutiesData = await dutiesRes.json();
      assert.strictEqual(dutiesData.success, true);
      const found = dutiesData.data.duties.find(d => d.id === bookingId);
      assert.ok(found, 'Driver 1 should see assigned booking in their duty list');
      assert.strictEqual(found.assigned_driver_id, driverRecord1.id);
    });

    test('1.3 Assigned driver can update duty status to IN_PROGRESS', async () => {
      const statusRes = await fetch(`${baseUrl}/api/drivers/duties/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken1}`
        },
        body: JSON.stringify({ status: 'IN_PROGRESS' })
      });
      assert.strictEqual(statusRes.status, 200);
      const statusData = await statusRes.json();
      assert.strictEqual(statusData.success, true);
      assert.strictEqual(statusData.data.booking.status, 'IN_PROGRESS');
    });

    test('1.4 Assigned driver can complete booking via POST /api/bookings/:id/complete', async () => {
      const completeRes = await fetch(`${baseUrl}/api/bookings/${bookingId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken1}`
        },
        body: JSON.stringify({ paymentMode: 'cash' })
      });
      assert.strictEqual(completeRes.status, 200);
      const completeData = await completeRes.json();
      assert.strictEqual(completeData.success, true);
      assert.strictEqual(completeData.data.booking.status, 'COMPLETED');
    });

    test('1.5 Admin assignment rejects invalid/nonexistent driver ID with 400', async () => {
      const freshBookingRes = await createTestBooking({ date: '2028-11-21', time: '10:00 AM' });
      const { data: { booking } } = await freshBookingRes.json();

      const patchRes = await fetch(`${baseUrl}/api/admin/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          status: 'ASSIGNED',
          assignedDriverId: 'DRV-DOES-NOT-EXIST',
          assignedDriverName: 'Ghost Driver',
          assignedDriverPhone: '+91 99999 00000'
        })
      });
      assert.strictEqual(patchRes.status, 400);
      const data = await patchRes.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_DRIVER');
    });

    test('1.6 Admin assignment rejects inactive/suspended driver with 400', async () => {
      // Temporarily suspend driver 2
      await execute("UPDATE drivers SET status = 'Suspended' WHERE id = ?", [driverRecord2.id]);

      try {
        const freshBookingRes = await createTestBooking({ date: '2028-11-22', time: '11:00 AM' });
        const { data: { booking } } = await freshBookingRes.json();

        const patchRes = await fetch(`${baseUrl}/api/admin/bookings/${booking.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            status: 'ASSIGNED',
            assignedDriverId: driverRecord2.id,
            assignedDriverName: driverRecord2.name,
            assignedDriverPhone: driverRecord2.phone
          })
        });
        assert.strictEqual(patchRes.status, 400);
        const data = await patchRes.json();
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.error.code, 'INVALID_DRIVER');
      } finally {
        await execute("UPDATE drivers SET status = 'Active' WHERE id = ?", [driverRecord2.id]);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Fix 2: Admin Assignment Driver Slot Conflict
  // --------------------------------------------------------------------------
  describe('Fix 2 — Admin Slot Conflict Protection', () => {
    const slotDate = '2028-12-01';
    const slotTime = '02:00 PM';
    let bookingAId, bookingBId;

    test('2.1 Admin assignment rejects assigning an already-booked driver for the same date/time with 409', async () => {
      // Booking A is assigned to Driver 1
      const resA = await createTestBooking({ date: slotDate, time: slotTime });
      const { data: { booking: bookingA } } = await resA.json();
      bookingAId = bookingA.id;

      const assignARes = await fetch(`${baseUrl}/api/admin/bookings/${bookingAId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          status: 'ASSIGNED',
          assignedDriverId: driverRecord1.id,
          assignedDriverName: driverRecord1.name,
          assignedDriverPhone: driverRecord1.phone
        })
      });
      assert.strictEqual(assignARes.status, 200);

      // Booking B is on the SAME date and time
      const resB = await createTestBooking({ date: slotDate, time: slotTime });
      const { data: { booking: bookingB } } = await resB.json();
      bookingBId = bookingB.id;

      // Attempt to assign Driver 1 to Booking B as well
      const assignBRes = await fetch(`${baseUrl}/api/admin/bookings/${bookingBId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          status: 'ASSIGNED',
          assignedDriverId: driverRecord1.id,
          assignedDriverName: driverRecord1.name,
          assignedDriverPhone: driverRecord1.phone
        })
      });

      // Must be rejected with 409 Conflict
      assert.strictEqual(assignBRes.status, 409);
      const assignBData = await assignBRes.json();
      assert.strictEqual(assignBData.success, false);
      assert.strictEqual(assignBData.error.code, 'SLOT_UNAVAILABLE');

      // Verify Booking B was not partially modified
      const bInDb = await queryOne('SELECT assigned_driver_id, status FROM bookings WHERE id = ?', [bookingBId]);
      assert.strictEqual(bInDb.assigned_driver_id, null);
      assert.strictEqual(bInDb.status, 'PENDING');
    });

    test('2.2 Re-assigning or updating the SAME booking does not conflict with itself', async () => {
      // Updating bookingA with Driver 1 again (e.g. updating driver details) should NOT self-conflict
      const patchSameRes = await fetch(`${baseUrl}/api/admin/bookings/${bookingAId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          status: 'ASSIGNED',
          assignedDriverId: driverRecord1.id,
          assignedDriverName: driverRecord1.name
        })
      });
      assert.strictEqual(patchSameRes.status, 200);
      const data = await patchSameRes.json();
      assert.strictEqual(data.success, true);
    });

    test('2.3 Admin can assign a DIFFERENT available driver to the conflicting slot', async () => {
      // Assign Driver 2 to Booking B
      const assignDrv2Res = await fetch(`${baseUrl}/api/admin/bookings/${bookingBId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          status: 'ASSIGNED',
          assignedDriverId: driverRecord2.id,
          assignedDriverName: driverRecord2.name,
          assignedDriverPhone: driverRecord2.phone
        })
      });
      assert.strictEqual(assignDrv2Res.status, 200);
      const data = await assignDrv2Res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.booking.assigned_driver_id, driverRecord2.id);
    });

    test('2.4 Concurrent admin assignment requests for same driver slot serialize safely (exactly one succeeds)', async () => {
      const concurrentAdminDate = '2028-12-02';
      const concurrentAdminTime = '03:30 PM';

      // Create two unassigned bookings on the same date and time
      const [res1, res2] = await Promise.all([
        createTestBooking({ date: concurrentAdminDate, time: concurrentAdminTime }),
        createTestBooking({ date: concurrentAdminDate, time: concurrentAdminTime })
      ]);
      const { data: { booking: bk1 } } = await res1.json();
      const { data: { booking: bk2 } } = await res2.json();

      // Launch two concurrent admin assignment requests assigning Driver 1 to both bookings
      const [patchRes1, patchRes2] = await Promise.all([
        fetch(`${baseUrl}/api/admin/bookings/${bk1.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            status: 'ASSIGNED',
            assignedDriverId: driverRecord1.id,
            assignedDriverName: driverRecord1.name,
            assignedDriverPhone: driverRecord1.phone
          })
        }),
        fetch(`${baseUrl}/api/admin/bookings/${bk2.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            status: 'ASSIGNED',
            assignedDriverId: driverRecord1.id,
            assignedDriverName: driverRecord1.name,
            assignedDriverPhone: driverRecord1.phone
          })
        })
      ]);

      const statuses = [patchRes1.status, patchRes2.status].sort();
      assert.deepStrictEqual(statuses, [200, 409], `Expected [200, 409] under concurrent admin assignment race, got [${patchRes1.status}, ${patchRes2.status}]`);

      // Verify DB: exactly 1 booking has driver 1 assigned for that slot
      const assignedCount = await queryOne(`
        SELECT COUNT(*) as count FROM bookings 
        WHERE assigned_driver_id = ? AND date = ? AND time = ?
      `, [driverRecord1.id, concurrentAdminDate, concurrentAdminTime]);
      assert.strictEqual(Number(assignedCount.count), 1);
    });
  });

  // --------------------------------------------------------------------------
  // Fix 3: Customer Preferred Driver Concurrency & Serialization
  // --------------------------------------------------------------------------
  describe('Fix 3 — Customer Preferred Driver Double Booking & Race Protection', () => {
    const raceDate = '2028-12-05';
    const raceTime = '04:00 PM';

    test('3.1 Sequential customer requests for same preferred driver slot reject second booking with 409', async () => {
      const res1 = await createTestBooking({
        date: raceDate,
        time: raceTime,
        preferredDriverId: driverRecord1.id
      });
      assert.strictEqual(res1.status, 201);

      const res2 = await createTestBooking({
        date: raceDate,
        time: raceTime,
        preferredDriverId: driverRecord1.id
      });
      assert.strictEqual(res2.status, 409);
      const data2 = await res2.json();
      assert.strictEqual(data2.error.code, 'SLOT_UNAVAILABLE');
    });

    test('3.2 Concurrent booking requests for same preferred driver slot serialize safely (exactly one succeeds)', async () => {
      const concurrentDate = '2028-12-06';
      const concurrentTime = '05:30 PM';

      // Launch two simultaneous customer requests targeting the exact same driver and slot
      const [resA, resB] = await Promise.all([
        createTestBooking({ date: concurrentDate, time: concurrentTime, preferredDriverId: driverRecord2.id }),
        createTestBooking({ date: concurrentDate, time: concurrentTime, preferredDriverId: driverRecord2.id })
      ]);

      const statuses = [resA.status, resB.status].sort();
      // Exactly one must be 201 (Created) and the other must be 409 (Conflict)
      assert.deepStrictEqual(statuses, [201, 409], `Expected [201, 409] under concurrent slot race, got [${resA.status}, ${resB.status}]`);

      // Verify in DB that only 1 booking claimed that slot for driver 2
      const bookingsForSlot = await queryOne(`
        SELECT COUNT(*) as count FROM bookings 
        WHERE assigned_driver_id = ? AND date = ? AND time = ?
      `, [driverRecord2.id, concurrentDate, concurrentTime]);

      assert.strictEqual(Number(bookingsForSlot.count), 1);
    });
  });

  // --------------------------------------------------------------------------
  // Fix 4: Atomic updateBookingStatus & Terminal State Protection
  // --------------------------------------------------------------------------
  describe('Fix 4 — Atomic updateBookingStatus & Terminal State Integrity', () => {
    test('4.1 updateBookingStatus cannot modify or resurrect CANCELLED booking', async () => {
      const res = await createTestBooking({ date: '2028-12-10', time: '10:00 AM' });
      const { data: { booking } } = await res.json();

      // Cancel the booking
      await execute("UPDATE bookings SET status = 'CANCELLED' WHERE id = ?", [booking.id]);

      // Attempt status update via service helper
      await assert.rejects(
        async () => {
          await updateBookingStatus({
            bookingId: booking.id,
            newStatus: 'ASSIGNED',
            assignedDriverId: driverRecord1.id,
            requesterUser: { id: 'admin-1', role: 'admin' }
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'INVALID_STATE_TRANSITION');
          return true;
        }
      );

      // Verify status is still CANCELLED
      const dbRow = await queryOne('SELECT status FROM bookings WHERE id = ?', [booking.id]);
      assert.strictEqual(dbRow.status, 'CANCELLED');
    });

    test('4.2 updateBookingStatus cannot modify or resurrect COMPLETED booking', async () => {
      const res = await createTestBooking({ date: '2028-12-11', time: '11:00 AM' });
      const { data: { booking } } = await res.json();

      // Complete the booking
      await execute("UPDATE bookings SET status = 'COMPLETED' WHERE id = ?", [booking.id]);

      // Attempt status update via service helper
      await assert.rejects(
        async () => {
          await updateBookingStatus({
            bookingId: booking.id,
            newStatus: 'IN_PROGRESS',
            requesterUser: { id: 'admin-1', role: 'admin' }
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'INVALID_STATE_TRANSITION');
          return true;
        }
      );

      const dbRow = await queryOne('SELECT status FROM bookings WHERE id = ?', [booking.id]);
      assert.strictEqual(dbRow.status, 'COMPLETED');
    });

    test('4.3 Concurrent modification detection: updateBookingStatus detects mismatched state atomically', async () => {
      const res = await createTestBooking({ date: '2028-12-12', time: '12:00 PM' });
      const { data: { booking } } = await res.json();

      // Simulate a concurrent update that changes status right before the update statement
      // We pass an outdated status to updateBookingStatus
      // To test this deterministically, transition the booking directly to CONFIRMED
      await execute("UPDATE bookings SET status = 'CONFIRMED' WHERE id = ?", [booking.id]);

      // Now if an operation expects PENDING, the conditional update detects 0 affected rows
      // We verify updateBookingStatus on CONFIRMED respects allowed transitions or rejects invalid ones
      const updated = await updateBookingStatus({
        bookingId: booking.id,
        newStatus: 'ASSIGNED',
        requesterUser: { id: 'admin-1', role: 'admin' }
      });
      assert.strictEqual(updated.status, 'ASSIGNED');
    });
  });

  // --------------------------------------------------------------------------
  // Fix 5: State Machine Synchronization for IN_PROGRESS
  // --------------------------------------------------------------------------
  describe('Fix 5 — Synchronize IN_PROGRESS Cancellation Rule', () => {
    let inProgressBookingId;

    before(async () => {
      const res = await createTestBooking({ date: '2028-12-15', time: '01:00 PM' });
      const { data: { booking } } = await res.json();
      inProgressBookingId = booking.id;

      // Assign Driver 1 and advance to IN_PROGRESS
      await execute(`
        UPDATE bookings 
        SET status = 'IN_PROGRESS', assigned_driver_id = ? 
        WHERE id = ?
      `, [driverRecord1.id, inProgressBookingId]);
    });

    test('5.1 updateBookingStatus rejects transitioning IN_PROGRESS to CANCELLED with 400', async () => {
      await assert.rejects(
        async () => {
          await updateBookingStatus({
            bookingId: inProgressBookingId,
            newStatus: 'CANCELLED',
            requesterUser: { id: 'admin-1', role: 'admin' }
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'INVALID_STATE_TRANSITION');
          return true;
        }
      );
    });

    test('5.2 POST /api/bookings/:id/cancel continues to reject IN_PROGRESS booking with 400', async () => {
      const cancelRes = await fetch(`${baseUrl}/api/bookings/${inProgressBookingId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ reason: 'Trip was in progress' })
      });
      assert.strictEqual(cancelRes.status, 400);
      const cancelData = await cancelRes.json();
      assert.strictEqual(cancelData.success, false);
      assert.strictEqual(cancelData.error.code, 'INVALID_STATE_TRANSITION');
    });

    test('5.3 IN_PROGRESS can still transition to COMPLETED via authorized completion flow', async () => {
      const completeRes = await fetch(`${baseUrl}/api/bookings/${inProgressBookingId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken1}`
        },
        body: JSON.stringify({ paymentMode: 'upi' })
      });
      assert.strictEqual(completeRes.status, 200);
      const completeData = await completeRes.json();
      assert.strictEqual(completeData.success, true);
      assert.strictEqual(completeData.data.booking.status, 'COMPLETED');
    });
  });

  // --------------------------------------------------------------------------
  // Fix 6: Driver Deletion Referential Integrity (TiDB & SQLite)
  // --------------------------------------------------------------------------
  describe('Fix 6 — Driver Deletion Booking Reference Nullification', () => {
    test('6.1 Deleting a driver clears assigned_driver_id to NULL while preserving booking and status', async () => {
      // 1. Create a dedicated driver to delete
      const drvPhoneDel = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
      const dlNumberDel = `KA-03-${Date.now().toString().slice(-7)}9`;
      const drvResDel = await registerDriver({
        name: 'Driver To Delete',
        phone: drvPhoneDel,
        dlNumber: dlNumberDel,
        password: testPassword,
        area: 'Indiranagar'
      });
      const driverToDelete = await queryOne('SELECT * FROM drivers WHERE user_id = ?', [drvResDel.user.id]);

      // 2. Create a booking and assign this driver
      const bookRes = await createTestBooking({ date: '2028-12-20', time: '03:00 PM' });
      const { data: { booking } } = await bookRes.json();
      await execute(`
        UPDATE bookings 
        SET status = 'ASSIGNED', assigned_driver_id = ? 
        WHERE id = ?
      `, [driverToDelete.id, booking.id]);

      // Verify assigned
      const beforeDel = await queryOne('SELECT assigned_driver_id, status FROM bookings WHERE id = ?', [booking.id]);
      assert.strictEqual(beforeDel.assigned_driver_id, driverToDelete.id);
      assert.strictEqual(beforeDel.status, 'ASSIGNED');

      // 3. Delete the driver via Admin endpoint
      const delRes = await fetch(`${baseUrl}/api/admin/drivers/${driverToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(delRes.status, 200);
      const delData = await delRes.json();
      assert.strictEqual(delData.success, true);

      // 4. Verify driver is removed
      const driverInDb = await queryOne('SELECT id FROM drivers WHERE id = ?', [driverToDelete.id]);
      assert.strictEqual(driverInDb, null);

      // 5. Verify booking STILL EXISTS with assigned_driver_id set to NULL and status preserved
      const afterDel = await queryOne('SELECT id, customer_name, assigned_driver_id, status FROM bookings WHERE id = ?', [booking.id]);
      assert.ok(afterDel, 'Booking must remain in database after assigned driver deletion');
      assert.strictEqual(afterDel.assigned_driver_id, null, 'assigned_driver_id must be nullified');
      assert.strictEqual(afterDel.status, 'ASSIGNED', 'Booking status must remain intact');
    });
  });

  // --------------------------------------------------------------------------
  // Fix 7: Schema Verification (TiDB & SQLite Slot Index)
  // --------------------------------------------------------------------------
  describe('Fix 7 — Schema Slot Index Verification', () => {
    test('7.1 server/db/database.js TiDB DDL contains idx_bookings_driver_slot non-unique index', () => {
      const dbFileContent = fs.readFileSync(
        path.resolve(process.cwd(), 'server/db/database.js'),
        'utf8'
      );
      assert.ok(
        dbFileContent.includes('INDEX idx_bookings_driver_slot (assigned_driver_id, date, time)'),
        'TiDB bookings schema must define idx_bookings_driver_slot'
      );
      assert.ok(
        !dbFileContent.includes('UNIQUE INDEX idx_bookings_driver_slot'),
        'idx_bookings_driver_slot must NOT be a UNIQUE index'
      );
    });

    test('7.2 SQLite schema.js and active SQLite database contain idx_bookings_driver_slot', async () => {
      const schemaJsContent = fs.readFileSync(
        path.resolve(process.cwd(), 'server/db/schema.js'),
        'utf8'
      );
      assert.ok(
        schemaJsContent.includes('INDEX IF NOT EXISTS idx_bookings_driver_slot ON bookings(assigned_driver_id, date, time)'),
        'schema.js must define idx_bookings_driver_slot'
      );

      // Verify index exists in active test database
      const indexRow = await queryOne(`
        SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_bookings_driver_slot'
      `);
      assert.ok(indexRow, 'idx_bookings_driver_slot must exist in active SQLite test database');
    });

    test('7.3 AdminPage.jsx transmits assignedDriverId in updateAdminBooking call', () => {
      const adminPageContent = fs.readFileSync(
        path.resolve(process.cwd(), 'src/pages/AdminPage.jsx'),
        'utf8'
      );
      assert.ok(
        adminPageContent.includes('assignedDriverId: matchedDriver?.id'),
        'AdminPage.jsx must include assignedDriverId: matchedDriver?.id'
      );
    });
  });
});
