import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';

// Helper to get AQI Color
export const getAQIColor = (aqi) => {
  if (aqi <= 50) return '#00e400';
  if (aqi <= 100) return '#ffff00';
  if (aqi <= 200) return '#ff7e00';
  if (aqi <= 300) return '#ff0000';
  if (aqi <= 400) return '#8f3f97';
  return '#7e0023';
};

// Helper to get AQI Category
export const getAQICategory = (aqi) => {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
};

// Helper to get HCHO Color
const getHCHOColor = (val) => {
  if (val <= 0.00010) return '#fef3c7'; // Light amber
  if (val <= 0.00020) return '#fde68a';
  if (val <= 0.00030) return '#f59e0b'; // Amber
  if (val <= 0.00040) return '#ea580c'; // Orange
  return '#dc2626';                      // Red
};

// Linear interpolation along a multi-segment path
const interpolatePath = (coords, progress) => {
  if (coords.length < 2) return coords[0];
  const totalSegments = coords.length - 1;
  const scaledProgress = progress * totalSegments;
  const segmentIndex = Math.floor(scaledProgress);
  const segmentProgress = scaledProgress - segmentIndex;
  
  if (segmentIndex >= totalSegments) return coords[coords.length - 1];
  
  const p1 = coords[segmentIndex];
  const p2 = coords[segmentIndex + 1];
  
  const lat = p1[0] + (p2[0] - p1[0]) * segmentProgress;
  const lon = p1[1] + (p2[1] - p1[1]) * segmentProgress;
  
  return [lat, lon];
};

