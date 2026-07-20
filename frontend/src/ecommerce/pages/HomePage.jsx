import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Truck, RefreshCw, Clock } from 'lucide-react';
import { storefrontAPI } from '../api/ecomApi';
import ProductCard from '../components/ProductCard';
import axios from 'axios';

export default function HomePage() {
  const [dealsProducts, setDealsProducts] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [timeLeft, setTimeLeft] = useState(43200); // 12 Hours in seconds

  // CMS configuration states
  const [layoutOrder, setLayoutOrder] = useState(['banners', 'categories', 'deals', 'trending', 'testimonials']);
  const [bannerSlides, setBannerSlides] = useState([
    {
      id: 1,
      image: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=1200",
      title: "Premium Handpicked Spices",
      subtitle: "Get up to 15% off on pure organic masalas and whole spices.",
      link: "/store/shop?category=Spices"
    }
  ]);

  useEffect(() => {
    Promise.all([
      storefrontAPI.listProducts({ todaysDeal: true }),
      storefrontAPI.listProducts({ isFeatured: true }),
      storefrontAPI.listCategories(),
      axios.get('http://localhost:5000/api/store-settings')
    ]).then(([dealsRes, recRes, catRes, settingsRes]) => {
      setDealsProducts(dealsRes.data.data);
      setRecommendedProducts(recRes.data.data);
      setCategories(catRes.data.data);
      
      if (settingsRes.data.success) {
        const config = settingsRes.data.data;
        if (config.homepage_layout) {
          setLayoutOrder(config.homepage_layout.split(','));
        }
        if (config.banners) {
          setBannerSlides(JSON.parse(config.banners));
        }
      }
    }).catch(err => console.error(err))
      .finally(() => setLoading(false));

    // Countdown Timer
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 43200));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (bannerSlides.length <= 1) return;
    const slider = setInterval(() => {
      setCurrentSlide(prev => (prev === bannerSlides.length - 1 ? 0 : prev + 1));
    }, 6000);
    return () => clearInterval(slider);
  }, [bannerSlides]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const getCategoryEmoji = (cat) => {
    const lower = cat.toLowerCase();
    if (lower.includes('spice') || lower.includes('masala')) return '🌶️';
    if (lower.includes('flour') || lower.includes('grain')) return '🌾';
    if (lower.includes('oil')) return '💧';
    if (lower.includes('pickle')) return '🏺';
    return '📦';
  };

  // Render components dynamically based on layout sequence
  const renderSection = (sectionType) => {
    switch (sectionType) {
      case 'banners':
        if (bannerSlides.length === 0) return null;
        const slide = bannerSlides[currentSlide] || bannerSlides[0];
        return (
          <div 
            key="banners"
            className="ecom-hero" 
            style={{ 
              backgroundImage: `linear-gradient(135deg, rgba(17,52,37,0.85) 0%, rgba(17,52,37,0.95) 100%), url(${slide.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              transition: 'all 0.5s ease',
              minHeight: '340px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <div className="ecom-hero-content">
              <span style={{ background: 'var(--color-accent-orange)', padding: '4px 10px', borderRadius: 3, fontSize: 11, color: '#fff', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
                Limited Period Promotion
              </span>
              <h1 className="ecom-hero-title" style={{ marginTop: 12 }}>{slide.title}</h1>
              <p className="ecom-hero-subtitle">{slide.subtitle}</p>
              <Link to={slide.link} className="ecom-btn ecom-btn-primary">
                Explore Deals Now <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        );

      case 'categories':
        if (categories.length === 0) return null;
        return (
          <div key="categories" className="category-strip">
            {categories.map(cat => (
              <Link key={cat} to={`/store/shop?category=${encodeURIComponent(cat)}`} className="category-strip-item">
                <div className="category-strip-icon">
                  {getCategoryEmoji(cat)}
                </div>
                <span>{cat}</span>
              </Link>
            ))}
          </div>
        );

      case 'deals':
        return (
          <div key="deals" className="products-section" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0', paddingBottom: 16, marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Deals of the Day</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--color-accent-red)', fontWeight: 700, background: 'var(--color-danger-bg)', padding: '4px 10px', borderRadius: 4 }}>
                  <Clock size={16} />
                  <span>Ends in {formatTime(timeLeft)}</span>
                </div>
              </div>
              <Link to="/store/shop" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
                View All Deals
              </Link>
            </div>

            {loading ? (
              <div className="loading-center"><div className="loading-spinner"></div></div>
            ) : dealsProducts.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)' }}>No deals active today.</p>
            ) : (
              <div className="products-grid">
                {dealsProducts.slice(0, 4).map(p => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        );

      case 'recommended':
        return (
          <div key="recommended" className="products-section" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0', paddingBottom: 16, marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Recommended For You</h2>
              <Link to="/store/shop" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
                See All Products
              </Link>
            </div>

            {loading ? (
              <div className="loading-center"><div className="loading-spinner"></div></div>
            ) : recommendedProducts.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)' }}>No recommended products available.</p>
            ) : (
              <div className="products-grid">
                {recommendedProducts.slice(0, 4).map(p => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        );

      case 'trending':
        return (
          <div key="trending" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, margin: '24px 0' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: 'var(--color-bg-surface)', padding: 18, borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' }}>
              <Shield size={32} style={{ color: 'var(--color-primary)' }} />
              <div>
                <h4 style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>100% Certified Organic</h4>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Strict chemical/purity tests</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: 'var(--color-bg-surface)', padding: 18, borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' }}>
              <Truck size={32} style={{ color: 'var(--color-primary)' }} />
              <div>
                <h4 style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>Direct Warehouse Dispatch</h4>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Fast logistics tracking</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: 'var(--color-bg-surface)', padding: 18, borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' }}>
              <RefreshCw size={32} style={{ color: 'var(--color-primary)' }} />
              <div>
                <h4 style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>Full Origin Traceability</h4>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Complete batch production records</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="ecom-container">
      {layoutOrder.map(section => renderSection(section))}
    </div>
  );
}
