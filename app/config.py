import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "PRANA-VAYU: Satellite Air Quality Observatory"
    ENV: str = os.getenv("ENV", "development")  # development, production, test
    MOCK_DATA: bool = True  # Fallback to high-fidelity mock generators if GEE/CPCB keys are missing
    
    # API configuration
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Credentials (to be supplied by user or loaded from .env)
    GEE_SERVICE_ACCOUNT: str = os.getenv("GEE_SERVICE_ACCOUNT", "")
    GEE_PRIVATE_KEY_PATH: str = os.getenv("GEE_PRIVATE_KEY_PATH", "")
    CPCB_API_KEY: str = os.getenv("CPCB_API_KEY", "")
    
    class Config:
        env_file = ".env"

settings = Settings()