const DashboardMap = ({ mapType, gridData, fires, plumes, onCellSelect }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const baseLayerRef = useRef(null);
  const labelsLayerRef = useRef(null);
  const animatedMarkersRef = useRef([]);
  const animIntervalRef = useRef(null);

  // Local state for Base Layer Selection (Voyager is default clean, OSM detailed, Dark high-contrast)
  const [baseLayerType, setBaseLayerType] = useState('voyager');

  // 1. Initialize Map
  useEffect(() => {
    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [21.5, 78.5],
        zoom: 5,
        zoomControl: true,
        maxBounds: [[5, 60], [38, 100]]
      });

      // Create a pane for map labels so they render on top of our grid polygons
      const labelsPane = map.createPane('labels-pane');
      labelsPane.style.zIndex = 450;
      labelsPane.style.pointerEvents = 'none';

      // Default to CartoDB Voyager No Labels
      const url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png';
      baseLayerRef.current = L.tileLayer(url, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 10,
        minZoom: 4
      }).addTo(map);

      // Default Voyager Labels Layer in the custom pane
      labelsLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
        pane: 'labels-pane',
        subdomains: 'abcd',
        maxZoom: 10,
        minZoom: 4
      }).addTo(map);

      mapRef.current = map;
      layerGroupRef.current = L.layerGroup().addTo(map);
    }
  }, []);

  // 2. Manage Base Layer Changes dynamically
  useEffect(() => {
    if (mapRef.current) {
      if (baseLayerRef.current) baseLayerRef.current.remove();
      if (labelsLayerRef.current) labelsLayerRef.current.remove();

      let url = '';
      let labelsUrl = '';
      let attribution = '';

      if (baseLayerType === 'voyager') {
        url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png';
        labelsUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png';
        attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
      } else if (baseLayerType === 'osm') {
        url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        labelsUrl = ''; // OSM has labels baked in
        attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
      } else {
        url = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
        labelsUrl = 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png'; // Crisp white labels
        attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
      }

      baseLayerRef.current = L.tileLayer(url, {
        attribution,
        subdomains: 'abcd',
        maxZoom: 10,
        minZoom: 4
      }).addTo(mapRef.current);

      if (labelsUrl) {
        labelsLayerRef.current = L.tileLayer(labelsUrl, {
          pane: 'labels-pane',
          subdomains: 'abcd',
          maxZoom: 10,
          minZoom: 4
        }).addTo(mapRef.current);
      } else {
        labelsLayerRef.current = null;
      }
    }
  }, [baseLayerType]);

  // 3. Render Data Layers and Plume Animations
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    // Clear existing data layers
    layerGroup.clearLayers();

    // Clear existing animations
    if (animIntervalRef.current) {
      clearInterval(animIntervalRef.current);
      animIntervalRef.current = null;
    }
    animatedMarkersRef.current.forEach(item => item.marker.remove());
    animatedMarkersRef.current = [];

    // Render AQI Grid Layer
    if (mapType === 'aqi' && gridData) {
      gridData.forEach((point) => {
        const { lat, lon, aqi, dominant_pollutant, concentrations } = point;
        const bounds = [
          [lat - 0.75, lon - 0.75],
          [lat + 0.75, lon + 0.75]
        ];

        const rect = L.rectangle(bounds, {
          color: 'rgba(255, 255, 255, 0.08)',
          weight: 1,
          fillColor: getAQIColor(aqi),
          fillOpacity: 0.45
        });

        rect.bindPopup(`
          <div style="font-family: 'Plus Jakarta Sans', sans-serif;">
            <div class="map-popup-header">Grid Cell Details</div>
            <div class="map-popup-grid">
              <div class="map-popup-label">Coordinates:</div><div class="map-popup-val">${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E</div>
              <div class="map-popup-label">Surface AQI:</div><div class="map-popup-val" style="color: ${getAQIColor(aqi)}; font-weight:700;">${aqi} (${getAQICategory(aqi)})</div>
              <div class="map-popup-label">Dominant:</div><div class="map-popup-val">${dominant_pollutant}</div>
              <div class="map-popup-label">PM2.5:</div><div class="map-popup-val">${concentrations.pm25.toFixed(1)} µg/m³</div>
              <div class="map-popup-label">PM10:</div><div class="map-popup-val">${concentrations.pm10.toFixed(1)} µg/m³</div>
              <div class="map-popup-label">NO2:</div><div class="map-popup-val">${concentrations.no2.toFixed(1)} µg/m³</div>
              <div class="map-popup-label">CO:</div><div class="map-popup-val">${concentrations.co.toFixed(2)} mg/m³</div>
            </div>
          </div>
        `);

        rect.on('click', () => {
          if (onCellSelect) onCellSelect(point);
        });

        rect.addTo(layerGroup);
      });
    }

    // Render HCHO & Hotspot/Fire Layer
    if (mapType === 'hcho' && gridData) {
      gridData.forEach((point) => {
        const { lat, lon, hcho } = point;
        const bounds = [
          [lat - 0.75, lon - 0.75],
          [lat + 0.75, lon + 0.75]
        ];

        const rect = L.rectangle(bounds, {
          color: 'transparent',
          fillColor: getHCHOColor(hcho),
          fillOpacity: 0.4
        });

        rect.bindPopup(`
          <div style="font-family: 'Plus Jakarta Sans', sans-serif;">
            <div class="map-popup-header">HCHO Density</div>
            <div class="map-popup-grid">
              <div class="map-popup-label">Coordinates:</div><div class="map-popup-val">${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E</div>
              <div class="map-popup-label">HCHO Column:</div><div class="map-popup-val">${(hcho * 1000).toFixed(4)} 10⁻³ mol/m²</div>
            </div>
          </div>
        `);

        rect.addTo(layerGroup);
      });

      // Draw Active Fires
      if (fires) {
        fires.forEach((fire) => {
          const marker = L.circleMarker([fire.lat, fire.lon], {
            radius: fire.frp > 50 ? 5.5 : 4,
            color: '#ff2200',
            weight: 1,
            fillColor: '#ffdd00',
            fillOpacity: 0.95
          });

          marker.bindPopup(`
            <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem;">
              <div class="map-popup-header" style="color: #ff3300; border-bottom-color: #ff3300;">Active Fire Spot</div>
              <div class="map-popup-grid">
                <div class="map-popup-label">Location:</div><div class="map-popup-val">${fire.lat.toFixed(3)}N, ${fire.lon.toFixed(3)}E</div>
                <div class="map-popup-label">Fire Power (FRP):</div><div class="map-popup-val" style="color: #ffaa00; font-weight: bold;">${fire.frp.toFixed(1)} MW</div>
                <div class="map-popup-label">Type:</div><div class="map-popup-val">${fire.type}</div>
              </div>
            </div>
          `);

          marker.addTo(layerGroup);
        });
      }

      // Draw Wind Plumes and Initialize Flowing Particles (Special Feature)
      if (plumes && plumes.length > 0) {
        plumes.forEach((plume) => {
          const pathCoords = plume.path.map(p => [p.lat, p.lon]);

          // Static dotted polyline
          const polyline = L.polyline(pathCoords, {
            color: '#00f2fe',
            weight: 2,
            dashArray: '4, 8',
            opacity: 0.7
          });

          // Endpoint marker
          const endPoint = pathCoords[pathCoords.length - 1];
          const endMarker = L.circleMarker(endPoint, {
            radius: 4,
            color: '#00f2fe',
            fillColor: '#101524',
            fillOpacity: 1,
            weight: 2
          });

          let stationsList = plume.impacted_stations.map(
            s => `<li>${s.name} (${s.distance_km} km)</li>`
          ).join('');

          polyline.bindPopup(`
            <div style="font-family: 'Plus Jakarta Sans', sans-serif; width: 230px;">
              <div class="map-popup-header" style="color: #00f2fe;">Plume Dispersion Path</div>
              <div style="font-size: 0.8rem; margin-bottom: 0.5rem; color: var(--text-secondary);">
                Tracing transport path downwind from <strong>${plume.name}</strong>.
              </div>
              <div class="map-popup-label" style="font-weight: 600; margin-bottom: 0.25rem; font-size: 0.8rem;">Impacted CPCB Monitors:</div>
              <ul style="font-size: 0.75rem; padding-left: 1.1rem; color: #ffffff; margin: 0;">
                ${stationsList || '<li>None in direct path</li>'}
              </ul>
            </div>
          `);

          polyline.addTo(layerGroup);
          endMarker.addTo(layerGroup);

          // Create flowing particle marker (Special Feature)
          const particle = L.circleMarker(pathCoords[0], {
            radius: 4.5,
            color: '#00f2fe',
            weight: 0,
            fillColor: '#00f2fe',
            fillOpacity: 0.95
          }).addTo(map);

          animatedMarkersRef.current.push({
            marker: particle,
            coords: pathCoords,
            progress: Math.random() // Start at staggered offsets for natural flow
          });
        });

        // Initialize Plume Animation Loop
        animIntervalRef.current = setInterval(() => {
          animatedMarkersRef.current.forEach((item) => {
            item.progress += 0.012; // Controls movement speed
            if (item.progress >= 1.0) {
              item.progress = 0.0;
            }
            const currentLatLng = interpolatePath(item.coords, item.progress);
            item.marker.setLatLng(currentLatLng);
          });
        }, 40);
      }
    }
  }, [mapType, gridData, fires, plumes]);

  // 4. Cleanup Lifecycle
  useEffect(() => {
    return () => {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current);
      }
      animatedMarkersRef.current.forEach(item => item.marker.remove());
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="map-container-wrapper" style={{ height: '100%', width: '100%' }}>
      {/* Map Tile Layer Selector Overlay */}
      <div className="map-layer-selector">
        <div className="map-layer-selector-title">Base Map</div>
        <button 
          onClick={() => setBaseLayerType('voyager')} 
          className={`layer-btn ${baseLayerType === 'voyager' ? 'active' : ''}`}
        >
          Voyager (Clear)
        </button>
        <button 
          onClick={() => setBaseLayerType('osm')} 
          className={`layer-btn ${baseLayerType === 'osm' ? 'active' : ''}`}
        >
          OSM (Detailed)
        </button>
        <button 
          onClick={() => setBaseLayerType('dark')} 
          className={`layer-btn ${baseLayerType === 'dark' ? 'active' : ''}`}
        >
          Dark Mode
        </button>
      </div>

      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} id="india-map" />
      
      {/* Map Legends */}
      {mapType === 'aqi' ? (
        <div className="map-legend">
          <div className="legend-title">Surface AQI Index</div>
          <div className="scale-items">
            <div className="scale-item">
              <span className="scale-color" style={{ backgroundColor: getAQIColor(25) }}></span>
              <span>0 - 50 (Good)</span>
            </div>
            <div className="scale-item">
              <span className="scale-color" style={{ backgroundColor: getAQIColor(75) }}></span>
              <span>51 - 100 (Satisfactory)</span>
            </div>
            <div className="scale-item">
              <span className="scale-color" style={{ backgroundColor: getAQIColor(150) }}></span>
              <span>101 - 200 (Moderate)</span>
            </div>
            <div className="scale-item">
              <span className="scale-color" style={{ backgroundColor: getAQIColor(250) }}></span>
              <span>201 - 300 (Poor)</span>
            </div>
            <div className="scale-item">
              <span className="scale-color" style={{ backgroundColor: getAQIColor(350) }}></span>
              <span>301 - 400 (Very Poor)</span>
            </div>
            <div className="scale-item">
              <span className="scale-color" style={{ backgroundColor: getAQIColor(450) }}></span>
              <span>401+ (Severe)</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="map-legend">
          <div className="legend-title">HCHO & Fire Overlay</div>
          <div className="scale-items" style={{ gap: '0.45rem' }}>
            <div className="scale-item">
              <span className="scale-color" style={{ backgroundColor: getHCHOColor(0.00008) }}></span>
              <span>Low HCHO Density</span>
            </div>
            <div className="scale-item">
              <span className="scale-color" style={{ backgroundColor: getHCHOColor(0.00025) }}></span>
              <span>Medium HCHO Density</span>
            </div>
            <div className="scale-item">
              <span className="scale-color" style={{ backgroundColor: getHCHOColor(0.00045) }}></span>
              <span>High HCHO Density</span>
            </div>
            <div className="scale-item" style={{ marginTop: '0.2rem' }}>
              <span style={{ 
                display: 'inline-block',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#ffdd00',
                border: '2px solid #ff2200'
              }}></span>
              <span>Active Fires (FRP anomalies)</span>
            </div>
            <div className="scale-item">
              <span style={{ 
                display: 'inline-block',
                width: '20px',
                height: '2px',
                borderTop: '2px dashed #00f2fe'
              }}></span>
              <span>Plume Dispersion Path</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardMap;
