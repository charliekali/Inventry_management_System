/**
 * AttendanceTrackingPage.jsx
 * Super-Admin live GPS tracking dashboard.
 * Shows all active sales staff on an interactive map using Leaflet + OpenStreetMap.
 * Auto-refreshes every 15 seconds. Clicking a staff member flies to their location
 * and draws their GPS breadcrumb trail as a polyline.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { attendanceAPI } from '../api';
import toast from 'react-hot-toast';
import { MapPin, Users, Clock, Wifi, WifiOff, RefreshCw, History, Activity, ChevronRight, Loader2 } from 'lucide-react';

// Fix Leaflet's default icon path issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const REFRESH_INTERVAL_MS = 15_000;

/** Palette for user markers */
const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#14b8a6', '#8b5cf6', '#f97316', '#06b6d4', '#84cc16'];
const getColor = (index) => {
  if (index < 0 || index >= COLORS.length) return '#6366f1';
  return COLORS[index % COLORS.length];
};

/** Create a custom HTML div icon (pulsing circle with initials) */
function createUserIcon(name, color, isSelected) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';
  const size = isSelected ? 44 : 36;
  const html = `
    <div style="
      position:relative;
      width:${size}px; height:${size}px;
    ">
      ${isSelected ? `<div style="
        position:absolute; inset:-6px;
        border-radius:50%;
        border: 2.5px solid ${color};
        opacity:0.5;
        animation: live-ring 1.5s ease-out infinite;
      "></div>` : ''}
      <div style="
        position:absolute; inset:0;
        background:${color};
        border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        color:#fff; font-weight:900; font-size:${isSelected ? 14 : 12}px;
        border: 3px solid white;
        box-shadow: 0 2px 12px rgba(0,0,0,0.35);
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

/** Helper: fly map to a coordinate */
function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, 15, { duration: 1.2 });
    }
  }, [target, map]);
  return null;
}

