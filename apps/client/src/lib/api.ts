import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cfecc_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept responses: retry transient cold-boot errors & handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Retry transient cold-boot 503 or network dropped errors up to 3 times
    if (
      (!error.response || error.response.status === 503) &&
      originalRequest &&
      (!originalRequest._retryCount || originalRequest._retryCount < 3)
    ) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      await new Promise((resolve) => setTimeout(resolve, 800));
      return api(originalRequest);
    }

    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('cfecc_token');
      localStorage.removeItem('cfecc_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

