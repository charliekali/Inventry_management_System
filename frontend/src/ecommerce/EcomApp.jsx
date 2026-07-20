import { Routes, Route, NavLink } from 'react-router-dom';
import { EcomAuthProvider } from './context/EcomAuthContext';
import { CartProvider } from './context/CartContext';
import EcomHeader from './components/EcomHeader';
import EcomFooter from './components/EcomFooter';
import { Home, ShoppingBag, ShoppingCart, User } from 'lucide-react';

// Pages
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmPage from './pages/OrderConfirmPage';
import AccountPage from './pages/AccountPage';
import WishlistPage from './pages/WishlistPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TrackOrderPage from './pages/TrackOrderPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';

import { useEffect, useState } from 'react';
import axios from 'axios';

import './ecommerce.css';

export default function EcomApp() {
  const [storeConfigs, setStoreConfigs] = useState(null);

  useEffect(() => {
    axios.get('http://localhost:5000/api/store-settings')
      .then(res => {
        if (res.data.success) {
          const config = res.data.data;
          setStoreConfigs(config);
          
          if (config.primary_color) {
            document.documentElement.style.setProperty('--color-primary', config.primary_color);
          }
          if (config.accent_color) {
            document.documentElement.style.setProperty('--color-accent-orange', config.accent_color);
          }
        }
      })
      .catch(err => console.error("Error loading store settings", err));
  }, []);

  return (
    <EcomAuthProvider>
      <CartProvider>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--color-bg-base)', color: 'var(--color-text-main)', paddingBottom: '56px' }}>
          <EcomHeader />
          <main style={{ flexGrow: 1 }}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/product/:id" element={<ProductDetailPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/order-confirm" element={<OrderConfirmPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/track" element={<TrackOrderPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
            </Routes>
          </main>
          <EcomFooter />
          
          {/* Mobile Bottom Navigation Bar */}
          <nav className="mobile-bottom-nav">
            <NavLink to="/store" end className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
              <Home size={20} />
              <span>Home</span>
            </NavLink>
            <NavLink to="/store/shop" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
              <ShoppingBag size={20} />
              <span>Shop</span>
            </NavLink>
            <NavLink to="/store/cart" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
              <ShoppingCart size={20} />
              <span>Cart</span>
            </NavLink>
            <NavLink to="/store/account" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
              <User size={20} />
              <span>Account</span>
            </NavLink>
          </nav>
        </div>
      </CartProvider>
    </EcomAuthProvider>
  );
}
