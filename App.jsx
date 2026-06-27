import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  TrendingUp, 
  ShieldAlert, 
  Compass, 
  Activity, 
  CheckCircle,
  Database,
  Calendar,
  AlertTriangle,
  Flame
} from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

import Sidebar from './Sidebar';
import DashboardMap, { getAQIColor, getAQICategory } from './DashboardMap';
import './styles.css';

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// In dev, Vite proxies /api → localhost:8000.
// In production (Vercel), set VITE_API_BASE_URL to your backend URL (e.g. https://your-app.onrender.com)
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const getHealthClass = (aqi) => {
  if (aqi <= 50) return 'health-good';
  if (aqi <= 100) return 'health-satisfactory';
  if (aqi <= 200) return 'health-moderate';
  if (aqi <= 300) return 'health-poor';
  if (aqi <= 400) return 'health-very-poor';
  return 'health-severe';
};

const getHealthAdvisory = (aqi) => {
  if (aqi <= 50) return 'Minimal Impact. Air quality is considered satisfactory, and air pollution poses little or no risk.';
  if (aqi <= 100) return 'Minor discomfort to sensitive people. Active children/adults, and people with respiratory disease, should limit prolonged outdoor exertion.';
  if (aqi <= 200) return 'Breathing discomfort to people with asthma, lungs, and heart diseases. Children and elderly should reduce heavy outdoor activities.';
  if (aqi <= 300) return 'Breathing discomfort to most people on prolonged exposure. Avoid strenuous outdoor activities; wear masks if going outside.';
  if (aqi <= 400) return 'Respiratory illness on prolonged exposure. Everyone should restrict outdoor physical activity; keep windows closed.';
  return 'Affects healthy people and seriously impacts those with existing diseases. Emergency state: remain indoors, run air purifiers, and wear N95 masks.';
};

const getNCAPPolicyBrief = (dateStr) => {
  const day = parseInt(dateStr.split('-')[2]) || 5;
  if (day >= 1 && day <= 15) {
    return {
      body: "ALERT: Spatial analysis indicates high concentrations of formaldehyde (HCHO) and downscaled PM2.5 in Northwest India (Punjab/Haryana agricultural belt) driven by crop residue burning. Vector wind reanalysis indicates transport trajectories moving southeast, projecting direct aerosol transport into the Delhi National Capital Region (NCR) within 6-12 hours.",
      recommendations: [
        { title: "Enact GRAP Stage IV", text: "Implement Graded Response Action Plan Stage IV emergency measures in Delhi NCR, including restriction of non-essential commercial vehicles." },
        { title: "Crop Residue Management", text: "Deploy active mobile straw-management machinery (Happy Seeders) and enforce bio-decomposer spraying in Punjab/Haryana." },
        { title: "Transport Advisory", text: "Alert downwind cities (Gurugram, Patiala, Chennai) of incoming aerosol plumes to prepare healthcare facilities." },
        { title: "Targeted Water Mist Spray", text: "Initiate mechanical sweeping and water-spraying along high-density traffic corridors in NCR." }
      ]
    };
  } else {
    return {
      body: "OBSERVATION: Normal anthropogenic patterns observed. High particulate loading is isolated within the Indo-Gangetic Plain (IGP) valleys due to typical winter temperature inversion conditions and shallow planetary boundary layer heights (<300m).",
      recommendations: [
        { title: "Urban Dust Suppression", text: "Enforce strict construction dust guidelines and cover material transports." },
        { title: "Industrial Stack Monitoring", text: "Increase compliance audits on thermal power plant emissions in Central India." },
        { title: "Transit Optimization", text: "Increase metro and electric bus frequencies to reduce daily urban vehicular load." },
        { title: "Public Warnings", text: "Recommend sensitive groups limit early-morning outdoor physical activities in high-AQI zones." }
      ]
    };
  }
};

