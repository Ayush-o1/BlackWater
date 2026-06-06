import { apiClient } from './axios';

export const IncidentAPI = {
  create: async (data: any) => {
    const response = await apiClient.post('/incidents', data);
    return response.data.data;
  },
  list: async (params?: any) => {
    const response = await apiClient.get('/incidents', { params });
    return response.data.data;
  },
  getDetails: async (id: string) => {
    const response = await apiClient.get(`/incidents/${id}`);
    return response.data.data;
  },
  assign: async (id: string, assigneeId: string) => {
    const response = await apiClient.patch(`/incidents/${id}/assign`, { assigneeId });
    return response.data.data;
  },
  updateStatus: async (id: string, status: string) => {
    const response = await apiClient.patch(`/incidents/${id}/status`, { status });
    return response.data.data;
  },
  addUpdate: async (id: string, data: { message: string; isPublic: boolean }) => {
    const response = await apiClient.post(`/incidents/${id}/updates`, data);
    return response.data.data;
  },
};
