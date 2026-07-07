import { useState, useEffect } from 'react';
import { dispatchAPI, shipmentsAPI } from '../api';
import toast from 'react-hot-toast';
import { 
  Truck, CheckCircle2, Clock, Package, ClipboardList, MapPin, 
  User, Phone, Calendar, AlertTriangle, ShieldAlert, BarChart3, ChevronDown, ChevronUp, Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LogisticsAndDispatchPage() {
  const { hasPermission } = useAuth();
  const [orders, setOrders] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending'); // pending, shipments, history
  const [processing, setProcessing] = useState(false);

  // Selection for shipments
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);

  // Shipment creation modal
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [origin, setOrigin] = useState('Main Warehouse');
  const [destination, setDestination] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  // Delivery confirm modal
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('DELIVERED');

  // Accordion for shipments
  const [expandedShipmentId, setExpandedShipmentId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, shipmentsRes, summaryRes] = await Promise.all([
        dispatchAPI.list('PENDING'),
        shipmentsAPI.list(),
        dispatchAPI.summary()
      ]);
      setOrders(ordersRes.data.data);
      setShipments(shipmentsRes.data.data);
      setSummary(summaryRes.data.data);
    } catch (err) {
      toast.error('Failed to load logistics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectOrder = (id) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(oid => oid !== id) : [...prev, id]
    );
  };

  const handleSelectAllOrders = () => {
    if (selectedOrderIds.length === orders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map(o => o.id));
    }
  };

  const handleCreateShipment = async (e) => {
    e.preventDefault();
    if (selectedOrderIds.length === 0) {
      toast.error('Please select at least one order');
      return;
    }
    setProcessing(true);
    try {
      await shipmentsAPI.create({
        vehicle_number: vehicleNumber,
        driver_name: driverName,
        driver_phone: driverPhone,
        origin,
        destination,
        scheduled_at: scheduledAt || new Date().toISOString(),
        order_ids: selectedOrderIds
      });
      toast.success('Shipment created successfully!');
      setShowShipmentModal(false);
      setSelectedOrderIds([]);
      setVehicleNumber('');
      setDriverName('');
      setDriverPhone('');
      setDestination('');
      setScheduledAt('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create shipment');
    } finally {
      setProcessing(false);
    }
  };

  const handleStartTrip = async (id) => {
    setProcessing(true);
    try {
      await shipmentsAPI.updateStatus(id, 'EN_ROUTE');
      toast.success('Shipment is now en route!');
      loadData();
    } catch (err) {
      toast.error('Failed to start trip');
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenDeliveryModal = (shipment) => {
    setSelectedShipment(shipment);
    setDeliveryNotes('');
    setDeliveryStatus('DELIVERED');
    setShowDeliveryModal(true);
  };

  const handleConfirmDelivery = async (e) => {
    e.preventDefault();
    if (!selectedShipment) return;
    setProcessing(true);
    try {
      await shipmentsAPI.deliver(selectedShipment.id, deliveryNotes, deliveryStatus);
      toast.success(deliveryStatus === 'DELIVERED' ? 'Shipment delivered successfully!' : 'Shipment marked as failed');
      setShowDeliveryModal(false);
      setSelectedShipment(null);
      loadData();
    } catch (err) {
      toast.error('Failed to confirm delivery');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelShipment = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this shipment?')) return;
    setProcessing(true);
    try {
      await shipmentsAPI.delete(id);
      toast.success('Shipment cancelled');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel shipment');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelSingleDispatch = async (id) => {
    if (!window.confirm('Are you sure you want to undo dispatch for this order? It will revert back to pending.')) return;
    setProcessing(true);
    try {
      await dispatchAPI.cancel(id);
      toast.success('Dispatch cancelled successfully');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel dispatch');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CREATED': return <span className="badge badge-orange">Created</span>;
      case 'EN_ROUTE': return <span className="badge badge-blue">En Route</span>;
      case 'DELIVERED': return <span className="badge badge-green">Delivered</span>;
      case 'FAILED': return <span className="badge badge-red">Failed</span>;
      default: return <span className="badge badge-gray">{status}</span>;
    }
  };

  return (
    <div className="fade-in" style={{ padding: 24 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-header-left">
          <h2>Logistics & Dispatch</h2>
          <p>Organize shipments, assign delivery drivers, and track dispatches.</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
            Sync Logistics
          </button>
        </div>
      </div>

      {/* KPI Row */}
      {summary && (
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          <div className="kpi-card orange">
            <div className="kpi-card-header">
              <span className="kpi-label">Orders Awaiting Dispatch</span>
              <Clock size={20} color="var(--color-warning)" />
            </div>
            <div className="kpi-value">{summary.pending_dispatch_count}</div>
          </div>
          <div className="kpi-card blue">
            <div className="kpi-card-header">
              <span className="kpi-label">Active Shipments</span>
              <Truck size={20} color="var(--color-primary)" />
            </div>
            <div className="kpi-value">
              {shipments.filter(s => s.status === 'CREATED' || s.status === 'EN_ROUTE').length}
            </div>
          </div>
          <div className="kpi-card green">
            <div className="kpi-card-header">
              <span className="kpi-label">Completed Dispatches</span>
              <CheckCircle2 size={20} color="var(--color-success)" />
            </div>
            <div className="kpi-value">{summary.completed_dispatch_count}</div>
          </div>
          <div className="kpi-card cyan">
            <div className="kpi-card-header">
              <span className="kpi-label">Bags Dispatched</span>
              <Package size={20} color="#06b6d4" />
            </div>
            <div className="kpi-value">{summary.total_dispatched_bags}</div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 20 }}>
        <button 
          className={`btn btn-sm ${activeTab === 'pending' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('pending')}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        >
          Pending Orders ({orders.length})
        </button>
        <button 
          className={`btn btn-sm ${activeTab === 'shipments' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('shipments')}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginLeft: 8 }}
        >
          Shipments ({shipments.length})
        </button>
        <button 
          className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('history')}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginLeft: 8 }}
        >
          Dispatched Orders
        </button>
      </div>

      {loading ? (
        <div className="loading-center"><div className="loading-spinner"></div></div>
      ) : (
        <>
          {/* TAB 1: PENDING ORDERS */}
          {activeTab === 'pending' && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="card-title">Awaiting Delivery Setup</div>
                {selectedOrderIds.length > 0 && hasPermission('SHIPMENTS:CREATE') && (
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowShipmentModal(true)}
                  >
                    <Truck size={14} style={{ marginRight: 6 }} /> Create Shipment ({selectedOrderIds.length} orders)
                  </button>
                )}
              </div>

              {orders.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle2 size={36} color="var(--color-success)" />
                  <p>All sales orders have been packaged and dispatched.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>
                          <input 
                            type="checkbox" 
                            checked={selectedOrderIds.length === orders.length}
                            onChange={handleSelectAllOrders}
                          />
                        </th>
                        <th>Order Ref</th>
                        <th>Customer</th>
                        <th>Status</th>
                        <th>Items to Ship</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(order => (
                        <tr key={order.id} style={{ background: selectedOrderIds.includes(order.id) ? 'rgba(59,130,246,0.04)' : 'none' }}>
                          <td>
                            <input 
                              type="checkbox" 
                              checked={selectedOrderIds.includes(order.id)}
                              onChange={() => handleSelectOrder(order.id)}
                            />
                          </td>
                          <td style={{ fontWeight: 700 }}>{order.order_number}</td>
                          <td style={{ fontWeight: 600 }}>{order.customer}</td>
                          <td>
                            <span className="badge badge-gray">{order.status}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {order.items?.map((item, idx) => (
                                <span key={idx} className="badge badge-blue" style={{ fontSize: 11 }}>
                                  {item.product_name} ({item.qty_required} {item.unit})
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SHIPMENTS */}
          {activeTab === 'shipments' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Manage Delivery Shipments</div>
              </div>

              {shipments.length === 0 ? (
                <div className="empty-state">
                  <Package size={36} color="var(--color-text-muted)" />
                  <p>No shipments created yet. Go to Pending Orders to build a shipment.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 30 }}></th>
                        <th>Shipment No</th>
                        <th>Vehicle No</th>
                        <th>Driver Details</th>
                        <th>Status</th>
                        <th>Orders</th>
                        <th>Bags/Pcs</th>
                        <th>Scheduled</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipments.map(s => {
                        const isExpanded = expandedShipmentId === s.id;
                        return (
                          <>
                            <tr key={s.id}>
                              <td>
                                <button 
                                  className="btn btn-ghost btn-sm" 
                                  onClick={() => setExpandedShipmentId(isExpanded ? null : s.id)}
                                  style={{ padding: 4 }}
                                >
                                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                              </td>
                              <td style={{ fontWeight: 700 }}>{s.shipment_number}</td>
                              <td style={{ fontWeight: 600 }}>{s.vehicle_number || '—'}</td>
                              <td>
                                {s.driver_name ? (
                                  <div>
                                    <div style={{ fontWeight: 600 }}>{s.driver_name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{s.driver_phone}</div>
                                  </div>
                                ) : '—'}
                              </td>
                              <td>{getStatusBadge(s.status)}</td>
                              <td style={{ fontWeight: 600 }}>{s.orders?.length || 0} orders</td>
                              <td>{s.total_bags} bags / {s.total_pcs} pcs</td>
                              <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                {s.scheduled_at ? new Date(s.scheduled_at).toLocaleString() : '—'}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                                  {s.status === 'CREATED' && hasPermission('SHIPMENTS:MANAGE') && (
                                    <button 
                                      className="btn btn-primary btn-sm"
                                      onClick={() => handleStartTrip(s.id)}
                                    >
                                      Start Trip
                                    </button>
                                  )}
                                  {s.status === 'EN_ROUTE' && hasPermission('DELIVERY:CONFIRM') && (
                                    <button 
                                      className="btn btn-success btn-sm"
                                      onClick={() => handleOpenDeliveryModal(s)}
                                    >
                                      Confirm Delivery
                                    </button>
                                  )}
                                  {s.status === 'CREATED' && hasPermission('SHIPMENTS:MANAGE') && (
                                    <button 
                                      className="btn btn-ghost btn-sm text-danger"
                                      onClick={() => handleCancelShipment(s.id)}
                                      style={{ padding: 6 }}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan="9" style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.01)' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Linked Orders & Product Quantities</div>
                                    {s.orders?.map(order => (
                                      <div key={order.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--color-bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 6 }}>
                                          <strong style={{ fontSize: 13.5 }}>{order.order_number} — {order.customer}</strong>
                                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>{order.dispatch_bags} bags / {order.dispatch_pcs} pcs</span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                          {order.items?.map((item, idx) => (
                                            <span key={idx} style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                                              • {item.product_name}: <strong>{item.qty_required} {item.unit}</strong>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                    {s.delivery_notes && (
                                      <div style={{ marginTop: 8, padding: 10, background: 'rgba(239,68,68,0.04)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.1)' }}>
                                        <strong>Logistics Notes:</strong> {s.delivery_notes}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DISPATCH HISTORY */}
          {activeTab === 'history' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Completed Dispatch Records</div>
              </div>

              {shipments.filter(s => s.status === 'DELIVERED' || s.status === 'FAILED').length === 0 ? (
                <div className="empty-state">
                  <ClipboardList size={36} color="var(--color-text-muted)" />
                  <p>No completed dispatch history found.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Shipment No</th>
                        <th>Vehicle / Driver</th>
                        <th>Outcome</th>
                        <th>Packages</th>
                        <th>Notes / Remarks</th>
                        <th>Delivered At</th>
                        <th>Operator</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipments.filter(s => s.status === 'DELIVERED' || s.status === 'FAILED').map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 700 }}>{s.shipment_number}</td>
                          <td>
                            <div>
                              <div style={{ fontWeight: 600 }}>{s.vehicle_number}</div>
                              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{s.driver_name}</div>
                            </div>
                          </td>
                          <td>{getStatusBadge(s.status)}</td>
                          <td>{s.total_bags} bags / {s.total_pcs} pcs</td>
                          <td style={{ fontSize: 13.5 }}>{s.delivery_notes || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                            {s.delivered_at ? new Date(s.delivered_at).toLocaleString() : '—'}
                          </td>
                          <td>{s.created_by}</td>
                          <td style={{ textAlign: 'right' }}>
                            {s.orders?.map(o => (
                              <button 
                                key={o.id}
                                className="btn btn-ghost btn-sm text-danger"
                                onClick={() => handleCancelSingleDispatch(o.id)}
                                style={{ padding: '4px 8px', fontSize: 11.5 }}
                              >
                                Undo Dispatch
                              </button>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* CREATE SHIPMENT MODAL */}
      {showShipmentModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>Create Delivery Shipment</h3>
              <button className="modal-close" onClick={() => setShowShipmentModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateShipment}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '16px 0' }}>
                <div className="form-group">
                  <label>Vehicle Number</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={vehicleNumber}
                    onChange={e => setVehicleNumber(e.target.value)}
                    placeholder="e.g. TN-37-BY-4512"
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Driver Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={driverName}
                      onChange={e => setDriverName(e.target.value)}
                      placeholder="Name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Driver Phone</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={driverPhone}
                      onChange={e => setDriverPhone(e.target.value)}
                      placeholder="Phone Number"
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Origin</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={origin}
                      onChange={e => setOrigin(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Destination Route</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={destination}
                      onChange={e => setDestination(e.target.value)}
                      placeholder="e.g. Coimbatore Bypass"
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Scheduled Dispatch Time</label>
                  <input 
                    type="datetime-local" 
                    className="form-control" 
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowShipmentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={processing}>
                  Create Shipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELIVERY MODAL */}
      {showDeliveryModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3>Confirm Delivery</h3>
              <button className="modal-close" onClick={() => setShowDeliveryModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleConfirmDelivery}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '16px 0' }}>
                <div className="form-group">
                  <label>Outcome Status</label>
                  <select 
                    className="form-control" 
                    value={deliveryStatus}
                    onChange={e => setDeliveryStatus(e.target.value)}
                  >
                    <option value="DELIVERED">Delivered Successfully</option>
                    <option value="FAILED">Delivery Failed</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Remarks / Notes / Proof of Delivery</label>
                  <textarea 
                    className="form-control" 
                    value={deliveryNotes}
                    onChange={e => setDeliveryNotes(e.target.value)}
                    placeholder="Enter delivery comments or reasoning for failure"
                    style={{ height: 100 }}
                  />
                </div>
              </div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeliveryModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" disabled={processing}>
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
