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
    end_time: str = "19:00"
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """
    Use AI to optimize the order of places and get a detailed recommendation.
    
    Args:
        places: List of place objects with location data
        start_time: Start time for the schedule in HH:MM format
        prompt_text: Optional custom prompt for the AI
        travel_mode: Mode of transportation (walking, driving, bicycling, transit)
        end_time: End time for the schedule in HH:MM format
        
    Returns:
        A tuple containing:
            - Optimized list of places in the order they should be visited
            - An optional AI-generated day overview
    """
    try:
        if len(places) <= 1:
            return places, None
        
        logger.info(f"Optimizing order for {len(places)} places using AI")
        
        return await ai_optimization(places, start_time, prompt_text, travel_mode, end_time) 
        
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
    end_time: str = "19:00"
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
            place_count=len(places),
            end_time=end_time
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
            place_durations = ai_response_json.get("place_durations", {})

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

            # Attach AI reviews and durations to places
            if isinstance(place_reviews_from_ai, list):
                review_map = {review['place_id']: review['review'] for review in place_reviews_from_ai if 'place_id' in review and 'review' in review}
                for place in optimized_places_list:
                    if place.get('id') in review_map:
                        place['ai_review'] = review_map[place['id']]
            
            # Attach AI suggested durations
            if isinstance(place_durations, dict):
                for place in optimized_places_list:
                    place_id = place.get('id')
                    if place_id in place_durations and isinstance(place_durations[place_id], int) and place_durations[place_id] > 0:
                        place['duration_minutes'] = place_durations[place_id]

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
    place_count: int = 0,
    end_time: str = "19:00"
) -> str:
    """Create a detailed prompt for the AI, with instructions to select a subset of places if needed."""
    places_json = json.dumps(place_data, indent=2)
    
    # Improved meal planning guidelines
    meal_planning_guidelines = """
Meal Planning Rules:
- Schedule ONE main restaurant for lunch (typically between 12-2 PM)
- Schedule ONE main restaurant for dinner (typically between 6-8 PM)
- NEVER schedule main meal restaurants consecutively
- Only schedule additional food places (like cafes, dessert shops, bubble tea, etc.) if they're for light refreshments, not full meals
- Space attractions between meals
- If the start time is before 10 AM, consider including a breakfast option
"""

    # Visit duration guidelines
    visit_duration_guidelines = """
For each place, determine an appropriate visit duration in minutes based on the place type and what visitors typically do there:
- Museums/galleries: Typically 60-120 minutes depending on size and importance
- Tourist attractions: 45-90 minutes depending on complexity
- Parks/outdoor spaces: 30-60 minutes for casual visits
- Restaurants: 60-90 minutes for a full meal
- Cafes/dessert shops: 30-45 minutes
- Retail/shopping: 30-60 minutes
"""

    # Base prompt elements
    selection_instructions = ""
    output_format_str = ""
    
    # Add selection instructions if this is a new schedule and we have multiple places
    if select_subset and place_count >= 5:
        selection_instructions = f"""
Select a subset of the {place_count} places to create a full day itinerary from {start_time} to approximately {end_time}.
Balance meal times, geographical proximity, variety of experiences, and prioritize must-visit places.
"""
        output_format_str = """
Your response must be a JSON object with the following keys:
1. "selected_place_indices": Array of indices you recommend [e.g., 0, 2, 5, 8]
2. "ordered_indices": Same selected indices in your recommended visiting order
3. "day_overview": Brief summary of the day (2-3 sentences)
4. "place_reviews": Array of objects with "place_id" and "review" (1 sentence per place)
5. "place_durations": Object mapping place_id to recommended visit duration in minutes (e.g., {"place123": 60, "place456": 90})
"""
    else:
        # For small lists or existing schedules
        selection_instructions = f"""
Create a full day itinerary from the user's start_time to approximately {end_time}, ordering the places optimally.
"""
        output_format_str = """
Your response must be a JSON object with the following keys:
1. "ordered_indices": Array of indices in optimized order [e.g., 0, 2, 1, 3]
2. "day_overview": Brief summary of the day (2-3 sentences)
3. "place_reviews": Array of objects with "place_id" and "review" (1 sentence per place)
4. "place_durations": Object mapping place_id to recommended visit duration in minutes (e.g., {"place123": 45, "place456": 90})
"""

    # Determine user preferences fallback
    user_preferences_text = prompt_text if prompt_text else \
        "Prioritize a logical flow with varied activities and well-spaced meals throughout the day."

    # Combine all elements to create the full prompt
    return f"""You are an expert travel route optimizer creating an optimal full-day itinerary.
Start the day at {start_time} and plan until around {end_time} (included travel time).

Places:
{places_json}

{selection_instructions}

{meal_planning_guidelines}

{visit_duration_guidelines}

Considerations:
1. User preferences: {user_preferences_text}
2. Travel mode: {travel_mode}
3. Visit duration: Assign a specific duration to each place that's appropriate for its type and importance
4. Geographical proximity between locations
5. CRITICAL: Avoid scheduling multiple main restaurants consecutively - separate them with attractions
6. For restaurants, carefully identify if they're a main meal place or just a light refreshment stop

{output_format_str}
""" 