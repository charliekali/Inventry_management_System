import { useState, useEffect } from 'react';
import { stockAPI } from '../api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { 
  Warehouse, 
  AlertTriangle, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  BarChart3, 
  MapPin 
} from 'lucide-react';

export default function WarehouseDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    stockAPI.warehouseDashboard()
      .then(r => setData(r.data.data))
      .catch(() => toast.error('Failed to load warehouse dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="loading-spinner"></div></div>;
  if (!data) return null;

  const { kpis, warehouses, lowStockItems, recentTransactions } = data;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Warehouse Management Dashboard</h2>
          <p>Monitor warehouse occupancy, stock distribution, incoming/outgoing volume, and critical safety levels.</p>
        </div>
        <div className="page-header-right" style={{ display: 'flex', gap: 12 }}>
          <Link to="/stock-in" className="btn btn-primary btn-sm">
            <ArrowDownCircle size={15} /> Stock IN
          </Link>
          <Link to="/stock-out" className="btn btn-secondary btn-sm">
            <ArrowUpCircle size={15} /> Stock OUT
          </Link>
          <Link to="/stock-balance" className="btn btn-secondary btn-sm">
            <BarChart3 size={15} /> Stock Balance
          </Link>
          <Link to="/locate" className="btn btn-secondary btn-sm">
            <MapPin size={15} /> Find Location
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: 28 }}>
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><Warehouse size={20} color="#3b82f6"/></div>
          <div className="kpi-value">{kpis.totalStockQty?.toLocaleString()}</div>
          <div className="kpi-label">Total Stock Units</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-icon green"><TrendingUp size={20} color="#10b981"/></div>
          <div className="kpi-value">{kpis.todayIN?.toLocaleString()}</div>
          <div className="kpi-label">Today's Stock IN</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-icon orange"><TrendingDown size={20} color="#f59e0b"/></div>
          <div className="kpi-value">{kpis.todayOUT?.toLocaleString()}</div>
          <div className="kpi-label">Today's Stock OUT</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-icon red"><AlertTriangle size={20} color="#ef4444"/></div>
          <div className="kpi-value">{kpis.lowStockCount}</div>
          <div className="kpi-label">Low Stock Alerts</div>
        </div>
        <div className="kpi-card cyan">
          <div className="kpi-icon cyan"><Warehouse size={20} color="#06b6d4"/></div>
          <div className="kpi-value">{kpis.totalWarehouses}</div>
          <div className="kpi-label">Active Warehouses</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="responsive-grid-equal-2" style={{ marginBottom: 28 }}>
        
        {/* Warehouse Capacities */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Warehouse Stock Levels</div>
              <div className="card-subtitle">Total stock quantity stored by warehouse</div>
            </div>
            <Warehouse size={18} color="var(--color-text-muted)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {warehouses.map((w, i) => (
              <div key={i} style={{
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '12px',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)'
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{w.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{w.location}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-primary)' }}>
                    {w.total_stock?.toLocaleString()} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>units</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Panel */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Critical Stock Alerts</div>
              <div className="card-subtitle">Items at or below safety levels</div>
            </div>
            <AlertTriangle size={18} color="var(--color-danger)" />
          </div>
          {lowStockItems.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
              <p style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>All stocks are healthy</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No items require immediate reorder.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '280px', overflowY: 'auto', paddingRight: 4 }}>
              {lowStockItems.map((item, i) => {
                const pct = item.min_stock > 0 ? Math.min((item.total_qty / item.min_stock) * 100, 100) : 100;
                return (
                  <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          [{item.code}] {item.name}
                        </span>
                        <span className="badge badge-gray" style={{ marginLeft: 8, fontSize: 10 }}>
                          {item.type === 'RAW_MATERIAL' ? 'RM' : 'FG'}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--color-danger)', fontWeight: 700 }}>
                        {item.total_qty} / {item.min_stock} {item.unit}
                      </span>
                    </div>
                    <div className="progress-bar" style={{ height: 6 }}>
                      <div className="progress-bar-fill red" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Stock Transactions */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Recent Stock Transactions</div>
            <div className="card-subtitle">Latest stock movements across all warehouses</div>
          </div>
          <Activity size={18} color="var(--color-text-muted)" />
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>GR Number</th>
                <th>Type</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Warehouse</th>
                <th>Doc Reference</th>
                <th>Operator</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>
                    No stock transactions found.
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{tx.gr_number}</td>
                    <td>
                      <span className={tx.type === 'IN' ? 'stock-in-pill' : 'stock-out-pill'}>
                        {tx.type}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{tx.product_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{tx.product_code}</div>
                    </td>
                    <td style={{ fontWeight: 700, color: tx.type === 'IN' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {tx.type === 'IN' ? '+' : '-'}{tx.quantity} {tx.unit}
                    </td>
                    <td>{tx.warehouse_name}{tx.section_name ? ` › ${tx.section_name}` : ''}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--color-bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>
                        {tx.reference_doc || 'N/A'}
                      </span>
                    </td>
                    <td>{tx.performed_by_name}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{tx.transaction_date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
