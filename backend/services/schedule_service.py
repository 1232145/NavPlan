import logging
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple, Optional
import httpx
import math
from config import GOOGLE_MAPS_API_KEY
from db.models import Schedule, ScheduleItem, RouteSegment

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
} # TODO: Make this dynamic based on the place type

TRAVEL_BUFFER_MINUTES = 15  # Buffer time between places
EARTH_RADIUS_KM = 6371  # Earth radius in kilometers

async def generate_schedule(places: List[Dict[str, Any]], start_time_str: str) -> Schedule:
    """
    Generate a detailed schedule with travel times and visit durations
    
    Args:
        places: List of places in optimized order
        start_time_str: Start time for the schedule in HH:MM format
        
    Returns:
        Schedule object with detailed timeline
    """
    try:
        logger.info(f"Generating schedule for {len(places)} places starting at {start_time_str}")
        logger.debug(f"Places received: {places}")
        
        # Parse start time
        start_hour, start_minute = map(int, start_time_str.split(':'))
        current_time = datetime.now().replace(
            hour=start_hour, minute=start_minute, second=0, microsecond=0
        )
        
        # Pre-calculate all travel times and distances
        if len(places) > 1 and GOOGLE_MAPS_API_KEY:
            travel_data = await calculate_travel_data(places)
        else:
            travel_data = None
        
        schedule_items = []
        total_distance = 0
        total_duration = 0
        
        # Process each place
        for i, place in enumerate(places):
            # Create schedule item for this place
            place_name = place.get('name', f'Place {i+1}')
            place_id = place.get('id', f'place_{i}')  # Use 'id' as primary identifier
            place_types = [place.get('placeType', 'default')]  # Use placeType from frontend
            
            # Extract location data - adapt to our frontend structure
            location = place.get('location', {})
            lat = location.get('lat', 0)
            lng = location.get('lng', 0)
            
            logger.debug(f"Processing place {place_name} with location: {lat}, {lng}")
            
            # Determine visit duration based on place type
            visit_duration = get_visit_duration(place_types)
            
            # Set start and end times for this place
            start_time = current_time
            end_time = start_time + timedelta(minutes=visit_duration)
            
            # Format times as strings
            start_time_str = start_time.strftime('%H:%M')
            end_time_str = end_time.strftime('%H:%M')
            
            # Create activity description based on place type
            activity = generate_activity_description(place)
            
            # Create schedule item
            schedule_item = ScheduleItem(
                place_id=place_id,
                name=place_name,
                start_time=start_time_str,
                end_time=end_time_str,
                duration_minutes=visit_duration,
                activity=activity
            )
            
            # Calculate route to next place if not the last place
            if i < len(places) - 1:
                next_place = places[i + 1]
                next_location = next_place.get('location', {})
                next_lat = next_location.get('lat', 0) 
                next_lng = next_location.get('lng', 0)
                
                # Use pre-calculated travel data if available
                if travel_data and i < len(travel_data):
                    duration_seconds, distance_meters, polyline = travel_data[i]
                    travel_time_minutes = math.ceil(duration_seconds / 60)
                    
                    route_segment = RouteSegment(
                        start_location={
                            "lat": lat,
                            "lng": lng
                        },
                        end_location={
                            "lat": next_lat,
                            "lng": next_lng
                        },
                        distance={"text": format_distance(distance_meters), "value": distance_meters},
                        duration={"text": format_duration(duration_seconds), "value": duration_seconds},
                        polyline=polyline
                    )
                    
                    total_distance += distance_meters
                    
                else:
                    # Fallback to distance estimation
                    # Estimate distance and travel time
                    distance_km = haversine_distance(lat, lng, next_lat, next_lng)
                    distance_meters = int(distance_km * 1000)
                    travel_time_minutes = estimate_travel_time(distance_km)
                    
                    route_segment = RouteSegment(
                        start_location={"lat": lat, "lng": lng},
                        end_location={"lat": next_lat, "lng": next_lng},
                        distance={"text": format_distance(distance_meters), "value": distance_meters},
                        duration={"text": f"{travel_time_minutes} mins", "value": travel_time_minutes * 60},
                        polyline=""  # No polyline in fallback mode
                    )
                    
                    total_distance += distance_meters
                
                schedule_item.travel_to_next = route_segment
                
                # Move current time forward for next place
                current_time = end_time + timedelta(minutes=travel_time_minutes + TRAVEL_BUFFER_MINUTES)
            
            # Add to schedule
            schedule_items.append(schedule_item)
            total_duration += visit_duration
        
        # Ensure the last place has travel_to_next data for proper map display
        if len(schedule_items) > 0:
            last_item = schedule_items[-1]
            if last_item.travel_to_next is None and len(places) > 0:
                last_place = places[-1]
                last_location = last_place.get('location', {})
                lat = last_location.get('lat', 0)
                lng = last_location.get('lng', 0)
                
                # Create a dummy travel segment for the last place that points to itself
                # This ensures the map can display the marker correctly
                last_item.travel_to_next = RouteSegment(
                    start_location={"lat": lat, "lng": lng},
                    end_location={"lat": lat, "lng": lng},
                    distance={"text": "0 m", "value": 0},
                    duration={"text": "0 mins", "value": 0},
                    polyline=""
                )
                
                logger.debug(f"Added travel data to last place {last_item.name}: {lat}, {lng}")
        
        # Calculate total travel duration
        if len(schedule_items) > 1:
            travel_duration = (current_time - start_time).total_seconds() / 60 - total_duration
        else:
            travel_duration = 0
            
        total_duration += travel_duration
        
        return Schedule(
            items=schedule_items,
            total_duration_minutes=int(total_duration),
            total_distance_meters=total_distance
        )
        
    except Exception as e:
        logger.error(f"Error in generate_schedule: {e}")
        raise

