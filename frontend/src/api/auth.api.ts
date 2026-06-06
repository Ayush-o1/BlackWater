import { apiClient } from './axios';

export const AuthAPI = {
  register: async (data: any) => {
    const response = await apiClient.post('/auth/register', data);
    return response.data.data;
  },
  login: async (data: any) => {
    const response = await apiClient.post('/auth/login', data);
    return response.data.data;
  },
  getMe: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data.data;
  },
};
