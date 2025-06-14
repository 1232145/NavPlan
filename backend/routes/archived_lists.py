import logging
from fastapi import APIRouter, Body, HTTPException, Depends
from datetime import datetime
from typing import Dict, Any, List
from bson.objectid import ObjectId
from pymongo.errors import PyMongoError
from db import get_database
from db.models import ArchivedList, SaveScheduleRequest, UpdateScheduleRequest, SavedSchedule, SavedScheduleMetadata
from utils.auth import get_current_user
from config import API_PREFIX
from services.ai_service import query_AI_openRouter
from config import OPENROUTER_API_KEY
import json
import uuid

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
            # Enrich with public POI data (consolidated logic)
            enrichment_data = await _enrich_with_public_data(db, archived_list.places)
            
            # Create the list document
            list_doc = {
                "_id": str(ObjectId()),
                "name": archived_list.name,
                "places": archived_list.places,
                "note": archived_list.note,
                "date": datetime.utcnow(),
                **enrichment_data,  # Spread enrichment data
                "saved_schedules": []  # Initialize empty schedules array
            }
            
            result = db.archived_lists.update_one(
                {"user_id": user["id"]},
                {"$push": {"lists": list_doc}},
                upsert=True
            )
            
            return {"id": list_doc["_id"], "message": "Archive list created successfully"}
            
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
    Get all archived lists for the current user with schedule information
    """
    try:
        with get_database() as db:
            user_lists = db.archived_lists.find_one({"user_id": user["id"]})
            if not user_lists:
                return []
            
            lists = user_lists.get("lists", [])
            
            # Enhanced response with schedule metadata
            enhanced_lists = []
            for list_item in lists:
                enhanced_list = {
                    "id": list_item["_id"],
                    "name": list_item["name"],
                    "places": list_item["places"],
                    "note": list_item.get("note"),
                    "date": list_item["date"].isoformat(),
                    "saved_schedules": list_item.get("saved_schedules", []),
                    "schedule_count": len(list_item.get("saved_schedules", [])),
                    "can_add_schedule": len(list_item.get("saved_schedules", [])) < 3,
                    # Public data enrichment
                    "similar_public_places": list_item.get("similar_public_places", []),
                    "popularity_score": list_item.get("popularity_score"),
                    "ai_generated_tags": list_item.get("ai_generated_tags", [])
                }
                enhanced_lists.append(enhanced_list)
            
            return enhanced_lists
            
    except PyMongoError as e:
        logger.error(f"Database error in get_archived_lists: {e}")
        raise HTTPException(status_code=500, detail="Database error")
    except Exception as e:
        logger.error(f"Unexpected error in get_archived_lists: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/archived-lists/{list_id}")
async def update_archived_list(
    list_id: str,
    update_data: Dict[str, Any] = Body(...),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update an existing archived list (consolidated update logic)
    """
    try:
        with get_database() as db:
            # Build update fields dynamically (existing logic)
            update_fields = {}
            if "name" in update_data:
                update_fields["lists.$.name"] = update_data["name"]
            if "places" in update_data:
                update_fields["lists.$.places"] = update_data["places"]
            if "note" in update_data:
                update_fields["lists.$.note"] = update_data["note"]
            
            if not update_fields:
                raise HTTPException(status_code=400, detail="No valid fields to update")
            
            result = db.archived_lists.update_one(
                {"user_id": user["id"], "lists._id": list_id},
                {"$set": update_fields}
            )
            
            if result.modified_count == 0:
                raise HTTPException(status_code=404, detail="List not found")
            
            return {"ok": True, "message": "Archive list updated successfully"}
            
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
    Delete an archived list and all its saved schedules
    """
    try:
        with get_database() as db:
            result = db.archived_lists.update_one(
                {"user_id": user["id"]},
                {"$pull": {"lists": {"_id": list_id}}}
            )
            
            if result.modified_count == 0:
                raise HTTPException(status_code=404, detail="List not found")
            
            return {"ok": True, "message": "Archive list deleted successfully"}
            
    except PyMongoError as e:
        logger.error(f"Database error in delete_archived_list: {e}")
        raise HTTPException(status_code=500, detail="Database error")
    except Exception as e:
        logger.error(f"Unexpected error in delete_archived_list: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# NEW: Archive Schedule Management Routes

@router.post("/archived-lists/{list_id}/schedules")
async def save_schedule_to_archive(
    list_id: str,
    request: SaveScheduleRequest = Body(...),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Save a schedule to an archive list (max 3 schedules per list)
    """
    try:
        with get_database() as db:
            # Validate the archive list exists and belongs to user
            user_lists = db.archived_lists.find_one({"user_id": user["id"]})
            if not user_lists:
                raise HTTPException(status_code=404, detail="No archive lists found")
            
            target_list = next((lst for lst in user_lists.get("lists", []) if lst["_id"] == list_id), None)
            if not target_list:
                raise HTTPException(status_code=404, detail="Archive list not found")
            
            # Check schedule limit
            current_schedules = target_list.get("saved_schedules", [])
            if len(current_schedules) >= 3 and not request.replace_existing_slot:
                raise HTTPException(status_code=400, detail="Maximum 3 schedules per archive list. Use replace_existing_slot to overwrite.")
            
            # Generate unique schedule ID
            schedule_id = str(uuid.uuid4())
            
            # Create schedule metadata
            metadata = SavedScheduleMetadata(
                schedule_id=schedule_id,
                name=request.schedule_name,
                travel_mode=request.travel_mode,
                start_time=request.start_time,
                end_time=request.end_time,
                created_at=datetime.utcnow(),
                last_modified=datetime.utcnow(),
                is_favorite=False
            )
            
            # Create saved schedule
            saved_schedule = SavedSchedule(
                metadata=metadata,
                schedule=request.schedule,
                generation_preferences=request.generation_preferences,
                place_toggles=request.place_toggles
            )
            
            # Handle slot replacement or addition
            if request.replace_existing_slot and 1 <= request.replace_existing_slot <= 3:
                # Replace specific slot
                slot_index = request.replace_existing_slot - 1
                if slot_index < len(current_schedules):
                    # Replace existing schedule
                    result = db.archived_lists.update_one(
                        {"user_id": user["id"], "lists._id": list_id},
                        {"$set": {f"lists.$.saved_schedules.{slot_index}": saved_schedule.dict()}}
                    )
                else:
                    # Add to specific slot (extend array if needed)
                    while len(current_schedules) <= slot_index:
                        current_schedules.append(None)
                    current_schedules[slot_index] = saved_schedule.dict()
                    result = db.archived_lists.update_one(
                        {"user_id": user["id"], "lists._id": list_id},
                        {"$set": {"lists.$.saved_schedules": current_schedules}}
                    )
            else:
                # Add to next available slot
                result = db.archived_lists.update_one(
                    {"user_id": user["id"], "lists._id": list_id},
                    {"$push": {"lists.$.saved_schedules": saved_schedule.dict()}}
                )
            
            if result.modified_count == 0:
                raise HTTPException(status_code=500, detail="Failed to save schedule")
            
            return {
                "ok": True,
                "schedule_id": schedule_id,
                "message": f"Schedule '{request.schedule_name}' saved successfully",
                "slot_number": request.replace_existing_slot or len(current_schedules) + 1
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving schedule to archive: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/archived-lists/{list_id}/schedules")
async def get_archive_schedules(
    list_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get all saved schedules for an archive list
    """
    try:
        with get_database() as db:
            user_lists = db.archived_lists.find_one({"user_id": user["id"]})
            if not user_lists:
                raise HTTPException(status_code=404, detail="No archive lists found")
            
            target_list = next((lst for lst in user_lists.get("lists", []) if lst["_id"] == list_id), None)
            if not target_list:
                raise HTTPException(status_code=404, detail="Archive list not found")
            
            schedules = target_list.get("saved_schedules", [])
            
            # Add slot information to each schedule
            enhanced_schedules = []
            for i, schedule in enumerate(schedules):
                if schedule:  # Handle None slots
                    enhanced_schedule = {
                        **schedule,
                        "slot_number": i + 1,
                        "is_empty_slot": False
                    }
                    enhanced_schedules.append(enhanced_schedule)
                else:
                    enhanced_schedules.append({
                        "slot_number": i + 1,
                        "is_empty_slot": True
                    })
            
            return {
                "archive_list_id": list_id,
                "archive_list_name": target_list["name"],
                "schedules": enhanced_schedules,
                "total_slots": 3,
                "used_slots": len([s for s in schedules if s is not None]),
                "available_slots": 3 - len([s for s in schedules if s is not None])
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting archive schedules: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/archived-lists/{list_id}/schedules/{schedule_id}")
async def get_archive_schedule(
    list_id: str,
    schedule_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get a specific saved schedule from an archive list
    """
    try:
        with get_database() as db:
            user_lists = db.archived_lists.find_one({"user_id": user["id"]})
            if not user_lists:
                raise HTTPException(status_code=404, detail="No archive lists found")
            
            target_list = next((lst for lst in user_lists.get("lists", []) if lst["_id"] == list_id), None)
            if not target_list:
                raise HTTPException(status_code=404, detail="Archive list not found")
            
            schedules = target_list.get("saved_schedules", [])
            target_schedule = next((s for s in schedules if s and s.get("metadata", {}).get("schedule_id") == schedule_id), None)
            
            if not target_schedule:
                raise HTTPException(status_code=404, detail="Schedule not found")
            
            return target_schedule
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting archive schedule: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/archived-lists/{list_id}/schedules/{schedule_id}")
async def update_archive_schedule(
    list_id: str,
    schedule_id: str,
    request: UpdateScheduleRequest = Body(...),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update a saved schedule (name, favorite status, etc.)
    """
    try:
        with get_database() as db:
            # Find the schedule and update it
            user_lists = db.archived_lists.find_one({"user_id": user["id"]})
            if not user_lists:
                raise HTTPException(status_code=404, detail="No archive lists found")
            
            # Find list and schedule indices
            list_index = next((i for i, lst in enumerate(user_lists.get("lists", [])) if lst["_id"] == list_id), None)
            if list_index is None:
                raise HTTPException(status_code=404, detail="Archive list not found")
            
            schedules = user_lists["lists"][list_index].get("saved_schedules", [])
            schedule_index = next((i for i, s in enumerate(schedules) if s and s.get("metadata", {}).get("schedule_id") == schedule_id), None)
            
            if schedule_index is None:
                raise HTTPException(status_code=404, detail="Schedule not found")
            
            # Build update fields
            update_fields = {}
            if "name" in request.updates:
                update_fields[f"lists.{list_index}.saved_schedules.{schedule_index}.metadata.name"] = request.updates["name"]
            if "is_favorite" in request.updates:
                update_fields[f"lists.{list_index}.saved_schedules.{schedule_index}.metadata.is_favorite"] = request.updates["is_favorite"]
            
            # Always update last_modified
            update_fields[f"lists.{list_index}.saved_schedules.{schedule_index}.metadata.last_modified"] = datetime.utcnow()
            
            if not update_fields:
                raise HTTPException(status_code=400, detail="No valid fields to update")
            
            result = db.archived_lists.update_one(
                {"user_id": user["id"]},
                {"$set": update_fields}
            )
            
            if result.modified_count == 0:
                raise HTTPException(status_code=500, detail="Failed to update schedule")
            
            return {"ok": True, "message": "Schedule updated successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating archive schedule: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/archived-lists/{list_id}/schedules/{schedule_id}")
async def delete_archive_schedule(
    list_id: str,
    schedule_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Delete a saved schedule from an archive list
    """
    try:
        with get_database() as db:
            # Remove the schedule from the array
            result = db.archived_lists.update_one(
                {"user_id": user["id"], "lists._id": list_id},
                {"$pull": {"lists.$.saved_schedules": {"metadata.schedule_id": schedule_id}}}
            )
            
            if result.modified_count == 0:
                raise HTTPException(status_code=404, detail="Schedule not found or already deleted")
            
            return {"ok": True, "message": "Schedule deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting archive schedule: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Helper Functions (consolidated logic)

async def _enrich_with_public_data(db, places: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Consolidated public data enrichment logic
    """
    try:
        similar_places = []
        total_popularity = 0
        place_count = 0
        ai_tags = []
        
        for place in places:
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
        
        return {
            "similar_public_places": similar_places[:10],  # Limit to 10
            "popularity_score": popularity_score,
            "ai_generated_tags": unique_tags
        }
        
    except Exception as e:
        logger.warning(f"Error enriching with public data: {e}")
        return {
            "similar_public_places": [],
            "popularity_score": None,
            "ai_generated_tags": []
        }

 