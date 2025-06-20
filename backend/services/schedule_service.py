import logging
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple, Optional
import httpx
import math
from config import GOOGLE_MAPS_API_KEY
from db.models import Schedule, ScheduleItem, RouteSegment, Coordinates, TravelMode
import json
from fastapi import HTTPException

# Configure logging
logger = logging.getLogger(__name__)

# Constants
DEFAULT_VISIT_DURATION_MINUTES = {
    "restaurant": 90,
    "cafe": 45,
    "bar": 60,
    "museum": 120,
    "art_gallery": 90,
    "park": 60,
    "shopping_mall": 90,
    "tourist_attraction": 90,
    "amusement_park": 180,
    "zoo": 180,
    "aquarium": 120,
    "church": 45,
    "default": 60
}

# No buffer time by default - travel times from Google already include some buffer
TRAVEL_BUFFER_MINUTES = 0
EARTH_RADIUS_KM = 6371  # Earth radius in kilometers for distance calculations

# Speed estimates for fallback calculations when Google API is unavailable
TRAVEL_SPEED_KM_PER_HOUR = {
    TravelMode.WALKING: 5.0,    # Average walking speed
    TravelMode.BICYCLING: 15.0, # Average cycling speed
    TravelMode.DRIVING: 40.0,   # Average urban driving speed
    TravelMode.TRANSIT: 25.0    # Average transit speed
}

