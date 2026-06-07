import { useState, useEffect } from 'react';
import { stockAPI, productsAPI } from '../api';
import toast from 'react-hot-toast';
import { MapPin, Search, Package, Map, AlertTriangle } from 'lucide-react';

export default function LocatePage() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationData, setLocationData] = useState(null);

  useEffect(() => {
    productsAPI.list()
      .then(r => setProducts(r.data.data))
      .catch(() => toast.error('Failed to load products'));
  }, []);

  const handleLocate = (id) => {
    if (!id) {
      setLocationData(null);
      return;
    }
    setLoading(true);
    setProductId(id);
    stockAPI.locate(id)
      .then(r => setLocationData(r.data.data))
      .catch(() => toast.error('Failed to query locations for this product'))
      .finally(() => setLoading(false));
  };

  return (
    <div className="fade-in" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Location Finder</h2>
          <p>Find the exact coordinates (Warehouse & Section) and quantities of any item in inventory</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form-group">
          <label className="form-label">Search / Select Product to Locate</label>
          <select 
            className="form-control" 
            value={productId}
            onChange={(e) => handleLocate(e.target.value)}
            style={{ padding: 14, fontSize: 15 }}
          >
            <option value="">Choose a product...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                [{p.code}] {p.name} ({p.type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="loading-spinner"></div></div>
      ) : locationData ? (
        <div className="fade-in">
          {/* Summary Box */}
          <div className="responsive-grid-locate">
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, background: 'rgba(59, 130, 246, 0.15)',
                display: 'flex', alignItems: 'center', justifyItems: 'center', fontSize: 24, paddingLeft: 12
              }}>
                📦
              </div>
              <div>
                <span className="badge badge-blue" style={{ marginBottom: 4 }}>
                  {locationData.product.type}
                </span>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>{locationData.product.name}</h3>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Code: <strong>{locationData.product.code}</strong></span>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <span className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>Total Available Inventory</span>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-success)', lineHeight: 1 }}>
                {locationData.total_quantity}
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: 6 }}>
                  {locationData.product.unit}
                </span>
              </div>
            </div>
          </div>

          {/* Location details */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={18} className="text-primary" />
                <span>Storage Coordinates Map</span>
              </div>
            </div>

            {locationData.locations.length === 0 ? (
              <div className="empty-state">
                <Map size={40} />
                <h3>Product Out of Stock</h3>
                <p>There is currently no inventory of this item stored in any warehouse location.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Warehouse</th>
                      <th>Location / Address</th>
                      <th>Section</th>
                      <th style={{ textAlign: 'right' }}>Stored Quantity</th>
                      <th>Coordinates Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locationData.locations.map((loc, idx) => (
                      <tr key={idx}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                            <span style={{ fontSize: 16 }}>🏢</span>
                            {loc.warehouse_name}
                          </div>
                        </td>
                        <td>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{loc.warehouse_location}</span>
                        </td>
                        <td>
                          {loc.section_name ? (
                            <span className="badge badge-gray" style={{ fontSize: 12 }}>
                              📂 {loc.section_name}
                            </span>
                          ) : (
                            <span style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: 12 }}>
                              Open Area
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {loc.quantity} {locationData.product.unit}
                        </td>
                        <td>
                          <span className="badge badge-green">Occupied</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <MapPin size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <h3>Select a Product to Begin</h3>
          <p>The location finder will scan all sections in all active warehouses and map current shelf quantities.</p>
        </div>
      )}
    </div>
  );
}
