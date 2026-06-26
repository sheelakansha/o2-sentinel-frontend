const fs = require("fs");
const path = require("path");
const { getDatabase, fetchSystemEvents } = require("../models/database");

/**
 * GET /api/system/health
 * Checks server memory, uptime, DB size, and background worker state
 */
async function getHealth(req, res) {
  try {
    const db = getDatabase();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: "Database offline",
      });
    }

    // 1. Server Uptime
    const uptime = process.uptime();

    // 2. Process Memory usage
    const memory = process.memoryUsage();

    // 3. Database file size
    const dbPath = path.join(__dirname, "../database/database.db");
    let dbSize = 0;
    try {
      const stats = fs.statSync(dbPath);
      dbSize = stats.size;
    } catch (err) {
      // Ignore
    }

    // 4. Background Logging Worker Check
    let workerActive = false;
    try {
      const latestLog = await db.get("SELECT timestamp FROM sensor_logs ORDER BY id DESC LIMIT 1");
      if (latestLog) {
        const timeDiff = Date.now() - new Date(latestLog.timestamp).getTime();
        workerActive = timeDiff < 10000; // active if last write was less than 10 seconds ago
      }
    } catch (e) {
      // Ignore
    }

    return res.json({
      success: true,
      data: {
        status: "HEALTHY",
        uptime,
        memory: {
          rss: memory.rss,
          heapTotal: memory.heapTotal,
          heapUsed: memory.heapUsed,
        },
        database: {
          size: dbSize,
          path: "database.db",
        },
        worker: {
          active: workerActive,
        },
      },
    });
  } catch (err) {
    console.error("Controller Error (getHealth):", err);
    return res.status(500).json({
      success: false,
      error: "Failed to query system health parameters",
    });
  }
}

/**
 * GET /api/system/events
 * Fetches system event timeline logs
 */
async function getEvents(req, res) {
  try {
    let limit = 30;
    if (req.query.limit !== undefined) {
      const parsedLimit = parseInt(req.query.limit, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
        limit = parsedLimit;
      }
    }

    const events = await fetchSystemEvents(limit);
    return res.json({
      success: true,
      data: events,
    });
  } catch (err) {
    console.error("Controller Error (getEvents):", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch system events log timeline",
    });
  }
}

/**
 * GET /api/system
 * Retrieves overall system service status metadata
 */
async function getSystemStatus(req, res) {
  try {
    return res.json({
      success: true,
      data: {
        status: "ONLINE",
        name: "O₂ Sentinel Environmental Monitoring System API",
        version: "1.0.0",
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error("Controller Error (getSystemStatus):", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch overall system status",
    });
  }
}

module.exports = {
  getHealth,
  getEvents,
  getSystemStatus,
};
