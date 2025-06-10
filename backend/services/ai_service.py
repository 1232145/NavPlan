import logging
import json
import re # Import the re module
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
import httpx
from config import GOOGLE_API_KEY, OPENROUTER_API_KEY
from db import get_database

# Configure logging
logger = logging.getLogger(__name__)

# Try to import sentence-transformers for local embeddings
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
    # Initialize a lightweight model for embeddings
    _embedding_model = None
    
    def get_embedding_model():
        global _embedding_model
        if _embedding_model is None:
            try:
                # Use a small, efficient model that works well for semantic search
                _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
                logger.info("Loaded sentence-transformers model: all-MiniLM-L6-v2")
            except Exception as e:
                logger.error(f"Failed to load sentence-transformers model: {e}")
                return None
        return _embedding_model
        
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    logger.warning("sentence-transformers not available. Vector search will be disabled.")
    
    def get_embedding_model():
        return None

async def create_place_embedding(place_text: str) -> List[float]:
    """
    Create embedding for place using local sentence-transformers model
    """
    try:
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            logger.warning("sentence-transformers not available for embeddings")
            return []
            
        model = get_embedding_model()
        if model is None:
            logger.warning("Could not load embedding model")
            return []
            
        # Generate embedding using sentence-transformers
        embedding = model.encode(place_text, convert_to_tensor=False)
        
        # Convert to list if it's a numpy array
        if hasattr(embedding, 'tolist'):
            return embedding.tolist()
        else:
            return list(embedding)
                
    except Exception as e:
        logger.error(f"Error creating embedding: {e}")
        return []

async def create_query_embedding(query: str) -> List[float]:
    """
    Create embedding for user query/prompt
    """
    return await create_place_embedding(query)

def create_place_text_for_embedding(place: Dict[str, Any]) -> str:
    """
    Create a comprehensive text representation of a place for embedding
    """
    parts = []
    
    # Basic info
    if place.get("name"):
        parts.append(f"Name: {place['name']}")
    
    if place.get("placeType"):
        place_type = place["placeType"].replace("_", " ")
        parts.append(f"Type: {place_type}")
    
    if place.get("address"):
        parts.append(f"Address: {place['address']}")
    
    # User note is very important for semantic matching
    if place.get("note"):
        parts.append(f"User note: {place['note']}")
    
    # Public data enrichment
    if place.get("public_categories"):
        categories = ", ".join(place["public_categories"])
        parts.append(f"Similar places nearby: {categories}")
    
    # Rating info
    if place.get("rating"):
        parts.append(f"Rating: {place['rating']} stars")
    
    return " | ".join(parts)

