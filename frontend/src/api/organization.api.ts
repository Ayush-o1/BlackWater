import { apiClient } from './axios';

export const OrganizationAPI = {
  getMe: async () => {
    const response = await apiClient.get('/organizations/me');
    return response.data.data;
  },
  update: async (data: { name: string }) => {
    const response = await apiClient.patch('/organizations/me', data);
    return response.data.data;
  },
};
