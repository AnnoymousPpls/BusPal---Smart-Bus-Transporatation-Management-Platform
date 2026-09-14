-- ============================================================
-- BusPal — PHP/MySQL Backend Schema
-- Run this once against a fresh `buspal` database (phpMyAdmin's
-- "Import" tab, or `mysql -u root buspal < schema.sql`).
-- Covers every feature currently built in the frontend — this
-- schema was written by reading shared/js/store.js and both
-- dashboards' data.js files, not designed from scratch, so table
-- shapes match what the JS mock layer already expects.
-- ============================================================

CREATE DATABASE IF NOT EXISTS buspal_php CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE buspal_php;

-- ---------------- accounts ----------------
CREATE TABLE accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role ENUM('passenger','owner','manager') NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  phone VARCHAR(20),
  nic VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active','pending') NOT NULL DEFAULT 'active',
  added_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (added_by) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Simple bearer-token auth (not real JWT — a random opaque token
-- stored server-side, same security model, far less code). One row
-- per logged-in session; delete the row to log out / expire.
CREATE TABLE auth_tokens (
  token CHAR(64) PRIMARY KEY,
  account_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------- buses ----------------
CREATE TABLE buses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plate VARCHAR(20) NOT NULL UNIQUE,
  model VARCHAR(120) NOT NULL,
  type VARCHAR(40) NOT NULL,
  capacity INT NOT NULL DEFAULT 40,
  fuel_type VARCHAR(20) NOT NULL DEFAULT 'Diesel',
  odometer INT NOT NULL DEFAULT 0,
  status ENUM('active','maintenance') NOT NULL DEFAULT 'active',
  maintenance_interval_km INT NOT NULL DEFAULT 10000
) ENGINE=InnoDB;

CREATE TABLE bus_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bus_id INT NOT NULL,
  photo_path VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------- routes & departures ----------------
CREATE TABLE routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_city VARCHAR(80) NOT NULL,
  to_city VARCHAR(80) NOT NULL,
  distance_km INT NOT NULL DEFAULT 0,
  fare INT NOT NULL DEFAULT 0,
  visible TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE staff (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  role ENUM('driver','conductor') NOT NULL,
  phone VARCHAR(20),
  ntc_license VARCHAR(60),
  driving_license VARCHAR(60),
  license_expiry DATE NULL,
  photo_path VARCHAR(255) NULL,
  photo_visible TINYINT(1) NOT NULL DEFAULT 1,
  status ENUM('active','on-leave') NOT NULL DEFAULT 'active'
) ENGINE=InnoDB;

CREATE TABLE departures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  route_id INT NOT NULL,
  time TIME NOT NULL,
  bus_id INT NULL,
  driver_id INT NULL,
  conductor_id INT NULL,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE SET NULL,
  FOREIGN KEY (driver_id) REFERENCES staff(id) ON DELETE SET NULL,
  FOREIGN KEY (conductor_id) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------- fuel & maintenance ----------------
CREATE TABLE fuel_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bus_id INT NOT NULL,
  log_date DATE NOT NULL,
  liters DECIMAL(6,1) NOT NULL,
  cost INT NOT NULL,
  odometer INT NOT NULL,
  station VARCHAR(120),
  FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE maintenance_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bus_id INT NOT NULL,
  log_date DATE NOT NULL,
  odometer INT NOT NULL,
  note VARCHAR(255),
  entry_type ENUM('service','sent','returned') NOT NULL DEFAULT 'service',
  FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------- bookings ----------------
-- Seats stored as JSON (e.g. ["12","13"]) rather than a join table —
-- same deliberate simplification noted in the Spring Boot backend's
-- README; fine at this scale, would normalize in a larger system.
CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  passenger_id INT NULL,
  passenger_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20),
  from_city VARCHAR(80) NOT NULL,
  to_city VARCHAR(80) NOT NULL,
  travel_date DATE NOT NULL,
  dep_time TIME NOT NULL,
  arr_time TIME NULL,
  bus_plate VARCHAR(20),
  bus_type VARCHAR(40),
  price INT NOT NULL DEFAULT 0,
  pickup_point VARCHAR(120),
  seats JSON NOT NULL,
  pnr VARCHAR(20) NOT NULL UNIQUE,
  status ENUM('upcoming','completed','cancelled') NOT NULL DEFAULT 'upcoming',
  source ENUM('self','counter') NOT NULL DEFAULT 'self',
  booked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (passenger_id) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------- feedback & SOS ----------------
