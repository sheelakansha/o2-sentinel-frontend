const { fetchActiveAlerts, fetchAlertHistory, setAlertAcknowledged, getDatabase, insertSystemEvent } = require("../models/database");

/**
 * GET /api/alerts
 * Fetches all active (unacknowledged) alerts
 */
async function getActive(req, res) {
  try {
    const alerts = await fetchActiveAlerts();
    return res.json({
      success: true,
      data: alerts
    });
  } catch (err) {
    console.error("Controller Error (getActive):", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch active alerts from database",
    });
  }
}

/**
 * GET /api/alerts/history
 * Fetches historical alert logs with optional query filters (severity, status, time, search) and limit
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

    let limit = 50; // default history limit
    let page = 1; // default page
    
    if (req.query.limit !== undefined) {
      const parsedLimit = parseInt(req.query.limit, 10);
      if (isNaN(parsedLimit) || parsedLimit <= 0 || parsedLimit > 200 || String(parsedLimit) !== req.query.limit.trim()) {
        return res.status(400).json({
          success: false,
          error: "Invalid limit parameter. Must be an integer between 1 and 200.",
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

    const conditions = [];
    const params = [];

    // Filter by severity
    if (req.query.severity) {
      conditions.push("severity = ?");
      params.push(req.query.severity.trim().toLowerCase());
    }

    // Filter by status (active, resolved, acknowledged)
    if (req.query.status) {
      const statusVal = req.query.status.trim().toLowerCase();
      if (statusVal === "acknowledged") {
        conditions.push("acknowledged = 1");
      } else if (statusVal === "active") {
        conditions.push("status = 'Active' AND acknowledged = 0");
      } else if (statusVal === "resolved") {
        conditions.push("status = 'Resolved'");
      } else {
        conditions.push("status = ?");
        params.push(req.query.status.trim());
      }
    }

    // Search message keyword
    if (req.query.search) {
      conditions.push("message LIKE ?");
      params.push(`%${req.query.search.trim()}%`);
    }

    // Filter by timestamp range (e.g. ?time=30m, ?time=1h, ?time=24h)
    if (req.query.time) {
      const timeVal = req.query.time.trim();
      const match = timeVal.match(/^(\d+)(m|h|d)$/);
      if (match) {
        const amount = parseInt(match[1], 10);
        const unit = match[2];
        let ms = 0;
        if (unit === 'm') ms = amount * 60 * 1000;
        else if (unit === 'h') ms = amount * 60 * 60 * 1000;
        else if (unit === 'd') ms = amount * 24 * 60 * 60 * 1000;

        const cutoffTime = new Date(Date.now() - ms).toISOString();
        conditions.push("timestamp >= ?");
        params.push(cutoffTime);
      }
    }

    // Count total filtered records
    let countSql = "SELECT COUNT(*) as count FROM alerts";
    if (conditions.length > 0) {
      countSql += " WHERE " + conditions.join(" AND ");
    }
    const countResult = await db.get(countSql, params);
    const total = countResult ? countResult.count : 0;

    // Fetch paginated filtered records
    const offset = (page - 1) * limit;
    let sql = `
      SELECT id, type, severity, message, oxygen, temperature, humidity, timestamp, status, acknowledged, resolved_at 
      FROM alerts
    `;

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY id DESC LIMIT ? OFFSET ?";
    
    const queryParams = [...params, limit, offset];
    const history = await db.all(sql, queryParams);

    return res.json({
      success: true,
      data: history,
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
      error: "Failed to retrieve alert logs from database",
    });
  }
}

/**
 * PATCH /api/alerts/:id/acknowledge
 * Sets acknowledged to true (1) for a specific alert ID
 */
async function acknowledge(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid alert ID. Must be a positive integer.",
      });
    }

    const result = await setAlertAcknowledged(id);
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: `Alert with ID ${id} not found`,
      });
    }

    await insertSystemEvent(
      "ALERT_ACK",
      `Alert ID ${id} acknowledged by control operator`
    );

    return res.json({
      success: true,
      data: { id, message: `Alert ID ${id} acknowledged successfully` }
    });
  } catch (err) {
    console.error("Controller Error (acknowledge):", err);
    return res.status(500).json({
      success: false,
      error: "Failed to acknowledge alert in database",
    });
  }
}

async function exportAlertsCSV(req, res) {
  try {
    const db = getDatabase();
    if (!db) {
      return res.status(503).json({ error: "Database offline" });
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=alerts_export.csv");

    res.write("id,type,severity,message,oxygen,temperature,humidity,timestamp,status,acknowledged,resolved_at\n");

    const alerts = await db.all("SELECT id, type, severity, message, oxygen, temperature, humidity, timestamp, status, acknowledged, resolved_at FROM alerts ORDER BY id ASC");
    
    for (const alert of alerts) {
      const type = alert.type || "";
      const status = alert.status || "";
      const resolvedAt = alert.resolved_at || "";
      const escapedMessage = alert.message ? alert.message.replace(/"/g, '""') : "";
      res.write(`${alert.id},${type},${alert.severity},"${escapedMessage}",${alert.oxygen.toFixed(2)},${alert.temperature.toFixed(1)},${alert.humidity.toFixed(1)},${alert.timestamp},${status},${alert.acknowledged},${resolvedAt}\n`);
    }

    res.end();
  } catch (err) {
    console.error("Controller Error (exportAlertsCSV):", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to export alert logs" });
    }
  }
}

module.exports = {
  getActive,
  getHistory,
  acknowledge,
  exportAlertsCSV,
};
