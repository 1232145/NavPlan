import api from './api/axios';
import { Place, Schedule, ScheduleItem } from '../types';

// Cache TTL - 1 hour (in milliseconds)
const CACHE_TTL = 60 * 60 * 1000;

// Cache for schedules
interface CachedSchedule {
  schedule: Schedule;
  timestamp: number;
}

// In-memory cache
const schedulesCache = new Map<string, CachedSchedule>();

// Generate a cache key from schedule parameters
const generateCacheKey = (
  places: Place[], 
  startTime: string, 
  endTime: string,
  travelMode: string,
  dayOverview?: string
): string => {
  const placeIds = places.map(place => place.id).sort().join(',');
  return `${placeIds}|${startTime}|${endTime}|${travelMode}|${dayOverview || ''}`;
};

export const scheduleService = {
  /**
   * Generate a schedule with AI-optimized routing and place selection
   * 
   * The AI will select an optimal subset of places (3-8) for a day itinerary when
   * generating a new schedule. When updating an existing schedule (e.g., changing
   * travel mode), the same places will be preserved.
   * 
   * @param places List of places to consider for the schedule
   * @param startTime Start time in HH:MM format
   * @param endTime End time in HH:MM format
   * @param travelMode Travel mode (walking, driving, bicycling, transit)
   * @param prompt Optional user preferences/instructions for the AI
   * @param dayOverview Optional existing day overview (for updating a schedule)
   * @param total_places Total places in the schedule
   * @param preferences Optional user preferences for the AI
   * @returns A Schedule object with optimized places and routing
   */
  async generateSchedule(
    places: Place[], 
    startTime: string, 
    travelMode: string = "walking",
    prompt?: string,
    dayOverview?: string,
    total_places?: number,
    endTime: string = "19:00",
    preferences?: any
  ): Promise<Schedule> {
    // If this is an update request (has dayOverview), check cache
    const isUpdateRequest = !!dayOverview;
    const cacheKey = generateCacheKey(places, startTime, endTime, travelMode, dayOverview);
    
    // Only check cache for update requests, not for new schedule generation
    if (isUpdateRequest) {
      const cached = schedulesCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.schedule;
      }
    }
    
    const requestBody: any = {
      places,
      start_time: startTime,
      end_time: endTime,
      travel_mode: travelMode,
      prompt,
      day_overview: dayOverview,
    };

    // Add preferences if provided
    if (preferences) {
      requestBody.preferences = preferences;
    }
    
    const response = await api.post('/schedules', requestBody);
    
    const schedule = response.data.schedule;
    schedule.total_places = total_places;
    
    // Cache the newly fetched schedule - for both new and update requests
    // For new schedules, we'll cache based on the returned schedule items
    // which might be a subset of the original places
    const effectiveCacheKey = isUpdateRequest ? 
      cacheKey : 
      generateCacheKey(
        schedule.items.map((item: ScheduleItem) => ({ id: item.place_id, name: item.name })) as Place[],
        startTime,
        endTime,
        travelMode
      );
    
    schedulesCache.set(effectiveCacheKey, { 
      schedule, 
      timestamp: Date.now() 
    });
    
    return schedule;
  },
  
  /**
   * Clear the schedule cache
   * 
   * This can be used to force a fresh schedule generation
   * when user preferences change or when schedules might be stale.
   */
  clearCache(): void {
    schedulesCache.clear();
  }
}; 