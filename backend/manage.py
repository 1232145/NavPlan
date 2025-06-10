#!/usr/bin/env python3
"""
Management script for BuildYourDay backend
"""

import os
import sys
import asyncio
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

def create_db():
    """Create the database and collections"""
    from db import get_database
    try:
        with get_database() as db:
            # Create collections if they don't exist
            collections = ['archived_lists', 'public_pois', 'checkin_patterns']
            for collection_name in collections:
                if collection_name not in db.list_collection_names():
                    db.create_collection(collection_name)
                    print(f"Created collection: {collection_name}")
            
            # Create indexes
            db.archived_lists.create_index("user_id")
            db.public_pois.create_index([("location", "2dsphere")])
            db.public_pois.create_index("category")
            db.checkin_patterns.create_index([("location", "2dsphere")])
            
            print("Database setup completed successfully")
    except Exception as e:
        print(f"Error creating database: {e}")

def drop_db():
    """Drop the database"""
    from db import get_database
    try:
        with get_database() as db:
            db.client.drop_database(db.name)
            print("Database dropped successfully")
    except Exception as e:
        print(f"Error dropping database: {e}")

def test_vector_search():
    """Test vector search functionality with sample data"""
    async def run_test():
        try:
            from services.ai_service import vector_search_places, create_place_text_for_embedding
            
            # Sample places for testing
            sample_places = [
                {
                    "id": "1",
                    "name": "Joe's Pizza",
                    "placeType": "restaurant",
                    "address": "123 Main St",
                    "note": "Great family restaurant with authentic Italian food"
                },
                {
                    "id": "2", 
                    "name": "Central Park",
                    "placeType": "park",
                    "address": "Central Park, NY",
                    "note": "Beautiful outdoor space for families and kids"
                },
                {
                    "id": "3",
                    "name": "Metropolitan Museum",
                    "placeType": "museum", 
                    "address": "1000 5th Ave",
                    "note": "World-class art museum with amazing exhibitions"
                },
                {
                    "id": "4",
                    "name": "Starbucks Coffee",
                    "placeType": "cafe",
                    "address": "456 Broadway",
                    "note": "Quick coffee stop"
                },
                {
                    "id": "5",
                    "name": "Olive Garden",
                    "placeType": "restaurant", 
                    "address": "789 Restaurant Row",
                    "note": "Family-friendly Italian restaurant with kids menu"
                }
            ]
            
            print("Testing vector search functionality...")
            print(f"Sample places: {[p['name'] for p in sample_places]}")
            
            # Test different queries
            test_queries = [
                "I like family restaurants",
                "outdoor activities for kids", 
                "cultural attractions and museums",
                "coffee and cafes"
            ]
            
            for query in test_queries:
                print(f"\n--- Testing query: '{query}' ---")
                
                # Show place text representations
                print("Place text representations:")
                for i, place in enumerate(sample_places):
                    place_text = create_place_text_for_embedding(place)
                    print(f"  {i+1}. {place['name']}: {place_text}")
                
                # Run vector search
                results = await vector_search_places(sample_places, query, top_k=3)
                
                print(f"Selected places: {[p['name'] for p in results]}")
                print("-" * 50)
            
            print("\nVector search test completed successfully!")
            
        except Exception as e:
            print(f"Error in vector search test: {e}")
            import traceback
            traceback.print_exc()
    
    asyncio.run(run_test())

def import_public_data(bbox="-74.0,40.7,-73.9,40.8", categories=""):
    """Import public POI datasets for MongoDB challenge"""
    async def run_import():
        try:
            from services.public_data_service import public_data_service
            
            # Parse bounding box
            bbox_coords = [float(x) for x in bbox.split(',')]
            if len(bbox_coords) != 4:
                print("Error: bbox must have 4 coordinates (min_lon,min_lat,max_lon,max_lat)")
                return
            
            # Parse categories
            category_list = [cat.strip() for cat in categories.split(',')] if categories else None
            
            print(f"Importing public POI data for bbox: {bbox_coords}")
            print(f"Categories: {category_list or 'default categories'}")
            
            # Import OpenStreetMap POIs
            print("Importing OpenStreetMap POIs...")
            pois = await public_data_service.import_osm_pois(bbox_coords, category_list)
            
            # For demo purposes, create some sample check-in data
            sample_checkins = []
            for poi in pois[:10]:  # Use first 10 POIs for demo
                # Extract lat/lng from GeoJSON format
                coords = poi.location["coordinates"]  # [lng, lat]
                sample_checkins.append({
                    "lat": coords[1],  
                    "lng": coords[0],
                    "venue_category": poi.category,
                    "date": "2024-1-15",
                    "time": "12:30:0",
                    "user_id": "demo_user"
                })
            
            # Analyze check-in patterns
            print("Analyzing check-in patterns...")
            patterns = await public_data_service.analyze_checkin_patterns(sample_checkins)
            
            # Store data in MongoDB
            print("Storing data in MongoDB...")
            await public_data_service.store_public_data(pois, patterns)
            
            print(f"Successfully imported {len(pois)} POIs and {len(patterns)} patterns")
            
        except Exception as e:
            print(f"Error importing public data: {e}")
            import traceback
            traceback.print_exc()
    
    asyncio.run(run_import())

def run_server():
    """Run the FastAPI server"""
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

def main():
    """Main CLI entry point"""
    if len(sys.argv) < 2:
        print("Usage: python manage.py <command> [args...]")
        print("Commands:")
        print("  create_db                    - Create database and collections")
        print("  drop-db                      - Drop the database")
        print("  test_vector_search          - Test vector search functionality")
        print("  import_public_data [bbox]   - Import public POI data")
        print("  run                          - Run the development server")
        return
    
    command = sys.argv[1]
    
    if command == "create_db":
        create_db()
    elif command == "drop-db":
        drop_db()
    elif command == "test_vector_search":
        test_vector_search()
    elif command == "import_public_data":
        bbox = sys.argv[2] if len(sys.argv) > 2 else "-74.0,40.7,-73.9,40.8"
        categories = sys.argv[3] if len(sys.argv) > 3 else ""
        import_public_data(bbox, categories)
    elif command == "run":
        run_server()
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    main() 