import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Heart, Search, HelpCircle, Package, LogOut, Leaf } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useEcomAuth } from '../context/EcomAuthContext';
import { useState } from 'react';

export default function EcomHeader() {
  const { cartItems } = useCart();
  const { customer, handleLogout } = useEcomAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const totalItems = cartItems.reduce((sum, item) => sum + item.qty_required, 0);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/store/shop?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/store/shop');
    }
  };

  return (
    <header className="ecom-header">
      <div className="ecom-container ecom-nav">
        {/* Logo */}
        <Link to="/store" className="ecom-logo">
          <Leaf size={24} style={{ color: 'var(--color-accent-orange)', strokeWidth: 2.5 }} /> TTRIMS Marketplace
        </Link>

        {/* Center Search Bar */}
        <form onSubmit={handleSearchSubmit} className="ecom-search-container">
          <input
            type="text"
            placeholder="Search for organic spices, flours, grains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ecom-search-input"
          />
          <button type="submit" className="ecom-search-btn" title="Search">
            <Search size={18} />
          </button>
        </form>

        {/* Navigation / Action Options */}
        <div className="ecom-nav-actions">
          <NavLink to="/store/shop" className="ecom-nav-link desktop-only">
            Shop All
          </NavLink>
          
          <NavLink to="/store/about" className="ecom-nav-link desktop-only">
            About Us
          </NavLink>

          <Link to="/store/wishlist" className="ecom-icon-btn" title="Wishlist">
            <Heart size={20} />
          </Link>

          <Link to="/store/cart" className="ecom-icon-btn" title="Shopping Cart">
            <ShoppingCart size={20} />
            {totalItems > 0 && <span className="ecom-badge">{totalItems}</span>}
          </Link>

          {customer ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Link to="/store/account" className="ecom-icon-btn" title="My Account" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={20} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{customer.name.split(' ')[0]}</span>
              </Link>
              <button 
                onClick={handleLogout} 
                title="Sign Out" 
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 4 }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link to="/store/login" className="ecom-btn" style={{ background: '#fff', color: 'var(--color-primary)', padding: '6px 16px', fontSize: 13, borderRadius: 3 }}>
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
