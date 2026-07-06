import { useState, useEffect } from 'react';
import { dispatchAPI } from '../api';
import toast from 'react-hot-toast';
import { Truck, CheckCircle2, Clock, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LogisticsAndDispatchPage() {
  const { hasPermission } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING'); // PENDING or DISPATCHED
  const [processing, setProcessing] = useState(false);

  const loadDispatches = () => {
    setLoading(true);
    dispatchAPI.list(filter)
      .then(r => setOrders(r.data.data))
      .catch(() => toast.error('Failed to load dispatch orders'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDispatches();
  }, [filter]);

  const handleDispatch = async (id) => {
    if (!window.confirm('Are you sure you want to mark this order as dispatched? This will calculate the total bags and pieces.')) return;
    setProcessing(true);
    try {
      const res = await dispatchAPI.complete(id);
      const data = res.data.data;
      toast.success(`Order Dispatched! Bags: ${data.dispatch_bags}, Pcs: ${data.dispatch_pcs}`);
      loadDispatches();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to dispatch order');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    if (status === 'DISPATCHED') return 'badge-green';
    return 'badge-orange';
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Logistics & Dispatch</h2>
          <p>Manage order dispatches and calculate required packaging units</p>
        </div>
        <div className="page-header-right">
          <div style={{ display: 'flex', background: 'var(--color-bg-card)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <button 
              className={`btn btn-sm ${filter === 'PENDING' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => setFilter('PENDING')}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              Pending Dispatch
            </button>
            <button 
              className={`btn btn-sm ${filter === 'DISPATCHED' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => setFilter('DISPATCHED')}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              Dispatched
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            {filter === 'PENDING' ? 'Orders Awaiting Dispatch' : 'Dispatched Orders'}
          </div>
        </div>

        {loading ? (
          <div className="loading-center"><div className="loading-spinner"></div></div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <Package size={32} />
            <p>No orders found for this status</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Order No</th>
                  <th>Customer</th>
                  <th>Order Status</th>
                  <th>Dispatch Status</th>
                  {filter === 'DISPATCHED' && <th>Total Bags</th>}
                  {filter === 'DISPATCHED' && <th>Total Pcs</th>}
                  {filter === 'DISPATCHED' && <th>Dispatched By</th>}
                  {filter === 'DISPATCHED' && <th>Dispatch Time</th>}
                  {filter === 'PENDING' && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 700 }}>{order.order_number}</td>
                    <td style={{ fontWeight: 600 }}>{order.customer}</td>
                    <td>
                      <span className="badge badge-gray">{order.status}</span>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(order.dispatch_status)}`}>
                        {order.dispatch_status}
                      </span>
                    </td>
                    {filter === 'DISPATCHED' && <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{order.dispatch_bags}</td>}
                    {filter === 'DISPATCHED' && <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{order.dispatch_pcs}</td>}
                    {filter === 'DISPATCHED' && <td>{order.dispatched_by || '—'}</td>}
                    {filter === 'DISPATCHED' && (
                      <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                        {order.dispatched_at ? new Date(order.dispatched_at).toLocaleString() : '—'}
                      </td>
                    )}
                    {filter === 'PENDING' && (
                      <td style={{ textAlign: 'right' }}>
                        {hasPermission('DISPATCH:MANAGE') && (
                          <button 
                            className="btn btn-primary btn-sm" 
                            onClick={() => handleDispatch(order.id)}
                            disabled={processing}
                          >
                            <Truck size={14} /> Mark Dispatched
                          </button>
                        )}
                      </td>
                    )}
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
