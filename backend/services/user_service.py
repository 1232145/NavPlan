import logging
from datetime import datetime
from typing import Dict, Any, Optional
from bson.objectid import ObjectId
from pymongo.errors import PyMongoError
from db import get_database

# Configure logging
logger = logging.getLogger(__name__)

class UserService:
    """Service for handling user-related operations"""
    
    @staticmethod
    async def ensure_user_has_example_list(user_id: str) -> bool:
        """
        Ensure that a user has the example list in their archived lists.
        This should be called when a user signs up or signs in for the first time.
        
        Args:
            user_id: The user's unique identifier
            
        Returns:
            bool: True if example list was added or already exists, False on error
        """
        try:
            with get_database() as db:
                # Check if user already has any archived lists
                user_lists = db.archived_lists.find_one({"user_id": user_id})
                
                # If user already has lists, check if they have the example list
                if user_lists and user_lists.get("lists"):
                    # Check if any list has the name "Example"
                    for list_item in user_lists["lists"]:
                        if list_item.get("name") == "Example":
                            logger.info(f"User {user_id} already has example list")
                            return True
                
                # Get the example list from the example_lists collection
                example_list_template = db.example_lists.find_one({"name": "Example"})
                
                if not example_list_template:
                    logger.error("Example list template not found in database")
                    return False
                
                user_example_list = {
                    "_id": str(ObjectId()),  # Generate new unique ID for this user's copy
                    "name": example_list_template["name"],
                    "places": example_list_template["places"],
                    "note": example_list_template.get("note", ""),
                    "date": datetime.utcnow(),  # Set current date when added to user
                    "saved_schedules": [],  # Start with empty schedules for new users
                    "similar_public_places": example_list_template.get("similar_public_places", []),
                    "popularity_score": example_list_template.get("popularity_score"),
                    "ai_generated_tags": example_list_template.get("ai_generated_tags", [])
                }
                
                # Add the example list to the user's archived lists
                result = db.archived_lists.update_one(
                    {"user_id": user_id},
                    {"$push": {"lists": user_example_list}},
                    upsert=True
                )
                
                if result.upserted_id or result.modified_count > 0:
                    logger.info(f"✅ Example list added to user {user_id}")
                    return True
                else:
                    logger.error(f"Failed to add example list to user {user_id}")
                    return False
                    
        except PyMongoError as e:
            logger.error(f"Database error adding example list to user {user_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error adding example list to user {user_id}: {e}")
            return False
    
    @staticmethod
    async def initialize_new_user(user_data: Dict[str, Any]) -> bool:
        """
        Initialize a new user with default data including the example list.
        
        Args:
            user_data: Dictionary containing user information from OAuth
            
        Returns:
            bool: True if initialization was successful, False otherwise
        """
        try:
            user_id = user_data.get("id")
            if not user_id:
                logger.error("User ID not found in user data")
                return False
            
            logger.info(f"Initializing new user: {user_id}")
            
            # Add the example list to the new user
            success = await UserService.ensure_user_has_example_list(user_id)
            
            if success:
                logger.info(f"✅ User {user_id} initialized successfully with example list")
            else:
                logger.warning(f"⚠️ User {user_id} initialized but example list addition failed")
            
            return success
            
        except Exception as e:
            logger.error(f"Error initializing user: {e}")
            return False

# Create a singleton instance
user_service = UserService() 