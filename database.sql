-- ============================================================
--  PHILADELPHIA MOVEMENT APP — MySQL Database Schema
--  Run this file in MySQL to create all tables
-- ============================================================

CREATE DATABASE IF NOT EXISTS philadelphia_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE philadelphia_db;

-- ── USERS (login accounts) ────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  email        VARCHAR(100) NOT NULL UNIQUE,
  password     VARCHAR(255) NOT NULL,
  role         ENUM('Admin','Member','Staff') DEFAULT 'Staff',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── MEMBERS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  member_id       VARCHAR(20) NOT NULL UNIQUE,
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  phone           VARCHAR(30) NOT NULL,
  gender          ENUM('Male','Female','Other') DEFAULT 'Male',
  dob             DATE,
  occupation      VARCHAR(100),
  branch          VARCHAR(150),
  grp             VARCHAR(100),
  status          ENUM('active','inactive','pending') DEFAULT 'active',
  verified        TINYINT(1) DEFAULT 0,
  benefit         ENUM('Yes','No') DEFAULT 'No',
  captured_by     VARCHAR(100),
  date_captured   DATE,
  photo           LONGTEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── PARENTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parents (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  member_id    INT NOT NULL,
  parent_type  ENUM('father','mother') NOT NULL,
  name         VARCHAR(100),
  phone        VARCHAR(30),
  deceased     TINYINT(1) DEFAULT 0,
  death_date   DATE,
  cause        VARCHAR(255),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- ── DOCUMENTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  member_id    INT NOT NULL,
  file_name    VARCHAR(255) NOT NULL,
  file_size    VARCHAR(50),
  file_type    VARCHAR(100),
  file_data    LONGTEXT,
  uploaded_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- ── DEATH BENEFIT PAYMENTS ────────────────────────────────
CREATE TABLE IF NOT EXISTS death_benefits (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  member_id    INT NOT NULL,
  parent_name  VARCHAR(200),
  amount       DECIMAL(10,2) NOT NULL,
  method       VARCHAR(50),
  pay_date     DATE,
  notes        TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- ── WEDDING BENEFIT PAYMENTS ──────────────────────────────
CREATE TABLE IF NOT EXISTS wedding_benefits (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  member_id    INT NOT NULL,
  spouse_name  VARCHAR(100) NOT NULL,
  wedding_date DATE NOT NULL,
  venue        VARCHAR(255),
  amount       DECIMAL(10,2) NOT NULL,
  method       VARCHAR(50),
  pay_date     DATE,
  notes        TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- ── DEFAULT ADMIN USER ────────────────────────────────────
-- Password: admin123 (bcrypt hashed)
INSERT INTO users (name, email, password, role) VALUES
('Admin User', 'admin@philadelphia.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin'),
('Adom Mensah', 'adom@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Staff')
ON DUPLICATE KEY UPDATE id=id;