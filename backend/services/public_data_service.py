"""
Public Data Service for MongoDB Challenge
Integrates OpenStreetMap, Foursquare, and academic datasets
"""

import requests
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import os
from db.models import PublicPOI, CheckinPattern
from db import get_database
from config import GOOGLE_API_KEY

logger = logging.getLogger(__name__)

class PublicDataService:
    def __init__(self):
        self.geoapify_api_key = os.getenv("GEOAPIFY_API_KEY")
        
    async def import_osm_pois(self, bbox: List[float], categories: List[str] = None) -> List[PublicPOI]:
        """
        Import POIs from OpenStreetMap via Geoapify Places API
        bbox: [min_lon, min_lat, max_lon, max_lat]
        """
        if not self.geoapify_api_key:
            logger.error("Geoapify API key not configured")
            return []
            
        try:
            # Default categories if none specified
            if not categories:
                categories = [
                    "catering.restaurant",
                    "catering.cafe", 
                    "tourism.attraction",
                    "tourism.sights",
                    "accommodation.hotel",
                    "commercial.supermarket",
                    "entertainment.museum",
                    "leisure.park"
                ]
            
            all_pois = []
            
            for category in categories:
                url = "https://api.geoapify.com/v2/places"
                params = {
                    "categories": category,
                    "filter": f"rect:{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}",
                    "limit": 500,
                    "apiKey": self.geoapify_api_key
                }
                
                response = requests.get(url, params=params)
                if response.status_code == 200:
                    data = response.json()
                    
                    for feature in data.get("features", []):
                        props = feature.get("properties", {})
                        geometry = feature.get("geometry", {})
                        
                        if geometry.get("type") == "Point":
                            coords = geometry.get("coordinates", [])
                            
                            poi = PublicPOI(
                                poi_id=f"osm_{props.get('place_id', '')}",
                                name=props.get("name", "Unknown"),
                                location={
                                    "type": "Point",
                                    "coordinates": [coords[0], coords[1]]  # [lng, lat] for GeoJSON
                                },
                                address=props.get("formatted", ""),
                                category=category,
                                subcategory=props.get("categories", [None])[0] if props.get("categories") else None,
                                opening_hours=props.get("opening_hours"),
                                rating=props.get("rating"),
                                amenities=props.get("categories", []),
                                source="osm",
                                source_id=props.get("place_id", ""),
                                last_updated=datetime.utcnow()
                            )
                            all_pois.append(poi)
                            
                await asyncio.sleep(0.1)  # Rate limiting
                
            logger.info(f"Imported {len(all_pois)} POIs from OpenStreetMap")
            return all_pois
            
        except Exception as e:
            logger.error(f"Error importing OSM POIs: {e}")
            return []
    
    async def import_foursquare_open_data(self, file_path: str) -> List[PublicPOI]:
        """
        Import Foursquare Open Source Places dataset
        """
        try:
            pois = []
            
            # This would read from the Foursquare open dataset
            # For now, this is a placeholder for the actual implementation
            logger.info("Foursquare open dataset import would be implemented here")
            
            return pois
            
        except Exception as e:
            logger.error(f"Error importing Foursquare data: {e}")
            return []
    
    async def analyze_checkin_patterns(self, checkin_data: List[Dict]) -> List[CheckinPattern]:
        """
        Analyze check-in patterns from academic datasets
        """
        try:
            patterns = []
            
            # Group check-ins by location and analyze patterns
            location_groups = {}
            
            for checkin in checkin_data:
                lat = round(float(checkin.get("lat", 0)), 3)
                lng = round(float(checkin.get("lng", 0)), 3)
                location_key = f"{lat},{lng}"
                
                if location_key not in location_groups:
                    location_groups[location_key] = []
                location_groups[location_key].append(checkin)
            
            for location_key, checkins in location_groups.items():
                if len(checkins) >= 5:  # Minimum threshold for pattern analysis
                    lat, lng = map(float, location_key.split(","))
                    
                    # Analyze temporal patterns
                    time_patterns = self._analyze_temporal_patterns(checkins)
                    
                    pattern = CheckinPattern(
                        pattern_id=f"pattern_{location_key}",
                        location={
                            "type": "Point", 
                            "coordinates": [lng, lat]  # [lng, lat] for GeoJSON
                        },
                        venue_category=checkins[0].get("venue_category", "unknown"),
                        time_patterns=time_patterns,
                        popularity_score=len(checkins) / 100.0  # Normalized score
                    )
                    patterns.append(pattern)
            
            logger.info(f"Analyzed {len(patterns)} check-in patterns")
            return patterns
            
        except Exception as e:
            logger.error(f"Error analyzing check-in patterns: {e}")
            return []
    
    def _analyze_temporal_patterns(self, checkins: List[Dict]) -> Dict[str, Any]:
        """Analyze temporal patterns in check-ins"""
        hour_counts = {}
        day_counts = {}
        
        for checkin in checkins:
            # Parse time if available
            time_str = checkin.get("time", "")
            if ":" in time_str:
                hour = int(time_str.split(":")[0])
                hour_counts[hour] = hour_counts.get(hour, 0) + 1
            
            # Parse date if available
            date_str = checkin.get("date", "")
            if "-" in date_str:
                # Assuming format: year-month-day
                try:
                    date_parts = date_str.split("-")
                    if len(date_parts) >= 2:
                        month = int(date_parts[1])
                        day_counts[month] = day_counts.get(month, 0) + 1
                except:
                    pass
        
        return {
            "hourly_distribution": hour_counts,
            "monthly_distribution": day_counts,
            "peak_hour": max(hour_counts.items(), key=lambda x: x[1])[0] if hour_counts else None,
            "peak_month": max(day_counts.items(), key=lambda x: x[1])[0] if day_counts else None
        }
    

    
    async def store_public_data(self, pois: List[PublicPOI], patterns: List[CheckinPattern]):
        """Store public data in MongoDB"""
        try:
            with get_database() as db:
                # Store POIs
                if pois:
                    poi_docs = [poi.dict() for poi in pois]
                    db.public_pois.insert_many(poi_docs)
                    logger.info(f"Stored {len(pois)} POIs")
                
                # Store patterns
                if patterns:
                    pattern_docs = [pattern.dict() for pattern in patterns]
                    db.checkin_patterns.insert_many(pattern_docs)
                    logger.info(f"Stored {len(patterns)} check-in patterns")
                
                # Create indexes for efficient querying
                self._create_indexes(db)
                
        except Exception as e:
            logger.error(f"Error storing public data: {e}")
    
    def _create_indexes(self, db):
        """Create indexes for efficient querying"""
        try:
            # POI indexes
            db.public_pois.create_index([("location", "2dsphere")])
            db.public_pois.create_index("category")
            db.public_pois.create_index("source")
            
            # Pattern indexes
            db.checkin_patterns.create_index([("location", "2dsphere")])
            db.checkin_patterns.create_index("venue_category")
            
            logger.info("Created database indexes")
            
        except Exception as e:
            logger.error(f"Error creating indexes: {e}")

# Service instance
public_data_service = PublicDataService() 