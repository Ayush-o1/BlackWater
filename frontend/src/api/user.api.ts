import { apiClient } from './axios';

export const UserAPI = {
  list: async () => {
    const response = await apiClient.get('/users');
    return response.data.data;
  },
  getMe: async () => {
    const response = await apiClient.get('/users/me');
    return response.data.data;
  },
  updateProfile: async (data: { name: string }) => {
    const response = await apiClient.patch('/users/me', data);
    return response.data.data;
  },
};