CREATE TABLE feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  passenger_id INT NULL,
  passenger_name VARCHAR(120) NOT NULL,
  type ENUM('feedback','complaint') NOT NULL DEFAULT 'feedback',
  trip_ref VARCHAR(120),
  message TEXT NOT NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (passenger_id) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE sos_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  passenger_id INT NULL,
  passenger_name VARCHAR(120) NOT NULL,
  trip_ref VARCHAR(120),
  note VARCHAR(255),
  status ENUM('open','resolved') NOT NULL DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (passenger_id) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE emergency_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  passenger_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  FOREIGN KEY (passenger_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------- live tracking ----------------
CREATE TABLE live_tracking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  route_id INT NULL,
  departure_id INT NULL,
  from_city VARCHAR(80) NOT NULL,
  to_city VARCHAR(80) NOT NULL,
  travel_date DATE NOT NULL,
  dep_time TIME NOT NULL,
  bus_plate VARCHAR(20),
  driver_name VARCHAR(120),
  conductor_name VARCHAR(120),
  status ENUM('in-progress','completed') NOT NULL DEFAULT 'in-progress',
  current_stop_index INT NOT NULL DEFAULT 0,
  eta_minutes INT NOT NULL DEFAULT 30,
  visible TINYINT(1) NOT NULL DEFAULT 1,
  stops JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
  FOREIGN KEY (departure_id) REFERENCES departures(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------- conductor trip-access codes ----------------
CREATE TABLE trip_codes (
  code CHAR(6) PRIMARY KEY,
  from_city VARCHAR(80) NOT NULL,
  to_city VARCHAR(80) NOT NULL,
  travel_date DATE NOT NULL,
  dep_time TIME NOT NULL,
  capacity INT NOT NULL DEFAULT 40,
  bus_label VARCHAR(120),
  driver_name VARCHAR(120),
  conductor_name VARCHAR(120),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;


-- ============================================================
-- SEED DATA (fleet/routes/staff only — no passwords hashed here)
-- Demo accounts are seeded separately by seed.php, which uses PHP's
-- own password_hash() function so the stored hash is guaranteed to
-- verify correctly later. Do NOT hand-write bcrypt hashes into SQL —
-- unless computed with the exact same PHP/library version, they will
-- silently fail to verify, and that's a very confusing bug to chase.
-- ============================================================

INSERT INTO buses (plate, model, type, capacity, fuel_type, odometer, status, maintenance_interval_km) VALUES
  ('NC-9302', 'Magnate', 'AC Luxury', 37, 'Diesel', 84210, 'active', 10000),
  ('BT-2214', 'Zhongtong LCK6128H', 'AC Luxury', 51, 'Diesel', 61340, 'active', 10000),
  ('BT-1187', 'Ashok Leyland', 'Semi-Luxury', 49, 'Diesel', 102870, 'maintenance', 10000),
  ('BT-4021', 'Higer Sleeper', 'AC Sleeper', 37, 'Diesel', 45010, 'active', 15000);

INSERT INTO staff (name, role, phone, ntc_license, driving_license, license_expiry, photo_visible, status) VALUES
  ('M. Fernando', 'driver', '071 234 5678', 'NTC-DRV-88231', 'B1204552', '2027-04-12', 1, 'active'),
  ('S. Perera', 'conductor', '070 987 6543', 'NTC-CND-44120', NULL, NULL, 1, 'active');

INSERT INTO routes (from_city, to_city, distance_km, fare, visible) VALUES
  ('Colombo', 'Kandy', 115, 1250, 1),
  ('Colombo', 'Galle', 128, 1100, 1);

INSERT INTO departures (route_id, time, bus_id, driver_id, conductor_id) VALUES
  (1, '06:30:00', 1, 1, 2),
  (1, '08:00:00', 2, NULL, NULL),
  (2, '07:15:00', NULL, NULL, NULL);
