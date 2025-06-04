import api from './api/axios';
import { Place, Schedule } from '../types';

export const scheduleService = {
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
    return response.data.schedule;
  }
}; 