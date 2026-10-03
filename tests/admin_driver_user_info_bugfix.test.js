import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeDriverBooking } from '../src/utils/driverDutyHelpers.js';

describe('Admin Driver Section — Customer Information & Booking Isolation Suite', () => {
  const adminPagePath = path.resolve('src/pages/AdminPage.jsx');
  const adminDriverTabPath = path.resolve('src/pages/admin/AdminDriverTab.jsx');
  const driversRoutePath = path.resolve('server/routes/drivers.js');
  const driverPortalPath = path.resolve('src/pages/DriverPortalPage.jsx');

  test('1. normalizeDriverBooking safely maps backend snake_case fields to camelCase', () => {
    const rawDbBooking = {
      id: 'BDA-DRV-C1EE9C',
      customer_name: 'Sandy Kumar',
      customer_phone: '+91 9344213993',
      customer_email: 'sandy@example.com',
      booking_type: 'driver',
      trip_type: 'one-way',
      service_name: 'One Way Trip Driver',
      pickup_area: 'Indiranagar',
      drop_location: 'Kempegowda Intl Airport',
      calculated_fare: 499,
      date: '2026-09-23',
      time: '09:00',
      status: 'PENDING'
    };

    const normalized = normalizeDriverBooking(rawDbBooking);
    assert.equal(normalized.id, 'BDA-DRV-C1EE9C');
    assert.equal(normalized.customerName, 'Sandy Kumar');
    assert.equal(normalized.phone, '+91 9344213993');
    assert.equal(normalized.pickupArea, 'Indiranagar');
    assert.equal(normalized.dropLocation, 'Kempegowda Intl Airport');
    assert.equal(normalized.fare, 499);
    assert.equal(normalized.tripTitle, 'One Way Trip Driver');
    assert.equal(normalized.status, 'Pending');
  });

  test('2. normalizeDriverBooking preserves existing camelCase fields', () => {
    const camelBooking = {
      id: 'BDA-DRV-FEEE9E',
      customerName: 'Sandy Kumar',
      phone: '9344213993',
      pickupArea: 'Koramangala',
      dropLocation: 'Whitefield',
      fare: 350,
      tripTitle: 'Driver Service',
      status: 'Assigned'
    };

    const normalized = normalizeDriverBooking(camelBooking);
    assert.equal(normalized.customerName, 'Sandy Kumar');
    assert.equal(normalized.phone, '9344213993');
    assert.equal(normalized.pickupArea, 'Koramangala');
    assert.equal(normalized.dropLocation, 'Whitefield');
    assert.equal(normalized.fare, 350);
    assert.equal(normalized.status, 'Assigned');
  });

  test('3. AdminPage excludes vehicle bookings and class enrollments from For Driver tab', () => {
    const content = fs.readFileSync(adminPagePath, 'utf8');

    // Verification of strict driver tab filtering
    assert.match(content, /b\.booking_type === 'vehicle'/, 'Must filter out vehicle bookings by booking_type');
    assert.match(content, /BDA-VEH-/, 'Must filter out BDA-VEH- booking IDs from driver tab');
    assert.match(content, /b\.booking_type === 'class'/, 'Must filter out class enrollments by booking_type');
    assert.match(content, /BDA-CLS-/, 'Must filter out BDA-CLS- booking IDs from driver tab');
  });

  test('4. AdminDriverTab contains fallback rendering for customer name, phone, route, and fare', () => {
    const content = fs.readFileSync(adminDriverTabPath, 'utf8');

    assert.match(content, /b\.customerName \|\| b\.customer_name/, 'Must have fallback for customer name');
    assert.match(content, /b\.phone \|\| b\.customer_phone/, 'Must have fallback for customer phone');
    assert.match(content, /b\.fare !== undefined \? b\.fare : \(b\.calculated_fare/, 'Must have fallback for fare');
    assert.match(content, /b\.pickupArea \|\| b\.pickup_area/, 'Must have fallback for pickupArea');
    assert.match(content, /b\.dropLocation \|\| b\.drop_location/, 'Must have fallback for dropLocation');
  });

  test('5. server/routes/drivers.js strictly filters admin duties to driver bookings', () => {
    const content = fs.readFileSync(driversRoutePath, 'utf8');
    assert.match(content, /SELECT \* FROM bookings WHERE booking_type = 'driver'/, 'Must filter by booking_type = driver for admin duties');
  });

  test('6. DriverPortalPage normalizes duties before storing in bda_driver_bookings', () => {
    const content = fs.readFileSync(driverPortalPath, 'utf8');
    assert.match(content, /customerName:\s*b\.customer_name \|\| b\.customerName/, 'Must map customerName before storing');
    assert.match(content, /phone:\s*b\.customer_phone \|\| b\.customerPhone/, 'Must map phone before storing');
  });
});
