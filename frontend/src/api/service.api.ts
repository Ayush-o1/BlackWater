import { apiClient } from './axios';

export const ServiceAPI = {
  create: async (data: any) => {
    const response = await apiClient.post('/services', data);
    return response.data.data;
  },
  list: async () => {
    const response = await apiClient.get('/services');
    return response.data.data;
  },
  getDetails: async (id: string) => {
    const response = await apiClient.get(`/services/${id}`);
    return response.data.data;
  },
  update: async (id: string, data: any) => {
    const response = await apiClient.patch(`/services/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await apiClient.delete(`/services/${id}`);
    return response.data.data;
  },
};
