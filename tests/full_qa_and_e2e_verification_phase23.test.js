import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { execute, queryOne, queryAll } from '../server/db/database.js';
import { createBooking, updateBookingStatus, cancelBooking, getUserBookings } from '../server/services/bookingService.js';
import { calculateAuthoritativeFare } from '../server/services/pricingService.js';
import { RoutingService } from '../server/services/routingService.js';
import { GeocodingService } from '../server/services/geocodingService.js';
import { getTodayIST } from '../server/middleware/validate.js';

describe('Antigravity Phase 23 — Full QA & End-to-End Verification Suite', () => {
  const ts = Date.now();
  const customerId = `USR-QA-CUST-${ts}`;
  const otherCustomerId = `USR-QA-OTHER-${ts}`;
  const driverUserId = `USR-QA-DRV-${ts}`;
  const driverId = `DRV-QA-${ts}`;
  const otherDriverUserId = `USR-QA-DRV2-${ts}`;
  const otherDriverId = `DRV-QA2-${ts}`;
  const adminId = `ADM-QA-${ts}`;
  const passwordHash = bcrypt.hashSync('Password123!', 10);

  let testBookingId = null;

  before(async () => {
    // Seed test users, drivers, and admin directly into database for isolated test execution

    // 1. Customer A
    await execute(`
      INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
      VALUES (?, ?, ?, ?, ?, 'customer', 'Indiranagar', 'Active')
    `, [customerId, 'Customer QA', `cust_qa_${ts}@test.com`, `98000${String(ts).slice(-5)}`, passwordHash]);

    // 2. Customer B
    await execute(`
      INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
      VALUES (?, ?, ?, ?, ?, 'customer', 'Koramangala', 'Active')
    `, [otherCustomerId, 'Other Customer QA', `other_qa_${ts}@test.com`, `98001${String(ts).slice(-5)}`, passwordHash]);

    // 3. Driver 1
    await execute(`
      INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
      VALUES (?, ?, ?, ?, ?, 'driver', 'Indiranagar', 'Active')
    `, [driverUserId, 'Driver One QA', `driver1_qa_${ts}@test.com`, `98002${String(ts).slice(-5)}`, passwordHash]);

    await execute(`
      INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, experience_years, specialization, rating, trips_completed, status)
      VALUES (?, ?, ?, ?, ?, 'Indiranagar', 6, 'Manual & Automatic Cars', 4.95, 10, 'Active')
    `, [driverId, driverUserId, 'Driver One QA', `98002${String(ts).slice(-5)}`, `KA01QA${String(ts).slice(-8)}`]);

    // 4. Driver 2
    await execute(`
      INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
      VALUES (?, ?, ?, ?, ?, 'driver', 'Whitefield', 'Active')
    `, [otherDriverUserId, 'Driver Two QA', `driver2_qa_${ts}@test.com`, `98003${String(ts).slice(-5)}`, passwordHash]);

    await execute(`
      INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, experience_years, specialization, rating, trips_completed, status)
      VALUES (?, ?, ?, ?, ?, 'Whitefield', 8, 'Luxury Automatics', 4.98, 25, 'Active')
    `, [otherDriverId, otherDriverUserId, 'Driver Two QA', `98003${String(ts).slice(-5)}`, `KA02QA${String(ts).slice(-8)}`]);

    // 5. Admin
    await execute(`
      INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
      VALUES (?, ?, ?, ?, ?, 'admin', 'Headquarters', 'Active')
    `, [adminId, 'Admin QA', `admin_qa_${ts}@bookdriveranna.com`, `98004${String(ts).slice(-5)}`, passwordHash]);
  });

  // =========================================================================
  // 1. COMPLETE CUSTOMER JOURNEY
  // =========================================================================
  describe('1. Complete Customer Journey (E2E)', () => {
    test('1.1 Customer creates a new booking with pickup and destination coordinates', async () => {
      const result = await createBooking({
        userId: customerId,
        customerName: 'Customer QA',
        customerPhone: `98000${String(ts).slice(-5)}`,
        customerEmail: `cust_qa_${ts}@test.com`,
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar, Bengaluru',
        dropLocation: 'Electronic City, Bengaluru',
        pickupLat: 12.9784,
        pickupLng: 77.6408,
        destLat: 12.8452,
        destLng: 77.6602,
        date: getTodayIST(),
        time: '14:30'
      });

      assert.ok(result && result.booking);
      assert.strictEqual(result.booking.status, 'PENDING');
      assert.strictEqual(result.booking.pickup_latitude, 12.9784);
      assert.strictEqual(result.booking.destination_latitude, 12.8452);
      testBookingId = result.booking.id;
    });

    test('1.2 Customer can query their own bookings list', async () => {
      const bookings = await getUserBookings(customerId);

      assert.ok(Array.isArray(bookings));
      const found = bookings.find(b => b.id === testBookingId);
      assert.ok(found, 'Created booking must appear in customer booking history');
      assert.strictEqual(found.status, 'PENDING');
    });

    test('1.3 Admin assigns Driver 1 to the booking', async () => {
      const updated = await updateBookingStatus({
        bookingId: testBookingId,
        newStatus: 'ASSIGNED',
        assignedDriverId: driverId,
        assignedDriverName: 'Driver One QA',
        assignedDriverPhone: `98002${String(ts).slice(-5)}`,
        requesterUser: { id: adminId, role: 'admin' }
      });

      assert.strictEqual(updated.status, 'ASSIGNED');
      assert.strictEqual(updated.assigned_driver_id, driverId);
    });

    test('1.4 Driver updates live GPS location', async () => {
      await execute(`
        UPDATE drivers 
        SET current_latitude = ?, current_longitude = ?, last_location_update = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [12.9750, 77.6350, driverId]);

      const driverRow = await queryOne('SELECT current_latitude, current_longitude FROM drivers WHERE id = ?', [driverId]);
      assert.strictEqual(driverRow.current_latitude, 12.9750);
      assert.strictEqual(driverRow.current_longitude, 77.6350);
    });

    test('1.5 Driver marks arrival (ASSIGNED -> ARRIVED)', async () => {
      const updated = await updateBookingStatus({
        bookingId: testBookingId,
        newStatus: 'ARRIVED',
        requesterUser: { id: driverUserId, role: 'driver', driverId }
      });

      assert.strictEqual(updated.status, 'ARRIVED');
    });

    test('1.6 Driver starts active trip (ARRIVED -> IN_PROGRESS)', async () => {
      const updated = await updateBookingStatus({
        bookingId: testBookingId,
        newStatus: 'IN_PROGRESS',
        requesterUser: { id: driverUserId, role: 'driver', driverId }
      });

      assert.strictEqual(updated.status, 'IN_PROGRESS');
    });

    test('1.7 Driver completes trip (IN_PROGRESS -> COMPLETED)', async () => {
      const updated = await updateBookingStatus({
        bookingId: testBookingId,
        newStatus: 'COMPLETED',
        requesterUser: { id: driverUserId, role: 'driver', driverId }
      });

      assert.strictEqual(updated.status, 'COMPLETED');
    });

    test('1.8 Completed booking is recorded in historical data with authoritative fare', async () => {
      const completed = await queryOne('SELECT * FROM bookings WHERE id = ?', [testBookingId]);
      assert.strictEqual(completed.status, 'COMPLETED');
      assert.ok(completed.calculated_fare > 0, 'Completed booking must have calculated fare');
    });
  });

  // =========================================================================
  // 2. COMPLETE DRIVER JOURNEY
  // =========================================================================
  describe('2. Complete Driver Journey', () => {
    let driverDutyId = null;

    test('2.1 Admin assigns a new duty to Driver 2', async () => {
      const result = await createBooking({
        userId: otherCustomerId,
        customerName: 'Other Customer QA',
        customerPhone: `98001${String(ts).slice(-5)}`,
        bookingCategory: 'driver',
        driverTripOption: 'round-trip',
        pickupArea: 'Whitefield, Bengaluru',
        dropLocation: 'MG Road, Bengaluru',
        pickupLat: 12.9698,
        pickupLng: 77.7499,
        destLat: 12.9756,
        destLng: 77.6066,
        date: getTodayIST(),
        time: '16:00'
      });

      driverDutyId = result.booking.id;

      await updateBookingStatus({
        bookingId: driverDutyId,
        newStatus: 'ASSIGNED',
        assignedDriverId: otherDriverId,
        assignedDriverName: 'Driver Two QA',
        assignedDriverPhone: `98003${String(ts).slice(-5)}`,
        requesterUser: { id: adminId, role: 'admin' }
      });

      const duty = await queryOne('SELECT * FROM bookings WHERE id = ?', [driverDutyId]);
      assert.strictEqual(duty.assigned_driver_id, otherDriverId);
    });

    test('2.2 Driver 2 queries assigned duties and sees the assigned booking', async () => {
      const duties = await queryAll(`
        SELECT * FROM bookings 
        WHERE assigned_driver_id = ? AND status IN ('CONFIRMED', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS')
      `, [otherDriverId]);

      assert.ok(Array.isArray(duties));
      const found = duties.find(d => d.id === driverDutyId);
      assert.ok(found, 'Assigned duty must be returned for Driver 2');
    });

    test('2.3 Driver 1 CANNOT see Driver 2 duty in duties list', async () => {
      const driver1Duties = await queryAll(`
        SELECT * FROM bookings 
        WHERE assigned_driver_id = ? AND status IN ('CONFIRMED', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS')
      `, [driverId]);

      const found = driver1Duties.find(d => d.id === driverDutyId);
      assert.strictEqual(found, undefined, 'Driver 1 must NOT see Driver 2 duties');
    });

    test('2.4 Driver 2 transitions duty through full lifecycle to COMPLETED', async () => {
      // ARRIVED
      await updateBookingStatus({
        bookingId: driverDutyId,
        newStatus: 'ARRIVED',
        requesterUser: { id: otherDriverUserId, role: 'driver', driverId: otherDriverId }
      });

      // IN_PROGRESS
      await updateBookingStatus({
        bookingId: driverDutyId,
        newStatus: 'IN_PROGRESS',
        requesterUser: { id: otherDriverUserId, role: 'driver', driverId: otherDriverId }
      });

      // COMPLETED
      await updateBookingStatus({
        bookingId: driverDutyId,
        newStatus: 'COMPLETED',
        requesterUser: { id: otherDriverUserId, role: 'driver', driverId: otherDriverId }
      });

      const row = await queryOne('SELECT status FROM bookings WHERE id = ?', [driverDutyId]);
      assert.strictEqual(row.status, 'COMPLETED');
    });

    test('2.5 Driver 2 history includes the completed duty', async () => {
      const history = await queryAll(`
        SELECT * FROM bookings 
        WHERE assigned_driver_id = ? AND status = 'COMPLETED'
        ORDER BY updated_at DESC
      `, [otherDriverId]);

      const found = history.find(h => h.id === driverDutyId);
      assert.ok(found, 'Completed booking must appear in Driver 2 history');
    });
  });

  // =========================================================================
  // 3. ADMIN OPERATIONS & DISPATCH
  // =========================================================================
  describe('3. Admin Operations & Dispatch', () => {
    let adminManageBookingId = null;

    test('3.1 Admin can retrieve aggregate platform metrics', async () => {
      const [totalB, pendingB, completedB, totalDrivers] = await Promise.all([
        queryOne('SELECT COUNT(*) as count FROM bookings'),
        queryOne("SELECT COUNT(*) as count FROM bookings WHERE status = 'PENDING'"),
        queryOne("SELECT COUNT(*) as count FROM bookings WHERE status = 'COMPLETED'"),
        queryOne('SELECT COUNT(*) as count FROM drivers')
      ]);

      assert.ok(Number(totalB?.count) >= 2);
      assert.ok(Number(completedB?.count) >= 2);
      assert.ok(Number(totalDrivers?.count) >= 2);
    });

    test('3.2 Admin creates and assigns a booking', async () => {
      const res = await createBooking({
        userId: customerId,
        customerName: 'Admin Flow Customer',
        customerPhone: `98000${String(ts).slice(-5)}`,
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'MG Road',
        dropLocation: 'Hebbal',
        date: getTodayIST(),
        time: '18:00'
      });

      adminManageBookingId = res.booking.id;

      const assigned = await updateBookingStatus({
        bookingId: adminManageBookingId,
        newStatus: 'ASSIGNED',
        assignedDriverId: driverId,
        assignedDriverName: 'Driver One QA',
        assignedDriverPhone: `98002${String(ts).slice(-5)}`,
        requesterUser: { id: adminId, role: 'admin' }
      });

      assert.strictEqual(assigned.assigned_driver_id, driverId);
    });

    test('3.3 Admin reassigns booking from Driver 1 to Driver 2', async () => {
      const reassigned = await updateBookingStatus({
        bookingId: adminManageBookingId,
        newStatus: 'ASSIGNED',
        assignedDriverId: otherDriverId,
        assignedDriverName: 'Driver Two QA',
        assignedDriverPhone: `98003${String(ts).slice(-5)}`,
        requesterUser: { id: adminId, role: 'admin' }
      });

      assert.strictEqual(reassigned.assigned_driver_id, otherDriverId);
      assert.strictEqual(reassigned.assigned_driver_name, 'Driver Two QA');
    });

    test('3.4 Admin unassigns driver (assigned_driver_id reverts to null, status reverts to CONFIRMED)', async () => {
      const unassigned = await updateBookingStatus({
        bookingId: adminManageBookingId,
        newStatus: 'CONFIRMED',
        assignedDriverId: null,
        assignedDriverName: null,
        assignedDriverPhone: null,
        requesterUser: { id: adminId, role: 'admin' }
      });

      assert.strictEqual(unassigned.assigned_driver_id, null);
      assert.strictEqual(unassigned.status, 'CONFIRMED');
    });

    test('3.5 Admin cancels the booking with cancellation reason', async () => {
      const res = await cancelBooking({
        bookingId: adminManageBookingId,
        reason: 'Admin test cancellation',
        requesterUser: { id: adminId, role: 'admin' }
      });

      assert.strictEqual(res.booking.status, 'CANCELLED');
      assert.strictEqual(res.booking.cancellation_reason, 'Admin test cancellation');
    });
  });

  // =========================================================================
  // 4. AUTHORIZATION MATRIX & ACCESS CONTROL
  // =========================================================================
  describe('4. Authorization Matrix & Access Control', () => {
    test('4.1 Customer A cannot update or cancel Customer B booking', async () => {
      const bkg = await createBooking({
        userId: customerId,
        customerName: 'Customer A',
        customerPhone: `98000${String(ts).slice(-5)}`,
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Airport',
        date: getTodayIST(),
        time: '12:00'
      });

      try {
        await cancelBooking({
          bookingId: bkg.booking.id,
          reason: 'Unauthorized cancel attempt',
          requesterUser: { id: otherCustomerId, role: 'customer' }
        });
        assert.fail('Should have rejected unauthorized customer update');
      } catch (err) {
        assert.ok(err.statusCode === 403 || err.code === 'FORBIDDEN');
      }
    });

    test('4.2 Driver A cannot update duty assigned to Driver B', async () => {
      const duty = await createBooking({
        userId: otherCustomerId,
        customerName: 'Driver B Customer',
        customerPhone: `98001${String(ts).slice(-5)}`,
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        date: getTodayIST(),
        time: '13:00'
      });

      await updateBookingStatus({
        bookingId: duty.booking.id,
        newStatus: 'ASSIGNED',
        assignedDriverId: otherDriverId,
        assignedDriverName: 'Driver Two QA',
        requesterUser: { id: adminId, role: 'admin' }
      });

      try {
        await updateBookingStatus({
          bookingId: duty.booking.id,
          newStatus: 'ARRIVED',
          requesterUser: { id: driverUserId, role: 'driver', driverId }
        });
        assert.fail('Driver A must NOT be able to modify Driver B duty');
      } catch (err) {
        assert.ok(err.statusCode === 403 || err.code === 'FORBIDDEN');
      }
    });

    test('4.3 Customer role cannot perform driver status transition (ARRIVED)', async () => {
      try {
        await updateBookingStatus({
          bookingId: testBookingId,
          newStatus: 'ARRIVED',
          requesterUser: { id: customerId, role: 'customer' }
        });
        assert.fail('Customer cannot mark duty as arrived');
      } catch (err) {
        assert.ok(err.statusCode === 403 || err.code === 'FORBIDDEN' || err.code === 'INVALID_STATE_TRANSITION');
      }
    });

    test('4.4 Driver cannot assign themselves to arbitrary unassigned booking', async () => {
      const unassigned = await queryOne("SELECT id FROM bookings WHERE assigned_driver_id IS NULL AND status = 'CONFIRMED' LIMIT 1");
      if (unassigned) {
        try {
          await updateBookingStatus({
            bookingId: unassigned.id,
            newStatus: 'ARRIVED',
            requesterUser: { id: driverUserId, role: 'driver', driverId }
          });
          assert.fail('Driver cannot self-dispatch without admin assignment');
        } catch (err) {
          assert.ok(err.statusCode === 403 || err.code === 'FORBIDDEN');
        }
      }
    });

    test('4.5 Inactive or suspended user cannot update booking status', async () => {
      const suspendedUserId = `USR-SUSP-${ts}`;
      await execute(`
        INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
        VALUES (?, ?, ?, ?, ?, 'customer', 'Indiranagar', 'Suspended')
      `, [suspendedUserId, 'Suspended User', `susp_${ts}@test.com`, `98999${String(ts).slice(-5)}`, passwordHash]);

      try {
        await cancelBooking({
          bookingId: testBookingId,
          reason: 'Suspended user attempt',
          requesterUser: { id: suspendedUserId, role: 'customer' }
        });
        assert.fail('Suspended user must be denied');
      } catch (err) {
        assert.ok(err.statusCode === 403 || err.code === 'FORBIDDEN' || err.code === 'ACCOUNT_DISABLED');
      } finally {
        await execute('DELETE FROM users WHERE id = ?', [suspendedUserId]);
      }
    });

    test('4.6 Unauthenticated requesterUser without role cannot perform driver updates', async () => {
      const unauthDuty = await queryOne("SELECT id FROM bookings WHERE status = 'CONFIRMED' LIMIT 1");
      if (unauthDuty) {
        try {
          await updateBookingStatus({
            bookingId: unauthDuty.id,
            newStatus: 'ARRIVED',
            requesterUser: { id: 'unknown-anon', role: 'anonymous' }
          });
          assert.fail('Anonymous user must be rejected');
        } catch (err) {
          assert.ok(err.statusCode === 403 || err.code === 'FORBIDDEN' || err.code === 'INVALID_STATE_TRANSITION');
        }
      }
    });
  });

  // =========================================================================
  // 5. LIFECYCLE & STATE MACHINE TRANSITION RULES
  // =========================================================================
  describe('5. Lifecycle & State Machine Transitions', () => {
    let lifecycleBookingId = null;

    before(async () => {
      const res = await createBooking({
        userId: customerId,
        customerName: 'Lifecycle Test',
        customerPhone: `98000${String(ts).slice(-5)}`,
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Koramangala',
        date: getTodayIST(),
        time: '19:00'
      });
      lifecycleBookingId = res.booking.id;
    });

    test('5.1 Valid transition: PENDING -> CONFIRMED', async () => {
      const b = await updateBookingStatus({
        bookingId: lifecycleBookingId,
        newStatus: 'CONFIRMED',
        requesterUser: { id: adminId, role: 'admin' }
      });
      assert.strictEqual(b.status, 'CONFIRMED');
    });

    test('5.2 Valid transition: CONFIRMED -> ASSIGNED', async () => {
      const b = await updateBookingStatus({
        bookingId: lifecycleBookingId,
        newStatus: 'ASSIGNED',
        assignedDriverId: driverId,
        assignedDriverName: 'Driver One QA',
        requesterUser: { id: adminId, role: 'admin' }
      });
      assert.strictEqual(b.status, 'ASSIGNED');
    });

    test('5.3 Valid transition: ASSIGNED -> ARRIVED', async () => {
      const b = await updateBookingStatus({
        bookingId: lifecycleBookingId,
        newStatus: 'ARRIVED',
        requesterUser: { id: driverUserId, role: 'driver', driverId }
      });
      assert.strictEqual(b.status, 'ARRIVED');
    });

    test('5.4 Valid transition: ARRIVED -> IN_PROGRESS', async () => {
      const b = await updateBookingStatus({
        bookingId: lifecycleBookingId,
        newStatus: 'IN_PROGRESS',
        requesterUser: { id: driverUserId, role: 'driver', driverId }
      });
      assert.strictEqual(b.status, 'IN_PROGRESS');
    });

    test('5.5 Invalid transition: IN_PROGRESS cannot be CANCELLED', async () => {
      try {
        await updateBookingStatus({
          bookingId: lifecycleBookingId,
          newStatus: 'CANCELLED',
          requesterUser: { id: customerId, role: 'customer' }
        });
        assert.fail('IN_PROGRESS trip cancellation must be rejected');
      } catch (err) {
        assert.ok(err.statusCode === 400 || err.code === 'INVALID_STATE_TRANSITION');
      }
    });

    test('5.6 Valid transition: IN_PROGRESS -> COMPLETED', async () => {
      const b = await updateBookingStatus({
        bookingId: lifecycleBookingId,
        newStatus: 'COMPLETED',
        requesterUser: { id: driverUserId, role: 'driver', driverId }
      });
      assert.strictEqual(b.status, 'COMPLETED');
    });

    test('5.7 Terminal state protection: COMPLETED booking cannot be modified or resurrected', async () => {
      try {
        await updateBookingStatus({
          bookingId: lifecycleBookingId,
          newStatus: 'PENDING',
          requesterUser: { id: adminId, role: 'admin' }
        });
        assert.fail('COMPLETED booking cannot be transitioned to PENDING');
      } catch (err) {
        assert.ok(err.statusCode === 400 || err.code === 'INVALID_STATE_TRANSITION');
      }
    });

    test('5.8 Arbitrary non-existent status string is rejected', async () => {
      try {
        await updateBookingStatus({
          bookingId: lifecycleBookingId,
          newStatus: 'SUPER_ACTIVE',
          requesterUser: { id: adminId, role: 'admin' }
        });
        assert.fail('Arbitrary status must be rejected');
      } catch (err) {
        assert.ok(err.statusCode === 400 || err.code === 'INVALID_STATE_TRANSITION' || err.code === 'INVALID_INPUT');
      }
    });

    test('5.9 Valid transition: CONFIRMED -> CANCELLED via cancelBooking', async () => {
      const cancelTestBooking = await createBooking({
        userId: customerId,
        customerName: 'Cancel Test 1',
        customerPhone: `98000${String(Date.now()).slice(-5)}`,
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Koramangala',
        date: getTodayIST(),
        time: '18:00'
      });
      const bId = cancelTestBooking.booking.id;
      const res = await cancelBooking({
        bookingId: bId,
        reason: 'Customer changed plans',
        requesterUser: { id: customerId, role: 'customer' }
      });
      assert.strictEqual(res.booking.status, 'CANCELLED');
      assert.strictEqual(res.booking.cancellation_reason, 'Customer changed plans');
    });

    test('5.10 Valid transition: ASSIGNED -> CANCELLED via cancelBooking with driver unassignment', async () => {
      const cancelAssigned = await createBooking({
        userId: customerId,
        customerName: 'Cancel Test 2',
        customerPhone: `98000${String(Date.now() + 1).slice(-5)}`,
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        date: getTodayIST(),
        time: '19:00'
      });
      const bId = cancelAssigned.booking.id;
      await updateBookingStatus({
        bookingId: bId,
        newStatus: 'ASSIGNED',
        assignedDriverId: driverId,
        assignedDriverName: 'Driver Ramesh',
        assignedDriverPhone: '9876543210',
        requesterUser: { id: adminId, role: 'admin' }
      });
      const res = await cancelBooking({
        bookingId: bId,
        reason: 'Emergency cancellation',
        requesterUser: { id: adminId, role: 'admin' }
      });
      assert.strictEqual(res.booking.status, 'CANCELLED');
    });
  });

  // =========================================================================
  // 6. ROUTING & CACHING INTEGRITY
  // =========================================================================
  describe('6. Routing & Caching Integrity', () => {
    test('6.1 Zero distance for identical coordinates short-circuits provider', async () => {
      let fetchCalled = false;
      const service = new RoutingService({
        fetchFn: async () => {
          fetchCalled = true;
          return { ok: true, json: async () => ({}) };
        }
      });

      const res = await service.getRoute({
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        destLat: 12.9716,
        destLng: 77.5946
      });

      assert.strictEqual(fetchCalled, false, 'Identical locations must NOT trigger outbound network calls');
      assert.strictEqual(res.distanceMeters, 0);
      assert.strictEqual(res.durationSeconds, 0);
    });

    test('6.2 Bounded in-memory route cache returns cached results without duplicate network calls', async () => {
      let callCount = 0;
      const mockRoute = {
        code: 'Ok',
        routes: [{
          distance: 12500,
          duration: 1800,
          geometry: { type: 'LineString', coordinates: [[77.6, 12.9], [77.7, 13.0]] }
        }]
      };

      const service = new RoutingService({
        fetchFn: async () => {
          callCount++;
          return { ok: true, json: async () => mockRoute };
        }
      });

      const coords = { pickupLat: 12.9, pickupLng: 77.6, destLat: 13.0, destLng: 77.7 };
      const res1 = await service.getRoute(coords);
      assert.strictEqual(callCount, 1);
      assert.strictEqual(res1.fromCache, false);

      const res2 = await service.getRoute(coords);
      assert.strictEqual(callCount, 1, 'Second request must hit cache');
      assert.strictEqual(res2.fromCache, true);
      assert.strictEqual(res2.distanceMeters, 12500);
    });

    test('6.3 Route coordinates validation rejects non-numeric or out-of-bounds coordinates', () => {
      const service = new RoutingService();
      assert.throws(() => service.validateCoordinates(95, 77), /between -90 and 90/);
      assert.throws(() => service.validateCoordinates(12, 185), /between -180 and 180/);
      assert.throws(() => service.validateCoordinates('not-a-number', 77), /valid numeric/);
    });
  });

  // =========================================================================
  // 7. LOCATION SEARCH & GEOCODING INTEGRITY
  // =========================================================================
  describe('7. Location Search & Geocoding Integrity', () => {
    test('7.1 GeocodingService normalizes query string for reliable cache hits', () => {
      const service = new GeocodingService();
      assert.strictEqual(service.normalizeQuery('  Indiranagar   100ft Rd  '), 'indiranagar 100ft rd');
    });

    test('7.2 GeocodingService rejects queries shorter than 2 characters', async () => {
      const service = new GeocodingService();
      await assert.rejects(
        async () => service.search('a'),
        /at least 2 characters long/
      );
    });

    test('7.3 GeocodingService rejects queries longer than 200 characters', async () => {
      const service = new GeocodingService();
      const longQuery = 'A'.repeat(205);
      await assert.rejects(
        async () => service.search(longQuery),
        /maximum allowed length/
      );
    });

    test('7.4 GeocodingService normalizes external Nominatim items strictly', () => {
      const service = new GeocodingService();
      const raw = [
        { place_id: 1, lat: '12.9716', lon: '77.5946', display_name: 'Bengaluru, Karnataka', type: 'city' },
        { place_id: 2, lat: 'NaN', lon: '77.5', display_name: 'Bad Lat' },
        { place_id: 3, lat: '12.5', lon: '200', display_name: 'Bad Lon' },
        { place_id: 4, lat: '12.5', lon: '77.5', display_name: '' } // Empty display name
      ];

      const normalized = service.normalizeResults(raw);
      assert.strictEqual(normalized.length, 1);
      assert.strictEqual(normalized[0].displayName, 'Bengaluru, Karnataka');
      assert.strictEqual(normalized[0].latitude, 12.9716);
      assert.strictEqual(normalized[0].longitude, 77.5946);
    });
  });

  // =========================================================================
  // 8. DATA SANITIZATION & SECURITY INVARIANTS
  // =========================================================================
  describe('8. Data Sanitization & Security Invariants', () => {
    test('8.1 Client-supplied status and calculatedFare in createBooking are ignored', async () => {
      const b = await createBooking({
        userId: customerId,
        customerName: 'Security Invariant Test',
        customerPhone: `98000${String(ts).slice(-5)}`,
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Airport',
        status: 'COMPLETED',       // Malicious injection attempt
        calculatedFare: 1,         // Malicious fare tamper attempt
        date: getTodayIST(),
        time: '20:00'
      });

      assert.strictEqual(b.booking.status, 'PENDING', 'Initial status must be PENDING regardless of client input');
      assert.ok(b.booking.calculated_fare > 1, 'Calculated fare must be derived authoritatively by backend');
    });

    test('8.2 Duplicate idempotency keys prevent duplicate booking creation', async () => {
      const idempotencyKey = `IDEMP-${crypto.randomBytes(8).toString('hex')}`;
      const payload = {
        userId: customerId,
        customerName: 'Idempotency Test',
        customerPhone: `98000${String(ts).slice(-5)}`,
        bookingCategory: 'driver',
        driverTripOption: 'one-way',
        pickupArea: 'Indiranagar',
        dropLocation: 'Whitefield',
        idempotencyKey,
        date: getTodayIST(),
        time: '21:00'
      };

      const res1 = await createBooking(payload);
      assert.ok(res1.booking);

      // Attempt second submission with same idempotency key
      const res2 = await createBooking(payload);
      assert.strictEqual(res2.booking.id, res1.booking.id, 'Duplicate idempotency submission must return original booking');
    });

    test('8.3 Audit log captures admin assignment and cancellation events', async () => {
      const logs = await queryAll(`
        SELECT * FROM audit_logs 
        WHERE resource_id = ?
      `, [testBookingId]);

      assert.ok(Array.isArray(logs));
      // At least status transition audit events were recorded
      assert.ok(logs.length >= 1, 'Audit log must record lifecycle updates');
    });

    test('8.4 Out-of-bounds coordinates reject with INVALID_COORDINATES or INVALID_INPUT', async () => {
      await assert.rejects(
        async () => createBooking({
          userId: customerId,
          customerName: 'Bad Coords Test',
          customerPhone: `98000${String(Date.now()).slice(-5)}`,
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          pickupLat: 95.0, // Invalid latitude (>90)
          pickupLng: 77.5,
          destLat: 12.9,
          destLng: 77.6,
          date: getTodayIST(),
          time: '20:00'
        }),
        (err) => err.statusCode === 400 || err.code === 'INVALID_COORDINATES' || err.code === 'INVALID_INPUT'
      );
    });

    test('8.5 Missing mandatory customer phone rejects with 400 INVALID_INPUT', async () => {
      await assert.rejects(
        async () => createBooking({
          userId: customerId,
          customerName: 'Missing Phone Test',
          customerPhone: '',
          bookingCategory: 'driver',
          driverTripOption: 'one-way',
          pickupArea: 'Indiranagar',
          dropLocation: 'Airport',
          date: getTodayIST(),
          time: '20:00'
        }),
        (err) => err.statusCode === 400 || err.code === 'INVALID_INPUT'
      );
    });
  });

  // =========================================================================
  // 9. MAP PERFORMANCE & COMPONENT MEMOIZATION
  // =========================================================================
  describe('9. Map Component Optimization & Contracts', () => {
    test('9.1 DriverLocationMarker exports memoized component and caches icon', () => {
      const code = fs.readFileSync(path.resolve('src/components/map/DriverLocationMarker.jsx'), 'utf8');
      assert.match(code, /React\.memo\(/, 'DriverLocationMarker must use React.memo');
      assert.match(code, /cachedDriverIcon/, 'DriverLocationMarker must cache icon singleton');
    });

    test('9.2 PickupMarker and DestinationMarker cache icons and export React.memo', () => {
      const pickupCode = fs.readFileSync(path.resolve('src/components/map/PickupMarker.jsx'), 'utf8');
      const destCode = fs.readFileSync(path.resolve('src/components/map/DestinationMarker.jsx'), 'utf8');

      assert.match(pickupCode, /React\.memo\(/);
      assert.match(pickupCode, /cachedPickupIcon/);
      assert.match(destCode, /React\.memo\(/);
      assert.match(destCode, /cachedDestinationIcon/);
    });

    test('9.3 RoutePolyline is memoized and checks path endpoints', () => {
      const code = fs.readFileSync(path.resolve('src/components/map/RoutePolyline.jsx'), 'utf8');
      assert.match(code, /React\.memo\(/);
      assert.match(code, /prev\.geometry\s*===\s*next\.geometry/);
    });
  });

  // =========================================================================
  // 10. REALTIME & NETWORK PERFORMANCE CONTRACTS
  // =========================================================================
  describe('10. Realtime & Network Performance Contracts', () => {
    test('10.1 useDriverRealtimeLocation dedupes identical coordinates to prevent state churn', () => {
      const code = fs.readFileSync(path.resolve('src/utils/useDriverRealtimeLocation.js'), 'utf8');
      assert.match(code, /prev\.latitude\s*===\s*msg\.latitude/);
      assert.match(code, /return\s+prev;/);
    });

    test('10.2 useDriverLocation stabilizes currentCoords on identical GPS ticks', () => {
      const code = fs.readFileSync(path.resolve('src/utils/useDriverLocation.js'), 'utf8');
      assert.match(code, /setCurrentCoords\(prev\s*=>\s*\{/);
      assert.match(code, /return\s+prev;/);
    });

    test('10.3 useUserBookingBadge throttles backend calls to prevent request storms', () => {
      const code = fs.readFileSync(path.resolve('src/utils/useUserBookingBadge.js'), 'utf8');
      assert.match(code, /lastBackendFetchRef/);
      assert.match(code, /20000/);
      assert.match(code, /30000/);
    });

    test('10.4 LocationSearch cancels pending requests on new input and unmount', () => {
      const code = fs.readFileSync(path.resolve('src/components/map/LocationSearch.jsx'), 'utf8');
      assert.match(code, /abortControllerRef\.current\.abort\(\)/);
      assert.match(code, /clearTimeout\(debounceTimerRef\.current\)/);
    });

    test('10.5 Production build configuration separates vendor chunks', () => {
      const viteConfig = fs.readFileSync(path.resolve('vite.config.js'), 'utf8');
      assert.match(viteConfig, /vendor-leaflet/);
      assert.match(viteConfig, /vendor-icons/);
    });
  });
});
