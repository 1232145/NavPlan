# To run the backend on localhost:8000, use:
# uvicorn main:app --host localhost --port 8000 --reload
import logging
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from config import PROJECT_NAME, DESCRIPTION, VERSION, CORS_ORIGINS
from db import db_manager
from routes import api_router
from routes.places import router as places_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title=PROJECT_NAME,
    description=DESCRIPTION,
    version=VERSION
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add performance monitoring middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        
        # Log API usage for monitoring
        logger.info(
            f"Request: {request.method} {request.url.path} | "
            f"Client: {request.client.host} | "
            f"Processing time: {process_time:.4f}s"
        )
        
        return response
    except Exception as e:
        logger.error(f"Request error: {e}")
        process_time = time.time() - start_time
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
            headers={"X-Process-Time": str(process_time)}
        )

# Add global error handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred"}
    )

# Include all routes
app.include_router(api_router)
app.include_router(places_router)

@app.on_event("startup")
async def startup_event():
    """Initialize resources on application startup"""
    logger.info(f"Starting {PROJECT_NAME} v{VERSION}")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    logger.info("Shutting down application")
    db_manager.close()

@app.get("/")
async def root():
    """Root endpoint for API health check"""
    return {
        "status": "ok",
        "message": f"{PROJECT_NAME} is running",
        "version": VERSION
    }
