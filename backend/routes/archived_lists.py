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
    Create a new archived list of places
    """
    try:
        with get_database() as db:
            result = db.archived_lists.update_one(
                {"user_id": user["id"]},
                {"$push": {
                    "lists": {
                        "_id": str(ObjectId()),
                        "name": archived_list.name,
                        "places": archived_list.places,
                        "note": archived_list.note,
                        "date": datetime.utcnow()
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