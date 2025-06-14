import { ArchivedList } from '../types';
import api from './api/axios';
import { cacheUtils } from './cacheManager';

export const archivedListService = {
  async createList(name: string, places: any[], note?: string): Promise<ArchivedList> {
    const response = await api.post('/archived-lists', { name, places, note });
    // Invalidate cache when a new list is created
    cacheUtils.lists.invalidate();
    return response.data;
  },

  async getLists(): Promise<ArchivedList[]> {
    // Check cache first
    const cached = cacheUtils.lists.get() as ArchivedList[] | null;
    if (cached) {
      return cached;
    }

    // If no cache, fetch from API
    const response = await api.get('/archived-lists');
    const lists = response.data;
    
    // Update cache
    cacheUtils.lists.set(lists);
    return lists;
  },

  async updateList(id: string, name: string, places: any[], note?: string): Promise<void> {
    await api.put(`/archived-lists/${id}`, { name, places, note });
    // Invalidate cache when a list is updated
    cacheUtils.lists.invalidate();
  },

  async deleteList(id: string): Promise<void> {
    await api.delete(`/archived-lists/${id}`);
    // Invalidate cache when a list is deleted
    cacheUtils.lists.invalidate();
  },

  // Force cache invalidation (useful when schedules are added/removed)
  invalidateCache(): void {
    console.log('Invalidating archived lists cache');
    cacheUtils.lists.invalidate();
  }
}; 