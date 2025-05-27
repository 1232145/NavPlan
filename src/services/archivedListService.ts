import { ArchivedList } from '../types';
import api from './api/axios';

export const archivedListService = {
  async createList(name: string, places: any[], note?: string): Promise<ArchivedList> {
    const response = await api.post('/archived-lists', { name, places, note });
    return response.data;
  },

  async getLists(): Promise<ArchivedList[]> {
    const response = await api.get('/archived-lists');
    return response.data;
  },

  async updateList(id: string, name: string, places: any[], note?: string): Promise<void> {
    await api.put(`/archived-lists/${id}`, { name, places, note });
  },

  async deleteList(id: string): Promise<void> {
    await api.delete(`/archived-lists/${id}`);
  }
}; 