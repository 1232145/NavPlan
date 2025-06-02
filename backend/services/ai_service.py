import logging
import json
import numpy as np
from typing import List, Dict, Any
import asyncio
import httpx
from config import GOOGLE_API_KEY

# Configure logging
logger = logging.getLogger(__name__)

async def optimize_place_order(places: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Use AI to optimize the order of places to visit for the most efficient route
    
    Args:
        places: List of place objects with location data
        
    Returns:
        Optimized list of places in the order they should be visited
    """
    try:
        if len(places) <= 1:
            return places
        
        logger.info(f"Optimizing order for {len(places)} places")
        
        # For small number of places, use a deterministic algorithm to avoid API costs
        if len(places) <= 3:
            logger.info("Using deterministic algorithm for small number of places")
            return await deterministic_optimization(places)
        
        # For 4-7 places, use simplified AI prompt (less tokens)
        if len(places) <= 7:
            logger.info("Using simplified AI prompt for medium number of places")
            return await ai_optimization(places, simplified=True)
        
        # For larger sets, use full AI optimization
        logger.info("Using full AI optimization for large number of places")
        return await ai_optimization(places, simplified=False)
        
    except Exception as e:
        logger.error(f"Error in optimize_place_order: {e}")
        # If optimization fails, return original order
        return places

async def deterministic_optimization(places: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Simple nearest-neighbor optimization for small number of places.
    This is more efficient than calling AI for trivial cases.
    """
    if len(places) <= 1:
        return places
    
    # Extract coordinates
    coordinates = []
    for place in places:
        lat = place.get("geometry", {}).get("location", {}).get("lat", 0)
        lng = place.get("geometry", {}).get("location", {}).get("lng", 0)
        coordinates.append((lat, lng))
    
    # Start with the first place as our current position
    optimized_indices = [0]
    remaining_indices = list(range(1, len(places)))
    
    # Nearest neighbor algorithm
    while remaining_indices:
        current_idx = optimized_indices[-1]
        current_pos = coordinates[current_idx]
        
        # Find the nearest unvisited place
        min_distance = float('inf')
        nearest_idx = -1
        
        for idx in remaining_indices:
            next_pos = coordinates[idx]
            # Calculate distance (Haversine would be more accurate but simpler for demonstration)
            distance = ((current_pos[0] - next_pos[0]) ** 2 + 
                       (current_pos[1] - next_pos[1]) ** 2) ** 0.5
            
            if distance < min_distance:
                min_distance = distance
                nearest_idx = idx
        
        optimized_indices.append(nearest_idx)
        remaining_indices.remove(nearest_idx)
    
    # Reorder places based on optimized indices
    return [places[i] for i in optimized_indices]

async def ai_optimization(places: List[Dict[str, Any]], simplified: bool = False) -> List[Dict[str, Any]]:
    """
    Use Google's text generation model to optimize the order of places.
    Uses a simplified prompt for medium-sized lists to reduce token usage.
    """
    if not GOOGLE_API_KEY:
        logger.warning("GOOGLE_API_KEY not set, falling back to deterministic optimization")
        return await deterministic_optimization(places)
    
    try:
        # Format place data for AI prompt
        place_data = []
        for i, place in enumerate(places):
            lat = place.get("geometry", {}).get("location", {}).get("lat", 0)
            lng = place.get("geometry", {}).get("location", {}).get("lng", 0)
            
            place_info = {
                "id": i,  # Using index as ID for simplicity
                "name": place.get("name", f"Place {i}"),
                "location": {"lat": lat, "lng": lng}
            }
            
            # Add additional context for non-simplified prompts
            if not simplified:
                place_info["type"] = place.get("types", ["unknown"])[0] if place.get("types") else "unknown"
                place_info["address"] = place.get("vicinity", "")
            
            place_data.append(place_info)
        
        # Create appropriate prompt based on complexity
        if simplified:
            prompt = create_simplified_prompt(place_data)
        else:
            prompt = create_detailed_prompt(place_data)
        
        # Call AI API
        async with httpx.AsyncClient(timeout=30.0) as client:
            logger.info("Calling Google Generative AI API")
            response = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-text:generateContent",
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": GOOGLE_API_KEY
                },
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.0,
                        "topP": 0.95,
                        "maxOutputTokens": 1024
                    }
                }
            )
            
            if response.status_code != 200:
                logger.error(f"AI API error: {response.status_code}, {response.text}")
                return await deterministic_optimization(places)
                
            result = response.json()
            
            # Parse the response to get ordered indices
            try:
                text_response = result["candidates"][0]["content"]["parts"][0]["text"]
                # Extract JSON array from response, handling possible text wrapping
                json_start = text_response.find('[')
                json_end = text_response.rfind(']') + 1
                
                if json_start == -1 or json_end == 0:
                    raise ValueError("Could not find JSON array in response")
                    
                json_str = text_response[json_start:json_end]
                ordered_indices = json.loads(json_str)
                
                # Validate and clean up indices
                valid_indices = [idx for idx in ordered_indices if isinstance(idx, int) and 0 <= idx < len(places)]
                
                # Handle incomplete results
                if len(valid_indices) < len(places):
                    missing = set(range(len(places))) - set(valid_indices)
                    valid_indices.extend(missing)
                
                # Reorder places based on AI suggestion
                return [places[i] for i in valid_indices]
                
            except (KeyError, IndexError, json.JSONDecodeError) as e:
                logger.error(f"Error parsing AI response: {e}")
                return await deterministic_optimization(places)
                
    except Exception as e:
        logger.error(f"Error in AI optimization: {e}")
        return await deterministic_optimization(places)

def create_simplified_prompt(place_data: List[Dict[str, Any]]) -> str:
    """Create a token-efficient prompt for medium-sized place lists"""
    places_json = json.dumps(place_data, indent=2)
    return f"""You are a travel route optimizer. Your task is to determine the most efficient order to visit the following places to minimize total travel distance.

Places (with coordinates):
{places_json}

Consider only the geographical distances between locations.
Return only a JSON array of indices representing the optimized order. For example: [0, 2, 1, 3]
"""

def create_detailed_prompt(place_data: List[Dict[str, Any]]) -> str:
    """Create a more detailed prompt for complex optimization"""
    places_json = json.dumps(place_data, indent=2)
    return f"""You are a travel route optimizer. Your task is to determine the most efficient order to visit the following places to minimize total travel time and create an optimal day itinerary.

Places (with details):
{places_json}

Consider the following factors:
1. Geographical distances between locations
2. Types of places (museums may require more time than cafes)
3. A logical flow for a day trip (e.g., meals at appropriate times)

Return only a JSON array of indices representing the optimized order. For example: [0, 2, 1, 3]
""" 