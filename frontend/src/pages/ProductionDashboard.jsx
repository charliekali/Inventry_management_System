import { useState, useEffect } from 'react';
import { stockAPI } from '../api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { 
  Package, 
  AlertTriangle, 
  Activity, 
  Boxes, 
  Layers, 
  ClipboardList, 
  CheckCircle2,
  Factory,
  History,
  LineChart,
  ListPlus
} from 'lucide-react';

export default function ProductionDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    stockAPI.productionDashboard()
      .then(r => setData(r.data.data))
      .catch(() => toast.error('Failed to load production dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="loading-spinner"></div></div>;
  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <AlertTriangle size={48} color="var(--color-warning)" />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>Failed to load production dashboard</h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0, maxWidth: 400 }}>
          Could not establish connection with the API server. Please check your network or try again.
        </p>
        <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ marginTop: 8 }}>
          Retry Connection
        </button>
      </div>
    );
  }

  const { kpis, rawMaterials, finishedGoods, recentProductionTx } = data;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Production Dashboard</h2>
          <p>Monitor active production runs, check recipe requirements, and track material processing yields.</p>
        </div>
        <div className="page-header-right" style={{ display: 'flex', gap: 12 }}>
          <Link to="/production-run" className="btn btn-primary btn-sm">
            <Factory size={15} /> Run Production
          </Link>
          <Link to="/recipes" className="btn btn-secondary btn-sm">
            <ListPlus size={15} /> Recipes / BOM
          </Link>
          <Link to="/yield-analytics" className="btn btn-secondary btn-sm">
            <LineChart size={15} /> Yield Analytics
          </Link>
          <Link to="/production-history" className="btn btn-secondary btn-sm">
            <History size={15} /> Run History
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: 28 }}>
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><ClipboardList size={20} color="#3b82f6"/></div>
          <div className="kpi-value">{kpis.pendingPOs}</div>
          <div className="kpi-label">Active Prod. Orders</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-icon green"><CheckCircle2 size={20} color="#10b981"/></div>
          <div className="kpi-value">{kpis.completedPOs}</div>
          <div className="kpi-label">Completed Runs</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-icon red"><AlertTriangle size={20} color="#ef4444"/></div>
          <div className="kpi-value">{kpis.lowStockCount}</div>
          <div className="kpi-label">Low Stock Items</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-icon purple"><Boxes size={20} color="#8b5cf6"/></div>
          <div className="kpi-value">{kpis.totalRM + kpis.totalFG}</div>
          <div className="kpi-label">Total SKUs Active</div>
        </div>
      </div>

      {/* Lists of items (RM & FG) */}
      <div className="responsive-grid-equal-2" style={{ marginBottom: 28 }}>
        {/* Raw Materials */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Raw Material Inventory</div>
              <div className="card-subtitle">All active raw materials and blending items</div>
            </div>
            <Layers size={18} color="var(--color-text-muted)" />
          </div>
          <div className="table-wrapper" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Quantity</th>
                  <th>Min Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rawMaterials.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{p.code}</td>
                    <td>{p.name}</td>
                    <td style={{ fontWeight: 700 }}>{p.total_qty} {p.unit}</td>
                    <td>{p.min_stock} {p.unit}</td>
                    <td>
                      {p.is_low_stock ? (
                        <span className="badge badge-red">Low Stock</span>
                      ) : (
                        <span className="badge badge-green">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Finished Goods */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Finished Goods Inventory</div>
              <div className="card-subtitle">All active packaged and salable items</div>
            </div>
            <Package size={18} color="var(--color-text-muted)" />
          </div>
          <div className="table-wrapper" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Quantity</th>
                  <th>Min Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {finishedGoods.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{p.code}</td>
                    <td>{p.name}</td>
                    <td style={{ fontWeight: 700 }}>{p.total_qty} {p.unit}</td>
                    <td>{p.min_stock} {p.unit}</td>
                    <td>
                      {p.is_low_stock ? (
                        <span className="badge badge-red">Low Stock</span>
                      ) : (
                        <span className="badge badge-green">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Production Transactions */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Recent Production runs & Stock Inflow/Outflow</div>
            <div className="card-subtitle">Latest 15 transactions registered from production actions</div>
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
              {recentProductionTx.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>
                    No recent production transactions found.
                  </td>
                </tr>
              ) : (
                recentProductionTx.map((tx, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{tx.gr_number}</td>
                    <td>
                      <span className={tx.type === 'IN' ? 'stock-in-pill' : 'stock-out-pill'}>
                        {tx.type}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{tx.product_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{tx.product_code} · {tx.product_type}</div>
                    </td>
                    <td style={{ fontWeight: 700, color: tx.type === 'IN' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {tx.type === 'IN' ? '+' : '-'}{tx.quantity} {tx.unit}
                    </td>
                    <td>{tx.warehouse_name}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--color-bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>
                        {tx.reference_doc || 'N/A'}
                      </span>
                    </td>
                    <td>{tx.performed_by}</td>
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
