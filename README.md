# NavPlan 🗺️

A smart travel planning application that helps users discover amazing places and generate optimized day itineraries using AI-powered recommendations.

> **Live Demo**: [https://nav-plan.vercel.app](https://nav-plan.vercel.app)

### **MongoDB Atlas **
- **Geospatial Queries**: 2dsphere indexes for location-based POI discovery within radius searches
- **Text Search**: Full-text search across POI names, categories, and addresses for semantic place discovery
- **Aggregation Pipelines**: Complex queries combining geospatial, text search, and relevance scoring
- **Atlas Search**: Enhanced search capabilities for intelligent place recommendations

### **Google Cloud Platform **
- **Maps JavaScript API**: Interactive map visualization and place selection
- **Places API**: Real-time place details, photos, and business information
- **Geocoding API**: Address-to-coordinates conversion for location processing  
- **Directions API**: Route optimization and travel time calculations
- **OAuth 2.0**: Secure user authentication and profile management

## ✨ Features

- **🔍 Smart Place Discovery**: Search and discover places using Google Maps integration
- **🤖 AI-Powered Itineraries**: Generate optimized schedules using advanced AI models
- **📱 Interactive Maps**: Real-time map visualization with route planning
- **💾 Archive Lists**: Save and organize your favorite places into collections
- **📅 Schedule Management**: Create, save, and manage multiple itineraries
- **🎯 Contextual Filtering**: Smart filtering based on place types and preferences
- **🔄 Override Scheduling**: Replace existing schedules when archive lists are full

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: CSS Variables with custom design system
- **Maps**: Google Maps JavaScript API
- **State Management**: React Context + Custom Hooks
- **Routing**: React Router

### Backend (FastAPI + Python)
- **Framework**: FastAPI
- **Database**: MongoDB with PyMongo
- **AI Services**: OpenRouter API
- **Maps**: Google Maps API + Geoapify
- **Authentication**: Google OAuth 2.0

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.8+
- **MongoDB** (local or cloud)
- **Google Cloud Console** account (for Maps & Auth)
- **OpenRouter** account (for AI features)
- **Geoapify** account (for POI data)

### Environment Setup

Create a `.env` file in the project root:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=buildyourday

# Google Services
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
GOOGLE_API_KEY=your_google_api_key

# AI Services
OPENROUTER_API_KEY=your_openrouter_api_key

# POI Data Services
GEOAPIFY_API_KEY=your_geoapify_api_key
```

### API Keys Setup

#### 1. Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable these APIs:
   - **Maps JavaScript API**
   - **Places API**
   - **Geocoding API**
   - **Directions API**
4. Create credentials:
   - **API Key** for `VITE_GOOGLE_MAPS_API_KEY` and `GOOGLE_API_KEY`
   - **OAuth 2.0 Client ID** for `VITE_GOOGLE_CLIENT_ID`

#### 2. OpenRouter
1. Sign up at [OpenRouter](https://openrouter.ai/)
2. Get your API key for `OPENROUTER_API_KEY`

#### 3. Geoapify
1. Sign up at [Geoapify](https://www.geoapify.com/)
2. Get your API key for `GEOAPIFY_API_KEY`

### Installation & Running

#### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### Frontend Setup
```bash
npm install
npm run dev -- --port 3000
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs (Swagger UI)
- **Alternative Docs**: http://localhost:8000/redoc (ReDoc)

## 📁 Project Structure

```
BuildYourDay/
├── src/                         # Frontend React application
│   ├── components/              # Reusable UI components
│   ├── pages/                   # Page components
│   ├── hooks/                   # Custom React hooks
│   ├── services/                # API service layer
│   ├── context/                 # React context providers
│   ├── types/                   # TypeScript type definitions
│   └── styles/                  # Global styles and CSS
├── backend/                     # FastAPI backend
│   ├── routes/                  # API route handlers
│   ├── services/                # Business logic services
│   ├── db/                      # Database models and connection
│   ├── utils/                   # Utility functions
│   ├── main.py                  # FastAPI application entry
│   └── config.py                # Configuration management
└── public/                      # Static assets
```

## 🔧 Development

### Frontend Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Backend Development
```bash
# In backend directory
python manage.py run                         # Development server
```

### Database Management
```bash
cd backend
python manage.py create_db                   # Create database indexes
python manage.py import_public_data          # Import POI data
python manage.py drop-db                     # Drop database
```

## 🌐 API Endpoints

### Core Endpoints
- `GET /` - Health check
- `GET /api/places/search` - Search places
- `POST /api/schedules/generate` - Generate AI itinerary
- `GET /api/archived-lists` - Get saved lists
- `POST /api/archived-lists` - Create new list
- `POST /api/archived-lists/{id}/schedules` - Save schedule

### Authentication
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/me` - Get current user