async def generate_schedule(
    places: List[Dict[str, Any]], 
    start_time_str: str, 
    travel_mode: TravelMode = TravelMode.WALKING,
    day_overview: Optional[str] = None,
    end_time_str: str = "19:00"
) -> Schedule:
    """
    Generate a detailed schedule with travel times and visit durations
    
    Args:
        places: List of places in optimized order
        start_time_str: Start time for the schedule in HH:MM format
        travel_mode: Mode of transportation (walking, driving, bicycling, transit)
        day_overview: Optional overview of the day from AI
        end_time_str: End time constraint for the schedule
        
    Returns:
        Schedule object with detailed timeline
    """
    try:
        logger.info(f"Generating schedule for {len(places)} places starting at {start_time_str}")
        
        # Parse start and end times
        start_hour, start_minute = map(int, start_time_str.split(':'))
        start_datetime = datetime.now().replace(
            hour=start_hour, minute=start_minute, second=0, microsecond=0
        )
        
        end_hour, end_minute = map(int, end_time_str.split(':'))
        end_datetime = datetime.now().replace(
            hour=end_hour, minute=end_minute, second=0, microsecond=0
        )
        
        # Pre-calculate all travel times and distances
        if len(places) > 1 and GOOGLE_MAPS_API_KEY:
            travel_data = await calculate_travel_data(places, travel_mode)
        else:
            travel_data = None
        
        schedule_items = []
        total_distance_meters = 0
        current_datetime = start_datetime
        
        # Process each place with time constraint validation
        for i, place in enumerate(places):
            # Check if we would exceed the end time before adding this place
            place_name = place.get('name', f'Place {i+1}')
            
            # Check for AI-suggested duration first, fall back to default
            visit_duration_minutes = place.get('duration_minutes') 
            if not visit_duration_minutes or not isinstance(visit_duration_minutes, int) or visit_duration_minutes <= 0:
                place_type = place.get('placeType', 'default')
                place_types = [place_type]
                visit_duration_minutes = get_visit_duration(place_types)
                logger.info(f"Using default duration {visit_duration_minutes} mins for {place_name}")
            else:
                logger.info(f"Using AI-suggested duration {visit_duration_minutes} mins for {place_name}")
            
            # Calculate projected end time for this place
            projected_end_time = current_datetime + timedelta(minutes=visit_duration_minutes)
            
            # CRITICAL: Check if this place would exceed our end time constraint
            if projected_end_time > end_datetime:
                # Calculate remaining time available
                remaining_minutes = (end_datetime - current_datetime).total_seconds() / 60
                
                if remaining_minutes < 15:  # Less than 15 minutes left
                    logger.warning(f"Stopping schedule at place {i} ({place_name}) - insufficient time remaining ({remaining_minutes:.1f} mins)")
                    break
                else:
                    # Adjust duration to fit remaining time (with 5-minute buffer)
                    adjusted_duration = max(15, int(remaining_minutes - 5))
                    logger.warning(f"Adjusting duration for {place_name} from {visit_duration_minutes} to {adjusted_duration} mins to fit end time")
                    visit_duration_minutes = adjusted_duration
                    projected_end_time = current_datetime + timedelta(minutes=visit_duration_minutes)
            
            # Extract basic place information
            place_id = place.get('id', f'place_{i}')
            place_type = place.get('placeType', 'default')
            
            # Get location coordinates
            location = place.get('location', {})
            lat = location.get('lat', 0)
            lng = location.get('lng', 0)
            
            # Get place address if available
            address = place.get('address', '')
            
            # Set start time for this place (current_datetime is already set correctly)
            visit_start_datetime = current_datetime
            visit_end_datetime = visit_start_datetime + timedelta(minutes=visit_duration_minutes)
            
            # Format times as strings (HH:MM)
            visit_start_str = visit_start_datetime.strftime('%H:%M')
            visit_end_str = visit_end_datetime.strftime('%H:%M')
            
            # Get AI review if present
            ai_review = place.get('ai_review')
            
            # Create the schedule item
            schedule_item = ScheduleItem(
                place_id=place_id,
                name=place_name,
                start_time=visit_start_str,
                end_time=visit_end_str,
                duration_minutes=visit_duration_minutes,
                ai_review=ai_review,
                address=address,
                placeType=place_type
            )
            
            # Calculate route to next place if not the last place
            if i < len(places) - 1:
                next_place = places[i + 1]
                next_location = next_place.get('location', {})
                next_lat = next_location.get('lat', 0)
                next_lng = next_location.get('lng', 0)
                
                # Get travel data to next place
                travel_time_minutes = 0
                distance_meters = 0
                polyline = ""
                
                # Use pre-calculated travel data if available
                if travel_data and i < len(travel_data):
                    duration_seconds, distance_meters, polyline = travel_data[i]
                    travel_time_minutes = math.ceil(duration_seconds / 60)
                else:
                    # Fallback to distance estimation
                    distance_km = haversine_distance(lat, lng, next_lat, next_lng)
                    distance_meters = int(distance_km * 1000)
                    travel_time_minutes = estimate_travel_time(distance_km, travel_mode)
                
                # Check if adding travel time would exceed end time
                travel_end_time = visit_end_datetime + timedelta(minutes=travel_time_minutes)
                if travel_end_time > end_datetime:
                    logger.warning(f"Stopping schedule - travel to next place would exceed end time at {travel_end_time.strftime('%H:%M')}")
                    # Don't add travel segment, and stop processing
                    schedule_items.append(schedule_item)
                    break
                
                # Create the route segment with proper Coordinates objects
                route_segment = RouteSegment(
                    start_location=Coordinates(lat=lat, lng=lng),
                    end_location=Coordinates(lat=next_lat, lng=next_lng),
                    distance={"text": format_distance(distance_meters), "value": distance_meters},
                    duration={"text": format_duration(travel_time_minutes * 60), "value": travel_time_minutes * 60},
                    polyline=polyline
                )
                
                schedule_item.travel_to_next = route_segment
                total_distance_meters += distance_meters
                
                # Update current_datetime for the next place
                # Add travel time to the end time of the current place
                travel_time_with_buffer = travel_time_minutes + TRAVEL_BUFFER_MINUTES
                current_datetime = visit_end_datetime + timedelta(minutes=travel_time_with_buffer)
            else:
                # For the last place, keep current_datetime at the end time of this place
                current_datetime = visit_end_datetime
            
            # Add to schedule
            schedule_items.append(schedule_item)
            
            # Final check: if we've reached or exceeded end time, stop
            if current_datetime >= end_datetime:
                logger.info(f"Schedule complete - reached end time constraint at {current_datetime.strftime('%H:%M')}")
                break
        
        # Add a dummy travel segment to the last place for map display purposes
        if schedule_items:
            last_item = schedule_items[-1]
            if last_item.travel_to_next is None and places:
                last_place_idx = len(schedule_items) - 1
                if last_place_idx < len(places):
                    last_place = places[last_place_idx]
                    last_location = last_place.get('location', {})
                    lat = last_location.get('lat', 0)
                    lng = last_location.get('lng', 0)
                    
                    last_item.travel_to_next = RouteSegment(
                        start_location=Coordinates(lat=lat, lng=lng),
                        end_location=Coordinates(lat=lat, lng=lng),
                        distance={"text": "0 m", "value": 0},
                        duration={"text": "0 mins", "value": 0},
                        polyline=""
                    )
        
        # Calculate total schedule duration (from start to end of last activity)
        if schedule_items:
            total_duration_minutes = calculate_total_duration(start_datetime, current_datetime)
            
            # Validate the schedule doesn't exceed time constraints
            if current_datetime > end_datetime:
                logger.error(f"SCHEDULE TIME OVERFLOW: Schedule ends at {current_datetime.strftime('%H:%M')} but should end by {end_time_str}")
                # Truncate to fit time constraint
                total_duration_minutes = (end_datetime - start_datetime).total_seconds() / 60
        else:
            total_duration_minutes = 0
            
        # Create and return the complete schedule
        return Schedule(
            items=schedule_items,
            total_duration_minutes=total_duration_minutes,
            total_distance_meters=total_distance_meters,
            day_overview=day_overview
        )
        
    except Exception as e:
        logger.error(f"Error in generate_schedule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate schedule: {str(e)}")

