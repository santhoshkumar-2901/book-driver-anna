import bcrypt from 'bcryptjs';
import { db } from './database.js';

export function seedDatabase() {
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existingUsers && existingUsers.count > 0) {
    return; // Already seeded
  }

  console.log('[SEED] Seeding initial verified accounts and driver fleet with secure bcrypt hashes...');

  const saltRounds = 10;
  const adminHash = bcrypt.hashSync('admin123', saltRounds);
  const userHash = bcrypt.hashSync('password123', saltRounds);
  const driverHash = bcrypt.hashSync('driver123', saltRounds);

  // 1. Seed Admin
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role, area, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'ADM-1001',
    'Admin Anna',
    'admin@bookdriveranna.com',
    '+91 98765 00000',
    adminHash,
    'admin',
    'Indiranagar',
    'Active'
  );

  // 2. Seed Demo Customer
  insertUser.run(
    'USR-8821',
    'Rahul Sharma',
    'rahul.sharma@example.com',
    '+91 98765 43210',
    userHash,
    'customer',
    'Indiranagar',
    'Active'
  );

  insertUser.run(
    'USR-8822',
    'Priya Sharma',
    'priya@gmail.com',
    '+91 98441 56789',
    userHash,
    'customer',
    'Koramangala',
    'Active'
  );

  // 3. Seed Driver Accounts & Driver Profiles
  const insertDriver = db.prepare(`
    INSERT INTO drivers (id, user_id, name, phone, license_number, hub_area, experience_years, specialization, rating, trips_completed, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const driversData = [
    {
      drvId: 'DRV-1001',
      usrId: 'USR-DRV-1001',
      name: 'Manjunath Gowda',
      email: 'manjunath.gowda@driveranna.com',
      phone: '+91 98860 12345',
      license: 'KA-04-2021-0098745',
      area: 'Indiranagar',
      exp: 8,
      spec: 'Manual & Automatic Cars',
      rating: 4.98,
      trips: 3420
    },
    {
      drvId: 'DRV-1002',
      usrId: 'USR-DRV-1002',
      name: 'Venkatesh Prasad',
      email: 'venkatesh.prasad@driveranna.com',
      phone: '+91 98450 67890',
      license: 'KA-05-2020-0081234',
      area: 'Koramangala',
      exp: 7,
      spec: 'Sedans & Luxury Cars',
      rating: 4.96,
      trips: 2850
    },
    {
      drvId: 'DRV-1003',
      usrId: 'USR-DRV-1003',
      name: 'Suresh Kumar',
      email: 'suresh.kumar@driveranna.com',
      phone: '+91 99002 55667',
      license: 'KA-01-2019-0043120',
      area: 'Whitefield',
      exp: 6,
      spec: 'SUVs & Outstation Routes',
      rating: 4.94,
      trips: 2190
    },
    {
      drvId: 'DRV-1004',
      usrId: 'USR-DRV-1004',
      name: 'Raghavendra Rao',
      email: 'raghavendra.rao@driveranna.com',
      phone: '+91 97410 33445',
      license: 'KA-03-2022-0077889',
      area: 'Jayanagar',
      exp: 10,
      spec: 'Hill Driving & Outstation Ghats',
      rating: 4.99,
      trips: 4120
    },
    {
      drvId: 'DRV-1005',
      usrId: 'USR-DRV-1005',
      name: 'Chandra Shekar',
      email: 'chandra.shekar@driveranna.com',
      phone: '+91 98801 99881',
      license: 'KA-51-2021-0065432',
      area: 'HSR Layout',
      exp: 5,
      spec: 'Commercial Tempos & Mini Buses',
      rating: 4.92,
      trips: 1840
    }
  ];

  for (const d of driversData) {
    insertUser.run(
      d.usrId,
      d.name,
      d.email,
      d.phone,
      driverHash,
      'driver',
      d.area,
      'Active'
    );
    insertDriver.run(
      d.drvId,
      d.usrId,
      d.name,
      d.phone,
      d.license,
      d.area,
      d.exp,
      d.spec,
      d.rating,
      d.trips,
      'Active'
    );
  }

  // 4. Seed Initial Bookings
  const insertBooking = db.prepare(`
    INSERT INTO bookings (id, user_id, customer_name, customer_phone, customer_email, booking_type, trip_type, service_name, pickup_area, drop_location, date, time, calculated_fare, payment_mode, status, assigned_driver_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertBooking.run(
    'BDA-DRV-9801',
    'USR-8821',
    'Rahul Sharma',
    '+91 98765 43210',
    'rahul.sharma@example.com',
    'driver',
    'one-way',
    'One Way Trip Driver',
    'Indiranagar',
    'Kempegowda Intl Airport (BLR T1/T2)',
    '2026-09-05',
    '06:30 AM',
    314, // 299 + 5% GST
    'cash',
    'ASSIGNED',
    'DRV-1001'
  );

  insertBooking.run(
    'BDA-VEH-9802',
    'USR-8822',
    'Priya Sharma',
    '+91 98441 56789',
    'priya@gmail.com',
    'vehicle',
    'daily',
    'Book a Vehicle (Sedan)',
    'Koramangala',
    'Koramangala 5th Block',
    '2026-09-06',
    '09:00 AM',
    2099,
    'cash',
    'PENDING',
    null
  );

  console.log('[SEED] Database initialized with verified admin, customers, and drivers fleet.');
}
