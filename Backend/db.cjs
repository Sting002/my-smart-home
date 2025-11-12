// Backend/db.cjs
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbFile = path.resolve(__dirname, "smarthome.db");
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'user'
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
  // Ensure newer columns exist even if table was created before this script
  db.all(`PRAGMA table_info(users)`, (err, columns) => {
    if (err) return;
    const hasRole = Array.isArray(columns) && columns.some((c) => c.name === "role");
    if (!hasRole) {
      db.run(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
    }
  });
});

module.exports = { db };
