import axios from 'axios';

const PUBLIC = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'];

export const api = axios.create({ baseURL: '/api' });

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status = err.response?.status;
    const body = err.response?.data?.error;
    if (status === 401 && !PUBLIC.some((p) => window.location.pathname.startsWith(p))) {
      window.location.assign('/login');
    }
    return Promise.reject({
      status,
      message: body?.message || 'Network error — is the API running?',
      details: body?.details,
    });
  },
);
