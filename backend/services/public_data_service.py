"""
Public Data Service for MongoDB Challenge
On-demand POI discovery and generation for global cities
"""

import requests
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import os
from db.models import PublicPOI
from db import get_database
from config import GOOGLE_API_KEY
import math

logger = logging.getLogger(__name__)

class PublicDataService:
    def __init__(self):
        self.geoapify_api_key = os.getenv("GEOAPIFY_API_KEY")
        
    async def search_pois_near_location(
        self, 
        latitude: float, 
        longitude: float, 
        radius_meters: int = 5000,
        categories: List[str] = None,
        search_text: str = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Args:
            latitude: Search center latitude
            longitude: Search center longitude  
            radius_meters: Search radius
            categories: Preferred POI categories
            search_text: Text search query
            limit: Maximum results to return
            
        Returns:
            List of POI dictionaries with relevance scoring
        """
        try:
            with get_database() as db:
                # Debug: Check total POIs in database
                total_pois_in_db = db.public_pois.count_documents({})
                logger.info(f"Database contains {total_pois_in_db} total POIs")
                
                # Debug: Check if this location has been generated before
                location_pois = db.public_pois.count_documents({
                    "generated_for_location": {"$regex": f"^{latitude:.6f},{longitude:.6f}"}
                })
                logger.info(f"POIs previously generated for this location: {location_pois}")
                
                # Step 1: Check existing data in MongoDB first
                logger.info(f"Checking existing POI data near ({latitude}, {longitude})")
                existing_pois = await self._search_existing_pois(
                    db, latitude, longitude, radius_meters, categories, search_text, limit * 3
                )
                
                # Step 2: Smart threshold based on location and previous generations
                if location_pois > 0:
                    # If we've generated for this location before, use lower threshold
                    min_threshold = min(10, limit // 3)
                    logger.info(f"Using location-aware threshold: {min_threshold} (location previously generated)")
                else:
                    # New location, need more comprehensive data
                    min_threshold = min(25, limit // 2)
                    logger.info(f"Using new location threshold: {min_threshold} (first time for this area)")
                
                if len(existing_pois) >= min_threshold:
                    logger.info(f"Found {len(existing_pois)} existing POIs - using cached data (threshold: {min_threshold})")
                    return existing_pois[:limit]
                
                # Step 3: Need more data - generate comprehensive dataset from live APIs
                logger.info(f"Insufficient existing data ({len(existing_pois)} POIs, need {min_threshold}) - generating from live APIs")
                new_pois = await self._generate_pois_from_apis(
                    latitude, longitude, radius_meters, categories, 200
                )
                
                # Step 4: Store new POIs in MongoDB (avoiding duplicates)
                if new_pois:
                    stored_count = await self._store_new_pois(db, new_pois, existing_pois)
                    logger.info(f"Stored {stored_count} new POIs in MongoDB")
                
                # Step 5: Combine and rank all available POIs
                all_pois = existing_pois + new_pois
                enhanced_pois = self._apply_intelligent_ranking(
                    all_pois, latitude, longitude, search_text, categories
                )
                
                # Step 6: Remove duplicates and return top results
                unique_pois = self._deduplicate_pois(enhanced_pois)
                
                logger.info(f"Final result: {len(unique_pois)} unique POIs for user")
                return unique_pois[:limit]
                
        except Exception as e:
            logger.error(f"Error in on-demand POI discovery: {e}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return []

    async def _search_existing_pois(
        self, 
        db, 
        latitude: float, 
        longitude: float, 
        radius_meters: int,
        categories: List[str],
        search_text: str,
        limit: int
    ) -> List[Dict[str, Any]]:
        """
        Search existing POIs in MongoDB using advanced aggregation pipelines.
        """
        try:
            # Build sophisticated aggregation pipeline
            pipeline = []
            
            # Stage 1: Text search MUST be first if using $text
            if search_text and search_text.strip():
                try:
                    # Try MongoDB text search first
                    pipeline.extend([
                        {
                            "$match": {
                                "$text": {"$search": search_text}
                            }
                        },
                        {
                            "$addFields": {
                                "text_score": {"$meta": "textScore"}
                            }
                        }
                    ])
                except:
                    # If text search fails, start with geospatial and add regex later
                    pipeline = [{
                        "$geoNear": {
                            "near": {
                                "type": "Point",
                                "coordinates": [longitude, latitude]
                            },
                            "distanceField": "distance_meters",
                            "maxDistance": radius_meters,
                            "spherical": True
                        }
                    }]
                    
                    # Add regex text search
                    pipeline.append({
                        "$match": {
                            "$or": [
                                {"name": {"$regex": search_text, "$options": "i"}},
                                {"address": {"$regex": search_text, "$options": "i"}},
                                {"category": {"$regex": search_text, "$options": "i"}}
                            ]
                        }
                    })
                    pipeline.append({
                        "$addFields": {"text_score": 5}
                    })
            else:
                # No text search - start with geospatial
                pipeline.append({
                    "$geoNear": {
                        "near": {
                            "type": "Point",
                            "coordinates": [longitude, latitude]
                        },
                        "distanceField": "distance_meters",
                        "maxDistance": radius_meters,
                        "spherical": True
                    }
                })
                pipeline.append({
                    "$addFields": {"text_score": 1}
                })
            
            # If we started with text search, add geospatial filtering
            if search_text and search_text.strip():
                if len(pipeline) == 2:  # We successfully used $text
                    pipeline.append({
                        "$match": {
                            "location": {
                                "$geoWithin": {
                                    "$centerSphere": [
                                        [longitude, latitude],
                                        radius_meters / 6378100  # Convert to radians
                                    ]
                                }
                            }
                        }
                    })
                    # Add distance calculation
                    pipeline.append({
                        "$addFields": {
                            "distance_meters": {
                                "$multiply": [
                                    {
                                        "$acos": {
                                            "$add": [
                                                {
                                                    "$multiply": [
                                                        {"$sin": {"$multiply": [{"$arrayElemAt": ["$location.coordinates", 1]}, math.pi / 180]}},
                                                        {"$sin": {"$multiply": [latitude, math.pi / 180]}}
                                                    ]
                                                },
                                                {
                                                    "$multiply": [
                                                        {"$cos": {"$multiply": [{"$arrayElemAt": ["$location.coordinates", 1]}, math.pi / 180]}},
                                                        {"$cos": {"$multiply": [latitude, math.pi / 180]}},
                                                        {"$cos": {"$multiply": [{"$subtract": [{"$arrayElemAt": ["$location.coordinates", 0]}, longitude]}, math.pi / 180]}}
                                                    ]
                                                }
                                            ]
                                        }
                                    },
                                    6378100
                                ]
                            }
                        }
                    })
            
            # Category filtering if specified
            if categories:
                pipeline.append({
                    "$match": {
                        "category": {"$in": categories}
                    }
                })
            
            # Calculate relevance score
            pipeline.append({
                "$addFields": {
                    "relevance_score": {
                        "$add": [
                            {"$multiply": [{"$ifNull": ["$rating", 3]}, 2]},  # Rating boost
                            "$text_score",  # Text relevance
                            {"$divide": [1000, {"$add": ["$distance_meters", 1]}]}  # Distance bonus
                        ]
                    }
                }
            })
            
            # Sort by relevance
            pipeline.append({
                "$sort": {
                    "relevance_score": -1,
                    "distance_meters": 1
                }
            })
            
            # Limit results
            pipeline.append({"$limit": limit * 2})
            
            results = list(db.public_pois.aggregate(pipeline))
            logger.info(f"MongoDB aggregation found {len(results)} existing POIs")
            return results
            
        except Exception as e:
            logger.error(f"Error searching existing POIs: {e}")
            return []

    async def _generate_pois_from_apis(
        self,
        latitude: float,
        longitude: float, 
        radius_meters: int,
        categories: List[str],
        limit: int
    ) -> List[Dict[str, Any]]:
        """
        Generate fresh POI data from live APIs (Geoapify/OpenStreetMap).
        This works globally for any city.
        """
        if not self.geoapify_api_key:
            logger.warning("No Geoapify API key - cannot generate new POI data")
            return []
            
        try:
            logger.info(f"Generating comprehensive POI dataset from Geoapify API")
            
            # Calculate expanded bounding box for comprehensive coverage
            # Use 2x radius for better coverage of the city area
            expanded_radius = radius_meters * 2
            lat_offset = (expanded_radius / 111000) * 1.5
            lng_offset = lat_offset / abs(math.cos(math.radians(latitude)))
            
            bbox = [
                longitude - lng_offset,  # min_lng
                latitude - lat_offset,   # min_lat  
                longitude + lng_offset,  # max_lng
                latitude + lat_offset    # max_lat
            ]
            
            # Comprehensive categories for full city coverage
            if not categories:
                categories = [
                    # Food & Dining
                    "catering.restaurant", "catering.cafe", "catering.fast_food", 
                    "catering.bar", "catering.pub", "catering.food_court",
                    "catering.ice_cream", "catering.bakery",
                    
                    # Tourism & Culture
                    "tourism.attraction", "tourism.museum", "tourism.sights",
                    "tourism.gallery", "tourism.zoo", "tourism.aquarium",
                    "tourism.theme_park", "tourism.viewpoint",
                    
                    # Entertainment
                    "entertainment.cinema", "entertainment.theatre", 
                    "entertainment.nightclub", "entertainment.casino",
                    "entertainment.bowling_alley", "entertainment.escape_game",
                    
                    # Leisure & Recreation
                    "leisure.park", "leisure.sports_centre", "leisure.fitness_centre",
                    "leisure.swimming_pool", "leisure.golf_course", "leisure.beach",
                    "leisure.playground", "leisure.garden",
                    
                    # Shopping
                    "commercial.shopping_mall", "commercial.supermarket",
                    "commercial.marketplace", "commercial.department_store",
                    "commercial.bookstore", "commercial.electronics",
                    
                    # Accommodation
                    "accommodation.hotel", "accommodation.hostel", 
                    "accommodation.motel", "accommodation.resort",
                    
                    # Services
                    "healthcare.hospital", "healthcare.dentist", "healthcare.pharmacy",
                    "education.university", "education.school", "education.library",
                    "service.beauty", "service.bank", "service.gas_station"
                ]
            
            all_pois = []
            
            # Generate POIs for each category with higher limits
            for category in categories:
                if len(all_pois) >= limit:
                    break
                    
                try:
                    url = "https://api.geoapify.com/v2/places"
                    params = {
                        "categories": category,
                        "filter": f"rect:{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}",
                        "limit": min(50, 50),  # Get 50 POIs per category
                        "apiKey": self.geoapify_api_key
                    }
                    
                    response = requests.get(url, params=params, timeout=15)
                    if response.status_code == 200:
                        data = response.json()
                        
                        for feature in data.get("features", []):
                            if len(all_pois) >= limit:
                                break
                                
                            props = feature.get("properties", {})
                            geometry = feature.get("geometry", {})
                            
                            if geometry.get("type") == "Point":
                                coords = geometry.get("coordinates", [])
                                
                                poi = {
                                    "poi_id": f"geoapify_{props.get('place_id', '')}",
                                    "name": props.get("name", "Unknown"),
                                    "location": {
                                        "type": "Point",
                                        "coordinates": [coords[0], coords[1]]  # [lng, lat]
                                    },
                                    "address": props.get("formatted", ""),
                                    "category": category,
                                    "subcategory": props.get("categories", [None])[0] if props.get("categories") else None,
                                    "opening_hours": props.get("opening_hours"),
                                    "rating": props.get("rating"),
                                    "source": "geoapify",
                                    "source_id": props.get("place_id", ""),
                                    "last_updated": datetime.utcnow(),
                                    "generated_for_location": f"{latitude},{longitude}"
                                }
                                all_pois.append(poi)
                        
                        # Rate limiting - be more aggressive to get data faster
                        await asyncio.sleep(0.05)
                        
                except Exception as category_error:
                    logger.warning(f"Error fetching {category}: {category_error}")
                    continue
            
            logger.info(f"Generated {len(all_pois)} POIs from live APIs")
            return all_pois
            
        except Exception as e:
            logger.error(f"Error generating POIs from APIs: {e}")
            return []
    
    async def _store_new_pois(
        self, 
        db, 
        new_pois: List[Dict[str, Any]], 
        existing_pois: List[Dict[str, Any]]
    ) -> int:
        """
        Store new POIs in MongoDB, avoiding duplicates.
        """
        try:
            # Get existing POI IDs to avoid duplicates
            existing_ids = set()
            for poi in existing_pois:
                existing_ids.add(poi.get('poi_id'))
            
            # Filter out POIs that already exist
            unique_new_pois = []
            for poi in new_pois:
                poi_id = poi.get('poi_id')
                if poi_id and poi_id not in existing_ids:
                    unique_new_pois.append(poi)
                    existing_ids.add(poi_id)  # Prevent duplicates within new_pois too
            
            # Store unique POIs in MongoDB
            if unique_new_pois:
                # Convert to POI model format for validation
                poi_models = []
                for poi_data in unique_new_pois:
                    try:
                        poi_model = PublicPOI(**poi_data)
                        poi_models.append(poi_model.dict())
                    except Exception as validation_error:
                        logger.warning(f"POI validation failed: {validation_error}")
                        continue
                
                if poi_models:
                    db.public_pois.insert_many(poi_models)
                    logger.info(f"Successfully stored {len(poi_models)} new POIs")
                    return len(poi_models)
            
            return 0
            
        except Exception as e:
            logger.error(f"Error storing POIs: {e}")
            return 0

    def _apply_intelligent_ranking(
        self,
        pois: List[Dict[str, Any]],
        latitude: float,
        longitude: float, 
        search_text: str,
        categories: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Apply intelligent AI-driven ranking to POI results.
        Ensure diverse categories while still respecting user preferences.
        """
        enhanced_pois = []
        
        # Category diversity tracking
        category_counts = {}
        
        for poi in pois:
            # Calculate distance if not already present
            distance = poi.get('distance_meters')
            if distance is None:
                poi_coords = poi.get('location', {}).get('coordinates', [0, 0])
                poi_lng, poi_lat = poi_coords[0], poi_coords[1]
                
                # Haversine distance calculation
                lat_diff = math.radians(latitude - poi_lat)
                lng_diff = math.radians(longitude - poi_lng)
                a = (math.sin(lat_diff/2) ** 2 + 
                     math.cos(math.radians(poi_lat)) * math.cos(math.radians(latitude)) * 
                     math.sin(lng_diff/2) ** 2)
                distance = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a)) * 6371000  # meters
                poi['distance_meters'] = distance
            
            # Calculate comprehensive AI score with diversity consideration
            base_score = poi.get('relevance_score', 0)
            
            # Distance scoring (closer is better)
            distance_score = max(0, 1000 - distance) / 100
            
            # Category preference scoring
            category_score = 10 if categories and poi.get('category') in categories else 5
            
            # Rating scoring  
            rating = poi.get('rating', 0)
            rating_score = rating * 3 if rating else 5
            
            # Text relevance scoring (reduce impact for better diversity)
            text_score = poi.get('text_score', 1) * 0.5  # Reduced from 1.0 to 0.5
            
            # Freshness scoring
            freshness_score = 5 if poi.get('source') == 'geoapify' else 3
            
            # Diversity penalty - reduce score if we have too many of this category
            poi_category = poi.get('category', 'unknown')
            category_count = category_counts.get(poi_category, 0)
            diversity_penalty = min(category_count * 2, 10)  # Max penalty of 10
            
            # Calculate final AI score with diversity consideration
            ai_score = (
                base_score * 0.25 +
                distance_score * 0.25 +
                category_score * 0.15 +
                rating_score * 0.15 +
                text_score * 0.1 +  # Reduced impact
                freshness_score * 0.1 -
                diversity_penalty  # Encourage diversity
            )
            
            poi['ai_relevance_score'] = ai_score
            poi['category_diversity_penalty'] = diversity_penalty
            enhanced_pois.append(poi)
            
            # Update category count
            category_counts[poi_category] = category_count + 1
        
        # Sort by AI relevance score with diversity considerations
        enhanced_pois.sort(key=lambda x: x.get('ai_relevance_score', 0), reverse=True)
        
        logger.info(f"Applied intelligent ranking with category diversity. Categories found: {list(category_counts.keys())}")
        return enhanced_pois

    def _deduplicate_pois(self, pois: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Remove duplicate POIs based on location proximity and name similarity.
        """
        unique_pois = []
        seen_locations = []
        
        for poi in pois:
            poi_coords = poi.get('location', {}).get('coordinates', [0, 0])
            poi_name = poi.get('name', '').lower()
            
            # Check if this POI is too similar to existing ones
            is_duplicate = False
            for seen_coords, seen_name in seen_locations:
                # Check distance (if within 50 meters and similar name, consider duplicate)
                lat_diff = poi_coords[1] - seen_coords[1]
                lng_diff = poi_coords[0] - seen_coords[0]
                distance = math.sqrt(lat_diff**2 + lng_diff**2) * 111000  # rough meters
                
                name_similarity = len(set(poi_name.split()) & set(seen_name.split()))
                
                if distance < 50 and name_similarity > 0:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                unique_pois.append(poi)
                seen_locations.append((poi_coords, poi_name))
        
        return unique_pois

    async def store_public_data(self, pois: List[PublicPOI]):
        """Store public POI data in MongoDB"""
        try:
            with get_database() as db:
                # Store POIs
                if pois:
                    poi_docs = [poi.dict() for poi in pois]
                    db.public_pois.insert_many(poi_docs)
                    logger.info(f"Stored {len(pois)} POIs")
                
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
            
            # Text index for semantic search
            try:
                db.public_pois.create_index([
                    ("name", "text"),
                    ("category", "text"),
                    ("subcategory", "text"),
                    ("address", "text"),
                    ("amenities", "text")
                ])
            except Exception as text_index_error:
                logger.warning(f"Text index creation failed (may already exist): {text_index_error}")
            
            logger.info("Created database indexes")
            
        except Exception as e:
            logger.error(f"Error creating indexes: {e}")

# Service instance
public_data_service = PublicDataService() 