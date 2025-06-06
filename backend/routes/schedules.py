import logging
from fastapi import APIRouter, Body, Depends, HTTPException
from typing import Dict, Any, Tuple, List
from db.models import ScheduleRequest, Schedule
from services.ai_service import optimize_place_order
from services.schedule_service import generate_schedule
from utils.auth import get_current_user
from config import API_PREFIX

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix=API_PREFIX, tags=["schedules"])

async def _process_places(request: ScheduleRequest) -> Tuple[List[Dict[str, Any]], str]:
    """
    Process places based on whether this is a new schedule or an update.
    
    For new schedules, it calls the AI service to optimize place order and select a subset.
    For updates (when day_overview is provided), it keeps the existing places and order.
    
    Args:
        request: The schedule request containing places, start time, and optional day overview
        
    Returns:
        Tuple of (processed places, day overview)
    """
    # If day_overview exists, this is an update to an existing schedule (e.g., changing travel mode)
    if request.day_overview:
        logger.info(f"Updating existing schedule with travel mode: {request.travel_mode}")
        return request.places, request.day_overview
    
    # This is a new schedule - use AI to optimize places
    logger.info(f"Creating new schedule from {len(request.places)} places")
    optimized_places, day_overview = await optimize_place_order(
        request.places,
        request.start_time,
        request.prompt,
        request.travel_mode
    )
    logger.info(f"AI selected {len(optimized_places)} places for the schedule")
    
    return optimized_places, day_overview

@router.post("/schedules", response_model=Dict[str, Any])
async def create_schedule(
    request: ScheduleRequest = Body(...),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generate an optimized schedule for a set of places.
    
    If day_overview is provided, this is treated as an update to an existing schedule
    (typically changing travel mode), and the place order is preserved.
    
    Otherwise, AI is used to select an optimal subset of places and determine the best order.
    
    Args:
        request: The schedule request with places, start time, and optional parameters
        user: Current authenticated user
        
    Returns:
        Dictionary with schedule and metadata about the optimization
    """
    try:
        # Validate minimum place requirement for new schedules
        is_new_schedule = request.day_overview is None
        if is_new_schedule and len(request.places) < 3:
            raise HTTPException(
                status_code=400, 
                detail="At least 3 places are required to create a new schedule"
            )
        
        # Process places (optimize for new schedules, or use existing for updates)
        places, day_overview = await _process_places(request)
        
        # Generate the schedule with routing information
        logger.info(f"Generating schedule with travel mode: {request.travel_mode}")
        schedule = await generate_schedule(
            places,
            request.start_time,
            request.travel_mode,
            day_overview
        )
        
        # Return the schedule with metadata
        return {
            "schedule": schedule,
            "optimized": is_new_schedule,
            "original_place_count": len(request.places),
            "selected_place_count": len(places)
        }
    
    except Exception as e:
        logger.error(f"Error creating schedule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate schedule: {str(e)}") 