async def calculate_travel_data(places: List[Dict[str, Any]]) -> List[Tuple[int, int, str]]:
    """
    Calculate travel times, distances and routes between sequential places using Google Maps API
    
    Returns:
        List of tuples containing (duration_seconds, distance_meters, polyline)
    """
    if not GOOGLE_MAPS_API_KEY:
        logger.warning("GOOGLE_MAPS_API_KEY not set, using distance estimation")
        return []
    
    travel_data = []
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for i in range(len(places) - 1):
                origin = places[i]
                destination = places[i + 1]
                
                # Extract location from our frontend structure
                origin_location = origin.get('location', {})
                dest_location = destination.get('location', {})
                
                origin_lat = origin_location.get('lat', 0)
                origin_lng = origin_location.get('lng', 0)
                dest_lat = dest_location.get('lat', 0)
                dest_lng = dest_location.get('lng', 0)
                
                # Skip API call if locations are invalid
                if not all([origin_lat, origin_lng, dest_lat, dest_lng]):
                    logger.warning(f"Invalid coordinates: origin={origin_lat},{origin_lng}, dest={dest_lat},{dest_lng}")
                    travel_data.append((900, 5000, ""))  # Default 15 mins, 5km
                    continue
                
                origin_str = f"{origin_lat},{origin_lng}"
                destination_str = f"{dest_lat},{dest_lng}"
                
                response = await client.get(
                    "https://maps.googleapis.com/maps/api/directions/json",
                    params={
                        "origin": origin_str,
                        "destination": destination_str,
                        "mode": "walking",  # Use walking mode for a day plan
                        "key": GOOGLE_MAPS_API_KEY
                    }
                )
                
                if response.status_code != 200:
                    logger.error(f"Directions API error: {response.status_code}, {response.text}")
                    # Fallback to estimation
                    distance_km = haversine_distance(origin_lat, origin_lng, dest_lat, dest_lng)
                    travel_time_mins = estimate_travel_time(distance_km)
                    travel_data.append((travel_time_mins * 60, int(distance_km * 1000), ""))
                    continue
                
                result = response.json()
                
                if result.get("status") != "OK" or not result.get("routes"):
                    logger.warning(f"No route found: {result.get('status')}")
                    # Fallback to estimation
                    distance_km = haversine_distance(origin_lat, origin_lng, dest_lat, dest_lng)
                    travel_time_mins = estimate_travel_time(distance_km)
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

def get_visit_duration(place_types: List[str]) -> int:
    """Determine visit duration based on place type"""
    for place_type in place_types:
        if place_type in DEFAULT_VISIT_DURATION_MINUTES:
            return DEFAULT_VISIT_DURATION_MINUTES[place_type]
    return DEFAULT_VISIT_DURATION_MINUTES["default"]

def generate_activity_description(place: Dict[str, Any]) -> str:
    """Generate a description of the activity based on place type"""
    place_name = place.get('name', 'this place')
    place_type = place.get('placeType', '').lower()
    
    activities = {
        "restaurant": f"Eat at {place_name}",
        "cafe": f"Have a coffee at {place_name}",
        "bar": f"Have a drink at {place_name}",
        "museum": f"Explore {place_name}",
        "art_gallery": f"View art at {place_name}",
        "park": f"Relax at {place_name}",
        "shopping_mall": f"Shop at {place_name}",
        "tourist_attraction": f"Visit {place_name}",
        "amusement_park": f"Have fun at {place_name}",
        "zoo": f"See animals at {place_name}",
        "aquarium": f"See marine life at {place_name}",
        "church": f"Visit {place_name}"
    }
    
    return activities.get(place_type, f"Visit {place_name}")

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

def estimate_travel_time(distance_km: float) -> int:
    """
    Estimate travel time in minutes based on distance
    Assumes walking speed of 5 km/h
    
    Args:
        distance_km: Distance in kilometers
        
    Returns:
        Estimated travel time in minutes
    """
    walking_speed_km_per_hour = 5.0  # Average walking speed
    travel_time_hours = distance_km / walking_speed_km_per_hour
    return max(5, math.ceil(travel_time_hours * 60))  # At least 5 minutes

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