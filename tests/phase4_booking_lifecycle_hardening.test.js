import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { startTestServer } from './testHelper.js';
import { registerCustomer, registerDriver, registerAdmin } from '../server/services/authService.js';
import { createBooking, updateBookingStatus, cancelBooking, acceptDriverDuty } from '../server/services/bookingService.js';
import { queryOne, execute } from '../server/db/database.js';
import { ENV } from '../server/config/env.js';
import { getTodayIST } from '../server/middleware/validate.js';

describe('Phase 4 — Production Booking Lifecycle & State-Machine Hardening Suite', () => {
  let server, baseUrl;
  let adminToken, customerTokenA, customerTokenB, driverTokenA, driverTokenB;
  let customerUserA, customerUserB, driverUserA, driverUserB;
  let driverAId, driverBId;

  const testPassword = 'Phase4SecurePassword123!';

  before(async () => {
    const s = await startTestServer();
    server = s.server;
    baseUrl = s.baseUrl;

    // 1. Admin
    const adminEmail = `phase4_admin_${Date.now()}@bookdriveranna.com`;
    const adminPhone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const adminRes = await registerAdmin({
      name: 'Phase 4 Admin',
      email: adminEmail,
      phone: adminPhone,
      password: testPassword,
      secretKey: ENV.ADMIN_REGISTRATION_SECRET
    });
    adminToken = adminRes.token;

    // 2. Customers
    const custPhoneA = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const custResA = await registerCustomer({
      name: 'Alice Customer',
      email: `alice_${Date.now()}@test.com`,
      phone: custPhoneA,
      password: testPassword
    });
    customerUserA = custResA.user;
    customerTokenA = custResA.token;

    const custPhoneB = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const custResB = await registerCustomer({
      name: 'Bob Customer',
      email: `bob_${Date.now()}@test.com`,
      phone: custPhoneB,
      password: testPassword
    });
    customerUserB = custResB.user;
    customerTokenB = custResB.token;

    // 3. Drivers
    const drvPhoneA = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const dlNumberA = `KA-01-${Date.now().toString().slice(-7)}`;
    const drvResA = await registerDriver({
      name: 'Driver Alpha',
      phone: drvPhoneA,
      dlNumber: dlNumberA,
      password: testPassword,
      area: 'Indiranagar'
    });
    driverUserA = drvResA.user;
    driverTokenA = drvResA.token;
    const dRecA = await queryOne('SELECT id FROM drivers WHERE user_id = ?', [driverUserA.id]);
    driverAId = dRecA.id;
    await execute("UPDATE drivers SET status = 'Active' WHERE id = ?", [driverAId]);

    const drvPhoneB = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const dlNumberB = `KA-02-${(Date.now() + 1).toString().slice(-7)}`;
    const drvResB = await registerDriver({
      name: 'Driver Beta',
      phone: drvPhoneB,
      dlNumber: dlNumberB,
      password: testPassword,
      area: 'Koramangala'
    });
    driverUserB = drvResB.user;
    driverTokenB = drvResB.token;
    const dRecB = await queryOne('SELECT id FROM drivers WHERE user_id = ?', [driverUserB.id]);
    driverBId = dRecB.id;
    await execute("UPDATE drivers SET status = 'Active' WHERE id = ?", [driverBId]);
  });

  after(async () => {
    if (server) {
      await new Promise((res) => server.close(res));
    }
  });

  // Helper to create test booking
  async function createTestBookingFor(user, dateOffsetDays = 1, extra = {}) {
    const targetDate = new Date(Date.now() + dateOffsetDays * 86400000).toISOString().split('T')[0];
    const res = await createBooking({
      userId: user?.id || null,
      customerName: user?.name || 'Guest User',
      customerPhone: user?.phone || '+91 9876543210',
      bookingCategory: 'driver',
      driverTripOption: 'one-way',
      pickupArea: 'Indiranagar, Bengaluru',
      dropLocation: 'Whitefield, Bengaluru',
      date: targetDate,
      time: '10:00 AM',
      paymentMode: 'cash',
      ...extra
    });
    return res.booking;
  }

  // =========================================================================
  // 1. STATE MACHINE TRANSITIONS & INVALID JUMPS (OBJECTIVE 1 & 2)
  // =========================================================================
  describe('1. State Machine Transitions & Invalid Jumps', () => {
    test('1.1 PENDING cannot jump directly to IN_PROGRESS without driver assignment', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await assert.rejects(
        async () => {
          await updateBookingStatus({
            bookingId: bkg.id,
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
    });

    test('1.2 PENDING cannot jump directly to COMPLETED', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await assert.rejects(
        async () => {
          await updateBookingStatus({
            bookingId: bkg.id,
            newStatus: 'COMPLETED',
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

    test('1.3 CONFIRMED cannot jump directly to ARRIVED without driver assignment', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE bookings SET status = 'CONFIRMED' WHERE id = ?", [bkg.id]);

      await assert.rejects(
        async () => {
          await updateBookingStatus({
            bookingId: bkg.id,
            newStatus: 'ARRIVED',
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

    test('1.4 Normal progressive lifecycle succeeds: PENDING -> CONFIRMED -> ASSIGNED -> ARRIVED -> IN_PROGRESS -> COMPLETED', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      assert.strictEqual(bkg.status, 'PENDING');

      const s1 = await updateBookingStatus({
        bookingId: bkg.id,
        newStatus: 'CONFIRMED',
        requesterUser: { id: 'admin-1', role: 'admin' }
      });
      assert.strictEqual(s1.status, 'CONFIRMED');

      const s2 = await updateBookingStatus({
        bookingId: bkg.id,
        newStatus: 'ASSIGNED',
        assignedDriverId: driverAId,
        assignedDriverName: 'Driver Alpha',
        requesterUser: { id: 'admin-1', role: 'admin' }
      });
      assert.strictEqual(s2.status, 'ASSIGNED');

      const s3 = await updateBookingStatus({
        bookingId: bkg.id,
        newStatus: 'ARRIVED',
        requesterUser: { id: driverUserA.id, role: 'driver', driverId: driverAId }
      });
      assert.strictEqual(s3.status, 'ARRIVED');

      const s4 = await updateBookingStatus({
        bookingId: bkg.id,
        newStatus: 'IN_PROGRESS',
        requesterUser: { id: driverUserA.id, role: 'driver', driverId: driverAId }
      });
      assert.strictEqual(s4.status, 'IN_PROGRESS');

      const s5 = await updateBookingStatus({
        bookingId: bkg.id,
        newStatus: 'COMPLETED',
        requesterUser: { id: driverUserA.id, role: 'driver', driverId: driverAId }
      });
      assert.strictEqual(s5.status, 'COMPLETED');
    });
  });

  // =========================================================================
  // 2. TERMINAL STATE PROTECTION (OBJECTIVE 10)
  // =========================================================================
  describe('2. Terminal State Protection', () => {
    test('2.1 COMPLETED booking cannot transition to IN_PROGRESS, ASSIGNED, or CANCELLED', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE bookings SET status = 'COMPLETED' WHERE id = ?", [bkg.id]);

      const invalidTargets = ['IN_PROGRESS', 'ASSIGNED', 'CANCELLED', 'CONFIRMED', 'PENDING'];
      for (const target of invalidTargets) {
        await assert.rejects(
          async () => {
            await updateBookingStatus({
              bookingId: bkg.id,
              newStatus: target,
              requesterUser: { id: 'admin-1', role: 'admin' }
            });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 400);
            assert.strictEqual(err.code, 'INVALID_STATE_TRANSITION');
            return true;
          }
        );
      }
    });

    test('2.2 CANCELLED booking cannot be resurrected or transitioned to CONFIRMED or COMPLETED', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE bookings SET status = 'CANCELLED' WHERE id = ?", [bkg.id]);

      const invalidTargets = ['CONFIRMED', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'];
      for (const target of invalidTargets) {
        await assert.rejects(
          async () => {
            await updateBookingStatus({
              bookingId: bkg.id,
              newStatus: target,
              requesterUser: { id: 'admin-1', role: 'admin' }
            });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 400);
            assert.strictEqual(err.code, 'INVALID_STATE_TRANSITION');
            return true;
          }
        );
      }
    });
  });

  // =========================================================================
  // 3. CUSTOMER IDOR & CROSS-USER ISOLATION (OBJECTIVE 4 & 16)
  // =========================================================================
  describe('3. Customer IDOR & Cross-User Isolation', () => {
    test('3.1 Customer A cannot view Customer B booking via GET /api/bookings/:id', async () => {
      const bkgB = await createTestBookingFor(customerUserB);

      const res = await fetch(`${baseUrl}/api/bookings/${bkgB.id}`, {
        headers: { 'Authorization': `Bearer ${customerTokenA}` }
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('3.2 Customer A can view own booking via GET /api/bookings/:id', async () => {
      const bkgA = await createTestBookingFor(customerUserA);

      const res = await fetch(`${baseUrl}/api/bookings/${bkgA.id}`, {
        headers: { 'Authorization': `Bearer ${customerTokenA}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.booking.id, bkgA.id);
    });

    test('3.3 Customer A cannot cancel Customer B booking via POST /api/bookings/:id/cancel', async () => {
      const bkgB = await createTestBookingFor(customerUserB);

      const res = await fetch(`${baseUrl}/api/bookings/${bkgB.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customerTokenA}`
        },
        body: JSON.stringify({ reason: 'Malicious cancel' })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('3.4 Unauthenticated request to GET /api/bookings/:id returns 401', async () => {
      const bkg = await createTestBookingFor(customerUserA);

      const res = await fetch(`${baseUrl}/api/bookings/${bkg.id}`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'UNAUTHORIZED');
    });
  });

  // =========================================================================
  // 4. DRIVER ISOLATION & LIFECYCLE MUTATION (OBJECTIVE 8, 9 & 17)
  // =========================================================================
  describe('4. Driver Isolation & Lifecycle Mutation', () => {
    test('4.1 Driver A cannot modify Driver B assigned booking via PATCH /api/drivers/duties/:id/status', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE bookings SET status = 'ASSIGNED', assigned_driver_id = ? WHERE id = ?", [driverBId, bkg.id]);

      const res = await fetch(`${baseUrl}/api/drivers/duties/${bkg.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverTokenA}`
        },
        body: JSON.stringify({ status: 'ARRIVED' })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('4.2 Driver A cannot complete Driver B assigned booking via POST /api/bookings/:id/complete', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE bookings SET status = 'IN_PROGRESS', assigned_driver_id = ? WHERE id = ?", [driverBId, bkg.id]);

      const res = await fetch(`${baseUrl}/api/bookings/${bkg.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverTokenA}`
        },
        body: JSON.stringify({ paymentMode: 'cash' })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('4.3 Driver cannot jump directly from ASSIGNED to COMPLETED', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE bookings SET status = 'ASSIGNED', assigned_driver_id = ? WHERE id = ?", [driverAId, bkg.id]);

      const res = await fetch(`${baseUrl}/api/bookings/${bkg.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverTokenA}`
        },
        body: JSON.stringify({ paymentMode: 'cash' })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_STATE_TRANSITION');
    });

    test('4.4 Driver cannot cancel a booking via PATCH /api/drivers/duties/:id/status', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE bookings SET status = 'ASSIGNED', assigned_driver_id = ? WHERE id = ?", [driverAId, bkg.id]);

      const res = await fetch(`${baseUrl}/api/drivers/duties/${bkg.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverTokenA}`
        },
        body: JSON.stringify({ status: 'CANCELLED' })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_STATE_TRANSITION');
    });

    test('4.5 Inactive driver cannot update duty status', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE bookings SET status = 'ASSIGNED', assigned_driver_id = ? WHERE id = ?", [driverAId, bkg.id]);
      await execute("UPDATE drivers SET status = 'Inactive' WHERE id = ?", [driverAId]);

      try {
        const res = await fetch(`${baseUrl}/api/drivers/duties/${bkg.id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${driverTokenA}`
          },
          body: JSON.stringify({ status: 'ARRIVED' })
        });
        assert.strictEqual(res.status, 403);
        const data = await res.json();
        assert.strictEqual(data.error.code, 'DRIVER_INACTIVE');
      } finally {
        await execute("UPDATE drivers SET status = 'Active' WHERE id = ?", [driverAId]);
      }
    });
  });

  // =========================================================================
  // 5. DRIVER ASSIGNMENT INTEGRITY & RACE CONDITIONS (OBJECTIVE 5 & 13)
  // =========================================================================
  describe('5. Driver Assignment Integrity & Race Conditions', () => {
    test('5.1 Non-existent driver assignment is rejected by admin with 400 INVALID_DRIVER', async () => {
      const bkg = await createTestBookingFor(customerUserA);

      const res = await fetch(`${baseUrl}/api/admin/bookings/${bkg.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ assignedDriverId: 'non-existent-drv-uuid' })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_DRIVER');
    });

    test('5.2 Driver duty claim race: second claim attempt receives 409 DUTY_ALREADY_CLAIMED', async () => {
      const bkg = await createTestBookingFor(customerUserA, 3);
      await execute("UPDATE bookings SET status = 'CONFIRMED', assigned_driver_id = NULL WHERE id = ?", [bkg.id]);

      // Driver A claims successfully
      const resA = await acceptDriverDuty({
        bookingId: bkg.id,
        requesterUser: { id: driverUserA.id, role: 'driver' }
      });
      assert.strictEqual(resA.status, 'ASSIGNED');
      assert.strictEqual(resA.assigned_driver_id, driverAId);

      // Driver B tries to claim the same already assigned duty
      await assert.rejects(
        async () => {
          await acceptDriverDuty({
            bookingId: bkg.id,
            requesterUser: { id: driverUserB.id, role: 'driver' }
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 409);
          assert.strictEqual(err.code, 'DUTY_ALREADY_CLAIMED');
          return true;
        }
      );
    });

    test('5.3 Driver cannot accept overlapping duty in same date/time slot (409 SLOT_UNAVAILABLE)', async () => {
      const targetDate = new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0];
      const targetTime = '03:00 PM';

      // First booking assigned to Driver A
      const b1 = await createTestBookingFor(customerUserA, 4, { time: targetTime });
      await execute("UPDATE bookings SET status = 'ASSIGNED', assigned_driver_id = ? WHERE id = ?", [driverAId, b1.id]);

      // Second open booking in same time slot
      const b2 = await createTestBookingFor(customerUserB, 4, { time: targetTime });
      await execute("UPDATE bookings SET status = 'CONFIRMED', assigned_driver_id = NULL WHERE id = ?", [b2.id]);

      // Driver A attempts to claim second booking
      await assert.rejects(
        async () => {
          await acceptDriverDuty({
            bookingId: b2.id,
            requesterUser: { id: driverUserA.id, role: 'driver' }
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 409);
          assert.strictEqual(err.code, 'SLOT_UNAVAILABLE');
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 6. IDEMPOTENCY & DUPLICATE BOOKING PROTECTION (OBJECTIVE 6)
  // =========================================================================
  describe('6. Idempotency & Duplicate Booking Protection', () => {
    test('6.1 Duplicate booking with same idempotency-key returns existing booking with 200 isDuplicate', async () => {
      const idemKey = `IDEM-TEST-${Date.now()}`;
      const payload = {
        customerName: 'Alice Idempotent',
        customerPhone: '+91 9876543210',
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: '11:00 AM',
        paymentMode: 'cash'
      };

      const res1 = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customerTokenA}`,
          'Idempotency-Key': idemKey
        },
        body: JSON.stringify(payload)
      });
      assert.strictEqual(res1.status, 201);
      const data1 = await res1.json();
      assert.strictEqual(data1.data.isDuplicate, false);
      const originalId = data1.data.booking.id;

      // Repeat request
      const res2 = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customerTokenA}`,
          'Idempotency-Key': idemKey
        },
        body: JSON.stringify(payload)
      });
      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();
      assert.strictEqual(data2.data.isDuplicate, true);
      assert.strictEqual(data2.data.booking.id, originalId);
    });
  });

  // =========================================================================
  // 7. CANCELLATION & COMPLETION HARDENING (OBJECTIVE 7 & 8)
  // =========================================================================
  describe('7. Cancellation & Completion Hardening', () => {
    test('7.1 Trip in IN_PROGRESS status cannot be cancelled', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE bookings SET status = 'IN_PROGRESS' WHERE id = ?", [bkg.id]);

      const res = await fetch(`${baseUrl}/api/bookings/${bkg.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customerTokenA}`
        },
        body: JSON.stringify({ reason: 'Cancel in progress trip' })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'INVALID_STATE_TRANSITION');
    });

    test('7.2 Repeat cancellation is idempotent and does not corrupt state', async () => {
      const bkg = await createTestBookingFor(customerUserA);

      const cancel1 = await cancelBooking({
        bookingId: bkg.id,
        requesterUser: customerUserA
      });
      assert.strictEqual(cancel1.booking.status, 'CANCELLED');
      assert.strictEqual(cancel1.alreadyCancelled, false);

      const cancel2 = await cancelBooking({
        bookingId: bkg.id,
        requesterUser: customerUserA
      });
      assert.strictEqual(cancel2.booking.status, 'CANCELLED');
      assert.strictEqual(cancel2.alreadyCancelled, true);
    });

    test('7.3 Customer cannot complete booking directly (returns 403)', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE bookings SET status = 'IN_PROGRESS' WHERE id = ?", [bkg.id]);

      const res = await fetch(`${baseUrl}/api/bookings/${bkg.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customerTokenA}`
        },
        body: JSON.stringify({ paymentMode: 'cash' })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('7.4 Admin can settle completed duty directly from CONFIRMED or ASSIGNED', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE bookings SET status = 'CONFIRMED' WHERE id = ?", [bkg.id]);

      const res = await fetch(`${baseUrl}/api/bookings/${bkg.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ paymentMode: 'cash' })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.booking.status, 'COMPLETED');
    });
  });

  // =========================================================================
  // 8. DESTRUCTIVE ENDPOINTS HARDENING (OBJECTIVE 19)
  // =========================================================================
  describe('8. Destructive Endpoints Hardening', () => {
    test('8.1 Admin cannot delete an active IN_PROGRESS trip (400 ACTIVE_TRIP_CANNOT_BE_DELETED)', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE bookings SET status = 'IN_PROGRESS' WHERE id = ?", [bkg.id]);

      const res = await fetch(`${baseUrl}/api/admin/bookings/${bkg.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'ACTIVE_TRIP_CANNOT_BE_DELETED');

      // Verify booking was NOT deleted
      const check = await queryOne('SELECT id FROM bookings WHERE id = ?', [bkg.id]);
      assert.ok(check, 'Active trip record must remain intact');
    });

    test('8.2 Admin cannot delete an ARRIVED trip (400 ACTIVE_TRIP_CANNOT_BE_DELETED)', async () => {
      const bkg = await createTestBookingFor(customerUserA);
      await execute("UPDATE bookings SET status = 'ARRIVED' WHERE id = ?", [bkg.id]);

      const res = await fetch(`${baseUrl}/api/admin/bookings/${bkg.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'ACTIVE_TRIP_CANNOT_BE_DELETED');
    });

    test('8.3 Customer or driver cannot access admin DELETE endpoint (returns 403)', async () => {
      const bkg = await createTestBookingFor(customerUserA);

      const resCust = await fetch(`${baseUrl}/api/admin/bookings/${bkg.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${customerTokenA}` }
      });
      assert.strictEqual(resCust.status, 403);

      const resDrv = await fetch(`${baseUrl}/api/admin/bookings/${bkg.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${driverTokenA}` }
      });
      assert.strictEqual(resDrv.status, 403);
    });
  });

  // =========================================================================
  // 9. DATA INTEGRITY & FARE SNAPSHOT PRESERVATION (OBJECTIVE 11 & 12)
  // =========================================================================
  describe('9. Data Integrity & Fare Snapshot Preservation', () => {
    test('9.1 Status updates preserve authoritative pricing snapshot and coordinates', async () => {
      const bkg = await createTestBookingFor(customerUserA, 2, {
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        destLat: 12.9352,
        destLng: 77.6245
      });

      const initialFare = bkg.calculated_fare;
      assert.ok(Number(initialFare) > 0);

      // Transition through states
      await updateBookingStatus({
        bookingId: bkg.id,
        newStatus: 'CONFIRMED',
        requesterUser: { id: 'admin-1', role: 'admin' }
      });

      await updateBookingStatus({
        bookingId: bkg.id,
        newStatus: 'ASSIGNED',
        assignedDriverId: driverAId,
        assignedDriverName: 'Driver Alpha',
        requesterUser: { id: 'admin-1', role: 'admin' }
      });

      const updated = await queryOne('SELECT * FROM bookings WHERE id = ?', [bkg.id]);
      assert.strictEqual(updated.calculated_fare, initialFare, 'Fare snapshot must not be mutated');
      assert.strictEqual(Number(updated.pickup_latitude), 12.9716, 'Pickup latitude must remain intact');
      assert.strictEqual(Number(updated.pickup_longitude), 77.5946, 'Pickup longitude must remain intact');
    });
  });
});
