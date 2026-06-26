const { getSensorData } = require("./sensorSimulator");
const { generateAlerts } = require("./alertEngine");
const { 
  insertSensorReading, 
  insertAlertLog, 
  fetchAlertByActiveType, 
  resolveAlertByType,
  insertSystemEvent
} = require("../models/database");

let intervalId = null;

// The types of alert boundaries we evaluate
const ALERT_TYPES = ["oxygen", "temperature", "humidity"];

/**
 * Starts the background polling interval. Evaluates thresholds, deduplicates, 
 * and auto-resolves alerts every 5 seconds.
 */
function startLogging() {
  if (intervalId) return;

  console.log("📟 Background Telemetry Logging Service: Active (Interval: 5s)");

  intervalId = setInterval(async () => {
    try {
      const currentReading = getSensorData();
      
      // 1. Log the current metrics point in SQLite
      await insertSensorReading(currentReading);

      // 2. Fetch any triggered alerts for this metrics point
      const triggeredAlerts = generateAlerts(currentReading);

      // 3. Process alert state machine for each metric type
      for (const type of ALERT_TYPES) {
        const triggered = triggeredAlerts.find(a => a.type === type);
        const existingActiveAlert = await fetchAlertByActiveType(type);

        if (triggered) {
          // Condition breached!
          if (!existingActiveAlert) {
            // Case A: Alert triggered and no active log exists yet -> Insert new active log
            await insertAlertLog({
              type: triggered.type,
              severity: triggered.severity,
              message: triggered.message,
              oxygen: currentReading.oxygen,
              temperature: currentReading.temperature,
              humidity: currentReading.humidity,
              timestamp: triggered.timestamp || new Date().toISOString()
            });
            await insertSystemEvent(
              "ALERT_TRIGGER", 
              `Breach detected on ${type.toUpperCase()} loop: ${triggered.message}`
            );
            console.log(`⚠️ Alert [${triggered.type.toUpperCase()}] triggered and logged.`);
          }
          // Case B: Alert triggered but one is already active -> Do not write duplicates
        } else {
          // Condition nominal (safe limits)
          if (existingActiveAlert) {
            // Case C: No alert triggered, but one is active in DB -> Auto-resolve it
            const resolvedAt = new Date().toISOString();
            await resolveAlertByType(type, resolvedAt);
            await insertSystemEvent(
              "ALERT_RESOLUTION", 
              `Metrics returned to nominal on ${type.toUpperCase()} loop. Threat cleared.`
            );
            console.log(`✅ Alert [${type.toUpperCase()}] resolved and logged.`);
          }
        }
      }

    } catch (err) {
      console.error("❌ Background Telemetry Logging Service Error:", err.message);
    }
  }, 5000);
}

/**
 * Stops the background logging interval
 */
function stopLogging() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("📟 Background Telemetry Logging Service: Terminated");
  }
}

module.exports = {
  startLogging,
  stopLogging,
};
