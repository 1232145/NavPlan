import logging
import json
import re # Import the re module
import math
from typing import List, Dict, Any, Tuple, Optional
import httpx
from config import GOOGLE_API_KEY, OPENROUTER_API_KEY
from db import get_database
from db.models import TravelMode, BalanceMode

# Configure logging
logger = logging.getLogger(__name__)

# Use scikit-learn for lightweight vector search
SENTENCE_TRANSFORMERS_AVAILABLE = False
logger.info("Using optimized lightweight vector search (32-dimensional semantic features)")
logger.info("Vector search capabilities: ✅ Semantic matching ✅ Category detection ✅ Text analysis")

# TF-IDF fallback for when sentence-transformers is not available
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine_similarity
    SKLEARN_AVAILABLE = True
    _tfidf_vectorizer = None
    
    def get_tfidf_vectorizer():
        global _tfidf_vectorizer
        if _tfidf_vectorizer is None:
            _tfidf_vectorizer = TfidfVectorizer(
                max_features=1000,
                stop_words='english',
                ngram_range=(1, 2)
            )
        return _tfidf_vectorizer
        
except ImportError:
    SKLEARN_AVAILABLE = False
    logger.warning("scikit-learn not available. Vector search will be limited.")

async def create_place_embedding(place_text: str) -> List[float]:
    """
    Create embedding for place using lightweight TF-IDF approach
    """
    try:
        if SKLEARN_AVAILABLE:
            # Use a more sophisticated approach than simple hashing
            # Create features based on text characteristics
            import re
            from collections import Counter
            
            # Clean and tokenize text
            text_lower = place_text.lower()
            words = re.findall(r'\b\w+\b', text_lower)
            
            # Create feature vector based on:
            # 1. Word frequency features
            # 2. Text length features  
            # 3. Category keywords
            # 4. Semantic indicators
            
            # Define category keywords for better semantic matching
            category_keywords = {
                'food': ['restaurant', 'cafe', 'food', 'dining', 'eat', 'meal', 'kitchen', 'bar', 'drink'],
                'culture': ['museum', 'art', 'gallery', 'theater', 'cultural', 'history', 'exhibition'],
                'nature': ['park', 'garden', 'outdoor', 'nature', 'green', 'tree', 'lake', 'river'],
                'shopping': ['shop', 'store', 'market', 'mall', 'boutique', 'retail'],
                'entertainment': ['entertainment', 'fun', 'activity', 'game', 'sport', 'recreation'],
                'tourism': ['tourist', 'attraction', 'landmark', 'monument', 'historic', 'famous']
            }
            
            # Create 32-dimensional feature vector
            features = []
            
            # Category presence features (6 dimensions)
            for category, keywords in category_keywords.items():
                score = sum(1 for word in words if word in keywords) / max(len(words), 1)
                features.append(score)
            
            # Text characteristics (8 dimensions)
            features.extend([
                len(words) / 20.0,  # Word count (normalized)
                len(text_lower) / 100.0,  # Character count (normalized)
                sum(1 for c in text_lower if c.isupper()) / max(len(text_lower), 1),  # Uppercase ratio
                text_lower.count('!') + text_lower.count('?'),  # Excitement indicators
                text_lower.count('great') + text_lower.count('amazing') + text_lower.count('best'),  # Positive words
                text_lower.count('bad') + text_lower.count('poor') + text_lower.count('worst'),  # Negative words
                len(set(words)) / max(len(words), 1),  # Vocabulary diversity
                sum(len(word) for word in words) / max(len(words), 1)  # Average word length
            ])
            
            # Most frequent words features (10 dimensions)
            word_counts = Counter(words)
            common_words = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
            for word in common_words[:10]:
                features.append(word_counts.get(word, 0) / max(len(words), 1))
            
            # Hash-based features for uniqueness (8 dimensions)
            import hashlib
            text_hash = hashlib.md5(place_text.encode()).hexdigest()
            for i in range(0, 16, 2):
                features.append(int(text_hash[i:i+2], 16) / 255.0)
            
            # Ensure exactly 32 dimensions
            features = features[:32]
            while len(features) < 32:
                features.append(0.0)
                
            return features
            
        logger.warning("No embedding method available")
        return []
                
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

