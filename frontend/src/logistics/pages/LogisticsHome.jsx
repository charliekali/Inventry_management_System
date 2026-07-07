import { useState, useEffect } from 'react';
import { dispatchAPI, shipmentsAPI } from '../../api';
import toast from 'react-hot-toast';
import { Truck, Package, Clock, RefreshCw, AlertTriangle, CheckCircle2, Navigation, MapPin, User, Power, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function OrderCard({ order, onDispatch, processing, hasPermission }) {
  const [checkedItems, setCheckedItems] = useState({});

  const items = order.items || [];
  const hasItems = items.length > 0;

  const toggleItem = (idx) => {
    setCheckedItems(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const checkedCount = items.filter((_, idx) => checkedItems[idx]).length;
  const isAllChecked = hasItems && checkedCount === items.length;

  return (
    <div className="w-card" style={{ padding: 16, border: '1px solid var(--w-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: 11, color: 'var(--w-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Order Ref</span>
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{order.order_number}</div>
        </div>
        <span className="badge badge-orange" style={{ fontSize: 10, textTransform: 'uppercase' }}>{order.dispatch_status}</span>
      </div>

      <div style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--w-text-3)' }}>Customer</span>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--w-text)', marginTop: 2 }}>{order.customer}</div>
      </div>

      {/* Items Checklist Section */}
      <div style={{ borderTop: '1px solid var(--w-border)', paddingTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--w-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Items to Dispatch</span>
          {hasItems && (
            <span style={{ fontSize: 11, fontWeight: 700, color: isAllChecked ? '#10b981' : 'var(--w-primary)' }}>
              Checked: {checkedCount}/{items.length}
            </span>
          )}
        </div>

        {/* Progress Bar */}
        {hasItems && (
          <div style={{ width: '100%', height: 4, background: 'var(--w-border)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ 
              width: `${(checkedCount / items.length) * 100}%`, 
              height: '100%', 
              background: isAllChecked ? '#10b981' : 'var(--w-primary)', 
              transition: 'width 0.3s ease, background-color 0.3s ease' 
            }} />
          </div>
        )}

        {!hasItems ? (
          <div style={{ 
            padding: 12, 
            background: 'rgba(239, 68, 68, 0.08)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            borderRadius: 6, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8 
          }}>
            <AlertTriangle size={16} color="#f87171" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#f87171', fontWeight: 500 }}>No items in this order. Cannot dispatch.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item, idx) => {
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

              const isChecked = !!checkedItems[idx];

              return (
                <div 
                  key={idx} 
                  onClick={() => toggleItem(idx)}
                  style={{ 
                    background: isChecked ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.01)', 
                    padding: 10, 
                    borderRadius: 8, 
                    border: isChecked ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--w-border)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}
                >
                  {/* Custom Checkbox */}
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    border: isChecked ? '2px solid #10b981' : '2px solid var(--w-text-3)',
                    background: isChecked ? '#10b981' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}>
                    {isChecked && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </div>

                  <div style={{ flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                      <span style={{ textDecoration: isChecked ? 'line-through' : 'none', color: isChecked ? 'var(--w-text-3)' : 'var(--w-text)', transition: 'all 0.2s ease' }}>
                        {item.product_name}
                      </span>
                      <span style={{ color: isChecked ? '#10b981' : 'var(--w-primary)', transition: 'all 0.2s ease' }}>
                        {qty} {item.unit}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--w-text-3)', marginTop: 2 }}>Code: {item.product_code}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--w-text-2)', marginTop: 6, paddingTop: 6, borderTop: '1px dotted var(--w-border)' }}>
                      <span>Config: {packInfo}</span>
                      {bagsCount !== null && (
                        <span style={{ fontWeight: 700, color: '#06b6d4' }}>Est. Bags: {bagsCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {hasPermission('DISPATCH:MANAGE') && (
        <button
          className="w-btn"
          onClick={() => onDispatch(order.id)}
          disabled={processing || !isAllChecked}
          style={{
            width: '100%',
            background: isAllChecked ? 'var(--w-primary)' : 'var(--w-border)',
            color: isAllChecked ? 'white' : 'var(--w-text-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 'var(--w-radius-sm)',
            border: 'none',
            cursor: isAllChecked ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s ease',
            opacity: isAllChecked ? 1 : 0.6
          }}
        >
          <Truck size={16} />
          {isAllChecked ? 'Mark Dispatched' : hasItems ? `Check all items (${checkedCount}/${items.length})` : 'Cannot Dispatch'}
        </button>
      )}
    </div>
  );
}

export default function LogisticsHome() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const isDriver = !hasPermission('DISPATCH:VIEW');

  // Dispatcher states
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Driver states
  const [assignedShipments, setAssignedShipments] = useState([]);
  const [loadingDriver, setLoadingDriver] = useState(false);
  const [reportingLoc, setReportingLoc] = useState(false);
  const [driverStatus, setDriverStatus] = useState(user?.driverStatus || 'AVAILABLE');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadDispatches = () => {
    setLoading(true);
    dispatchAPI.list('PENDING')
      .then(r => setOrders(r.data.data))
      .catch(() => toast.error('Failed to load pending dispatches'))
      .finally(() => setLoading(false));
  };

  const loadDriverDashboard = () => {
    setLoadingDriver(true);
    shipmentsAPI.listAssigned()
      .then(r => {
        setAssignedShipments(r.data.data);
      })
      .catch(() => toast.error('Failed to load driver shipments'))
      .finally(() => setLoadingDriver(false));
  };

  useEffect(() => {
    if (isDriver) {
      loadDriverDashboard();
    } else {
      loadDispatches();
    }
  }, [isDriver]);

  const handleDispatch = async (id) => {
    if (!window.confirm('Are you sure you want to mark this order as dispatched? This will calculate the total bags and pieces.')) return;
    setProcessing(true);
    try {
      const res = await dispatchAPI.complete(id);
      const data = res.data.data;
      toast.success(`Dispatched Successfully!\nBags: ${data.dispatch_bags} | Pcs: ${data.dispatch_pcs}`, { duration: 5000 });
      loadDispatches();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to dispatch order');
    } finally {
      setProcessing(false);
    }
  };

  const handleReportLocation = () => {
    if (!navigator.geolocation) {
      toast.error('GPS Geolocation is not supported by your device');
      return;
    }
    setReportingLoc(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        shipmentsAPI.reportLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        })
          .then(() => {
            toast.success('GPS coordinates reported successfully!');
            loadDriverDashboard();
          })
          .catch(() => toast.error('Failed to report active location'))
          .finally(() => setReportingLoc(false));
      },
      (err) => {
        toast.error('GPS tracking permission error: ' + err.message);
        setReportingLoc(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleStatusChange = (newStatus) => {
    setUpdatingStatus(true);
    shipmentsAPI.updateDriverStatus(newStatus)
      .then(r => {
        setDriverStatus(r.data.data.status);
        toast.success(`Duty status set to ${r.data.data.status}`);
      })
      .catch(() => toast.error('Failed to change status'))
      .finally(() => setUpdatingStatus(false));
  };

  // Driver View Rendering
  if (isDriver) {
    if (loadingDriver) {
      return (
        <div className="w-spinner-wrap">
          <div className="w-spinner" />
        </div>
      );
    }

    const activeShipment = assignedShipments.find(
      s => s.status === 'EN_ROUTE' || s.status === 'CREATED'
    );

    const completedShipments = assignedShipments.filter(
      s => s.status === 'DELIVERED' || s.status === 'FAILED'
    );

    // Calculate metrics for active shipment
    const totalStops = activeShipment?.orders?.length || 0;
    const completedStops = activeShipment?.orders?.filter(
      o => o.status === 'DELIVERED' || o.status === 'FAILED'
    ).length || 0;
    const remainingStops = totalStops - completedStops;

    const getStatusColor = (status) => {
      switch (status) {
        case 'AVAILABLE': return '#10b981'; // Emerald
        case 'BUSY': return '#f59e0b'; // Amber
        case 'OFFLINE': return '#6b7280'; // Gray
        case 'VEHICLE_BREAKDOWN': return '#ef4444'; // Red
        default: return '#3b82f6';
      }
    };

    return (
      <div className="w-page w-fade-in" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Driver Profile Header Card */}
        <div className="w-card" style={{ 
          padding: 16, 
          background: 'linear-gradient(135deg, var(--w-primary), #1d4ed8)', 
          border: 'none', 
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.1, pointerEvents: 'none' }}>
            <Truck size={120} color="white" />
          </div>
          
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ 
              width: 50, 
              height: 50, 
              borderRadius: '50%', 
              background: 'rgba(255,255,255,0.2)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 18
            }}>
              <User size={24} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{user?.name || 'Driver'}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                Vehicle No: <span style={{ fontWeight: 700 }}>{user?.vehicleNumber || 'WP-LH-4512'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Duty Status Selector Card */}
        <div className="w-card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Power size={18} style={{ color: getStatusColor(driverStatus) }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--w-text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Duty Status</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: getStatusColor(driverStatus) }}>
                {driverStatus.replace('_', ' ')}
              </div>
            </div>
          </div>
          
          <select 
            value={driverStatus} 
            disabled={updatingStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            style={{ 
              background: 'var(--w-card-bg)', 
              color: 'var(--w-text)', 
              border: '1px solid var(--w-border)', 
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="AVAILABLE">Available</option>
            <option value="BUSY">On Trip / Busy</option>
            <option value="OFFLINE">Offline</option>
            <option value="VEHICLE_BREAKDOWN">Breakdown</option>
          </select>
        </div>

        {/* Active Shipment Progress Panel */}
        {activeShipment ? (
          <div className="w-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 10, color: 'var(--w-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Active Route</span>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{activeShipment.id}</div>
              </div>
              <span className="badge badge-green" style={{ fontSize: 10 }}>{activeShipment.status}</span>
            </div>

            {/* Quick Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--w-border)', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--w-text-3)' }}>Completed Stops</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--w-text)', marginTop: 2 }}>
                  {completedStops} / {totalStops}
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--w-border)', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--w-text-3)' }}>Remaining Stops</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>
                  {remainingStops}
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <button
              className="w-btn"
              onClick={() => navigate('/logistics/shipments')}
              style={{
                width: '100%',
                background: 'var(--w-primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 14px',
                fontSize: 13.5,
                fontWeight: 700,
                borderRadius: 'var(--w-radius-sm)',
                border: 'none',
                cursor: 'pointer',
                marginTop: 4
              }}
            >
              <Navigation size={16} />
              Start Navigation Timeline
            </button>
          </div>
        ) : (
          <div className="w-card" style={{ 
            padding: 24, 
            textAlign: 'center', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: 12,
            background: 'rgba(255,255,255,0.01)'
          }}>
            <Truck size={36} color="var(--w-text-3)" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--w-text)' }}>No Assigned Shipment</div>
              <p style={{ fontSize: 12, color: 'var(--w-text-3)', marginTop: 4 }}>
                You are currently not assigned to any active shipments. Wait for dispatchers to release a route.
              </p>
            </div>
            <button 
              className="w-btn ghost sm" 
              onClick={loadDriverDashboard}
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}
            >
              <RefreshCw size={14} />
              Check for Work
            </button>
          </div>
        )}

        {/* Driver Utility / Quick Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--w-text-2)', textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 4 }}>
            Driver Actions
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            
            {/* GPS Reporter */}
            <button
              className="w-btn"
              onClick={handleReportLocation}
              disabled={reportingLoc}
              style={{
                background: 'rgba(6, 182, 212, 0.08)',
                color: '#06b6d4',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 14px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 'var(--w-radius-sm)',
                cursor: 'pointer'
              }}
            >
              <MapPin size={16} />
              {reportingLoc ? 'Uploading Coordinates...' : 'Report Current GPS Coordinates'}
            </button>

            {/* History Link */}
            <button
              className="w-btn"
              onClick={() => navigate('/logistics/history')}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                color: 'var(--w-text)',
                border: '1px solid var(--w-border)',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 14px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 'var(--w-radius-sm)',
                cursor: 'pointer'
              }}
            >
              <Clock size={16} />
              View Completed Deliveries ({completedShipments.length})
            </button>

          </div>
        </div>

      </div>
    );
  }

  // Dispatcher View Rendering
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
          <h3 style={{ fontSize: 18, fontWeight: 800 }}>Pending Dispatches</h3>
          <p style={{ fontSize: 12, color: 'var(--w-text-2)', marginTop: 2 }}>
            {orders.length === 0 ? 'No orders awaiting dispatch' : `${orders.length} orders ready to dispatch`}
          </p>
        </div>
        <button className="w-btn ghost sm" onClick={loadDispatches} style={{ minWidth: 'auto', padding: 8 }}>
          <RefreshCw size={16} />
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="w-card" style={{ padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Package size={36} color="var(--w-text-3)" />
          <p style={{ fontSize: 13.5, color: 'var(--w-text-2)' }}>All orders have been dispatched!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orders.map(order => (
            <OrderCard 
              key={order.id} 
              order={order} 
              onDispatch={handleDispatch} 
              processing={processing} 
              hasPermission={hasPermission} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
