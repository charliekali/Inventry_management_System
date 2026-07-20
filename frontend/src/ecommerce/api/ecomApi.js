import axios from 'axios';
import { getApiBase } from '../../api/index.js';

const ecomApi = axios.create({
  timeout: 30000,
});

ecomApi.interceptors.request.use((config) => {
  config.baseURL = getApiBase();
  const token = localStorage.getItem('ecomCustomerToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const storefrontAPI = {
  // Public APIs
  listProducts: (params) => ecomApi.get('/ecom/public/products', { params }),
  getProduct: (id) => ecomApi.get(`/ecom/public/products/${id}`),
  listCategories: () => ecomApi.get('/ecom/public/categories'),
  getReviews: (id) => ecomApi.get(`/ecom/public/products/${id}/reviews`),
  trackOrder: (orderNumber) => ecomApi.get(`/ecom/public/orders/track/${orderNumber}`),

  // Auth APIs
  login: (email, password) => ecomApi.post('/ecom/auth/login', { email, password }),
  register: (name, email, password, phone) => ecomApi.post('/ecom/auth/register', { name, email, password, phone }),
  getProfile: () => ecomApi.get('/ecom/auth/me'),
  updateProfile: (data) => ecomApi.put('/ecom/auth/profile', data),

  // Cart APIs
  getCart: () => ecomApi.get('/ecom/cart'),
  updateCart: (items) => ecomApi.post('/ecom/cart/add', { items }),
  applyCoupon: (code) => ecomApi.post('/ecom/cart/apply-coupon', { code }),

  // Order APIs
  placeOrder: (data) => ecomApi.post('/ecom/orders', data),
  getOrders: () => ecomApi.get('/ecom/orders'),
  getOrder: (id) => ecomApi.get(`/ecom/orders/${id}`),

  // Reviews & Wishlist APIs
  submitReview: (data) => ecomApi.post('/ecom/reviews', data),
  getWishlist: () => ecomApi.get('/ecom/wishlist'),
  addToWishlist: (productId) => ecomApi.post(`/ecom/wishlist/${productId}`),
  removeFromWishlist: (productId) => ecomApi.delete(`/ecom/wishlist/${productId}`),
};

export default ecomApi;