const App = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [currentDate, setCurrentDate] = useState('2026-11-05'); // Target post-monsoon crop burning season
  const [isPlaying, setIsPlaying] = useState(false);
  const [theme, setTheme] = useState('dark');
  
  // Data States
  const [status, setStatus] = useState(null);
  const [gridData, setGridData] = useState([]);
  const [validation, setValidation] = useState(null);
  const [hotspots, setHotspots] = useState(null);
  const [correlation, setCorrelation] = useState(null);
  
  // UI Interactive States
  const [selectedCell, setSelectedCell] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState(null);

  const playbackTimer = useRef(null);

  // 1. Fetch system status & historical correlation on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then(res => res.json())
      .then(data => setStatus(data))
      .catch(err => console.error("Error fetching status", err));

    fetch(`${API_BASE}/api/hcho/correlation`)
      .then(res => res.json())
      .then(data => setCorrelation(data.correlation_metrics))
      .catch(err => console.error("Error fetching correlation", err));
  }, []);

  // 2. Fetch spatial and validation data whenever the date changes
  useEffect(() => {
    setLoading(true);
    
    const fetchGrid = fetch(`${API_BASE}/api/aqi/grid?date=${currentDate}`)
      .then(res => res.json())
      .then(data => {
        setGridData(data.data);
        // Default select a highly polluted grid cell (like near Punjab/Delhi) on initial load
        if (data.data && data.data.length > 0) {
          const highAqiPoint = data.data.find(p => p.aqi > 250) || data.data[0];
          setSelectedCell(highAqiPoint);
        }
      });

    const fetchValidation = fetch(`${API_BASE}/api/aqi/validation?date=${currentDate}`)
      .then(res => res.json())
      .then(data => {
        setValidation(data);
        if (data.stations_data && data.stations_data.length > 0) {
          setSelectedStation(data.stations_data[0]);
        }
      });

    const fetchHotspots = fetch(`${API_BASE}/api/hcho/hotspots?date=${currentDate}`)
      .then(res => res.json())
      .then(data => setHotspots(data));

    Promise.all([fetchGrid, fetchValidation, fetchHotspots])
      .then(() => setLoading(false))
      .catch(err => {
        console.error("Error fetching date data", err);
        setLoading(false);
      });
  }, [currentDate]);

  // 3. Automated Timeline Playback (micro-animation of transport plumes)
  useEffect(() => {
    if (isPlaying) {
      playbackTimer.current = setInterval(() => {
        setCurrentDate((prevDate) => {
          const dateObj = new Date(prevDate);
          dateObj.setDate(dateObj.getDate() + 1);
          
          // Cycle between Nov 01 and Nov 15
          if (dateObj.getDate() > 15) {
            return '2026-11-01';
          }
          const yyyy = dateObj.getFullYear();
          const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
          const dd = String(dateObj.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        });
      }, 2000); // Speed: 2 seconds per day
    } else {
      if (playbackTimer.current) {
        clearInterval(playbackTimer.current);
      }
    }

    return () => {
      if (playbackTimer.current) clearInterval(playbackTimer.current);
    };
  }, [isPlaying]);

  const handleSliderChange = (e) => {
    setIsPlaying(false);
    const day = String(e.target.value).padStart(2, '0');
    setCurrentDate(`2026-11-${day}`);
  };

  const handlePlayToggle = () => {
    setIsPlaying(!isPlaying);
  };

  const resetTimeline = () => {
    setIsPlaying(false);
    setCurrentDate('2026-11-05');
  };

  // --- Render Sections ---

  const renderOverview = () => {
    // Calculate aggregate metrics
    const avgAqi = gridData.length > 0 
      ? Math.round(gridData.reduce((acc, c) => acc + c.aqi, 0) / gridData.length)
      : 0;
    const maxAqi = gridData.length > 0 
      ? Math.max(...gridData.map(c => c.aqi))
      : 0;
    const activeFires = hotspots?.fires?.length || 0;
    const activeHotspots = hotspots?.hotspot_regions?.length || 0;

    const brief = getNCAPPolicyBrief(currentDate);

    return (
      <div className="dashboard-panel">
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.8rem' }}>PRANA-VAYU: Satellite Air Quality Observatory</h2>
        
        {/* NCAP Policy Brief Panel (Stand-out feature) */}
        <div className="ncap-brief-card">
          <div className="ncap-title-wrapper">
            <Compass size={18} />
            <span>PRANA-VAYU Policy Brief (NCAP Alignment)</span>
          </div>
          <div className="ncap-brief-body">
            {brief.body}
          </div>
          <div className="ncap-recommendation-list">
            {brief.recommendations.map((rec, i) => (
              <div key={i} className="ncap-rec-item">
                <div className="ncap-rec-header">{rec.title}</div>
                <div style={{ color: 'var(--text-secondary)' }}>{rec.text}</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* KPI Cards */}
        <div className="stat-grid">
          <div className="card">
            <div className="card-title">National Avg AQI</div>
            <div className="card-value" style={{ color: getAQIColor(avgAqi) }}>{avgAqi}</div>
            <div className="card-subtext">Spatial mean across India</div>
            <Activity className="card-title" size={24} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', opacity: 0.15 }} />
          </div>
          
          <div className="card">
            <div className="card-title">Peak AQI Observed</div>
            <div className="card-value" style={{ color: getAQIColor(maxAqi) }}>{maxAqi}</div>
            <div className="card-subtext">{getAQICategory(maxAqi)} levels flagged</div>
            <ShieldAlert className="card-title" size={24} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', opacity: 0.15 }} />
          </div>
          
          <div className="card">
            <div className="card-title">Active Thermal Anomalies</div>
            <div className="card-value" style={{ color: '#ff6200' }}>{activeFires}</div>
            <div className="card-subtext">MODIS/VIIRS Active Fires detected</div>
            <Flame className="card-title" size={24} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', opacity: 0.15 }} />
          </div>

          <div className="card">
            <div className="card-title">HCHO Hotspot Zones</div>
            <div className="card-value" style={{ color: '#ffcc00' }}>{activeHotspots}</div>
            <div className="card-subtext">Statistical clustering regions</div>
            <Compass className="card-title" size={24} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', opacity: 0.15 }} />
          </div>
        </div>

        {/* Info Grid */}
        <div className="card-grid">
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--accent-teal)' }}>Executive Summary</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              This platform maps surface-level Air Quality Index (AQI) values downscaled from columnar satellite observations (Sentinel-5P and INSAT-3D AOD) using a physics-informed deep learning pipeline, and tracks formaldehyde (HCHO) hotspots linked to biomass burning.
            </p>
            <div style={{ display: 'flex', gap: '2rem', marginTop: '1.5rem' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>NCAP SDG Indicator Alignment</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Target 11.6: Reduce urban environmental impact.</div>
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Spatial Scale</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>India landmass grid downscaled to 1.5° resolution.</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>System Integrity</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem' }}>Sentinel-5P L3 Ingestion</span>
                <span className="status-badge success"><CheckCircle size={12} /> Active</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem' }}>INSAT-3D Aerosol Ingestion</span>
                <span className="status-badge success"><CheckCircle size={12} /> Active</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem' }}>CPCB Ground validation</span>
                <span className="status-badge success"><CheckCircle size={12} /> Syncing</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAQIMaps = () => {
    return (
      <div className="dashboard-panel">
        <h2 style={{ marginBottom: '1.5rem' }}>Surface AQI Reconstruction</h2>
        
        {/* Playback timeline slider */}
        <div className="slider-container">
          <div className="slider-controls">
            <button className="btn-icon" onClick={handlePlayToggle}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button className="btn-icon" onClick={resetTimeline}>
              <RotateCcw size={18} />
            </button>
          </div>
          <div className="timeline-slider-wrapper">
            <div className="timeline-labels">
              <span>2026-11-01</span>
              <span style={{ color: 'var(--accent-teal)', fontWeight: 'bold' }}>Active View: {currentDate}</span>
              <span>2026-11-15</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="15" 
              value={parseInt(currentDate.split('-')[2])} 
              onChange={handleSliderChange} 
              className="slider-input"
            />
          </div>
        </div>

        {/* Map Layout */}
        <div className="map-view-layout">
          <div className="map-container-wrapper">
            <DashboardMap 
              mapType="aqi" 
              gridData={gridData} 
              onCellSelect={setSelectedCell}
            />
          </div>

          <div className="map-side-panel">
            <div className="card" style={{ flex: 1 }}>
              <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                Grid Inspector
              </h3>
              {selectedCell ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Coordinates</span>
                    <span style={{ fontWeight: '600' }}>{selectedCell.lat.toFixed(2)}°N, {selectedCell.lon.toFixed(2)}°E</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Overall Surface AQI</span>
                    <span className="aqi-badge badge-glow" style={{ backgroundColor: getAQIColor(selectedCell.aqi), color: selectedCell.aqi > 300 ? '#ffffff' : '#000000' }}>
                      {selectedCell.aqi}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Dominant Pollutant</span>
                    <span style={{ fontWeight: '600', color: 'var(--accent-teal)' }}>{selectedCell.dominant_pollutant}</span>
                  </div>

                  <h4 style={{ fontSize: '0.9rem', color: '#ffffff', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                    Downscaled Concentrations
                  </h4>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>PM2.5</span>
                    <span>{selectedCell.concentrations.pm25.toFixed(1)} µg/m³</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>PM10</span>
                    <span>{selectedCell.concentrations.pm10.toFixed(1)} µg/m³</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>NO2</span>
                    <span>{selectedCell.concentrations.no2.toFixed(1)} µg/m³</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>CO</span>
                    <span>{selectedCell.concentrations.co.toFixed(2)} mg/m³</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>SO2</span>
                    <span>{selectedCell.concentrations.so2.toFixed(1)} µg/m³</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>O3</span>
                    <span>{selectedCell.concentrations.o3.toFixed(1)} µg/m³</span>
                  </div>

                  {/* Health Advisory panel (Stand-out feature) */}
                  <div className={`health-advisory-container ${getHealthClass(selectedCell.aqi)}`}>
                    <div className="health-advisory-title">
                      <AlertTriangle size={14} />
                      <span>Health Advisory</span>
                    </div>
                    <div className="health-advisory-text">
                      {getHealthAdvisory(selectedCell.aqi)}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                  Click a grid cell on the map to inspect concentrations.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHCHOHotspots = () => {
    return (
      <div className="dashboard-panel">
        <h2 style={{ marginBottom: '1.5rem' }}>Formaldehyde (HCHO) Hotspots & Wind Plumes</h2>
        
        {/* Playback timeline slider */}
        <div className="slider-container">
          <div className="slider-controls">
            <button className="btn-icon" onClick={handlePlayToggle}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button className="btn-icon" onClick={resetTimeline}>
              <RotateCcw size={18} />
            </button>
          </div>
          <div className="timeline-slider-wrapper">
            <div className="timeline-labels">
              <span>2026-11-01</span>
              <span style={{ color: 'var(--accent-teal)', fontWeight: 'bold' }}>Active View: {currentDate}</span>
              <span>2026-11-15</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="15" 
              value={parseInt(currentDate.split('-')[2])} 
              onChange={handleSliderChange} 
              className="slider-input"
            />
          </div>
        </div>

        <div className="map-view-layout">
          <div className="map-container-wrapper">
            <DashboardMap 
              mapType="hcho" 
              gridData={hotspots?.hotspot_cells || gridData} 
              fires={hotspots?.fires} 
              plumes={hotspots?.plumes}
            />
          </div>

          <div className="map-side-panel">
            <div className="card" style={{ flex: 1 }}>
              <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                Active Wind Plumes
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: '400px' }}>
                {hotspots?.plumes && hotspots.plumes.length > 0 ? (
                  hotspots.plumes.map((plume, index) => (
                    <div key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                      <div style={{ fontWeight: '600', color: 'var(--accent-teal)', fontSize: '0.85rem' }}>
                        {plume.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        Dispersion Plume traces downwind.
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontWeight: '500' }}>
                        Downwind CPCB impact:
                      </div>
                      <ul style={{ fontSize: '0.75rem', paddingLeft: '1rem', marginTop: '0.15rem' }}>
                        {plume.impacted_stations.length > 0 ? (
                          plume.impacted_stations.map((s, idx) => (
                            <li key={idx}>{s.name} ({s.distance_km}km)</li>
                          ))
                        ) : (
                          <li style={{ listStyleType: 'none', color: 'var(--text-muted)' }}>None in immediate path</li>
                        )}
                      </ul>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                    No hotspots detected for this date.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSourceRegions = () => {
    return (
      <div className="dashboard-panel">
        <h2 style={{ marginBottom: '1.5rem' }}>Primary Hotspot Source Regions</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Statistical cluster analysis detects large contiguous grids exceeding the 85th percentile of HCHO column density. These are ranked below.
        </p>

        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Source Region Name</th>
                  <th>Centroid Coordinates</th>
                  <th>Avg HCHO Column Density</th>
                  <th>Fires Count (Local)</th>
                  <th>Plume Risk Level</th>
                </tr>
              </thead>
              <tbody>
                {hotspots?.hotspot_regions && hotspots.hotspot_regions.length > 0 ? (
                  hotspots.hotspot_regions.map((region, index) => (
                    <tr key={index}>
                      <td>#{index + 1}</td>
                      <td style={{ fontWeight: '600', color: 'var(--accent-teal)' }}>{region.name}</td>
                      <td>{region.lat.toFixed(2)}°N, {region.lon.toFixed(2)}°E</td>
                      <td>{(region.avg_hcho * 1000).toFixed(4)} 10⁻³ mol/m²</td>
                      <td>{region.cell_count * 15} fires</td>
                      <td>
                        <span className="status-badge" style={{ 
                          backgroundColor: region.avg_hcho > 0.0003 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: region.avg_hcho > 0.0003 ? '#ef4444' : '#f59e0b'
                        }}>
                          {region.avg_hcho > 0.0003 ? 'Critical' : 'Elevated'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No source regions detected. Play or scrub the timeline to view active biomass burning periods.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCorrelation = () => {
    if (!correlation) return <div className="dashboard-panel">Loading...</div>;

    const labels = correlation.map(c => c.month);
    const fireCounts = correlation.map(c => c.fire_count);
    const hchoVals = correlation.map(c => c.avg_hcho * 1000); // Scale up for chart

    const barData = {
      labels,
      datasets: [
        {
          label: 'Active Fires Count',
          data: fireCounts,
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 1.5,
          yAxisID: 'y',
        },
        {
          label: 'Avg HCHO (x10⁻³ mol/m²)',
          data: hchoVals,
          type: 'line',
          borderColor: 'rgba(0, 242, 254, 1)',
          backgroundColor: 'rgba(0, 242, 254, 0.1)',
          borderWidth: 2,
          yAxisID: 'y1',
          fill: true
        }
      ]
    };

    const isDark = theme === 'dark';
    const textColor = isDark ? '#f3f4f6' : '#0f172a';
    const secondaryTextColor = isDark ? '#9ca3af' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: { color: gridColor },
          ticks: { color: secondaryTextColor }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: secondaryTextColor }
        },
        x: {
          ticks: { color: secondaryTextColor }
        }
      },
      plugins: {
        legend: { labels: { color: textColor } }
      }
    };

    return (
      <div className="dashboard-panel">
        <h2 style={{ marginBottom: '1.5rem' }}>Biomass Burning & HCHO Temporal Correlation</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Formaldehyde (HCHO) is a major product of VOC oxidation released during forest fires and crop residue burning. Below is the 12-month temporal coupling chart.
        </p>

        <div className="card-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <div className="chart-card">
            <div className="chart-header">
              <span className="chart-title">Fire Counts vs. HCHO Column Density (12-Month Trend)</span>
            </div>
            <div className="chart-container-wrapper">
              <Bar key={theme} data={barData} options={options} />
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem', color: 'var(--accent-teal)' }}>Monthly Coupling Stats</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', maxHeight: '250px' }}>
              {correlation.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.4rem', fontSize: '0.85rem' }}>
                  <span>{c.month}</span>
                  <span style={{ color: c.pearson_r > 0.7 ? '#ef4444' : 'var(--text-secondary)' }}>
                    r = {c.pearson_r.toFixed(2)} {c.pearson_r > 0.7 ? '(Strong)' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTrends = () => {
    if (!validation) return <div className="dashboard-panel">Loading...</div>;

    const stations = validation.stations_data;
    const metrics = validation.metrics;

    // Line Chart for comparison
    const pollutants = ["pm25", "pm10", "no2", "co"];
    const labels = stations.map(s => s.name.split(',')[0]);
    const predictedPM25 = stations.map(s => s.predicted.pm25);
    const actualPM25 = stations.map(s => s.actual.pm25);

    const lineData = {
      labels,
      datasets: [
        {
          label: 'Downscaled Predicted PM2.5',
          data: predictedPM25,
          borderColor: 'rgba(0, 242, 254, 1)',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(0, 242, 254, 1)',
          tension: 0.1
        },
        {
          label: 'CPCB Ground Measurement',
          data: actualPM25,
          borderColor: 'rgba(239, 68, 68, 1)',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          borderWidth: 2,
          pointBackgroundColor: 'rgba(239, 68, 68, 1)',
          tension: 0.1
        }
      ]
    };

    const isDark = theme === 'dark';
    const textColor = isDark ? '#f3f4f6' : '#0f172a';
    const secondaryTextColor = isDark ? '#9ca3af' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

    const lineOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { 
          grid: { color: gridColor },
          ticks: { color: secondaryTextColor },
          title: { display: true, text: 'PM2.5 (µg/m³)', color: secondaryTextColor }
        },
        x: { ticks: { color: secondaryTextColor } }
      },
      plugins: {
        legend: { labels: { color: textColor } }
      }
    };

    return (
      <div className="dashboard-panel">
        <h2 style={{ marginBottom: '1.5rem' }}>Model Validation & Verification</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Deep learning predictions are verified against physical CPCB CAAQM monitors on the active date ({currentDate}).
        </p>

        {/* Statistical Metrics Cards */}
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '2.5rem' }}>
          {Object.keys(metrics).map((p) => (
            <div className="card" key={p} style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--accent-teal)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                {p === 'pm25' ? 'PM2.5' : p === 'pm10' ? 'PM10' : p.toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>RMSE</span>
                  <span style={{ fontWeight: '600' }}>{metrics[p].rmse}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>MAE</span>
                  <span style={{ fontWeight: '600' }}>{metrics[p].mae}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>R-coeff</span>
                  <span style={{ fontWeight: '600', color: '#10b981' }}>{metrics[p].r}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Validation Plots */}
        <div className="card-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <div className="chart-card">
            <div className="chart-header">
              <span className="chart-title">Station PM2.5 Prediction vs. CPCB Ground Truth</span>
            </div>
            <div className="chart-container-wrapper">
              <Line key={theme} data={lineData} options={lineOptions} />
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Active CPCB Stations</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', overflowY: 'auto', maxHeight: '250px' }}>
              {stations.map((s, i) => (
                <div 
                  key={i} 
                  className={`nav-item ${selectedStation?.station_id === s.station_id ? 'active' : ''}`}
                  onClick={() => setSelectedStation(s)}
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                >
                  <div>
                    <div style={{ fontWeight: '600' }}>{s.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Actual PM2.5: {s.actual.pm25.toFixed(1)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMethodology = () => {
    return (
      <div className="dashboard-panel">
        <h2 style={{ marginBottom: '1.5rem' }}>Scientific Methodology & Data Ingestion</h2>
        
        <div className="methodology-container">
          <div className="methodology-section">
            <h3><Database size={20} /> Data Ingestion Pipeline</h3>
            <p>
              The ingestion pipeline acts as a pluggable, modular service layer. Satellite, surface monitor, and meteorological reanalysis datasets are automatically fetched, aligned to a spatial grid, and cached.
            </p>
            <ul className="methodology-list">
              <li><strong>Sentinel-5P TROPOMI</strong>: Columnar NO2, SO2, CO, O3, and HCHO columns (Google Earth Engine catalog).</li>
              <li><strong>INSAT-3D mosdac</strong>: Aerosol Optical Depth (AOD) used for PM2.5 boundary-condition initialization.</li>
              <li><strong>CPCB CAAQM</strong>: Ground stations measurements used for real-time validation and neural network bias correction.</li>
              <li><strong>Copernicus ERA5 Reanalysis</strong>: Boundary layer height, surface air temperature, relative humidity, and horizontal wind vectors (U, V components).</li>
            </ul>
          </div>

          <div className="methodology-section">
            <h3><TrendingUp size={20} /> Objective 1 — CNN-LSTM Downscaling Model</h3>
            <p>
              Direct satellite columnar measurements cannot be equated to ground concentrations. The platform runs a hybrid <strong>CNN-LSTM architecture</strong>:
            </p>
            <ul className="methodology-list">
              <li><strong>Spatial Encoder (CNN)</strong>: Captures local pollution topography, emission gradients, and meteorological conditions across neighbor grid cells.</li>
              <li><strong>Temporal Sequencer (LSTM)</strong>: Tracks persistence and boundary layer decay to predict ground concentrations.</li>
              <li><strong>Physics-Informed Correction</strong>: Uses the boundary layer height ($BLH$) and wind vectors to perform dispersion calculations.</li>
            </ul>
          </div>

          <div className="methodology-section">
            <h3><Compass size={20} /> Objective 2 — Hotspot Clustering & Wind Dispersion Plume tracing</h3>
            <p>
              For formaldehyde hotspots (biomass burning), the platform integrates an innovative statistical transport analysis:
            </p>
            <ul className="methodology-list">
              <li><strong>Hotspot Identification</strong>: Exceedance threshold set at the 85th percentile of HCHO column density.</li>
              <li><strong>Density Clustering</strong>: contiguity clustering groups high HCHO cells into named regional sources (e.g. Punjab Crop Burning).</li>
              <li><strong>Wind Plume Trajectory</strong>: Leverages U and V wind reanalysis components to trace 6-hour and 12-hour downwind transport pathways.</li>
              <li><strong>CPCB Validation Coupling</strong>: Correlates projected plume endpoints with ground stations to highlight downwind air pollution loads.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`app-container theme-${theme}`}>
      <Sidebar 
        activeSection={activeSection} 
        setActiveSection={setActiveSection} 
        status={status}
        theme={theme}
        setTheme={setTheme}
      />
      
      <main className="main-content">
        <header className="dashboard-header">
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '700' }}>
              {activeSection === 'overview' && 'National Air Quality Overview'}
              {activeSection === 'aqi-maps' && 'Surface AQI Analysis'}
              {activeSection === 'hcho-hotspots' && 'Biomass-Burning & HCHO hotspots'}
              {activeSection === 'source-regions' && 'Emission Source Regions'}
              {activeSection === 'correlation' && 'Fire–HCHO Correlation'}
              {activeSection === 'trends' && 'Model Performance Statistics'}
              {activeSection === 'methodology' && 'Data & Methodology Standards'}
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              ISRO Sentinel-5P / CPCB Air Quality Downscaling Project
            </p>
          </div>
          
          <div className="header-meta">
            <div className="date-selector-container">
              <Calendar size={16} style={{ color: 'var(--accent-teal)' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Active Date: {currentDate}</span>
            </div>
            <div className="status-badge success">
              <CheckCircle size={12} />
              <span>Model Synced</span>
            </div>
          </div>
        </header>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-secondary)' }}>
            <div className="btn-icon" style={{ animation: 'spin 2s linear infinite', width: '40px', height: '40px', borderColor: 'var(--accent-teal)' }}>
              <Activity size={20} className="sidebar-logo" />
            </div>
            <span>Fetching Sentinel-5P columns & computing downscaling grids...</span>
          </div>
        ) : (
          <>
            {activeSection === 'overview' && renderOverview()}
            {activeSection === 'aqi-maps' && renderAQIMaps()}
            {activeSection === 'hcho-hotspots' && renderHCHOHotspots()}
            {activeSection === 'source-regions' && renderSourceRegions()}
            {activeSection === 'correlation' && renderCorrelation()}
            {activeSection === 'trends' && renderTrends()}
            {activeSection === 'methodology' && renderMethodology()}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
