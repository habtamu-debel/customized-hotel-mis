import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    if (error.response?.status === 401 && useAuthStore.getState().token && !url.includes('/auth/login')) {
      useAuthStore.getState().logout();
      if (window.location.pathname.startsWith('/staff')) window.location.assign('/staff/login');
    }
    return Promise.reject(error);
  }
);

export const publicApi = {
  property: () => api.get('/public/property'),
  roomTypes: () => api.get('/public/room-types'),
  room: (slug) => api.get(`/public/room-types/${slug}`),
  offers: () => api.get('/public/offers'),
  availability: (body) => api.post('/public/availability', body),
  quote: (body) => api.post('/public/quote', body),
  book: (body) => api.post('/public/bookings', body),
  booking: (ref, email) => api.get(`/public/bookings/${encodeURIComponent(ref)}`, { params: { email } }),
  cancel: (ref, body) => api.post(`/public/bookings/${encodeURIComponent(ref)}/cancel`, body),
  message: (body) => api.post('/public/messages', body),
};

export const authApi = {
  login: (body) => api.post('/auth/login', body),
  profile: () => api.get('/auth/profile'),
};

export const stayApi = {
  list: (params) => api.get('/reservations', { params }),
  get: (id) => api.get(`/reservations/${id}`),
  create: (body) => api.post('/reservations', body),
  confirm: (id) => api.post(`/reservations/${id}/confirm`),
  checkIn: (id, body) => api.post(`/reservations/${id}/check-in`, body || {}),
  checkOut: (id, body) => api.post(`/reservations/${id}/check-out`, body || {}),
  cancel: (id, body) => api.post(`/reservations/${id}/cancel`, body || {}),
  noShow: (id) => api.post(`/reservations/${id}/no-show`),
  dates: (id, body) => api.post(`/reservations/${id}/dates`, body),
  assign: (id, lineId, body) => api.post(`/reservations/${id}/rooms/${lineId}/assign`, body),
  pay: (id, body) => api.post(`/reservations/${id}/payments`, body),
  charge: (id, body) => api.post(`/reservations/${id}/charges`, body),
};

export const roomApi = {
  list: () => api.get('/rooms'),
  types: () => api.get('/rooms/types'),
  updateType: (id, body) => api.patch(`/rooms/types/${id}`, body),
  createRoom: (body) => api.post('/rooms', body),
  status: (id, body) => api.patch(`/rooms/${id}/status`, body),
  history: (id) => api.get(`/rooms/${id}/history`),
  rates: () => api.get('/rooms/rates/list'),
  createRate: (body) => api.post('/rooms/rates', body),
  removeRate: (id) => api.delete(`/rooms/rates/${id}`),
};

export const guestApi = {
  list: (q) => api.get('/guests', { params: { q } }),
  get: (id) => api.get(`/guests/${id}`),
  update: (id, body) => api.patch(`/guests/${id}`, body),
};

export const reportApi = {
  dashboard: () => api.get('/reports/dashboard'),
  overview: (params) => api.get('/reports/overview', { params }),
};

export const userApi = {
  list: () => api.get('/users'),
  create: (body) => api.post('/users', body),
  update: (id, body) => api.patch(`/users/${id}`, body),
};

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (body) => api.put('/settings', body),
  messages: () => api.get('/settings/messages'),
  read: (id) => api.post(`/settings/messages/${id}/read`),
};

export default api;
