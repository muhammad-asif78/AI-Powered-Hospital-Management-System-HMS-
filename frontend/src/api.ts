/**
 * API client — single source of truth for all backend HTTP calls.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const resp = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (resp.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (endpoint !== '/auth/login' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (resp.status === 204) return null;

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.detail || 'Request failed');
  return data;
}

export const api = {
  // Auth
  login: (body: any) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  register: (body: any) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  getMe: () => request('/auth/me'),

  // Dashboard
  getStats: () => request('/dashboard/stats'),

  // Patients
  getPatients: (params = '') => request(`/patients/${params ? '?' + params : ''}`),
  getPatient: (id: string) => request(`/patients/${id}`),
  createPatient: (body: any) => request('/patients/', { method: 'POST', body: JSON.stringify(body) }),
  updatePatient: (id: string, body: any) => request(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePatient: (id: string) => request(`/patients/${id}`, { method: 'DELETE' }),

  // Doctors
  getDoctors: (params = '') => request(`/doctors/${params ? '?' + params : ''}`),
  getDoctor: (id: string) => request(`/doctors/${id}`),
  createDoctor: (body: any) => request('/doctors/', { method: 'POST', body: JSON.stringify(body) }),
  updateDoctor: (id: string, body: any) => request(`/doctors/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteDoctor: (id: string) => request(`/doctors/${id}`, { method: 'DELETE' }),

  // Appointments
  getAppointments: (params = '') => request(`/appointments/${params ? '?' + params : ''}`),
  createAppointment: (body: any) => request('/appointments/', { method: 'POST', body: JSON.stringify(body) }),
  updateAppointment: (id: string, body: any) => request(`/appointments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  // Referrals
  getInboundReferrals: (params = '') => request(`/referrals/inbound${params ? '?' + params : ''}`),
  createInboundReferral: (body: any) => request('/referrals/inbound', { method: 'POST', body: JSON.stringify(body) }),
  updateInboundReferral: (id: string, body: any) => request(`/referrals/inbound/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  parseInboundReferral: (id: string) => request(`/referrals/inbound/${id}/parse`, { method: 'POST' }),
  getOutboundReferrals: (params = '') => request(`/referrals/outbound${params ? '?' + params : ''}`),
  createOutboundReferral: (body: any) => request('/referrals/outbound', { method: 'POST', body: JSON.stringify(body) }),
  verifyOutboundReferral: (id: string) => request(`/referrals/outbound/${id}/verify`, { method: 'POST' }),

  // Prior Auth
  getPriorAuths: (params = '') => request(`/prior-auth/${params ? '?' + params : ''}`),
  createPriorAuth: (body: any) => request('/prior-auth/', { method: 'POST', body: JSON.stringify(body) }),
  updatePriorAuth: (id: string, body: any) => request(`/prior-auth/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  classifyPriorAuth: (id: string) => request(`/prior-auth/${id}/classify`, { method: 'POST' }),
  submitPriorAuth: (id: string) => request(`/prior-auth/${id}/submit`, { method: 'POST' }),

  // Insurance
  getInsuranceProviders: () => request('/insurance/providers'),
  createInsuranceProvider: (body: any) => request('/insurance/providers', { method: 'POST', body: JSON.stringify(body) }),

  // LiveKit
  getLiveKitToken: (body: any) => request('/livekit/token', { method: 'POST', body: JSON.stringify(body) }),

  // Profile & Workstation Settings
  updateProfile: (body: any) => request('/users/profile', { method: 'PUT', body: JSON.stringify(body) }),
  uploadAvatar: (formData: FormData) => fetch(`${API_BASE}/users/avatar`, {
    method: 'POST',
    body: formData,
    headers: {
      ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
    }
  }).then(async resp => {
    if (resp.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || 'Request failed');
    return data;
  }),
  updateSecurity: (body: any) => request('/users/security', { method: 'PUT', body: JSON.stringify(body) }),
  getBilling: () => request('/users/billing'),
  getNotifications: () => request('/users/notifications'),
  
  // Realtime updates
  createWorkerEventSource: () => new EventSource(`${import.meta.env.VITE_API_BASE_URL || ''}/worker/events`),
  createAgentWebSocket: () => new WebSocket(`${import.meta.env.VITE_WS_BASE_URL || ''}/agent/ws`),
};
