-- Book Driver Anna Production Relational Schema
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('customer', 'driver', 'admin')),
  area TEXT NOT NULL DEFAULT 'Indiranagar',
  status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive', 'Suspended')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  license_number TEXT UNIQUE NOT NULL COLLATE NOCASE,
  hub_area TEXT NOT NULL,
  experience_years INTEGER DEFAULT 5,
  specialization TEXT DEFAULT 'Manual & Automatic Cars',
  rating REAL DEFAULT 4.95,
  trips_completed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'On Duty', 'Off Duty', 'Suspended')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  booking_type TEXT NOT NULL CHECK(booking_type IN ('driver', 'vehicle', 'class')),
  trip_type TEXT NOT NULL,
  service_name TEXT NOT NULL,
  pickup_area TEXT NOT NULL,
  drop_location TEXT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  calculated_fare REAL NOT NULL,
  payment_mode TEXT DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  cancellation_reason TEXT,
  assigned_driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
  idempotency_key TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high-performance querying and constraint checks
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_license ON drivers(license_number);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(customer_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON bookings(date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_driver_slot ON bookings(assigned_driver_id, date, time);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
