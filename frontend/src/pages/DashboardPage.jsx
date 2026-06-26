import { useState, useEffect } from 'react';
import { stockAPI, ordersAPI } from '../api';
import toast from 'react-hot-toast';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Capacitor } from '@capacitor/core';
import { Warehouse, Package, TrendingUp, TrendingDown, AlertTriangle, Activity, Factory, ShoppingBag, ChevronRight, KeyRound } from 'lucide-react';

function fmtCurrency(val) {
  return '₹' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDateShort(iso) {
  if (!iso) return '—';
  return iso.replace('T', ' ').substring(0, 16);
}

export default function DashboardPage() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const isApk = Capacitor.isNativePlatform();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    if (user && user.role === 'Super Admin' && !isApk) {
      setLoading(true);
      Promise.all([
        stockAPI.dashboard(),
        ordersAPI.list()
      ])
      .then(([stockRes, ordersRes]) => {
        setData(stockRes.data.data);
        const ordersList = ordersRes.data.data || [];
        // Extract customer names that have generated invoices
        const invoicedCustomers = new Set(
          ordersList.filter(item => item.invoice_number && !item.invoice_number.startsWith('ORD-')).map(item => item.customer)
        );
        // New leads are PENDING orders with no invoice generated AND whose customer has no active invoices
        const prospects = ordersList.filter(
          item => item.status === 'PENDING' && !invoicedCustomers.has(item.customer)
        );
        setLeads(prospects);
      })
      .catch(() => toast.error('Failed to load dashboard data'))
      .finally(() => setLoading(false));
    }
  }, [user]);

  // Smart Redirection based on role/permissions
  if (user && user.role !== 'Super Admin') {
    const hasStock = hasPermission('STOCK:VIEW') || hasPermission('TRANSACTIONS:STOCK_IN') || hasPermission('WAREHOUSES:VIEW');
    const hasOrders = hasPermission('ORDERS:VIEW');

    // Pure sales / CRM role → dedicated CRM workspace
    if (hasOrders && !hasStock) {
      return <Navigate to="/sales" replace />;
    }

    // Dedicated production role
    if (user.role.toLowerCase().includes('production') && hasStock) {
      return <Navigate to="/production" replace />;
    }

    // Dedicated warehouse / keeper role
    if ((user.role.toLowerCase().includes('warehouse') || user.role.toLowerCase().includes('keeper')) && hasStock) {
      return <Navigate to="/warehouse" replace />;
    }

    // General fallback for stock roles
    if (hasStock) {
      return <Navigate to="/warehouse" replace />;
    }

    // Mixed (orders + stock but not Super Admin)
    if (hasOrders) {
      return <Navigate to="/dashboard/sales" replace />;
    }
  }

  if (isApk && user && user.role === 'Super Admin') {
    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 480, margin: '0 auto', padding: '12px 4px' }}>
        <div style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--color-text-primary)' }}>IMS Workspace Hub</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>Welcome back, Super Admin. Choose a dashboard to manage.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Warehouse Card */}
          <div 
            onClick={() => navigate('/warehouse')}
            className="kpi-card green"
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 16, 
              padding: '18px 16px', 
              cursor: 'pointer',
              border: '1px solid var(--color-border)',
              margin: 0
            }}
          >
            <div className="kpi-icon green" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, margin: 0 }}>
              <Warehouse size={22} color="#10b981" />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)' }}>Warehouse App</h4>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Manage stock counts, sections, and locations</p>
            </div>
            <ChevronRight size={18} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
          </div>

          {/* Production Card */}
          <div 
            onClick={() => navigate('/production')}
            className="kpi-card purple"
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 16, 
              padding: '18px 16px', 
              cursor: 'pointer',
              border: '1px solid var(--color-border)',
              margin: 0
            }}
          >
            <div className="kpi-icon purple" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, margin: 0 }}>
              <Factory size={22} color="#8b5cf6" />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)' }}>Production App</h4>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Track production runs, yields, and recipes</p>
            </div>
            <ChevronRight size={18} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
          </div>

          {/* Sales Card */}
          <div 
            onClick={() => navigate('/sales')}
            className="kpi-card blue"
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 16, 
              padding: '18px 16px', 
              cursor: 'pointer',
              border: '1px solid var(--color-border)',
              margin: 0
            }}
          >
            <div className="kpi-icon blue" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, margin: 0 }}>
              <ShoppingBag size={22} color="#3b82f6" />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)' }}>Sales App</h4>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>View POS orders, invoices, collections & CRM</p>
            </div>
            <ChevronRight size={18} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
          </div>

          {/* Key Registry Card */}
          <div 
            onClick={() => navigate('/key-registry')}
            className="kpi-card orange"
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 16, 
              padding: '18px 16px', 
              cursor: 'pointer',
              border: '1px solid var(--color-border)',
              margin: 0
            }}
          >
            <div className="kpi-icon orange" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, margin: 0 }}>
              <KeyRound size={22} color="#f59e0b" />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)' }}>Key Registry</h4>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Approve key checkouts, returns & view catalogue</p>
            </div>
            <ChevronRight size={18} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
          </div>

          {/* Log Out Button */}
          <button
            onClick={async () => {
              try {
                await logout();
                toast.success('Logged out successfully');
                navigate('/login');
              } catch {
                toast.error('Logout failed');
              }
            }}
            className="btn btn-danger"
            style={{ 
              marginTop: 12,
              width: '100%', 
              justifyContent: 'center',
              padding: '14px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: 14.5,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

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

      {/* Prospective Leads Tracker Card */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Prospective Leads Tracker</div>
            <div className="card-subtitle">Active targets with no invoices generated yet</div>
          </div>
          <span className="badge badge-purple" style={{ fontWeight: 700 }}>{leads.length} Pending</span>
        </div>
        {leads.length === 0 ? (
          <div className="empty-state" style={{ padding: 30 }}>
            <p>No active prospective leads at the moment</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Customer/Company</th>
                  <th>Contact Info</th>
                  <th>Estimated Value</th>
                  <th>Added By</th>
                  <th>Date Added</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {leads.slice(0, 5).map((lead) => (
                  <tr key={lead.id}>
                    <td style={{ fontWeight: 700 }}>{lead.customer}</td>
                    <td style={{ fontSize: 12 }}>
                      {lead.custom_fields?.phone && <div>📞 {lead.custom_fields.phone}</div>}
                      {lead.custom_fields?.email && <div>✉ {lead.custom_fields.email}</div>}
                      {!lead.custom_fields?.phone && !lead.custom_fields?.email && <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No Contact Info</span>}
                    </td>
                    <td style={{ fontWeight: 700, color: '#f59e0b' }}>
                      {fmtCurrency(lead.grand_total)}
                    </td>
                    <td>
                      <span className="badge badge-purple" style={{ fontSize: 11 }}>👤 {lead.created_by_name || 'System'}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{fmtDateShort(lead.created_at)}</td>
                    <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.remarks}>
                      {lead.remarks || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