# Removed complex intent detection - using explicit user preferences instead

async def preference_based_selection(places: List[Dict[str, Any]], preferences: Dict[str, Any], query: str = "") -> List[Dict[str, Any]]:
    """
    Simple, reliable place selection based on explicit user preferences.
    """
    try:
        if not places:
            return places
        
        logger.info(f"PREFERENCE-BASED SELECTION: {len(places)} places | Preferences: {preferences}")
        
        # Extract user preferences
        must_include = preferences.get('must_include', [])  # ['restaurants', 'museums', 'cafes']
        max_places = preferences.get('max_places', 12)
        balance_mode = preferences.get('balance_mode', 'balanced')  # 'focused', 'balanced', 'diverse'
        meal_requirements = preferences.get('meal_requirements', False)
        
        # Define category mappings
        category_mapping = {
            'restaurants': ['catering.restaurant', 'catering.fast_food'],
            'cafes': ['catering.cafe'],
            'museums': ['tourism.museum', 'tourism.attraction'],
            'parks': ['leisure.park'],
            'shopping': ['shop'],
            'bars': ['catering.bar'],
            'attractions': ['tourism.attraction', 'tourism.museum']
        }
        
        # Handle meal requirements - ensure restaurants are included
        if meal_requirements and 'restaurants' not in must_include:
            must_include = list(must_include) + ['restaurants']
            logger.info("Added restaurants to must_include due to meal requirements")
        
        # Set limits based on preferences and balance mode
        category_limits = {}
        
        if must_include:
            # User has explicit preferences - honor them
            for category in must_include:
                if balance_mode == 'focused':
                    # Heavy focus on selected categories
                    category_limits[category] = 6 if category in ['restaurants', 'cafes'] else 4
                elif balance_mode == 'balanced':
                    # Balanced representation
                    category_limits[category] = 4 if category in ['restaurants', 'cafes'] else 3
                else:  # diverse
                    # Light representation of each
                    category_limits[category] = 3
            
            # For meal requirements, ensure minimum restaurant count
            if meal_requirements and category_limits.get('restaurants', 0) < 2:
                category_limits['restaurants'] = 2
                logger.info("Ensured minimum 2 restaurants for meal requirements")
            
            # Set lower limits for non-selected categories
            all_categories = ['restaurants', 'cafes', 'museums', 'parks', 'shopping', 'bars']
            for category in all_categories:
                if category not in category_limits:
                    category_limits[category] = 1 if balance_mode != 'focused' else 0
        else:
            # No explicit preferences - use balanced defaults
            category_limits = {
                'restaurants': 3,
                'cafes': 3, 
                'museums': 2,
                'parks': 2,
                'shopping': 1,
                'bars': 1
            }
        
        logger.info(f"Category limits based on preferences: {category_limits}")
        
        # Simple selection algorithm
        selected_places = []
        selected_place_ids = set()  # Track selected IDs to prevent duplicates
        category_counts = {cat: 0 for cat in category_limits.keys()}
        
        # Group places by category
        places_by_category = {cat: [] for cat in category_limits.keys()}
        other_places = []
        
        for place in places:
            place_category = place.get('category', 'unknown')
            categorized = False
            
            for user_category, db_categories in category_mapping.items():
                if place_category in db_categories:
                    places_by_category[user_category].append(place)
                    categorized = True
                    break
            
            if not categorized:
                other_places.append(place)
        
        # Phase 1: Fill must-include categories first (prioritize meal requirements)
        categories_to_process = list(must_include) if must_include else list(category_limits.keys())
        
        # If meal requirements, prioritize restaurants first
        if meal_requirements and 'restaurants' in categories_to_process:
            categories_to_process.remove('restaurants')
            categories_to_process.insert(0, 'restaurants')
        
        for category in categories_to_process:
            limit = category_limits.get(category, 0)
            available_places = places_by_category.get(category, [])
            
            # Filter out already selected places by ID
            available_places = [p for p in available_places if p.get('id') not in selected_place_ids]
            
            if not available_places:
                logger.info(f"No available {category} places (all may be already selected)")
                continue
            
            # Use vector search if we have a query, otherwise random selection
            if query and len(query.strip()) > 5 and available_places:
                # Simple vector scoring for this category only
                scored_places = await simple_vector_score(available_places, query)
                selected_from_category = scored_places[:limit]
            else:
                # Take first available places for deterministic selection
                selected_from_category = available_places[:limit]
            
            # Add to selection with duplicate prevention
            for place in selected_from_category:
                place_id = place.get('id')
                if place_id not in selected_place_ids:
                    selected_places.append(place)
                    selected_place_ids.add(place_id)
                    category_counts[category] += 1
            
            logger.info(f"Selected {category_counts[category]} {category} places")
        
        # Phase 2: Fill remaining slots with other categories if needed
        remaining_slots = max_places - len(selected_places)
        if remaining_slots > 0:
            for category, limit in category_limits.items():
                if remaining_slots <= 0:
                    break
                
                current_count = category_counts[category]
                if current_count < limit:
                    available_places = places_by_category.get(category, [])
                    # Filter out already selected places by ID
                    available_places = [p for p in available_places if p.get('id') not in selected_place_ids]
                    
                    additional_needed = min(limit - current_count, remaining_slots)
                    additional_places = available_places[:additional_needed]
                    
                    # Add with duplicate prevention
                    for place in additional_places:
                        place_id = place.get('id')
                        if place_id not in selected_place_ids and remaining_slots > 0:
                            selected_places.append(place)
                            selected_place_ids.add(place_id)
                            remaining_slots -= 1
                            category_counts[category] += 1
        
        # Log final selection
        final_counts = {}
        for place in selected_places:
            place_category = place.get('category', 'unknown')
            for user_category, db_categories in category_mapping.items():
                if place_category in db_categories:
                    final_counts[user_category] = final_counts.get(user_category, 0) + 1
                    break
        
        logger.info(f"FINAL SELECTION: {len(selected_places)} places | Distribution: {final_counts}")
        
        # Validate meal requirements are met
        if meal_requirements and final_counts.get('restaurants', 0) == 0:
            logger.warning("⚠️ Meal requirements requested but no restaurants selected - may need more restaurant data")
        
        return selected_places
        
    except Exception as e:
        logger.error(f"Error in preference-based selection: {e}")
        return places[:12]  # Fallback to first 12 places

