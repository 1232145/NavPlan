import api from './api/axios';
import { 
  SavedSchedule, 
  SaveScheduleRequest, 
  ArchivedList 
} from '../types';

// Cache management for archive schedules
class ArchiveScheduleCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  invalidate(pattern?: string): void {
    if (pattern) {
      Array.from(this.cache.keys())
        .filter(key => key.includes(pattern))
        .forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }
}

const cache = new ArchiveScheduleCache();

export const archiveScheduleService = {
  /**
   * Save a schedule to an archive list
   */
  async saveSchedule(request: SaveScheduleRequest): Promise<{ schedule_id: string; slot_number: number }> {
    const response = await api.post(`/archived-lists/${request.archive_list_id}/schedules`, request);
    cache.invalidate(request.archive_list_id);
    return response.data;
  },

  /**
   * Get all schedules for an archive list
   */
  async getArchiveSchedules(listId: string): Promise<{
    schedules: SavedSchedule[];
    total_slots: number;
    used_slots: number;
    available_slots: number;
  }> {
    const cacheKey = `schedules_${listId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const response = await api.get(`/archived-lists/${listId}/schedules`);
    cache.set(cacheKey, response.data);
    return response.data;
  },

  /**
   * Get a specific schedule
   */
  async getSchedule(listId: string, scheduleId: string): Promise<SavedSchedule> {
    const cacheKey = `schedule_${listId}_${scheduleId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const response = await api.get(`/archived-lists/${listId}/schedules/${scheduleId}`);
    cache.set(cacheKey, response.data);
    return response.data;
  },

  /**
   * Update schedule metadata (name, favorite status)
   */
  async updateSchedule(listId: string, scheduleId: string, updates: Record<string, any>): Promise<void> {
    await api.put(`/archived-lists/${listId}/schedules/${scheduleId}`, {
      archive_list_id: listId,
      schedule_id: scheduleId,
      updates
    });
    cache.invalidate(listId);
  },

  /**
   * Delete a schedule
   */
  async deleteSchedule(listId: string, scheduleId: string): Promise<void> {
    await api.delete(`/archived-lists/${listId}/schedules/${scheduleId}`);
    cache.invalidate(listId);
  },

  /**
   * Helper: Check if archive list can add more schedules
   */
  canAddSchedule(list: ArchivedList): boolean {
    return list.saved_schedules.length < 3;
  },

  /**
   * Helper: Get next available slot number
   */
  getAvailableSlotNumber(list: ArchivedList): number | null {
    if (!this.canAddSchedule(list)) return null;
    
    const usedSlots = new Set(
      list.saved_schedules
        .map((_, index) => index + 1)
        .filter(slot => slot <= 3)
    );
    
    for (let slot = 1; slot <= 3; slot++) {
      if (!usedSlots.has(slot)) return slot;
    }
    return null;
  },

  /**
   * Helper: Get schedule by ID
   */
  getScheduleById(list: ArchivedList, scheduleId: string): SavedSchedule | null {
    return list.saved_schedules.find(s => s.metadata.schedule_id === scheduleId) || null;
  },

  /**
   * Helper: Format slot name
   */
  getScheduleSlotName(slotNumber: number): string {
    const names = ['', 'Morning Route', 'Afternoon Route', 'Evening Route'];
    return names[slotNumber] || `Slot ${slotNumber}`;
  },

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    cache.invalidate();
  }
}; 