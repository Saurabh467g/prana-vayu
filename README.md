# 🌿 PRANA-VAYU
### Satellite-Driven Air Quality & HCHO Hotspot Observatory (India)
**ISRO × NCAP Hackathon Submission**

---

##. Open in Browser
```
https://saurabh467g.github.io/prana-vayu/
```

> **Note:** wait for 30-40 seconds after loading the site.

---

## 🔬 What This Platform Does

| Feature | Description |
|---|---|
| **Surface AQI Reconstruction** | Downscales Sentinel-5P & INSAT-3D satellite columns to ground-level AQI using a physics-informed CNN-LSTM model |
| **HCHO Hotspot Detection** | Identifies biomass burning zones using 85th-percentile HCHO thresholding and spatial clustering |
| **Wind Plume Trajectories** | Traces aerosol transport paths using ERA5 U/V wind vectors to predict downwind impact |
| **CPCB Validation** | Compares model predictions against 11 real ground stations (RMSE, MAE, Pearson-R metrics) |
| **Fire–HCHO Correlation** | 12-month temporal coupling chart between MODIS fire counts and HCHO column density |
| **NCAP Policy Briefs** | Auto-generates actionable policy recommendations aligned with India's NCAP framework |

---

## 🗂 Project Structure

```
prana-vayu/
├── backend/                  ← FastAPI Python server
│   ├── app/
│   │   ├── main.py           ← API routes
│   │   ├── config.py         ← Settings & env vars
│   │   ├── services/
│   │   │   ├── data_ingestion.py    ← Satellite + met data
│   │   │   ├── aqi_prediction.py   ← Downscaling model
│   │   │   └── hcho_hotspot.py     ← Hotspot clustering
│   │   └── utils/
│   │       └── geo_helpers.py      ← Haversine + India grid
│   ├── requirements.txt
│   └── run.py
│
└── frontend/                 ← React + Vite dashboard
    ├── src/
    │   ├── App.jsx            ← Main dashboard
    │   ├── components/
    │   │   ├── DashboardMap.jsx  ← Leaflet map + plume animation
    │   │   └── Sidebar.jsx       ← Navigation
    │   └── styles/
    │       └── styles.css
    ├── index.html
    └── package.json
```

---

## 🛰 Data Sources (Simulated in Demo Mode)
- **Sentinel-5P TROPOMI** — NO₂, SO₂, CO, O₃, HCHO columns
- **INSAT-3D MOSDAC** — Aerosol Optical Depth (AOD)
- **CPCB CAAQM** — 11 ground station measurements
- **ERA5 Reanalysis** — BLH, temperature, humidity, wind vectors
- **MODIS/VIIRS** — Active fire radiative power (FRP)

> The app runs in **SIMULATED DATA MODE** by default (no API keys needed).  
> To connect live data: set `GEE_SERVICE_ACCOUNT`, `GEE_PRIVATE_KEY_PATH`, and `CPCB_API_KEY` in a `.env` file inside `/backend`.

---

## 🌐 API Endpoints
| Endpoint | Description |
|---|---|
| `GET /api/status` | System health + credential check |
| `GET /api/aqi/grid?date=YYYY-MM-DD` | India-wide AQI spatial grid |
| `GET /api/aqi/validation?date=YYYY-MM-DD` | Model vs CPCB ground truth |
| `GET /api/hcho/hotspots?date=YYYY-MM-DD` | Hotspot clusters + wind plumes |
| `GET /api/hcho/correlation` | 12-month fire–HCHO correlation |

---

*Built with FastAPI · React · Leaflet · Chart.js · Sentinel-5P · CPCB CAAQM*
