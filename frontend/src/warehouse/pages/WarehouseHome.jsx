import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { stockAPI } from '../../api';
import toast from 'react-hot-toast';
import { 
  Warehouse, ArrowDownCircle, ArrowUpCircle, AlertTriangle, 
  MapPin, RefreshCw, BarChart3, ChevronRight, Activity, Camera, Truck
} from 'lucide-react';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function WarehouseHome() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    stockAPI.warehouseDashboard()
      .then(r => setData(r.data.data))
      .catch(() => toast.error('Failed to load warehouse dashboard'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="w-spinner-wrap">
        <div className="w-spinner" />
      </div>
    );
  }

  if (!data) return null;

  const { kpis, warehouses, lowStockItems } = data;
  const firstName = user?.name?.split(' ')?.[0] || 'Keeper';

  return (
    <div className="w-page w-fade-in">
      {/* Greeting */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800 }}>{getGreeting()}, {firstName}! 📦</h3>
          <p style={{ fontSize: 12, color: 'var(--w-text-2)', marginTop: 4 }}>
            {kpis.lowStockCount > 0 
              ? `⚠️ ${kpis.lowStockCount} items are currently below safety level` 
              : "✅ All inventory items are well-stocked"}
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className="w-kpi-row">
        <div className="w-kpi blue">
          <div className="w-kpi-icon blue"><BarChart3 size={16} color="#2563eb" /></div>
          <div className="w-kpi-val sm">{kpis.totalStockQty?.toLocaleString()}</div>
          <div className="w-kpi-label">Total Stock</div>
        </div>
        <div className="w-kpi green">
          <div className="w-kpi-icon green"><ArrowDownCircle size={16} color="#10b981" /></div>
          <div className="w-kpi-val sm">+{kpis.todayIN?.toLocaleString()}</div>
          <div className="w-kpi-label">Today's IN</div>
        </div>
        <div className="w-kpi orange">
          <div className="w-kpi-icon orange"><ArrowUpCircle size={16} color="#f59e0b" /></div>
          <div className="w-kpi-val sm">-{kpis.todayOUT?.toLocaleString()}</div>
          <div className="w-kpi-label">Today's OUT</div>
        </div>
        <div className="w-kpi red">
          <div className="w-kpi-icon red"><AlertTriangle size={16} color="#ef4444" /></div>
          <div className="w-kpi-val sm">{kpis.lowStockCount}</div>
          <div className="w-kpi-label">Alerts</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="w-section-label">Quick Actions</div>
      <div className="w-quick-actions">
        <button className="w-qa-btn" onClick={() => navigate('/warehouse/scan')}>
          <div className="w-qa-icon" style={{ background: 'rgba(168,85,247,0.15)' }}>
            <Camera size={20} color="#a855f7" />
          </div>
          <span className="w-qa-label">Scan QR</span>
        </button>
        <button className="w-qa-btn" onClick={() => navigate('/warehouse/stock-in')}>
          <div className="w-qa-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>
            <ArrowDownCircle size={20} color="#10b981" />
          </div>
          <span className="w-qa-label">Stock IN (GR)</span>
        </button>
        <button className="w-qa-btn" onClick={() => navigate('/warehouse/stock-out')}>
          <div className="w-qa-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>
            <ArrowUpCircle size={20} color="#ef4444" />
          </div>
          <span className="w-qa-label">Stock OUT</span>
        </button>
        <button className="w-qa-btn" onClick={() => navigate('/warehouse/find')}>
          <div className="w-qa-icon" style={{ background: 'rgba(6,182,212,0.15)' }}>
            <MapPin size={20} color="#06b6d4" />
          </div>
          <span className="w-qa-label">Find Shelf</span>
        </button>
        {hasPermission('DISPATCH:VIEW') && (
          <button className="w-qa-btn" onClick={() => navigate('/warehouse/logistics-dispatch')}>
            <div className="w-qa-icon" style={{ background: 'rgba(6,182,212,0.15)' }}>
              <Truck size={20} color="#06b6d4" />
            </div>
            <span className="w-qa-label">Logistics</span>
          </button>
        )}
      </div>

      {/* Warehouse Stock Levels */}
      <div className="w-section-label">Warehouse Stock Levels</div>
      <div className="w-card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {warehouses.map((w, idx) => (
            <div key={idx} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--w-border)',
              borderRadius: 'var(--w-radius-sm)'
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{w.name}</div>
                <div style={{ fontSize: 11, color: 'var(--w-text-2)', marginTop: 2 }}>{w.location}</div>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--w-primary)' }}>{w.total_stock?.toLocaleString()} units</div>
            </div>
          ))}
        </div>
      </div>

      {/* Critical Reorder Alerts */}
      {lowStockItems.length > 0 && (
        <>
          <div className="w-section-label">🚨 Safety Reorder Alerts</div>
          <div className="w-card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {lowStockItems.slice(0, 5).map((item, idx) => {
                const pct = item.min_stock > 0 ? Math.min((item.total_qty / item.min_stock) * 100, 100) : 100;
                return (
                  <div key={idx} style={{ paddingBottom: idx < 4 ? 8 : 0, borderBottom: idx < 4 ? '1px solid var(--w-border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{item.name} <span style={{ fontSize: 10, color: 'var(--w-text-3)' }}>({item.code})</span></span>
                      <span className="w-text-danger" style={{ fontWeight: 700 }}>{item.total_qty}/{item.min_stock} {item.unit}</span>
                    </div>
                    <div className="w-progress" style={{ height: 5 }}>
                      <div className="w-progress-fill red" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {lowStockItems.length > 5 && (
                <button 
                  className="w-btn ghost sm"
                  style={{ width: '100%', marginTop: 4 }}
                  onClick={() => navigate('/warehouse/balance')}
                >
                  View all reorder alerts
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
