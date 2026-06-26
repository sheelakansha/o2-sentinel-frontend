const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");

let db;

async function initializeDatabase() {
  db = await open({
    filename: path.join(__dirname, "../database/database.db"),
    driver: sqlite3.Database,
  });

  // Table for telemetry data logging
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sensor_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      oxygen REAL,
      temperature REAL,
      humidity REAL,
      timestamp TEXT
    );
  `);

  // Table for alert events logging
  await db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      severity TEXT,
      message TEXT,
      oxygen REAL,
      temperature REAL,
      humidity REAL,
      timestamp TEXT,
      status TEXT DEFAULT 'Active',
      acknowledged INTEGER DEFAULT 0,
      resolved_at TEXT
    );
  `);

  // Migration scripts: safely add new columns if table already existed
  try {
    await db.exec("ALTER TABLE alerts ADD COLUMN type TEXT");
  } catch (e) {
    // Column already exists, ignore error
  }
  try {
    await db.exec("ALTER TABLE alerts ADD COLUMN status TEXT DEFAULT 'Active'");
  } catch (e) {
    // Column already exists, ignore error
  }
  try {
    await db.exec("ALTER TABLE alerts ADD COLUMN resolved_at TEXT");
  } catch (e) {
    // Column already exists, ignore error
  }

  // Table for system events timeline logging
  await db.exec(`
    CREATE TABLE IF NOT EXISTS system_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT,
      details TEXT,
      timestamp TEXT
    );
  `);

  // Insert a startup boot log entry
  try {
    await db.run(
      `
      INSERT INTO system_events (event, details, timestamp) 
      VALUES ('STARTUP', 'System Boot / Database initialization successful', ?)
      `,
      [new Date().toISOString()]
    );
  } catch (e) {
    console.error("Failed to insert system boot event:", e);
  }

  console.log("✅ Database Connected");
}

function getDatabase() {
  return db;
}

/**
 * Inserts a new sensor telemetry point into SQLite
 */
async function insertSensorReading({ oxygen, temperature, humidity, timestamp }) {
  if (!db) throw new Error("Database connection not established");
  return db.run(
    `
    INSERT INTO sensor_logs 
    (oxygen, temperature, humidity, timestamp) 
    VALUES (?, ?, ?, ?)
    `,
    [oxygen, temperature, humidity, timestamp]
  );
}

/**
 * Fetches the latest sensor entries from SQLite, returned in chronological order
 */
async function fetchSensorHistory(limit = 15) {
  if (!db) throw new Error("Database connection not established");
  const rows = await db.all(
    `
    SELECT oxygen, temperature, humidity, timestamp 
    FROM sensor_logs 
    ORDER BY id DESC 
    LIMIT ?
    `,
    [limit]
  );
  return rows.reverse();
}

/**
 * Inserts a new alert event log entry in the alerts table
 */
async function insertAlertLog({ type, severity, message, oxygen, temperature, humidity, timestamp }) {
  if (!db) throw new Error("Database connection not established");
  return db.run(
    `
    INSERT INTO alerts 
    (type, severity, message, oxygen, temperature, humidity, timestamp, status) 
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
    `,
    [type, severity, message, oxygen, temperature, humidity, timestamp]
  );
}

/**
 * Fetches an unacknowledged/active alert by its specific type ('oxygen', 'temperature', 'humidity')
 * Supports legacy alerts where type is NULL by checking message matches.
 */
async function fetchAlertByActiveType(type) {
  if (!db) throw new Error("Database connection not established");
  let likePattern = '';
  if (type === 'oxygen') likePattern = '%oxygen%';
  else if (type === 'temperature') likePattern = '%temp%';
  else if (type === 'humidity') likePattern = '%humid%';

  return db.get(
    `
    SELECT id, type, severity, message, oxygen, temperature, humidity, timestamp, status, acknowledged, resolved_at 
    FROM alerts 
    WHERE status IN ('Active', 'Acknowledged') AND (type = ? OR (type IS NULL AND message LIKE ?))
    `,
    [type, likePattern]
  );
}

/**
 * Automatically marks active/acknowledged alerts of a specific type as Resolved
 * Supports legacy alerts where type is NULL by checking message matches.
 */
async function resolveAlertByType(type, resolvedAt) {
  if (!db) throw new Error("Database connection not established");
  let likePattern = '';
  if (type === 'oxygen') likePattern = '%oxygen%';
  else if (type === 'temperature') likePattern = '%temp%';
  else if (type === 'humidity') likePattern = '%humid%';

  return db.run(
    `
    UPDATE alerts 
    SET status = 'Resolved', resolved_at = ? 
    WHERE status IN ('Active', 'Acknowledged') AND (type = ? OR (type IS NULL AND message LIKE ?))
    `,
    [resolvedAt, type, likePattern]
  );
}

/**
 * Fetches all active (unacknowledged) alert logs, sorted newest first
 */
async function fetchActiveAlerts() {
  if (!db) throw new Error("Database connection not established");
  return db.all(
    `
    SELECT id, type, severity, message, oxygen, temperature, humidity, timestamp, status, acknowledged, resolved_at 
    FROM alerts 
    WHERE status IN ('Active', 'Acknowledged') 
    ORDER BY id DESC
    `
  );
}

/**
 * Fetches all alert logs (history), sorted newest first
 */
async function fetchAlertHistory(limit = 50) {
  if (!db) throw new Error("Database connection not established");
  return db.all(
    `
    SELECT id, type, severity, message, oxygen, temperature, humidity, timestamp, status, acknowledged, resolved_at 
    FROM alerts 
    ORDER BY id DESC 
    LIMIT ?
    `,
    [limit]
  );
}

/**
 * Sets an alert's acknowledged flag to true (1) and status to Acknowledged in SQLite
 */
async function setAlertAcknowledged(id) {
  if (!db) throw new Error("Database connection not established");
  return db.run(
    `
    UPDATE alerts 
    SET acknowledged = 1, status = 'Acknowledged' 
    WHERE id = ?
    `,
    [id]
  );
}

/**
 * Inserts a system event log in SQLite database
 */
async function insertSystemEvent(event, details) {
  if (!db) return;
  try {
    await db.run(
      `
      INSERT INTO system_events (event, details, timestamp) 
      VALUES (?, ?, ?)
      `,
      [event, details, new Date().toISOString()]
    );
  } catch (err) {
    console.error("Failed to insert system event:", err);
  }
}

/**
 * Fetches system event timeline logs sorted chronologically newest first
 */
async function fetchSystemEvents(limit = 30) {
  if (!db) throw new Error("Database connection not established");
  return db.all(
    `
    SELECT id, event, details, timestamp 
    FROM system_events 
    ORDER BY id DESC 
    LIMIT ?
    `,
    [limit]
  );
}

module.exports = {
  initializeDatabase,
  getDatabase,
  insertSensorReading,
  fetchSensorHistory,
  insertAlertLog,
  fetchAlertByActiveType,
  resolveAlertByType,
  fetchActiveAlerts,
  fetchAlertHistory,
  setAlertAcknowledged,
  insertSystemEvent,
  fetchSystemEvents,
};