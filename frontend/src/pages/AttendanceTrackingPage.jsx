/**
 * AttendanceTrackingPage.jsx
 * Super-Admin live GPS tracking dashboard with route playback & stop detection.
 * Shows active and historical sales staff tracking sessions on an interactive map.
 * Replays GPS trail index-by-index with speed controls (1x to 20x) and timeline scrubbing.
 * Identifies stop points (clusters within 40m for >= 2 minutes) and shows duration in minutes.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import { useTheme } from '../context/ThemeContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { attendanceAPI } from '../api';
import toast from 'react-hot-toast';
import {
  MapPin, Users, Clock, Wifi, WifiOff, RefreshCw, History,
  Activity, ChevronRight, Loader2, List, ChevronDown, Search,
  Navigation, AlertCircle, Download, Play, Pause
} from 'lucide-react';

// Fix Leaflet's default icon path issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const REFRESH_INTERVAL_MS = 10_000;

/** Palette for user markers */
const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#14b8a6', '#8b5cf6', '#f97316', '#06b6d4', '#84cc16'];
const getColor = (index) => COLORS[Math.abs(index) % COLORS.length];

/** Calculate Haversine distance between two coordinates in km */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Detect stop points where coordinates stay within a 40m radius for >= 2 minutes */
function detectStops(pings) {
  if (!pings || pings.length < 2) return [];

  const stops = [];
  const radiusKm = 0.04; // 40 meters
  const minDurationMs = 2 * 60 * 1000; // 2 minutes

  let i = 0;
  while (i < pings.length) {
    let j = i + 1;
    let stopEndIndex = i;

    while (j < pings.length) {
      const dist = calculateDistance(pings[i].lat, pings[i].lng, pings[j].lat, pings[j].lng);
      if (dist <= radiusKm) {
        stopEndIndex = j;
        j++;
      } else {
        break;
      }
    }

    const startTime = new Date(pings[i].recorded_at).getTime();
    const endTime = new Date(pings[stopEndIndex].recorded_at).getTime();
    const durationMs = endTime - startTime;

    if (durationMs >= minDurationMs && stopEndIndex > i) {
      // Calculate centroid coordinate of the stop
      let sumLat = 0, sumLng = 0;
      for (let k = i; k <= stopEndIndex; k++) {
        sumLat += pings[k].lat;
        sumLng += pings[k].lng;
      }
      const count = stopEndIndex - i + 1;

      stops.push({
        startIndex: i,
        endIndex: stopEndIndex,
        lat: sumLat / count,
        lng: sumLng / count,
        startTime: pings[i].recorded_at,
        endTime: pings[stopEndIndex].recorded_at,
        durationMinutes: Math.max(1, Math.round(durationMs / 60000)),
      });
      i = stopEndIndex + 1;
    } else {
      i++;
    }
  }

  return stops;
}

/** Create a custom stop icon with red circle and white duration inside */
function createStopIcon(durationMinutes) {
  const size = 30;
  const html = `
    <div style="position:relative; width:${size}px; height:${size}px;">
      <div style="
        position:absolute; inset:0;
        background:#ef4444;
        border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        color:#fff; font-weight:800; font-size:11px;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      ">${durationMinutes}</div>
    </div>`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/** Create a custom HTML div icon (pulsing circle with initials) */
function createUserIcon(name, color, isSelected) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';
  const size = isSelected ? 44 : 36;
  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;">
      ${isSelected ? `<div style="
        position:absolute;inset:-6px;border-radius:50%;
        border:2.5px solid ${color};opacity:0.5;
        animation:live-ring 1.5s ease-out infinite;
      "></div>` : ''}
      <div style="
        position:absolute;inset:0;background:${color};border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-weight:900;font-size:${isSelected ? 14 : 12}px;
        border:3px solid white;box-shadow:0 2px 12px rgba(0,0,0,0.35);
        font-family:system-ui,sans-serif;
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
    if (target) map.flyTo(target, 15, { duration: 1.2 });
  }, [target, map]);
  return null;
}

/** Helper: react to center changes when active sessions first load */
function MapCenterUpdater({ center }) {
  const map = useMap();
  const initialised = useRef(false);
  useEffect(() => {
    if (!initialised.current && center) {
      map.setView(center, 12);
      initialised.current = true;
    }
  }, [center, map]);
  return null;
}

