import { useState, useEffect } from 'react';
import { dispatchAPI, shipmentsAPI } from '../../api';
import toast from 'react-hot-toast';
import { Package, RefreshCw, Calendar, User, ShoppingBag, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function LogisticsHistory() {
  const { hasPermission } = useAuth();
  const isDriver = !hasPermission('DISPATCH:VIEW');

  const [orders, setOrders] = useState([]);       // Dispatcher: dispatched orders
  const [shipments, setShipments] = useState([]); // Driver: completed shipments
  const [loading, setLoading] = useState(true);

  const loadHistory = () => {
    setLoading(true);
    if (isDriver) {
      // Drivers see their own completed shipment history
      shipmentsAPI.listAssigned()
        .then(r => {
          const completed = (r.data.data || []).filter(
            s => s.status === 'DELIVERED' || s.status === 'FAILED'
          );
          setShipments(completed);
        })
        .catch(() => toast.error('Failed to load delivery history'))
        .finally(() => setLoading(false));
    } else {
      // Dispatchers see the full dispatched order history
      dispatchAPI.list('DISPATCHED')
        .then(r => setOrders(r.data.data))
        .catch(() => toast.error('Failed to load dispatch history'))
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    loadHistory();
  }, [isDriver]); // eslint-disable-line

  if (loading) {
    return (
      <div className="w-spinner-wrap">
        <div className="w-spinner" />
      </div>
    );
  }

  // ─── Driver View: Completed Shipments ─────────────────────────────────────
  if (isDriver) {
    return (
      <div className="w-page w-fade-in" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800 }}>My Delivery History</h3>
            <p style={{ fontSize: 12, color: 'var(--w-text-2)', marginTop: 2 }}>
              {shipments.length === 0 ? 'No completed deliveries yet' : `${shipments.length} completed shipment${shipments.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <button className="w-btn ghost sm" onClick={loadHistory} style={{ minWidth: 'auto', padding: 8 }}>
            <RefreshCw size={16} />
          </button>
        </div>

        {shipments.length === 0 ? (
          <div className="w-card" style={{ padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Package size={36} color="var(--w-text-3)" />
            <p style={{ fontSize: 13.5, color: 'var(--w-text-2)' }}>No completed deliveries found</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {shipments.map(s => {
              const deliveredCount = s.orders?.filter(o => o.stop_status === 'DELIVERED').length || 0;
              const failedCount = s.orders?.filter(o => o.stop_status === 'FAILED').length || 0;

              return (
                <div key={s.id} className="w-card" style={{ padding: 16, border: '1px solid var(--w-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--w-text-3)', textTransform: 'uppercase' }}>Shipment</span>
                      <div style={{ fontSize: 14.5, fontWeight: 800, marginTop: 2 }}>{s.shipment_number}</div>
                    </div>
                    <span className={`badge ${s.status === 'DELIVERED' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10, textTransform: 'uppercase' }}>
                      {s.status}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 8, border: '1px solid var(--w-border)' }}>
                      <div style={{ fontSize: 17, fontWeight: 800 }}>{s.orders?.length || 0}</div>
                      <div style={{ fontSize: 10, color: 'var(--w-text-3)' }}>Total Stops</div>
                    </div>
                    <div style={{ textAlign: 'center', background: 'rgba(16,185,129,0.05)', padding: 10, borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)' }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: '#10b981' }}>{deliveredCount}</div>
                      <div style={{ fontSize: 10, color: 'var(--w-text-3)' }}>Delivered</div>
                    </div>
                    <div style={{ textAlign: 'center', background: 'rgba(239,68,68,0.05)', padding: 10, borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: '#ef4444' }}>{failedCount}</div>
                      <div style={{ fontSize: 10, color: 'var(--w-text-3)' }}>Failed</div>
                    </div>
                  </div>

                  {s.orders?.map((order, idx) => (
                    <div key={order.id} style={{ borderTop: idx === 0 ? '1px solid var(--w-border)' : 'none', paddingTop: idx === 0 ? 10 : 0, marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, marginBottom: 2 }}>
                        <span style={{ fontWeight: 600 }}>Stop #{order.stop_sequence ?? (idx + 1)}: {order.customer}</span>
                        <span className={`badge ${order.stop_status === 'DELIVERED' ? 'badge-green' : order.stop_status === 'FAILED' ? 'badge-red' : 'badge-gray'}`} style={{ fontSize: 9.5 }}>
                          {order.stop_status}
                        </span>
                      </div>
                      {order.delivery_notes && (
                        <div style={{ fontSize: 11, color: 'var(--w-text-3)', marginTop: 2 }}>Note: {order.delivery_notes}</div>
                      )}
                    </div>
                  ))}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, color: 'var(--w-text-2)', paddingTop: 10, borderTop: '1px solid var(--w-border)', marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={13} color="var(--w-text-3)" />
                      <span>Shipment: <strong style={{ color: 'var(--w-text)' }}>{s.created_at ? new Date(s.created_at).toLocaleString() : '—'}</strong></span>
                    </div>
                    {s.vehicle_number && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ShoppingBag size={13} color="var(--w-text-3)" />
                        <span>Vehicle: <strong style={{ color: 'var(--w-text)' }}>{s.vehicle_number}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Dispatcher View: Dispatched Orders ────────────────────────────────────
  return (
    <div className="w-page w-fade-in" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800 }}>Dispatched Orders</h3>
          <p style={{ fontSize: 12, color: 'var(--w-text-2)', marginTop: 2 }}>
            {orders.length === 0 ? 'No completed dispatches' : `${orders.length} orders successfully dispatched`}
          </p>
        </div>
        <button className="w-btn ghost sm" onClick={loadHistory} style={{ minWidth: 'auto', padding: 8 }}>
          <RefreshCw size={16} />
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="w-card" style={{ padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Package size={36} color="var(--w-text-3)" />
          <p style={{ fontSize: 13.5, color: 'var(--w-text-2)' }}>No history found</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orders.map(order => (
            <div key={order.id} className="w-card" style={{ padding: 16, border: '1px solid var(--w-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--w-text-3)', textTransform: 'uppercase' }}>Order Ref</span>
                  <div style={{ fontSize: 14.5, fontWeight: 800, marginTop: 2 }}>{order.order_number}</div>
                </div>
                <span className="badge badge-green" style={{ fontSize: 10, textTransform: 'uppercase' }}>{order.dispatch_status}</span>
              </div>

              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--w-text-3)' }}>Customer</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--w-text)', marginTop: 2 }}>{order.customer}</div>
              </div>

              {/* Items Details Section */}
              <div style={{ margin: '12px 0', borderTop: '1px solid var(--w-border)', paddingTop: 10, paddingBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--w-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Items Dispatched</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  {order.items?.map((item, idx) => {
                    const qty = item.qty_required || 0;
                    let packInfo = 'No packaging config';
                    let bagsCount = null;

                    let pcsPerBag = 0;
                    if (item.pcs_per_bag && item.pcs_per_bag > 0) {
                      pcsPerBag = item.pcs_per_bag;
                      packInfo = `${item.pcs_per_bag} pcs/bag`;
                    } else if (item.pcs_per_innerbag && item.innerbags_per_bag) {
                      pcsPerBag = item.pcs_per_innerbag * item.innerbags_per_bag;
                      packInfo = `${item.pcs_per_innerbag} pcs/innerbag x ${item.innerbags_per_bag} innerbags/bag`;
                    }

                    if (pcsPerBag > 0) {
                      bagsCount = Math.ceil(qty / pcsPerBag);
                    }

                    return (
                      <div key={idx} style={{ background: 'rgba(255,255,255,0.01)', padding: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.02)', fontSize: 12.5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                          <span>{item.product_name}</span>
                          <span style={{ color: 'var(--w-text)' }}>{qty} {item.unit}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--w-text-3)', marginTop: 4 }}>
                          <span>Config: {packInfo}</span>
                          {bagsCount !== null && (
                            <span style={{ fontWeight: 600 }}>Bags: {bagsCount}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 'var(--w-radius-sm)', border: '1px solid var(--w-border)', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--w-text-3)' }}>TOTAL BAGS</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--w-primary)', marginTop: 2 }}>{order.dispatch_bags || 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--w-text-3)' }}>TOTAL PCS</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--w-primary)', marginTop: 2 }}>{order.dispatch_pcs || 0}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, color: 'var(--w-text-2)', paddingTop: 10, borderTop: '1px solid var(--w-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={13} color="var(--w-text-3)" />
                  <span>Dispatched by: <strong style={{ color: 'var(--w-text)' }}>{order.dispatched_by || 'Unknown'}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={13} color="var(--w-text-3)" />
                  <span>Time: <strong style={{ color: 'var(--w-text)' }}>{order.dispatched_at ? new Date(order.dispatched_at).toLocaleString() : '—'}</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

