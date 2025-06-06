import api from './api/axios';
import { Place, Schedule } from '../types';

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
   * @param travelMode Travel mode (walking, driving, bicycling, transit)
   * @param prompt Optional user preferences/instructions for the AI
   * @param dayOverview Optional existing day overview (for updating a schedule)
   * @returns A Schedule object with optimized places and routing
   */
  async generateSchedule(
    places: Place[], 
    startTime: string, 
    travelMode: string = "walking",
    prompt?: string,
    dayOverview?: string,
  ): Promise<Schedule> {
    const response = await api.post('/schedules', {
      places,
      start_time: startTime,
      travel_mode: travelMode,
      prompt,
      day_overview: dayOverview,
    });
    
    // The backend response includes the schedule in response.data.schedule
    // and other metadata like selected_place_count in response.data
    // For now, we only care about the schedule object itself for the return type.
    // If AppContext needs more data (like selected_place_count for some logic),
    // this service could return response.data instead of just response.data.schedule.
    // However, the existing type hint is Promise<Schedule>.
    // The actual response structure from backend is { schedule: Schedule, optimized: boolean, ... }
    // So, returning response.data.schedule is correct if only Schedule is needed.
    // If the caller (AppContext) needs the other fields like 'optimized', this would need to change.
    // Based on current AppContext.generateSchedule, it only uses the schedule object.
    return response.data.schedule;
  }
}; 