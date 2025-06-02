import api from './api/axios';
import { Place, Schedule } from '../types';

export const scheduleService = {
  async generateSchedule(places: Place[], startTime: string): Promise<Schedule> {
    const response = await api.post('/schedules', {
      places,
      start_time: startTime
    });
    return response.data.schedule;
  }
}; 