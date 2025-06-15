import logging
from fastapi import APIRouter, Body, Depends, HTTPException
from typing import Dict, Any, Tuple, List
from db.models import ScheduleRequest, LocationScheduleRequest
from services.ai_service import optimize_place_order
from services.schedule_service import generate_schedule
from services.public_data_service import public_data_service
from utils.auth import get_current_user
from config import API_PREFIX

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix=API_PREFIX, tags=["schedules"])

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
        
        # Process places - use consistent approach as location-based generation
        if request.day_overview:
            logger.info(f"Updating existing schedule with travel mode: {request.travel_mode}")
            places = request.places
            day_overview = request.day_overview
        else:
            logger.info(f"Creating new schedule from {len(request.places)} places with time range: {request.start_time} to {request.end_time}")
            
            # Extract preferences from request
            preferences = None
            if request.preferences:
                preferences = {
                    'must_include': request.preferences.must_include,
                    'balance_mode': request.preferences.balance_mode,
                    'max_places': request.preferences.max_places,
                    'meal_requirements': request.preferences.meal_requirements
                }
                logger.info(f"Using user preferences: {preferences}")
            
            places, day_overview = await optimize_place_order(
                request.places,
                request.start_time,
                request.prompt,
                request.travel_mode,
                end_time=request.end_time,
                preferences=preferences
            )
            logger.info(f"AI selected {len(places)} places for the schedule")
        
        # Generate the schedule with routing information
        logger.info(f"Generating schedule with travel mode: {request.travel_mode}")
        schedule = await generate_schedule(
            places,
            request.start_time,
            request.travel_mode,
            day_overview,
            request.end_time
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
    
    1. First, search existing POIs in database within radius
    2. If insufficient POIs found (< 3), expand search radius
    3. If still insufficient, generate new POIs from external APIs
    4. Use vector search + AI to optimize the final schedule
    
    Args:
        request: Location-based schedule request with coordinates, preferences, and timing
        user: Current authenticated user
        
    Returns:
        Dictionary with generated schedule and metadata about the discovery
    """
    try:
        logger.info(f"Generating location-based schedule for user {user['id']} at ({request.latitude}, {request.longitude})")
        
        # Step 1: Try to find existing POIs in database
        search_text = None
        if request.prompt and len(request.prompt.strip()) > 10:
            search_text = request.prompt.strip()
        
        # Start with requested radius
        current_radius = request.radius_meters
        nearby_pois = []
        
        # Strategy: Try progressively larger search radii to find enough POIs
        max_attempts = 3
        radius_multipliers = [1, 2, 5]  # 5km, 10km, 25km for default 5km radius
        
        for attempt in range(max_attempts):
            search_radius = current_radius * radius_multipliers[attempt]
            logger.info(f"Attempt {attempt + 1}: Searching for POIs within {search_radius}m")
            
            nearby_pois = await public_data_service.search_pois_near_location(
                latitude=request.latitude,
                longitude=request.longitude,
                radius_meters=search_radius,
                categories=request.categories,
                search_text=search_text,
                limit=max(100, request.max_places * 3)  # Get many more POIs for better selection
            )
            
            logger.info(f"Found {len(nearby_pois)} POIs within {search_radius}m")
            
            # If we have enough POIs for a good schedule, break
            if len(nearby_pois) >= 3:
                break
                
            # For last attempt, try without category filter to find any POIs
            if attempt == max_attempts - 1 and len(nearby_pois) < 3:
                logger.info("Last attempt: Searching without category filter")
                nearby_pois = await public_data_service.search_pois_near_location(
                    latitude=request.latitude,
                    longitude=request.longitude,
                    radius_meters=search_radius,
                    categories=None,  # No category filter
                    search_text=None,  # No text search
                    limit=max(100, request.max_places * 3)  # Get many more POIs for better selection
                )
                logger.info(f"Found {len(nearby_pois)} POIs without filters")
        
        # Step 2: If still no POIs, provide helpful error with suggestions
        if not nearby_pois:
            # Check if there are ANY POIs in the database
            from db import get_database
            with get_database() as db:
                total_pois = db.public_pois.count_documents({})
                
            if total_pois == 0:
                error_msg = "No POI data available in database. Please import POI data first."
            else:
                error_msg = (
                    f"No POIs found within {search_radius}m of your location. "
                    f"Database contains {total_pois} POIs in other areas. "
                    f"Try searching in a different location or contact support to add POI data for your area."
                )
            
            raise HTTPException(status_code=404, detail=error_msg)
        
        logger.info(f"Using {len(nearby_pois)} POIs for schedule generation")
        
        # Step 3: Convert POIs to schedule format
        places = []
        for poi in nearby_pois:
            coords = poi["location"]["coordinates"]  # [lng, lat]
            
            place = {
                "id": poi["poi_id"],
                "name": poi["name"],
                "placeType": poi.get("subcategory", poi["category"]),
                "address": poi["address"],
                "location": {
                    "lat": coords[1],
                    "lng": coords[0]
                },
                "geometry": {
                    "location": {
                        "lat": coords[1],
                        "lng": coords[0]
                    }
                },
                "rating": poi.get("rating"),
                "source": poi["source"],
                "category": poi["category"],
                "opening_hours": poi.get("opening_hours"),
                "note": f"Public POI from {poi['source']} - {poi['category']}"
            }
            places.append(place)
        
        # Step 4: Add current location as starting point if requested
        if request.include_current_location:
            logger.info("Adding current location as starting point")
            current_location_place = {
                "id": "current-location",
                "name": "Your Current Location", 
                "placeType": "point_of_interest",
                "address": "Starting point",
                "location": {
                    "lat": request.latitude,
                    "lng": request.longitude
                },
                "geometry": {
                    "location": {
                        "lat": request.latitude,
                        "lng": request.longitude
                    }
                },
                "userAdded": True,
                "note": "Starting location for this route"
            }
            places.insert(0, current_location_place)
            logger.info(f"Added current location as first place, now have {len(places)} total places")

        # Step 5: Create schedule request and optimize with AI 
        logger.info("Running AI optimization on discovered POIs with route planning")
        
        # Extract preferences from request if provided
        preferences = None
        if hasattr(request, 'preferences') and request.preferences:
            preferences = {
                'must_include': request.preferences.must_include,
                'balance_mode': request.preferences.balance_mode,
                'max_places': request.preferences.max_places,
                'meal_requirements': request.preferences.meal_requirements
            }
            logger.info(f"Using user preferences for location-based generation: {preferences}")
        
        optimized_places, day_overview = await optimize_place_order(
            places,
            request.start_time,
            request.prompt,
            request.travel_mode,
            end_time=request.end_time,  # Pass end time for proper constraints
            preferences=preferences
        )
        
        logger.info(f"AI selected {len(optimized_places)} places from {len(places)} nearby POIs")
        
        # Step 6: Generate final schedule with routing
        schedule = await generate_schedule(
            optimized_places,
            request.start_time,
            request.travel_mode,
            day_overview,
            request.end_time
        )
        
        # Step 7: Return comprehensive response
        return {
            "schedule": schedule,
            "location": {
                "latitude": request.latitude,
                "longitude": request.longitude,
                "radius_meters": current_radius,
                "actual_search_radius": search_radius if 'search_radius' in locals() else current_radius
            },
            "discovery_stats": {
                "nearby_pois_found": len(nearby_pois),
                "places_selected": len(optimized_places),
                "categories_found": list(set(poi["category"] for poi in nearby_pois)),
                "search_text_used": search_text,
                "search_strategy": "existing_database_pois"
            },
            "generated_from": "public_poi_data",
            "optimized": True,
            "original_place_count": len(places),
            "selected_place_count": len(optimized_places)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating location-based schedule: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to generate location-based schedule: {str(e)}") 