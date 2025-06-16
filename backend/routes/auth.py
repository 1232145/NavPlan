import logging
from fastapi import APIRouter, Request, HTTPException, Response, Depends
from starlette.responses import JSONResponse
from google.oauth2 import id_token
from google.auth.transport import requests as grequests
from typing import Dict, Any
from utils.auth import get_current_user
from config import GOOGLE_CLIENT_ID, API_PREFIX
from services.user_service import user_service

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix=API_PREFIX, tags=["auth"])

@router.post("/auth/google")
async def google_auth(request: Request):
    """
    Authenticate with Google OAuth and set session cookie
    """
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
        
        # Initialize new user with example list (this will only add if they don't have it)
        try:
            await user_service.ensure_user_has_example_list(user["id"])
        except Exception as e:
            logger.warning(f"Failed to add example list to user {user['id']}: {e}")
        
        # Return user data with token for frontend to store
        return JSONResponse({
            "user": user,
            "token": token
        })
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

@router.get("/me")
async def me(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Get current user information
    """
    return {"user": user}

@router.post("/logout")
async def logout(response: Response):
    """
    Logout and clear session cookie
    """
    response.delete_cookie("session")
    return {"ok": True} 