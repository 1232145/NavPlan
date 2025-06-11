import logging
from fastapi import APIRouter, Body, Depends, HTTPException
from typing import Dict, Any, Tuple, List, Optional
from pydantic import BaseModel
from db.models import ScheduleRequest, Schedule
from services.ai_service import optimize_place_order
from services.schedule_service import generate_schedule
from utils.auth import get_current_user
from config import API_PREFIX
from db import get_database

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix=API_PREFIX, tags=["schedules"])

class LocationScheduleRequest(BaseModel):
    """Model for location-based schedule generation request"""
    latitude: float
    longitude: float
    radius_meters: int = 5000  # Default 5km radius
    start_time: str = "09:00"
    end_time: str = "19:00"
    travel_mode: str = "walking"
    categories: Optional[List[str]] = None  # Optional category filters
    max_places: int = 20  # Maximum places to consider
    prompt: Optional[str] = None  # Optional custom prompt for AI

async def _process_places(request: ScheduleRequest) -> Tuple[List[Dict[str, Any]], str]:
    """
    Process places based on whether this is a new schedule or an update.
    
    For new schedules, it calls the AI service to optimize place order and select a subset.
    For updates (when day_overview is provided), it keeps the existing places and order.
    
    Args:
        request: The schedule request containing places, start time, end time, and optional day overview
        
    Returns:
        Tuple of (processed places, day overview)
    """
    # If day_overview exists, this is an update to an existing schedule (e.g., changing travel mode)
    if request.day_overview:
        logger.info(f"Updating existing schedule with travel mode: {request.travel_mode}")
        return request.places, request.day_overview
    
    # This is a new schedule - use AI to optimize places
    logger.info(f"Creating new schedule from {len(request.places)} places with time range: {request.start_time} to {request.end_time}")
    optimized_places, day_overview = await optimize_place_order(
        request.places,
        request.start_time,
        request.prompt,
        request.travel_mode,
        end_time=request.end_time
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

@router.post("/schedules/generate-from-location", response_model=Dict[str, Any])
async def generate_schedule_from_location(
    request: LocationScheduleRequest = Body(...),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generate an AI-optimized schedule from public POI data based on user's current location.
    
    This endpoint:
    1. Finds nearby public POIs from the database within the specified radius
    2. Uses AI to select and optimize a subset of places for a good day schedule
    3. Generates routing and timing information
    
    Args:
        request: Location-based schedule request with coordinates, preferences, and timing
        user: Current authenticated user
        
    Returns:
        Dictionary with generated schedule and metadata about the discovery
    """
    try:
        logger.info(f"Generating location-based schedule for user {user['id']} at ({request.latitude}, {request.longitude})")
        
        # Query nearby public POIs from database
        with get_database() as db:
            # Build query for nearby POIs
            query = {
                "location": {
                    "$near": {
                        "$geometry": {
                            "type": "Point", 
                            "coordinates": [request.longitude, request.latitude]  # [lng, lat] for GeoJSON
                        },
                        "$maxDistance": request.radius_meters
                    }
                }
            }
            
            # Add category filter if specified
            if request.categories:
                query["category"] = {"$in": request.categories}
            
            # Find nearby POIs
            nearby_pois = list(db.public_pois.find(query).limit(request.max_places))
            
            if not nearby_pois:
                raise HTTPException(
                    status_code=404, 
                    detail=f"No public POIs found within {request.radius_meters}m of the specified location"
                )
            
            logger.info(f"Found {len(nearby_pois)} nearby POIs")
            
            # Convert POIs to the format expected by the schedule generation
            places = []
            for poi in nearby_pois:
                # Convert GeoJSON coordinates back to lat/lng format
                coords = poi["location"]["coordinates"]  # [lng, lat]
                
                place = {
                    "id": poi["poi_id"],
                    "name": poi["name"],
                    "placeType": poi.get("subcategory", poi["category"]),  # Use subcategory if available
                    "address": poi["address"],
                    "geometry": {
                        "location": {
                            "lat": coords[1],  # latitude
                            "lng": coords[0]   # longitude
                        }
                    },
                    "rating": poi.get("rating"),
                    "source": poi["source"],
                    "category": poi["category"],
                    "opening_hours": poi.get("opening_hours"),
                    "note": f"Public POI from {poi['source']} - {poi['category']}"
                }
                places.append(place)
            
            # Create a custom prompt that incorporates location context
            location_prompt = request.prompt or f"""
            Create a great day schedule from these nearby places within {request.radius_meters/1000}km. 
            Focus on creating a logical flow that minimizes travel time and maximizes enjoyment.
            Consider the variety of place types and try to balance different activities.
            """
            
            # Use AI to optimize the selection and ordering of places
            logger.info("Using AI to optimize place selection and ordering")
            optimized_places, day_overview = await optimize_place_order(
                places,
                request.start_time,
                location_prompt,
                request.travel_mode,
                end_time=request.end_time
            )
            
            logger.info(f"AI selected {len(optimized_places)} places from {len(places)} nearby POIs")
            
            # Generate the schedule with routing information
            schedule = await generate_schedule(
                optimized_places,
                request.start_time,
                request.travel_mode,
                day_overview
            )
            
            return {
                "schedule": schedule,
                "location": {
                    "latitude": request.latitude,
                    "longitude": request.longitude,
                    "radius_meters": request.radius_meters
                },
                "discovery_stats": {
                    "nearby_pois_found": len(nearby_pois),
                    "places_selected": len(optimized_places),
                    "categories_found": list(set(poi["category"] for poi in nearby_pois))
                },
                "generated_from": "public_poi_data"
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating location-based schedule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate location-based schedule: {str(e)}") 