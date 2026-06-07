import axios from 'axios';

const getApiBase = () => {
  const customUrl = localStorage.getItem('customApiUrl');
  if (customUrl) return customUrl;
  
  const isCapacitor = window.Capacitor || window.location.protocol === 'capacitor:';
  if (isCapacitor) {
    return 'http://10.0.2.2:5000/api';
  }
  
  return import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
};

const api = axios.create({
  baseURL: getApiBase(),
  timeout: 30000,
});

// Request interceptor — attach token
api.interceptors.request.use((config) => {
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
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export const ordersAPI = {
  list: () => api.get('/orders'),
  get: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
  checkFeasibility: (items) => api.post('/orders/feasibility', { items }),
  productionYield: (data) => api.post('/orders/production-yield', data),
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

export default api;
