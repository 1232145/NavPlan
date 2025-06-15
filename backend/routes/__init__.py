from fastapi import APIRouter
from routes.auth import router as auth_router
from routes.archived_lists import router as archived_lists_router
from routes.schedules import router as schedule_router

# Main router that includes all sub-routers
api_router = APIRouter()

# Include all route modules
api_router.include_router(auth_router)
api_router.include_router(archived_lists_router)
api_router.include_router(schedule_router)

__all__ = ["api_router"] 