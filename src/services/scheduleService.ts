import api from './api/axios';
import { Place, Schedule } from '../types';

export const scheduleService = {
  async generateSchedule(
    places: Place[], 
    startTime: string, 
    travelMode: string = "walking"
  ): Promise<Schedule> {
    const response = await api.post('/schedules', {
      places,
      start_time: startTime,
      travel_mode: travelMode
    });
    return response.data.schedule;
  }
}; 