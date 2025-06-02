import logging
from fastapi import Request, HTTPException, Depends
from google.oauth2 import id_token
from google.auth.transport import requests as grequests
from typing import Dict, Any
from config import GOOGLE_CLIENT_ID

# Configure logging
logger = logging.getLogger(__name__)

async def get_current_user(request: Request) -> Dict[str, Any]:
    """
    Dependency to get current user from session token.
    
    Args:
        request: The FastAPI request object containing cookies
        
    Returns:
        Dict containing user information
        
    Raises:
        HTTPException: If user is not logged in or token is invalid
    """
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