DROP DATABASE IF EXISTS fidel_palace;
CREATE DATABASE fidel_palace CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fidel_palace;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('owner', 'manager', 'front_desk', 'housekeeping') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE room_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  tagline VARCHAR(180) NOT NULL,
  description TEXT,
  base_occupancy INT NOT NULL DEFAULT 2,
  max_occupancy INT NOT NULL DEFAULT 2,
  max_adults INT NOT NULL DEFAULT 2,
  max_children INT NOT NULL DEFAULT 1,
  bed_config VARCHAR(140) NOT NULL,
  size_sqm INT NOT NULL,
  base_rate DECIMAL(12,2) NOT NULL,
  extra_adult_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  extra_child_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  amenities_json TEXT,
  photos_json TEXT,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_type_id INT NOT NULL,
  room_number VARCHAR(20) NOT NULL UNIQUE,
  floor INT NOT NULL,
  status ENUM('available', 'occupied', 'dirty', 'clean', 'inspected', 'out_of_order', 'maintenance') NOT NULL DEFAULT 'inspected',
  view_type VARCHAR(60) DEFAULT NULL,
  is_accessible TINYINT(1) NOT NULL DEFAULT 0,
  notes VARCHAR(255) DEFAULT NULL,
  ooo_reason VARCHAR(255) DEFAULT NULL,
  ooo_until DATE DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_rooms_type FOREIGN KEY (room_type_id) REFERENCES room_types(id)
);

CREATE TABLE rate_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_type_id INT NOT NULL,
  name VARCHAR(140) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  min_stay INT NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_rates_type FOREIGN KEY (room_type_id) REFERENCES room_types(id)
);

CREATE TABLE guests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(160) DEFAULT NULL,
  phone VARCHAR(40) DEFAULT NULL,
  nationality VARCHAR(80) DEFAULT NULL,
  id_type VARCHAR(40) DEFAULT NULL,
  id_number VARCHAR(80) DEFAULT NULL,
  notes TEXT,
  is_vip TINYINT(1) NOT NULL DEFAULT 0,
  is_blacklisted TINYINT(1) NOT NULL DEFAULT 0,
  blacklist_reason VARCHAR(255) DEFAULT NULL,
  company_name VARCHAR(160) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE promotions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  description VARCHAR(180) NOT NULL,
  type ENUM('percent', 'fixed') NOT NULL,
  value DECIMAL(12,2) NOT NULL,
  valid_from DATE DEFAULT NULL,
  valid_to DATE DEFAULT NULL,
  usage_limit INT DEFAULT NULL,
  used_count INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_ref VARCHAR(32) NOT NULL UNIQUE,
  guest_id INT NOT NULL,
  status ENUM('inquiry', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show') NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  adults INT NOT NULL,
  children INT NOT NULL DEFAULT 0,
  source ENUM('website', 'walk_in', 'phone', 'agent', 'ota') NOT NULL DEFAULT 'website',
  payment_preference ENUM('pay_at_hotel', 'pay_now', 'request') NOT NULL DEFAULT 'pay_at_hotel',
  special_requests TEXT,
  promo_code VARCHAR(40) DEFAULT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  service_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
  vat DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_snapshot TEXT,
  cancellation_reason VARCHAR(255) DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_res_guest FOREIGN KEY (guest_id) REFERENCES guests(id),
  INDEX idx_res_dates (status, check_in, check_out)
);

CREATE TABLE reservation_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT NOT NULL,
  room_type_id INT NOT NULL,
  room_id INT DEFAULT NULL,
  rate_per_night DECIMAL(12,2) NOT NULL,
  nights INT NOT NULL,
  adults INT NOT NULL DEFAULT 1,
  children INT NOT NULL DEFAULT 0,
  extra_adult_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
  extra_child_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_rr_res FOREIGN KEY (reservation_id) REFERENCES reservations(id),
  CONSTRAINT fk_rr_type FOREIGN KEY (room_type_id) REFERENCES room_types(id),
  CONSTRAINT fk_rr_room FOREIGN KEY (room_id) REFERENCES rooms(id),
  INDEX idx_rr_type (room_type_id, reservation_id),
  INDEX idx_rr_room (room_id)
);

CREATE TABLE reservation_status_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT NOT NULL,
  old_status VARCHAR(40) DEFAULT NULL,
  new_status VARCHAR(40) NOT NULL,
  user_id INT DEFAULT NULL,
  note VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rsl_res FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);

CREATE TABLE room_status_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  status VARCHAR(40) NOT NULL,
  user_id INT DEFAULT NULL,
  note VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rstatus_room FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE folio_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT NOT NULL,
  description VARCHAR(200) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  item_type ENUM('service', 'minibar', 'laundry', 'restaurant', 'discount', 'fee', 'other') NOT NULL DEFAULT 'other',
  posted_by INT DEFAULT NULL,
  posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_folio_res FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method ENUM('cash', 'card', 'telebirr', 'bank_transfer', 'city_ledger') NOT NULL,
  reference VARCHAR(80) DEFAULT NULL,
  note VARCHAR(200) DEFAULT NULL,
  paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  received_by INT DEFAULT NULL,
  CONSTRAINT fk_pay_res FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);

CREATE TABLE settings (
  skey VARCHAR(80) PRIMARY KEY,
  svalue TEXT NOT NULL
);

CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  phone VARCHAR(40) DEFAULT NULL,
  topic VARCHAR(80) DEFAULT NULL,
  body TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
