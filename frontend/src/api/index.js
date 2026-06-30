import axios from 'axios';
import { Capacitor } from '@capacitor/core';

export const getApiBase = () => {
  const customUrl = localStorage.getItem('customApiUrl');
  if (customUrl) return customUrl;

  if (Capacitor.isNativePlatform()) {
    return 'https://ttrims-backend-4xho.onrender.com/api';
  }

  return import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
};

const api = axios.create({
  timeout: 30000,
});

// Request interceptor — attach dynamic baseURL and token
api.interceptors.request.use((config) => {
  config.baseURL = getApiBase();
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${getApiBase()}/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        localStorage.clear();
        if (Capacitor.isNativePlatform()) {
          window.location.hash = '/login';
        } else {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/users/me'),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersAPI = {
  list: (params) => api.get('/users', { params }),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  delete: (id, params) => api.delete(`/users/${id}`, { params }),
};

// ─── Roles ────────────────────────────────────────────────────────────────────
export const rolesAPI = {
  list: () => api.get('/roles'),
  permissions: () => api.get('/roles/permissions'),
  create: (data) => api.post('/roles', data),
  update: (id, data) => api.patch(`/roles/${id}`, data),
  delete: (id) => api.delete(`/roles/${id}`),
};

// ─── Warehouses ───────────────────────────────────────────────────────────────
export const warehousesAPI = {
  list: (params) => api.get('/warehouses', { params }),
  create: (data) => api.post('/warehouses', data),
  update: (id, data) => api.patch(`/warehouses/${id}`, data),
  delete: (id, params) => api.delete(`/warehouses/${id}`, { params }),
  sections: (warehouseId, params) => api.get(`/warehouses/${warehouseId}/sections`, { params }),
  createSection: (warehouseId, data) => api.post(`/warehouses/${warehouseId}/sections`, data),
  updateSection: (warehouseId, id, data) => api.patch(`/warehouses/${warehouseId}/sections/${id}`, data),
  deleteSection: (warehouseId, id, params) => api.delete(`/warehouses/${warehouseId}/sections/${id}`, { params }),
};

// ─── Products ─────────────────────────────────────────────────────────────────
export const productsAPI = {
  list: (params) => api.get('/products', { params }),
  get: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.patch(`/products/${id}`, data),
  delete: (id, params) => api.delete(`/products/${id}`, { params }),
  getBom: (id) => api.get(`/products/${id}/bom`),
  addBom: (id, data) => api.post(`/products/${id}/bom`, data),
  updateBom: (id, bomId, data) => api.patch(`/products/${id}/bom/${bomId}`, data),
  deleteBom: (id, bomId) => api.delete(`/products/${id}/bom/${bomId}`),
};

// ─── Transactions ─────────────────────────────────────────────────────────────
export const transactionsAPI = {
  list: (params) => api.get('/transactions', { params }),
  get: (id) => api.get(`/transactions/${id}`),
  stockIn: (data) => api.post('/transactions/in', data),
  stockOut: (data) => api.post('/transactions/out', data),
  productionRun: (data) => api.post('/transactions/production-run', data),
  productionRuns: () => api.get('/transactions/production-runs'),
};

// ─── Stock ────────────────────────────────────────────────────────────────────
export const stockAPI = {
  balance: (params) => api.get('/stock/balance', { params }),
  summary: (params) => api.get('/stock/summary', { params }),
  locate: (productId) => api.get(`/stock/locate/${productId}`),
  dashboard: () => api.get('/stock/dashboard'),
  productionDashboard: () => api.get('/stock/production-dashboard'),
  warehouseDashboard: () => api.get('/stock/warehouse-dashboard'),
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export const ordersAPI = {
  list: () => api.get('/orders'),
  get: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
  checkFeasibility: (items) => api.post('/orders/feasibility', { items }),
  productionYield: (data) => api.post('/orders/production-yield', data),
  salesDashboard: () => api.get('/orders/sales-dashboard'),
  posCreate: (data) => api.post('/orders/pos', data),
  getInvoice: (id) => api.get(`/orders/${id}/invoice`),
  listInvoices: () => api.get('/orders/invoices'),
  collectPayment: (id, amount, paymentMode, notes) => api.patch(`/orders/${id}/payment`, { amount, payment_mode: paymentMode, notes }),
  getPaymentHistory: (id) => api.get(`/orders/${id}/payment-history`),
  listOutstanding: () => api.get('/orders/outstanding'),
  getFollowUps: (id) => api.get(`/orders/${id}/followups`),
  addFollowUp: (id, data) => api.post(`/orders/${id}/followups`, data),
  updateCustomFields: (id, fields) => api.patch(`/orders/${id}/custom-fields`, fields),
  listMyAssigned: () => api.get('/orders/my-assigned'),
  assignOrder: (id, userId) => api.patch(`/orders/${id}/assign`, { user_id: userId }),
};

// ─── Production Orders ────────────────────────────────────────────────────────
export const productionOrdersAPI = {
  list: () => api.get('/production-orders'),
  create: (data) => api.post('/production-orders', data),
  updateStatus: (id, status) => api.patch(`/production-orders/${id}/status`, { status }),
  exportCsv: () => api.get('/production-orders/export', { responseType: 'blob' }),
  importCsv: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/production-orders/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ─── Form Settings ────────────────────────────────────────────────────────────
export const formSettingsAPI = {
  get: (form) => api.get('/form-settings', { params: { form } }),
  save: (form, fields) => api.put('/form-settings', { form, fields }),
};

// ─── Product Categories ────────────────────────────────────────────────────────
export const productCategoriesAPI = {
  list: () => api.get('/product-categories'),           // grouped (for dropdowns)
  flat: (params) => api.get('/product-categories/flat', { params }),       // flat list (for admin)
  create: (data) => api.post('/product-categories', data),
  update: (id, data) => api.patch(`/product-categories/${id}`, data),
  delete: (id, params) => api.delete(`/product-categories/${id}`, { params }),
};

// ─── Postgres Instances ───────────────────────────────────────────────────────
export const postgresAPI = {
  list: () => api.get('/postgres-instances'),
  create: (data) => api.post('/postgres-instances', data),
  delete: (id) => api.delete(`/postgres-instances/${id}`),
  getMetrics: (id) => api.get(`/postgres-instances/${id}/metrics`),
  getLogs: (id) => api.get(`/postgres-instances/${id}/logs`),
};

// ─── Invoice Settings ─────────────────────────────────────────────────────────
export const invoiceSettingsAPI = {
  get: () => api.get('/invoice-settings'),
  save: (data) => api.put('/invoice-settings', data),
};

// ─── Attendance / GPS Tracking ────────────────────────────────────────────────
export const attendanceAPI = {
  /** Sales: clock in and start a session (optionally include initial GPS). */
  start: (gps = null) => api.post('/attendance/start', gps || {}),
  /** Sales: send a GPS breadcrumb for an active session. */
  ping: (id, latitude, longitude, accuracy, speed = null, distanceFromLast = null, cumulativeDistance = null) =>
    api.post(`/attendance/${id}/ping`, {
      latitude,
      longitude,
      accuracy,
      speed,
      distance_from_last: distanceFromLast,
      cumulative_distance: cumulativeDistance
    }),
  /** Sales: clock out and end the session. */
  stop: (id) => api.post(`/attendance/${id}/stop`),
  /** Sales: get own attendance sessions (daily log). */
  my: () => api.get('/attendance/my'),
  /** Admin: get all currently ACTIVE sessions with latest GPS coordinates. */
  active: () => api.get('/attendance/active'),
  /** Admin: get full GPS breadcrumb trail for a session. */
  trail: (id) => api.get(`/attendance/${id}/trail`),
  /** Admin: get all historical sessions. */
  history: () => api.get('/attendance/history'),
};

// ─── Key Registry ─────────────────────────────────────────────────────────────
export const keyRegistryAPI = {
  /** List all factory keys (master catalogue) */
  keys: ()                   => api.get('/key-registry/keys'),
  /** Add a new physical key */
  addKey: (data)             => api.post('/key-registry/keys', data),
  /** Update key name / description / number */
  updateKey: (id, data)      => api.patch(`/key-registry/keys/${id}`, data),
  /** Delete a key (only if AVAILABLE) */
  deleteKey: (id)            => api.delete(`/key-registry/keys/${id}`),
  /** Full checkout/return history */
  logs: ()                   => api.get('/key-registry/logs'),
  /** Currently checked-out keys only */
  activeLogs: ()             => api.get('/key-registry/logs/active'),
  /** List logged-in user's checkout requests and history */
  myLogs: ()                 => api.get('/key-registry/logs/my'),
  /** List all pending checkout/return requests (Super Admin) */
  pendingRequests: ()        => api.get('/key-registry/requests/pending'),
  /** Log a key checkout or submit checkout request */
  checkout: (data)           => api.post('/key-registry/logs', data),
  /** Mark a key as returned or submit return request */
  returnKey: (id, notes)     => api.patch(`/key-registry/logs/${id}/return`, { return_notes: notes }),
  /** Approve a pending request (Super Admin) */
  approveRequest: (id)       => api.post(`/key-registry/requests/${id}/approve`, {}),
  /** Reject a pending request (Super Admin) */
  rejectRequest: (id)        => api.post(`/key-registry/requests/${id}/reject`, {}),
};
// ─── Data Portability ─────────────────────────────────────────────────────────
export const dataPortabilityAPI = {
  listTables: () => api.get('/data-portability/tables'),
  exportTable: (tableName) => api.get(`/data-portability/export/${tableName}`, { responseType: 'blob' }),
  getTemplate: (tableName) => api.get(`/data-portability/template/${tableName}`, { responseType: 'blob' }),
  importTable: (tableName, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/data-portability/import/${tableName}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  }
};

// ─── Production Plans ─────────────────────────────────────────────────────────
export const productionPlansAPI = {
  create: (data) => api.post('/production-plans', data),
  list: () => api.get('/production-plans'),
  myToday: () => api.get('/production-plans/my-today'),
  recordActual: (id, actualQuantity) => api.post(`/production-plans/${id}/actual`, { actual_quantity: actualQuantity }),
};

export default api;
