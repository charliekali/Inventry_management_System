import axios from 'axios';
import { Capacitor } from '@capacitor/core';

export const getApiBase = () => {
  const customUrl = localStorage.getItem('customApiUrl');
  if (customUrl) return customUrl;

  if (Capacitor.isNativePlatform()) {
    return 'http://10.0.2.2:5000/api';
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
        window.location.href = '/login';
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
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
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
  list: () => api.get('/warehouses'),
  create: (data) => api.post('/warehouses', data),
  update: (id, data) => api.patch(`/warehouses/${id}`, data),
  delete: (id) => api.delete(`/warehouses/${id}`),
  sections: (warehouseId) => api.get(`/warehouses/${warehouseId}/sections`),
  createSection: (warehouseId, data) => api.post(`/warehouses/${warehouseId}/sections`, data),
  updateSection: (warehouseId, id, data) => api.patch(`/warehouses/${warehouseId}/sections/${id}`, data),
  deleteSection: (warehouseId, id) => api.delete(`/warehouses/${warehouseId}/sections/${id}`),
};

// ─── Products ─────────────────────────────────────────────────────────────────
export const productsAPI = {
  list: (params) => api.get('/products', { params }),
  get: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.patch(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
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
  flat: () => api.get('/product-categories/flat'),       // flat list (for admin)
  create: (data) => api.post('/product-categories', data),
  update: (id, data) => api.patch(`/product-categories/${id}`, data),
  delete: (id) => api.delete(`/product-categories/${id}`),
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

export default api;