/** Format elapsed minutes */
function fmtDuration(mins) {
  if (mins == null) return '--';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function fmtTime(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDateTime(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Snap coordinates to roads using OSRM Match API */
async function snapToRoads(points) {
  if (!points || points.length < 2) return points;

  // Filter out consecutive duplicate or extremely close coordinates (within ~2 meters)
  const filteredPoints = [];
  for (const pt of points) {
    if (filteredPoints.length === 0) {
      filteredPoints.push(pt);
    } else {
      const last = filteredPoints[filteredPoints.length - 1];
      const latDiff = Math.abs(pt[0] - last[0]);
      const lngDiff = Math.abs(pt[1] - last[1]);
      if (latDiff > 0.00002 || lngDiff > 0.00002) {
        filteredPoints.push(pt);
      }
    }
  }

  if (filteredPoints.length < 2) return filteredPoints;

  // OSRM demo server has a limit of 100 points per request.
  // We chunk the points with a 1-point overlap to keep the path continuous.
  const maxChunkSize = 90;
  const chunks = [];
  for (let i = 0; i < filteredPoints.length; i += maxChunkSize - 1) {
    const chunk = filteredPoints.slice(i, i + maxChunkSize);
    chunks.push(chunk);
    if (i + maxChunkSize >= filteredPoints.length) break;
  }

  const snappedPaths = [];

  for (const chunk of chunks) {
    if (chunk.length < 2) continue;
    // OSRM expects coordinates in lng,lat format
    const coordString = chunk.map(p => `${p[1]},${p[0]}`).join(';');
    const url = `https://router.project-osrm.org/match/v1/driving/${coordString}?overview=full&geometries=geojson`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.code === 'Ok' && data.matchings && data.matchings.length > 0) {
        const matchedCoords = data.matchings.flatMap(m =>
          m.geometry.coordinates.map(c => [c[1], c[0]]) // convert [lng, lat] back to [lat, lng]
        );
        snappedPaths.push(...matchedCoords);
      } else {
        snappedPaths.push(...chunk);
      }
    } catch (err) {
      console.warn('OSRM Match API failed, falling back to raw coordinates:', err);
      snappedPaths.push(...chunk);
    }
  }

  return snappedPaths;
}

export default function AttendanceTrackingPage() {
  const [activeSessions, setActiveSessions] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [trail, setTrail] = useState([]);
  const [rawTrail, setRawTrail] = useState([]);
  const [snapping, setSnapping] = useState(false);
  const [tab, setTab] = useState('live'); // 'live' | 'history'
  const [lastRefresh, setLastRefresh] = useState(null);
  const [loading, setLoading] = useState(true);
  const [flyTarget, setFlyTarget] = useState(null);
  const refreshTimerRef = useRef(null);

  // ─── Load active sessions ──────────────────────────────────────────────────
  const loadActive = useCallback(async (silent = false) => {
    try {
      const res = await attendanceAPI.active();
      setActiveSessions(res.data.data || []);
      setLastRefresh(new Date());
    } catch (err) {
      if (!silent) toast.error('Failed to load active sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Load history ──────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    try {
      const res = await attendanceAPI.history();
      setHistory(res.data.data || []);
    } catch {
      // silent
    }
  }, []);

  // ─── Initial load + auto-refresh ──────────────────────────────────────────
  useEffect(() => {
    loadActive();
    loadHistory();
    refreshTimerRef.current = setInterval(() => loadActive(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshTimerRef.current);
  }, [loadActive, loadHistory]);

  // ─── Load trail when a session is selected ─────────────────────────────────
  useEffect(() => {
    if (!selectedSession) {
      setTrail([]);
      setRawTrail([]);
      return;
    }
    setSnapping(true);
    attendanceAPI.trail(selectedSession.id)
      .then(async res => {
        const pts = (res.data.data || []).map(p => [p.lat, p.lng]);
        setRawTrail(pts);
        const snapped = await snapToRoads(pts);
        setTrail(snapped);
      })
      .catch(() => {
        setTrail([]);
        setRawTrail([]);
      })
      .finally(() => {
        setSnapping(false);
      });
  }, [selectedSession]);

  // ─── Select a session — fly map + load trail ───────────────────────────────
  const handleSelectSession = (session) => {
    setSelectedSession(session);
    if (session.last_lat && session.last_lng) {
      setFlyTarget([session.last_lat, session.last_lng]);
    }
  };

  const defaultCenter = activeSessions.find(s => s.last_lat)
    ? [activeSessions.find(s => s.last_lat).last_lat, activeSessions.find(s => s.last_lat).last_lng]
    : [9.9252, 78.1198]; // Default to Madurai, India

  const selectedColor = selectedSession
    ? getColor(activeSessions.findIndex(s => s.id === selectedSession.id))
    : '#6366f1';

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-left">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MapPin size={22} className="text-primary" />
            Live Staff Tracking
          </h2>
          <p>Real-time GPS location of active sales personnel.</p>
        </div>
        <div className="page-header-right" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {lastRefresh && (
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => loadActive()}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Tab Switcher ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
        {[
          { key: 'live', label: 'Live Map', Icon: Activity },
          { key: 'history', label: 'Attendance History', Icon: History },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', fontSize: 13, fontWeight: tab === key ? 700 : 500,
              color: tab === key ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: tab === key ? '2px solid var(--color-primary-light)' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s',
            }}
          >
            <Icon size={15} />
            {label}
            {key === 'live' && (
              <span style={{
                background: activeSessions.length > 0 ? '#22c55e' : 'var(--color-text-muted)',
                color: '#fff', fontSize: 10, fontWeight: 800,
                padding: '1px 6px', borderRadius: 99, minWidth: 18, textAlign: 'center',
              }}>
                {activeSessions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'live' && (
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

          {/* ── Sidebar: Active Staff List ──────────────────────────────────── */}
          <div style={{
            width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8,
            overflowY: 'auto', paddingBottom: 8,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {activeSessions.length > 0 ? `${activeSessions.length} Active Now` : 'No Active Staff'}
            </div>

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                <div className="loading-spinner" />
              </div>
            )}

            {!loading && activeSessions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-text-muted)', fontSize: 13 }}>
                <WifiOff size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
                <div>No staff are currently clocked in.</div>
              </div>
            )}

            {activeSessions.map((session, idx) => {
              const color = getColor(idx);
              const isSelected = selectedSession?.id === session.id;
              const initials = (session.user_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
              return (
                <button
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', textAlign: 'left',
                    background: isSelected ? `${color}18` : 'var(--color-bg-card)',
                    border: `1.5px solid ${isSelected ? color : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 900, fontSize: 13, flexShrink: 0,
                    border: '2px solid white',
                    boxShadow: isSelected ? `0 0 0 3px ${color}40` : '0 1px 4px rgba(0,0,0,0.2)',
                  }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {session.user_name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      In since {fmtTime(session.clock_in_at)} · {fmtDuration(session.duration_minutes)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2, fontWeight: 600 }}>
                      🚗 {session.distance_km?.toFixed(2) || '0.00'} km @ {session.current_speed_kmph?.toFixed(1) || '0.0'} km/h
                    </div>
                    <div style={{ fontSize: 11, color: session.last_ping_at ? '#22c55e' : 'var(--color-text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: session.last_ping_at ? '#22c55e' : 'var(--color-text-muted)', flexShrink: 0 }} />
                      {session.last_ping_at
                        ? `Last ping ${new Date(session.last_ping_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : 'No GPS yet'
                      }
                    </div>
                  </div>
                  <ChevronRight size={14} color={isSelected ? color : 'var(--color-text-muted)'} style={{ flexShrink: 0 }} />
                </button>
              );
            })}
          </div>

          {/* ── Map ──────────────────────────────────────────────────────────── */}
          <div style={{ flex: 1, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-border)', position: 'relative', minHeight: 400 }}>
            <MapContainer
              center={defaultCenter}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
              zoomControl={true}
            >
              {/* Dark map tiles from CartoDB */}
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />

              {/* Fly to selected user */}
              {flyTarget && <FlyTo target={flyTarget} />}

              {/* Path trail polyline for selected user */}
              {trail.length > 1 && (
                <>
                  {/* Clean snapped road line (thick glow) */}
                  <Polyline
                    positions={trail}
                    color={selectedColor}
                    weight={6}
                    opacity={0.3}
                  />
                  {/* Clean snapped road line (solid path) */}
                  <Polyline
                    positions={trail}
                    color={selectedColor}
                    weight={3.5}
                    opacity={0.95}
                  />
                </>
              )}

              {/* Raw GPS ping markers (professional tiny dots) */}
              {rawTrail.length > 0 && rawTrail.map((pt, idx) => (
                <CircleMarker
                  key={`raw-${idx}`}
                  center={pt}
                  radius={3.5}
                  fillColor={selectedColor}
                  color="#ffffff"
                  weight={1.5}
                  fillOpacity={0.85}
                  opacity={0.9}
                >
                  <Popup>
                    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 11 }}>
                      <strong>GPS Ping #{idx + 1}</strong>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {/* Staff markers */}
              {activeSessions.map((session, idx) => {
                if (!session.last_lat || !session.last_lng) return null;
                const color = getColor(idx);
                const isSelected = selectedSession?.id === session.id;
                const icon = createUserIcon(session.user_name, color, isSelected);
                return (
                  <Marker
                    key={session.id}
                    position={[session.last_lat, session.last_lng]}
                    icon={icon}
                    eventHandlers={{ click: () => handleSelectSession(session) }}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'system-ui, sans-serif', minWidth: 160 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>
                          {session.user_name}
                        </div>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                          📍 {session.last_lat?.toFixed(5)}, {session.last_lng?.toFixed(5)}
                        </div>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                          ⏱ Active {fmtDuration(session.duration_minutes)}
                        </div>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                          🚗 Distance: {session.distance_km?.toFixed(2) || '0.00'} km
                        </div>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                          ⚡ Speed: {session.current_speed_kmph?.toFixed(1) || '0.0'} km/h
                        </div>
                        <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600, marginTop: 4 }}>
                          {session.ping_count} GPS pings
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            {/* Live pulse / Snapping indicator overlay */}
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 999,
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
              padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'live-pulse 1.5s infinite' }} />
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>
                  LIVE · Refreshes every 15s
                </span>
              </div>
              {snapping && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 4, marginTop: 2 }}>
                  <Loader2 size={11} className="spin-icon" color="#3b82f6" />
                  <span style={{ color: '#3b82f6', fontSize: 10, fontWeight: 600 }}>
                    Snapping path to roads...
                  </span>
                </div>
              )}
            </div>

            {/* No GPS data message */}
            {!loading && activeSessions.length > 0 && activeSessions.every(s => !s.last_lat) && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                zIndex: 999, background: 'rgba(0,0,0,0.8)', color: '#fff',
                padding: '16px 20px', borderRadius: 10, textAlign: 'center', fontSize: 13,
              }}>
                <WifiOff size={20} style={{ marginBottom: 6 }} />
                <div>Staff are active but no GPS coordinates received yet.</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>Waiting for first ping…</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'history' && (
        <div className="card" style={{ flex: 1, overflow: 'hidden' }}>
          <div className="table-wrapper" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th>Email</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Duration</th>
                  <th>Distance</th>
                  <th>GPS Pings</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                      No attendance sessions recorded yet.
                    </td>
                  </tr>
                ) : (
                  history.map(s => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{s.user_name}</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.user_email}</td>
                      <td>{fmtDateTime(s.clock_in_at)}</td>
                      <td>{s.clock_out_at ? fmtDateTime(s.clock_out_at) : <span style={{ color: '#22c55e', fontWeight: 600 }}>Active</span>}</td>
                      <td>
                        <span className="badge badge-blue">{fmtDuration(s.duration_minutes)}</span>
                      </td>
                      <td>
                        <span className="badge badge-purple">{s.distance_km?.toFixed(2) || '0.00'} km</span>
                      </td>
                      <td>
                        <span className="badge badge-gray">{s.ping_count} pings</span>
                      </td>
                      <td>
                        {s.status === 'ACTIVE'
                          ? <span className="badge badge-green">Active</span>
                          : <span className="badge badge-gray">Ended</span>
                        }
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Global animation keyframes ─────────────────────────────────────── */}
      <style>{`
        @keyframes live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
        @keyframes live-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin-icon {
          animation: spin 1s linear infinite;
        }
        .leaflet-container {
          background: #1a1a2e;
        }
      `}</style>
    </div>
  );
}