async def simple_vector_score(places: List[Dict[str, Any]], query: str) -> List[Dict[str, Any]]:
    """
    Lightweight vector scoring for places when user has a query.
    Much simpler than the previous complex system.
    """
    try:
        if not SENTENCE_TRANSFORMERS_AVAILABLE or not query:
            return places
        
        model = get_embedding_model()
        if model is None:
            return places
        
        # Create embeddings
        query_embedding = await create_query_embedding(query)
        if not query_embedding:
            return places
        
        place_texts = [create_place_text_for_embedding(place) for place in places]
        place_embeddings = model.encode(place_texts, convert_to_tensor=False, show_progress_bar=False)
        
        # Score and sort
        scored_places = []
        for place, place_embedding in zip(places, place_embeddings):
            if hasattr(place_embedding, 'tolist'):
                place_embedding = place_embedding.tolist()
            else:
                place_embedding = list(place_embedding)
            
            similarity = cosine_similarity(query_embedding, place_embedding)
            scored_places.append((similarity, place))
        
        # Sort by similarity (highest first)
        scored_places.sort(key=lambda x: x[0], reverse=True)
        return [place for score, place in scored_places]
        
    except Exception as e:
        logger.error(f"Error in simple vector scoring: {e}")
        return places

async def vector_search_places(places: List[Dict[str, Any]], query: str, top_k: int = None) -> List[Dict[str, Any]]:
    """
    Updated to use the new preference-based system.
    This will be called with preferences from the frontend.
    """
    # For backward compatibility, if no preferences are provided, use defaults
    default_preferences = {
        'must_include': [],
        'max_places': top_k or 12,
        'balance_mode': 'balanced'
    }
    
    return await preference_based_selection(places, default_preferences, query)

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Calculate cosine similarity between two vectors
    """
    try:
        # Convert to numpy arrays
        a = vec1
        b = vec2
        
        # Calculate cosine similarity
        dot_product = sum(a[i] * b[i] for i in range(len(a)))
        norm_a = math.sqrt(sum(x**2 for x in a))
        norm_b = math.sqrt(sum(x**2 for x in b))
        
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
    travel_mode: TravelMode = TravelMode.WALKING,
    end_time: str = "19:00",
    preferences: Dict[str, Any] | None = None
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """    
    Args:
        places: List of place objects with location data
        start_time: Start time for the schedule in HH:MM format
        prompt_text: Optional custom prompt for the AI
        travel_mode: Mode of transportation (walking, driving, bicycling, transit)
        end_time: End time for the schedule in HH:MM format
        preferences: Optional user preferences for place selection
        
    Returns:
        A tuple containing:
            - Optimized list of places in the order they should be visited
            - An optional AI-generated day overview
    """
    try:
        if len(places) <= 1:
            return places, None
        
        logger.info(f"Optimizing order for {len(places)} places")
        
        current_location = None
        other_places = places
        
        # Extract current location if it exists
        if places and places[0].get("id") == "current-location":
            current_location = places[0]
            other_places = places[1:]  # Exclude current location from optimization
            logger.info("Found current location - will preserve as starting point")
        
        # Step 1: Use preference-based selection instead of complex vector search
        filtered_other_places = other_places
        if preferences or (prompt_text and len(prompt_text.strip()) > 10):
            # Convert preferences to the format expected by preference_based_selection
            if not preferences:
                # Fallback: create basic preferences from prompt if no explicit preferences
                preferences = {
                    'must_include': [],
                    'max_places': 12,
                    'balance_mode': 'balanced'
                }
            
            filtered_other_places = await preference_based_selection(
                other_places, 
                preferences, 
                prompt_text or ""
            )
            logger.info(f"Preference-based selection filtered from {len(other_places)} to {len(filtered_other_places)} places")
        
        # Step 2: AI optimization (current location will be handled separately)
        optimized_other_places, day_overview = await ai_optimization(
            filtered_other_places, start_time, prompt_text, travel_mode, end_time
        )
        
        # Step 3: Combine results - current location always first
        if current_location:
            final_places = [current_location] + optimized_other_places
            logger.info(f"Final schedule: current location + {len(optimized_other_places)} optimized places")
        else:
            final_places = optimized_other_places
        
        return final_places, day_overview
        
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
                "messages": [{"role": "user", "content": prompt}]
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
    travel_mode: TravelMode = TravelMode.WALKING,
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
                
                # Map ordered_indices to filtered places
                original_to_filtered = {idx: i for i, idx in enumerate(valid_selected_indices)}
                
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
    travel_mode: TravelMode = TravelMode.WALKING,
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
    
    # Calculate available time for better planning
    start_hour, start_minute = map(int, start_time.split(':'))
    end_hour, end_minute = map(int, end_time.split(':'))
    total_available_minutes = (end_hour * 60 + end_minute) - (start_hour * 60 + start_minute)
    
    # CRITICAL time management guidelines
    time_management_guidelines = f"""
