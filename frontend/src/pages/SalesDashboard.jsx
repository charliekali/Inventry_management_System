import { useState, useEffect } from 'react';
import { ordersAPI } from '../api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { 
  ShoppingBag, 
  Clock, 
  CheckCircle, 
  Activity, 
  TrendingUp, 
  AlertCircle, 
  ChevronRight, 
  FileCheck2, 
  PlusCircle, 
  Sparkles,
  Receipt,
  DollarSign,
  CreditCard
} from 'lucide-react';

export default function SalesDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ordersAPI.salesDashboard()
      .then(r => setData(r.data.data))
      .catch(() => toast.error('Failed to load sales dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="loading-spinner"></div></div>;
  if (!data) return null;

  const { kpis, statusCounts, recentOrders, topDemandedProducts, recentInvoices } = data;

  // Filter pending orders requiring attention (not fulfilled)
  const pendingOrdersList = recentOrders.filter(o => o.status !== 'FULFILLED');

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'FULFILLED': return 'badge-green';
      case 'PENDING': return 'badge-orange';
      case 'FEASIBLE': return 'badge-blue';
      case 'PARTIAL': return 'badge-purple';
      case 'INSUFFICIENT': return 'badge-red';
      default: return 'badge-gray';
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Sales & Revenue Dashboard</h2>
          <p>Analyze sales volumes, check demand pipeline, and manage customer order fulfillments.</p>
        </div>
        <div className="page-header-right" style={{ display: 'flex', gap: 12 }}>
          <Link to="/pos" className="btn btn-primary btn-sm" style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}>
            <Sparkles size={15} /> POS Quick Sale
          </Link>
          <Link to="/orders" className="btn btn-primary btn-sm">
            <PlusCircle size={15} /> Create Order
          </Link>
          <Link to="/feasibility" className="btn btn-secondary btn-sm">
            <FileCheck2 size={15} /> Run Feasibility Check
          </Link>
        </div>
      </div>

      {/* Revenue KPI Section */}
      <h3 style={{ marginBottom: 12, marginTop: 8, fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Sales Revenue Performance</h3>
      <div className="kpi-grid" style={{ marginBottom: 28 }}>
        <div className="kpi-card green">
          <div className="kpi-icon green"><DollarSign size={20} color="#10b981"/></div>
          <div className="kpi-value">₹{(kpis.todaySales || 0).toLocaleString('en-IN')}</div>
          <div className="kpi-label">Today's Revenue</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-icon purple"><TrendingUp size={20} color="#8b5cf6"/></div>
          <div className="kpi-value">₹{(kpis.monthSales || 0).toLocaleString('en-IN')}</div>
          <div className="kpi-label">This Month's Revenue</div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><Receipt size={20} color="#3b82f6"/></div>
          <div className="kpi-value">₹{(kpis.allTimeSales || 0).toLocaleString('en-IN')}</div>
          <div className="kpi-label">All-Time Revenue</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-icon orange"><ShoppingBag size={20} color="#f59e0b"/></div>
          <div className="kpi-value">{kpis.todayOrderCount || 0}</div>
          <div className="kpi-label">Orders Today</div>
        </div>
        <div className="kpi-card cyan">
          <div className="kpi-icon cyan"><CreditCard size={20} color="#06b6d4"/></div>
          <div className="kpi-value">{kpis.posOrderCount || 0}</div>
          <div className="kpi-label">POS Sales Count</div>
        </div>
      </div>

      {/* Operational KPI Section */}
      <h3 style={{ marginBottom: 12, fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Order & Production Operations</h3>
      <div className="kpi-grid" style={{ marginBottom: 28 }}>
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><ShoppingBag size={20} color="#3b82f6"/></div>
          <div className="kpi-value">{kpis.totalOrders}</div>
          <div className="kpi-label">Total Orders</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-icon orange"><Clock size={20} color="#f59e0b"/></div>
          <div className="kpi-value">{kpis.pendingOrders}</div>
          <div className="kpi-label">Active/Pending Orders</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-icon green"><CheckCircle size={20} color="#10b981"/></div>
          <div className="kpi-value">{kpis.fulfilledOrders}</div>
          <div className="kpi-label">Fulfilled Orders</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-icon purple"><Activity size={20} color="#8b5cf6"/></div>
          <div className="kpi-value">{kpis.activeProductionOrders}</div>
          <div className="kpi-label">Active Prod. Runs</div>
        </div>
        <div className="kpi-card cyan">
          <div className="kpi-icon cyan"><TrendingUp size={20} color="#06b6d4"/></div>
          <div className="kpi-value">{kpis.totalPendingItemsQty?.toLocaleString()}</div>
          <div className="kpi-label">Pending Order Qty</div>
        </div>
      </div>

      {/* Grid: Order Status breakdown & Top demanded products */}
      <div className="responsive-grid-equal-2" style={{ marginBottom: 28 }}>
        {/* Order Status Breakdown */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Order Status Breakdown</div>
              <div className="card-subtitle">Distribution of orders by state</div>
            </div>
            <Sparkles size={18} color="var(--color-primary)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(statusCounts).map(([status, count]) => {
              const total = kpis.totalOrders || 1;
              const pct = Math.round((count / total) * 100);
              let barColor = 'blue';
              if (status === 'FULFILLED') barColor = 'green';
              if (status === 'PENDING') barColor = 'orange';
              if (status === 'INSUFFICIENT') barColor = 'red';
              if (status === 'PARTIAL') barColor = 'purple';

              return (
                <div key={status}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                    <span style={{ color: 'var(--color-text-primary)' }}>{status}</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{count} ({pct}%)</span>
                  </div>
                  <div className="progress-bar" style={{ height: 8 }}>
                    <div className={`progress-bar-fill ${barColor}`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Demanded Products */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Top Products in Demand</div>
              <div className="card-subtitle">Most requested finished goods in pipeline</div>
            </div>
            <TrendingUp size={18} color="var(--color-success)" />
          </div>
          {topDemandedProducts.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
              <p style={{ fontWeight: 600 }}>No active demand</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>All current sales orders have been fulfilled.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Code</th>
                    <th>Required Qty</th>
                    <th>Orders Count</th>
                  </tr>
                </thead>
                <tbody>
                  {topDemandedProducts.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace' }}>{p.code}</span>
                      </td>
                      <td style={{ fontWeight: 700 }}>{p.total_qty?.toLocaleString()} {p.unit}</td>
                      <td>
                        <span className="badge badge-gray">{p.order_count} orders</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Row: Recent Invoices */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Recent Invoices Generated</div>
            <div className="card-subtitle">Latest invoice documents issued on order fulfillment</div>
          </div>
          <Link to="/orders" className="btn btn-secondary btn-sm">View All Orders</Link>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Order Number</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Payment Mode</th>
                <th>Grand Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!recentInvoices || recentInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>
                    No invoices generated yet. Fulfill an order to generate an invoice.
                  </td>
                </tr>
              ) : (
                recentInvoices.map((inv, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, color: 'var(--color-success)' }}>{inv.invoice_number}</td>
                    <td style={{ fontWeight: 600 }}>{inv.order_number}</td>
                    <td>{inv.customer}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                      {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      }) : 'N/A'}
                    </td>
                    <td>
                      <span className="badge badge-gray">{inv.payment_mode || 'N/A'}</span>
                    </td>
                    <td style={{ fontWeight: 700 }}>₹{(inv.grand_total || 0).toLocaleString('en-IN')}</td>
                    <td>
                      <Link to={`/invoice/${inv.id}`} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }}>
                        View Invoice
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row: Pending Orders Requiring Attention */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Pending Orders Requiring Attention</div>
            <div className="card-subtitle">Unfulfilled orders with status highlights</div>
          </div>
          <AlertCircle size={18} color="var(--color-warning)" />
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Customer</th>
                <th>Items Count</th>
                <th>Created By</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingOrdersList.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>
                    No pending orders require attention. Good job!
                  </td>
                </tr>
              ) : (
                pendingOrdersList.map((o, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{o.order_number}</td>
                    <td>{o.customer}</td>
                    <td style={{ fontWeight: 600 }}>{o.item_count} items</td>
                    <td>{o.created_by_name}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{o.created_at}</td>
                    <td>
                      <Link to="/orders" className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }}>
                        Manage <ChevronRight size={14} />
                      </Link>
                    </td>
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
