import logging
import json
import re # Import the re module
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
import httpx
from config import GOOGLE_API_KEY, OPENROUTER_API_KEY

# Configure logging
logger = logging.getLogger(__name__)

async def optimize_place_order(places: List[Dict[str, Any]], start_time: str, prompt_text: str | None = None, travel_mode: str = "walking") -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """
    Use AI to optimize the order of places and get a detailed recommendation.
    
    Args:
        places: List of place objects with location data
        
    Returns:
        A tuple containing:
            - Optimized list of places in the order they should be visited
            - An optional AI-generated day overview
    """
    try:
        if len(places) <= 1:
            return places, None
        
        logger.info(f"Optimizing order for {len(places)} places using AI")
        
        return await ai_optimization(places, start_time, prompt_text, travel_mode) 
        
    except Exception as e:
        logger.error(f"Error in optimize_place_order: {e}")
        # If optimization fails, return original order and no overview
        return places, None

async def query_AI_google(prompt: str, api_key: str) -> Dict[str, Any]:
    """Query the Google Generative AI API."""
    logger.info("Calling Google Generative AI API")
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-text:generateContent",
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key
            },
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.0,
                    "topP": 0.95,
                    "maxOutputTokens": 1024,
                    "response_mime_type": "application/json",
                }
            }
        )
        response.raise_for_status()
        return response.json()

async def query_AI_openRouter(prompt: str, model: str, api_key: str) -> Dict[str, Any]:
    """Query the OpenRouter AI API."""
    logger.info(f"Calling OpenRouter AI API with model: {model}")
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"}
            }
        )
        response.raise_for_status()
        return response.json()

