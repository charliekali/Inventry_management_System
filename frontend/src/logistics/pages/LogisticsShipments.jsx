import { useState, useEffect } from 'react';
import { shipmentsAPI } from '../../api';
import toast from 'react-hot-toast';
import { Truck, Navigation, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Phone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function LogisticsShipments() {
  const { hasPermission } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Delivery modal
  const [showModal, setShowModal] = useState(false);
  const [activeShipment, setActiveShipment] = useState(null);
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('DELIVERED');

  const loadShipments = () => {
    setLoading(true);
    shipmentsAPI.list()
      .then(r => setOrdersGroup(r.data.data))
      .catch(() => toast.error('Failed to load shipments'))
      .finally(() => setLoading(false));
  };

  const setOrdersGroup = (data) => {
    // Sort active shipments to top (CREATED & EN_ROUTE)
    const sorted = [...data].sort((a, b) => {
      const order = { 'EN_ROUTE': 0, 'CREATED': 1, 'DELIVERED': 2, 'FAILED': 3 };
      return (order[a.status] ?? 4) - (order[b.status] ?? 4);
    });
    setShipments(sorted);
  };

  useEffect(() => {
    loadShipments();
  }, []);

  const handleStartTrip = async (id) => {
    if (!window.confirm('Start delivery trip? This will set shipment status to En Route.')) return;
    setProcessing(true);
    try {
      await shipmentsAPI.updateStatus(id, 'EN_ROUTE');
      toast.success('Trip started! Drive safe.');
      loadShipments();
    } catch {
      toast.error('Failed to start trip');
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenDelivery = (shipment) => {
    setActiveShipment(shipment);
    setNotes('');
    setOutcome('DELIVERED');
    setShowModal(true);
  };

  const handleConfirmDelivery = async (e) => {
    e.preventDefault();
    if (!activeShipment) return;
    setProcessing(true);
    try {
      await shipmentsAPI.deliver(activeShipment.id, notes, outcome);
      toast.success(outcome === 'DELIVERED' ? 'Delivery confirmed!' : 'Shipment marked failed');
      setShowModal(false);
      loadShipments();
    } catch {
      toast.error('Failed to submit delivery status');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'CREATED': return 'badge-orange';
      case 'EN_ROUTE': return 'badge-blue';
      case 'DELIVERED': return 'badge-green';
      case 'FAILED': return 'badge-red';
      default: return 'badge-gray';
    }
  };

  if (loading) {
    return (
      <div className="w-spinner-wrap">
        <div className="w-spinner" />
      </div>
    );
  }

  return (
    <div className="w-page w-fade-in" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800 }}>Trips & Shipments</h3>
          <p style={{ fontSize: 12, color: 'var(--w-text-2)', marginTop: 2 }}>
            Manage shipment deliveries and track routes.
          </p>
        </div>
        <button className="w-btn ghost sm" onClick={loadShipments} style={{ minWidth: 'auto', padding: 8 }}>
          <RefreshCw size={16} />
        </button>
      </div>

      {shipments.length === 0 ? (
        <div className="w-card" style={{ padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Navigation size={36} color="var(--w-text-3)" />
          <p style={{ fontSize: 13.5, color: 'var(--w-text-2)' }}>No shipments allocated yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shipments.map(s => {
            const isExpanded = expandedId === s.id;
            const isActive = s.status === 'CREATED' || s.status === 'EN_ROUTE';

            return (
              <div key={s.id} className="w-card" style={{ padding: 16, border: '1px solid var(--w-border)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--w-primary)', fontWeight: 700, textTransform: 'uppercase' }}>Shipment Ref</span>
                    <div style={{ fontSize: 14.5, fontWeight: 800, marginTop: 2 }}>{s.shipment_number}</div>
                  </div>
                  <span className={`badge ${getStatusBadgeClass(s.status)}`} style={{ fontSize: 10, textTransform: 'uppercase' }}>
                    {s.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Truck size={14} color="var(--w-text-3)" />
                    <span>Vehicle: <strong style={{ color: 'var(--w-text)' }}>{s.vehicle_number || '—'}</strong></span>
                  </div>
                  {s.driver_name && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Phone size={14} color="var(--w-text-3)" />
                      <span>Driver: <strong style={{ color: 'var(--w-text)' }}>{s.driver_name} ({s.driver_phone})</strong></span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Navigation size={14} color="var(--w-text-3)" />
                    <span>Route: <strong style={{ color: 'var(--w-text)' }}>{s.destination || 'Direct delivery'}</strong></span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <CheckCircle2 size={14} color="var(--w-text-3)" />
                    <span>Load: <strong style={{ color: 'var(--w-text)' }}>{s.orders?.length} orders ({s.total_bags} bags / {s.total_pcs} pcs)</strong></span>
                  </div>
                </div>

                {/* Actions Accordion Toggle */}
                <button 
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--w-border)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 12,
                    color: 'var(--w-text-2)',
                    cursor: 'pointer',
                    marginBottom: isActive ? 12 : 0
                  }}
                >
                  <span>{isExpanded ? 'Hide Order Details' : 'Show Order Details'}</span>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {/* Collapsible details */}
                {isExpanded && (
                  <div style={{ marginTop: 10, padding: 10, background: 'rgba(255,255,255,0.01)', borderRadius: 6, border: '1px solid var(--w-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {s.orders?.map(order => (
                      <div key={order.id} style={{ borderBottom: '1px solid var(--w-border)', paddingBottom: 8, lastChild: { borderBottom: 'none', paddingBottom: 0 } }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                          <span>{order.order_number}</span>
                          <span style={{ color: 'var(--w-primary)' }}>{order.dispatch_bags} bags</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--w-text-2)' }}>{order.customer}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                          {order.items?.map((item, idx) => (
                            <span key={idx} className="badge badge-gray" style={{ fontSize: 10.5 }}>
                              {item.product_name} ({item.qty_required} {item.unit})
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {s.delivery_notes && (
                      <div style={{ borderTop: '1px solid var(--w-border)', paddingTop: 8, fontSize: 12, color: 'var(--w-warning)' }}>
                        <strong>Driver Notes:</strong> {s.delivery_notes}
                      </div>
                    )}
                  </div>
                )}

                {/* Primary status change buttons */}
                {isActive && (
                  <div style={{ display: 'flex', gap: 10, marginTop: isExpanded ? 12 : 0 }}>
                    {s.status === 'CREATED' && hasPermission('SHIPMENTS:MANAGE') && (
                      <button
                        className="w-btn"
                        onClick={() => handleStartTrip(s.id)}
                        disabled={processing}
                        style={{ width: '100%', background: 'var(--w-primary)', border: 'none', color: 'white', fontWeight: 700, borderRadius: 6, padding: '10px 12px', fontSize: 13, cursor: 'pointer' }}
                      >
                        Start Delivery Trip
                      </button>
                    )}
                    {s.status === 'EN_ROUTE' && hasPermission('DELIVERY:CONFIRM') && (
                      <button
                        className="w-btn"
                        onClick={() => handleOpenDelivery(s)}
                        disabled={processing}
                        style={{ width: '100%', background: '#10b981', border: 'none', color: 'white', fontWeight: 700, borderRadius: 6, padding: '10px 12px', fontSize: 13, cursor: 'pointer' }}
                      >
                        Confirm Delivery
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delivery Confirmation Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div className="w-card animate-slide-up" style={{ width: '100%', maxWidth: 400, padding: 20, border: '1px solid var(--w-border)' }}>
            <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Confirm Delivery Status</h4>
            <form onSubmit={handleConfirmDelivery} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: 'var(--w-text-2)', fontWeight: 600 }}>Delivery Outcome</label>
                <select 
                  value={outcome}
                  onChange={e => setOutcome(e.target.value)}
                  style={{
                    background: 'var(--w-surface)', color: 'var(--w-text)',
                    border: '1px solid var(--w-border)', borderRadius: 6, padding: '10px 12px',
                    outline: 'none', fontSize: 13.5
                  }}
                >
                  <option value="DELIVERED">Delivered Successfully</option>
                  <option value="FAILED">Failed / Rejected</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: 'var(--w-text-2)', fontWeight: 600 }}>Notes / POD Details</label>
                <textarea 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Enter comments, receiver details or reason for failure"
                  style={{
                    background: 'var(--w-surface)', color: 'var(--w-text)',
                    border: '1px solid var(--w-border)', borderRadius: 6, padding: '10px 12px',
                    outline: 'none', fontSize: 13.5, height: 80, resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button 
                  type="button" 
                  className="w-btn ghost" 
                  onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '10px 12px', fontSize: 13, border: '1px solid var(--w-border)', background: 'transparent', color: 'var(--w-text)', cursor: 'pointer', borderRadius: 6 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="w-btn" 
                  disabled={processing}
                  style={{ flex: 1.2, padding: '10px 12px', fontSize: 13, background: outcome === 'DELIVERED' ? '#10b981' : '#ef4444', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', borderRadius: 6 }}
                >
                  Confirm Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
