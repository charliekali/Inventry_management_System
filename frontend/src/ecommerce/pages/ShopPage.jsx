import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { storefrontAPI } from '../api/ecomApi';
import ProductCard from '../components/ProductCard';
import { Filter, RotateCcw } from 'lucide-react';

export default function ShopPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const brand = searchParams.get('brand') || '';
  const sortBy = searchParams.get('sortBy') || 'newest';
  const priceMax = searchParams.get('priceMax') || '';

  // Seed brands list
  const brands = ["TTRIMS Spices", "TTRIMS Grains", "TTRIMS Organics"];

  useEffect(() => {
    storefrontAPI.listCategories().then(res => setCategories(res.data.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    storefrontAPI.listProducts({ search, category, brand, sortBy })
      .then(res => {
        let items = res.data.data;
        if (priceMax) {
          const max = parseFloat(priceMax);
          items = items.filter(p => (p.discount_price || p.selling_price) <= max);
        }
        setProducts(items);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [search, category, brand, sortBy, priceMax]);

  const handleCategoryFilter = (cat) => {
    const params = new URLSearchParams(searchParams);
    if (cat) params.set('category', cat);
    else params.delete('category');
    setSearchParams(params);
  };

  const handleBrandFilter = (b) => {
    const params = new URLSearchParams(searchParams);
    if (b) params.set('brand', b);
    else params.delete('brand');
    setSearchParams(params);
  };

  const handlePriceFilter = (max) => {
    const params = new URLSearchParams(searchParams);
    if (max) params.set('priceMax', max);
    else params.delete('priceMax');
    setSearchParams(params);
  };

  const handleSortChange = (sortVal) => {
    const params = new URLSearchParams(searchParams);
    params.set('sortBy', sortVal);
    setSearchParams(params);
  };

  const clearAllFilters = () => {
    setSearchParams({});
  };

  return (
    <div className="ecom-container">
      <div className="shop-layout">
        {/* Filters Sidebar */}
        <aside className="shop-filters">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold', fontSize: 15, textTransform: 'uppercase' }}>
              <Filter size={18} />
              <span>Filters</span>
            </div>
            {(category || brand || priceMax || search) && (
              <button 
                onClick={clearAllFilters}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'bold' }}
              >
                <RotateCcw size={12} /> Clear
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="filter-group">
            <h4>Categories</h4>
            <div 
              className="filter-option"
              onClick={() => handleCategoryFilter('')}
              style={{ fontWeight: category === '' ? 'bold' : 'normal', color: category === '' ? 'var(--color-primary)' : 'inherit' }}
            >
              All Categories
            </div>
            {categories.map(cat => (
              <div 
                key={cat} 
                className="filter-option"
                onClick={() => handleCategoryFilter(cat)}
                style={{ fontWeight: category === cat ? 'bold' : 'normal', color: category === cat ? 'var(--color-primary)' : 'inherit' }}
              >
                {cat}
              </div>
            ))}
          </div>

          {/* Brand Filter */}
          <div className="filter-group">
            <h4>Brands</h4>
            <div 
              className="filter-option"
              onClick={() => handleBrandFilter('')}
              style={{ fontWeight: brand === '' ? 'bold' : 'normal', color: brand === '' ? 'var(--color-primary)' : 'inherit' }}
            >
              All Brands
            </div>
            {brands.map(b => (
              <div 
                key={b} 
                className="filter-option"
                onClick={() => handleBrandFilter(b)}
                style={{ fontWeight: brand === b ? 'bold' : 'normal', color: brand === b ? 'var(--color-primary)' : 'inherit' }}
              >
                {b}
              </div>
            ))}
          </div>

          {/* Price Filters */}
          <div className="filter-group">
            <h4>Price Cap</h4>
            <div 
              className="filter-option"
              onClick={() => handlePriceFilter('')}
              style={{ fontWeight: priceMax === '' ? 'bold' : 'normal', color: priceMax === '' ? 'var(--color-primary)' : 'inherit' }}
            >
              Any Price
            </div>
            {[100, 200, 500].map(max => (
              <div 
                key={max} 
                className="filter-option"
                onClick={() => handlePriceFilter(max.toString())}
                style={{ fontWeight: priceMax === max.toString() ? 'bold' : 'normal', color: priceMax === max.toString() ? 'var(--color-primary)' : 'inherit' }}
              >
                Under ₹{max}
              </div>
            ))}
          </div>
        </aside>

        {/* Product Grid Panel */}
        <main style={{ background: 'var(--color-bg-surface)', padding: 20, borderRadius: 4, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                {search ? `Search Results for "${search}"` : 'All Products'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                Showing {products.length} products
              </p>
            </div>
            
            {/* Sorting controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Sort By:</span>
              <select 
                value={sortBy} 
                onChange={(e) => handleSortChange(e.target.value)}
                style={{ 
                  padding: '6px 12px', 
                  borderRadius: 4, 
                  border: '1px solid var(--color-border)', 
                  outline: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <option value="newest">Newest Arrivals</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {[1, 2, 3, 4].map(idx => (
                <div key={idx} className="product-card" style={{ height: 320 }}>
                  <div className="skeleton" style={{ height: '60%', margin: 10 }}></div>
                  <div className="skeleton" style={{ height: 16, margin: '0 10px 10px 10px', width: '80%' }}></div>
                  <div className="skeleton" style={{ height: 16, margin: '0 10px 10px 10px', width: '50%' }}></div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 15 }}>No products match your filters.</p>
            </div>
          ) : (
            <div className="products-grid">
              {products.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