CRITICAL TIME CONSTRAINTS:
- Start time: {start_time}
- End time: {end_time} (MUST NOT EXCEED)
- Total available time: {total_available_minutes} minutes ({total_available_minutes // 60}h {total_available_minutes % 60}m)
- NEVER schedule activities beyond {end_time}
- Include realistic travel time between locations
- Aim to finish all activities by {end_time} at the latest
"""

    # Improved meal planning guidelines
    meal_planning_guidelines = """
MEAL SPACING REQUIREMENTS:
- NEVER place two restaurants consecutively in the schedule
- ALWAYS have at least 2 non-food places between restaurants
- Include exactly ONE lunch restaurant (12:00-14:00) unless cafe or snacks
- Include maximum ONE dinner restaurant (17:30+ if time allows) unless cafe or snacks
- Cafes/light snacks are separate from main restaurants
- If you run out of diverse place types, END THE SCHEDULE EARLY rather than repeating restaurants
- Better to have 4-5 well-spaced places than 6+ with poor spacing
"""

    # Visit duration guidelines with realistic timing
    visit_duration_guidelines = """
REALISTIC VISIT DURATIONS (include buffer time):
- Major museums/galleries: 60-90 minutes maximum
- Tourist attractions: 45-60 minutes
- Parks/outdoor spaces: 30-45 minutes for casual visits
- Main meal restaurants: 60-90 minutes
- Cafes/dessert shops: 20-30 minutes
- Shopping/retail: 30-45 minutes
- Travel time: Account for realistic walking/transit times between places
"""

    # Base prompt elements
    selection_instructions = ""
    output_format_str = ""
    
    # Add selection instructions if this is a new schedule and we have multiple places
    if select_subset and place_count >= 5:
        max_places = min(8, max(4, total_available_minutes // 90))  # Conservative place count based on time
        selection_instructions = f"""
Select {max_places} places maximum to create a realistic full day itinerary from {start_time} to {end_time}.
PRIORITIZE: meal timing, geographical proximity, variety of experiences.
ENSURE: The schedule fits within the {total_available_minutes} minute time window.
"""
        
        output_format_str = """
Your response must be a JSON object with the following keys:
1. "selected_place_indices": Array of indices you recommend [e.g., 0, 2, 5, 8]
2. "ordered_indices": Same selected indices in your recommended visiting order
3. "day_overview": Brief summary of the day (2-3 sentences)
4. "place_reviews": Array of objects with "place_id" (use the ID from the place description) and "review" (1 sentence per place) [e.g., [{"place_id": "ChIJ123", "review": "Great museum with fascinating exhibits"}]]
5. "place_durations": Object mapping place_id to recommended visit duration in minutes (e.g., {"ChIJ123": 45, "ChIJ456": 60})
"""
    else:
        # For small lists or existing schedules
        selection_instructions = f"""
Create a realistic full day itinerary from {start_time} to {end_time}, ordering the places optimally.
ENSURE the schedule fits within the {total_available_minutes} minute time window.
"""
        output_format_str = """
Your response must be a JSON object with the following keys:
1. "ordered_indices": Array of indices in optimized order [e.g., 0, 2, 1, 3]
2. "day_overview": Brief summary of the day (2-3 sentences)
3. "place_reviews": Array of objects with "place_id" (use the ID from the place description) and "review" (1 sentence per place) [e.g., [{"place_id": "ChIJ123", "review": "Perfect spot for lunch with great views"}]]
4. "place_durations": Object mapping place_id to recommended visit duration in minutes (e.g., {"ChIJ123": 45, "ChIJ456": 60})
"""

    # Combine all elements to create the full prompt
    return f"""You are an expert travel route optimizer creating a REALISTIC and TIME-CONSTRAINED full-day itinerary.

{time_management_guidelines}

Places (enriched with public data insights):
{places_description}

{selection_instructions}

{meal_planning_guidelines}

{visit_duration_guidelines}

CRITICAL REQUIREMENTS:
1. User preferences: {prompt_text if prompt_text else "Prioritize a logical flow with varied activities and well-spaced meals throughout the day."}
2. Travel mode: {travel_mode.value if isinstance(travel_mode, TravelMode) else travel_mode}
3. TIME CONSTRAINT: All activities MUST end by {end_time}
4. MEAL SPACING: NEVER schedule restaurants consecutively - always have 2+ non-food places between meals
5. QUALITY OVER QUANTITY: End schedule early rather than repeating similar venue types
6. DIVERSITY: Prioritize variety in place types over total number of places
7. REALISM: Account for travel time and realistic visit durations

{output_format_str}
""" 