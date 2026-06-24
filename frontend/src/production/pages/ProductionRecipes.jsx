import { useState, useEffect } from 'react';
import { productsAPI } from '../../api';
import toast from 'react-hot-toast';
import { ListPlus, Search, ChevronDown, ChevronUp, Info } from 'lucide-react';

export default function ProductionRecipes() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [bomMap, setBomMap] = useState({});
  const [loadingBom, setLoadingBom] = useState({});

  useEffect(() => {
    productsAPI.list({ type: 'FINISHED_GOOD', active: true })
      .then(res => setProducts(res.data.data || []))
      .catch(() => toast.error('Failed to load finished goods'))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = async (productId) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      return;
    }

    setExpandedProduct(productId);

    // Fetch BOM if not loaded yet
    if (!bomMap[productId]) {
      setLoadingBom(prev => ({ ...prev, [productId]: true }));
      try {
        const res = await productsAPI.getBom(productId);
        setBomMap(prev => ({ ...prev, [productId]: res.data.data || [] }));
      } catch {
        toast.error('Failed to load recipe details');
      } finally {
        setLoadingBom(prev => ({ ...prev, [productId]: false }));
      }
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-spinner-wrap">
        <div className="p-spinner" />
      </div>
    );
  }

  return (
    <div className="p-page p-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <ListPlus size={22} color="var(--p-primary)" />
        <h3 style={{ fontSize: 16, fontWeight: 800 }}>Standard Recipes / BOM</h3>
      </div>

      {/* Search */}
      <div className="p-search">
        <Search size={16} className="p-search-icon" />
        <input
          type="text"
          placeholder="Search recipes by product code or name..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredProducts.length === 0 ? (
        <div className="p-card p-empty">
          <ListPlus size={32} style={{ opacity: 0.5 }} />
          <p className="title">No recipes found</p>
          <p className="sub">Try another search term.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredProducts.map((p) => {
            const isExpanded = expandedProduct === p.id;
            const bom = bomMap[p.id] || [];
            const isBomLoading = loadingBom[p.id];

            return (
              <div key={p.id} className="p-card" style={{ marginBottom: 0 }}>
                {/* Header */}
                <div
                  onClick={() => toggleExpand(p.id)}
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: isExpanded ? 'rgba(255,255,255,0.02)' : 'none'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--p-text-2)', marginTop: 4 }}>
                      Code: {p.code} · Unit: {p.unit}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} color="var(--p-text-3)" /> : <ChevronDown size={16} color="var(--p-text-3)" />}
                </div>

                {/* Collapsible Details */}
                {isExpanded && (
                  <div style={{
                    padding: '16px',
                    borderTop: '1px solid var(--p-border)',
                    background: 'rgba(0,0,0,0.1)'
                  }}>
                    {p.description && (
                      <div style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--p-text-2)', marginBottom: 12 }}>
                        <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{p.description}</span>
                      </div>
                    )}

                    {isBomLoading ? (
                      <div className="p-spinner-wrap" style={{ padding: 12 }}><div className="p-spinner" /></div>
                    ) : bom.length === 0 ? (
                      <div style={{ color: 'var(--p-text-3)', fontSize: 12, padding: '8px 0', textAlign: 'center' }}>
                        No recipe ingredients configured for this finished good.
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--p-text-3)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
                          Standard Bill of Materials (per Unit)
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {bom.map((item, idx) => (
                            <div key={idx} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 10px',
                              background: 'rgba(255,255,255,0.02)',
                              borderRadius: 4,
                              fontSize: 12.5
                            }}>
                              <div>
                                <div style={{ fontWeight: 600 }}>{item.raw_material_name}</div>
                                <div style={{ fontSize: 10, color: 'var(--p-text-3)', marginTop: 2 }}>Code: {item.raw_material_code}</div>
                              </div>
                              <div style={{ fontWeight: 700, color: 'var(--p-primary)' }}>
                                {item.qty_required} {item.unit}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
