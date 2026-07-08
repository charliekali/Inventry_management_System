import { useState, useEffect, useRef } from 'react';
import { shipmentsAPI } from '../../api';
import toast from 'react-hot-toast';
import { Truck, Navigation, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Phone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const DEPOT_LAT = 13.0827;
const DEPOT_LNG = 80.2707;

export default function LogisticsShipments() {
  const { user, hasPermission } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Driver detection — same logic as LogisticsHome
  const isDriver = !hasPermission('DISPATCH:VIEW');

  // Delivery Modal State
  const [showModal, setShowModal] = useState(false);
  const [activeShipment, setActiveShipment] = useState(null);
  const [activeStop, setActiveStop] = useState(null);
  
  // Form Fields
  const [outcome, setOutcome] = useState('DELIVERED');
  const [notes, setNotes] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverMobile, setReceiverMobile] = useState('');
  const [failedReason, setFailedReason] = useState('CUSTOMER_NOT_AVAILABLE');
  const [photoBase64, setPhotoBase64] = useState('');
  const [signatureBase64, setSignatureBase64] = useState('');

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Stats
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0, pending: 0 });

  const loadShipments = () => {
    setLoading(true);
    const fetchPromise = isDriver ? shipmentsAPI.listAssigned() : shipmentsAPI.list();

    fetchPromise
      .then(r => {
        const data = r.data.data;
        setOrdersGroup(data);
        calculateStats(data);
      })
      .catch(() => toast.error('Failed to load shipments'))
      .finally(() => setLoading(false));
  };

  const calculateStats = (data) => {
    let total = 0;
    let completed = 0;
    let failed = 0;
    let pending = 0;
    data.forEach(s => {
      s.orders?.forEach(o => {
        total++;
        if (o.stop_status === 'DELIVERED') {
          completed++;
        } else if (o.stop_status === 'FAILED') {
          failed++;
        } else {
          pending++;
        }
      });
    });
    setStats({ total, completed, failed, pending });
  };

  const setOrdersGroup = (data) => {
    const sorted = [...data].sort((a, b) => {
      const order = { 'EN_ROUTE': 0, 'CREATED': 1, 'DELIVERED': 2, 'FAILED': 3 };
      return (order[a.status] ?? 4) - (order[b.status] ?? 4);
    });
    setShipments(sorted);
  };

  // Report active GPS coordinates
  const reportGPSLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        shipmentsAPI.reportLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    loadShipments();
    reportGPSLocation();
    
    const interval = setInterval(() => {
      reportGPSLocation();
    }, 60000); // report location every 60s
    return () => clearInterval(interval);
  }, []);

  const handleStartTrip = async (id) => {
    if (!window.confirm('Start delivery trip? This will set shipment status to En Route.')) return;
    setProcessing(true);
    try {
      await shipmentsAPI.updateStatus(id, 'EN_ROUTE');
      toast.success('Trip started! Drive safe.');
      loadShipments();
      reportGPSLocation();
    } catch {
      toast.error('Failed to start trip');
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenDelivery = (shipment, stop) => {
    setActiveShipment(shipment);
    setActiveStop(stop);
    setNotes('');
    setReceiverName(stop.customer || '');
    setReceiverMobile('');
    setOutcome('DELIVERED');
    setFailedReason('CUSTOMER_NOT_AVAILABLE');
    setPhotoBase64('');
    setSignatureBase64('');
    setShowModal(true);
  };

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Signature drawing events
  const startDrawing = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && canvasRef.current) {
      setSignatureBase64(canvasRef.current.toDataURL());
    }
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureBase64('');
    }
  };

  const handleConfirmDelivery = async (e) => {
    e.preventDefault();
    if (!activeShipment || !activeStop) return;
    
    if (outcome === 'DELIVERED' && !signatureBase64) {
      toast.error('Customer signature is required for delivery.');
      return;
    }

    setProcessing(true);
    
    // Get current location coordinates
    let latitude = null;
    let longitude = null;
    if (navigator.geolocation) {
      await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            latitude = pos.coords.latitude;
            longitude = pos.coords.longitude;
            resolve();
          },
          () => resolve(),
          { timeout: 3000 }
        );
      });
    }

    try {
      await shipmentsAPI.updateStopStatus(activeShipment.id, activeStop.stop_id, {
        status: outcome,
        delivery_notes: notes,
        delivery_photo: photoBase64,
        delivery_signature: signatureBase64,
        receiver_name: receiverName,
        receiver_mobile: receiverMobile,
        failed_reason: outcome === 'FAILED' ? failedReason : null,
        latitude,
        longitude
      });
      toast.success(outcome === 'DELIVERED' ? 'Stop delivered successfully!' : 'Stop marked failed');
      setShowModal(false);
      loadShipments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit status');
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

  const getStopStatusBadge = (status) => {
    switch (status) {
      case 'PENDING': return <span className="badge badge-gray" style={{ fontSize: 9.5 }}>Pending</span>;
      case 'DELIVERED': return <span className="badge badge-green" style={{ fontSize: 9.5 }}>Delivered</span>;
      case 'FAILED': return <span className="badge badge-red" style={{ fontSize: 9.5 }}>Failed</span>;
      default: return <span className="badge badge-gray" style={{ fontSize: 9.5 }}>{status}</span>;
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
      {/* Daily Summary Stats Panel */}
      <div className="w-card" style={{ padding: 14, marginBottom: 16, background: 'linear-gradient(135deg, var(--w-card), rgba(6,182,212,0.08))', border: '1px solid var(--w-border)' }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: 'var(--w-text-2)', marginBottom: 8 }}>Today's Delivery Progress</h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--w-text)' }}>{stats.total}</div>
            <div style={{ fontSize: 10, color: 'var(--w-text-3)', fontWeight: 600 }}>Total Stops</div>
          </div>
          <div style={{ borderLeft: '1px solid var(--w-border)', height: 28, alignSelf: 'center' }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#10b981' }}>{stats.completed}</div>
            <div style={{ fontSize: 10, color: 'var(--w-text-3)', fontWeight: 600 }}>Delivered</div>
          </div>
          <div style={{ borderLeft: '1px solid var(--w-border)', height: 28, alignSelf: 'center' }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#ef4444' }}>{stats.failed}</div>
            <div style={{ fontSize: 10, color: 'var(--w-text-3)', fontWeight: 600 }}>Failed</div>
          </div>
          <div style={{ borderLeft: '1px solid var(--w-border)', height: 28, alignSelf: 'center' }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--w-primary)' }}>{stats.pending}</div>
            <div style={{ fontSize: 10, color: 'var(--w-text-3)', fontWeight: 600 }}>Remaining</div>
          </div>
        </div>
      </div>

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
            const isExpanded = expandedId === s.id || shipments.length === 1;
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
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Navigation size={14} color="var(--w-text-3)" />
                    <span>Distance / Est: <strong style={{ color: 'var(--w-text)' }}>{s.distance_km || 0} km (~{s.duration_min || 0} mins)</strong></span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <CheckCircle2 size={14} color="var(--w-text-3)" />
                    <span>Stops: <strong style={{ color: 'var(--w-text)' }}>{s.orders?.length} deliveries ({s.total_bags} bags)</strong></span>
                  </div>
                </div>

                {/* Actions Accordion Toggle */}
                {shipments.length > 1 && (
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
                    <span>{isExpanded ? 'Hide Delivery Stops' : 'View Delivery Stops'}</span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                )}

                {/* Collapsible stops details */}
                {isExpanded && (
                  <div style={{ marginTop: 10, padding: 10, background: 'rgba(255,255,255,0.01)', borderRadius: 6, border: '1px solid var(--w-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {s.orders?.map(order => {
                      const isPending = order.stop_status === 'PENDING';
                      
                      return (
                        <div key={order.id} style={{ borderBottom: '1px solid var(--w-border)', paddingBottom: 10, marginBottom: 6, lastChild: { borderBottom: 'none', paddingBottom: 0 } }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                            <span>Stop #{order.stop_sequence ?? (s.orders.indexOf(order) + 1)}: {order.order_number}</span>
                            {getStopStatusBadge(order.stop_status)}
                          </div>
                          
                          <div style={{ fontSize: 12, color: 'var(--w-text-2)' }}>Customer: <strong>{order.customer}</strong></div>
                          <div style={{ fontSize: 12, color: 'var(--w-text-3)', marginTop: 2 }}>Address: {order.delivery_address || 'Colombo Delivery Zone'}</div>
                          
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 10 }}>
                            {order.items?.map((item, idx) => (
                              <span key={idx} className="badge badge-gray" style={{ fontSize: 10.5 }}>
                                {item.product_name} ({item.qty_required} {item.unit})
                              </span>
                            ))}
                          </div>

                          {/* Stop actions (shown only when shipment is EN_ROUTE) */}
                          {s.status === 'EN_ROUTE' && isPending && (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${order.latitude || DEPOT_LAT},${order.longitude || DEPOT_LNG}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="w-btn ghost sm"
                                style={{ flex: 1, textAlign: 'center', padding: '6px 10px', fontSize: 11.5, textDecoration: 'none', border: '1px solid var(--w-border)', borderRadius: 4 }}
                              >
                                Navigate
                              </a>
                              <button
                                className="w-btn sm"
                                onClick={() => handleOpenDelivery(s, order)}
                                style={{ flex: 1.5, background: '#10b981', color: 'white', border: 'none', padding: '6px 10px', fontSize: 11.5, fontWeight: 700, borderRadius: 4, cursor: 'pointer' }}
                              >
                                Confirm Delivery
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Primary status change buttons (shipment status itself) */}
                {s.status === 'CREATED' && hasPermission('SHIPMENTS:MANAGE') && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button
                      className="w-btn"
                      onClick={() => handleStartTrip(s.id)}
                      disabled={processing}
                      style={{ width: '100%', background: 'var(--w-primary)', border: 'none', color: 'white', fontWeight: 700, borderRadius: 6, padding: '10px 12px', fontSize: 13, cursor: 'pointer' }}
                    >
                      Start Delivery Route
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stop Delivery Confirmation Modal with Canvas Signature Pad */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          overflowY: 'auto'
        }}>
          <div className="w-card animate-slide-up" style={{ width: '100%', maxWidth: 420, padding: 16, border: '1px solid var(--w-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h4 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Confirm Stop: {activeStop?.order_number}</h4>
            
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
                  <option value="FAILED">Failed / Rejected Stop</option>
                </select>
              </div>

              {outcome === 'DELIVERED' ? (
                <>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                      <label style={{ fontSize: 11, color: 'var(--w-text-2)', fontWeight: 600 }}>Receiver Name</label>
                      <input 
                        type="text" 
                        value={receiverName}
                        onChange={e => setReceiverName(e.target.value)}
                        placeholder="Name"
                        style={{ background: 'var(--w-surface)', color: 'var(--w-text)', border: '1px solid var(--w-border)', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                      <label style={{ fontSize: 11, color: 'var(--w-text-2)', fontWeight: 600 }}>Receiver Phone</label>
                      <input 
                        type="text" 
                        value={receiverMobile}
                        onChange={e => setReceiverMobile(e.target.value)}
                        placeholder="Mobile No."
                        style={{ background: 'var(--w-surface)', color: 'var(--w-text)', border: '1px solid var(--w-border)', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none' }}
                      />
                    </div>
                  </div>

                  {/* HTML5 Canvas Signature Pad */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: 11, color: 'var(--w-text-2)', fontWeight: 600 }}>Receiver Signature (Draw below)</label>
                      <button type="button" onClick={clearCanvas} style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Clear</button>
                    </div>
                    <canvas
                      ref={canvasRef}
                      width={380}
                      height={120}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '2px dashed var(--w-border)',
                        borderRadius: 6,
                        cursor: 'crosshair',
                        touchAction: 'none'
                      }}
                    />
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: 'var(--w-text-2)', fontWeight: 600 }}>Reason for Failure</label>
                  <select 
                    value={failedReason}
                    onChange={e => setFailedReason(e.target.value)}
                    style={{
                      background: 'var(--w-surface)', color: 'var(--w-text)',
                      border: '1px solid var(--w-border)', borderRadius: 6, padding: '10px 12px',
                      outline: 'none', fontSize: 13.5
                    }}
                  >
                    <option value="CUSTOMER_NOT_AVAILABLE">Customer Not Available</option>
                    <option value="WRONG_ADDRESS">Wrong Address</option>
                    <option value="CUSTOMER_REFUSED">Customer Refused / Rejected</option>
                    <option value="PAYMENT_ISSUE">Payment Issue (COD)</option>
                    <option value="VEHICLE_BREAKDOWN">Vehicle / Logistics Issue</option>
                    <option value="OTHER">Other Reason</option>
                  </select>
                </div>
              )}

              {/* Photo POD Capture Trigger */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: 'var(--w-text-2)', fontWeight: 600 }}>Photo Verification (Optional)</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <label 
                    htmlFor="photo-file" 
                    className="w-btn ghost sm"
                    style={{ cursor: 'pointer', padding: '8px 12px', fontSize: 12, border: '1px solid var(--w-border)', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    Capture Photo
                  </label>
                  <input 
                    type="file" 
                    id="photo-file" 
                    accept="image/*" 
                    capture="environment" 
                    onChange={handlePhotoCapture} 
                    style={{ display: 'none' }} 
                  />
                  {photoBase64 ? (
                    <span style={{ fontSize: 11.5, color: '#10b981', fontWeight: 600 }}>✓ Photo captured</span>
                  ) : (
                    <span style={{ fontSize: 11.5, color: 'var(--w-text-3)' }}>No photo captured</span>
                  )}
                </div>
                {photoBase64 && (
                  <img 
                    src={photoBase64} 
                    alt="Captured Proof" 
                    style={{ width: '100%', maxHeight: 100, objectFit: 'cover', borderRadius: 6, marginTop: 8 }} 
                  />
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: 'var(--w-text-2)', fontWeight: 600 }}>Delivery / Failure Notes</label>
                <textarea 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Enter specific remarks, landmarks, or receiver instructions..."
                  style={{
                    background: 'var(--w-surface)', color: 'var(--w-text)',
                    border: '1px solid var(--w-border)', borderRadius: 6, padding: '10px 12px',
                    outline: 'none', fontSize: 13, height: 60, resize: 'none'
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
                  Confirm Stop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
