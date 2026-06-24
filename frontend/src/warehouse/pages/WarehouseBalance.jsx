import { useState, useEffect } from 'react';
import { stockAPI, warehousesAPI } from '../../api';
import toast from 'react-hot-toast';
import { BarChart3, Search, Filter } from 'lucide-react';

export default function WarehouseBalance() {
  const [balances, setBalances] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedType, setSelectedType] = useState('');

  useEffect(() => {
    Promise.all([
      stockAPI.balance(),
      warehousesAPI.list()
    ])
      .then(([balRes, whRes]) => {
        setBalances(balRes.data.data || []);
        setWarehouses(whRes.data.data || []);
      })
      .catch(() => toast.error('Failed to load stock balance data'))
      .finally(() => setLoading(false));
  }, []);

  const filteredBalances = balances.filter(b => {
    const matchesSearch = b.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.product_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWarehouse = !selectedWarehouseId || b.warehouse_id === selectedWarehouseId;
    const matchesType = !selectedType || b.product_type === selectedType;
    return matchesSearch && matchesWarehouse && matchesType;
  });

  if (loading) {
    return (
      <div className="w-spinner-wrap">
        <div className="w-spinner" />
      </div>
    );
  }

  return (
    <div className="w-page w-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <BarChart3 size={22} color="var(--w-primary)" />
        <h3 style={{ fontSize: 16, fontWeight: 800 }}>Stock Balance Summary</h3>
      </div>

      {/* Controls */}
      <div className="w-card w-card-padded" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <div className="w-search" style={{ marginBottom: 0 }}>
          <Search size={16} className="w-search-icon" />
          <input
            type="text"
            placeholder="Search by code or product name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <select
            className="w-select"
            value={selectedWarehouseId}
            onChange={e => setSelectedWarehouseId(e.target.value)}
            style={{ padding: '8px 10px', fontSize: 13, flex: 1.2 }}
          >
            <option value="">All Warehouses</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          <select
            className="w-select"
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            style={{ padding: '8px 10px', fontSize: 13, flex: 1 }}
          >
            <option value="">All Types</option>
            <option value="RAW_MATERIAL">Raw Material</option>
            <option value="FINISHED_GOOD">Finished Good</option>
          </select>
        </div>
      </div>

      {/* Balances List */}
      {filteredBalances.length === 0 ? (
        <div className="w-card w-empty">
          <BarChart3 size={32} style={{ opacity: 0.5 }} />
          <p className="title">No stock balances found</p>
          <p className="sub">Refine your search or filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredBalances.map((b) => (
            <div key={b.id} className="w-card w-card-padded" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{b.product_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--w-text-2)', marginTop: 4 }}>
                    Code: {b.product_code} · {b.product_type === 'RAW_MATERIAL' ? 'Raw Material' : 'Finished Good'}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span className="w-chip gray" style={{ fontSize: 9.5 }}>
                      📍 {b.warehouse_name} {b.section_name ? ` › ${b.section_name}` : ''}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--w-primary)' }}>
                    {b.quantity} {b.product_unit}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--w-text-3)', marginTop: 4 }}>
                    Min level: {b.min_stock} {b.product_unit}
                  </div>
                  {b.is_low_stock && (
                    <span className="w-chip red" style={{ fontSize: 8, padding: '1px 5px', marginTop: 6 }}>Low Stock</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
