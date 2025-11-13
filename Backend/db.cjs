// Backend/db.cjs
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbFile = path.resolve(__dirname, "smarthome.db");
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  // Existing tables
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    must_change_password INTEGER NOT NULL DEFAULT 0,
    home_id TEXT DEFAULT 'home1'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    name TEXT,
    room TEXT,
    type TEXT,
    isOn INTEGER,
    watts INTEGER,
    kwhToday REAL,
    thresholdW INTEGER,
    autoOffMins INTEGER,
    lastSeen INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  // New tables for scalability
  // Power readings timeseries
  db.run(`CREATE TABLE IF NOT EXISTS power_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    home_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    watts REAL NOT NULL,
    voltage REAL,
    current REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_power_device_time 
    ON power_readings(device_id, timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_power_home_time 
    ON power_readings(home_id, timestamp)`);

  // Energy readings
  db.run(`CREATE TABLE IF NOT EXISTS energy_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    home_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    wh_total REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_energy_device_time 
    ON energy_readings(device_id, timestamp)`);

  // Automation rules
  db.run(`CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    home_id TEXT NOT NULL,
    name TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    conditions TEXT NOT NULL,
    actions TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Alerts history
  db.run(`CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    home_id TEXT NOT NULL,
    device_id TEXT,
    timestamp INTEGER NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT,
    acknowledged INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_alerts_home_time 
    ON alerts(home_id, timestamp)`);

  // Aggregated statistics
  db.run(`CREATE TABLE IF NOT EXISTS daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    home_id TEXT NOT NULL,
    date TEXT NOT NULL,
    total_kwh REAL NOT NULL,
    avg_watts REAL NOT NULL,
    max_watts REAL NOT NULL,
    min_watts REAL NOT NULL,
    cost REAL,
    on_duration_minutes INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(device_id, date)
  )`);

  // Ensure newer columns exist even if table was created before this script
  db.all(`PRAGMA table_info(users)`, (err, columns) => {
    if (err) return;
    const hasRole = Array.isArray(columns) && columns.some((c) => c.name === "role");
    if (!hasRole) {
      db.run(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
    }
    const hasMustChange =
      Array.isArray(columns) && columns.some((c) => c.name === "must_change_password");
    if (!hasMustChange) {
      db.run(`ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0`);
    }
    const hasHomeId = Array.isArray(columns) && columns.some((c) => c.name === "home_id");
    if (!hasHomeId) {
      db.run(`ALTER TABLE users ADD COLUMN home_id TEXT DEFAULT 'home1'`);
    }
  });
});

module.exports = { db };
