import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { storefrontAPI } from '../api/ecomApi';
import ProductCard from '../components/ProductCard';

export default function ShopPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const brand = searchParams.get('brand') || '';
  const sortBy = searchParams.get('sortBy') || 'newest';

  useEffect(() => {
    storefrontAPI.listCategories().then(res => setCategories(res.data.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    storefrontAPI.listProducts({ search, category, brand, sortBy })
      .then(res => setProducts(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [search, category, brand, sortBy]);

  const handleCategoryFilter = (cat) => {
    const params = new URLSearchParams(searchParams);
    if (cat) params.set('category', cat);
    else params.delete('category');
    setSearchParams(params);
  };

  const handleSortChange = (sortVal) => {
    const params = new URLSearchParams(searchParams);
    params.set('sortBy', sortVal);
    setSearchParams(params);
  };

  return (
    <div className="ecom-container">
      <div className="shop-layout">
        {/* Filters Sidebar */}
        <aside className="shop-filters">
          <div className="filter-group">
            <h4 className="filter-title">Categories</h4>
            <div 
              className={`filter-option ${category === '' ? 'active' : ''}`} 
              onClick={() => handleCategoryFilter('')}
              style={{ fontWeight: category === '' ? 'bold' : 'normal', cursor: 'pointer', marginBottom: 8 }}
            >
              All Categories
            </div>
            {categories.map(cat => (
              <div 
                key={cat} 
                className={`filter-option ${category === cat ? 'active' : ''}`} 
                onClick={() => handleCategoryFilter(cat)}
                style={{ fontWeight: category === cat ? 'bold' : 'normal', cursor: 'pointer', marginBottom: 8, color: category === cat ? 'var(--color-success)' : 'inherit' }}
              >
                {cat}
              </div>
            ))}
          </div>
        </aside>

        {/* Product Grid Panel */}
        <main>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Shop Products</h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>Showing {products.length} products</p>
            </div>
            <div>
              <select 
                className="form-control" 
                value={sortBy} 
                onChange={(e) => handleSortChange(e.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-center"><div className="loading-spinner"></div></div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 16 }}>No products match your filters.</p>
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