/** Helper: smoothly pan the map to the active playback coordinate */
function PlaybackCenterer({ target, active }) {
  const map = useMap();
  useEffect(() => {
    if (active && target) {
      map.panTo(target, { animate: true, duration: 0.3 });
    }
  }, [target, active, map]);
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

  const filteredPoints = [];
  for (const pt of points) {
    if (filteredPoints.length === 0) {
      filteredPoints.push(pt);
    } else {
      const last = filteredPoints[filteredPoints.length - 1];
      if (Math.abs(pt[0] - last[0]) > 0.00002 || Math.abs(pt[1] - last[1]) > 0.00002) {
        filteredPoints.push(pt);
      }
    }
  }
  if (filteredPoints.length < 2) return filteredPoints;

  const maxChunkSize = 90;
  const chunks = [];
  for (let i = 0; i < filteredPoints.length; i += maxChunkSize - 1) {
    chunks.push(filteredPoints.slice(i, i + maxChunkSize));
    if (i + maxChunkSize >= filteredPoints.length) break;
  }

  const snappedPaths = [];
  for (const chunk of chunks) {
    if (chunk.length < 2) continue;
    const coordString = chunk.map(p => `${p[1]},${p[0]}`).join(';');
    const url = `https://router.project-osrm.org/match/v1/driving/${coordString}?overview=full&geometries=geojson`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.code === 'Ok' && data.matchings?.length > 0) {
        snappedPaths.push(...data.matchings.flatMap(m =>
          m.geometry.coordinates.map(c => [c[1], c[0]])
        ));
      } else {
        snappedPaths.push(...chunk);
      }
    } catch {
      snappedPaths.push(...chunk);
    }
  }
  return snappedPaths;
}

