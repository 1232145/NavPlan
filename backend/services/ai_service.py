import logging
import json
import re # Import the re module
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
import httpx
from config import GOOGLE_API_KEY, OPENROUTER_API_KEY

# Configure logging
logger = logging.getLogger(__name__)

async def optimize_place_order(
    places: List[Dict[str, Any]], 
    start_time: str, 
    prompt_text: str | None = None, 
    travel_mode: str = "walking",
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """
    Use AI to optimize the order of places and get a detailed recommendation.
    
    Args:
        places: List of place objects with location data
        start_time: Start time for the schedule in HH:MM format
        prompt_text: Optional custom prompt for the AI
        travel_mode: Mode of transportation (walking, driving, bicycling, transit)
        
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
    travel_mode: str = "walking",
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
        
        # This is a new schedule, so we want the AI to select a subset if there are many places
        is_new_schedule = True
        
        # Create prompt with appropriate instructions based on whether we're creating a new schedule
        current_prompt = create_prompt(
            place_data, 
            start_time, 
            prompt_text, 
            travel_mode, 
            select_subset=is_new_schedule,
            place_count=len(places)
        )
        
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
            # Google AI's response_mime_type="application/json" should make the part text a JSON string
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
            # Get selected place indices if this is a new schedule
            selected_indices = None
            if is_new_schedule:
                selected_indices = ai_response_json.get("selected_place_indices")
                if not isinstance(selected_indices, list) or len(selected_indices) == 0:
                    logger.warning("AI didn't provide valid selected_place_indices, will use all places")
                    selected_indices = None
            
            ordered_indices = ai_response_json.get("ordered_indices")
            day_overview = ai_response_json.get("day_overview")
            place_reviews_from_ai = ai_response_json.get("place_reviews")

            if not isinstance(ordered_indices, list):
                raise ValueError(f"'ordered_indices' not found or not a list in AI response. Response: {ai_response_json}")

            # Filter places if selected_indices is provided (new schedule)
            if is_new_schedule and selected_indices:
                # Validate selected indices
                valid_selected_indices = [idx for idx in selected_indices if isinstance(idx, int) and 0 <= idx < len(places)]
                
                if len(valid_selected_indices) == 0:
                    logger.warning("No valid selected indices found, using all places")
                    valid_selected_indices = list(range(len(places)))
                
                # Filter to only include selected places
                filtered_places = [places[i] for i in valid_selected_indices]
                
                # Now map the ordered_indices to these filtered places
                # First, create a mapping from original indices to new position in filtered list
                original_to_filtered = {idx: i for i, idx in enumerate(valid_selected_indices)}
                
                # Map ordered_indices through this mapping
                filtered_ordered_indices = []
                for idx in ordered_indices:
                    if isinstance(idx, int) and idx in original_to_filtered:
                        filtered_ordered_indices.append(original_to_filtered[idx])
                
                if not filtered_ordered_indices:
                    # Fallback to sequential order if mapping failed
                    filtered_ordered_indices = list(range(len(filtered_places)))
                
                # Create final list
                logger.info(f"AI selected {len(filtered_places)} places out of {len(places)}")
                optimized_places_list = [filtered_places[i] for i in filtered_ordered_indices]
            else:
                # For existing schedules or if no selection was made, use normal ordering logic
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

def create_prompt(
    place_data: List[Dict[str, Any]], 
    start_time: str, 
    prompt_text: str | None = None, 
    travel_mode: str = "walking",
    select_subset: bool = True,
    place_count: int = 0
) -> str:
    """Create a detailed prompt for the AI, with instructions to select a subset of places if needed."""
    places_json = json.dumps(place_data, indent=2)
    
    # Default time estimates based on place type for AI reference
    visit_duration_info = """
Average visit durations by place type:
- restaurants/cafes: 60-90 minutes
- museums/galleries: 90-120 minutes
- parks/outdoor: 45-60 minutes
- shopping: 60-90 minutes
- tourist attractions: 60-90 minutes
- entertainment venues: 90-180 minutes
- quick stops: 30 minutes
"""

    # Base prompt elements
    selection_instructions = ""
    output_format = ""
    
    # Add selection instructions if this is a new schedule and we have multiple places
    # Only select subset if we have 5 or more places (changed from 4)
    if select_subset and place_count >= 5:
        selection_instructions = f"""
IMPORTANT: The user has provided {place_count} favorite places, which is too many to visit in one day. 
Based on the following factors, SELECT A SUBSET of places that would make a reasonable awesome day trip:
1. Places that are classied as iconic and must be visited.
2. Geographic proximity (cluster places that are close together)
3. Logical flow (variety of experiences, appropriate meal times if restaurants included)
4. Time constraints (a typical day trip is 6-10 hours including travel time)
5. Place compatibility (select places that work well together)
6. The user should have breakfast, lunch, and dinner if the start time allows such a schedule.

Only for example: if the user starts his day at 9am and has saved 3 museums, 4 restaurants, and 5 tourist attractions,
you might select 1 museum, 1 restaurant for lunch, and 2 tourist attractions, 1 restaurant for dinner that are
geographically close and would create a balanced day. 
"""
        output_format = """
Your response MUST only be a JSON object with the following keys and no other text:
1. "selected_place_indices": A JSON array of indices of places you recommend including in the day trip (reference the 'index' field). For example: [0, 2, 5, 8]
2. "ordered_indices": A JSON array of the SAME indices in your recommended visiting order. For example: [0, 5, 2, 8]
3. "day_overview": A brief (2-4 sentences) and insightful summary of the entire day's itinerary, explaining why you selected these places and the overall flow.
4. "place_reviews": A JSON array of objects, where each object has a "place_id" (matching the 'id' from the input place data) and a "review" (a 1-2 sentence positive review/highlight for that specific place in the context of the itinerary). Only include reviews for the selected places.

Example of the JSON output format:
{
  "selected_place_indices": [0, 2, 5, 8],
  "ordered_indices": [0, 5, 2, 8],
  "day_overview": "This curated selection focuses on the city's historical center with a perfect mix of culture and cuisine. Starting with the museum in the morning allows you to beat the crowds, followed by a lunch spot with local specialties, and ending with relaxing attractions in the afternoon.",
  "place_reviews": [
    {"place_id": "ChIJUQ4S7rO3RIYRk4A4gQY03w", "review": "A perfect starting point to delve into local history, offering a serene morning experience before the crowds arrive."},
    {"place_id": "ChIJ_U9b_x-3RIYRw2wA4gQY03w", "review": "The central location makes this a great spot for a mid-day meal, providing a vibrant atmosphere and delicious cuisine."},
    {"place_id": "ChIJb_I2z-3RIYRXw2wA4gQY03w", "review": "Ideal for a relaxing afternoon stroll, offering beautiful scenery and a peaceful escape from the city bustle."},
    {"place_id": "ChIJc_N2x-3RIYRAw2wA4gQY03w", "review": "A lively evening destination to unwind, offering great drinks and a chance to experience the local nightlife."}
  ]
}
"""
    else:
        # For small lists or existing schedules, don't select a subset
        output_format = """
Your response MUST only be a JSON object with the following keys and no other text:
1. "ordered_indices": A JSON array of original indices representing the optimized order. For example: [0, 2, 1, 3] (based on the 'index' field in the input place data).
2. "day_overview": A brief (2-4 sentences) and insightful summary of the entire day's itinerary, highlighting the overall flow and key recommendations.
3. "place_reviews": A JSON array of objects, where each object has a "place_id" (matching the 'id' from the input place data) and a "review" (a 1-2 sentence positive review/highlight for that specific place in the context of the itinerary). Ensure all places in the ordered_indices have a corresponding review.

Example of the JSON output format:
{
  "ordered_indices": [0, 2, 1, 3],
  "day_overview": "This itinerary provides a fantastic blend of cultural immersion and relaxing green spaces, starting with historical sites in the morning and concluding with evening entertainment. The pacing allows for a leisurely exploration of each destination.",
  "place_reviews": [
    {"place_id": "ChIJUQ4S7rO3RIYRk4A4gQY03w", "review": "A perfect starting point to delve into local history, offering a serene morning experience before the crowds arrive."},
    {"place_id": "ChIJ_U9b_x-3RIYRw2wA4gQY03w", "review": "The central location makes this a great spot for a mid-day meal, providing a vibrant atmosphere and delicious cuisine."},
    {"place_id": "ChIJb_I2z-3RIYRXw2wA4gQY03w", "review": "Ideal for a relaxing afternoon stroll, offering beautiful scenery and a peaceful escape from the city bustle."},
    {"place_id": "ChIJc_N2x-3RIYRAw2wA4gQY03w", "review": "A lively evening destination to unwind, offering great drinks and a chance to experience the local nightlife."}
  ]
}
"""

    # Combine all elements to create the full prompt
    return f"""You are an expert travel route optimizer. Your task is to {selection_instructions and 'select and' or ''} determine the most efficient and enjoyable order to visit places, creating an optimal day itinerary.

Places (with details):
{places_json}

{selection_instructions}

Consider the following factors when optimizing the route:
1. User preferences: {prompt_text if prompt_text else 'None specified. Optimize for efficiency and enjoyable flow.'}
2. **Travel Mode:** {travel_mode}
3. **Start Time:** {start_time}
4. Geographical distances between locations
5. Types of places and their typical visit durations
{visit_duration_info}
6. A logical flow for a day trip, taking into account typical operating hours

{output_format}
""" 