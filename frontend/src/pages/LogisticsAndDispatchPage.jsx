import { useState, useEffect } from 'react';
import { dispatchAPI, shipmentsAPI, usersAPI } from '../api';
import toast from 'react-hot-toast';
import {
  Truck, CheckCircle2, Clock, Package, ClipboardList, MapPin,
  User, Phone, Calendar, AlertTriangle, ShieldAlert, BarChart3, ChevronDown, ChevronUp, Trash2,
  Play, Map, Edit, UserCheck, RefreshCw, X, Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { useTheme } from '../context/ThemeContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom Marker icons
function createStopMarker(seq, status) {
  const color = status === 'DELIVERED' ? '#10b981' : status === 'FAILED' ? '#ef4444' : '#fb923c';
  const size = 28;
  const html = `
    <div style="position:relative; width:${size}px; height:${size}px;">
      <div style="
        position:absolute; inset:0;
        background:${color};
        border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        color:#090d16; font-weight:900; font-size:11px;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
      ">${seq}</div>
    </div>`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function createDriverMarker() {
  const size = 32;
  const html = `
    <div style="position:relative; width:${size}px; height:${size}px;">
      <div style="
        position:absolute; inset:0;
        background:#10b981;
        border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        font-size:15px;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(16,185,129,0.5);
      ">🚚</div>
    </div>`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function createDepotMarker() {
  const size = 32;
  const html = `
    <div style="position:relative; width:${size}px; height:${size}px;">
      <div style="
        position:absolute; inset:0;
        background:#ef4444;
        border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        font-size:15px;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(239,68,68,0.5);
      ">🏢</div>
    </div>`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function MapBounds({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length > 0) {
      const validCoords = coords.filter(c => c && !isNaN(c[0]) && !isNaN(c[1]));
      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    }
  }, [coords, map]);
  return null;
}

export default function LogisticsAndDispatchPage() {
  const { hasPermission } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const [orders, setOrders] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [drivers, setDrivers] = useState([]);
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

  // Admin Override Modal state
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideShipment, setOverrideShipment] = useState(null);
  const [overrideDriverId, setOverrideDriverId] = useState('');
  const [overrideVehicle, setOverrideVehicle] = useState('');
  const [overrideStops, setOverrideStops] = useState([]);

  // POD modal viewer
  const [podMediaUrl, setPodMediaUrl] = useState(null);
  const [podMediaType, setPodMediaType] = useState('');

  // Accordion for shipments
  const [expandedShipmentId, setExpandedShipmentId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, shipmentsRes, summaryRes, usersRes] = await Promise.all([
        dispatchAPI.list('PENDING'),
        shipmentsAPI.list(),
        dispatchAPI.summary(),
        usersAPI.list()
      ]);
      setOrders(ordersRes.data.data);
      setShipments(shipmentsRes.data.data);
      setSummary(summaryRes.data.data);

      const driverUsers = (usersRes.data.data || []).filter(u => u.role?.name === 'Driver');
      setDrivers(driverUsers);
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

  const handleOpenOverrideModal = (shipment) => {
    setOverrideShipment(shipment);
    setOverrideDriverId(shipment.driver?.id || '');
    setOverrideVehicle(shipment.vehicle_number || '');
    const sortedStops = [...(shipment.orders || [])].sort((a, b) => (a.stop_sequence || 0) - (b.stop_sequence || 0));
    setOverrideStops(sortedStops);
    setShowOverrideModal(true);
  };

  const handleMoveStopUp = (index) => {
    if (index === 0) return;
    const updated = [...overrideStops];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setOverrideStops(updated);
  };

  const handleMoveStopDown = (index) => {
    if (index === overrideStops.length - 1) return;
    const updated = [...overrideStops];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setOverrideStops(updated);
  };

  const handleSaveOverride = async (e) => {
    e.preventDefault();
    if (!overrideShipment) return;
    setProcessing(true);
    try {
      const seqString = overrideStops.map(s => s.id).join(',');
      await shipmentsAPI.adminOverride(overrideShipment.id, {
        driver_id: overrideDriverId,
        vehicle_number: overrideVehicle,
        route_sequence: seqString
      });
      toast.success('Shipment updated and re-optimized successfully!');
      setShowOverrideModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply admin overrides');
    } finally {
      setProcessing(false);
    }
  };

  const handleViewPOD = (url, type) => {
    setPodMediaUrl(url);
    setPodMediaType(type);
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
                <div className="card-title">Manage Delivery Shipments & live Driver tracking</div>
              </div>

              {(() => {
                // Collect coordinates and lines to plot on Leaflet Map
                const stopsList = [];
                const driversList = [];
                const routesList = [];
                const mapCenter = [13.0827, 80.2707]; // default depot coordinates (Chennai)
                const boundsCoords = [mapCenter];

                shipments.forEach(s => {
                  if (s.status === 'EN_ROUTE' || s.status === 'CREATED') {
                    const routeStops = [];

                    s.orders?.forEach(o => {
                      if (o.latitude && o.longitude) {
                        const latVal = parseFloat(o.latitude);
                        const lngVal = parseFloat(o.longitude);
                        stopsList.push({
                          id: o.id,
                          order_number: o.order_number,
                          customer: o.customer,
                          status: o.stop_status || 'PENDING',
                          lat: latVal,
                          lng: lngVal,
                          sequence: o.stop_sequence
                        });
                        routeStops.push({
                          lat: latVal,
                          lng: lngVal,
                          sequence: o.stop_sequence || 0
                        });
                        boundsCoords.push([latVal, lngVal]);
                      }
                    });

                    // Sort stops by sequence
                    routeStops.sort((a, b) => a.sequence - b.sequence);
                    const stopLatLngs = routeStops.map(rs => [rs.lat, rs.lng]);

                    // Add polyline paths
                    if (stopLatLngs.length > 0) {
                      routesList.push({
                        id: s.id,
                        color: s.status === 'EN_ROUTE' ? '#3b82f6' : '#94a3b8',
                        positions: [mapCenter, ...stopLatLngs]
                      });
                    }

                    const d = s.driver;
                    const dLat = d?.lat ? parseFloat(d.lat) : null;
                    const dLng = d?.lng ? parseFloat(d.lng) : null;

                    if (dLat && dLng) {
                      driversList.push({
                        name: s.driver_name || 'Driver',
                        vehicle: s.vehicle_number,
                        lat: dLat,
                        lng: dLng,
                        driverStatus: d?.driver_status || 'BUSY',
                        firstStop: stopLatLngs[0]
                      });
                      boundsCoords.push([dLat, dLng]);
                    }
                  }
                });

                return (
                  <div style={{ padding: 16, background: '#020617', borderBottom: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Map size={16} color="#06b6d4" /> Live GPS Driver Fleet tracker
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#94a3b8' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}></span> Depot</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#fb923c' }}></span> Stop (Pending)</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span> Delivered</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#06b6d4' }}></span> Driver (Truck)</span>
                      </div>
                    </div>

                    <div style={{ height: 350, borderRadius: 8, overflow: 'hidden', border: '1px solid #1e293b' }}>
                      <MapContainer
                        center={mapCenter}
                        zoom={13}
                        style={{ height: '100%', width: '100%', background: '#090d16' }}
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> '
                          url={tileUrl}
                          className={isDark ? 'leaflet-dark-filter' : ''}
                        />

                        {/* Fit Bounds Component */}
                        <MapBounds coords={boundsCoords} />

                        {/* Depot Marker */}
                        <Marker position={mapCenter} icon={createDepotMarker()}>
                          <Popup>
                            <div style={{ color: '#090d16' }}>
                              <strong>Main Distribution Depot</strong><br />
                              Colombo Central Hub
                            </div>
                          </Popup>
                        </Marker>

                        {/* Stop Markers */}
                        {stopsList.map((stop, idx) => (
                          <Marker
                            key={`stop-${stop.id}-${idx}`}
                            position={[stop.lat, stop.lng]}
                            icon={createStopMarker(stop.sequence || (idx + 1), stop.status)}
                          >
                            <Popup>
                              <div style={{ color: '#090d16' }}>
                                <strong>Stop {stop.sequence || (idx + 1)}: {stop.order_number}</strong><br />
                                Customer: {stop.customer}<br />
                                Status: <span style={{ fontWeight: 'bold' }}>{stop.status}</span>
                              </div>
                            </Popup>
                          </Marker>
                        ))}

                        {/* Driver Markers */}
                        {driversList.map((d, idx) => (
                          <Marker
                            key={`driver-${idx}`}
                            position={[d.lat, d.lng]}
                            icon={createDriverMarker()}
                          >
                            <Popup>
                              <div style={{ color: '#090d16' }}>
                                <strong>Driver: {d.name}</strong><br />
                                Vehicle: {d.vehicle}<br />
                                Status: {d.driverStatus}
                              </div>
                            </Popup>
                          </Marker>
                        ))}

                        {/* Route Polylines */}
                        {routesList.map(route => (
                          <Polyline
                            key={`route-${route.id}`}
                            positions={route.positions}
                            color={route.color}
                            weight={3.5}
                            opacity={0.8}
                          />
                        ))}

                        {/* Connecting line from driver to first stop */}
                        {driversList.map((d, idx) => (
                          d.firstStop && (
                            <Polyline
                              key={`drv-con-${idx}`}
                              positions={[[d.lat, d.lng], d.firstStop]}
                              color="#10b981"
                              weight={2.5}
                              dashArray="5,5"
                              opacity={0.7}
                            />
                          )
                        ))}
                      </MapContainer>
                    </div>
                  </div>
                );
              })()}

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
                        <th>Est Distance / Duration</th>
                        <th>Stops</th>
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
                              <td>
                                <div style={{ fontWeight: 600 }}>{s.distance_km || 0} km</div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>~{s.duration_min || 0} mins</div>
                              </td>
                              <td style={{ fontWeight: 600 }}>{s.orders?.length || 0} stops</td>
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
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Timeline Stops & Delivery Progress</div>
                                      {hasPermission('SHIPMENTS:MANAGE') && (
                                        <button
                                          className="btn btn-secondary btn-sm"
                                          onClick={() => handleOpenOverrideModal(s)}
                                        >
                                          <Edit size={12} style={{ marginRight: 6 }} /> Route & Driver Overrides
                                        </button>
                                      )}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderLeft: '2px solid var(--color-border)', marginLeft: 8, paddingLeft: 16 }}>
                                      {s.orders?.map((order, stopIdx) => {
                                        let dotColor = '#fb923c'; // pending
                                        if (order.stop_status === 'DELIVERED') dotColor = '#10b981';
                                        if (order.stop_status === 'FAILED') dotColor = '#ef4444';

                                        return (
                                          <div key={order.id} style={{ position: 'relative' }}>
                                            <div style={{
                                              position: 'absolute', left: -21, top: 4, width: 8, height: 8,
                                              borderRadius: '50%', background: dotColor, border: '2px solid var(--color-bg-card)'
                                            }} />
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--color-bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 6 }}>
                                                <strong style={{ fontSize: 13.5 }}>Stop #{order.stop_sequence || (stopIdx + 1)}: {order.order_number} — {order.customer}</strong>
                                                <span className={`badge ${order.stop_status === 'DELIVERED' ? 'badge-green' : order.stop_status === 'FAILED' ? 'badge-red' : 'badge-gray'}`} style={{ fontSize: 10 }}>
                                                  {order.stop_status || 'PENDING'}
                                                </span>
                                              </div>
                                              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                                                Address: {order.delivery_address || 'Colombo Delivery Zone'}
                                              </div>

                                              {/* Items list */}
                                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                                {order.items?.map((item, idx) => (
                                                  <span key={idx} style={{ fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
                                                    • {item.product_name}: <strong>{item.qty_required} {item.unit}</strong>
                                                  </span>
                                                ))}
                                              </div>

                                              {/* Verification details */}
                                              {(order.stop_status === 'DELIVERED' || order.stop_status === 'FAILED') && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 6, borderTop: '1px dashed var(--color-border)', paddingTop: 6, fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                                                  <div>Received By: <strong>{order.receiver_name || '—'}</strong></div>
                                                  <div>Phone: <strong>{order.receiver_mobile || '—'}</strong></div>
                                                  {order.failed_reason && <div style={{ color: 'var(--color-danger)' }}>Reason: <strong>{order.failed_reason.replace('_', ' ')}</strong></div>}

                                                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                                                    {order.delivery_photo && (
                                                      <button
                                                        className="btn btn-ghost btn-sm text-primary"
                                                        onClick={() => handleViewPOD(order.delivery_photo, 'photo')}
                                                        style={{ padding: '2px 4px', fontSize: 11 }}
                                                      >
                                                        <Eye size={12} style={{ marginRight: 4 }} /> Photo
                                                      </button>
                                                    )}
                                                    {order.delivery_signature && (
                                                      <button
                                                        className="btn btn-ghost btn-sm text-primary"
                                                        onClick={() => handleViewPOD(order.delivery_signature, 'signature')}
                                                        style={{ padding: '2px 4px', fontSize: 11 }}
                                                      >
                                                        <Eye size={12} style={{ marginRight: 4 }} /> Signature
                                                      </button>
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>

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

      {/* ADMIN ROUTE & DRIVER OVERRIDES MODAL */}
      {showOverrideModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>Route & Driver Overrides: {overrideShipment?.shipment_number}</h3>
              <button className="modal-close" onClick={() => setShowOverrideModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveOverride}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '16px 0' }}>
                <div className="form-group">
                  <label>Assign Driver</label>
                  <select
                    className="form-control"
                    value={overrideDriverId}
                    onChange={e => {
                      setOverrideDriverId(e.target.value);
                      const selectedDriver = drivers.find(d => d.id === e.target.value);
                      if (selectedDriver && selectedDriver.vehicle_number) {
                        setOverrideVehicle(selectedDriver.vehicle_number);
                      }
                    }}
                  >
                    <option value="">Unassigned</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} — Status: {d.driver_status || 'AVAILABLE'} ({d.vehicle_number || 'No Vehicle'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Vehicle Number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={overrideVehicle}
                    onChange={e => setOverrideVehicle(e.target.value)}
                    placeholder="Vehicle Plate No."
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 700 }}>Adjust Delivery Sequence (Drag/Reorder Stops)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                    {overrideStops.map((stop, idx) => (
                      <div
                        key={stop.id}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: 10, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
                          borderRadius: 6
                        }}
                      >
                        <span style={{ fontSize: 13 }}>
                          <strong style={{ color: 'var(--color-primary)', marginRight: 6 }}>Stop #{idx + 1}:</strong>
                          {stop.order_number} ({stop.customer})
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={idx === 0}
                            onClick={() => handleMoveStopUp(idx)}
                            style={{ padding: '2px 6px' }}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={idx === overrideStops.length - 1}
                            onClick={() => handleMoveStopDown(idx)}
                            style={{ padding: '2px 6px' }}
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowOverrideModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={processing}>
                  Re-Optimize Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POD MEDIA VIEWER MODAL */}
      {podMediaUrl && (
        <div className="modal-overlay" onClick={() => setPodMediaUrl(null)}>
          <div className="modal-content" style={{ maxWidth: 420, padding: 16 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <h3 style={{ textTransform: 'capitalize' }}>Proof Of Delivery: {podMediaType}</h3>
              <button className="modal-close" onClick={() => setPodMediaUrl(null)}>&times;</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
              {podMediaType === 'photo' ? (
                <img
                  src={podMediaUrl}
                  alt="Captured POD"
                  style={{ maxWidth: '100%', maxHeight: 350, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--color-border)' }}
                />
              ) : (
                <img
                  src={podMediaUrl}
                  alt="Receiver Signature"
                  style={{ width: '100%', height: 'auto', background: 'rgba(255,255,255,0.05)', border: '2px dashed var(--color-border)', borderRadius: 8, padding: 8 }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
