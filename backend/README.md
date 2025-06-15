# Build Your Day - Backend

A FastAPI backend for generating personalized day itineraries.

## Project Structure

```
backend/
├── main.py               # Main FastAPI application
├── config.py             # Configuration settings
├── utils/                # Utility functions
│   └── auth.py           # Authentication utilities
├── db/                   # Database related code
│   ├── __init__.py       # Database connection
│   └── models.py         # Pydantic models
├── routes/               # API routes
│   ├── __init__.py       # Routes initialization
│   ├── auth.py           # Authentication routes
│   ├── archived_lists.py # Archived lists routes
│   └── schedules.py      # Schedule generation routes
└── services/             # Business logic services
    ├── ai_service.py     # AI integration for schedules
    └── schedule_service.py # Schedule generation logic
```

## Prerequisites

- Python 3.8 or higher
- MongoDB database

## Environment Variables

Create a `.env` file in the backend directory with the following variables:

```
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
GOOGLE_API_KEY=your_google_ai_api_key
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=your_mongodb_database_name
```

## Installation

1. Create a virtual environment:
   ```
   python -m venv venv
   ```

2. Activate the virtual environment:
   - On Windows: `venv\Scripts\activate`
   - On macOS/Linux: `source venv/bin/activate`

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

## Running the Backend

```
uvicorn main:app --host localhost --port 8000 --reload
```

The API will be available at: http://localhost:8000

## API Endpoints

- **Authentication**
  - `POST /api/auth/google` - Google OAuth authentication
  - `GET /api/me` - Get current user information
  - `POST /api/logout` - Logout

- **Archived Lists**
  - `GET /api/archived-lists` - Get all archived lists
  - `POST /api/archived-lists` - Create a new archived list
  - `PUT /api/archived-lists/{list_id}` - Update an archived list
  - `DELETE /api/archived-lists/{list_id}` - Delete an archived list

- **Schedules**
  - `POST /api/schedules` - Generate an optimized schedule 