import axios from 'axios';
import { useGlobalLoading } from '../composables/use-global-loading';
import { clearStandaloneSession, integrationStorage } from '../integration';

const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || '/api/v1',
  timeout: 120000,
});

let activeRequests = 0;
const { showLoading, hideLoading } = useGlobalLoading();

api.interceptors.request.use((config) => {
  const token = integrationStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers.Accept = 'application/json';

  const shouldShowOverlay = (config as any).showLoading === true;
  if (shouldShowOverlay) {
    activeRequests++;
    if (activeRequests === 1) {
      showLoading('Đang tải dữ liệu...', 'Vui lòng chờ trong giây lát', 280);
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const shouldShowOverlay = (response.config as any)?.showLoading === true;
    if (shouldShowOverlay) {
      activeRequests = Math.max(0, activeRequests - 1);
      if (activeRequests === 0) hideLoading();
    }
    return response;
  },
  async (error) => {
    const shouldShowOverlay = (error.config as any)?.showLoading === true;
    if (shouldShowOverlay) {
      activeRequests = Math.max(0, activeRequests - 1);
      if (activeRequests === 0) hideLoading();
    }
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      if (!url.includes('/auth/login') && !url.includes('/setup')) {
        clearStandaloneSession();
        if (window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
      }
    }
    if (error.response?.data?.message && !error.response.data.error) {
      error.response.data.error = error.response.data.message;
    }
    return Promise.reject(error);
  },
);

export { api };
