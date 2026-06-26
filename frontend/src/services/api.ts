const API = "http://localhost:5000";

const unwrap = async (res: Response) => {
  const json = await res.json();
  return json && json.success && json.data !== undefined ? json.data : json;
};

export const getSensorData = async () => {
  const res = await fetch(`${API}/api/sensors`);
  return await unwrap(res);
};

export const getAlerts = async () => {
  const res = await fetch(`${API}/api/alerts`);
  return await unwrap(res);
};

export const getDevices = async () => {
  const res = await fetch(`${API}/api/device`);
  return await unwrap(res);
};

export const getSensorHistory = async () => {
  const res = await fetch(`${API}/api/sensors/history`);
  return await unwrap(res);
};

export const getAlertHistory = async () => {
  const res = await fetch(`${API}/api/alerts/history`);
  return await unwrap(res);
};

export const acknowledgeAlert = async (id: number) => {
  const res = await fetch(`${API}/api/alerts/${id}/acknowledge`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    }
  });
  return await unwrap(res);
};

export const getRecommendations = async () => {
  const res = await fetch(`${API}/api/recommendations`);
  return await res.json();
};

export const getSensorPredictions = async () => {
  const res = await fetch(`${API}/api/sensors/prediction`);
  return await res.json();
};

export const getSystemStats = async () => {
  const res = await fetch(`${API}/api/stats`);
  return await res.json();
};

export const getSystemHealth = async () => {
  const res = await fetch(`${API}/api/system/health`);
  return await unwrap(res);
};

export const getSystemEvents = async () => {
  const res = await fetch(`${API}/api/system/events`);
  return await unwrap(res);
};