async def vector_search_places(places: List[Dict[str, Any]], query: str, top_k: int = None) -> List[Dict[str, Any]]:
    """
    Use vector search to find places most relevant to the user's query
    This acts as a semantic filter before AI processing
    """
    try:
        if not query or not places:
            return places
        
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            logger.warning("sentence-transformers not available, skipping vector search")
            return places
        
        logger.info(f"Performing vector search on {len(places)} places with query: '{query}'")
        
        # Create query embedding
        query_embedding = await create_query_embedding(query)
        if not query_embedding:
            logger.warning("Could not create query embedding, returning all places")
            return places
        
        # Create embeddings for all places and calculate similarity
        place_scores = []
        
        for i, place in enumerate(places):
            # Create text representation
            place_text = create_place_text_for_embedding(place)
            logger.debug(f"Place {i} text: {place_text}")
            
            # Create embedding
            place_embedding = await create_place_embedding(place_text)
            
            if place_embedding:
                # Calculate cosine similarity
                similarity = cosine_similarity(query_embedding, place_embedding)
                place_scores.append((i, similarity, place))
                logger.debug(f"Place {i} ({place.get('name', 'Unknown')}) similarity: {similarity:.3f}")
            else:
                # If embedding fails, give it a neutral score
                place_scores.append((i, 0.5, place))
                logger.warning(f"Failed to create embedding for place {i}, using neutral score")
        
        # Sort by similarity score (highest first)
        place_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Determine how many places to return
        if top_k is None:
            # Dynamic selection based on similarity scores
            # Take places with similarity > 0.7, but at least 3 and at most 12
            high_similarity_places = [p for p in place_scores if p[1] > 0.7]
            if len(high_similarity_places) >= 3:
                top_k = min(len(high_similarity_places), 12)
            else:
                # If not enough high similarity, take top 50% but at least 3
                top_k = max(3, len(places) // 2)
        
        # Select top places
        selected_places = [place_data[2] for place_data in place_scores[:top_k]]
        
        logger.info(f"Vector search selected {len(selected_places)} places out of {len(places)}")
        logger.info(f"Top similarity scores: {[round(score[1], 3) for score in place_scores[:5]]}")
        
        # Log the selected places for debugging
        selected_names = [p.get('name', 'Unknown') for p in selected_places]
        logger.info(f"Selected places: {selected_names}")
        
        return selected_places
        
    except Exception as e:
        logger.error(f"Error in vector search: {e}")
        return places  # Return all places if vector search fails

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Calculate cosine similarity between two vectors
    """
    try:
        # Convert to numpy arrays
        a = np.array(vec1)
        b = np.array(vec2)
        
        # Calculate cosine similarity
        dot_product = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return dot_product / (norm_a * norm_b)
    except Exception as e:
        logger.error(f"Error calculating cosine similarity: {e}")
        return 0.0



async def optimize_place_order(
    places: List[Dict[str, Any]], 
    start_time: str, 
    prompt_text: str | None = None, 
    travel_mode: str = "walking",
    end_time: str = "19:00"
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """
    Use AI to optimize the order of places and get a detailed recommendation.
    Now includes vector search filtering for better optimization.
    
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
        
        logger.info(f"Optimizing order for {len(places)} places using vector search + AI")
        
        # Step 1: Vector search filtering (if user provided a meaningful prompt)
        filtered_places = places
        if prompt_text and len(prompt_text.strip()) > 10:  # Only use vector search for substantial prompts
            filtered_places = await vector_search_places(places, prompt_text)
        
        # Step 2: AI optimization on the filtered places
        # AI should still select the best subset for a perfect day
        return await ai_optimization(filtered_places, start_time, prompt_text, travel_mode, end_time) 
        
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
        
        # Check for HTTP errors
        if response.status_code != 200:
            logger.error(f"OpenRouter API returned status {response.status_code}: {response.text}")
            response.raise_for_status()
        
        result = response.json()
        
        # Check for API-level errors in the response
        if "error" in result:
            error_msg = result["error"].get("message", "Unknown error")
            error_code = result["error"].get("code", "unknown")
            logger.error(f"OpenRouter API error {error_code}: {error_msg}")
            raise Exception(f"OpenRouter API error: {error_msg}")
        
        return result

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
        
        # AI should still select the best subset for a perfect day
        is_new_schedule = True
        
        # Create prompt with appropriate instructions
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

            if not isinstance(ordered_indices, list) or len(ordered_indices) == 0:
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
                logger.info(f"AI returned {len(place_reviews_from_ai)} place reviews")
                review_map = {review['place_id']: review['review'] for review in place_reviews_from_ai if 'place_id' in review and 'review' in review}
                logger.info(f"Review map created with {len(review_map)} entries: {list(review_map.keys())}")
                for place in optimized_places_list:
                    place_id = place.get('id')
                    if place_id in review_map:
                        place['ai_review'] = review_map[place_id]
                        logger.info(f"Attached AI review to place {place_id}: {place['ai_review'][:50]}...")
                    else:
                        logger.warning(f"No AI review found for place {place_id}")
            else:
                logger.warning(f"AI did not return place_reviews as list. Got: {type(place_reviews_from_ai)} - {place_reviews_from_ai}")
                # Fallback: Add simple default reviews
                for place in optimized_places_list:
                    place_type = place.get('placeType', 'place')
                    if 'restaurant' in place_type.lower() or 'food' in place_type.lower():
                        place['ai_review'] = "Recommended dining spot for this itinerary."
                    elif 'museum' in place_type.lower():
                        place['ai_review'] = "Fascinating cultural experience worth visiting."
                    elif 'park' in place_type.lower() or 'garden' in place_type.lower():
                        place['ai_review'] = "Beautiful outdoor space perfect for relaxation."
                    else:
                        place['ai_review'] = "Interesting stop that adds value to your day."
                logger.info("Added fallback AI reviews to all places")
            
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
    """Create a detailed prompt for the AI to optimize place order."""
    
    # Simple place data description without public POI insights
    descriptions = []
    for i, place in enumerate(place_data):
        desc = f"Place {i}: {place.get('name', 'Unknown')} (ID: {place.get('id', f'place_{i}')})"
        desc += f"\n  Type: {place.get('type', 'unknown')}"
        desc += f"\n  Location: {place.get('location', {})}"
        desc += f"\n  Address: {place.get('address', '')}"
        descriptions.append(desc)
    
    places_description = "\n\n".join(descriptions)
    
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
4. "place_reviews": Array of objects with "place_id" (use the ID from the place description) and "review" (1 sentence per place) [e.g., [{"place_id": "ChIJ123", "review": "Great museum with fascinating exhibits"}]]
5. "place_durations": Object mapping place_id to recommended visit duration in minutes (e.g., {"ChIJ123": 60, "ChIJ456": 90})
"""
    else:
        # For small lists or existing schedules
        selection_instructions = f"""
Create a full day itinerary from {start_time} to approximately {end_time}, ordering the places optimally.
"""
        output_format_str = """
Your response must be a JSON object with the following keys:
1. "ordered_indices": Array of indices in optimized order [e.g., 0, 2, 1, 3]
2. "day_overview": Brief summary of the day (2-3 sentences)
3. "place_reviews": Array of objects with "place_id" (use the ID from the place description) and "review" (1 sentence per place) [e.g., [{"place_id": "ChIJ123", "review": "Perfect spot for lunch with great views"}]]
4. "place_durations": Object mapping place_id to recommended visit duration in minutes (e.g., {"ChIJ123": 45, "ChIJ456": 90})
"""

    # Combine all elements to create the full prompt
    return f"""You are an expert travel route optimizer creating an optimal full-day itinerary.
Start the day at {start_time} and plan until around {end_time} (included travel time).

Places (enriched with public data insights):
{places_description}

{selection_instructions}

{meal_planning_guidelines}

{visit_duration_guidelines}

Considerations:
1. User preferences: {prompt_text if prompt_text else "Prioritize a logical flow with varied activities and well-spaced meals throughout the day."}
2. Travel mode: {travel_mode}
3. Visit duration: Assign a specific duration to each place that's appropriate for its type and importance
4. Geographical proximity between locations
5. CRITICAL: Avoid scheduling multiple main restaurants consecutively - separate them with attractions
6. For restaurants, carefully identify if they're a main meal place or just a light refreshment stop

{output_format_str}
""" 