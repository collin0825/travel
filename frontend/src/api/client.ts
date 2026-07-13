import axios, { AxiosError } from 'axios';
import { clearToken, getToken } from './token';

const API_BASE =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:8000`;

/** Dispatched when the API returns 401 so the auth store can reset. */
export const AUTH_REQUIRED_EVENT = 'auth_required';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the bearer token to every outgoing request.
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalize errors and handle expired sessions globally.
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string }>) => {
    if (error.response?.status === 401) {
      clearToken();
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    }
    const detail = error.response?.data?.detail;
    return Promise.reject(new Error(detail || error.message || 'API request failed'));
  },
);
