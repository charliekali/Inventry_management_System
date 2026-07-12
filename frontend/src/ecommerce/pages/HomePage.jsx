import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star, Shield, Truck, RefreshCw } from 'lucide-react';
import { storefrontAPI } from '../api/ecomApi';
import ProductCard from '../components/ProductCard';

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      storefrontAPI.listProducts({ sortBy: 'newest' }),
      storefrontAPI.listCategories()
    ]).then(([prodRes, catRes]) => {
      setFeaturedProducts(prodRes.data.data.slice(0, 4));
      setCategories(catRes.data.data);
    }).catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="ecom-container">
      {/* Hero Banner */}
      <div className="ecom-hero">
        <div style={{ padding: '0 40px' }} className="ecom-hero-content">
          <span style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '6px 12px', borderRadius: 20, fontSize: 13, color: '#34d399', fontWeight: 600 }}>Wholesale & Retail Spices</span>
          <h1 className="ecom-hero-title" style={{ marginTop: 12 }}>Premium Organic Spices & Raw Materials</h1>
          <p className="ecom-hero-subtitle">Direct from processing plants to your warehouse. Fast shipping, guaranteed freshness, and full trace-to-origin logs.</p>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link to="/store/shop" className="ecom-btn ecom-btn-primary" style={{ textDecoration: 'none' }}>
              Shop Storefront <ArrowRight size={18} />
            </Link>
            <Link to="/store/shop?wholesale=true" className="ecom-btn ecom-btn-secondary" style={{ textDecoration: 'none' }}>
              Wholesale Rates
            </Link>
          </div>
        </div>
      </div>

      {/* Value Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, margin: '48px 0' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: 'var(--color-bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <Shield size={32} style={{ color: 'var(--color-success)' }} />
          <div>
            <h4 style={{ margin: 0, fontWeight: 700 }}>100% Organic</h4>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Quality certified spices</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: 'var(--color-bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <Truck size={32} style={{ color: 'var(--color-success)' }} />
          <div>
            <h4 style={{ margin: 0, fontWeight: 700 }}>Fast Shipping</h4>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Express driver dispatch</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: 'var(--color-bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <RefreshCw size={32} style={{ color: 'var(--color-success)' }} />
          <div>
            <h4 style={{ margin: 0, fontWeight: 700 }}>Traceability</h4>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Complete batch records</span>
          </div>
        </div>
      </div>

      {/* Categories */}
      <section className="category-section">
        <h2 className="category-title">Explore Categories</h2>
        {categories.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No categories found in IMS database.</p>
        ) : (
          <div className="category-grid">
            {categories.map(cat => (
              <Link key={cat} to={`/store/shop?category=${encodeURIComponent(cat)}`} className="category-card">
                <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>🌶️</span>
                {cat}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Featured Products */}
      <section className="products-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Featured Products</h2>
          <Link to="/store/shop" style={{ color: 'var(--color-success)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            See All <ArrowRight size={16} />
          </Link>
        </div>
        {loading ? (
          <div className="loading-center"><div className="loading-spinner"></div></div>
        ) : featuredProducts.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No products in stock right now.</p>
        ) : (
          <div className="products-grid">
            {featuredProducts.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
