from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

# Archived Lists Models
class ArchivedList(BaseModel):
    """Model for creating/updating an archived list"""
    name: str
    places: List[Dict[str, Any]]
    note: Optional[str] = None

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
    places: List[Dict[str, Any]]
    start_time: str = "09:00"  # Default start time
    end_time: str = "19:00"    # Default end time
    travel_mode: str = "walking"  # Default travel mode (walking, driving, bicycling, transit) 
    prompt: Optional[str] = None  # Optional custom prompt for AI optimization
    day_overview: Optional[str] = None # Optional AI-generated day overview