// ─── Export GPS logs to CSV ────────────────────────────────────────────────────
function exportLogsCSV(sessions, logsMap) {
  const rows = [['Session ID', 'Staff Name', 'Email', 'Status', 'Clock In', 'Clock Out', 'Duration', 'Distance (km)', 'Ping #', 'Time', 'Latitude', 'Longitude', 'Accuracy (m)', 'Speed (km/h)', 'Dist From Last (m)']];
  for (const s of sessions) {
    const pings = logsMap[s.id] || [];
    if (pings.length === 0) {
      rows.push([s.id, s.user_name, s.user_email, s.status, s.clock_in_at, s.clock_out_at ?? '', fmtDuration(s.duration_minutes), (s.distance_km ?? 0).toFixed(3), '', '', '', '', '', '', '']);
    } else {
      pings.forEach((p, i) => {
        rows.push([
          s.id, s.user_name, s.user_email, s.status,
          s.clock_in_at, s.clock_out_at ?? '', fmtDuration(s.duration_minutes), (s.distance_km ?? 0).toFixed(3),
          i + 1,
          p.recorded_at ? new Date(p.recorded_at).toISOString() : '',
          p.lat?.toFixed(6) ?? '', p.lng?.toFixed(6) ?? '',
          p.accuracy?.toFixed(0) ?? '',
          p.speed_kmph?.toFixed(2) ?? '0',
          p.distance_from_last_km > 0 ? (p.distance_from_last_km * 1000).toFixed(0) : '0',
        ]);
      });
    }
  }
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gps_logs_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function AttendanceTrackingPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const tileUrl = isDark
    ? 'https://{s.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  const [activeSessions, setActiveSessions]   = useState([]);
  const [history, setHistory]                 = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  
  // GPS Trail & Playback States
  const [sessionPings, setSessionPings]       = useState([]);
  const [trail, setTrail]                     = useState([]);
  const [rawTrail, setRawTrail]               = useState([]);
  const [stops, setStops]                     = useState([]);
  const [snapping, setSnapping]               = useState(false);
  const [isPlaying, setIsPlaying]             = useState(false);
  const [playbackIndex, setPlaybackIndex]     = useState(0);
  const [playbackSpeed, setPlaybackSpeed]     = useState(20); // 1x, 2x, 5x, 10x, 20x
  const [autoCenter, setAutoCenter]           = useState(true);

  const [tab, setTab]                         = useState('live');
  const [lastRefresh, setLastRefresh]         = useState(null);
  const [loading, setLoading]                 = useState(true);
  const [loadError, setLoadError]             = useState(null);
  const [flyTarget, setFlyTarget]             = useState(null);
  const refreshTimerRef                       = useRef(null);

  // GPS Logs state — flat table approach
  const [logsSearch, setLogsSearch]       = useState('');
  const [logsMap, setLogsMap]             = useState({});       // sessionId → ping[]
  const [loadingPings, setLoadingPings]   = useState({});       // sessionId → bool
  const [expandedLog, setExpandedLog]     = useState(null);     // session id
  const [logsSortBy, setLogsSortBy]       = useState('clock_in_at');
  const [logsSortDir, setLogsSortDir]     = useState('desc');

  // ─── Load active sessions ───────────────────────────────────────────────────
  const loadActive = useCallback(async (silent = false) => {
    try {
      const res = await attendanceAPI.active();
      setActiveSessions(res.data.data || []);
      setLastRefresh(new Date());
      setLoadError(null);
    } catch (err) {
      const msg = err?.response?.status === 403
        ? 'Access denied — Super Admin role required'
        : 'Failed to load active sessions';
      setLoadError(msg);
      if (!silent) toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Load history ───────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    try {
      const res = await attendanceAPI.history();
      setHistory(res.data.data || []);
    } catch {
      // silent
    }
  }, []);

  // ─── Initial load + auto-refresh ───────────────────────────────────────────
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
      setSessionPings([]);
      setStops([]);
      setPlaybackIndex(0);
      setIsPlaying(false);
      return;
    }
    setSnapping(true);
    setIsPlaying(false);
    attendanceAPI.trail(selectedSession.id)
      .then(async res => {
        const pingsData = res.data.data || [];
        const validPings = pingsData.filter(p => p && typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng));
        setSessionPings(validPings);

        const pts = validPings.map(p => [p.lat, p.lng]);
        setRawTrail(pts);
        setPlaybackIndex(pts.length > 0 ? pts.length - 1 : 0);

        // Detect stops
        const detectedStops = detectStops(validPings);
        setStops(detectedStops);

        // Snap path to roads
        const snapped = await snapToRoads(pts);
        setTrail(snapped);
      })
      .catch(() => {
        setTrail([]);
        setRawTrail([]);
        setSessionPings([]);
        setStops([]);
        setPlaybackIndex(0);
      })
      .finally(() => setSnapping(false));
  }, [selectedSession]);

  // ─── Playback Timer Effect ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    if (rawTrail.length === 0) return;
    if (playbackIndex >= rawTrail.length - 1) {
      setIsPlaying(false);
      return;
    }

    const intervalMs = 200;
    const step = playbackSpeed;

    const timer = setInterval(() => {
      setPlaybackIndex(prev => {
        const next = prev + step;
        if (next >= rawTrail.length - 1) {
          setIsPlaying(false);
          return rawTrail.length - 1;
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, rawTrail.length, playbackIndex]);

  // ─── Play / Pause Trigger ──────────────────────────────────────────────────
  const handlePlayPause = () => {
    if (playbackIndex >= rawTrail.length - 1) {
      setPlaybackIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  // ─── Select a session ───────────────────────────────────────────────────────
  const handleSelectSession = (session) => {
    setSelectedSession(session);
    if (session.last_lat && session.last_lng) {
      setFlyTarget([session.last_lat, session.last_lng]);
    }
  };

  // ─── Load pings for a session (GPS Logs tab) ────────────────────────────────
  const loadPingsForSession = async (sessionId) => {
    if (logsMap[sessionId]) return; // already loaded
    setLoadingPings(prev => ({ ...prev, [sessionId]: true }));
    try {
      const res = await attendanceAPI.trail(sessionId);
      setLogsMap(prev => ({ ...prev, [sessionId]: res.data.data || [] }));
    } catch {
      setLogsMap(prev => ({ ...prev, [sessionId]: [] }));
    } finally {
      setLoadingPings(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  const toggleExpandLog = async (sessionId) => {
    if (expandedLog === sessionId) {
      setExpandedLog(null);
    } else {
      setExpandedLog(sessionId);
      await loadPingsForSession(sessionId);
    }
  };

  const sessionWithGps = activeSessions.find(s =>
    s.last_lat != null && s.last_lng != null &&
    !isNaN(parseFloat(s.last_lat)) && !isNaN(parseFloat(s.last_lng))
  );
  const defaultCenter = sessionWithGps
    ? [parseFloat(sessionWithGps.last_lat), parseFloat(sessionWithGps.last_lng)]
    : [9.9252, 78.1198];

  const selectedColor = selectedSession
    ? getColor(activeSessions.findIndex(s => s.id === selectedSession.id))
    : '#6366f1';

  // ─── Stats Calculator ──────────────────────────────────────────────────────
  const calculateStats = () => {
    if (sessionPings.length === 0) {
      return {
        straightDistanceKm: '0.00',
        movingDurationStr: '0m',
        stoppedDurationStr: '0m',
        stopsCount: 0,
        maxSpeedKmph: '0.0',
        pingsCount: 0
      };
    }

    const first = sessionPings[0];
    const last = sessionPings[sessionPings.length - 1];
    const straightDist = calculateDistance(first.lat, first.lng, last.lat, last.lng);
    
    const stopsCount = stops.length;
    const stoppedMins = stops.reduce((acc, s) => acc + s.durationMinutes, 0);

    const startTime = new Date(first.recorded_at).getTime();
    const endTime = new Date(last.recorded_at).getTime();
    const totalMins = Math.max(1, Math.round((endTime - startTime) / 60000));
    const movingMins = Math.max(0, totalMins - stoppedMins);

    const formatMins = (mins) => {
      if (mins < 60) return `${mins}m`;
      return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    };

    const maxSpeed = Math.max(...sessionPings.map(p => p.speed_kmph || 0));

    return {
      straightDistanceKm: straightDist.toFixed(2),
      movingDurationStr: formatMins(movingMins),
      stoppedDurationStr: formatMins(stoppedMins),
      stopsCount,
      maxSpeedKmph: maxSpeed.toFixed(1),
      pingsCount: sessionPings.length
    };
  };

  const stats = calculateStats();
  const activePing = sessionPings[playbackIndex];
  const activePlaybackCoord = rawTrail[playbackIndex];

  // Dynamic Polylines representation
  const completedTrail = rawTrail.slice(0, playbackIndex + 1);
  const remainingTrail = rawTrail.slice(playbackIndex);

  // ─── GPS Logs helpers ───────────────────────────────────────────────────────
  const allSessions = [
    ...activeSessions,
    ...history.filter(h => !activeSessions.find(a => a.id === h.id)),
  ];
  const filteredSessions = allSessions.filter(s =>
    !logsSearch ||
    (s.user_name || '').toLowerCase().includes(logsSearch.toLowerCase()) ||
    (s.user_email || '').toLowerCase().includes(logsSearch.toLowerCase())
  ).sort((a, b) => {
    let av = a[logsSortBy], bv = b[logsSortBy];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av == null) av = '';
    if (bv == null) bv = '';
    return logsSortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  const handleSortChange = (col) => {
    if (logsSortBy === col) setLogsSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setLogsSortBy(col); setLogsSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (logsSortBy !== col) return <span style={{ opacity: 0.3, fontSize: 10 }}>⇅</span>;
    return <span style={{ fontSize: 10 }}>{logsSortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-left">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MapPin size={22} className="text-primary" />
            Live Staff Tracking & Playback
          </h2>
          <p>Real-time GPS tracking and path replaying of sales personnel routes.</p>
        </div>
        <div className="page-header-right" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {loadError && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={13} />
              {loadError}
            </span>
          )}
          {lastRefresh && !loadError && (
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', marginRight: 5, animation: 'live-pulse 2s infinite' }} />
              Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => { loadActive(); loadHistory(); }}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Tab Switcher ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
        {[
          { key: 'live',    label: 'Tracking Map',       Icon: Activity },
          { key: 'history', label: 'Attendance History',  Icon: History },
          { key: 'logs',    label: 'GPS Logs',            Icon: List },
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

      {/* ══════════════ LIVE MAP TAB ═══════════════════════════════════════ */}
      {tab === 'live' && (
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

          {/* ── Sidebar: Active Staff List ─────────────────────────────── */}
          <div style={{
            width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8,
            overflowY: 'auto', paddingBottom: 8,
          }}>
            {/* Historical selected session info block */}
            {selectedSession && !activeSessions.some(s => s.id === selectedSession.id) && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1.5px dashed #f59e0b',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🕒 Historical Playback
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {selectedSession.user_name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Session: {new Date(selectedSession.clock_in_at).toLocaleDateString()}
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSelectedSession(null);
                    setPlaybackIndex(0);
                    setIsPlaying(false);
                  }}
                  style={{ marginTop: 4, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                >
                  ◀ Close Playback
                </button>
              </div>
            )}

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {activeSessions.length > 0 ? `${activeSessions.length} Active Now` : 'No Active Staff'}
            </div>

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                <div className="loading-spinner" />
              </div>
            )}

            {!loading && loadError && (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: '#ef4444', fontSize: 13 }}>
                <AlertCircle size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
                <div>{loadError}</div>
              </div>
            )}

            {!loading && !loadError && activeSessions.length === 0 && (
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

          {/* ── Map + Playback Layout Column ─────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
            {/* Map Canvas */}
            <div style={{ flex: 1, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-border)', position: 'relative', minHeight: 400 }}>
              <MapContainer
                center={defaultCenter}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url={tileUrl}
                />

                {/* Auto-center when first data arrives */}
                <MapCenterUpdater center={sessionWithGps ? [parseFloat(sessionWithGps.last_lat), parseFloat(sessionWithGps.last_lng)] : null} />

                {/* Fly to selected user when first loaded */}
                {flyTarget && <FlyTo target={flyTarget} />}

                {/* Smooth playback map center helper */}
                <PlaybackCenterer target={activePlaybackCoord} active={autoCenter && isPlaying} />

                {/* Road-snapped trail in background (if loaded) */}
                {trail.length > 1 && (
                  <Polyline positions={trail} color={selectedColor} weight={6} opacity={0.15} />
                )}

                {/* Completed raw GPS trail */}
                {completedTrail.length > 1 && (
                  <Polyline positions={completedTrail} color={selectedColor} weight={4} opacity={0.9} />
                )}

                {/* Remaining raw GPS trail (Dashed) */}
                {remainingTrail.length > 1 && (
                  <Polyline positions={remainingTrail} color={selectedColor} weight={3} opacity={0.25} dashArray="5, 10" />
                )}

                {/* Raw GPS ping dots (rendered only up to current playback index) */}
                {rawTrail.slice(0, playbackIndex + 1).map((pt, idx) => (
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
                      <div style={{ fontFamily: 'system-ui,sans-serif', fontSize: 11 }}>
                        <strong>GPS Ping #{idx + 1}</strong>
                        {sessionPings[idx] && (
                          <div style={{ marginTop: 4 }}>
                            Time: {new Date(sessionPings[idx].recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}<br/>
                            Speed: {(sessionPings[idx].speed_kmph || 0).toFixed(1)} km/h
                          </div>
                        )}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}

                {/* Stop Point Markers rendering stop duration in minutes */}
                {stops.map((stop, sIdx) => (
                  <Marker
                    key={`stop-${sIdx}`}
                    position={[stop.lat, stop.lng]}
                    icon={createStopIcon(stop.durationMinutes)}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'system-ui,sans-serif', minWidth: 160 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: '#ef4444', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          🛑 Stopped for {stop.durationMinutes} mins
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
                          <strong>Arrival:</strong> {fmtDateTime(stop.startTime)}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
                          <strong>Departure:</strong> {fmtDateTime(stop.endTime)}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Playback Cursor Marker (Only if coordinate is valid) */}
                {activePlaybackCoord && selectedSession && (
                  <Marker
                    position={activePlaybackCoord}
                    icon={createUserIcon(selectedSession.user_name, selectedColor, true)}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'system-ui,sans-serif', minWidth: 160 }}>
                        <div style={{ fontWeight: 850, fontSize: 14, marginBottom: 4 }}>{selectedSession.user_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
                          📍 {activePlaybackCoord[0].toFixed(5)}, {activePlaybackCoord[1].toFixed(5)}
                        </div>
                        {activePing && (
                          <>
                            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
                              ⏱ Time: {new Date(activePing.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
                              ⚡ Speed: {activePing.speed_kmph?.toFixed(1) || '0.0'} km/h
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                              🎯 Accuracy: ±{activePing.accuracy?.toFixed(0) || '0'}m
                            </div>
                          </>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Render other active staff positions on map (excluding selected) */}
                {activeSessions.map((session, idx) => {
                  const lat = parseFloat(session.last_lat);
                  const lng = parseFloat(session.last_lng);
                  if (isNaN(lat) || isNaN(lng)) return null;
                  if (selectedSession && selectedSession.id === session.id) return null; // Rendered as active playback marker
                  const color = getColor(idx);
                  return (
                    <Marker
                      key={session.id}
                      position={[lat, lng]}
                      icon={createUserIcon(session.user_name, color, false)}
                      eventHandlers={{ click: () => handleSelectSession(session) }}
                    >
                      <Popup>
                        <div style={{ fontFamily: 'system-ui,sans-serif', minWidth: 160 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{session.user_name}</div>
                          <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>📍 {session.last_lat?.toFixed(5)}, {session.last_lng?.toFixed(5)}</div>
                          <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>⏱ Active {fmtDuration(session.duration_minutes)}</div>
                          <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>🚗 Distance: {session.distance_km?.toFixed(2) || '0.00'} km</div>
                          <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>⚡ Speed: {session.current_speed_kmph?.toFixed(1) || '0.0'} km/h</div>
                          <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600, marginTop: 4 }}>{session.ping_count} GPS pings</div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>

              {/* Live indicator overlay */}
              <div style={{
                position: 'absolute', top: 12, right: 12, zIndex: 999,
                background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: loadError ? '#ef4444' : '#22c55e', animation: loadError ? 'none' : 'live-pulse 1.5s infinite' }} />
                  <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>
                    {loadError ? 'DISCONNECTED' : `LIVE · Refreshes every ${REFRESH_INTERVAL_MS / 1000}s`}
                  </span>
                </div>
                {snapping && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 4, marginTop: 2 }}>
                    <Loader2 size={11} className="spin-icon" color="#3b82f6" />
                    <span style={{ color: '#3b82f6', fontSize: 10, fontWeight: 600 }}>Snapping path to roads...</span>
                  </div>
                )}
              </div>

              {/* No GPS data warning for selected session */}
              {selectedSession && rawTrail.length === 0 && !loading && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  zIndex: 999, background: 'rgba(0,0,0,0.85)', color: '#fff',
                  padding: '16px 20px', borderRadius: 10, textAlign: 'center', fontSize: 13,
                  border: '1px solid rgba(255,255,255,0.1)', maxWidth: 280
                }}>
                  <AlertCircle size={22} style={{ marginBottom: 6, color: '#f59e0b', margin: '0 auto 8px' }} />
                  <div style={{ fontWeight: 700 }}>No GPS Trail Available</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>No coordinates recorded for this session. The user might have been offline.</div>
                </div>
              )}

              {/* General No GPS data message */}
              {!loading && activeSessions.length > 0 && activeSessions.every(s => !s.last_lat) && !selectedSession && (
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

            {/* Playback Controls Panel */}
            {selectedSession && rawTrail.length > 0 && (
              <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0 }}>
                {/* Control elements row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  {/* Play/Pause Button */}
                  <button
                    onClick={handlePlayPause}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'var(--color-primary-light)',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(99, 102, 241, 0.4)',
                      transition: 'all 0.2s',
                      flexShrink: 0
                    }}
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause size={16} fill="#fff" /> : <Play size={16} fill="#fff" style={{ marginLeft: 2 }} />}
                  </button>

                  {/* Range Timeline Slider */}
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, rawTrail.length - 1)}
                    value={playbackIndex}
                    onChange={e => {
                      setPlaybackIndex(parseInt(e.target.value, 10));
                      setIsPlaying(false);
                    }}
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      background: 'var(--color-border)',
                      outline: 'none',
                      cursor: 'pointer',
                      accentColor: 'var(--color-primary-light)',
                      minWidth: 150
                    }}
                  />

                  {/* Playback Time stamp */}
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    minWidth: 80,
                    textAlign: 'center',
                    flexShrink: 0
                  }}>
                    {activePing ? new Date(activePing.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                  </div>

                  {/* Speed Multipliers */}
                  <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                    {[1, 2, 5, 10, 20].map(speed => (
                      <button
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        style={{
                          padding: '6px 12px',
                          background: playbackSpeed === speed ? 'var(--color-primary-light)' : 'transparent',
                          color: playbackSpeed === speed ? '#fff' : 'var(--color-text-muted)',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>

                  {/* Auto Center Map Toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', userSelect: 'none', color: 'var(--color-text-secondary)', marginLeft: 'auto', flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={autoCenter}
                      onChange={e => setAutoCenter(e.target.checked)}
                      style={{ cursor: 'pointer', accentColor: 'var(--color-primary-light)' }}
                    />
                    Follow Marker
                  </label>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'var(--color-border)', opacity: 0.5 }} />

                {/* Statistics Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: 10,
                  textAlign: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Straight distance</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)' }}>{stats.straightDistanceKm} km</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Moving</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)' }}>{stats.movingDurationStr}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Stopped</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)' }}>{stats.stoppedDurationStr}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Stops</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#ef4444' }}>{stats.stopsCount}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Max speed</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)' }}>{stats.maxSpeedKmph} km/h</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Pings</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)' }}>{stats.pingsCount}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Attendance History Tab ────────────────────────────────────── */}
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
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                      No attendance sessions recorded yet.
                    </td>
                  </tr>
                ) : (
                  history.map(s => (
                    <tr key={s.id}>
                      <td><div style={{ fontWeight: 700 }}>{s.user_name}</div></td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.user_email}</td>
                      <td>{fmtDateTime(s.clock_in_at)}</td>
                      <td>{s.clock_out_at ? fmtDateTime(s.clock_out_at) : <span style={{ color: '#22c55e', fontWeight: 600 }}>Active</span>}</td>
                      <td><span className="badge badge-blue">{fmtDuration(s.duration_minutes)}</span></td>
                      <td><span className="badge badge-purple">{s.distance_km?.toFixed(2) || '0.00'} km</span></td>
                      <td><span className="badge badge-gray">{s.ping_count} pings</span></td>
                      <td>
                        {s.status === 'ACTIVE'
                          ? <span className="badge badge-green">Active</span>
                          : <span className="badge badge-gray">Ended</span>
                        }
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setSelectedSession(s);
                            setTab('live');
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12 }}
                          title="Load and play the route trail of this session"
                        >
                          <Navigation size={12} />
                          Play Route
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── GPS Logs Tab ────────────────────────────────────────────── */}
      {tab === 'logs' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: 10 }}>

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={logsSearch}
                onChange={e => setLogsSearch(e.target.value)}
                style={{
                  width: '100%', padding: '7px 12px 7px 32px',
                  background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
                  borderRadius: 8, fontSize: 13, color: 'var(--color-text-primary)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            {/* Stats summary */}
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
              {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
              {' · '}
              {filteredSessions.reduce((acc, s) => acc + (s.ping_count || 0), 0).toLocaleString()} pings
            </span>
            {/* Export CSV */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => exportLogsCSV(filteredSessions, logsMap)}
              title="Export visible sessions + loaded pings as CSV"
            >
              <Download size={13} />
              Export CSV
            </button>
          </div>

          {/* Sessions table (outer) */}
          <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr style={{ background: 'var(--color-bg-secondary)' }}>
                    {/* Expand toggle */}
                    <th style={{ width: 32, padding: '9px 8px' }} />
                    <th
                      style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      onClick={() => handleSortChange('user_name')}
                    >
                      Staff Name <SortIcon col="user_name" />
                    </th>
                    <th
                      style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      onClick={() => handleSortChange('clock_in_at')}
                    >
                      Clock In <SortIcon col="clock_in_at" />
                    </th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>Clock Out</th>
                    <th
                      style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      onClick={() => handleSortChange('duration_minutes')}
                    >
                      Duration <SortIcon col="duration_minutes" />
                    </th>
                    <th
                      style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      onClick={() => handleSortChange('distance_km')}
                    >
                      Distance <SortIcon col="distance_km" />
                    </th>
                    <th
                      style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      onClick={() => handleSortChange('ping_count')}
                    >
                      Pings <SortIcon col="ping_count" />
                    </th>
                    <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
                        No sessions found.
                      </td>
                    </tr>
                  )}

                  {filteredSessions.map((s, idx) => {
                    const color = getColor(idx);
                    const isExpanded = expandedLog === s.id;
                    const pings = logsMap[s.id];
                    const isPingLoading = loadingPings[s.id];

                    return (
                      <>
                        {/* Session summary row */}
                        <tr
                          key={s.id}
                          style={{
                            borderTop: '1px solid var(--color-border)',
                            background: isExpanded ? `${color}08` : (idx % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary)'),
                            cursor: 'pointer',
                            transition: 'background 0.1s',
                          }}
                          onClick={() => toggleExpandLog(s.id)}
                        >
                          {/* Expand icon */}
                          <td style={{ padding: '10px 8px 10px 12px', textAlign: 'center' }}>
                            <ChevronDown
                              size={15}
                              color={isExpanded ? color : 'var(--color-text-muted)'}
                              style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                            />
                          </td>

                          {/* Staff name with avatar */}
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              <div style={{
                                width: 30, height: 30, borderRadius: '50%', background: color, flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff', fontWeight: 900, fontSize: 11,
                              }}>
                                {(s.user_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{s.user_name}</div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{s.user_email}</div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>
                            {fmtDateTime(s.clock_in_at)}
                          </td>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>
                            {s.clock_out_at ? fmtDateTime(s.clock_out_at) : <span style={{ color: '#22c55e', fontWeight: 700 }}>Active</span>}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <span className="badge badge-blue">{fmtDuration(s.duration_minutes)}</span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <span className="badge badge-purple">{(s.distance_km ?? 0).toFixed(2)} km</span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <span className="badge badge-gray">{s.ping_count ?? 0}</span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {s.status === 'ACTIVE'
                              ? <span className="badge badge-green" style={{ animation: 'live-pulse 2s infinite' }}>● Live</span>
                              : <span className="badge badge-gray">Ended</span>
                            }
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSession(s);
                                setTab('live');
                              }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11 }}
                            >
                              <Navigation size={11} />
                              Play
                            </button>
                          </td>
                        </tr>

                        {/* Expanded ping detail row */}
                        {isExpanded && (
                          <tr key={`${s.id}-pings`} style={{ borderTop: 'none' }}>
                            <td colSpan={9} style={{ padding: 0 }}>
                              <div style={{ background: 'var(--color-bg-primary)', borderLeft: `3px solid ${color}`, margin: '0 0 2px 0' }}>
                                {isPingLoading ? (
                                  <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                                    <div className="loading-spinner" />
                                  </div>
                                ) : !pings || pings.length === 0 ? (
                                  <div style={{ padding: '16px 20px', fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                                    No GPS pings recorded for this session yet.
                                  </div>
                                ) : (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                    <thead>
                                      <tr style={{ background: `${color}12` }}>
                                        <th style={{ padding: '6px 14px 6px 20px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>#</th>
                                        <th style={{ padding: '6px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Time</th>
                                        <th style={{ padding: '6px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Latitude</th>
                                        <th style={{ padding: '6px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Longitude</th>
                                        <th style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Accuracy</th>
                                        <th style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Speed</th>
                                        <th style={{ padding: '6px 14px 6px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Δ Distance</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {pings.map((ping, i) => (
                                        <tr
                                          key={ping.id || i}
                                          style={{
                                            borderTop: '1px solid var(--color-border)',
                                            background: i % 2 === 0 ? 'transparent' : `${color}05`,
                                          }}
                                        >
                                          <td style={{ padding: '5px 14px 5px 20px', color: 'var(--color-text-muted)', fontWeight: 600, fontFamily: 'monospace' }}>{i + 1}</td>
                                          <td style={{ padding: '5px 14px', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11 }}>
                                            {ping.recorded_at
                                              ? new Date(ping.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                              : '--'}
                                          </td>
                                          <td style={{ padding: '5px 14px', color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: 11 }}>
                                            {ping.lat?.toFixed(6) ?? '--'}
                                          </td>
                                          <td style={{ padding: '5px 14px', color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: 11 }}>
                                            {ping.lng?.toFixed(6) ?? '--'}
                                          </td>
                                          <td style={{ padding: '5px 14px', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                                            ±{ping.accuracy?.toFixed(0) ?? '--'}m
                                          </td>
                                          <td style={{ padding: '5px 14px', textAlign: 'right', color: (ping.speed_kmph ?? 0) > 0 ? '#3b82f6' : 'var(--color-text-muted)', fontWeight: (ping.speed_kmph ?? 0) > 0 ? 700 : 400 }}>
                                            {(ping.speed_kmph ?? 0).toFixed(1)} km/h
                                          </td>
                                          <td style={{ padding: '5px 14px', textAlign: 'right', color: (ping.distance_from_last_km ?? 0) > 0 ? '#22c55e' : 'var(--color-text-muted)', fontWeight: (ping.distance_from_last_km ?? 0) > 0 ? 700 : 400 }}>
                                            {(ping.distance_from_last_km ?? 0) > 0
                                              ? `+${(ping.distance_from_last_km * 1000).toFixed(0)}m`
                                              : '—'
                                            }
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr style={{ borderTop: `2px solid ${color}40`, background: `${color}10` }}>
                                        <td colSpan={6} style={{ padding: '6px 14px 6px 20px', fontWeight: 700, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                                          Total: {pings.length} pings
                                        </td>
                                        <td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 800, color: '#22c55e', fontSize: 11 }}>
                                          {(pings.reduce((acc, p) => acc + (p.distance_from_last_km || 0), 0) * 1000).toFixed(0)}m total
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
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
          </div>
        </div>
      )}

      {/* ── Global animation keyframes ───────────────────────────────────── */}
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
          background: var(--color-bg-primary, #1a1a2e);
        }
      `}</style>
    </div>
  );
}
