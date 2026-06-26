import React, { useState, useEffect } from 'react';
import StatusCard from './dashboard/components/StatusCard';
import TrendChart from './dashboard/components/TrendChart';
import PredictionChart from './dashboard/components/PredictionChart';
import Loader from './dashboard/components/Loader';

import {
  getSensorData,
  getDevices,
  getSensorHistory,
  getAlerts,
  getAlertHistory,
  acknowledgeAlert,
  getRecommendations,
  getSensorPredictions,
  getSystemStats,
  getSystemHealth,
  getSystemEvents,
} from "./services/api";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [systemTime, setSystemTime] = useState<Date>(new Date());
  
  // Telemetry simulation states (Atmospheric O2 values, standard temp, humidity)
  const [oxygen, setOxygen] = useState(20.8);
  const [temperature, setTemperature] = useState(24.5);
  const [humidity, setHumidity] = useState(48.2);
  const [mockAnomaly, setMockAnomaly] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<{ status: string; battery: string; lastUpdated: string } | null>(null);

  // Telemetry history states for live graphing (pre-populated with realistic atmospheric values)
  const [oxygenHistory, setOxygenHistory] = useState<number[]>(() => 
    Array.from({ length: 15 }, () => 20.7 + Math.random() * 0.2)
  );
  const [tempHistory, setTempHistory] = useState<number[]>(() => 
    Array.from({ length: 15 }, () => 24.1 + Math.random() * 0.5)
  );
  const [humidityHistory, setHumidityHistory] = useState<number[]>(() => 
    Array.from({ length: 15 }, () => 47.5 + Math.random() * 0.9)
  );

  // Load initial database history logs on startup
  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      try {
        const historyData = await getSensorHistory();
        if (active && Array.isArray(historyData) && historyData.length > 0) {
          const o2Vals = historyData.map((row: any) => row.oxygen);
          const tempVals = historyData.map((row: any) => row.temperature);
          const humVals = historyData.map((row: any) => row.humidity);

          // Ensure history arrays are padded to 15 values for visual consistency
          const padArray = (arr: number[], fallbackVal: number) => {
            const padSize = 15 - arr.length;
            if (padSize > 0) {
              const padding = Array.from({ length: padSize }, () => fallbackVal);
              return [...padding, ...arr];
            }
            return arr;
          };

          setOxygenHistory(padArray(o2Vals, 20.8));
          setTempHistory(padArray(tempVals, 24.5));
          setHumidityHistory(padArray(humVals, 48.2));
        }
      } catch (err) {
        console.error("Failed to load database history log:", err);
      }
    };
    loadHistory();
    return () => {
      active = false;
    };
  }, []);

  // Fetch real-time data from backend when not simulating an anomaly
  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      if (!mockAnomaly) {
        try {
          const sensorData = await getSensorData();
          if (active) {
            setOxygen(sensorData.oxygen);
            setTemperature(sensorData.temperature);
            setHumidity(sensorData.humidity);
            setSystemTime(new Date(sensorData.timestamp));
          }
        } catch (err) {
          // Fallback to slight random drift around nominal 20.8%
          if (active) {
            setOxygen(prev => Math.min(21.1, Math.max(20.5, prev + (Math.random() - 0.5) * 0.04)));
            setTemperature(prev => Math.min(26.0, Math.max(23.0, prev + (Math.random() - 0.5) * 0.1)));
            setHumidity(prev => Math.min(52.0, Math.max(45.0, prev + (Math.random() - 0.5) * 0.2)));
            setSystemTime(new Date());
          }
        }
      }

      try {
        const deviceData = await getDevices();
        if (active) {
          setDeviceStatus(deviceData);
        }
      } catch (err) {
        if (active) {
          setDeviceStatus({ status: "Offline", battery: "--%", lastUpdated: new Date().toISOString() });
        }
      }

      try {
        const activeAlerts = await getAlerts();
        if (active) {
          setAlerts(activeAlerts);
        }
      } catch (err) {
        // Fallback
      }

      try {
        const historyAlerts = await getAlertHistory();
        if (active) {
          setAlertsHistory(historyAlerts);
        }
      } catch (err) {
        // Fallback
      }

      try {
        const recsData = await getRecommendations();
        if (active && recsData && recsData.success) {
          setRecommendations(recsData.recommendations || []);
        }
      } catch (err) {
        // Fallback
      }

      try {
        const predData = await getSensorPredictions();
        if (active && predData && predData.success) {
          setPredO2_30m(predData.pred30);
          setPredO2_1h(predData.pred1h);
          setO2Projection(predData.projection || []);
        }
      } catch (err) {
        // Fallback
      }

      try {
        const statsData = await getSystemStats();
        if (active && statsData && statsData.success) {
          setStats(statsData.stats);
        }
      } catch (err) {
        // Fallback
      }

      try {
        const healthData = await getSystemHealth();
        if (active && healthData) {
          setHealth(healthData);
        }
      } catch (err) {
        // Fallback
      }

      try {
        const eventsData = await getSystemEvents();
        if (active && eventsData) {
          setEvents(eventsData);
        }
      } catch (err) {
        // Fallback
      }
    };

    fetchData();
    const pollInterval = setInterval(fetchData, 2000);

    return () => {
      active = false;
      clearInterval(pollInterval);
    };
  }, [mockAnomaly]);

  // Telemetry drift simulator (active only when Anomaly Switch is toggled ON)
  useEffect(() => {
    if (!mockAnomaly) return;

    const simulationInterval = setInterval(() => {
      setOxygen(prev => Math.max(18.5, prev - 0.08));
      setTemperature(prev => Math.min(34.5, prev + 0.4));
      setHumidity(prev => Math.min(62.0, prev + 0.6));
      setSystemTime(new Date());
    }, 1000);

    return () => clearInterval(simulationInterval);
  }, [mockAnomaly]);

  // Sync historical buffers
  useEffect(() => {
    setOxygenHistory(prev => [...prev.slice(1), oxygen]);
    setTempHistory(prev => [...prev.slice(1), temperature]);
    setHumidityHistory(prev => [...prev.slice(1), humidity]);
  }, [oxygen, temperature, humidity]);

  // Determine individual status flags
  const getOxygenStatus = (): 'normal' | 'warning' | 'danger' => {
    if (oxygen >= 19.5 && oxygen <= 23.5) return 'normal';
    return 'danger';
  };

  const getTemperatureStatus = (): 'normal' | 'warning' | 'danger' => {
    if (temperature <= 28) return 'normal';
    if (temperature <= 32) return 'warning';
    return 'danger';
  };

  const getHumidityStatus = (): 'normal' | 'warning' | 'danger' => {
    if (humidity <= 55) return 'normal';
    if (humidity <= 60) return 'warning';
    return 'danger';
  };

  // Determine aggregate overall safety status
  const getOverallStatus = () => {
    const o2 = getOxygenStatus();
    const temp = getTemperatureStatus();
    const hum = getHumidityStatus();

    if (o2 === 'danger' || temp === 'danger' || hum === 'danger') return 'danger';
    if (o2 === 'warning' || temp === 'warning' || hum === 'warning') return 'warning';
    return 'normal';
  };

  const overallStatus = getOverallStatus();

  const [predO2_30m, setPredO2_30m] = useState<number>(20.7);
  const [predO2_1h, setPredO2_1h] = useState<number>(20.5);
  const [o2Projection, setO2Projection] = useState<number[]>(() => 
    Array.from({ length: 15 }, () => 20.7 + (Math.random() - 0.5) * 0.1)
  );

  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertsHistory, setAlertsHistory] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [stats, setStats] = useState<any | null>(null);
  const [health, setHealth] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  const handleAcknowledgeAlert = async (id: number) => {
    try {
      await acknowledgeAlert(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
      setAlertsHistory(prev => prev.map(a => a.id === id ? { ...a, acknowledged: 1 } : a));
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    }
  };

  const getActiveAlert = () => {
    if (alerts && alerts.length > 0) {
      const active = alerts.find(a => a.acknowledged === 0);
      if (active) {
        return {
          id: active.id,
          level: active.severity === 'critical' ? 'danger' : 'warning',
          message: active.message
        };
      }
    }
    return null;
  };

  const activeAlert = getActiveAlert();

  const getTrendColor = (status: 'normal' | 'warning' | 'danger') => {
    if (status === 'normal') return 'var(--drdo-cyan)';
    if (status === 'warning') return 'var(--drdo-orange)';
    return 'var(--drdo-red)';
  };

  const oxygenStatus = getOxygenStatus();

  return (
    <div className="app-layout">
      {loading && <Loader onComplete={() => setLoading(false)} />}
      
      {/* DRDO Top Tactical HUD Bar */}
      <div className="tactical-hud-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Custom SVG logo representing a military shield/wings logo */}
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--drdo-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 5px var(--drdo-cyan-glow))' }}>
            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
            <line x1="12" y1="2" x2="12" y2="22" />
            <polyline points="12 12.5 17 9 17 15" />
            <polyline points="12 12.5 7 9 7 15" />
          </svg>
          <div>
            <div style={{ fontSize: '0.6rem', color: 'var(--drdo-text-secondary)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Ministry of Defence • Govt. of India
            </div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '2px 0 0 0', letterSpacing: '0.04em', color: 'var(--drdo-text-primary)' }}>
              DEFENCE BIOENGINEERING AND ELECTROMEDICAL LABORATORY (DEBEL)
            </h1>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--drdo-text-tertiary)', letterSpacing: '0.08em', fontWeight: 700 }}>
              MISSION CLOCK (IST)
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--drdo-text-secondary)', fontWeight: 700, fontFamily: 'var(--font-digital)', letterSpacing: '0.05em' }}>
              {systemTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: 'rgba(0, 240, 255, 0.05)', 
            padding: '5px 12px', 
            border: '1px solid var(--drdo-border)',
            borderRadius: '2px'
          }}>
            <span 
              className="beacon-dot beacon-pulse" 
              style={{ 
                '--status-color': deviceStatus?.status === 'Online' ? 'var(--drdo-cyan)' : 'var(--drdo-red)', 
                width: '6px', 
                height: '6px' 
              } as React.CSSProperties} 
            />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: deviceStatus?.status === 'Online' ? 'var(--drdo-cyan)' : 'var(--drdo-red)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              SYS: {deviceStatus?.status || 'OFFLINE'} | BAT: {deviceStatus?.battery || '--'}
            </span>
          </div>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: 'rgba(0, 240, 255, 0.05)', 
            padding: '5px 12px', 
            border: '1px solid var(--drdo-border)',
            borderRadius: '2px'
          }}>
            <span 
              className="beacon-dot beacon-pulse" 
              style={{ 
                '--status-color': health?.status === 'HEALTHY' ? 'var(--drdo-green)' : 'var(--drdo-red)', 
                width: '6px', 
                height: '6px' 
              } as React.CSSProperties} 
            />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: health?.status === 'HEALTHY' ? 'var(--drdo-cyan)' : 'var(--drdo-red)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              SRV: {health ? `${health.status} (${(health.database.size / 1024).toFixed(0)}KB)` : 'OFFLINE'} | MEM: {health ? `${(health.memory.heapUsed / 1024 / 1024).toFixed(1)}MB` : '--MB'} | WRK: {health?.worker.active ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
        </div>
      </div>

      <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px 16px' }}>
        
        {/* Alert Banner */}
        {activeAlert && (
          <div className={`alert-banner alert-${activeAlert.level}`} style={{
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.82rem',
            fontWeight: 700,
            letterSpacing: '0.01em',
            borderLeft: `4px solid ${activeAlert.level === 'danger' ? 'var(--drdo-red)' : 'var(--drdo-orange)'}`
          }}>
            <span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 0 4px rgba(255,61,0,0.5))' }}>
              {activeAlert.level === 'danger' ? '🚨' : '⚠️'}
            </span>
            <span style={{ flex: 1 }}>{activeAlert.message}</span>
            <button 
              onClick={() => handleAcknowledgeAlert(activeAlert.id)}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid var(--drdo-border)',
                color: '#ffffff',
                padding: '4px 10px',
                borderRadius: '2px',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.04em'
              }}
            >
              ACKNOWLEDGE
            </button>
          </div>
        )}

        {/* Dashboard Title Section */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          borderBottom: '1px solid var(--drdo-separator)', 
          paddingBottom: '12px',
          marginTop: '4px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="drdo-badge">TECHNICAL DEMONSTRATOR</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--drdo-text-secondary)', fontWeight: 600, letterSpacing: '0.04em' }}>
                LSSD CHAMBER TESTBED
              </span>
            </div>
            <h2 style={{ 
              fontSize: '1.6rem', 
              fontWeight: 800, 
              margin: '8px 0 0 0', 
              letterSpacing: '-0.02em',
              color: 'var(--drdo-text-primary)',
              textTransform: 'uppercase'
            }}>
              O₂ Sentinel – Environmental Monitoring Dashboard
            </h2>
          </div>
        </div>

        {/* Primary Dashboard Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          
          {/* Main Focus: Atmospheric Oxygen Level Display */}
          <div className="large-oxygen-card">
            <span style={{ 
              fontSize: '0.75rem', 
              fontWeight: 800, 
              color: 'var(--drdo-text-secondary)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.12em' 
            }}>
              ATMOSPHERIC OXYGEN CONCENTRATION
            </span>
            <div className={`large-oxygen-value ${oxygenStatus === 'danger' ? 'status-danger' : ''}`}>
              {oxygen.toFixed(2)}%
            </div>
            <div style={{ marginBottom: '14px' }}>
              <span className={`status-badge-pill ${oxygenStatus === 'danger' ? 'status-danger' : 'status-normal'}`}>
                <span className="beacon-dot beacon-pulse" style={{ 
                  '--status-color': oxygenStatus === 'danger' ? 'var(--drdo-red)' : 'var(--drdo-green)',
                  width: '6px',
                  height: '6px'
                } as React.CSSProperties} />
                {oxygenStatus === 'danger' ? 'CRITICAL ABNORMAL' : 'NOMINAL SAFE'}
              </span>
            </div>
            <span style={{ 
              fontSize: '0.72rem', 
              color: 'var(--drdo-text-tertiary)', 
              fontWeight: 700,
              letterSpacing: '0.06em'
            }}>
              OPERATIONAL MISSION LIMITS: 19.5% - 23.5%
            </span>
          </div>

          {/* Secondary Environmental Metrics */}
          <div className="metrics-row-grid">
            <StatusCard 
              title="Temperature"
              value={temperature.toFixed(1)}
              unit="°C"
              status={getTemperatureStatus()}
              progress={(temperature / 50) * 100}
              subtitle="Chamber Core Temp"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                </svg>
              }
            />

            <StatusCard 
              title="Humidity"
              value={humidity.toFixed(1)}
              unit="%"
              status={getHumidityStatus()}
              progress={humidity}
              subtitle="Relative Saturation"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z" />
                </svg>
              }
            />

            <StatusCard 
              title="Overall Safety Status"
              value={overallStatus === 'normal' ? 'NOMINAL' : 'BREACH'}
              status={overallStatus}
              subtitle={overallStatus === 'normal' ? 'All lifesupport loops secure.' : 'Environmental alert active!'}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              }
            />
          </div>

          {/* Mission Metrics & Alerts Statistical Summary */}
          <div>
            <span className="section-label">MISSION TELEMETRY STATISTICAL ACCUMULATOR</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '8px' }}>
              
              {/* Oxygen Accumulator */}
              <div className="ios-blur-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--drdo-cyan)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  O₂ ACCUMULATOR STATS
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center', marginTop: '4px' }}>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--drdo-text-secondary)', fontWeight: 700 }}>MIN</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--drdo-text-primary)', fontFamily: 'var(--font-digital)' }}>
                      {stats ? `${stats.telemetry.oxygen.min.toFixed(2)}%` : '--'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--drdo-text-secondary)', fontWeight: 700 }}>AVG</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--drdo-cyan)', fontFamily: 'var(--font-digital)' }}>
                      {stats ? `${stats.telemetry.oxygen.avg.toFixed(2)}%` : '--'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--drdo-text-secondary)', fontWeight: 700 }}>MAX</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--drdo-text-primary)', fontFamily: 'var(--font-digital)' }}>
                      {stats ? `${stats.telemetry.oxygen.max.toFixed(2)}%` : '--'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Temperature Accumulator */}
              <div className="ios-blur-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--drdo-cyan)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  TEMP ACCUMULATOR STATS
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center', marginTop: '4px' }}>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--drdo-text-secondary)', fontWeight: 700 }}>MIN</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--drdo-text-primary)', fontFamily: 'var(--font-digital)' }}>
                      {stats ? `${stats.telemetry.temperature.min.toFixed(1)}°C` : '--'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--drdo-text-secondary)', fontWeight: 700 }}>AVG</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--drdo-cyan)', fontFamily: 'var(--font-digital)' }}>
                      {stats ? `${stats.telemetry.temperature.avg.toFixed(1)}°C` : '--'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--drdo-text-secondary)', fontWeight: 700 }}>MAX</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--drdo-text-primary)', fontFamily: 'var(--font-digital)' }}>
                      {stats ? `${stats.telemetry.temperature.max.toFixed(1)}°C` : '--'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Humidity Accumulator */}
              <div className="ios-blur-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--drdo-cyan)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  HUMIDITY ACCUMULATOR STATS
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center', marginTop: '4px' }}>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--drdo-text-secondary)', fontWeight: 700 }}>MIN</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--drdo-text-primary)', fontFamily: 'var(--font-digital)' }}>
                      {stats ? `${stats.telemetry.humidity.min.toFixed(1)}%` : '--'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--drdo-text-secondary)', fontWeight: 700 }}>AVG</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--drdo-cyan)', fontFamily: 'var(--font-digital)' }}>
                      {stats ? `${stats.telemetry.humidity.avg.toFixed(1)}%` : '--'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--drdo-text-secondary)', fontWeight: 700 }}>MAX</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--drdo-text-primary)', fontFamily: 'var(--font-digital)' }}>
                      {stats ? `${stats.telemetry.humidity.max.toFixed(1)}%` : '--'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Incident Registry Stats */}
              <div className="ios-blur-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--drdo-cyan)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  INCIDENT LOG TOTALS
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px', textAlign: 'center', marginTop: '4px' }}>
                  <div>
                    <div style={{ fontSize: '0.52rem', color: 'var(--drdo-text-secondary)', fontWeight: 700 }}>TOTAL</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--drdo-text-primary)', fontFamily: 'var(--font-digital)' }}>
                      {stats ? stats.alerts.total : '--'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.52rem', color: 'var(--drdo-red)', fontWeight: 700 }}>ACTIVE</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--drdo-red)', fontFamily: 'var(--font-digital)' }}>
                      {stats ? stats.alerts.active : '--'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.52rem', color: 'var(--drdo-green)', fontWeight: 700 }}>RESOLVED</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--drdo-green)', fontFamily: 'var(--font-digital)' }}>
                      {stats ? stats.alerts.resolved : '--'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.52rem', color: 'var(--drdo-orange)', fontWeight: 700 }}>ACK</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--drdo-orange)', fontFamily: 'var(--font-digital)' }}>
                      {stats ? stats.alerts.acknowledged : '--'}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <hr className="layout-divider" />

          {/* Forecasting Panel */}
          <div>
            <span className="section-label">OXYGEN FORWARD PROJECTION MODEL</span>
            <div className="forecast-section-grid">
              
              {/* Forecast Info Left Panel */}
              <div className="forecast-stats-box">
                <div className="forecast-stat-card">
                  <span style={{ fontSize: '0.72rem', color: 'var(--drdo-text-secondary)', fontWeight: 700 }}>CURRENT BASELINE</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--drdo-text-primary)', fontFamily: 'var(--font-digital)' }}>
                    {oxygen.toFixed(2)}%
                  </span>
                </div>
                
                <div className="forecast-stat-card">
                  <span style={{ fontSize: '0.72rem', color: 'var(--drdo-text-secondary)', fontWeight: 700 }}>+30 MIN PROJECTION</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--drdo-cyan)', fontFamily: 'var(--font-digital)' }}>
                    {predO2_30m.toFixed(2)}%
                  </span>
                </div>
                
                <div className="forecast-stat-card">
                  <span style={{ fontSize: '0.72rem', color: 'var(--drdo-text-secondary)', fontWeight: 700 }}>+60 MIN PROJECTION</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--drdo-cyan)', fontFamily: 'var(--font-digital)' }}>
                    {predO2_1h.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Advanced Projections SVG Chart */}
              <PredictionChart 
                title="Telemetry Projection Sweep"
                history={oxygenHistory}
                projection={o2Projection}
                min={18}
                max={25}
                color="var(--drdo-cyan)"
                unit="%"
              />
            </div>
          </div>

          <hr className="layout-divider" />

          {/* Historical Trends Panel */}
          <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="section-label" style={{ margin: 0 }}>ATMOSPHERIC telemetry SWEEPS</span>
            <a 
              href="http://localhost:5000/api/sensors/export" 
              download
              style={{
                background: 'rgba(0, 240, 255, 0.08)',
                border: '1px solid var(--drdo-cyan)',
                color: 'var(--drdo-cyan)',
                padding: '2px 8px',
                borderRadius: '2px',
                fontSize: '0.62rem',
                fontWeight: 700,
                textDecoration: 'none',
                letterSpacing: '0.04em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              EXPORT TELEMETRY CSV
            </a>
          </div>
            <div className="trends-section-grid">
              <TrendChart 
                title="OXYGEN SENSOR READINGS"
                subtitle="Electrochemical Sweep - Last 15m"
                data={oxygenHistory}
                min={18}
                max={25}
                color="var(--drdo-cyan)"
                unit="%"
                currentValue={oxygen.toFixed(2)}
                safeMin={19.5}
                safeMax={23.5}
              />

              <TrendChart 
                title="TEMPERATURE TRACK"
                subtitle="Chamber Core Temp Sweep - Last 15m"
                data={tempHistory}
                min={15}
                max={45}
                color={getTrendColor(getTemperatureStatus())}
                unit="°C"
                currentValue={temperature.toFixed(1)}
                safeMin={15}
                safeMax={28}
              />

              <TrendChart 
                title="HUMIDITY TRACK"
                subtitle="Chamber RH Saturation Sweep - Last 15m"
                data={humidityHistory}
                min={20}
                max={80}
                color={getTrendColor(getHumidityStatus())}
                unit="%"
                currentValue={humidity.toFixed(1)}
                safeMin={20}
                safeMax={55}
              />
            </div>
          </div>

          <hr className="layout-divider" />

          {/* Tactical Simulator and Log console */}
          <div>
            <span className="section-label">CHAMBER DRIFT INJECTOR & DIAGNOSTICS</span>
            <div className="ios-blur-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', padding: '20px' }}>
              
              {/* Drift Simulator Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--drdo-cyan)', margin: '0 0 4px 0', letterSpacing: '0.06em' }}>
                  DRIFT TRIGGER CONSOLE
                </h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: '12px 16px', borderRadius: '4px', border: '1px solid var(--drdo-border)' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--drdo-text-primary)' }}>
                    INJECT HYPOXIA / DRIFT ANOMALY
                  </span>
                  <label className="ios-switch">
                    <input 
                      type="checkbox" 
                      checked={mockAnomaly} 
                      onChange={(e) => setMockAnomaly(e.target.checked)} 
                    />
                    <span className="ios-slider"></span>
                  </label>
                </div>

                <div style={{ fontSize: '0.72rem', color: 'var(--drdo-text-tertiary)', lineHeight: '1.5', fontWeight: 500 }}>
                  Injects artificial atmosphere chamber leakage. Triggers a slow decay of oxygen concentration down to 18.5% and a corresponding temperature surge to stress-test warning sirens and hypoxia safety triggers.
                </div>
              </div>

              {/* System Log Terminal Console */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 4px 0' }}>
                  <h3 style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--drdo-cyan)', margin: 0, letterSpacing: '0.06em' }}>
                    LSSD SECURE ACTIVITY CONSOLE
                  </h3>
                  <a 
                    href="http://localhost:5000/api/alerts/export" 
                    download
                    style={{
                      background: 'rgba(0, 240, 255, 0.08)',
                      border: '1px solid var(--drdo-cyan)',
                      color: 'var(--drdo-cyan)',
                      padding: '2px 8px',
                      borderRadius: '2px',
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      letterSpacing: '0.04em',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    EXPORT ALERTS CSV
                  </a>
                </div>
                
                <div style={{
                  background: '#04070e',
                  border: '1px solid var(--drdo-border)',
                  borderRadius: '4px',
                  padding: '12px 16px',
                  fontFamily: 'var(--font-digital)',
                  fontSize: '0.72rem',
                  color: '#00e676',
                  height: '115px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.8)'
                }}>
                  {alertsHistory.length === 0 ? (
                    <div style={{ color: 'var(--drdo-text-tertiary)' }}>NO ALERTS RECORDED IN HISTORICAL LOG.</div>
                  ) : (
                    alertsHistory.map((alert) => {
                      const timeStr = new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      const isAck = alert.acknowledged === 1;
                      const isResolved = alert.status === 'Resolved';
                      const alertColor = alert.severity === 'critical' ? 'var(--drdo-red)' : 'var(--drdo-orange)';
                      const statusText = alert.status || (isAck ? 'Acknowledged' : 'Active');
                      const statusColor = isResolved ? 'var(--drdo-green)' : (isAck ? 'var(--drdo-text-tertiary)' : alertColor);
                      return (
                        <div 
                          key={alert.id} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            padding: '3px 0', 
                            borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                            opacity: (isAck || isResolved) ? 0.6 : 1,
                            textDecoration: isAck ? 'line-through' : 'none'
                          }}
                        >
                          <span style={{ lineBreak: 'anywhere' }}>
                            <span style={{ color: 'var(--drdo-text-tertiary)' }}>[{timeStr}]</span>{' '}
                            <span style={{ color: alertColor, fontWeight: 700 }}>[{alert.severity.toUpperCase()}]</span>{' '}
                            <span style={{ color: statusColor, fontWeight: 800 }}>[{statusText.toUpperCase()}]</span>{' '}
                            {alert.message} (O₂: {alert.oxygen.toFixed(2)}% | T: {alert.temperature.toFixed(1)}°C | H: {alert.humidity.toFixed(0)}%)
                          </span>
                          {!isAck && (
                            <button
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                              style={{
                                background: 'transparent',
                                border: '1px solid var(--drdo-cyan)',
                                color: 'var(--drdo-cyan)',
                                padding: '1px 6px',
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                borderRadius: '2px'
                              }}
                            >
                              ACK
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Decision Support Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--drdo-cyan)', margin: '0 0 4px 0', letterSpacing: '0.06em' }}>
                  DECISION SUPPORT RECOMMENDATIONS
                </h3>
                
                <div style={{
                  background: '#04070e',
                  border: '1px solid var(--drdo-border)',
                  borderRadius: '4px',
                  padding: '12px 16px',
                  fontSize: '0.72rem',
                  color: 'var(--drdo-text-secondary)',
                  height: '115px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.8)'
                }}>
                  {recommendations.length === 0 ? (
                    <div style={{ color: 'var(--drdo-text-tertiary)', fontStyle: 'italic' }}>NO ACTIVE THREATS. VENTILATION & LIFE SUPPORT NORMAL.</div>
                  ) : (
                    recommendations.map((rec, idx) => {
                      const recColor = rec.priority === 'high' ? 'var(--drdo-red)' : rec.priority === 'medium' ? 'var(--drdo-orange)' : 'var(--drdo-cyan)';
                      return (
                        <div key={idx} style={{ 
                          display: 'flex', 
                          alignItems: 'flex-start', 
                          gap: '8px', 
                          paddingBottom: '6px', 
                          borderBottom: '1px solid rgba(255, 255, 255, 0.02)' 
                        }}>
                          <span style={{ 
                            background: `rgba(${rec.priority === 'high' ? '255,59,48' : rec.priority === 'medium' ? '255,159,10' : '10,132,255'}, 0.1)`, 
                            color: recColor, 
                            border: `1px solid ${recColor}`,
                            fontSize: '0.55rem', 
                            fontWeight: 900, 
                            padding: '1px 4px', 
                            borderRadius: '2px', 
                            textTransform: 'uppercase',
                            marginTop: '2px'
                          }}>
                            {rec.priority}
                          </span>
                          <span style={{ flex: 1, color: 'var(--drdo-text-primary)', lineHeight: '1.3' }}>
                            {rec.text}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Event Timeline Feed Console */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--drdo-cyan)', margin: '0 0 4px 0', letterSpacing: '0.06em' }}>
                  LSSD EVENTS TIMELINE FEED
                </h3>
                
                <div style={{
                  background: '#04070e',
                  border: '1px solid var(--drdo-border)',
                  borderRadius: '4px',
                  padding: '12px 16px',
                  fontFamily: 'var(--font-digital)',
                  fontSize: '0.72rem',
                  color: '#00e676',
                  height: '115px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.8)'
                }}>
                  {events.length === 0 ? (
                    <div style={{ color: 'var(--drdo-text-tertiary)' }}>NO SYSTEM EVENTS LOGGED.</div>
                  ) : (
                    events.map((evt) => {
                      const timeStr = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      let evtColor = 'var(--drdo-cyan)';
                      if (evt.event === 'ALERT_TRIGGER') evtColor = 'var(--drdo-red)';
                      else if (evt.event === 'ALERT_RESOLUTION') evtColor = 'var(--drdo-green)';
                      else if (evt.event === 'ALERT_ACK') evtColor = 'var(--drdo-orange)';
                      
                      return (
                        <div key={evt.id} style={{ display: 'flex', gap: '8px', paddingBottom: '3px', borderBottom: '1px solid rgba(255,255,255,0.01)' }}>
                          <span style={{ color: 'var(--drdo-text-tertiary)' }}>[{timeStr}]</span>
                          <span style={{ color: evtColor, fontWeight: 700 }}>[{evt.event}]</span>
                          <span style={{ color: 'var(--drdo-text-secondary)' }}>{evt.details}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              
            </div>
          </div>

        </div>

        {/* Tactical Footer */}
        <footer style={{ 
          marginTop: '30px', 
          padding: '20px 0 10px 0', 
          textAlign: 'center', 
          color: 'var(--drdo-text-tertiary)', 
          fontSize: '0.72rem', 
          borderTop: '1px solid var(--drdo-separator)',
          fontWeight: 600,
          letterSpacing: '0.08em'
        }}>
          <p>O₂ SENTINEL • ENVIRONMENT SECURITY SYSTEM • DRDO DEBEL LSSD © 2026</p>
        </footer>
      </div>
    </div>
  );
}
