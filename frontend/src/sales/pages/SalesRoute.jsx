/**
 * SalesRoute.jsx
 * Google Maps-style navigation for Sales staff.
 * - Smooth road-snapped polyline with casing (blue inner + white border)
 * - Full-screen driving HUD with turn instruction, speed, ETA
 * - Fixed Re-Center button using forceCenter counter trick
 * - Exit Navigation positioned separately from Re-Center
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ordersAPI, visitAllocationsAPI } from '../../api';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, PhoneCall, Navigation, Clock, CheckCircle2, X,
  ChevronRight, RefreshCw, AlertTriangle, ArrowUp,
  ArrowUpLeft, ArrowUpRight, ArrowLeft, ArrowRight,
  Check, LocateFixed, Gauge
} from 'lucide-react';

// ─── FlyTo (non-navigation mode) ─────────────────────────────────────────────
function FlyTo({ target, zoom = 15 }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, zoom, { duration: 1.0 });
  }, [target, zoom, map]);
  return null;
}

// ─── NavigationCenterer — locks map on driver, forceCenter triggers re-lock ──
function NavigationCenterer({ target, isNavigating, autoCenter, forceCenter }) {
  const map = useMap();
  const prevForce = useRef(forceCenter);

  useEffect(() => {
    if (!isNavigating || !target || !autoCenter) return;
    map.setView(target, 17, { animate: false });
  }, [target, isNavigating, autoCenter, map]);

  // Re-center immediately when forceCenter counter increments
  useEffect(() => {
    if (forceCenter !== prevForce.current && target && isNavigating) {
      map.setView(target, 17, { animate: true, duration: 0.5 });
      prevForce.current = forceCenter;
    }
  }, [forceCenter, target, isNavigating, map]);

  return null;
}

// ─── MapInteractionListener — pauses follow mode on manual pan/zoom ──────────
function MapInteractionListener({ setAutoCenter }) {
  const map = useMap();
  useEffect(() => {
    const off = () => setAutoCenter(false);
    map.on('dragstart', off);
    map.on('zoomstart', off);
    return () => { map.off('dragstart', off); map.off('zoomstart', off); };
  }, [map, setAutoCenter]);
  return null;
}

// ─── Driving arrow icon (heading-rotated) ────────────────────────────────────
function createDrivingIcon(heading) {
  const rot = (heading != null && !isNaN(heading)) ? heading : 0;
  const html = `
    <div style="
      width:48px;height:48px;
      display:flex;align-items:center;justify-content:center;
      transform:rotate(${rot}deg);
      transition:transform 0.3s ease-out;
      filter:drop-shadow(0 3px 8px rgba(0,0,0,0.45));
    ">
      <svg width="36" height="36" viewBox="0 0 36 36">
        <!-- White border -->
        <path d="M18 2L33 34L18 26L3 34Z" fill="white"/>
        <!-- Blue fill -->
        <path d="M18 5L30 32L18 24.5L6 32Z" fill="#1A73E8"/>
        <!-- White dot at base -->
        <circle cx="18" cy="24" r="3" fill="white"/>
      </svg>
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [48, 48], iconAnchor: [24, 24] });
}

// ─── Static location dot (non-nav) ────────────────────────────────────────────
function createLocDot() {
  const html = `
    <div style="position:relative;width:24px;height:24px;">
      <div style="
        position:absolute;inset:0;border-radius:50%;
        background:rgba(26,115,232,0.2);
        animation:sr-pulse 2s ease-in-out infinite;
      "></div>
      <div style="
        position:absolute;inset:5px;border-radius:50%;
        background:#1A73E8;border:2.5px solid white;
        box-shadow:0 2px 6px rgba(26,115,232,0.5);
      "></div>
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [24, 24], iconAnchor: [12, 12] });
}

// ─── Customer marker ─────────────────────────────────────────────────────────
function createCustomerMarkerIcon(name, visitStatus, isSelected) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';
  const color = visitStatus === 'COMPLETED' ? '#1a9e5c'
              : visitStatus === 'SKIPPED'   ? '#e53935'
              : isSelected                  ? '#1A73E8'
              :                              '#34A853';
  const size = isSelected ? 42 : 34;
  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;">
      ${isSelected ? `<div style="
        position:absolute;inset:-5px;border-radius:50%;
        border:2px solid ${color};opacity:0.5;
        animation:sr-ring 1.6s ease-out infinite;
      "></div>` : ''}
      <div style="
        position:absolute;inset:0;background:${color};
        border-radius:50%;display:flex;align-items:center;justify-content:center;
        color:#fff;font-weight:900;font-size:${isSelected ? 14 : 12}px;
        border:2.5px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3);
        font-family:system-ui,sans-serif;
      ">${initials}</div>
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size/2, size/2] });
}

// ─── Haversine distance ───────────────────────────────────────────────────────
function distM(lat1, lon1, lat2, lon2) {
  const R  = 6371e3;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const dφ = (lat2 - lat1) * Math.PI / 180;
  const dλ = (lon2 - lon1) * Math.PI / 180;
  const a  = Math.sin(dφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(dλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function minDistToPolyline(lat, lng, poly) {
  if (!poly?.length) return Infinity;
  return Math.min(...poly.map(p => distM(lat, lng, p[0], p[1])));
}

// ─── Step instruction formatters ─────────────────────────────────────────────
function stepInstruction(step) {
  if (!step) return 'Follow the route';
  const { type, modifier = '' } = step.maneuver;
  const road = step.name ? `onto ${step.name}` : '';
  const dist = step.distance > 0 ? ` in ${Math.round(step.distance)}m` : '';
  if (type === 'depart') return `Head towards ${step.name || 'start'}`;
  if (type === 'arrive') return `You have arrived`;
  if (type === 'roundabout') return `Take the roundabout${road}`;
  if (modifier.includes('sharp left'))  return `Sharp left ${road}${dist}`;
  if (modifier.includes('sharp right')) return `Sharp right ${road}${dist}`;
  if (modifier.includes('slight left')) return `Slight left ${road}${dist}`;
  if (modifier.includes('slight right'))return `Slight right ${road}${dist}`;
  if (modifier.includes('left'))        return `Turn left ${road}${dist}`;
  if (modifier.includes('right'))       return `Turn right ${road}${dist}`;
  if (modifier.includes('uturn'))       return `Make a U-turn${dist}`;
  return `Continue straight ${road}${dist}`;
}

function TurnIcon({ step, size = 28, color = '#1A73E8' }) {
  if (!step) return <ArrowUp size={size} color={color} />;
  const m = step.maneuver.modifier || '';
  const t = step.maneuver.type || '';
  if (t === 'arrive') return <MapPin size={size} color="#e53935" />;
  if (m.includes('left'))  return <ArrowUpLeft  size={size} color={color} />;
  if (m.includes('right')) return <ArrowUpRight size={size} color={color} />;
  if (m.includes('uturn')) return <ArrowLeft    size={size} color={color} />;
  return <ArrowUp size={size} color={color} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SalesRoute() {
  const { theme } = useTheme();
  const location  = useLocation();
  const routeState = location.state;
  const isDark    = theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const [assigned,       setAssigned]       = useState([]);
  const [useAllocations, setUseAllocations] = useState(true);
  const [loading,        setLoading]        = useState(true);
  const [myLoc,          setMyLoc]          = useState(null);
  const [myHeading,      setMyHeading]      = useState(null);
  const [mySpeed,        setMySpeed]        = useState(0); // km/h from GPS
  const [mapType,        setMapType]        = useState('roadmap');
  const [selectedItem,   setSelectedItem]   = useState(null);
  const [route,          setRoute]          = useState(null);
  const [steps,          setSteps]          = useState([]);
  const [stepIdx,        setStepIdx]        = useState(0);
  const [flyTarget,      setFlyTarget]      = useState(null);
  const [gpsStatus,      setGpsStatus]      = useState('acquiring');

  const [isNavigating, setIsNavigating] = useState(false);
  const [autoCenter,   setAutoCenter]   = useState(true);
  const [forceCenter,  setForceCenter]  = useState(0); // increment to force re-center

  const watchIdRef = useRef(null);

  // ── Load assigned tasks ───────────────────────────────────────────────────
  const loadAssigned = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const rv = await visitAllocationsAPI.listMy({ date: today });
      const visits = rv.data.data || [];
      if (visits.length > 0) {
        setAssigned(visits); setUseAllocations(true);
      } else {
        const ro = await ordersAPI.listMyAssigned();
        setAssigned(ro.data.data || []); setUseAllocations(false);
      }
    } catch {
      try {
        const ro = await ordersAPI.listMyAssigned();
        setAssigned(ro.data.data || []); setUseAllocations(false);
      } catch { toast.error('Failed to load routes'); }
    } finally { setLoading(false); }
  }, []);

  const handleUpdateVisitStatus = async (id, status) => {
    setLoading(true);
    try {
      await visitAllocationsAPI.updateStatus(id, status);
      toast.success(`Marked as ${status.toLowerCase()}`);
      await loadAssigned(true);
      setSelectedItem(p => p?.id === id ? { ...p, visit_status: status } : p);
    } catch { toast.error('Failed to update visit'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAssigned(); }, [loadAssigned]);

  // ── GPS watch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus('error'); return; }
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        setMyLoc([pos.coords.latitude, pos.coords.longitude]);
        setMyHeading(pos.coords.heading);
        setMySpeed(pos.coords.speed != null ? (pos.coords.speed * 3.6) : 0);
        setGpsStatus('active');
      },
      err => { console.warn('GPS:', err); setGpsStatus('error'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, []);

  // ── Fetch OSRM route (with off-route threshold) ───────────────────────────
  useEffect(() => {
    if (!selectedItem || !myLoc) { setRoute(null); setSteps([]); return; }
    const lat = parseFloat(selectedItem.custom_fields?.latitude);
    const lng = parseFloat(selectedItem.custom_fields?.longitude);
    if (isNaN(lat) || isNaN(lng)) { setRoute(null); setSteps([]); return; }

    // Don't refetch if still close to route (< 100 m)
    if (route?.coordinates?.length > 0) {
      const d = minDistToPolyline(myLoc[0], myLoc[1], route.coordinates);
      if (d < 100) return;
    }

    const fetchRoute = async () => {
      const url = `https://router.project-osrm.org/route/v1/driving/${myLoc[1]},${myLoc[0]};${lng},${lat}?overview=full&geometries=geojson&steps=true`;
      try {
        const res  = await fetch(url);
        const data = await res.json();
        if (data.code === 'Ok' && data.routes?.length > 0) {
          const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
          setRoute({
            coordinates: coords,
            distance: data.routes[0].distance / 1000,
            duration: data.routes[0].duration / 60,
          });
          setSteps(data.routes[0].legs[0].steps || []);
          setStepIdx(0);
        } else { setRoute(null); setSteps([]); }
      } catch { setRoute(null); setSteps([]); }
    };
    fetchRoute();
  }, [selectedItem, myLoc]); // eslint-disable-line

  // ── Pre-selected route from CRM ────────────────────────────────────────────
  useEffect(() => {
    if (routeState?.preselectedItemId && assigned.length > 0) {
      const match = assigned.find(i => i.id === routeState.preselectedItemId);
      if (match) {
        setSelectedItem(match);
        const lat = parseFloat(match.custom_fields?.latitude);
        const lng = parseFloat(match.custom_fields?.longitude);
        if (!isNaN(lat) && !isNaN(lng)) setFlyTarget([lat, lng]);
        setIsNavigating(true);
      }
    }
  }, [routeState, assigned]);

  // ── Auto-advance steps ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isNavigating || !steps.length || stepIdx >= steps.length - 1 || !myLoc) return;
    const next = steps[stepIdx + 1];
    const d = distM(myLoc[0], myLoc[1], next.maneuver.location[1], next.maneuver.location[0]);
    if (d < 25) setStepIdx(p => p + 1);
  }, [isNavigating, myLoc, steps, stepIdx]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePinLocation = async (item) => {
    if (!window.confirm(`Pin your GPS for ${item.customer_name || item.customer}?`)) return;
    if (!navigator.geolocation) return toast.error('GPS not available');
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const fields = {
            latitude:  pos.coords.latitude.toString(),
            longitude: pos.coords.longitude.toString(),
          };
          await ordersAPI.updateCustomFields(item.order_id || item.id, fields);
          toast.success('Location pinned!');
          loadAssigned();
          setSelectedItem(p => ({ ...p, custom_fields: { ...p?.custom_fields, ...fields } }));
          setFlyTarget([pos.coords.latitude, pos.coords.longitude]);
        } catch { toast.error('Failed to pin location'); }
        finally { setLoading(false); }
      },
      err => { toast.error('GPS error: ' + err.message); setLoading(false); },
      { enableHighAccuracy: true }
    );
  };

  const handleSelectRoute = (item) => {
    if (isNavigating) return;
    setSelectedItem(item);
    const lat = parseFloat(item.custom_fields?.latitude);
    const lng = parseFloat(item.custom_fields?.longitude);
    if (!isNaN(lat) && !isNaN(lng)) setFlyTarget([lat, lng]);
    else { setFlyTarget(null); setRoute(null); setSteps([]); }
  };

  const handleStartNavigation = () => {
    setIsNavigating(true);
    setAutoCenter(true);
    setForceCenter(c => c + 1);
  };

  const handleReCenter = () => {
    setAutoCenter(true);
    setForceCenter(c => c + 1); // triggers NavigationCenterer even if myLoc unchanged
  };

  const handleExitNavigation = () => {
    setIsNavigating(false);
    setFlyTarget(null);
    setAutoCenter(true);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const mappedItems    = assigned.filter(i => {
    const lat = parseFloat(i.custom_fields?.latitude);
    const lng = parseFloat(i.custom_fields?.longitude);
    return !isNaN(lat) && !isNaN(lng);
  });
  const defaultCenter  = myLoc || (mappedItems[0]
    ? [parseFloat(mappedItems[0].custom_fields.latitude), parseFloat(mappedItems[0].custom_fields.longitude)]
    : [9.9252, 78.1198]);

  const routeColor   = '#1A73E8'; // Google Maps blue
  const remainingDist = route ? route.distance.toFixed(1) : null;
  const remainingEta  = route ? Math.round(route.duration) : null;

  if (loading) return (
    <div className="s-page" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <div style={{ width:32, height:32, border:'3px solid var(--s-border)', borderTopColor:'#1A73E8', borderRadius:'50%', animation:'sr-spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div className="s-page s-fade-in" style={{ padding:'0 0 16px 0', height:'calc(100vh - 135px)', display:'flex', flexDirection:'column' }}>

      {/* ── Header (hidden in nav mode) ──────────────────────────────────── */}
      {!isNavigating && (
        <div style={{ padding:'16px 16px 0', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h2 style={{ fontSize:18, fontWeight:800, color:'var(--s-text)', margin:0, display:'flex', alignItems:'center', gap:8 }}>
              <Navigation size={20} color="#1A73E8" />
              {useAllocations ? 'Scheduled Visits' : 'Assigned Routes'}
            </h2>
            <p style={{ fontSize:12, color:'var(--s-text-3)', margin:'2px 0 0 0' }}>
              {assigned.length} location{assigned.length !== 1 ? 's' : ''} today
            </p>
          </div>
          <button onClick={() => loadAssigned()}
            style={{ background:'none', border:'none', color:'var(--s-text-3)', cursor:'pointer', padding:4 }}>
            <RefreshCw size={16} />
          </button>
        </div>
      )}

      {assigned.length === 0 ? (
        <div style={{ margin:'16px', background:'var(--s-card)', border:'1px solid var(--s-border)', borderRadius:16, padding:'40px 20px', textAlign:'center', flex:1, display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center' }}>
          <CheckCircle2 size={48} color="#34A853" style={{ marginBottom:12, opacity:0.8 }} />
          <div style={{ fontSize:16, fontWeight:700, color:'var(--s-text)', marginBottom:6 }}>All Clear!</div>
          <div style={{ fontSize:13, color:'var(--s-text-3)' }}>No routes assigned for today.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>

          {/* ── Map ──────────────────────────────────────────────────────── */}
          <div style={{
            position:'relative', flex:1,
            borderRadius: isNavigating ? 0 : 16,
            overflow:'hidden',
            border: isNavigating ? 'none' : '1px solid var(--s-border)',
            margin: isNavigating ? '0' : '0 16px 10px',
          }}>
            <MapContainer
              center={defaultCenter}
              zoom={isNavigating ? 17 : 14}
              style={{ height:'100%', width:'100%' }}
              zoomControl={false}
            >
              {/* Tile layer */}
              <TileLayer
                attribution="&copy; Google Maps"
                url={mapType === 'hybrid'
                  ? "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                  : "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"}
                subdomains={['mt0','mt1','mt2','mt3']}
                className={(isDark && mapType !== 'hybrid') ? 'leaflet-dark-filter' : ''}
              />

              {/* Fly helper (non-nav) */}
              {flyTarget && !isNavigating && <FlyTo target={flyTarget} zoom={15} />}

              {/* Map interaction + auto-center */}
              <MapInteractionListener setAutoCenter={setAutoCenter} />
              <NavigationCenterer
                target={myLoc}
                isNavigating={isNavigating}
                autoCenter={autoCenter}
                forceCenter={forceCenter}
              />

              {/* My location */}
              {myLoc && (
                isNavigating
                  ? <Marker position={myLoc} icon={createDrivingIcon(myHeading)} />
                  : <Marker position={myLoc} icon={createLocDot()} />
              )}

              {/* Route polyline — Google Maps style: white casing + blue line */}
              {route?.coordinates?.length > 0 && (
                <>
                  {/* White border / casing */}
                  <Polyline positions={route.coordinates} color="#ffffff" weight={11} opacity={0.85} />
                  {/* Blue inner line */}
                  <Polyline positions={route.coordinates} color={routeColor} weight={7} opacity={1} />
                </>
              )}

              {/* Destination markers */}
              {!isNavigating && mappedItems.map(item => {
                const lat = parseFloat(item.custom_fields.latitude);
                const lng = parseFloat(item.custom_fields.longitude);
                const sel = selectedItem?.id === item.id;
                return (
                  <Marker
                    key={item.id}
                    position={[lat, lng]}
                    icon={createCustomerMarkerIcon(item.customer_name || item.customer, item.visit_status, sel)}
                    eventHandlers={{ click: () => handleSelectRoute(item) }}
                  />
                );
              })}

              {/* Destination pin in nav mode */}
              {isNavigating && selectedItem?.custom_fields?.latitude && (
                <CircleMarker
                  center={[parseFloat(selectedItem.custom_fields.latitude), parseFloat(selectedItem.custom_fields.longitude)]}
                  radius={10}
                  fillColor="#e53935"
                  color="#ffffff"
                  weight={3}
                  fillOpacity={1}
                />
              )}
            </MapContainer>

            {/* ── Navigation HUD (top turn instruction) ──────────────────── */}
            {isNavigating && steps.length > 0 && (
              <div style={{
                position:'absolute', top:12, left:12, right:12, zIndex:999,
                background:'rgba(15,23,42,0.96)', backdropFilter:'blur(12px)',
                borderRadius:16, padding:'14px 16px',
                boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
                border:'1px solid rgba(255,255,255,0.08)',
                display:'flex', alignItems:'center', gap:14,
              }}>
                {/* Turn icon */}
                <div style={{
                  width:50, height:50, borderRadius:12,
                  background:'rgba(26,115,232,0.18)',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                }}>
                  <TurnIcon step={steps[stepIdx]} size={28} color="#1A73E8" />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:'#fff', fontSize:16, fontWeight:800, lineHeight:1.25, marginBottom:4 }}>
                    {stepInstruction(steps[stepIdx])}
                  </div>
                  {stepIdx < steps.length - 1 && (
                    <div style={{ color:'#94a3b8', fontSize:12, fontWeight:600 }}>
                      Then: {stepInstruction(steps[stepIdx + 1]).replace(/ in \d+m$/, '')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Speed + ETA bar (bottom of map, nav mode) ──────────────── */}
            {isNavigating && route && (
              <div style={{
                position:'absolute', bottom: autoCenter ? 64 : 64, left:12, right:12, zIndex:999,
                background:'rgba(15,23,42,0.96)', backdropFilter:'blur(10px)',
                borderRadius:14, padding:'10px 16px',
                boxShadow:'0 4px 16px rgba(0,0,0,0.5)',
                border:'1px solid rgba(255,255,255,0.08)',
                display:'flex', justifyContent:'space-between', alignItems:'center', gap:12,
              }}>
                {/* Speed */}
                <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                  <span style={{ fontSize:28, fontWeight:900, color:'#fff', fontVariantNumeric:'tabular-nums', lineHeight:1 }}>
                    {Math.round(mySpeed)}
                  </span>
                  <span style={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}>km/h</span>
                </div>
                {/* ETA */}
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:800, color:'#1A73E8' }}>{remainingEta} min</div>
                  <div style={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}>ETA</div>
                </div>
                {/* Distance */}
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:18, fontWeight:800, color:'#fff' }}>{remainingDist} km</div>
                  <div style={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}>remaining</div>
                </div>
              </div>
            )}

            {/* ── Re-Center button (shows when panned away) ───────────────── */}
            {!autoCenter && myLoc && (
              <button
                onClick={handleReCenter}
                style={{
                  position:'absolute',
                  bottom: isNavigating ? 136 : (selectedItem ? 210 : 20),
                  right:12,
                  zIndex:1001,
                  width:44, height:44,
                  background:'rgba(15,23,42,0.96)', backdropFilter:'blur(8px)',
                  color:'#1A73E8', border:'1px solid rgba(26,115,232,0.4)',
                  borderRadius:12,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 4px 16px rgba(0,0,0,0.4)',
                  cursor:'pointer',
                }}
                title="Re-center map"
              >
                <LocateFixed size={20} />
              </button>
            )}

            {/* ── Exit Navigation button ──────────────────────────────────── */}
            {isNavigating && (
              <button
                onClick={handleExitNavigation}
                style={{
                  position:'absolute', bottom:12, left:'50%', transform:'translateX(-50%)',
                  zIndex:1000,
                  background:'rgba(229,57,53,0.95)', color:'#fff',
                  border:'1px solid rgba(255,255,255,0.2)', borderRadius:24,
                  padding:'11px 28px', fontSize:14, fontWeight:800,
                  display:'flex', alignItems:'center', gap:8,
                  boxShadow:'0 4px 20px rgba(229,57,53,0.45)', cursor:'pointer',
                  backdropFilter:'blur(8px)',
                }}
              >
                <X size={16} /> Exit Navigation
              </button>
            )}

            {/* ── Map type switcher (non-nav) ──────────────────────────────── */}
            {!isNavigating && (
              <div style={{
                position:'absolute', bottom: selectedItem ? 210 : 12, left:12, zIndex:999,
                background:'rgba(15,23,42,0.92)', backdropFilter:'blur(6px)',
                border:'1px solid rgba(255,255,255,0.1)', borderRadius:10,
                padding:'4px', display:'flex', gap:4,
              }}>
                {[['roadmap','🗺️ Street'],['hybrid','🛰️ Sat']].map(([t, label]) => (
                  <button key={t} onClick={() => setMapType(t)} style={{
                    padding:'4px 10px', fontSize:11, fontWeight:700, borderRadius:8,
                    border:'none', cursor:'pointer',
                    background: mapType === t ? '#1A73E8' : 'transparent',
                    color:'#fff', transition:'all 0.15s',
                  }}>{label}</button>
                ))}
              </div>
            )}

            {/* ── Map type switcher (nav mode, compact) ───────────────────── */}
            {isNavigating && (
              <div style={{
                position:'absolute', top:88, right:12, zIndex:999,
                background:'rgba(15,23,42,0.92)', backdropFilter:'blur(6px)',
                border:'1px solid rgba(255,255,255,0.1)', borderRadius:10,
                padding:'4px', display:'flex', flexDirection:'column', gap:4,
              }}>
                {[['roadmap','🗺️'],['hybrid','🛰️']].map(([t, label]) => (
                  <button key={t} onClick={() => setMapType(t)} style={{
                    width:34, height:34, fontSize:15, borderRadius:8,
                    border:'none', cursor:'pointer',
                    background: mapType === t ? '#1A73E8' : 'transparent',
                    color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                  }}>{label}</button>
                ))}
              </div>
            )}

            {/* ── GPS indicator (non-nav) ──────────────────────────────────── */}
            {!isNavigating && (
              <div style={{
                position:'absolute', top:12, right:12, zIndex:999,
                background:'rgba(15,23,42,0.92)', backdropFilter:'blur(6px)',
                border:'1px solid rgba(255,255,255,0.08)', borderRadius:8,
                padding:'5px 10px', display:'flex', alignItems:'center', gap:6,
              }}>
                <div style={{
                  width:8, height:8, borderRadius:'50%',
                  background: gpsStatus === 'active' ? '#34A853' : gpsStatus === 'acquiring' ? '#FBBC04' : '#ea4335',
                  animation: gpsStatus === 'active' ? 'sr-dot 1.5s infinite' : 'none',
                }} />
                <span style={{ color:'#fff', fontSize:11, fontWeight:600 }}>
                  {gpsStatus === 'active' ? 'GPS' : gpsStatus === 'acquiring' ? 'Finding GPS…' : 'No GPS'}
                </span>
              </div>
            )}

            {/* ── Destination bottom card (non-nav) ───────────────────────── */}
            {!isNavigating && selectedItem && (
              <div style={{
                position:'absolute', bottom:12, left:12, right:12, zIndex:999,
                background:'var(--s-card)', border:'1px solid var(--s-border)',
                borderRadius:16, padding:14,
                boxShadow:'0 8px 32px rgba(0,0,0,0.4)',
                display:'flex', flexDirection:'column', gap:10,
              }}>
                {/* Header row */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:800, color:'var(--s-text)' }}>
                      {selectedItem.customer_name || selectedItem.customer}
                    </div>
                    <div style={{ fontSize:12, color:'var(--s-text-3)', marginTop:2 }}>
                      {selectedItem.invoice_number || selectedItem.order_number}
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedItem(null); setRoute(null); setSteps([]); }}
                    style={{ background:'none', border:'none', color:'var(--s-text-3)', cursor:'pointer', padding:4 }}>
                    <X size={16} />
                  </button>
                </div>

                {/* Route info */}
                {selectedItem.custom_fields?.latitude ? (
                  route ? (
                    <div style={{ display:'flex', gap:14, background:'rgba(26,115,232,0.06)', padding:'8px 12px', borderRadius:10, border:'1px solid rgba(26,115,232,0.15)' }}>
                      <div style={{ fontSize:13, color:'var(--s-text-2)' }}>🚗 <strong>{route.distance.toFixed(1)} km</strong></div>
                      <div style={{ fontSize:13, color:'var(--s-text-2)' }}>⏱ <strong>{Math.round(route.duration)} min</strong></div>
                    </div>
                  ) : (
                    <div style={{ fontSize:12, color:'var(--s-text-3)', padding:'6px 0' }}>Calculating route…</div>
                  )
                ) : (
                  <div style={{ display:'flex', gap:6, alignItems:'center', background:'rgba(234,67,53,0.07)', padding:'8px 10px', borderRadius:10, border:'1px solid rgba(234,67,53,0.2)', color:'#ea4335' }}>
                    <AlertTriangle size={14} />
                    <span style={{ fontSize:12, fontWeight:600 }}>No GPS coordinates set for this customer.</span>
                  </div>
                )}

                {/* Admin instructions */}
                {useAllocations && selectedItem.notes && (
                  <div style={{ fontSize:12, color:'var(--s-text-2)', background:'rgba(59,130,246,0.06)', padding:'8px 10px', borderRadius:10, border:'1px solid rgba(59,130,246,0.15)', lineHeight:1.4 }}>
                    <strong>Admin Notes:</strong> {selectedItem.notes}
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {/* Visit status */}
                  {useAllocations && selectedItem.visit_status === 'PENDING' && (
                    <div style={{ display:'flex', gap:6, width:'100%' }}>
                      <button onClick={() => handleUpdateVisitStatus(selectedItem.id, 'COMPLETED')}
                        style={{ flex:1, background:'linear-gradient(135deg,#34A853,#1a9e5c)', color:'#fff', border:'none', borderRadius:10, padding:'10px', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                        <Check size={15}/> Visited
                      </button>
                      <button onClick={() => handleUpdateVisitStatus(selectedItem.id, 'SKIPPED')}
                        style={{ flex:1, background:'linear-gradient(135deg,#ea4335,#c62828)', color:'#fff', border:'none', borderRadius:10, padding:'10px', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                        <X size={15}/> Skip
                      </button>
                    </div>
                  )}
                  {useAllocations && selectedItem.visit_status !== 'PENDING' && (
                    <div style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'rgba(255,255,255,0.03)', borderRadius:10, border:'1px solid var(--s-border)' }}>
                      <span style={{ fontSize:12.5, color:'var(--s-text-2)', fontWeight:600 }}>
                        Status: <strong style={{ color: selectedItem.visit_status === 'COMPLETED' ? '#34A853' : '#ea4335' }}>{selectedItem.visit_status}</strong>
                      </span>
                      <button onClick={() => handleUpdateVisitStatus(selectedItem.id, 'PENDING')}
                        style={{ background:'none', border:'none', color:'#1A73E8', cursor:'pointer', fontSize:12, fontWeight:700, textDecoration:'underline' }}>
                        Reset
                      </button>
                    </div>
                  )}

                  {/* Start nav / pin */}
                  {selectedItem.custom_fields?.latitude && selectedItem.custom_fields?.longitude ? (
                    <button onClick={handleStartNavigation}
                      style={{ flex:2, background:'linear-gradient(135deg,#1A73E8,#1557b0)', color:'#fff', border:'none', borderRadius:10, padding:'11px 14px', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6, cursor:'pointer', boxShadow:'0 4px 14px rgba(26,115,232,0.35)' }}>
                      <Navigation size={15} fill="#fff" /> Start Navigation
                    </button>
                  ) : (
                    <button onClick={() => handlePinLocation(selectedItem)}
                      style={{ flex:2, background:'linear-gradient(135deg,#34A853,#1a9e5c)', color:'#fff', border:'none', borderRadius:10, padding:'11px 14px', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6, cursor:'pointer', boxShadow:'0 4px 14px rgba(52,168,83,0.35)' }}>
                      <MapPin size={15} /> Pin Location
                    </button>
                  )}

                  {/* Call */}
                  {selectedItem.custom_fields?.phone && (
                    <button onClick={() => window.open(`tel:${selectedItem.custom_fields.phone}`, '_system')}
                      style={{ flex:1, background:'var(--s-surface)', border:'1px solid var(--s-border)', color:'var(--s-text)', borderRadius:10, padding:'11px', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                      📞
                    </button>
                  )}

                  {/* Re-pin */}
                  {selectedItem.custom_fields?.latitude && (
                    <button onClick={() => handlePinLocation(selectedItem)}
                      style={{ flex:1, background:'var(--s-surface)', border:'1px solid var(--s-border)', color:'var(--s-text)', borderRadius:10, padding:'11px', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
                      title="Update GPS">
                      📍
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Visits list (non-nav) ─────────────────────────────────────── */}
          {!isNavigating && (
            <div style={{ padding:'0 16px', flexShrink:0 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--s-text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
                {useAllocations ? 'Route Sequence' : 'Assigned Visits'}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:180, overflowY:'auto' }}>
                {assigned.map(item => {
                  const sel    = selectedItem?.id === item.id;
                  const hasGps = item.custom_fields?.latitude && item.custom_fields?.longitude;
                  const vsColor = item.visit_status === 'COMPLETED' ? '#34A853' : item.visit_status === 'SKIPPED' ? '#ea4335' : '#94a3b8';
                  return (
                    <div key={item.id} onClick={() => handleSelectRoute(item)}
                      style={{
                        background: sel ? 'rgba(26,115,232,0.07)' : 'var(--s-card)',
                        border:`1px solid ${sel ? '#1A73E8' : 'var(--s-border)'}`,
                        borderRadius:12, padding:'11px 14px',
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        cursor:'pointer', transition:'all 0.12s',
                      }}>
                      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                        {useAllocations && (
                          <div style={{ width:22, height:22, borderRadius:'50%', background: sel ? '#1A73E8' : 'var(--s-border)', color: sel ? '#fff' : 'var(--s-text-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800 }}>
                            {item.sequence}
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize:13.5, fontWeight:700, color:'var(--s-text)', display:'flex', alignItems:'center', gap:6 }}>
                            {item.customer_name || item.customer}
                            {useAllocations && (
                              <span style={{ fontSize:9, fontWeight:800, color:vsColor, border:`1px solid ${vsColor}40`, padding:'1px 5px', borderRadius:99 }}>
                                {item.visit_status}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize:11.5, color:'var(--s-text-3)', display:'flex', gap:6, marginTop:1 }}>
                            <span>{item.invoice_number || item.order_number}</span>
                            <span style={{ color: hasGps ? '#34A853' : '#FBBC04' }}>
                              {hasGps ? '• GPS ✓' : '• No GPS'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={16} color={sel ? '#1A73E8' : 'var(--s-text-3)'} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── CSS ──────────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes sr-spin  { to { transform: rotate(360deg); } }
        @keyframes sr-dot   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.35)} }
        @keyframes sr-pulse { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:.15;transform:scale(1.7)} }
        @keyframes sr-ring  { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(2.2);opacity:0} }
      `}</style>
    </div>
  );
}
