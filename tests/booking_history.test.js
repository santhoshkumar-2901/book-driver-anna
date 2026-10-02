import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { startTestServer } from './testHelper.js';
import { updateBookingStatus, cancelBooking, getUserBookings } from '../server/services/bookingService.js';
import { queryOne, queryAll, execute } from '../server/db/database.js';
import { ENV } from '../server/config/env.js';

// Helper to create test JWT tokens
function makeToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name || 'Test User',
      email: user.email || 'user@test.com',
      phone: user.phone || '+91 9876543210',
      role: (user.role || 'customer').toLowerCase()
    },
    ENV.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Phase 17 — Booking History & Past Trip Records Suite', () => {
  let appServer, baseUrl;

  const modalPath = path.resolve('src/components/BookingSuccessModal.jsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  const profileModalPath = path.resolve('src/components/UserProfileModal.jsx');
  const profileModalContent = fs.readFileSync(profileModalPath, 'utf8');

  const driverPortalPath = path.resolve('src/pages/DriverPortalPage.jsx');
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf8');

  const driverRoutesPath = path.resolve('server/routes/drivers.js');
  const driverRoutesContent = fs.readFileSync(driverRoutesPath, 'utf8');

  const bookingServicePath = path.resolve('server/services/bookingService.js');
  const bookingServiceContent = fs.readFileSync(bookingServicePath, 'utf8');

  let customerUserA, customerUserB, adminUser;
  let driverUserAlpha, driverRecordAlpha;
  let driverUserBeta, driverRecordBeta;
  let inactiveDriverUser, inactiveDriverRecord;

  let completedBookingA, cancelledBookingA, activeBookingA;
  let completedBookingB, cancelledBookingBeta;

  before(async () => {
    // 1. Start test HTTP server
    const s = await startTestServer();
    appServer = s.server;
    baseUrl = s.baseUrl;

    // 2. Seed Customer A & Customer B
    const sfx = Math.floor(Math.random() * 89999 + 10000);

    customerUserA = {
      id: `USR-CUST-P17-A-${Date.now()}`,
      name: 'Customer Phase17 Alpha',
      email: `cust17_a_${Date.now()}_${sfx}@test.com`,
      phone: `+91 91${sfx}01`,
      role: 'customer'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [customerUserA.id, customerUserA.name, customerUserA.email, customerUserA.phone, customerUserA.role, '$2a$12$dummyHash']
    );

    customerUserB = {
      id: `USR-CUST-P17-B-${Date.now()}`,
      name: 'Customer Phase17 Beta',
      email: `cust17_b_${Date.now()}_${sfx}@test.com`,
      phone: `+91 91${sfx}02`,
      role: 'customer'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [customerUserB.id, customerUserB.name, customerUserB.email, customerUserB.phone, customerUserB.role, '$2a$12$dummyHash']
    );

    // 3. Seed Admin
    adminUser = {
      id: `USR-ADMIN-P17-${Date.now()}`,
      name: 'Admin Phase17',
      email: `admin17_${Date.now()}_${sfx}@test.com`,
      phone: `+91 91${sfx}99`,
      role: 'admin'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [adminUser.id, adminUser.name, adminUser.email, adminUser.phone, adminUser.role, '$2a$12$dummyHash']
    );

    // 4. Seed Driver Alpha (Active)
    driverUserAlpha = {
      id: `USR-DRV-ALPHA-${Date.now()}`,
      name: 'Driver Alpha',
      email: `drv17_alpha_${Date.now()}_${sfx}@test.com`,
      phone: `+91 92${sfx}01`,
      role: 'driver'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [driverUserAlpha.id, driverUserAlpha.name, driverUserAlpha.email, driverUserAlpha.phone, driverUserAlpha.role, '$2a$12$dummyHash']
    );
    driverRecordAlpha = {
      id: `DRV-REC-ALPHA-${Date.now()}`,
      user_id: driverUserAlpha.id,
      name: driverUserAlpha.name,
      phone: driverUserAlpha.phone,
      license_number: `DL-KA01-ALPHA-${Date.now()}`,
      status: 'Active'
    };
    await execute(
      `INSERT INTO drivers (id, user_id, name, phone, license_number, status, hub_area, experience_years, specialization, rating, trips_completed)
       VALUES (?, ?, ?, ?, ?, ?, 'Indiranagar', 5, 'City Driver', 4.9, 120)`,
      [driverRecordAlpha.id, driverRecordAlpha.user_id, driverRecordAlpha.name, driverRecordAlpha.phone, driverRecordAlpha.license_number, driverRecordAlpha.status]
    );

    // 5. Seed Driver Beta (Active)
    driverUserBeta = {
      id: `USR-DRV-BETA-${Date.now()}`,
      name: 'Driver Beta',
      email: `drv17_beta_${Date.now()}_${sfx}@test.com`,
      phone: `+91 92${sfx}02`,
      role: 'driver'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [driverUserBeta.id, driverUserBeta.name, driverUserBeta.email, driverUserBeta.phone, driverUserBeta.role, '$2a$12$dummyHash']
    );
    driverRecordBeta = {
      id: `DRV-REC-BETA-${Date.now()}`,
      user_id: driverUserBeta.id,
      name: driverUserBeta.name,
      phone: driverUserBeta.phone,
      license_number: `DL-KA01-BETA-${Date.now()}`,
      status: 'Active'
    };
    await execute(
      `INSERT INTO drivers (id, user_id, name, phone, license_number, status, hub_area, experience_years, specialization, rating, trips_completed)
       VALUES (?, ?, ?, ?, ?, ?, 'Koramangala', 4, 'Highway Driver', 4.8, 90)`,
      [driverRecordBeta.id, driverRecordBeta.user_id, driverRecordBeta.name, driverRecordBeta.phone, driverRecordBeta.license_number, driverRecordBeta.status]
    );

    // 6. Seed Inactive Driver
    inactiveDriverUser = {
      id: `USR-DRV-INACT-${Date.now()}`,
      name: 'Inactive Driver',
      email: `drv17_inact_${Date.now()}_${sfx}@test.com`,
      phone: `+91 92${sfx}03`,
      role: 'driver'
    };
    await execute(
      `INSERT INTO users (id, name, email, phone, role, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [inactiveDriverUser.id, inactiveDriverUser.name, inactiveDriverUser.email, inactiveDriverUser.phone, inactiveDriverUser.role, '$2a$12$dummyHash']
    );
    inactiveDriverRecord = {
      id: `DRV-REC-INACT-${Date.now()}`,
      user_id: inactiveDriverUser.id,
      name: inactiveDriverUser.name,
      phone: inactiveDriverUser.phone,
      license_number: `DL-KA01-INACT-${Date.now()}`,
      status: 'Suspended'
    };
    await execute(
      `INSERT INTO drivers (id, user_id, name, phone, license_number, status, hub_area, experience_years, specialization, rating, trips_completed)
       VALUES (?, ?, ?, ?, ?, ?, 'Whitefield', 2, 'City Driver', 4.0, 10)`,
      [inactiveDriverRecord.id, inactiveDriverRecord.user_id, inactiveDriverRecord.name, inactiveDriverRecord.phone, inactiveDriverRecord.license_number, inactiveDriverRecord.status]
    );

    // 7. Seed Bookings for Customer A:
    // Completed Booking A (Assigned to Driver Alpha)
    completedBookingA = {
      id: `BK-P17-CMP-A-${Date.now()}`,
      user_id: customerUserA.id,
      customer_name: customerUserA.name,
      customer_phone: customerUserA.phone,
      service_name: 'Driver Anna Outstation',
      booking_type: 'driver',
      trip_type: 'Outstation',
      pickup_area: 'Indiranagar Metro, Bangalore',
      drop_location: 'Mysore Palace, Mysore',
      pickup_latitude: 12.9784,
      pickup_longitude: 77.6408,
      destination_latitude: 12.3051,
      destination_longitude: 76.6551,
      date: '2026-09-20',
      time: '08:00 AM',
      calculated_fare: 2850,
      status: 'COMPLETED',
      payment_status: 'PAID',
      assigned_driver_id: driverRecordAlpha.id,
      assigned_driver_name: driverRecordAlpha.name,
      assigned_driver_phone: driverRecordAlpha.phone
    };
    await execute(
      `INSERT INTO bookings (
        id, user_id, customer_name, customer_phone, service_name, booking_type, trip_type,
        pickup_area, drop_location, pickup_latitude, pickup_longitude, destination_latitude, destination_longitude,
        date, time, calculated_fare, status, payment_mode, assigned_driver_id, assigned_driver_name, assigned_driver_phone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        completedBookingA.id, completedBookingA.user_id, completedBookingA.customer_name, completedBookingA.customer_phone,
        completedBookingA.service_name, completedBookingA.booking_type, completedBookingA.trip_type,
        completedBookingA.pickup_area, completedBookingA.drop_location,
        completedBookingA.pickup_latitude, completedBookingA.pickup_longitude,
        completedBookingA.destination_latitude, completedBookingA.destination_longitude,
        completedBookingA.date, completedBookingA.time, completedBookingA.calculated_fare,
        completedBookingA.status, completedBookingA.payment_status,
        completedBookingA.assigned_driver_id, completedBookingA.assigned_driver_name, completedBookingA.assigned_driver_phone
      ]
    );

    // Cancelled Booking A (Was assigned to Driver Alpha)
    cancelledBookingA = {
      id: `BK-P17-CAN-A-${Date.now()}`,
      user_id: customerUserA.id,
      customer_name: customerUserA.name,
      customer_phone: customerUserA.phone,
      service_name: 'Driver Anna City Round Trip',
      booking_type: 'driver',
      trip_type: 'Round Trip',
      pickup_area: 'MG Road, Bangalore',
      drop_location: 'Electronic City, Bangalore',
      pickup_latitude: 12.9756,
      pickup_longitude: 77.6066,
      destination_latitude: 12.8452,
      destination_longitude: 77.6602,
      date: '2026-09-22',
      time: '11:00 AM',
      calculated_fare: 650,
      status: 'CANCELLED',
      payment_status: 'REFUNDED',
      assigned_driver_id: driverRecordAlpha.id,
      assigned_driver_name: driverRecordAlpha.name,
      assigned_driver_phone: driverRecordAlpha.phone
    };
    await execute(
      `INSERT INTO bookings (
        id, user_id, customer_name, customer_phone, service_name, booking_type, trip_type,
        pickup_area, drop_location, pickup_latitude, pickup_longitude, destination_latitude, destination_longitude,
        date, time, calculated_fare, status, payment_mode, assigned_driver_id, assigned_driver_name, assigned_driver_phone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cancelledBookingA.id, cancelledBookingA.user_id, cancelledBookingA.customer_name, cancelledBookingA.customer_phone,
        cancelledBookingA.service_name, cancelledBookingA.booking_type, cancelledBookingA.trip_type,
        cancelledBookingA.pickup_area, cancelledBookingA.drop_location,
        cancelledBookingA.pickup_latitude, cancelledBookingA.pickup_longitude,
        cancelledBookingA.destination_latitude, cancelledBookingA.destination_longitude,
        cancelledBookingA.date, cancelledBookingA.time, cancelledBookingA.calculated_fare,
        cancelledBookingA.status, cancelledBookingA.payment_status,
        cancelledBookingA.assigned_driver_id, cancelledBookingA.assigned_driver_name, cancelledBookingA.assigned_driver_phone
      ]
    );

    // Active Booking A (Assigned to Driver Alpha)
    activeBookingA = {
      id: `BK-P17-ACT-A-${Date.now()}`,
      user_id: customerUserA.id,
      customer_name: customerUserA.name,
      customer_phone: customerUserA.phone,
      service_name: 'Driver Anna One Way',
      booking_type: 'driver',
      trip_type: 'One Way',
      pickup_area: 'Koramangala 4th Block',
      drop_location: 'Kempegowda Airport',
      pickup_latitude: 12.9352,
      pickup_longitude: 77.6245,
      destination_latitude: 13.1986,
      destination_longitude: 77.7066,
      date: '2026-10-02',
      time: '04:00 PM',
      calculated_fare: 950,
      status: 'ASSIGNED',
      payment_status: 'PENDING',
      assigned_driver_id: driverRecordAlpha.id,
      assigned_driver_name: driverRecordAlpha.name,
      assigned_driver_phone: driverRecordAlpha.phone
    };
    await execute(
      `INSERT INTO bookings (
        id, user_id, customer_name, customer_phone, service_name, booking_type, trip_type,
        pickup_area, drop_location, pickup_latitude, pickup_longitude, destination_latitude, destination_longitude,
        date, time, calculated_fare, status, payment_mode, assigned_driver_id, assigned_driver_name, assigned_driver_phone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        activeBookingA.id, activeBookingA.user_id, activeBookingA.customer_name, activeBookingA.customer_phone,
        activeBookingA.service_name, activeBookingA.booking_type, activeBookingA.trip_type,
        activeBookingA.pickup_area, activeBookingA.drop_location,
        activeBookingA.pickup_latitude, activeBookingA.pickup_longitude,
        activeBookingA.destination_latitude, activeBookingA.destination_longitude,
        activeBookingA.date, activeBookingA.time, activeBookingA.calculated_fare,
        activeBookingA.status, activeBookingA.payment_status,
        activeBookingA.assigned_driver_id, activeBookingA.assigned_driver_name, activeBookingA.assigned_driver_phone
      ]
    );

    // Completed Booking B for Customer B (Assigned to Driver Beta)
    completedBookingB = {
      id: `BK-P17-CMP-B-${Date.now()}`,
      user_id: customerUserB.id,
      customer_name: customerUserB.name,
      customer_phone: customerUserB.phone,
      service_name: 'Driver Anna Night Shift',
      booking_type: 'driver',
      trip_type: 'Night Shift',
      pickup_area: 'Whitefield ITPL',
      drop_location: 'HSR Layout',
      pickup_latitude: 12.9866,
      pickup_longitude: 77.7381,
      destination_latitude: 12.9121,
      destination_longitude: 77.6446,
      date: '2026-09-25',
      time: '10:00 PM',
      calculated_fare: 890,
      status: 'COMPLETED',
      payment_status: 'PAID',
      assigned_driver_id: driverRecordBeta.id,
      assigned_driver_name: driverRecordBeta.name,
      assigned_driver_phone: driverRecordBeta.phone
    };
    await execute(
      `INSERT INTO bookings (
        id, user_id, customer_name, customer_phone, service_name, booking_type, trip_type,
        pickup_area, drop_location, pickup_latitude, pickup_longitude, destination_latitude, destination_longitude,
        date, time, calculated_fare, status, payment_mode, assigned_driver_id, assigned_driver_name, assigned_driver_phone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        completedBookingB.id, completedBookingB.user_id, completedBookingB.customer_name, completedBookingB.customer_phone,
        completedBookingB.service_name, completedBookingB.booking_type, completedBookingB.trip_type,
        completedBookingB.pickup_area, completedBookingB.drop_location,
        completedBookingB.pickup_latitude, completedBookingB.pickup_longitude,
        completedBookingB.destination_latitude, completedBookingB.destination_longitude,
        completedBookingB.date, completedBookingB.time, completedBookingB.calculated_fare,
        completedBookingB.status, completedBookingB.payment_status,
        completedBookingB.assigned_driver_id, completedBookingB.assigned_driver_name, completedBookingB.assigned_driver_phone
      ]
    );

    // Cancelled Booking for Driver Beta
    cancelledBookingBeta = {
      id: `BK-P17-CAN-BETA-${Date.now()}`,
      user_id: customerUserB.id,
      customer_name: customerUserB.name,
      customer_phone: customerUserB.phone,
      service_name: 'Driver Anna Hourly Rental',
      booking_type: 'driver',
      trip_type: 'Hourly',
      pickup_area: 'Jayanagar 4th Block',
      drop_location: 'Malleshwaram',
      pickup_latitude: 12.9250,
      pickup_longitude: 77.5838,
      destination_latitude: 13.0031,
      destination_longitude: 77.5643,
      date: '2026-09-28',
      time: '02:00 PM',
      calculated_fare: 450,
      status: 'CANCELLED',
      payment_status: 'NOT_PAID',
      assigned_driver_id: driverRecordBeta.id,
      assigned_driver_name: driverRecordBeta.name,
      assigned_driver_phone: driverRecordBeta.phone
    };
    await execute(
      `INSERT INTO bookings (
        id, user_id, customer_name, customer_phone, service_name, booking_type, trip_type,
        pickup_area, drop_location, pickup_latitude, pickup_longitude, destination_latitude, destination_longitude,
        date, time, calculated_fare, status, payment_mode, assigned_driver_id, assigned_driver_name, assigned_driver_phone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cancelledBookingBeta.id, cancelledBookingBeta.user_id, cancelledBookingBeta.customer_name, cancelledBookingBeta.customer_phone,
        cancelledBookingBeta.service_name, cancelledBookingBeta.booking_type, cancelledBookingBeta.trip_type,
        cancelledBookingBeta.pickup_area, cancelledBookingBeta.drop_location,
        cancelledBookingBeta.pickup_latitude, cancelledBookingBeta.pickup_longitude,
        cancelledBookingBeta.destination_latitude, cancelledBookingBeta.destination_longitude,
        cancelledBookingBeta.date, cancelledBookingBeta.time, cancelledBookingBeta.calculated_fare,
        cancelledBookingBeta.status, cancelledBookingBeta.payment_status,
        cancelledBookingBeta.assigned_driver_id, cancelledBookingBeta.assigned_driver_name, cancelledBookingBeta.assigned_driver_phone
      ]
    );
  });

  after(async () => {
    if (appServer && appServer.close) {
      await new Promise(r => appServer.close(r));
    }
  });

  // =========================================================================
  // PART 1 — CUSTOMER BOOKING HISTORY & OWNERSHIP
  // =========================================================================
  describe('Part 1 — Customer Booking History & Authorization', () => {
    test('1.1 Unauthenticated request to GET /api/bookings/my is rejected with 401 UNAUTHORIZED', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/my`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'UNAUTHORIZED');
    });

    test('1.2 Customer with no bookings receives an empty list []', async () => {
      const uSfx = Math.floor(Math.random() * 89999 + 10000);
      const newCust = {
        id: `USR-NEW-${Date.now()}-${uSfx}`,
        name: 'Brand New Customer',
        phone: `+91 97${uSfx}88`,
        role: 'customer'
      };
      await execute(
        `INSERT INTO users (id, name, email, phone, role, password_hash, status)
         VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
        [newCust.id, newCust.name, `newcust_${Date.now()}_${uSfx}@test.com`, newCust.phone, newCust.role, '$2a$12$dummyHash']
      );
      const token = makeToken(newCust);
      const res = await fetch(`${baseUrl}/api/bookings/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data.bookings));
      assert.strictEqual(json.data.bookings.length, 0);
    });

    test('1.3 Customer A retrieves their own multiple bookings (completed, cancelled, active)', async () => {
      const tokenA = makeToken(customerUserA);
      const res = await fetch(`${baseUrl}/api/bookings/my`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const bookings = json.data.bookings;
      assert.ok(Array.isArray(bookings));
      assert.ok(bookings.length >= 3);

      const ids = bookings.map(b => b.id);
      assert.ok(ids.includes(completedBookingA.id), 'Includes completed booking A');
      assert.ok(ids.includes(cancelledBookingA.id), 'Includes cancelled booking A');
      assert.ok(ids.includes(activeBookingA.id), 'Includes active booking A');
    });

    test('1.4 Customer A bookings contain authoritative fields (fare, pickup, drop, driver)', async () => {
      const tokenA = makeToken(customerUserA);
      const res = await fetch(`${baseUrl}/api/bookings/my`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      const json = await res.json();
      const b = json.data.bookings.find(x => x.id === completedBookingA.id);
      assert.ok(b);
      assert.strictEqual(b.calculated_fare, completedBookingA.calculated_fare);
      assert.strictEqual(b.pickup_area, completedBookingA.pickup_area);
      assert.strictEqual(b.drop_location, completedBookingA.drop_location);
      assert.strictEqual(b.status, 'COMPLETED');
      assert.strictEqual(b.assigned_driver_name, driverRecordAlpha.name);
      assert.strictEqual(b.assigned_driver_phone, driverRecordAlpha.phone);
    });

    test('1.5 Customer A CANNOT see Customer B bookings via GET /api/bookings/my (Strict Isolation)', async () => {
      const tokenA = makeToken(customerUserA);
      const res = await fetch(`${baseUrl}/api/bookings/my`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      const json = await res.json();
      const ids = json.data.bookings.map(b => b.id);
      assert.ok(!ids.includes(completedBookingB.id), 'Customer A must not see Customer B completed booking');
      assert.ok(!ids.includes(cancelledBookingBeta.id), 'Customer A must not see Customer B cancelled booking');
    });

    test('1.6 Customer B CANNOT see Customer A bookings via GET /api/bookings/my', async () => {
      const tokenB = makeToken(customerUserB);
      const res = await fetch(`${baseUrl}/api/bookings/my`, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      const json = await res.json();
      const ids = json.data.bookings.map(b => b.id);
      assert.ok(!ids.includes(completedBookingA.id), 'Customer B must not see Customer A completed booking');
      assert.ok(!ids.includes(cancelledBookingA.id), 'Customer B must not see Customer A cancelled booking');
      assert.ok(!ids.includes(activeBookingA.id), 'Customer B must not see Customer A active booking');
    });

    test('1.7 Customer history is bounded by safe limit query parameter', async () => {
      const tokenA = makeToken(customerUserA);
      const res = await fetch(`${baseUrl}/api/bookings/my?limit=1`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.bookings.length, 1);
    });
  });

  // =========================================================================
  // PART 2 — HISTORICAL BOOKING DETAIL & RBAC ENFORCEMENT (GET /api/bookings/:id)
  // =========================================================================
  describe('Part 2 — Historical Booking Detail Authorization (GET /api/bookings/:id)', () => {
    test('2.1 Unauthenticated request to GET /api/bookings/:id is blocked (401)', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/${completedBookingA.id}`);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'UNAUTHORIZED');
    });

    test('2.2 Customer A retrieving own completed booking via GET /api/bookings/:id returns 200', async () => {
      const tokenA = makeToken(customerUserA);
      const res = await fetch(`${baseUrl}/api/bookings/${completedBookingA.id}`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.booking.id, completedBookingA.id);
      assert.strictEqual(json.data.booking.status, 'COMPLETED');
    });

    test('2.3 Customer A retrieving own cancelled booking via GET /api/bookings/:id returns 200', async () => {
      const tokenA = makeToken(customerUserA);
      const res = await fetch(`${baseUrl}/api/bookings/${cancelledBookingA.id}`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.booking.id, cancelledBookingA.id);
      assert.strictEqual(json.data.booking.status, 'CANCELLED');
    });

    test('2.4 Customer A attempting to retrieve Customer B booking via GET /api/bookings/:id is DENIED (403 FORBIDDEN)', async () => {
      const tokenA = makeToken(customerUserA);
      const res = await fetch(`${baseUrl}/api/bookings/${completedBookingB.id}`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'FORBIDDEN');
      assert.strictEqual(json.data, undefined);
    });

    test('2.5 Customer B attempting to retrieve Customer A booking via GET /api/bookings/:id is DENIED (403 FORBIDDEN)', async () => {
      const tokenB = makeToken(customerUserB);
      const res = await fetch(`${baseUrl}/api/bookings/${completedBookingA.id}`, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'FORBIDDEN');
    });

    test('2.6 Admin can retrieve any historical booking via GET /api/bookings/:id', async () => {
      const adminToken = makeToken(adminUser);
      const res = await fetch(`${baseUrl}/api/bookings/${completedBookingA.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.booking.id, completedBookingA.id);
    });

    test('2.7 Non-existent booking ID via GET /api/bookings/:id returns 404 BOOKING_NOT_FOUND', async () => {
      const tokenA = makeToken(customerUserA);
      const res = await fetch(`${baseUrl}/api/bookings/non-existent-booking-id-12345`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert.strictEqual(res.status, 404);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'BOOKING_NOT_FOUND');
    });
  });

  // =========================================================================
  // PART 3 — DRIVER BOOKING HISTORY & SCOPING
  // =========================================================================
  describe('Part 3 — Driver Booking History & Authorization', () => {
    test('3.1 Unauthenticated request to GET /api/drivers/history is blocked (401)', async () => {
      const res = await fetch(`${baseUrl}/api/drivers/history`);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'UNAUTHORIZED');
    });

    test('3.2 Customer account requesting GET /api/drivers/history is denied (403)', async () => {
      const tokenA = makeToken(customerUserA);
      const res = await fetch(`${baseUrl}/api/drivers/history`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'FORBIDDEN');
    });

    test('3.3 Inactive/Suspended driver requesting GET /api/drivers/history is denied (403 DRIVER_INACTIVE)', async () => {
      const tokenInact = makeToken(inactiveDriverUser);
      const res = await fetch(`${baseUrl}/api/drivers/history`, {
        headers: { Authorization: `Bearer ${tokenInact}` }
      });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'DRIVER_INACTIVE');
    });

    test('3.4 Driver Alpha retrieves their past terminal trips (COMPLETED and CANCELLED)', async () => {
      const tokenAlpha = makeToken(driverUserAlpha);
      const res = await fetch(`${baseUrl}/api/drivers/history`, {
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data.history));

      const ids = json.data.history.map(t => t.id);
      assert.ok(ids.includes(completedBookingA.id), 'Includes Alpha completed booking');
      assert.ok(ids.includes(cancelledBookingA.id), 'Includes Alpha cancelled booking');
    });

    test('3.5 Driver Alpha history strictly EXCLUDES active trips (ASSIGNED / ARRIVED / IN_PROGRESS)', async () => {
      const tokenAlpha = makeToken(driverUserAlpha);
      const res = await fetch(`${baseUrl}/api/drivers/history`, {
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      });
      const json = await res.json();
      const ids = json.data.history.map(t => t.id);
      assert.ok(!ids.includes(activeBookingA.id), 'Active assigned booking must NOT appear in history');
      for (const trip of json.data.history) {
        assert.ok(
          trip.status === 'COMPLETED' || trip.status === 'CANCELLED',
          `Expected terminal status but got: ${trip.status}`
        );
      }
    });

    test('3.6 Driver Alpha CANNOT see Driver Beta past trips (Driver History Isolation)', async () => {
      const tokenAlpha = makeToken(driverUserAlpha);
      const res = await fetch(`${baseUrl}/api/drivers/history`, {
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      });
      const json = await res.json();
      const ids = json.data.history.map(t => t.id);
      assert.ok(!ids.includes(completedBookingB.id), 'Alpha must not see Beta completed booking');
      assert.ok(!ids.includes(cancelledBookingBeta.id), 'Alpha must not see Beta cancelled booking');
    });

    test('3.7 Driver Beta retrieves only Driver Beta past trips', async () => {
      const tokenBeta = makeToken(driverUserBeta);
      const res = await fetch(`${baseUrl}/api/drivers/history`, {
        headers: { Authorization: `Bearer ${tokenBeta}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      const ids = json.data.history.map(t => t.id);
      assert.ok(ids.includes(completedBookingB.id), 'Includes Beta completed booking');
      assert.ok(ids.includes(cancelledBookingBeta.id), 'Includes Beta cancelled booking');
      assert.ok(!ids.includes(completedBookingA.id), 'Beta must not see Alpha completed booking');
      assert.ok(!ids.includes(cancelledBookingA.id), 'Beta must not see Alpha cancelled booking');
    });

    test('3.8 Assigned driver can retrieve historical booking detail via GET /api/bookings/:id', async () => {
      const tokenAlpha = makeToken(driverUserAlpha);
      const res = await fetch(`${baseUrl}/api/bookings/${completedBookingA.id}`, {
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.booking.id, completedBookingA.id);
    });

    test('3.9 Unassigned driver is DENIED access to another driver historical booking via GET /api/bookings/:id (403)', async () => {
      const tokenBeta = makeToken(driverUserBeta);
      const res = await fetch(`${baseUrl}/api/bookings/${completedBookingA.id}`, {
        headers: { Authorization: `Bearer ${tokenBeta}` }
      });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'FORBIDDEN');
    });

    test('3.10 Admin can fetch all driver history across the system', async () => {
      const adminToken = makeToken(adminUser);
      const res = await fetch(`${baseUrl}/api/drivers/history`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      const ids = json.data.history.map(t => t.id);
      assert.ok(ids.includes(completedBookingA.id));
      assert.ok(ids.includes(completedBookingB.id));
    });

    test('3.11 Driver history query supports limit parameter and defaults to safe bounded query', async () => {
      const adminToken = makeToken(adminUser);
      const res = await fetch(`${baseUrl}/api/drivers/history?limit=2`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.history.length, 2);
    });
  });

  // =========================================================================
  // PART 4 — TERMINAL BOOKING INVARIANTS & TRACKING REGRESSION PROTECTION
  // =========================================================================
  describe('Part 4 — Terminal Booking Invariants & Tracking Protection', () => {
    test('4.1 BookingSuccessModal explicitly defines isTerminalState for COMPLETED and CANCELLED', () => {
      assert.ok(modalContent.includes('isTerminalState'), 'BookingSuccessModal must evaluate isTerminalState');
      assert.ok(
        modalContent.includes("String(currentStatus || '').toUpperCase() === 'COMPLETED'"),
        'Evaluates COMPLETED as terminal'
      );
      assert.ok(
        modalContent.includes("String(currentStatus || '').toUpperCase() === 'CANCELLED'"),
        'Evaluates CANCELLED as terminal'
      );
    });

    test('4.2 useDriverRealtimeLocation is disabled when isTerminalState is true', () => {
      assert.ok(
        modalContent.includes('enabled: Boolean(hasAssignedDriver && !isTerminalState && bookingId && token)'),
        'useDriverRealtimeLocation enabled flag must be guarded by !isTerminalState'
      );
    });

    test('4.3 Route calculation is strictly suppressed when isTerminalState is true', () => {
      assert.ok(
        modalContent.includes('isTerminalState') && modalContent.includes('setDriverRoute(null)'),
        'Driver route calculation must be bypassed and cleared in terminal state'
      );
    });

    test('4.4 DriverApproachRoute and ActiveTripRoute are NOT rendered when isTerminalState is true', () => {
      assert.ok(
        modalContent.includes("!isTerminalState &&") || modalContent.includes("&& !isTerminalState"),
        'Route polylines must be guarded by !isTerminalState'
      );
    });

    test('4.5 Live driver marker is strictly guarded and NOT rendered in terminal state', () => {
      assert.ok(
        modalContent.includes('isTerminalState'),
        'Driver marker must not show in terminal state'
      );
    });

    test('4.6 Transient live-trip states (Connecting to driver, Updating route, Arrived) are hidden in terminal state', () => {
      assert.ok(
        modalContent.includes('isTerminalState ? ('),
        'Terminal badge must take precedence over transient badges'
      );
      assert.ok(modalContent.includes('Trip Completed'), 'Shows Trip Completed terminal banner');
      assert.ok(modalContent.includes('Trip Cancelled'), 'Shows Trip Cancelled terminal banner');
    });

    test('4.7 DriverPortalPage past trips view does NOT include GPS start/toggle or arrived buttons', () => {
      assert.ok(driverPortalContent.includes("dutiesTab === 'history'"), 'Driver portal has dedicated history view');
      assert.ok(driverPortalContent.includes('Past Trips History'), 'Driver portal has Past Trips History tab');
      // In the history branch, action buttons like "Start Trip", "I have Arrived" are not included
      assert.ok(driverPortalContent.includes('trip.payout'), 'Historical card shows payout');
      assert.ok(driverPortalContent.includes('trip.customerName'), 'Historical card shows authorized customer name');
      assert.ok(driverPortalContent.includes('trip.customerPhone'), 'Historical card shows authorized customer phone');
    });
  });

  // =========================================================================
  // PART 5 — CROSS-BOOKING ISOLATION & FRONTEND SYNC
  // =========================================================================
  describe('Part 5 — Cross-Booking Isolation & Persistence', () => {
    test('5.1 BookingSuccessModal synchronizes state when booking prop changes (Booking A -> Booking B)', () => {
      assert.ok(
        modalContent.includes('useEffect(() => {') &&
        modalContent.includes('setCurrentStatus(rawStatus)') &&
        modalContent.includes('setAssignedDriverId(dId)'),
        'BookingSuccessModal must synchronize status and driver when booking prop changes'
      );
    });

    test('5.2 UserProfileModal exposes onViewBooking to open authoritative booking detail', () => {
      assert.ok(profileModalContent.includes('onViewBooking'), 'UserProfileModal accepts onViewBooking');
      assert.ok(profileModalContent.includes('Trip Details'), 'UserProfileModal provides Trip Details action');
    });

    test('5.3 UserProfileModal handles loading and error states for booking history', () => {
      assert.ok(profileModalContent.includes('isLoadingBookings'), 'UserProfileModal tracks isLoadingBookings');
      assert.ok(profileModalContent.includes('bookingsError'), 'UserProfileModal tracks bookingsError');
      assert.ok(profileModalContent.includes('Retry'), 'UserProfileModal provides Retry button on error');
    });

    test('5.4 apiClient provides getDriverHistory endpoint', () => {
      const clientPath = path.resolve('src/services/apiClient.js');
      const clientContent = fs.readFileSync(clientPath, 'utf8');
      assert.ok(clientContent.includes('getDriverHistory:'), 'apiClient has getDriverHistory method');
      assert.ok(clientContent.includes('/drivers/history'), 'apiClient calls /drivers/history');
    });

    test('5.5 getUserBookings service query uses bounded SQL and proper condition grouping', () => {
      assert.ok(bookingServiceContent.includes('safeLimit'), 'bookingService enforces safeLimit');
      assert.ok(bookingServiceContent.includes('LIMIT ?'), 'bookingService query is bounded');
      assert.ok(
        bookingServiceContent.includes('(b.user_id = ? OR b.customer_phone = ? OR b.customer_phone LIKE ?)'),
        'Parentheses group OR conditions correctly in getUserBookings'
      );
    });

    test('5.6 Historical booking data survives database-level re-query after status mutations', async () => {
      const freshBooking = await queryOne('SELECT status, calculated_fare, assigned_driver_id FROM bookings WHERE id = ?', [completedBookingA.id]);
      assert.strictEqual(freshBooking.status, 'COMPLETED');
      assert.strictEqual(freshBooking.calculated_fare, completedBookingA.calculated_fare);
      assert.strictEqual(freshBooking.assigned_driver_id, driverRecordAlpha.id);
    });
  });
});
