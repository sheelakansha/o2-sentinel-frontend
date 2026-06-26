const { getSensorData } = require("../services/sensorSimulator");
const { fetchSensorHistory, getDatabase } = require("../models/database");

/**
 * GET /api/sensors
 * Retrieves the latest telemetry reading instantly (without writing to database)
 */
async function getLatest(req, res) {
  try {
    const reading = getSensorData();
    if (!reading) {
      return res.status(503).json({
        success: false,
        error: "Sensor data temporarily unavailable",
      });
    }
    return res.json({
      success: true,
      data: reading
    });
  } catch (err) {
    console.error("Controller Error (getLatest):", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch latest sensor readings",
    });
  }
}

/**
 * GET /api/sensors/history
 * Fetches log history from SQLite database with offset pagination and validation checks
 */
async function getHistory(req, res) {
  try {
    const db = getDatabase();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: "Database offline"
      });
    }

    let limit = 15; // default value
    let page = 1; // default page
    
    if (req.query.limit !== undefined) {
      const parsedLimit = parseInt(req.query.limit, 10);
      
      // Validation: Check if it's a valid integer and falls inside range [1, 100]
      if (isNaN(parsedLimit) || parsedLimit <= 0 || parsedLimit > 100 || String(parsedLimit) !== req.query.limit.trim()) {
        return res.status(400).json({
          success: false,
          error: "Invalid limit parameter. Must be an integer between 1 and 100.",
        });
      }
      limit = parsedLimit;
    }

    if (req.query.page !== undefined) {
      const parsedPage = parseInt(req.query.page, 10);
      if (isNaN(parsedPage) || parsedPage <= 0 || String(parsedPage) !== req.query.page.trim()) {
        return res.status(400).json({
          success: false,
          error: "Invalid page parameter. Must be a positive integer starting from 1.",
        });
      }
      page = parsedPage;
    }

    const countResult = await db.get("SELECT COUNT(*) as count FROM sensor_logs");
    const total = countResult ? countResult.count : 0;
    const offset = (page - 1) * limit;

    const logs = await db.all(
      `
      SELECT oxygen, temperature, humidity, timestamp 
      FROM sensor_logs 
      ORDER BY id DESC 
      LIMIT ? OFFSET ?
      `,
      [limit, offset]
    );

    // Keep chronological order within the paginated subset
    const data = logs.reverse();

    return res.json({
      success: true,
      data: data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("Controller Error (getHistory):", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve telemetry log history from database",
    });
  }
}

/**
 * GET /api/sensors/prediction
 * Exposes dynamic forecasts for O2 levels at +30m and +60m based on linear regression of historical telemetry
 */
async function getPrediction(req, res) {
  try {
    const logs = await fetchSensorHistory(30); // Use last 30 readings
    const latestReading = getSensorData();
    if (!latestReading) {
      return res.status(503).json({ error: "Sensor telemetry offline" });
    }

    const currentOxygen = latestReading.oxygen;

    if (logs.length < 2) {
      // Fallback to static projection if not enough history in DB
      const pred30 = currentOxygen - 0.1;
      const pred1h = currentOxygen - 0.3;
      const projection = Array.from({ length: 15 }, (_, i) => {
        const t = i / 14;
        return Math.max(0, currentOxygen + (pred1h - currentOxygen) * t);
      });

      return res.json({
        success: true,
        pred30,
        pred1h,
        projection
      });
    }

    // Perform least-squares linear regression
    const n = logs.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = logs[i].oxygen;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const denominator = n * sumXX - sumX * sumX;
    const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    // Logs are saved every 5 seconds.
    // +30m = 1800s = 360 steps. +60m = 3600s = 720 steps.
    const latestIndex = n - 1;
    const pred30 = Math.max(0, slope * (latestIndex + 360) + intercept);
    const pred1h = Math.max(0, slope * (latestIndex + 720) + intercept);

    // Generate 15 projection sweep coordinates
    const projection = Array.from({ length: 15 }, (_, i) => {
      const t = i / 14;
      const step = latestIndex + (720 * t);
      return Math.max(0, slope * step + intercept);
    });

    return res.json({
      success: true,
      pred30,
      pred1h,
      projection
    });
  } catch (err) {
    console.error("Controller Error (getPrediction):", err);
    return res.status(500).json({
      error: "Failed to compute sensor prediction model"
    });
  }
}

async function exportSensorsCSV(req, res) {
  try {
    const db = getDatabase();
    if (!db) {
      return res.status(503).json({ error: "Database offline" });
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=sensor_logs_export.csv");

    res.write("id,oxygen,temperature,humidity,timestamp\n");

    const logs = await db.all("SELECT id, oxygen, temperature, humidity, timestamp FROM sensor_logs ORDER BY id ASC");
    
    for (const log of logs) {
      res.write(`${log.id},${log.oxygen.toFixed(2)},${log.temperature.toFixed(1)},${log.humidity.toFixed(1)},${log.timestamp}\n`);
    }

    res.end();
  } catch (err) {
    console.error("Controller Error (exportSensorsCSV):", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to export sensor telemetry data" });
    }
  }
}

module.exports = {
  getLatest,
  getHistory,
  getPrediction,
  exportSensorsCSV,
};
