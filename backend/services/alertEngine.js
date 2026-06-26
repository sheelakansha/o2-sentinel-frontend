function generateAlerts(sensorData) {
  const alerts = [];

  // Oxygen Alerts
  if (sensorData.oxygen < 19.5) {
    alerts.push({
      type: "oxygen",
      severity: "critical",
      title: "Critical Oxygen Level",
      message: "Oxygen concentration is below 19.5%. Immediate action required.",
      recommendation: "Increase ventilation immediately.",
      timestamp: new Date().toISOString()
    });
  } else if (sensorData.oxygen < 20.0) {
    alerts.push({
      type: "oxygen",
      severity: "warning",
      title: "Low Oxygen Warning",
      message: "Oxygen concentration is falling.",
      recommendation: "Monitor oxygen closely.",
      timestamp: new Date().toISOString()
    });
  }

  // Temperature Alerts
  if (sensorData.temperature > 40) {
    alerts.push({
      type: "temperature",
      severity: "critical",
      title: "Critical Temperature",
      message: "Temperature exceeded 40°C.",
      recommendation: "Activate cooling system immediately.",
      timestamp: new Date().toISOString()
    });
  } else if (sensorData.temperature > 35) {
    alerts.push({
      type: "temperature",
      severity: "warning",
      title: "High Temperature",
      message: "Temperature is above safe range.",
      recommendation: "Check ventilation.",
      timestamp: new Date().toISOString()
    });
  }

  // Humidity Alerts
  if (sensorData.humidity > 85) {
    alerts.push({
      type: "humidity",
      severity: "critical",
      title: "Critical Humidity",
      message: "Humidity exceeded 85%.",
      recommendation: "Reduce moisture immediately.",
      timestamp: new Date().toISOString()
    });
  } else if (sensorData.humidity > 75) {
    alerts.push({
      type: "humidity",
      severity: "warning",
      title: "High Humidity",
      message: "Humidity is increasing.",
      recommendation: "Monitor humidity levels.",
      timestamp: new Date().toISOString()
    });
  }

  return alerts;
}

module.exports = { generateAlerts };