def calculate_total_duration(start_datetime: datetime, end_datetime: datetime) -> int:
    """Calculate total duration in minutes between two datetimes"""
    duration = end_datetime - start_datetime
    return int(duration.total_seconds() / 60)

async def calculate_travel_data(places: List[Dict[str, Any]], travel_mode: TravelMode = TravelMode.WALKING) -> List[Tuple[int, int, str]]:
    """
    Calculate travel times, distances and routes between sequential places using Google Maps API
    
    Args:
        places: List of places in sequential order
        travel_mode: Mode of transportation (walking, driving, bicycling, transit)
        
    Returns:
        List of tuples containing (duration_seconds, distance_meters, polyline)
    """
    if not GOOGLE_MAPS_API_KEY:
        logger.warning("GOOGLE_MAPS_API_KEY not set, using distance estimation")
        return []
    
    # Convert TravelMode enum to string for Google API
    travel_mode_str = travel_mode.value if isinstance(travel_mode, TravelMode) else travel_mode
    
    travel_data = []
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for i in range(len(places) - 1):
                origin = places[i]
                destination = places[i + 1]
                
                # Get location coordinates
                origin_location = origin.get('location', {})
                dest_location = destination.get('location', {})
                
                origin_lat = origin_location.get('lat', 0)
                origin_lng = origin_location.get('lng', 0)
                dest_lat = dest_location.get('lat', 0)
                dest_lng = dest_location.get('lng', 0)

                # Validate coordinates
                if not all([origin_lat, origin_lng, dest_lat, dest_lng]):
                    logger.warning(f"Invalid coordinates: origin={origin_lat},{origin_lng}, dest={dest_lat},{dest_lng}")
                    # Fallback to reasonable defaults based on travel mode
                    fallback_duration = get_fallback_duration(travel_mode)
                    travel_data.append((fallback_duration * 60, 5000, ""))
                    continue
                
                # Format coordinates for API request
                origin_str = f"{origin_lat},{origin_lng}"
                destination_str = f"{dest_lat},{dest_lng}"
                
                # Make request to Google Directions API
                response = await client.get(
                    "https://maps.googleapis.com/maps/api/directions/json",
                    params={
                        "origin": origin_str,
                        "destination": destination_str,
                        "mode": travel_mode_str,
                        "key": GOOGLE_MAPS_API_KEY
                    }
                )
                
                # Handle API errors
                if response.status_code != 200:
                    logger.error(f"Directions API error: {response.status_code}, {response.text}")
                    # Fallback to distance estimation
                    distance_km = haversine_distance(origin_lat, origin_lng, dest_lat, dest_lng)
                    travel_time_mins = estimate_travel_time(distance_km, travel_mode)
                    travel_data.append((travel_time_mins * 60, int(distance_km * 1000), ""))
                    continue
                
                result = response.json()
                
                if result.get("status") == "REQUEST_DENIED":
                    error_message = result.get("error_message", "Unknown API key error")
                    logger.error(f"Google API key error: {error_message}")
                    # Stop trying to use the API if the key is invalid
                    return []
                
                if result.get("status") != "OK" or not result.get("routes"):
                    logger.warning(f"No route found: {result.get('status')}")
                    # Fallback to distance estimation
                    distance_km = haversine_distance(origin_lat, origin_lng, dest_lat, dest_lng)
                    travel_time_mins = estimate_travel_time(distance_km, travel_mode)
                    travel_data.append((travel_time_mins * 60, int(distance_km * 1000), ""))
                    continue
                
                # Extract route data
                route = result["routes"][0]
                leg = route["legs"][0]
                
                duration_seconds = leg["duration"]["value"]
                distance_meters = leg["distance"]["value"]
                polyline = route.get("overview_polyline", {}).get("points", "")
                
                travel_data.append((duration_seconds, distance_meters, polyline))
                
                # Add small delay to avoid rate limiting
                await asyncio.sleep(0.2)
    
    except Exception as e:
        logger.error(f"Error getting directions: {e}")
        # Return empty list, will fall back to distance estimation
    
    return travel_data

