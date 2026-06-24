import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { productsAPI, stockAPI, warehousesAPI } from '../../api';
import toast from 'react-hot-toast';
import { MapPin, Search, Grid, Info, Warehouse, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export default function WarehouseFind() {
  const navigate = useNavigate();
  const location = useLocation();

  // Tab State: 'explore' (Visual Grid Explorer) or 'product' (Product Shelf Finder)
  const [activeTab, setActiveTab] = useState('explore');

  // Explore Tab State
  const [warehouses, setWarehouses] = useState([]);
  const [loadingWhs, setLoadingWhs] = useState(true);
  const [selectedWhId, setSelectedWhId] = useState('');
  const [sections, setSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [selectedSecId, setSelectedSecId] = useState('');
  const [whBalances, setWhBalances] = useState([]);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Product Locator Tab State
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [locationData, setLocationData] = useState(null);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Load Initial Lists
  useEffect(() => {
    // Load warehouses for explore tab
    warehousesAPI.list()
      .then(res => setWarehouses(res.data.data || []))
      .catch(() => toast.error('Failed to load warehouses list'))
      .finally(() => setLoadingWhs(false));

    // Load products for search tab
    productsAPI.list({ active: true })
      .then(res => setProducts(res.data.data || []))
      .catch(() => toast.error('Failed to load products list'))
      .finally(() => setLoadingProducts(false));
  }, []);

  // Handle Route State redirects (e.g. from Scan QR)
  useEffect(() => {
    if (location.state?.warehouseId) {
      setActiveTab('explore');
      setSelectedWhId(location.state.warehouseId);
      if (location.state?.sectionId) {
        setSelectedSecId(location.state.sectionId);
      } else {
        setSelectedSecId('open_area');
      }
    }
  }, [location.state]);

  // Load Sections and Stock Balances when Warehouse is Selected
  useEffect(() => {
    if (!selectedWhId) {
      setSections([]);
      setWhBalances([]);
      return;
    }

    setLoadingSections(true);
    setLoadingBalances(true);

    warehousesAPI.sections(selectedWhId)
      .then(res => {
        setSections(res.data.data || []);
      })
      .catch(() => toast.error('Failed to load shelf sections'))
      .finally(() => setLoadingSections(false));

    stockAPI.balance({ warehouse_id: selectedWhId })
      .then(res => {
        setWhBalances(res.data.data || []);
      })
      .catch(() => toast.error('Failed to load warehouse inventory'))
      .finally(() => setLoadingBalances(false));
  }, [selectedWhId]);

  // Filter balances based on selected section
  const getFilteredBalances = () => {
    if (!selectedSecId) return [];
    if (selectedSecId === 'open_area') {
      return whBalances.filter(b => b.section_id === null || b.section_id === undefined);
    }
    return whBalances.filter(b => String(b.section_id) === String(selectedSecId));
  };

  const filteredBalances = getFilteredBalances();
  const selectedWh = warehouses.find(w => String(w.id) === String(selectedWhId));
  const selectedSecName = selectedSecId === 'open_area' 
    ? 'Open Area (No shelf)' 
    : sections.find(s => String(s.id) === String(selectedSecId))?.name || '';

  // Original Product Locator lookup
  useEffect(() => {
    if (!selectedProductId) {
      setLocationData(null);
      return;
    }

    setLoadingLocations(true);
    stockAPI.locate(selectedProductId)
      .then(res => setLocationData(res.data.data))
      .catch(() => toast.error('Failed to look up stock locations'))
      .finally(() => setLoadingLocations(false));
  }, [selectedProductId]);

  const handleWarehouseSelect = (id) => {
    setSelectedWhId(id);
    setSelectedSecId(''); // Reset section when warehouse changes
  };

  const handleSectionSelect = (id) => {
    setSelectedSecId(id);
  };

  return (
    <div className="w-page w-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <MapPin size={22} color="var(--w-primary)" />
        <h3 style={{ fontSize: 16, fontWeight: 800 }}>Shelf Location & Finder</h3>
      </div>

      {/* Segmented Tab Row */}
      <div className="w-tab-row" style={{ borderRadius: 'var(--w-radius)', overflow: 'hidden' }}>
        <button
          className={`w-tab-btn ${activeTab === 'explore' ? 'active' : ''}`}
          onClick={() => setActiveTab('explore')}
        >
          <Grid size={14} style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'text-bottom' }} />
          Explore Places
        </button>
        <button
          className={`w-tab-btn ${activeTab === 'product' ? 'active' : ''}`}
          onClick={() => setActiveTab('product')}
        >
          <Search size={14} style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'text-bottom' }} />
          Locate Product
        </button>
      </div>

      {/* EXPLORE PLACES TAB */}
      {activeTab === 'explore' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Warehouse Selector Grid */}
          <div>
            <div className="w-explore-title">🏢 Select Warehouse Place</div>
            {loadingWhs ? (
              <div className="w-spinner-wrap"><div className="w-spinner" /></div>
            ) : (
              <div className="w-grid">
                {warehouses.map(wh => (
                  <button
                    key={wh.id}
                    className={`w-grid-btn ${selectedWhId === wh.id ? 'active' : ''}`}
                    onClick={() => handleWarehouseSelect(wh.id)}
                  >
                    <Warehouse size={18} />
                    <div style={{ marginTop: 2 }}>{wh.name}</div>
                    <small>{wh.location || 'No address'}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Section Selector Grid */}
          {selectedWhId && (
            <div>
              <div className="w-explore-title">📍 Select Shelf / Section</div>
              {loadingSections ? (
                <div className="w-spinner-wrap"><div className="w-spinner" /></div>
              ) : (
                <div className="w-grid">
                  {/* Append Open Area option */}
                  <button
                    className={`w-grid-btn ${selectedSecId === 'open_area' ? 'active' : ''}`}
                    onClick={() => handleSectionSelect('open_area')}
                  >
                    <MapPin size={16} />
                    <div>Open Area</div>
                    <small>No specific shelf</small>
                  </button>

                  {sections.map(sec => (
                    <button
                      key={sec.id}
                      className={`w-grid-btn ${selectedSecId === sec.id ? 'active' : ''}`}
                      onClick={() => handleSectionSelect(sec.id)}
                    >
                      <MapPin size={16} />
                      <div>{sec.name}</div>
                      <small>Shelf Section</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section Items Display */}
          {selectedWhId && selectedSecId && (
            <div style={{ marginTop: 8 }}>
              <div className="w-explore-title">📦 Current Shelf Inventory ({selectedSecName})</div>

              {loadingBalances ? (
                <div className="w-spinner-wrap"><div className="w-spinner" /></div>
              ) : filteredBalances.length === 0 ? (
                <div className="w-card w-empty" style={{ padding: 24 }}>
                  <Info size={20} style={{ opacity: 0.5 }} />
                  <p className="title">Empty Shelf Section</p>
                  <p className="sub">There are no products currently stored in this location.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {filteredBalances.map((item) => (
                    <div key={item.id} className="w-card w-card-padded" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{item.product_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--w-text-2)', marginTop: 4 }}>
                            Code: <span style={{ color: 'var(--w-text)' }}>{item.product_code}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--w-primary)' }}>
                            {item.quantity} {item.product_unit}
                          </div>
                          <div style={{ fontSize: 9.5, color: 'var(--w-text-3)', marginTop: 4 }}>
                            Updated: {item.updated_at ? item.updated_at.substring(0, 10) : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Shelf Quick Transaction Shortcuts */}
              {!loadingBalances && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                  <button
                    className="w-btn ghost"
                    style={{ padding: '12px', fontSize: 13, gap: 5 }}
                    onClick={() => navigate('/warehouse/stock-in', {
                      state: {
                        warehouseId: selectedWhId,
                        sectionId: selectedSecId === 'open_area' ? '' : selectedSecId
                      }
                    })}
                  >
                    <ArrowDownCircle size={15} color="#10b981" />
                    Stock IN Here
                  </button>

                  <button
                    className="w-btn ghost"
                    style={{ padding: '12px', fontSize: 13, gap: 5 }}
                    onClick={() => navigate('/warehouse/stock-out', {
                      state: {
                        warehouseId: selectedWhId,
                        sectionId: selectedSecId === 'open_area' ? '' : selectedSecId
                      }
                    })}
                  >
                    <ArrowUpCircle size={15} color="#ef4444" />
                    Stock OUT Here
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* LOCATE PRODUCT TAB */}
      {activeTab === 'product' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Select Product */}
          <div className="w-card w-card-padded">
            <div className="w-form-group" style={{ marginBottom: 0 }}>
              <label className="w-label">Select Product to Locate</label>
              {loadingProducts ? (
                <div className="w-spinner-wrap"><div className="w-spinner" /></div>
              ) : (
                <select
                  className="w-select"
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                >
                  <option value="">-- Select Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Locations Panel */}
          {loadingLocations ? (
            <div className="w-spinner-wrap"><div className="w-spinner" /></div>
          ) : selectedProductId && locationData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Header Summary */}
              <div className="w-card w-card-padded" style={{ background: 'linear-gradient(135deg, var(--w-card), rgba(37,99,235,0.03))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 800 }}>{locationData.product.name}</h4>
                    <div style={{ fontSize: 11, color: 'var(--w-text-2)', marginTop: 4 }}>
                      Code: {locationData.product.code} · Type: {locationData.product.type}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--w-primary)' }}>
                      {locationData.total_quantity} {locationData.product.unit}
                    </div>
                    <div style={{ fontSize: 9.5, color: 'var(--w-text-3)', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>
                      Total In Stock
                    </div>
                  </div>
                </div>
              </div>

              {/* Locations Grid */}
              <div className="w-section-label" style={{ marginTop: 0 }}>Storage Layout Shelves</div>
              {locationData.locations.length === 0 ? (
                <div className="w-card w-empty" style={{ padding: 30 }}>
                  <MapPin size={24} style={{ opacity: 0.5 }} />
                  <p className="title">Not Stored Anywhere</p>
                  <p className="sub">This product currently has 0.00 quantity in stock.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {locationData.locations.map((loc, idx) => (
                    <div key={idx} className="w-card w-card-padded" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{loc.warehouse_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--w-text-2)', marginTop: 4 }}>
                            Section shelf: <strong style={{ color: 'var(--w-text)' }}>{loc.section_name || 'Open Area'}</strong>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--w-text-3)', marginTop: 6 }}>
                            Location info: {loc.warehouse_location}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--w-success)' }}>
                            {loc.quantity} {locationData.product.unit}
                          </div>
                          <div style={{ fontSize: 9.5, color: 'var(--w-text-3)', marginTop: 4 }}>
                            Updated: {loc.updated_at ? loc.updated_at.substring(0, 10) : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : selectedProductId ? (
            <div style={{ color: 'var(--w-text-3)', fontSize: 13, textAlign: 'center', marginTop: 24 }}>Select a product to view shelf layouts.</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
