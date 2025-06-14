from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from enum import Enum

class TravelMode(str, Enum):
    """Supported travel modes"""
    WALKING = "walking"
    DRIVING = "driving"
    BICYCLING = "bicycling"
    TRANSIT = "transit"

class BalanceMode(str, Enum):
    """Schedule balance modes"""
    FOCUSED = "focused"
    BALANCED = "balanced"
    DIVERSE = "diverse"

# Core Location and Route Models (consolidated)
class Coordinates(BaseModel):
    """Standard coordinates model used across the system"""
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lng: float = Field(..., ge=-180, le=180, description="Longitude")

class RouteSegment(BaseModel):
    """Model representing a route segment between two places"""
    start_location: Coordinates
    end_location: Coordinates
    distance: Dict[str, Any]  # {text: "5 km", value: 5000}
    duration: Dict[str, Any]  # {text: "10 mins", value: 600}
    polyline: str = ""

# Enhanced Schedule Models
class ScheduleItem(BaseModel):
    """Model representing a place visit in the schedule"""
    place_id: str
    name: str
    start_time: str = Field(..., pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    end_time: str = Field(..., pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    duration_minutes: int = Field(..., gt=0, le=480)  # Max 8 hours per place
    travel_to_next: Optional[RouteSegment] = None
    ai_review: Optional[str] = None
    address: Optional[str] = None
    placeType: Optional[str] = None

class Schedule(BaseModel):
    """Model for a complete schedule"""
    items: List[ScheduleItem]
    total_duration_minutes: int = Field(..., ge=0)
    total_distance_meters: int = Field(..., ge=0)
    day_overview: Optional[str] = None

# NEW: Saved Schedule Models for Archive Lists
class SavedScheduleMetadata(BaseModel):
    """Metadata for a saved schedule attached to an archive list"""
    schedule_id: str = Field(..., description="Unique identifier for this saved schedule")
    name: str = Field(..., min_length=1, max_length=100, description="User-defined name for this schedule")
    travel_mode: TravelMode = Field(..., description="Transportation mode used")
    start_time: str = Field(..., pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    end_time: str = Field(..., pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_modified: datetime = Field(default_factory=datetime.utcnow)
    is_favorite: bool = False
    
class SavedSchedule(BaseModel):
    """Complete saved schedule with full data"""
    metadata: SavedScheduleMetadata
    schedule: Schedule
    generation_preferences: Optional[Dict[str, Any]] = None  # Store original preferences used
    place_toggles: Dict[str, bool] = Field(default_factory=dict)  # Track which places were enabled/disabled

# Enhanced Archived List Model
class ArchivedList(BaseModel):
    """Enhanced model for archived lists with schedule attachment capability"""
    name: str = Field(..., min_length=1, max_length=100)
    places: List[Dict[str, Any]]
    note: Optional[str] = Field(None, max_length=500)
    
    # Public data enrichment (existing)
    similar_public_places: List[str] = Field(default_factory=list)
    popularity_score: Optional[float] = Field(None, ge=0, le=5)
    ai_generated_tags: List[str] = Field(default_factory=list)
    
    # NEW: Schedule attachment capability
    saved_schedules: List[SavedSchedule] = Field(default_factory=list, max_items=3)
    
    def get_schedule_by_id(self, schedule_id: str) -> Optional[SavedSchedule]:
        """Helper method to find a schedule by ID"""
        return next((s for s in self.saved_schedules if s.metadata.schedule_id == schedule_id), None)
    
    def can_add_schedule(self) -> bool:
        """Check if more schedules can be added (max 3)"""
        return len(self.saved_schedules) < 3
    
    def get_available_slot_number(self) -> Optional[int]:
        """Get the next available slot number (1, 2, or 3)"""
        if not self.can_add_schedule():
            return None
        used_slots = {i for i in range(1, 4) if any(f"Slot {i}" in s.metadata.name for s in self.saved_schedules)}
        available_slots = set(range(1, 4)) - used_slots
        return min(available_slots) if available_slots else None

# Consolidated User Preferences Model
class UserPreferences(BaseModel):
    """Consolidated model for user preferences in schedule generation"""
    must_include: List[str] = Field(default_factory=list, description="Categories that must be included")
    balance_mode: BalanceMode = BalanceMode.BALANCED
    max_places: int = Field(12, ge=3, le=20, description="Maximum number of places in schedule")
    meal_requirements: bool = Field(False, description="Ensure meal coverage")

# Consolidated Schedule Request Models
class BaseScheduleRequest(BaseModel):
    """Base model for schedule requests with common fields"""
    start_time: str = Field("09:00", pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    end_time: str = Field("19:00", pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    travel_mode: TravelMode = TravelMode.WALKING
    prompt: Optional[str] = Field(None, max_length=500)
    day_overview: Optional[str] = Field(None, max_length=1000)
    preferences: Optional[UserPreferences] = None

class ScheduleRequest(BaseScheduleRequest):
    """Model for schedule generation from existing places"""
    places: List[Dict[str, Any]] = Field(default_factory=list)

class LocationScheduleRequest(BaseScheduleRequest):
    """Model for location-based schedule generation"""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_meters: int = Field(5000, ge=500, le=50000)
    categories: Optional[List[str]] = None
    max_places: int = Field(20, ge=5, le=50)
    include_current_location: bool = False

# NEW: Archive Schedule Management Models
class SaveScheduleRequest(BaseModel):
    """Request to save a schedule to an archive list"""
    archive_list_id: str
    schedule_name: str = Field(..., min_length=1, max_length=100)
    schedule: Schedule
    travel_mode: TravelMode
    start_time: str = Field(..., pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    end_time: str = Field(..., pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    generation_preferences: Optional[Dict[str, Any]] = None
    place_toggles: Dict[str, bool] = Field(default_factory=dict)
    replace_existing_slot: Optional[int] = Field(None, ge=1, le=3)

class UpdateScheduleRequest(BaseModel):
    """Request to update an existing saved schedule"""
    archive_list_id: str
    schedule_id: str
    updates: Dict[str, Any]  # Flexible updates (name, is_favorite, etc.)

# Public POI Models (cleaned up)
class PublicPOI(BaseModel):
    """Model for public POI data from external sources"""
    poi_id: str
    name: str
    location: Dict[str, Any]  # GeoJSON format: {type: "Point", coordinates: [lng, lat]}
    address: str
    category: str
    subcategory: Optional[str] = None
    opening_hours: Optional[str] = None
    rating: Optional[float] = Field(None, ge=0, le=5)
    amenities: List[str] = Field(default_factory=list)
    source: str  # "osm", "foursquare", "geoapify"
    source_id: str
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    generated_for_location: Optional[str] = None  # Track generation context