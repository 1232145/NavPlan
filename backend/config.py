import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# API Configuration
API_PREFIX = "/api"
PROJECT_NAME = "Build Your Day API"
DESCRIPTION = "API for generating personalized day itineraries"
VERSION = "1.0.0"

# CORS Configuration
CORS_ORIGINS = [
    "http://localhost:3000",  # Frontend dev server
    "https://*.vercel.app",   # Vercel deployments
    "https://*.railway.app",  # Railway deployments
]

# Google Auth Configuration
GOOGLE_CLIENT_ID = os.getenv("VITE_GOOGLE_CLIENT_ID")
if not GOOGLE_CLIENT_ID:
    logger.warning("VITE_GOOGLE_CLIENT_ID not set in environment variables")

# Google Maps Configuration
GOOGLE_MAPS_API_KEY = os.getenv("VITE_GOOGLE_MAPS_API_KEY")
if not GOOGLE_MAPS_API_KEY:
    logger.warning("VITE_GOOGLE_MAPS_API_KEY not set in environment variables")

# Google AI Configuration
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    logger.warning("GOOGLE_API_KEY not set in environment variables")

# OpenRouter AI Configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY:
    logger.warning("OPENROUTER_API_KEY not set in environment variables. Some AI features may not be available.")

# Geoapify Configuration
GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY")
if not GEOAPIFY_API_KEY:
    logger.warning("GEOAPIFY_API_KEY not set in environment variables. POI data generation may be limited.")

# MongoDB Configuration
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB = os.getenv("MONGODB_DB")
if not MONGODB_URI or not MONGODB_DB:
    raise ValueError("MONGODB_URI and MONGODB_DB must be set in environment variables") 