async def ai_optimization(
    places: List[Dict[str, Any]], 
    start_time: str,
    prompt_text: str | None = None,
    travel_mode: str = "walking"
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """
    Use an AI model to optimize the order of places and get a detailed recommendation.
    Accepts an optional prompt, otherwise uses a default detailed prompt.
    Returns a tuple of (ordered_places, day_overview). Place reviews are attached directly to place objects.
    """
    use_openrouter = True
    openrouter_model = "google/gemma-3-27b-it:free"

    if use_openrouter and not OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY not set, but OpenRouter use was requested. Falling back to Google AI or returning original order.")
        use_openrouter = False
        
    if not use_openrouter and not GOOGLE_API_KEY:
        logger.warning("No valid API key (Google or OpenRouter) available. Returning original order and no overview.")
        return places, None

    try:
        place_data = []
        for i, p_item in enumerate(places):
            lat = p_item.get("geometry", {}).get("location", {}).get("lat", 0)
            lng = p_item.get("geometry", {}).get("location", {}).get("lng", 0)
            place_info = {
                "id": p_item.get("id"), # Use actual place ID here
                "index": i, # Keep original index for ordering
                "name": p_item.get("name", f"Place {i}"),
                "location": {"lat": lat, "lng": lng},
                "type": p_item.get("placeType", "unknown"), # Use placeType from frontend
                "address": p_item.get("vicinity", "")
            }
            place_data.append(place_info)
        
        current_prompt = create_prompt(place_data, start_time, prompt_text, travel_mode)
        
        ai_response_json: Dict[str, Any]
        if use_openrouter:
            logger.info(f"Using OpenRouter model: {openrouter_model}")
            raw_response = await query_AI_openRouter(current_prompt, openrouter_model, OPENROUTER_API_KEY)
            if "choices" in raw_response and raw_response["choices"] and "message" in raw_response["choices"][0] and "content" in raw_response["choices"][0]["message"]:
                content_str = raw_response["choices"][0]["message"]["content"]
                
                # Extract JSON from markdown code block if present
                match = re.search(r'```json\n([\s\S]*?)\n```', content_str)
                if match:
                    json_text_response = match.group(1).strip()
                else:
                    json_text_response = content_str # Assume it's pure JSON if no markdown block

                try:
                    ai_response_json = json.loads(json_text_response)
                except json.JSONDecodeError:
                    logger.error(f"OpenRouter: Failed to parse content as JSON: {json_text_response}")
                    raise ValueError("OpenRouter response content was not valid JSON.")
            else:
                raise ValueError(f"OpenRouter response did not contain expected content path. Response: {raw_response}")

        else:
            logger.info("Using Google AI model.")
            if not GOOGLE_API_KEY:
                 logger.error("Google API key not available for Google AI call.")
                 return places, None
            raw_response = await query_AI_google(current_prompt, GOOGLE_API_KEY)
            if "candidates" in raw_response and raw_response["candidates"] and "content" in raw_response["candidates"][0] and "parts" in raw_response["candidates"][0]["content"] and raw_response["candidates"][0]["content"]["parts"]:
                 json_text_response = raw_response["candidates"][0]["content"]["parts"][0]["text"]
                 try:
                     ai_response_json = json.loads(json_text_response)
                 except json.JSONDecodeError:
                     logger.error(f"Google AI: Failed to parse content as JSON: {json_text_response}")
                     raise ValueError("Google AI response content was not valid JSON.")
            else:
                raise ValueError(f"Google AI response did not contain expected content path. Response: {raw_response}")

        # Parse the structured JSON response
        try:
            ordered_indices = ai_response_json.get("ordered_indices")
            day_overview = ai_response_json.get("day_overview")
            place_reviews_from_ai = ai_response_json.get("place_reviews")

            if not isinstance(ordered_indices, list):
                raise ValueError(f"'ordered_indices' not found or not a list in AI response. Response: {ai_response_json}")

            # Map ordered indices back to original place objects
            valid_indices = []
            for idx in ordered_indices:
                if isinstance(idx, int) and 0 <= idx < len(places):
                    valid_indices.append(idx)
                elif isinstance(idx, str):
                    found_index = next((i for i, p in enumerate(places) if p.get("id") == idx), None)
                    if found_index is not None:
                        valid_indices.append(found_index)
                    else:
                        logger.warning(f"AI returned unknown place_id: {idx}")

            if len(valid_indices) != len(places):
                logger.warning(f"AI response did not return an index for all places. Original: {len(places)}, Got: {len(valid_indices)}. Will append missing.")
                all_original_indices = list(range(len(places)))
                missing_indices = [idx for idx in all_original_indices if idx not in valid_indices]
                valid_indices.extend(missing_indices)
            
            optimized_places_list = [places[i] for i in valid_indices]

            # Attach AI reviews to places
            if isinstance(place_reviews_from_ai, list):
                review_map = {review['place_id']: review['review'] for review in place_reviews_from_ai if 'place_id' in review and 'review' in review}
                for place in optimized_places_list:
                    if place.get('id') in review_map:
                        place['ai_review'] = review_map[place['id']]

            return optimized_places_list, day_overview if isinstance(day_overview, str) else None
            
        except (KeyError, ValueError) as e:
            logger.error(f"Error parsing structured AI JSON response: {e}. Full AI Response: {ai_response_json}")
            return places, None
            
    except httpx.HTTPStatusError as e:
        logger.error(f"AI API HTTP error: {e.request.method} {e.request.url} - {e.response.status_code}. Response: {e.response.text}")
        return places, None
    except Exception as e:
        logger.error(f"Generic error in AI optimization: {e}")
        return places, None

def create_prompt(place_data: List[Dict[str, Any]], start_time: str, prompt_text: str | None = None, travel_mode: str = "walking") -> str:
    """Create a more detailed prompt, asking for JSON object output."""
    places_json = json.dumps(place_data, indent=2)
    return f"""You are an expert travel route optimizer. Your task is to determine the most efficient and enjoyable order to visit the following places, minimizing travel time and creating an optimal day itinerary.

Places (with details including 'id' for mapping reviews):
{places_json}

Consider the following factors:
1. User preferences: {prompt_text if prompt_text else 'None specified. Optimize for efficiency and enjoyable flow.'}
2. **Assumed Travel Mode:** {travel_mode}.
3. **Assumed Start Time:** {start_time}.
4. Geographical distances between locations.
5. Types of places (e.g., museums may require more time than cafes, parks are often open longer).
6. A logical flow for a day trip, taking into account typical operating hours and flow.
7. Aim to create a balanced itinerary for a pleasant experience.

Your response MUST only be a JSON object with three keys and no other text:
1. "ordered_indices": A JSON array of original indices representing the optimized order. For example: [0, 2, 1, 3] (based on the 'index' field in the input place data).
2. "day_overview": A brief (2-4 sentences) and insightful summary of the entire day's itinerary, highlighting the overall flow and key recommendations.
3. "place_reviews": A JSON array of objects, where each object has a "place_id" (matching the 'id' from the input place data) and a "review" (a 1-2 sentence positive review/highlight for that specific place in the context of the itinerary). Ensure all places in the ordered_indices have a corresponding review.

Example of the JSON output format:
{{
  "ordered_indices": [0, 2, 1, 3],
  "day_overview": "This itinerary provides a fantastic blend of cultural immersion and relaxing green spaces, starting with historical sites in the morning and concluding with evening entertainment. The pacing allows for a leisurely exploration of each destination.",
  "place_reviews": [
    {{"place_id": "ChIJUQ4S7rO3RIYRk4A4gQY03w", "review": "A perfect starting point to delve into local history, offering a serene morning experience before the crowds arrive."}},
    {{"place_id": "ChIJ_U9b_x-3RIYRw2wA4gQY03w", "review": "The central location makes this a great spot for a mid-day meal, providing a vibrant atmosphere and delicious cuisine."}},
    {{"place_id": "ChIJb_I2z-3RIYRXw2wA4gQY03w", "review": "Ideal for a relaxing afternoon stroll, offering beautiful scenery and a peaceful escape from the city bustle."}},
    {{"place_id": "ChIJc_N2x-3RIYRAw2wA4gQY03w", "review": "A lively evening destination to unwind, offering great drinks and a chance to experience the local nightlife."}}
  ]
}}
""" 