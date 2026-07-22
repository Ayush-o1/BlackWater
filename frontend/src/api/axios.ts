import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { queryClient } from './queryClient';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject JWT into requests
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercept 401s globally to force logout — but only for requests that were
// actually authenticated. A 401 on an unauthenticated request (e.g. a failed
// login attempt) is a normal error the caller should handle, not a sign that
// an existing session expired.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const hadAuthHeader = Boolean(error.config?.headers?.Authorization);
    if (error.response?.status === 401 && hadAuthHeader) {
      // Force logout and clear state
      useAuthStore.getState().logout();
      queryClient.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
