import { useState, useEffect } from 'react';
import { stockAPI } from '../api';
import toast from 'react-hot-toast';
import { Warehouse, Package, TrendingUp, TrendingDown, AlertTriangle, Activity } from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    stockAPI.dashboard()
      .then(r => setData(r.data.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="loading-spinner"></div></div>;
  if (!data) return null;

  const { kpis, lowStockItems, recentTransactions } = data;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Dashboard</h2>
          <p>Real-time inventory overview for all warehouses</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: 28 }}>
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><Warehouse size={20} color="#60a5fa"/></div>
          <div className="kpi-value">{kpis.totalWarehouses}</div>
          <div className="kpi-label">Active Warehouses</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-icon green"><Package size={20} color="#10b981"/></div>
          <div className="kpi-value">{kpis.totalFG}</div>
          <div className="kpi-label">Finished Goods</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-icon purple"><Package size={20} color="#8b5cf6"/></div>
          <div className="kpi-value">{kpis.totalRM}</div>
          <div className="kpi-label">Raw Materials</div>
        </div>
        <div className="kpi-card cyan">
          <div className="kpi-icon cyan"><TrendingUp size={20} color="#06b6d4"/></div>
          <div className="kpi-value">{kpis.todayIN?.toLocaleString()}</div>
          <div className="kpi-label">Today Stock IN</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-icon orange"><TrendingDown size={20} color="#f59e0b"/></div>
          <div className="kpi-value">{kpis.todayOUT?.toLocaleString()}</div>
          <div className="kpi-label">Today Stock OUT</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-icon red"><AlertTriangle size={20} color="#ef4444"/></div>
          <div className="kpi-value">{kpis.lowStockCount}</div>
          <div className="kpi-label">Low Stock Alerts</div>
        </div>
      </div>

      <div className="responsive-grid-equal-2">
        {/* Recent Transactions */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Transactions</div>
              <div className="card-subtitle">Latest stock movements</div>
            </div>
            <Activity size={18} color="var(--color-text-muted)" />
          </div>
          {recentTransactions.length === 0 ? (
            <div className="empty-state" style={{padding:30}}>
              <Activity size={32}/>
              <p>No transactions yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentTransactions.map((tx, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: i < recentTransactions.length - 1 ? '1px solid var(--color-border)' : 'none'
                }}>
                  <span className={tx.type === 'IN' ? 'stock-in-pill' : 'stock-out-pill'}>
                    {tx.type === 'IN' ? '↓' : '↑'} {tx.type}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      [{tx.product_code}] {tx.product_name}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                      {tx.warehouse_name}{tx.section_name ? ` › ${tx.section_name}` : ''} · {tx.performed_by_name}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: tx.type === 'IN' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {tx.type === 'IN' ? '+' : '-'}{tx.quantity} {tx.unit}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{tx.transaction_date}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Low Stock Alerts</div>
              <div className="card-subtitle">Items at or below minimum level</div>
            </div>
            <AlertTriangle size={18} color="var(--color-warning)" />
          </div>
          {lowStockItems.length === 0 ? (
            <div className="empty-state" style={{padding:30}}>
              <div style={{fontSize:32}}>✅</div>
              <p>All items are well-stocked!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lowStockItems.map((item, i) => {
                const pct = item.min_stock > 0 ? Math.min((item.total_qty / item.min_stock) * 100, 100) : 100;
                return (
                  <div key={i} style={{ padding: '10px 0', borderBottom: i < lowStockItems.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          [{item.code}] {item.name}
                        </span>
                      </div>
                      <span style={{ fontSize: 12.5, color: 'var(--color-danger)', fontWeight: 700 }}>
                        {item.total_qty} / {item.min_stock} {item.unit}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill red" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
