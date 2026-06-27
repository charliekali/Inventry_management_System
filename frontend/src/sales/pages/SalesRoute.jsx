/**
 * SalesRoute.jsx
 * Dedicated "Route" module for Sales Person app.
 * Displays all customers/leads assigned to the logged-in sales person by the Super Admin.
 * Renders an interactive map showing their live GPS location and the road-matched route to the selected destination.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ordersAPI } from '../../api';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, PhoneCall, Navigation, Clock, CheckCircle2, X, ChevronRight, RefreshCw, AlertTriangle
} from 'lucide-react';

// ── Helper to fly map ────────────────────────────────────────────────────────
function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, 15, { duration: 1.2 });
    }
  }, [target, map]);
  return null;
}

// ── Custom Marker Icon Maker ──────────────────────────────────────────────────
function createCustomerMarkerIcon(name, status, isSelected) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';
  
  const color = status === 'PENDING' ? '#10b981' : '#3b82f6';
  const size = isSelected ? 40 : 32;
  const html = `
    <div style="position:relative; width:${size}px; height:${size}px;">
      ${isSelected ? `<div style="
        position:absolute; inset:-4px;
        border-radius:50%;
        border: 2.5px solid ${color};
        opacity:0.6;
        animation: route-live-ring 1.5s ease-out infinite;
      "></div>` : ''}
      <div style="
        position:absolute; inset:0;
        background:${color};
        border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        color:#fff; font-weight:900; font-size:${isSelected ? 13 : 11}px;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        font-family: system-ui, sans-serif;
      ">${initials}</div>
    </div>`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

export default function SalesRoute() {
  const [assigned, setAssigned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myLoc, setMyLoc] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [route, setRoute] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('acquiring'); // acquiring | active | error

  const watchIdRef = useRef(null);

  // Load assigned tasks/leads
  const loadAssigned = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await ordersAPI.listMyAssigned();
      setAssigned(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load assigned routes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssigned();
  }, [loadAssigned]);

  // Watch Sales Person's live location
  useEffect(() => {
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setMyLoc([pos.coords.latitude, pos.coords.longitude]);
          setGpsStatus('active');
        },
        (err) => {
          console.warn('GPS error:', err);
          setGpsStatus('error');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setGpsStatus('error');
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Fetch OSRM route to selected destination
  useEffect(() => {
    if (selectedItem && myLoc) {
      const lat = parseFloat(selectedItem.custom_fields?.latitude);
      const lng = parseFloat(selectedItem.custom_fields?.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        const fetchRoute = async () => {
          const url = `https://router.project-osrm.org/route/v1/driving/${myLoc[1]},${myLoc[0]};${lng},${lat}?overview=full&geometries=geojson`;
          try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
              const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
              setRoute({
                coordinates: coords,
                distance: data.routes[0].distance / 1000, // km
                duration: data.routes[0].duration / 60, // mins
              });
            } else {
              setRoute(null);
            }
          } catch (err) {
            console.warn('Routing failed:', err);
            setRoute(null);
          }
        };
        fetchRoute();
      }
    } else {
      setRoute(null);
    }
  }, [selectedItem, myLoc]);

  // Pin Current Location Action
  const handlePinLocation = async (item) => {
    if (!window.confirm(`Pin your current GPS location for ${item.customer_name || item.customer}?`)) return;
    if (!navigator.geolocation) {
      return toast.error('GPS is not supported on this device');
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const fields = {
            latitude: pos.coords.latitude.toString(),
            longitude: pos.coords.longitude.toString()
          };
          await ordersAPI.updateCustomFields(item.id, fields);
          toast.success('Location pinned successfully!');
          loadAssigned(true);
          // Auto-select the newly pinned item
          setSelectedItem(prev => ({ ...prev, custom_fields: { ...prev.custom_fields, ...fields } }));
          setFlyTarget([pos.coords.latitude, pos.coords.longitude]);
        } catch (err) {
          toast.error('Failed to pin location');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        toast.error('Failed to get location: ' + err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSelectRoute = (item) => {
    setSelectedItem(item);
    const lat = parseFloat(item.custom_fields?.latitude);
    const lng = parseFloat(item.custom_fields?.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      setFlyTarget([lat, lng]);
    } else {
      setFlyTarget(null);
      setRoute(null);
    }
  };

  const mappedItems = assigned.filter(item => {
    const lat = parseFloat(item.custom_fields?.latitude);
    const lng = parseFloat(item.custom_fields?.longitude);
    return !isNaN(lat) && !isNaN(lng);
  });

  const defaultCenter = myLoc || (mappedItems.length > 0 ? [parseFloat(mappedItems[0].custom_fields.latitude), parseFloat(mappedItems[0].custom_fields.longitude)] : [9.9252, 78.1198]);

  if (loading) {
    return (
      <div className="s-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--s-border)', borderTopColor: 'var(--s-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="s-page s-fade-in" style={{ padding: '0 0 16px 0', height: 'calc(100vh - 135px)', display: 'flex', flexDirection: 'column' }}>
      
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 16px 0', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--s-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Navigation size={20} color="var(--s-primary)" />
            Assigned Routes
          </h2>
          <p style={{ fontSize: 12, color: 'var(--s-text-3)', margin: '2px 0 0 0' }}>
            {assigned.length} locations assigned by Admin
          </p>
        </div>
        <button
          onClick={() => loadAssigned()}
          style={{ background: 'none', border: 'none', color: 'var(--s-text-3)', cursor: 'pointer', padding: 4 }}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {assigned.length === 0 ? (
        <div style={{ margin: '16px', background: 'var(--s-card)', border: '1px solid var(--s-border)', borderRadius: 16, padding: '40px 20px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <CheckCircle2 size={48} color="#10b981" style={{ marginBottom: 12, opacity: 0.8 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--s-text)', marginBottom: 6 }}>
            All Clear!
          </div>
          <div style={{ fontSize: 13, color: 'var(--s-text-3)' }}>
            No routes or customer visits assigned to you today.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          
          {/* ── Map Container ─────────────────────────────────────────────────── */}
          <div style={{ position: 'relative', flex: 1, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--s-border)', margin: '0 16px 12px' }}>
            <MapContainer
              center={defaultCenter}
              zoom={14}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />

              {flyTarget && <FlyTo target={flyTarget} />}

              {/* Live Sales Person Location Marker */}
              {myLoc && (
                <>
                  <CircleMarker
                    center={myLoc}
                    radius={10}
                    fillColor="#3b82f6"
                    color="#ffffff"
                    weight={2}
                    fillOpacity={0.25}
                  />
                  <CircleMarker
                    center={myLoc}
                    radius={4.5}
                    fillColor="#3b82f6"
                    color="#ffffff"
                    weight={1.5}
                    fillOpacity={1}
                  />
                </>
              )}

              {/* Road-snapped Route Polyline */}
              {route && route.coordinates && (
                <>
                  <Polyline
                    positions={route.coordinates}
                    color={selectedItem?.status === 'PENDING' ? '#10b981' : '#3b82f6'}
                    weight={6}
                    opacity={0.3}
                  />
                  <Polyline
                    positions={route.coordinates}
                    color={selectedItem?.status === 'PENDING' ? '#10b981' : '#3b82f6'}
                    weight={3.5}
                    opacity={0.95}
                  />
                </>
              )}

              {/* Assigned Location Markers */}
              {mappedItems.map(item => {
                const lat = parseFloat(item.custom_fields.latitude);
                const lng = parseFloat(item.custom_fields.longitude);
                const isSelected = selectedItem?.id === item.id;
                const icon = createCustomerMarkerIcon(item.customer_name || item.customer, item.status, isSelected);

                return (
                  <Marker
                    key={item.id}
                    position={[lat, lng]}
                    icon={icon}
                    eventHandlers={{ click: () => handleSelectRoute(item) }}
                  />
                );
              })}
            </MapContainer>

            {/* GPS Status Overlay */}
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 999,
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
              padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: gpsStatus === 'active' ? '#22c55e' : (gpsStatus === 'acquiring' ? '#f59e0b' : '#ef4444'),
                animation: gpsStatus === 'active' ? 'live-pulse-dot 1.5s infinite' : 'none'
              }} />
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>
                {gpsStatus === 'active' && 'GPS Active'}
                {gpsStatus === 'acquiring' && 'Acquiring GPS...'}
                {gpsStatus === 'error' && 'GPS Error'}
              </span>
            </div>

            {/* Float Bottom Card for selected destination */}
            {selectedItem && (
              <div style={{
                position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 999,
                background: 'var(--s-card)', border: '1px solid var(--s-border)',
                borderRadius: 14, padding: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                display: 'flex', flexDirection: 'column', gap: 8
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--s-text)' }}>
                      {selectedItem.customer_name || selectedItem.customer}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--s-text-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{selectedItem.invoice_number || selectedItem.order_number}</span>
                      {selectedItem.status === 'PENDING' && (
                        <span className="s-chip green" style={{ fontSize: 8, padding: '1px 4px', fontWeight: 800 }}>LEAD</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedItem(null); setRoute(null); }}
                    style={{ background: 'none', border: 'none', color: 'var(--s-text-3)', cursor: 'pointer', padding: 2 }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Distance & Duration */}
                {selectedItem.custom_fields?.latitude && selectedItem.custom_fields?.longitude ? (
                  route ? (
                    <div style={{ display: 'flex', gap: 12, background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--s-border)' }}>
                      <div style={{ fontSize: 12, color: 'var(--s-text-2)' }}>
                        🚗 <strong>{route.distance.toFixed(1)} km</strong> to customer
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--s-text-2)' }}>
                        ⏱ <strong>{Math.round(route.duration)} mins</strong> travel time
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--s-text-3)', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                      Calculating route...
                    </div>
                  )
                ) : (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(239,68,68,0.08)', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                    <AlertTriangle size={14} />
                    <span style={{ fontSize: 11.5, fontWeight: 600 }}>No GPS coordinates set for this customer.</span>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {selectedItem.custom_fields?.latitude && selectedItem.custom_fields?.longitude ? (
                    <button
                      onClick={() => {
                        const lat = parseFloat(selectedItem.custom_fields.latitude);
                        const lng = parseFloat(selectedItem.custom_fields.longitude);
                        const url = `https://www.google.com/maps/dir/?api=1&origin=${myLoc ? `${myLoc[0]},${myLoc[1]}` : ''}&destination=${lat},${lng}&travelmode=driving`;
                        window.open(url, '_blank');
                      }}
                      style={{
                        flex: 2,
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        color: '#fff', border: 'none', borderRadius: 10,
                        padding: '10px 14px', fontSize: 13, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
                      }}
                    >
                      <Navigation size={14} fill="#fff" />
                      Navigate
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePinLocation(selectedItem)}
                      style={{
                        flex: 2,
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#fff', border: 'none', borderRadius: 10,
                        padding: '10px 14px', fontSize: 13, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
                      }}
                    >
                      <MapPin size={14} />
                      Pin Current Location
                    </button>
                  )}

                  {selectedItem.custom_fields?.phone && (
                    <button
                      onClick={() => window.open(`tel:${selectedItem.custom_fields.phone}`)}
                      style={{
                        flex: 1, background: 'var(--s-surface)', border: '1px solid var(--s-border)',
                        color: 'var(--s-text)', borderRadius: 10, padding: '10px',
                        fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      📞 Call
                    </button>
                  )}

                  {/* Re-pin location if it already exists */}
                  {selectedItem.custom_fields?.latitude && selectedItem.custom_fields?.longitude && (
                    <button
                      onClick={() => handlePinLocation(selectedItem)}
                      style={{
                        flex: 1, background: 'var(--s-surface)', border: '1px solid var(--s-border)',
                        color: 'var(--s-text)', borderRadius: 10, padding: '10px',
                        fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="Update GPS Location"
                    >
                      📍 Re-Pin
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── List of Assigned Locations ────────────────────────────────────── */}
          <div style={{ padding: '0 16px', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--s-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Assigned Visits
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
              {assigned.map(item => {
                const isSelected = selectedItem?.id === item.id;
                const hasGps = item.custom_fields?.latitude && item.custom_fields?.longitude;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectRoute(item)}
                    style={{
                      background: isSelected ? 'rgba(59,130,246,0.08)' : 'var(--s-card)',
                      border: `1px solid ${isSelected ? 'var(--s-primary)' : 'var(--s-border)'}`,
                      borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.15s'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--s-text)', marginBottom: 2 }}>
                        {item.customer_name || item.customer}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--s-text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{item.invoice_number || item.order_number}</span>
                        {item.status === 'PENDING' && <span className="s-chip green" style={{ fontSize: 8, padding: '0px 4px' }}>LEAD</span>}
                        <span style={{ color: hasGps ? '#10b981' : '#f59e0b' }}>
                          {hasGps ? '• GPS Pinned' : '• No GPS'}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} color={isSelected ? 'var(--s-primary)' : 'var(--s-text-3)'} />
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes route-live-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes live-pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