def get_fallback_duration(travel_mode: TravelMode) -> int:
    """Get a reasonable fallback duration in minutes based on travel mode"""
    fallback_mins = {
        TravelMode.WALKING: 20,
        TravelMode.BICYCLING: 12,
        TravelMode.DRIVING: 10,
        TravelMode.TRANSIT: 15
    }
    return fallback_mins.get(travel_mode, 15)

def get_visit_duration(place_types: List[str]) -> int:
    """
    Determine visit duration based on place type
    
    Args:
        place_types: List of place types to check
        
    Returns:
        Duration in minutes
    """
    for place_type in place_types:
        if place_type and place_type.lower() in DEFAULT_VISIT_DURATION_MINUTES:
            return DEFAULT_VISIT_DURATION_MINUTES[place_type.lower()]
    return DEFAULT_VISIT_DURATION_MINUTES["default"]

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on earth
    
    Args:
        lat1, lon1: First point coordinates
        lat2, lon2: Second point coordinates
        
    Returns:
        Distance in kilometers
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return c * EARTH_RADIUS_KM

def estimate_travel_time(distance_km: float, travel_mode: TravelMode = TravelMode.WALKING) -> int:
    """
    Estimate travel time in minutes based on distance and travel mode
    
    Args:
        distance_km: Distance in kilometers
        travel_mode: Mode of transportation
        
    Returns:
        Estimated travel time in minutes
    """
    # Get speed based on travel mode
    speed = TRAVEL_SPEED_KM_PER_HOUR.get(travel_mode, TRAVEL_SPEED_KM_PER_HOUR[TravelMode.WALKING])
    
    # Calculate time in hours
    travel_time_hours = distance_km / speed
    
    # Convert to minutes and ensure a minimum reasonable time
    travel_mins = math.ceil(travel_time_hours * 60)
    min_time = 5 if travel_mode == TravelMode.WALKING else 3  # Minimum reasonable travel time
    
    return max(min_time, travel_mins)

def format_distance(meters: int) -> str:
    """Format distance in a human-readable way"""
    if meters < 1000:
        return f"{meters} m"
    else:
        return f"{meters/1000:.1f} km"

def format_duration(seconds: int) -> str:
    """Format duration in a human-readable way"""
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} mins"
    else:
        hours = minutes // 60
        remaining_minutes = minutes % 60
        if remaining_minutes == 0:
            return f"{hours} hours"
        else:
            return f"{hours} hours {remaining_minutes} mins" 