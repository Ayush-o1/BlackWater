import { apiClient } from './axios';

// Note: Status APIs are generally unauthenticated, but using apiClient is fine
// as the backend doesn't enforce requireAuth on the /status endpoints.

export const StatusAPI = {
  getOverview: async (orgId: string) => {
    const response = await apiClient.get('/status', { params: { orgId } });
    return response.data.data;
  },
  getServices: async (orgId: string) => {
    const response = await apiClient.get('/status/services', { params: { orgId } });
    return response.data.data;
  },
  getIncidents: async (orgId: string, params?: any) => {
    const response = await apiClient.get('/status/incidents', { params: { orgId, ...params } });
    return response.data.data;
  },
  getIncidentDetails: async (orgId: string, id: string) => {
    const response = await apiClient.get(`/status/incidents/${id}`, { params: { orgId } });
    return response.data.data;
  },
};
