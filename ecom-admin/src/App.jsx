import { useState, useEffect } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { 
  ShoppingBag, DollarSign, Package, Tag, Trash2, Plus, 
  Star, ClipboardList, CheckCircle, LogOut, ArrowRight, 
  Settings, Image, Layers, Globe, Edit2
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

const compressImage = (file, callback) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (event) => {
    const img = new Image();
    img.src = event.target.result;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 500;
      const MAX_HEIGHT = 500;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      callback(dataUrl);
    };
  };
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('ecomAdminToken') || '');
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // App Navigation & Data states
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);

  // Store CMS & branding configs
  const [storeConfigs, setStoreConfigs] = useState({
    primary_color: '#113425',
    accent_color: '#d96226',
    logo_text: 'TTRIMS Marketplace',
    homepage_layout: 'banners,categories,deals,trending,testimonials,newsletter',
    shipping_charge: '40',
    free_shipping_min: '500',
    gst_percent: '18',
    banners: '[]'
  });

  // Edit Product Modal states
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [modalTab, setModalTab] = useState('details');

  // E-Commerce Product Fields
  const [pName, setPName] = useState('');
  const [pSellingPrice, setPSellingPrice] = useState('');
  const [pDiscountPrice, setPDiscountPrice] = useState('');
  const [pWholesalePrice, setPWholesalePrice] = useState('');
  const [pGstPercent, setPGstPercent] = useState('18');
  const [pTaxInclusive, setPTaxInclusive] = useState(true);
  
  // Placement/Visibility
  const [pShowOnStorefront, setPShowOnStorefront] = useState(false);
  const [pPublished, setPPublished] = useState(true);
  const [pIsFeatured, setPIsFeatured] = useState(false);
  const [pBestSeller, setPBestSeller] = useState(false);
  const [pNewArrival, setPNewArrival] = useState(false);
  const [pTrending, setPTrending] = useState(false);
  const [pTodaysDeal, setPTodaysDeal] = useState(false);
  const [pSaleProduct, setPSaleProduct] = useState(false);

  // Media
  const [pImageUrl, setPImageUrl] = useState('');
  const [pGalleryImages, setPGalleryImages] = useState([]);

  // Specifications
  const [pShortDescription, setPShortDescription] = useState('');
  const [pBrand, setPBrand] = useState('');
  const [pTags, setPTags] = useState('');
  const [pWeight, setPWeight] = useState('');
  const [pDimensions, setPDimensions] = useState('');
  const [pBarcode, setPBarcode] = useState('');
  const [pCountryOfOrigin, setPCountryOfOrigin] = useState('');
  const [pShelfLife, setPShelfLife] = useState('');
  const [pIngredients, setPIngredients] = useState('');
  const [pSpecifications, setPSpecifications] = useState('');
  const [pMinOrderQty, setPMinOrderQty] = useState('1');
  const [pMaxOrderQty, setPMaxOrderQty] = useState('100');

  // Coupon states
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discountType: 'FLAT',
    discountValue: 0,
    minOrderAmount: 0,
    maxDiscountAmount: 9999,
    active: true
  });

  const getHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  // Load Admin profile on boot
  useEffect(() => {
    if (token) {
      axios.get(`${API_BASE}/auth/me`, getHeaders())
        .then(res => {
          setUser(res.data.data);
          loadDashboardData();
        })
        .catch(() => {
          handleLogout();
        });
    }
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { email, password });
      const t = res.data.data.accessToken;
      localStorage.setItem('ecomAdminToken', t);
      setToken(t);
      toast.success('Successfully Authenticated');
    } catch {
      toast.error('Invalid Credentials or access denied.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ecomAdminToken');
    setToken('');
    setUser(null);
    toast.success('Logged out successfully.');
  };

  const loadDashboardData = () => {
    setLoading(true);
    const t = Date.now();
    Promise.all([
      axios.get(`${API_BASE}/ecom/admin/analytics?_t=${t}`, getHeaders()),
      axios.get(`${API_BASE}/ecom/admin/orders?_t=${t}`, getHeaders()),
      axios.get(`${API_BASE}/ecom/admin/coupons?_t=${t}`, getHeaders()),
      axios.get(`${API_BASE}/ecom/admin/reviews?_t=${t}`, getHeaders()),
      axios.get(`${API_BASE}/products?_t=${t}`, getHeaders()),
      axios.get(`${API_BASE}/store-settings?_t=${t}`, getHeaders())
    ]).then(([statsRes, ordersRes, couponsRes, reviewsRes, productsRes, storeSettingsRes]) => {
      setStats(statsRes.data.data);
      setOrders(ordersRes.data.data);
      setCoupons(couponsRes.data.data);
      setReviews(reviewsRes.data.data);
      setProducts(productsRes.data.data.filter(p => p.type === 'FINISHED_GOOD'));
      if (storeSettingsRes.data.success) {
        setStoreConfigs(storeSettingsRes.data.data);
      }
    }).catch(() => {
      toast.error('Failed to load store data');
    }).finally(() => setLoading(false));
  };

  const handleSaveConfigs = async (updatedConfigs) => {
    try {
      const res = await axios.post(`${API_BASE}/store-settings`, updatedConfigs, getHeaders());
      if (res.data.success) {
        toast.success('Configurations saved successfully!');
        loadDashboardData();
      }
    } catch {
      toast.error('Failed to save store configurations');
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const res = await axios.patch(`${API_BASE}/ecom/admin/orders/${orderId}/status`, { status: newStatus }, getHeaders());
      if (res.data.success) {
        toast.success('Order status updated!');
        loadDashboardData();
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteCoupon = async (id) => {
    if (!window.confirm('Delete coupon?')) return;
    try {
      await axios.delete(`${API_BASE}/ecom/admin/coupons/${id}`, getHeaders());
      toast.success('Coupon removed');
      loadDashboardData();
    } catch {
      toast.error('Failed to delete coupon');
    }
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/ecom/admin/coupons`, newCoupon, getHeaders());
      toast.success('Coupon created successfully!');
      setShowCouponModal(false);
      loadDashboardData();
    } catch {
      toast.error('Failed to save coupon');
    }
  };

  const handleDeleteReview = async (id) => {
    if (!window.confirm('Delete review?')) return;
    try {
      await axios.delete(`${API_BASE}/ecom/admin/reviews/${id}`, getHeaders());
      toast.success('Review deleted');
      loadDashboardData();
    } catch {
      toast.error('Failed to delete review');
    }
  };

  // Open Edit Product Modal
  const openEditProduct = (p) => {
    setEditingProduct(p);
    setModalTab('details');
    setPName(p.name || '');
    setPSellingPrice(p.selling_price ? p.selling_price.toString() : '');
    setPDiscountPrice(p.discount_price ? p.discount_price.toString() : '');
    setPWholesalePrice(p.wholesale_price ? p.wholesale_price.toString() : '');
    setPGstPercent(p.gst_percent ? p.gst_percent.toString() : '18');
    setPTaxInclusive(p.tax_inclusive !== false);
    setPShowOnStorefront(!!p.show_on_storefront);
    setPPublished(p.published !== false);
    setPIsFeatured(!!p.is_featured);
    setPBestSeller(!!p.best_seller);
    setPNewArrival(!!p.new_arrival);
    setPTrending(!!p.trending);
    setPTodaysDeal(!!p.todays_deal);
    setPSaleProduct(!!p.sale_product);

    setPImageUrl(p.image_url || '');
    setPGalleryImages(p.gallery_images ? p.gallery_images.split(',').filter(x => x) : []);
    setPShortDescription(p.short_description || '');
    setPBrand(p.brand || '');
    setPTags(p.tags || '');
    setPWeight(p.weight ? p.weight.toString() : '');
    setPDimensions(p.dimensions || '');
    setPBarcode(p.barcode || '');
    setPCountryOfOrigin(p.country_of_origin || '');
    setPShelfLife(p.shelf_life || '');
    setPIngredients(p.ingredients || '');
    setPSpecifications(p.specifications || '');
    setPMinOrderQty(p.min_order_qty ? p.min_order_qty.toString() : '1');
    setPMaxOrderQty(p.max_order_qty ? p.max_order_qty.toString() : '100');

    setShowProductModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const payload = {
      name: pName,
      image_url: pImageUrl,
      brand: pBrand,
      tags: pTags,
      weight: pWeight ? parseFloat(pWeight) : null,
      dimensions: pDimensions,
      barcode: pBarcode,
      discount_price: pDiscountPrice ? parseFloat(pDiscountPrice) : null,
      wholesale_price: pWholesalePrice ? parseFloat(pWholesalePrice) : null,
      gst_percent: pGstPercent ? parseFloat(pGstPercent) : 18,
      min_order_qty: pMinOrderQty ? parseInt(pMinOrderQty, 10) : 1,
      max_order_qty: pMaxOrderQty ? parseInt(pMaxOrderQty, 10) : 100,
      specifications: pSpecifications,
      gallery_images: pGalleryImages.join(','),
      short_description: pShortDescription,
      country_of_origin: pCountryOfOrigin,
      shelf_life: pShelfLife,
      ingredients: pIngredients,
      tax_inclusive: pTaxInclusive,
      show_on_storefront: pShowOnStorefront,
      best_seller: pBestSeller,
      new_arrival: pNewArrival,
      trending: pTrending,
      todays_deal: pTodaysDeal,
      sale_product: pSaleProduct,
      published: pPublished,
      is_featured: pIsFeatured
    };

    payload.selling_price = pSellingPrice ? parseFloat(pSellingPrice) : null;

    try {
      await axios.patch(`${API_BASE}/products/${editingProduct.id}`, payload, getHeaders());
      toast.success('Product configurations updated!');
      setShowProductModal(false);
      loadDashboardData();
    } catch {
      toast.error('Failed to save configurations');
    }
  };

  const handleToggleVisibility = async (p) => {
    try {
      const nextVisible = !p.show_on_storefront;
      await axios.patch(`${API_BASE}/products/${p.id}`, { show_on_storefront: nextVisible }, getHeaders());
      toast.success(nextVisible ? 'Product made visible on store' : 'Product hidden from store');
      loadDashboardData();
    } catch {
      toast.error('Failed to update storefront visibility');
    }
  };

  const handleImageUpload = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file, (base64) => {
      if (type === 'primary') setPImageUrl(base64);
      else setPGalleryImages(prev => [...prev, base64]);
    });
  };

  // Login view guard
  if (!token) {
    return (
      <div className="login-wrapper">
        <Toaster position="top-right" />
        <form className="login-card" onSubmit={handleLogin}>
          <div className="login-header">
            <h2>E-Commerce Dashboard</h2>
            <p>Sign in using your administrator account</p>
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-control" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@ttrims.com"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-control" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
            Authenticate <ArrowRight size={16} />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Toaster position="top-right" />
      
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          📦 Store Admin
        </div>
        <nav className="sidebar-nav">
          <div className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <Layers size={18} /> Overview
          </div>
          <div className={`nav-link ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
            <Package size={18} /> E-Commerce Catalog
          </div>
          <div className={`nav-link ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
            <ShoppingBag size={18} /> Order Lifecycle ({orders.length})
          </div>
          <div className={`nav-link ${activeTab === 'coupons' ? 'active' : ''}`} onClick={() => setActiveTab('coupons')}>
            <Tag size={18} /> Store Coupons
          </div>
          <div className={`nav-link ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>
            <Star size={18} /> Moderation
          </div>
          <div className={`nav-link ${activeTab === 'cms_layout' ? 'active' : ''}`} onClick={() => setActiveTab('cms_layout')}>
            <Globe size={18} /> Homepage CMS
          </div>
          <div className={`nav-link ${activeTab === 'banners' ? 'active' : ''}`} onClick={() => setActiveTab('banners')}>
            <Image size={18} /> Banner Manager
          </div>
          <div className={`nav-link ${activeTab === 'branding' ? 'active' : ''}`} onClick={() => setActiveTab('branding')}>
            <Settings size={18} /> Branding & Appearance
          </div>
          <div className="nav-link" onClick={handleLogout} style={{ marginTop: 'auto', color: 'var(--color-danger)' }}>
            <LogOut size={18} /> Sign Out
          </div>
        </nav>
      </aside>

      <main className="main-content">
        {loading && !stats ? (
          <div className="loading-center">Loading...</div>
        ) : (
          <div>
            {activeTab === 'dashboard' && stats && (
              <div>
                <div className="page-header">
                  <div>
                    <h2>Store Overview</h2>
                    <p>Track store sales and user interactions in real time.</p>
                  </div>
                </div>
                
                <div className="kpi-grid">
                  <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                      <DollarSign size={22} />
                    </div>
                    <div className="kpi-info">
                      <span className="kpi-label">Store Revenue</span>
                      <span className="kpi-value">₹{stats.totalSales.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                      <ShoppingBag size={22} />
                    </div>
                    <div className="kpi-info">
                      <span className="kpi-label">Total Orders</span>
                      <span className="kpi-value">{stats.ordersCount}</span>
                    </div>
                  </div>

                  <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
                      <ClipboardList size={22} />
                    </div>
                    <div className="kpi-info">
                      <span className="kpi-label">Pending Orders</span>
                      <span className="kpi-value">{stats.pendingCount}</span>
                    </div>
                  </div>

                  <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: 'var(--color-purple-bg)', color: 'var(--color-purple)' }}>
                      <CheckCircle size={22} />
                    </div>
                    <div className="kpi-info">
                      <span className="kpi-label">Avg Ticket Size</span>
                      <span className="kpi-value">₹{Math.round(stats.averageOrderValue).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'products' && (
              <div>
                <div className="page-header">
                  <div>
                    <h2>Storefront Catalog</h2>
                    <p>Manage product titles, images, visibility status, pricing, and descriptions.</p>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Image</th>
                        <th>Name / Code</th>
                        <th>Pricing</th>
                        <th>Promotional Price</th>
                        <th>Visibility</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(p => (
                        <tr key={p.id}>
                          <td>
                            <img 
                              src={p.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=100'} 
                              alt={p.name} 
                              style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--color-border)' }}
                            />
                          </td>
                          <td>
                            <div><strong>{p.name}</strong></div>
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{p.code}</span>
                          </td>
                          <td><strong>₹{p.selling_price || '0.00'}</strong></td>
                          <td>{p.discount_price ? `₹${p.discount_price}` : '—'}</td>
                          <td>
                            <button 
                              onClick={() => handleToggleVisibility(p)} 
                              className={`status-badge ${p.show_on_storefront ? 'present' : 'absent'}`}
                              style={{ 
                                cursor: 'pointer', 
                                border: 'none', 
                                outline: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                transition: 'all 0.2s ease'
                              }}
                              title="Click to toggle storefront visibility"
                            >
                              {p.show_on_storefront ? 'Visible' : 'Hidden'}
                            </button>
                          </td>
                          <td>
                            <button onClick={() => openEditProduct(p)} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Edit2 size={12} /> Configure E-Commerce
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div>
                <div className="page-header">
                  <div>
                    <h2>Order Lifecycle Management</h2>
                    <p>Fulfill client orders and monitor state updates.</p>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Order Number</th>
                        <th>Delivery Address</th>
                        <th>Payment Mode</th>
                        <th>Grand Total</th>
                        <th>Fulfillment Status</th>
                        <th>Update Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o.id}>
                          <td><strong>{o.orderNumber}</strong></td>
                          <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.deliveryAddress}</td>
                          <td><span className="status-badge pending">{o.paymentMode}</span></td>
                          <td><strong>₹{o.grandTotal.toFixed(2)}</strong></td>
                          <td>
                            <span className={`status-badge ${
                              o.status === 'DELIVERED' ? 'present' :
                              o.status === 'CANCELLED' ? 'absent' : 'pending'
                            }`}>{o.status}</span>
                          </td>
                          <td>
                            <select 
                              value={o.status} 
                              onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                              className="form-control"
                              style={{ width: 'auto', padding: '4px 8px', fontSize: 12, height: 'auto', display: 'inline-block' }}
                            >
                              <option value="PLACED">Placed</option>
                              <option value="CONFIRMED">Confirmed</option>
                              <option value="PROCESSING">Processing</option>
                              <option value="SHIPPED">Shipped</option>
                              <option value="DELIVERED">Delivered</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'coupons' && (
              <div>
                <div className="page-header">
                  <div>
                    <h2>Store Coupons</h2>
                    <p>Configure marketing codes and promo discounts.</p>
                  </div>
                  <button onClick={() => setShowCouponModal(true)} className="btn btn-primary btn-sm">
                    <Plus size={16} /> Create Coupon
                  </button>
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Type</th>
                        <th>Discount Value</th>
                        <th>Min Order Requirement</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coupons.map(c => (
                        <tr key={c.id}>
                          <td><strong>{c.code}</strong></td>
                          <td>{c.discountType}</td>
                          <td>{c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `₹${c.discountValue}`}</td>
                          <td>₹{c.minOrderAmount}</td>
                          <td>
                            <span className={`status-badge ${c.active ? 'present' : 'absent'}`}>
                              {c.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <button onClick={() => handleDeleteCoupon(c.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {showCouponModal && (
                  <div className="modal-overlay" onClick={() => setShowCouponModal(false)}>
                    <form className="modal" onSubmit={handleCreateCoupon} onClick={(e) => e.stopPropagation()}>
                      <div className="modal-header">
                        <h3 className="modal-title">Create Promo Code</h3>
                        <button type="button" onClick={() => setShowCouponModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>×</button>
                      </div>
                      <div className="modal-body">
                        <div className="form-group">
                          <label className="form-label">Coupon Code</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            required 
                            placeholder="e.g. WELCOME10"
                            value={newCoupon.code}
                            onChange={(e) => setNewCoupon(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Discount Type</label>
                          <select 
                            className="form-control"
                            value={newCoupon.discountType}
                            onChange={(e) => setNewCoupon(prev => ({ ...prev, discountType: e.target.value }))}
                          >
                            <option value="FLAT">Flat Cash (₹)</option>
                            <option value="PERCENTAGE">Percentage (%)</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Discount Value</label>
                          <input 
                            type="number" 
                            className="form-control" 
                            required 
                            value={newCoupon.discountValue}
                            onChange={(e) => setNewCoupon(prev => ({ ...prev, discountValue: parseFloat(e.target.value) || 0 }))}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Minimum Order Requirement (₹)</label>
                          <input 
                            type="number" 
                            className="form-control" 
                            value={newCoupon.minOrderAmount}
                            onChange={(e) => setNewCoupon(prev => ({ ...prev, minOrderAmount: parseFloat(e.target.value) || 0 }))}
                          />
                        </div>
                      </div>
                      <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={() => setShowCouponModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Create Coupon</button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div>
                <div className="page-header">
                  <div>
                    <h2>Review Moderation</h2>
                    <p>Moderate customer reviews and feedback comments.</p>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Product ID</th>
                        <th>Customer</th>
                        <th>Rating</th>
                        <th>Comment</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviews.map(r => (
                        <tr key={r.id}>
                          <td><span style={{ fontFamily: 'monospace' }}>{r.productId.substring(0, 8)}...</span></td>
                          <td><strong>{r.customerName}</strong></td>
                          <td style={{ color: '#f59e0b' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</td>
                          <td>{r.comment}</td>
                          <td>
                            <button onClick={() => handleDeleteReview(r.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }}>
                              <Trash2 size={16} /> Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'cms_layout' && (
              <div>
                <div className="page-header">
                  <div>
                    <h2>Homepage Layout CMS Builder</h2>
                    <p>Rearrange or toggle visibility of homepage content sections.</p>
                  </div>
                </div>
                <div className="card" style={{ padding: 24 }}>
                  <h4 style={{ marginBottom: 16 }}>Active Homepage Sections Sequence</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {storeConfigs.homepage_layout.split(',').map((section, index, arr) => (
                      <div key={section} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius)', color: 'var(--color-text-primary)' }}>
                        <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                          {section.replace('_', ' ')}
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button 
                            disabled={index === 0} 
                            onClick={() => {
                              const newArr = [...arr];
                              const temp = newArr[index];
                              newArr[index] = newArr[index - 1];
                              newArr[index - 1] = temp;
                              handleSaveConfigs({ ...storeConfigs, homepage_layout: newArr.join(',') });
                            }}
                            className="btn btn-secondary btn-sm"
                          >
                            ↑ Move Up
                          </button>
                          <button 
                            disabled={index === arr.length - 1} 
                            onClick={() => {
                              const newArr = [...arr];
                              const temp = newArr[index];
                              newArr[index] = newArr[index + 1];
                              newArr[index + 1] = temp;
                              handleSaveConfigs({ ...storeConfigs, homepage_layout: newArr.join(',') });
                            }}
                            className="btn btn-secondary btn-sm"
                          >
                            ↓ Move Down
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'banners' && (
              <div>
                <div className="page-header">
                  <div>
                    <h2>Hero Banner Manager</h2>
                    <p>Configure promotional sliding banners displayed on the homepage.</p>
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
                  {JSON.parse(storeConfigs.banners || '[]').map((banner, index, arr) => (
                    <div key={banner.id} className="card" style={{ padding: 20 }}>
                      <div style={{ display: 'flex', gap: 20 }}>
                        <img src={banner.image} alt={banner.title} style={{ width: 140, height: 90, objectFit: 'cover', borderRadius: 6 }} />
                        <div style={{ flexGrow: 1 }}>
                          <h4 style={{ margin: '0 0 6px 0' }}>{banner.title || 'Slide Title'}</h4>
                          <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, margin: '0 0 10px 0' }}>{banner.subtitle}</p>
                          <span style={{ fontSize: 12, background: 'var(--color-bg-secondary)', padding: '4px 8px', borderRadius: 4 }}>Link: {banner.link}</span>
                        </div>
                        <button 
                          onClick={() => {
                            if (window.confirm('Delete slide?')) {
                              const filtered = arr.filter((_, idx) => idx !== index);
                              handleSaveConfigs({ ...storeConfigs, banners: JSON.stringify(filtered) });
                            }
                          }}
                          className="btn btn-ghost" 
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <Trash2 size={16} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="card" style={{ padding: 24, marginTop: 10 }}>
                    <h4 style={{ marginBottom: 16 }}>Add New Promotion Slide</h4>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target;
                      const title = form.title.value;
                      const subtitle = form.subtitle.value;
                      const link = form.link.value;
                      const image = form.image.value;
                      
                      const current = JSON.parse(storeConfigs.banners || '[]');
                      const next = [...current, { id: Date.now(), title, subtitle, link, image, active: true }];
                      handleSaveConfigs({ ...storeConfigs, banners: JSON.stringify(next) });
                      form.reset();
                    }}>
                      <div className="form-group" style={{ marginBottom: 12 }}>
                        <label className="form-label">Image URL</label>
                        <input name="image" required className="form-control" type="text" placeholder="https://..." />
                      </div>
                      <div className="form-row" style={{ marginBottom: 12 }}>
                        <div className="form-group">
                          <label className="form-label">Slide Title</label>
                          <input name="title" required className="form-control" type="text" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Slide Subtitle</label>
                          <input name="subtitle" className="form-control" type="text" />
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">CTA Redirect Link</label>
                        <input name="link" required className="form-control" type="text" placeholder="/store/shop?category=Spices" />
                      </div>
                      <button type="submit" className="btn btn-primary">Add Slide to Carousel</button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'branding' && (
              <div>
                <div className="page-header">
                  <div>
                    <h2>Branding & Appearance Customizer</h2>
                    <p>Modify logo, colors, pricing configurations, and policy layouts.</p>
                  </div>
                </div>
                
                <form className="card" style={{ padding: 24 }} onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.target;
                  handleSaveConfigs({
                    ...storeConfigs,
                    logo_text: form.logo_text.value,
                    primary_color: form.primary_color.value,
                    accent_color: form.accent_color.value,
                    shipping_charge: form.shipping_charge.value,
                    free_shipping_min: form.free_shipping_min.value,
                    gst_percent: form.gst_percent.value
                  });
                }}>
                  <div className="form-row" style={{ marginBottom: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Store Brand Text Logo</label>
                      <input name="logo_text" defaultValue={storeConfigs.logo_text} className="form-control" type="text" />
                    </div>
                  </div>
                  <div className="form-row" style={{ marginBottom: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Primary Color Theme</label>
                      <input name="primary_color" defaultValue={storeConfigs.primary_color} className="form-control" type="color" style={{ height: 44, padding: '2px 6px' }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Accent Color Theme</label>
                      <input name="accent_color" defaultValue={storeConfigs.accent_color} className="form-control" type="color" style={{ height: 44, padding: '2px 6px' }} />
                    </div>
                  </div>
                  <div className="form-row-3" style={{ marginBottom: 20 }}>
                    <div className="form-group">
                      <label className="form-label">Default Shipping Cost (₹)</label>
                      <input name="shipping_charge" defaultValue={storeConfigs.shipping_charge} className="form-control" type="number" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Free Shipping Limit (₹)</label>
                      <input name="free_shipping_min" defaultValue={storeConfigs.free_shipping_min} className="form-control" type="number" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Default GST rate (%)</label>
                      <input name="gst_percent" defaultValue={storeConfigs.gst_percent} className="form-control" type="number" />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary">Save Branding & Colors</button>
                </form>
              </div>
            )}

            {/* E-Commerce Product Configuration Modal */}
            {showProductModal && editingProduct && (
              <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
                <form className="modal" onSubmit={handleSaveProduct} onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3 className="modal-title">E-Commerce Product Config: {editingProduct.code}</h3>
                    <button type="button" onClick={() => setShowProductModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>×</button>
                  </div>
                  <div className="modal-body">
                    {/* Tab Navigation */}
                    <div className="tabs" style={{ marginBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
                      <button type="button" className={`tab-btn ${modalTab === 'details' ? 'active' : ''}`} onClick={() => setModalTab('details')} style={{ padding: '8px 16px' }}>Details & Pricing</button>
                      <button type="button" className={`tab-btn ${modalTab === 'media' ? 'active' : ''}`} onClick={() => setModalTab('media')} style={{ padding: '8px 16px' }}>Images & Media</button>
                      <button type="button" className={`tab-btn ${modalTab === 'specs' ? 'active' : ''}`} onClick={() => setModalTab('specs')} style={{ padding: '8px 16px' }}>Specifications</button>
                    </div>

                    {modalTab === 'details' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="form-group">
                          <label className="form-label">Storefront Display Title</label>
                          <input 
                            type="text" 
                            className="form-control"
                            required
                            value={pName}
                            onChange={(e) => setPName(e.target.value)}
                          />
                        </div>

                        <div className="form-row-3">
                          <div className="form-group">
                            <label className="form-label">Selling Price / MRP (₹)</label>
                            <input 
                              type="number" 
                              className="form-control"
                              required
                              value={pSellingPrice}
                              onChange={(e) => setPSellingPrice(e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Discount Price (₹)</label>
                            <input 
                              type="number" 
                              className="form-control"
                              value={pDiscountPrice}
                              onChange={(e) => setPDiscountPrice(e.target.value)}
                              placeholder="Promo price"
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Wholesale Price (₹)</label>
                            <input 
                              type="number" 
                              className="form-control"
                              value={pWholesalePrice}
                              onChange={(e) => setPWholesalePrice(e.target.value)}
                              placeholder="B2B price"
                            />
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">GST Tax Percent (%)</label>
                            <input 
                              type="number" 
                              className="form-control"
                              value={pGstPercent}
                              onChange={(e) => setPGstPercent(e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Tax Display Mode</label>
                            <select 
                              className="form-control"
                              value={pTaxInclusive ? 'inclusive' : 'exclusive'}
                              onChange={(e) => setPTaxInclusive(e.target.value === 'inclusive')}
                            >
                              <option value="inclusive">GST Tax Inclusive</option>
                              <option value="exclusive">GST Tax Exclusive</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 8, marginTop: 10 }}>
                          <span className="form-label" style={{ marginBottom: 10, display: 'block' }}>Storefront Visibility Control</span>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <label style={{ display: 'flex', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                              <input type="checkbox" checked={pShowOnStorefront} onChange={(e) => setPShowOnStorefront(e.target.checked)} /> Show on Storefront
                            </label>
                            <label style={{ display: 'flex', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                              <input type="checkbox" checked={pPublished} onChange={(e) => setPPublished(e.target.checked)} /> Publish Product
                            </label>
                            <label style={{ display: 'flex', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                              <input type="checkbox" checked={pIsFeatured} onChange={(e) => setPIsFeatured(e.target.checked)} /> Featured Product
                            </label>
                            <label style={{ display: 'flex', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                              <input type="checkbox" checked={pBestSeller} onChange={(e) => setPBestSeller(e.target.checked)} /> Best Seller
                            </label>
                            <label style={{ display: 'flex', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                              <input type="checkbox" checked={pNewArrival} onChange={(e) => setPNewArrival(e.target.checked)} /> New Arrival
                            </label>
                            <label style={{ display: 'flex', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                              <input type="checkbox" checked={pTrending} onChange={(e) => setPTrending(e.target.checked)} /> Trending Product
                            </label>
                            <label style={{ display: 'flex', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                              <input type="checkbox" checked={pTodaysDeal} onChange={(e) => setPTodaysDeal(e.target.checked)} /> Today's Deal
                            </label>
                            <label style={{ display: 'flex', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                              <input type="checkbox" checked={pSaleProduct} onChange={(e) => setPSaleProduct(e.target.checked)} /> On Sale
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {modalTab === 'media' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div className="form-group">
                          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            Primary Product Image (Compressed)
                            {pImageUrl && <button type="button" onClick={() => setPImageUrl('')} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 11 }}>Remove</button>}
                          </label>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <input type="file" accept="image/*" className="form-control" onChange={(e) => handleImageUpload(e, 'primary')} />
                            {pImageUrl && <img src={pImageUrl} alt="Primary" style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--color-border)' }} />}
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Upload Additional Gallery Images</label>
                          <input type="file" accept="image/*" className="form-control" onChange={(e) => handleImageUpload(e, 'gallery')} />
                        </div>

                        {pGalleryImages.length > 0 && (
                          <div>
                            <label className="form-label">Active Gallery ({pGalleryImages.length}) - Click to Delete</label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                              {pGalleryImages.map((img, idx) => (
                                <div key={idx} style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setPGalleryImages(prev => prev.filter((_, i) => i !== idx))}>
                                  <img src={img} alt="Gallery item" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--color-border)' }} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {modalTab === 'specs' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="form-group">
                          <label className="form-label">Short Marketing Description</label>
                          <input type="text" className="form-control" value={pShortDescription} onChange={(e) => setPShortDescription(e.target.value)} placeholder="1 tagline summary sentence" />
                        </div>
                        <div className="form-row-3">
                          <div className="form-group">
                            <label className="form-label">Brand</label>
                            <input type="text" className="form-control" value={pBrand} onChange={(e) => setPBrand(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Search Tags</label>
                            <input type="text" className="form-control" value={pTags} onChange={(e) => setPTags(e.target.value)} placeholder="comma separated" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Barcode / UPC</label>
                            <input type="text" className="form-control" value={pBarcode} onChange={(e) => setPBarcode(e.target.value)} />
                          </div>
                        </div>
                        <div className="form-row-3">
                          <div className="form-group">
                            <label className="form-label">Weight (g/kg)</label>
                            <input type="text" className="form-control" value={pWeight} onChange={(e) => setPWeight(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Dimensions</label>
                            <input type="text" className="form-control" value={pDimensions} onChange={(e) => setPDimensions(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Country of Origin</label>
                            <input type="text" className="form-control" value={pCountryOfOrigin} onChange={(e) => setPCountryOfOrigin(e.target.value)} />
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">Shelf Life</label>
                            <input type="text" className="form-control" value={pShelfLife} onChange={(e) => setPShelfLife(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Fulfillment Purchase Limits</label>
                            <div style={{ display: 'flex', gap: 10 }}>
                              <input type="number" className="form-control" value={pMinOrderQty} onChange={(e) => setPMinOrderQty(e.target.value)} placeholder="Min Qty" />
                              <input type="number" className="form-control" value={pMaxOrderQty} onChange={(e) => setPMaxOrderQty(e.target.value)} placeholder="Max Qty" />
                            </div>
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Ingredients</label>
                          <textarea className="form-control" style={{ minHeight: 65 }} value={pIngredients} onChange={(e) => setPIngredients(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Storefront Specifications / HTML Layout</label>
                          <textarea className="form-control" style={{ minHeight: 85 }} value={pSpecifications} onChange={(e) => setPSpecifications(e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowProductModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Save Settings</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
