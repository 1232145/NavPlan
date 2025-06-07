import { ArchivedList } from '../types';
import api from './api/axios';

// Cache TTL - 1 hour (in milliseconds)
const CACHE_TTL = 60 * 60 * 1000;

// In-memory cache
const listsCache: {
  data: ArchivedList[] | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0
};

export const archivedListService = {
  async createList(name: string, places: any[], note?: string): Promise<ArchivedList> {
    const response = await api.post('/archived-lists', { name, places, note });
    // Invalidate cache when a new list is created
    listsCache.data = null;
    return response.data;
  },

  async getLists(): Promise<ArchivedList[]> {
    // Check if we have valid cached data
    if (listsCache.data && (Date.now() - listsCache.timestamp < CACHE_TTL)) {
      console.log('Using cached archived lists');
      return listsCache.data;
    }

    // If no cache or expired, fetch from API
    const response = await api.get('/archived-lists');
    // Update cache
    listsCache.data = response.data;
    listsCache.timestamp = Date.now();
    console.log('Cached new archived lists data');
    return response.data;
  },

  async updateList(id: string, name: string, places: any[], note?: string): Promise<void> {
    await api.put(`/archived-lists/${id}`, { name, places, note });
    // Invalidate cache when a list is updated
    listsCache.data = null;
  },

  async deleteList(id: string): Promise<void> {
    await api.delete(`/archived-lists/${id}`);
    // Invalidate cache when a list is deleted
    listsCache.data = null;
  }
}; 