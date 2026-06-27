from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from app.config import settings
from app.services.data_ingestion import DataIngestionService
from app.services.aqi_prediction import AQIPredictionService
from app.services.hcho_hotspot import HCHOHotspotService

app = FastAPI(
    title=settings.APP_NAME,
    description="Satellite-driven Air Quality and HCHO Hotspot Analytics API over India.",
    version="1.0.0"
)

# Configure CORS for React Dev Server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Services
ingestion_service = DataIngestionService()
aqi_service = AQIPredictionService(ingestion_service)
hcho_service = HCHOHotspotService(ingestion_service)

@app.get("/api/status")
async def get_status():
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.ENV,
        "mock_mode": settings.MOCK_DATA,
        "credentials": {
            "gee_configured": bool(settings.GEE_SERVICE_ACCOUNT and settings.GEE_PRIVATE_KEY_PATH),
            "cpcb_configured": bool(settings.CPCB_API_KEY)
        }
    }

@app.get("/api/aqi/grid")
async def get_aqi_grid(date: str = Query(None, description="Format: YYYY-MM-DD")):
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")
    try:
        # Validate date format
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")
        
    grid = aqi_service.get_surface_aqi_grid(date)
    return {
        "date": date,
        "grid_resolution": 1.5,
        "data": grid
    }

@app.get("/api/aqi/validation")
async def get_aqi_validation(date: str = Query(None, description="Format: YYYY-MM-DD")):
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")
        
    validation = aqi_service.validate_model_performance(date)
    return validation

@app.get("/api/hcho/hotspots")
async def get_hcho_hotspots(date: str = Query(None, description="Format: YYYY-MM-DD")):
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")
        
    hotspots = hcho_service.detect_hotspots(date)
    return hotspots

@app.get("/api/hcho/correlation")
async def get_hcho_correlation():
    correlation_data = hcho_service.get_historical_correlation()
    return {
        "correlation_metrics": correlation_data
    }
