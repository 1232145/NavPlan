from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from config import API_PREFIX
import httpx
import os
from typing import Optional
import json

router = APIRouter(prefix=API_PREFIX, tags=["places"])

GOOGLE_API_KEY = os.getenv("VITE_GOOGLE_MAPS_API_KEY")

if not GOOGLE_API_KEY:
    # Use a more descriptive error message as this is a critical setup issue
    raise ValueError("VITE_GOOGLE_MAPS_API_KEY environment variable not set. Please set it in your .env file or environment variables.")

GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1"

class Coordinates(BaseModel):
    latitude: float
    longitude: float

class LocationRestrictionCircle(BaseModel):
    center: Coordinates
    radius: float

class LocationRestriction(BaseModel):
    circle: LocationRestrictionCircle

class SearchTextRequest(BaseModel):
    text_query: str = Field(alias="textQuery")
    languageCode: str = "en"
    regionCode: str = "US"
    locationRestriction: Optional[LocationRestriction] = None
    locationBias: Optional[LocationRestriction] = None

class SearchNearbyRequest(BaseModel):
    locationRestriction: LocationRestriction
    languageCode: str = "en"
    regionCode: str = "US"
    includedTypes: Optional[list[str]] = None

@router.post("/places:searchText")
async def search_places_proxy(request_body: SearchTextRequest):
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress,places.types,places.rating,places.userRatingCount,places.photos,places.currentOpeningHours,places.regularOpeningHours,places.websiteUri,places.internationalPhoneNumber,places.businessStatus,places.priceLevel"
    }
    async with httpx.AsyncClient(timeout=30.0) as client: # Add a timeout for HTTPX client
        try:
            # model_dump(by_alias=True) is crucial here because of text_query: str = Field(alias="textQuery")
            # This ensures 'text_query' becomes 'textQuery' for Google's API.
            # exclude_none=True is good for clean payload
            payload = request_body.model_dump(by_alias=True, exclude_none=True)
            print("Payload sent to Google Places API (searchText):", payload)
            response = await client.post(f"{GOOGLE_PLACES_BASE_URL}/places:searchText", json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            # Print Google's error response for debugging
            print(f"Google Places API error (searchText): {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail=json.loads(e.response.text) if e.response.text else "Google API error")
        except Exception as e:
            print(f"Proxy error (searchText): {e}") # Log the specific error
            raise HTTPException(status_code=500, detail=f"Proxy error: {e}")

@router.post("/places:searchNearby")
async def search_nearby_proxy(request_body: SearchNearbyRequest):
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress,places.types,places.rating,places.userRatingCount,places.photos,places.currentOpeningHours,places.regularOpeningHours,places.websiteUri,places.internationalPhoneNumber,places.businessStatus,places.priceLevel"
    }
    async with httpx.AsyncClient(timeout=30.0) as client: # Add a timeout
        try:
            # Ensure by_alias=True for field aliasing if you had any
            payload = request_body.model_dump(by_alias=True, exclude_none=True)
            print("Payload sent to Google Places API (searchNearby):", payload)
            response = await client.post(f"{GOOGLE_PLACES_BASE_URL}/places:searchNearby", json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            print(f"Google Places API error (searchNearby): {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail=json.loads(e.response.text) if e.response.text else "Google API error")
        except Exception as e:
            print(f"Proxy error (searchNearby): {e}")
            raise HTTPException(status_code=500, detail=f"Proxy error: {e}")

@router.get("/places/{place_id}")
async def get_place_details_proxy(place_id: str):
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "id,displayName,location,formattedAddress,types,rating,userRatingCount,photos,currentOpeningHours,regularOpeningHours,websiteUri,internationalPhoneNumber,businessStatus,priceLevel"
    }
    async with httpx.AsyncClient(timeout=30.0) as client: # Add a timeout
        try:
            response = await client.get(f"{GOOGLE_PLACES_BASE_URL}/places/{place_id}", headers=headers)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            print(f"Google Places API error (getPlaceDetails): {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail=json.loads(e.response.text) if e.response.text else "Google API error")
        except Exception as e:
            print(f"Proxy error (getPlaceDetails): {e}")
            raise HTTPException(status_code=500, detail=f"Proxy error: {e}")