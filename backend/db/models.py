from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

# Archived Lists Models
class ArchivedList(BaseModel):
    """Model for creating/updating an archived list"""
    name: str
    places: List[Dict[str, Any]]
    note: Optional[str] = None
    similar_public_places: List[str] = []  # POI IDs from public datasets
    popularity_score: Optional[float] = None
    ai_generated_tags: List[str] = []

# Schedule Models
class RouteSegment(BaseModel):
    """Model representing a route segment between two places"""
    start_location: Dict[str, float]
    end_location: Dict[str, float]
    distance: Dict[str, Any]  # {text: "5 km", value: 5000}
    duration: Dict[str, Any]  # {text: "10 mins", value: 600}
    polyline: str

class ScheduleItem(BaseModel):
    """Model representing a place visit in the schedule"""
    place_id: str
    name: str
    start_time: str
    end_time: str
    duration_minutes: int
    travel_to_next: Optional[RouteSegment] = None
    ai_review: Optional[str] = None
    address: Optional[str] = None
    placeType: Optional[str] = None

class Schedule(BaseModel):
    """Model for a complete schedule"""
    items: List[ScheduleItem]
    total_duration_minutes: int
    total_distance_meters: int
    day_overview: Optional[str] = None

class ScheduleRequest(BaseModel):
    """Model for schedule generation request"""
    places: List[Dict[str, Any]] = []
    start_time: str = "09:00"  # Default start time
    end_time: str = "19:00"    # Default end time
    travel_mode: str = "walking"  # Default travel mode (walking, driving, bicycling, transit) 
    prompt: Optional[str] = None  # Optional custom prompt for AI optimization
    day_overview: Optional[str] = None # Optional AI-generated day overview

class LocationScheduleRequest(ScheduleRequest):
    """Model for location-based schedule generation request that extends ScheduleRequest"""
    latitude: float
    longitude: float
    radius_meters: int = 5000  # Default 5km radius
    categories: Optional[List[str]] = None  # Optional category filters
    max_places: int = 20  # Maximum places to consider from public POI data

# Enhanced Models for MongoDB Challenge - Public Dataset Integration

class PublicPOI(BaseModel):
    """Model for public POI data from OpenStreetMap/Foursquare"""
    poi_id: str
    name: str
    location: Dict[str, Any]  # GeoJSON format: {type: "Point", coordinates: [lng, lat]}
    address: str
    category: str
    subcategory: Optional[str] = None
    opening_hours: Optional[str] = None
    rating: Optional[float] = None
    amenities: List[str] = []
    source: str  # "osm", "foursquare", "poidata"
    source_id: str
    last_updated: datetime

class CheckinPattern(BaseModel):
    """Model for check-in pattern analysis from academic datasets"""
    pattern_id: str
    location: Dict[str, Any]  # GeoJSON format: {type: "Point", coordinates: [lng, lat]}
    venue_category: str
    time_patterns: Dict[str, Any]  # hour, day, season patterns
    popularity_score: float