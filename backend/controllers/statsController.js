const { getDatabase } = require("../models/database");

/**
 * GET /api/stats
 * Computes telemetry summaries (min/max/avg) and alert frequencies
 */
async function getSystemStats(req, res) {
  try {
    const db = getDatabase();
    if (!db) {
      return res.status(503).json({ error: "Database offline" });
    }

    // 1. Compute min/max/avg telemetry stats
    const telemetryStats = await db.get(`
      SELECT 
        MIN(oxygen) as minOxygen, MAX(oxygen) as maxOxygen, AVG(oxygen) as avgOxygen,
        MIN(temperature) as minTemp, MAX(temperature) as maxTemp, AVG(temperature) as avgTemp,
        MIN(humidity) as minHum, MAX(humidity) as maxHum, AVG(humidity) as avgHum
      FROM sensor_logs
    `);

    // 2. Compute alert summary counts
    const alertStats = await db.get(`
      SELECT 
        COUNT(*) as totalAlerts,
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as activeAlerts,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolvedAlerts,
        SUM(CASE WHEN acknowledged = 1 THEN 1 ELSE 0 END) as acknowledgedAlerts
      FROM alerts
    `);

    return res.json({
      success: true,
      stats: {
        telemetry: {
          oxygen: {
            min: telemetryStats.minOxygen || 0,
            max: telemetryStats.maxOxygen || 0,
            avg: telemetryStats.avgOxygen || 0,
          },
          temperature: {
            min: telemetryStats.minTemp || 0,
            max: telemetryStats.maxTemp || 0,
            avg: telemetryStats.avgTemp || 0,
          },
          humidity: {
            min: telemetryStats.minHum || 0,
            max: telemetryStats.maxHum || 0,
            avg: telemetryStats.avgHum || 0,
          },
        },
        alerts: {
          total: alertStats.totalAlerts || 0,
          active: alertStats.activeAlerts || 0,
          resolved: alertStats.resolvedAlerts || 0,
          acknowledged: alertStats.acknowledgedAlerts || 0,
        },
      },
    });
  } catch (err) {
    console.error("Controller Error (getSystemStats):", err);
    return res.status(500).json({
      error: "Failed to compile system metrics statistics",
    });
  }
}

module.exports = {
  getSystemStats,
};
