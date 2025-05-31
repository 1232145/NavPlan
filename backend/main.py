# To run the backend on localhost:8000, use:
# uvicorn main:app --host localhost --port 8000 --reload
import os
from fastapi import FastAPI, Request, HTTPException, Response, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google.oauth2 import id_token
from google.auth.transport import requests as grequests
from starlette.responses import JSONResponse
from datetime import datetime
from typing import List, Optional, Dict, Any
from db import get_database, db_manager
from pymongo.errors import PyMongoError
import logging
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GOOGLE_CLIENT_ID = os.getenv("VITE_GOOGLE_CLIENT_ID")

# Request/Response Models
class ArchivedList(BaseModel):
    name: str
    places: List[Dict[str, Any]]
    note: Optional[str] = None

async def get_current_user(request: Request) -> Dict[str, Any]:
    """Dependency to get current user from session"""
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(status_code=401, detail="Not logged in")
    try:
        idinfo = id_token.verify_oauth2_token(token, grequests.Request(), GOOGLE_CLIENT_ID)
        return {
            "id": idinfo["sub"],
            "email": idinfo["email"],
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
        }
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid session")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    db_manager.close()

@app.post("/api/auth/google")
async def google_auth(request: Request):
    try:
        data = await request.json()
        token = data.get("token")
        if not token:
            raise HTTPException(status_code=400, detail="Missing token")
        
        idinfo = id_token.verify_oauth2_token(token, grequests.Request(), GOOGLE_CLIENT_ID)
        user = {
            "id": idinfo["sub"],
            "email": idinfo["email"],
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
        }
        response = JSONResponse({"user": user})
        response.set_cookie(
            key="session", value=token, httponly=True, secure=False, samesite="lax", max_age=3600
        )
        return response
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/api/me")
async def me(user: Dict[str, Any] = Depends(get_current_user)):
    return {"user": user}

@app.post("/api/logout")
async def logout(response: Response):
    response.delete_cookie("session")
    return {"ok": True}

@app.post("/api/archived-lists")
async def create_archived_list(
    archived_list: ArchivedList = Body(...),
    user: Dict[str, Any] = Depends(get_current_user)
):
    try:
        with get_database() as db:
            result = db.archived_lists.insert_one({
                "user_id": user["id"],
                "name": archived_list.name,
                "places": archived_list.places,
                "note": archived_list.note,
                "date": datetime.utcnow()
            })
            return {"id": str(result.inserted_id)}
    except PyMongoError as e:
        logger.error(f"Database error in create_archived_list: {e}")
        raise HTTPException(status_code=500, detail="Database error")
    except Exception as e:
        logger.error(f"Unexpected error in create_archived_list: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/archived-lists")
async def get_archived_lists(
    user: Dict[str, Any] = Depends(get_current_user)
):
    try:
        with get_database() as db:
            # Use find with projection to only get needed fields
            cursor = db.archived_lists.find(
                {"user_id": user["id"]},
                {"_id": 1, "name": 1, "places": 1, "note": 1, "date": 1}
            ).sort("date", -1)  # Sort by date descending
            
            lists = list(cursor)
            return [{
                "id": str(list["_id"]),
                "name": list["name"],
                "places": list["places"],
                "note": list.get("note"),
                "date": list["date"].isoformat()
            } for list in lists]
    except PyMongoError as e:
        logger.error(f"Database error in get_archived_lists: {e}")
        raise HTTPException(status_code=500, detail="Database error")
    except Exception as e:
        logger.error(f"Unexpected error in get_archived_lists: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.put("/api/archived-lists/{list_id}")
async def update_archived_list(
    list_id: str,
    archived_list: ArchivedList = Body(...),
    user: Dict[str, Any] = Depends(get_current_user)
):
    try:
        with get_database() as db:
            result = db.archived_lists.update_one(
                {"_id": list_id, "user_id": user["id"]},
                {"$set": {
                    "name": archived_list.name,
                    "places": archived_list.places,
                    "note": archived_list.note
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

@app.delete("/api/archived-lists/{list_id}")
async def delete_archived_list(
    list_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    try:
        with get_database() as db:
            result = db.archived_lists.delete_one({"_id": list_id, "user_id": user["id"]})
            
            if result.deleted_count == 0:
                raise HTTPException(status_code=404, detail="List not found")
            
            return {"ok": True}
    except PyMongoError as e:
        logger.error(f"Database error in delete_archived_list: {e}")
        raise HTTPException(status_code=500, detail="Database error")
    except Exception as e:
        logger.error(f"Unexpected error in delete_archived_list: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
