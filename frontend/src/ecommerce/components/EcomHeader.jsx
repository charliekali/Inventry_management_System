import { Link, NavLink } from 'react-router-dom';
import { ShoppingCart, User, Heart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useEcomAuth } from '../context/EcomAuthContext';
import SearchBar from './SearchBar';

export default function EcomHeader() {
  const { cartItems } = useCart();
  const { customer } = useEcomAuth();

  const totalItems = cartItems.reduce((sum, item) => sum + item.qty_required, 0);

  return (
    <header className="ecom-header">
      <div className="ecom-container ecom-nav">
        <Link to="/store" className="ecom-logo">
          <span style={{ color: 'var(--color-success)' }}>🍃</span> TTRIMS Store
        </Link>

        <SearchBar />

        <ul className="ecom-nav-links">
          <li><NavLink to="/store" end className={({ isActive }) => `ecom-nav-link ${isActive ? 'active' : ''}`}>Home</NavLink></li>
          <li><NavLink to="/store/shop" className={({ isActive }) => `ecom-nav-link ${isActive ? 'active' : ''}`}>Shop</NavLink></li>
          <li><NavLink to="/store/about" className={({ isActive }) => `ecom-nav-link ${isActive ? 'active' : ''}`}>About</NavLink></li>
          <li><NavLink to="/store/contact" className={({ isActive }) => `ecom-nav-link ${isActive ? 'active' : ''}`}>Contact</NavLink></li>
        </ul>

        <div className="ecom-nav-actions">
          <Link to="/store/wishlist" className="ecom-icon-btn">
            <Heart size={20} />
          </Link>

          <Link to="/store/cart" className="ecom-icon-btn">
            <ShoppingCart size={20} />
            {totalItems > 0 && <span className="ecom-badge">{totalItems}</span>}
          </Link>

          {customer ? (
            <Link to="/store/account" className="ecom-icon-btn" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: 'inherit' }}>
              <User size={20} />
              <span style={{ fontSize: 13, fontWeight: 500 }} className="desktop-only">{customer.name.split(' ')[0]}</span>
            </Link>
          ) : (
            <Link to="/store/login" className="ecom-btn ecom-btn-secondary" style={{ padding: '6px 16px', fontSize: 13, borderRadius: 20 }}>
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
