/**
 * SalesAttendance.jsx — GPS Attendance tracking for Sales staff.
 *
 * Architecture: SIMPLE.
 *   Every GPS position update → ping backend with raw lat/lng/accuracy/speed.
 *   Backend (AttendanceController) calculates distance & cumulative km.
 *   No client-side haversine, no drift filter, no complex state.
 *
 * On Android: uses the native TrackingService (background foreground-service)
 *   which fires on every ≥1 m movement.
 * On Web/PWA: uses navigator.geolocation.watchPosition with enableHighAccuracy.
 *   A 30-sec heartbeat keeps stationary users live on the admin map.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { attendanceAPI, getApiBase } from '../../api';
import toast from 'react-hot-toast';

const Tracking = registerPlugin('Tracking');
import { MapPin, Clock, Play, Square, CheckCircle } from 'lucide-react';

const HEARTBEAT_MS  = 30_000; // Stationary heartbeat (web/PWA only)
const MIN_PING_MS   = 2_000;  // Minimum gap between pings (debounce for web)

/** Format seconds as HH:MM:SS */
function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

/** Format ISO datetime to short time string */
function fmtTime(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Format duration in minutes */
function fmtDuration(mins) {
  if (mins == null || mins < 0) return '--';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function SalesAttendance() {
  const [sessions, setSessions]         = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [starting, setStarting]         = useState(false);
  const [stopping, setStopping]         = useState(false);
  const [gpsStatus, setGpsStatus]       = useState('idle'); // idle|acquiring|active|error
  const [lastPingAt, setLastPingAt]     = useState(null);
  const [lastAccuracy, setLastAccuracy] = useState(null);
  const [elapsed, setElapsed]           = useState(0);

  // Refs (survive re-renders, accessible inside callbacks)
  const watchIdRef      = useRef(null);   // watchPosition ID (web)
  const heartbeatRef    = useRef(null);   // heartbeat interval ID (web)
  const timerRef        = useRef(null);   // elapsed-time interval ID
  const lastPingTsRef   = useRef(0);      // timestamp of last ping (debounce)
  const sessionIdRef    = useRef(null);   // session ID for callbacks
  const pollRef         = useRef(null);   // UI refresh polling interval

  // ─── GPS permission (native only) ─────────────────────────────────────────
  const requestGpsPermission = async () => {
    if (!Capacitor.isNativePlatform()) return; // Browser handles it natively
    const status = await Geolocation.checkPermissions();
    if (status.location !== 'granted') {
      const result = await Geolocation.requestPermissions({ permissions: ['location'] });
      if (result.location !== 'granted') {
        throw new Error('Location permission denied');
      }
    }
  };

  // ─── Get current position (unified) ───────────────────────────────────────
  const getCurrentPosition = () => {
    if (Capacitor.isNativePlatform()) {
      return Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
    }
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 10000, maximumAge: 5000,
      });
    });
  };

  // ─── Poll backend for fresh session data ─────────────────────────────────
  // TrackingService (Android background service) pings the backend directly via
  // HTTP, so React state never sees those updates. A 10-second poll ensures the
  // distance_km and current_speed_kmph shown on screen stays current.
  const startPolling = useCallback((sessionId) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await attendanceAPI.my();
        const list = res.data.data || [];
        const fresh = list.find(s => s.id === sessionId);
        if (fresh) {
          setActiveSession(fresh);
          setSessions(list);
        }
      } catch {
        // Silent — network blip
      }
    }, 10_000); // Every 10 seconds
  }, []);

  const stopPolling = () => {
    clearInterval(pollRef.current);
    pollRef.current = null;
  };

  // Simple: just raw coordinates. Backend does all distance/speed math.
  const sendPing = useCallback(async (latitude, longitude, accuracy, speed = null) => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    // Debounce: prevent hammering the backend more than once every MIN_PING_MS
    const now = Date.now();
    if (now - lastPingTsRef.current < MIN_PING_MS) return;
    lastPingTsRef.current = now;

    try {
      const res = await attendanceAPI.ping(sid, latitude, longitude, accuracy, speed);
      if (res.data?.session) {
        setActiveSession(res.data.session);
        setSessions(prev => prev.map(s => s.id === res.data.session.id ? res.data.session : s));
      }
      setLastPingAt(new Date());
      setLastAccuracy(Math.round(accuracy ?? 0));
      setGpsStatus('active');
    } catch (err) {
      console.warn('GPS ping failed:', err);
    }
  }, []);

  // ─── Start web watchPosition + heartbeat ──────────────────────────────────
  const startWatching = useCallback((sessionId) => {
    stopWatching();
    sessionIdRef.current = sessionId;

    const onPos = (pos) => {
      if (!pos?.coords) return;
      const { latitude, longitude, accuracy, speed } = pos.coords;
      sendPing(latitude, longitude, accuracy, speed);
    };
    const onErr = (err) => {
      console.warn('watchPosition error:', err);
      setGpsStatus('error');
    };

    if (Capacitor.isNativePlatform()) {
      // On Android the native TrackingService handles continuous updates.
      // Capacitor watchPosition is used here as a secondary update path.
      if (typeof Geolocation.watchPosition === 'function') {
        Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000 },
          (pos, err) => { if (err) onErr(err); else if (pos) onPos(pos); }
        ).then(id => { watchIdRef.current = id; }).catch(onErr);
      }
    } else {
      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(onPos, onErr, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 0,
        });
      } else {
        setGpsStatus('error');
        toast.error('Geolocation not supported in this browser.');
        return;
      }
    }

    // Heartbeat: re-ping every 30 s even if stationary (keeps admin map fresh)
    heartbeatRef.current = setInterval(async () => {
      try {
        const pos = await getCurrentPosition();
        if (pos?.coords) {
          const { latitude, longitude, accuracy, speed } = pos.coords;
          // Bypass debounce for heartbeat by resetting timestamp
          lastPingTsRef.current = 0;
          sendPing(latitude, longitude, accuracy, speed);
        }
      } catch (e) {
        console.warn('Heartbeat GPS read failed:', e);
      }
    }, HEARTBEAT_MS);
  }, [sendPing]);

  // ─── Stop watchPosition + heartbeat ───────────────────────────────────────
  const stopWatching = () => {
    if (watchIdRef.current !== null) {
      if (Capacitor.isNativePlatform()) {
        Geolocation.clearWatch({ id: watchIdRef.current }).catch(() => {});
      } else {
        navigator.geolocation?.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
    }
    clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
  };

  // ─── Elapsed timer ─────────────────────────────────────────────────────────
  const startTimer = (clockInAt) => {
    clearInterval(timerRef.current);
    const tick = () => {
      const sec = Math.floor((Date.now() - new Date(clockInAt).getTime()) / 1000);
      setElapsed(sec > 0 ? sec : 0);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  };

  // ─── Load initial data ─────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      const res = await attendanceAPI.my();
      const list = res.data.data || [];
      setSessions(list);

      const active = list.find(s => s.status === 'ACTIVE');
      if (active) {
        setActiveSession(active);
        sessionIdRef.current = active.id;
        startTimer(active.clock_in_at);
        setGpsStatus('active');
        startPolling(active.id);

        if (Capacitor.isNativePlatform()) {
          const token   = localStorage.getItem('accessToken');
          const baseUrl = getApiBase();
          try {
            await Tracking.startTracking({
              sessionId: active.id,
              token,
              apiUrl: baseUrl,
              interval: 0,
              distance: 1,
            });
          } catch (e) {
            console.warn('Native startTracking on load failed:', e);
          }
          // On Android: TrackingService handles raw GPS pings; watchPosition supplements
          startWatching(active.id);
        } else {
          startWatching(active.id);
        }
      }
    } catch {
      // Silent — user might not be logged in
    } finally {
      setLoading(false);
    }
  }, [startWatching]); // eslint-disable-line

  useEffect(() => {
    loadSessions();
    return () => {
      stopWatching();
      stopPolling();
      clearInterval(timerRef.current);
    };
  }, []); // eslint-disable-line

  // ─── Start Attendance ──────────────────────────────────────────────────────
  const handleStart = async () => {
    setStarting(true);
    setGpsStatus('acquiring');
    try {
      // 1. Request GPS permission (triggers Android dialog if needed)
      try {
        await requestGpsPermission();
      } catch {
        toast.error('Location permission is required. Please allow it in device settings.');
        setGpsStatus('error');
        return;
      }

      // 2. Get initial GPS fix
      let gps = null;
      try {
        const pos = await getCurrentPosition();
        gps = {
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy:  pos.coords.accuracy,
          speed:     pos.coords.speed ?? null,
        };
        setLastAccuracy(Math.round(pos.coords.accuracy));
      } catch {
        toast.error('GPS must be enabled to start attendance.');
        setGpsStatus('error');
        return;
      }

      if (!gps?.latitude || !gps?.longitude) {
        toast.error('Could not get GPS fix. Please enable GPS and try again.');
        setGpsStatus('error');
        return;
      }

      // 3. Clock in on backend
      const res     = await attendanceAPI.start(gps);
      const session = res.data.data;
      setActiveSession(session);
      setSessions(prev => [session, ...prev.filter(s => s.id !== session.id)]);
      setLastPingAt(new Date());
      setGpsStatus('active');
      startTimer(session.clock_in_at);
      startPolling(session.id);

      // 4. Start native background service (Android) + web watcher
      if (Capacitor.isNativePlatform()) {
        const token   = localStorage.getItem('accessToken');
        const baseUrl = getApiBase();
        try {
          await Tracking.startTracking({
            sessionId: session.id,
            token,
            apiUrl: baseUrl,
            interval: 0,
            distance: 1,
          });
        } catch (e) {
          console.warn('Native startTracking failed:', e);
        }
        startWatching(session.id); // Capacitor watchPosition as supplement
      } else {
        startWatching(session.id);
      }

      toast.success('Attendance started! GPS tracking is active.');
    } catch (err) {
      setGpsStatus('error');
      toast.error(err.response?.data?.message || 'Failed to start attendance');
    } finally {
      setStarting(false);
    }
  };

  // ─── Stop Attendance ───────────────────────────────────────────────────────
  const handleStop = async () => {
    if (!activeSession) return;
    if (!window.confirm('Clock out and stop location tracking?')) return;

    setStopping(true);
    try {
      const res     = await attendanceAPI.stop(activeSession.id);
      const updated = res.data.data;

      if (Capacitor.isNativePlatform()) {
        try { await Tracking.stopTracking(); } catch (e) { console.warn(e); }
      }
      stopWatching();
      stopPolling();
      clearInterval(timerRef.current);
      timerRef.current  = null;
      sessionIdRef.current = null;

      setActiveSession(null);
      setGpsStatus('idle');
      setElapsed(0);
      setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
      toast.success('Attendance ended. Have a great day!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to stop attendance');
    } finally {
      setStopping(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  const isActive = !!activeSession;

  const gpsColor = {
    idle: 'var(--s-text-3)', acquiring: '#f59e0b',
    active: '#22c55e', error: '#ef4444',
  }[gpsStatus];

  const todaysSessions = sessions.filter(s => {
    const d = new Date(s.created_at);
    return d.toDateString() === new Date().toDateString();
  });

  if (loading) {
    return (
      <div className="s-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--s-border)', borderTopColor: 'var(--s-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="s-page" style={{ padding: '0 0 24px 0' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 20px 0', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Clock size={20} color="var(--s-primary)" />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--s-text)', margin: 0 }}>Attendance</h2>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--s-text-3)', margin: 0 }}>
          Track your working hours and share your live location.
        </p>
      </div>

      {/* ── Status Card ───────────────────────────────────────────────────── */}
      <div style={{
        margin: '0 16px 20px',
        background: isActive ? 'rgba(34,197,94,0.08)' : 'var(--s-card)',
        border: `2px solid ${isActive ? 'rgba(34,197,94,0.3)' : 'var(--s-border)'}`,
        borderRadius: 16, padding: 20, textAlign: 'center',
      }}>

        {isActive ? (
          <>
            {/* Live Timer */}
            <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-2px', color: '#22c55e', fontVariantNumeric: 'tabular-nums', marginBottom: 8 }}>
              {formatElapsed(elapsed)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--s-text-3)', marginBottom: 16 }}>
              Clocked in at {fmtTime(activeSession?.clock_in_at)}
            </div>

            {/* Speed & Distance */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '0 auto 20px', maxWidth: 340 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 8px', border: '1px solid var(--s-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--s-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Speed</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--s-text)' }}>
                  {activeSession?.current_speed_kmph?.toFixed(1) ?? '0.0'} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--s-text-3)' }}>km/h</span>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 8px', border: '1px solid var(--s-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--s-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Distance</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--s-text)' }}>
                  {activeSession?.distance_km?.toFixed(2) ?? '0.00'} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--s-text-3)' }}>km</span>
                </div>
              </div>
            </div>

            {/* GPS Status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: gpsColor,
                boxShadow: gpsStatus === 'active' ? `0 0 8px ${gpsColor}` : 'none',
                animation: gpsStatus === 'active' ? 'pulse-dot 1.5s infinite' : 'none',
              }} />
              <span style={{ fontSize: 12, color: gpsColor, fontWeight: 600 }}>
                {gpsStatus === 'active'    && `GPS Active • ±${lastAccuracy ?? '?'}m`}
                {gpsStatus === 'acquiring' && 'Acquiring GPS…'}
                {gpsStatus === 'error'     && 'GPS Unavailable'}
                {gpsStatus === 'idle'      && 'GPS Idle'}
              </span>
              {lastPingAt && (
                <span style={{ fontSize: 11, color: 'var(--s-text-3)' }}>
                  · Last ping {lastPingAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>

            {/* Stop Button */}
            <button
              onClick={handleStop}
              disabled={stopping}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: '16px 24px',
                background: stopping ? 'var(--s-surface)' : '#ef4444',
                color: '#fff', border: 'none', borderRadius: 12,
                fontSize: 16, fontWeight: 800, cursor: stopping ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
              }}
            >
              <Square size={20} fill="#fff" />
              {stopping ? 'Stopping…' : 'Stop Attendance'}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 56, marginBottom: 12 }}>📍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--s-text)', marginBottom: 6 }}>You are off duty</div>
            <div style={{ fontSize: 13, color: 'var(--s-text-3)', marginBottom: 24 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <button
              onClick={handleStart}
              disabled={starting}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: '18px 24px',
                background: starting ? 'var(--s-surface)' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: '#fff', border: 'none', borderRadius: 14,
                fontSize: 17, fontWeight: 900, cursor: starting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s', boxShadow: '0 6px 24px rgba(34,197,94,0.45)',
                animation: starting ? 'none' : 'pulse-btn 2s infinite',
              }}
            >
              {starting ? (
                <>
                  <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Getting GPS…
                </>
              ) : (
                <>
                  <Play size={22} fill="#fff" />
                  Start Attendance
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* ── Today's Log ───────────────────────────────────────────────────── */}
      {todaysSessions.length > 0 && (
        <div style={{ margin: '0 16px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--s-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Today's Log
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todaysSessions.map(s => (
              <div key={s.id} style={{ background: 'var(--s-card)', border: '1px solid var(--s-border)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--s-text)', marginBottom: 2 }}>
                    {fmtTime(s.clock_in_at)} → {s.clock_out_at ? fmtTime(s.clock_out_at) : '…'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--s-text-3)' }}>
                    {s.ping_count} GPS pings · {fmtDuration(s.duration_minutes)} · {(s.distance_km ?? 0).toFixed(2)} km
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {s.status === 'ACTIVE' ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#22c55e' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse-dot 1.5s infinite' }} />
                      LIVE
                    </span>
                  ) : (
                    <CheckCircle size={16} color="#22c55e" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer Info ───────────────────────────────────────────────────── */}
      <div style={{ margin: '0 16px', padding: '12px 14px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <MapPin size={15} color="#3b82f6" style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 11.5, color: 'var(--s-text-3)', lineHeight: 1.5 }}>
          Your location is recorded on every ≥1 metre movement, and every 30 seconds while stationary. GPS only runs while this app is open.
        </div>
      </div>

      {/* ── Animations ────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
        @keyframes pulse-btn {
          0%, 100% { box-shadow: 0 6px 24px rgba(34,197,94,0.45); }
          50% { box-shadow: 0 6px 32px rgba(34,197,94,0.7); }
        }
      `}</style>
    </div>
  );
}
