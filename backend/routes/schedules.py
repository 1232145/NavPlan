import logging
from fastapi import APIRouter, Body, Depends, HTTPException
from typing import Dict, Any
from db.models import ScheduleRequest, Schedule
from services.ai_service import optimize_place_order
from services.schedule_service import generate_schedule
from utils.auth import get_current_user
from config import API_PREFIX

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix=API_PREFIX, tags=["schedules"])

@router.post("/schedules", response_model=Dict[str, Any])
async def create_schedule(
    schedule_request: ScheduleRequest = Body(...),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generate an optimized schedule for a set of places
    
    Args:
        schedule_request: Contains places and start time
        user: Current authenticated user
        
    Returns:
        Dictionary with schedule and optimization status
    """
    try:
        # Ensure we have at least 2 places
        if len(schedule_request.places) < 2:
            raise HTTPException(
                status_code=400, 
                detail="At least 2 places are required to create a schedule"
            )
        
        # 1. Optimize place order using AI
        logger.info(f"Optimizing order for {len(schedule_request.places)} places")
        optimized_places = await optimize_place_order(schedule_request.places)
        
        # 2. Generate routes and schedule
        logger.info("Generating schedule with optimized places")
        schedule = await generate_schedule(
            optimized_places, 
            schedule_request.start_time,
            schedule_request.travel_mode
        )
        
        return {
            "schedule": schedule,
            "optimized": True
        }
    except Exception as e:
        logger.error(f"Error creating schedule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate schedule: {str(e)}") 