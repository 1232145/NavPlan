import logging
from fastapi import APIRouter, Body, HTTPException, Depends
from datetime import datetime
from typing import Dict, Any, List
from bson.objectid import ObjectId
from pymongo.errors import PyMongoError
from db import get_database
from db.models import ArchivedList
from utils.auth import get_current_user
from config import API_PREFIX
from services.ai_service import query_AI_openRouter
from config import OPENROUTER_API_KEY
import json

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix=API_PREFIX, tags=["archived-lists"])

@router.post("/archived-lists")
async def create_archived_list(
    archived_list: ArchivedList = Body(...),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Create a new archived list of places with public data enrichment
    """
    try:
        with get_database() as db:
            # Enrich with public POI data
            similar_places = []
            total_popularity = 0
            place_count = 0
            ai_tags = []
            
            for place in archived_list.places:
                lat = place.get("geometry", {}).get("location", {}).get("lat", 0)
                lng = place.get("geometry", {}).get("location", {}).get("lng", 0)
                
                if lat and lng:
                    # Find nearby public POIs
                    nearby_pois = db.public_pois.find({
                        "location": {
                            "$near": {
                                "$geometry": {"type": "Point", "coordinates": [lng, lat]},
                                "$maxDistance": 200  # 200 meters
                            }
                        }
                    }).limit(2)
                    
                    for poi in nearby_pois:
                        similar_places.append(poi["poi_id"])
                        if poi.get("rating"):
                            total_popularity += poi["rating"]
                            place_count += 1
                        
                        # Collect categories for AI tags
                        if poi.get("category"):
                            category_parts = poi["category"].split(".")
                            ai_tags.extend(category_parts)
            
            # Calculate average popularity score
            popularity_score = (total_popularity / place_count) if place_count > 0 else None
            
            # Generate AI tags from categories
            unique_tags = list(set(ai_tags))[:5]  # Top 5 unique tags
            
            result = db.archived_lists.update_one(
                {"user_id": user["id"]},
                {"$push": {
                    "lists": {
                        "_id": str(ObjectId()),
                        "name": archived_list.name,
                        "places": archived_list.places,
                        "note": archived_list.note,
                        "date": datetime.utcnow(),
                        "similar_public_places": similar_places[:10],  # Limit to 10
                        "popularity_score": popularity_score,
                        "ai_generated_tags": unique_tags
                    }
                }},
                upsert=True
            )
            return {"id": str(result.upserted_id) if result.upserted_id else "updated"}
    except PyMongoError as e:
        logger.error(f"Database error in create_archived_list: {e}")
        raise HTTPException(status_code=500, detail="Database error")
    except Exception as e:
        logger.error(f"Unexpected error in create_archived_list: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/archived-lists", response_model=List[Dict[str, Any]])
async def get_archived_lists(
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get all archived lists for the current user
    """
    try:
        with get_database() as db:
            user_lists = db.archived_lists.find_one({"user_id": user["id"]})
            if not user_lists:
                return []
            lists = user_lists.get("lists", [])
            return [{
                "id": list_item["_id"],
                "name": list_item["name"],
                "places": list_item["places"],
                "note": list_item.get("note"),
                "date": list_item["date"].isoformat()
            } for list_item in lists]
    except PyMongoError as e:
        logger.error(f"Database error in get_archived_lists: {e}")
        raise HTTPException(status_code=500, detail="Database error")
    except Exception as e:
        logger.error(f"Unexpected error in get_archived_lists: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/archived-lists/{list_id}")
async def update_archived_list(
    list_id: str,
    archived_list: ArchivedList = Body(...),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update an existing archived list
    """
    try:
        with get_database() as db:
            result = db.archived_lists.update_one(
                {"user_id": user["id"], "lists._id": list_id},
                {"$set": {
                    "lists.$.name": archived_list.name,
                    "lists.$.places": archived_list.places,
                    "lists.$.note": archived_list.note
                }}
            )
            
            if result.modified_count == 0:
                raise HTTPException(status_code=404, detail="List not found")
            
            return {"ok": True}
    except PyMongoError as e:
        logger.error(f"Database error in update_archived_list: {e}")
        raise HTTPException(status_code=500, detail="Database error")
    except Exception as e:
        logger.error(f"Unexpected error in update_archived_list: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/archived-lists/{list_id}")
async def delete_archived_list(
    list_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Delete an archived list
    """
    try:
        with get_database() as db:
            result = db.archived_lists.update_one(
                {"user_id": user["id"]},
                {"$pull": {"lists": {"_id": list_id}}}
            )
            
            if result.modified_count == 0:
                raise HTTPException(status_code=404, detail="List not found")
            
            return {"ok": True}
    except PyMongoError as e:
        logger.error(f"Database error in delete_archived_list: {e}")
        raise HTTPException(status_code=500, detail="Database error")
    except Exception as e:
        logger.error(f"Unexpected error in delete_archived_list: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/archived-lists/{list_id}/similar-places")
async def get_similar_places(
    list_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Find similar public places for an archived list using vector search
    """
    try:
        with get_database() as db:
            # Get the user's archived list
            user_lists = db.archived_lists.find_one({"user_id": user["id"]})
            if not user_lists:
                raise HTTPException(status_code=404, detail="No lists found")
            
            target_list = None
            for list_item in user_lists.get("lists", []):
                if list_item["_id"] == list_id:
                    target_list = list_item
                    break
            
            if not target_list:
                raise HTTPException(status_code=404, detail="List not found")
            
            # Generate search terms from the user's places using AI
            place_names = [place.get("name", "") for place in target_list["places"]]
            place_types = [place.get("placeType", "") for place in target_list["places"]]
            
            if OPENROUTER_API_KEY:
                # Use AI to generate semantic search terms
                prompt = f"""
                Analyze these places and generate search terms for finding similar places:
                Places: {', '.join(place_names)}
                Types: {', '.join(place_types)}
                
                Return JSON with:
                {{
                    "search_terms": ["term1", "term2", "term3"],
                    "categories": ["category1", "category2"]
                }}
                """
                
                ai_response = await query_AI_openRouter(prompt, "google/gemma-3-27b-it:free", OPENROUTER_API_KEY)
                content = ai_response["choices"][0]["message"]["content"]
                search_data = json.loads(content)
                search_terms = search_data.get("search_terms", place_names[:3])
            else:
                # Fallback to simple search terms
                search_terms = place_names[:3]
            
            # Search public POIs using text search
            similar_places = []
            for term in search_terms:
                if term:
                    results = db.public_pois.find(
                        {"$text": {"$search": term}},
                        {"score": {"$meta": "textScore"}}
                    ).sort([("score", {"$meta": "textScore"})]).limit(5)
                    
                    for poi in results:
                        # Convert GeoJSON to lat/lng format for frontend
                        location = poi["location"]
                        if location.get("type") == "Point" and location.get("coordinates"):
                            coords = location["coordinates"]
                            location_formatted = {"lat": coords[1], "lng": coords[0]}
                        else:
                            location_formatted = location
                            
                        similar_places.append({
                            "poi_id": poi["poi_id"],
                            "name": poi["name"],
                            "location": location_formatted,
                            "address": poi["address"],
                            "category": poi["category"],
                            "rating": poi.get("rating"),
                            "source": poi["source"],
                            "relevance_score": poi.get("score", 0)
                        })
            
            # Remove duplicates and sort by relevance
            seen_ids = set()
            unique_places = []
            for place in similar_places:
                if place["poi_id"] not in seen_ids:
                    seen_ids.add(place["poi_id"])
                    unique_places.append(place)
            
            unique_places.sort(key=lambda x: x["relevance_score"], reverse=True)
            
            return {
                "list_id": list_id,
                "list_name": target_list["name"],
                "similar_places": unique_places[:10],  # Top 10 results
                "search_terms_used": search_terms
            }
            
    except PyMongoError as e:
        logger.error(f"Database error in get_similar_places: {e}")
        raise HTTPException(status_code=500, detail="Database error")
    except Exception as e:
        logger.error(f"Unexpected error in get_similar_places: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") 