/**
 * SalesAttendance.jsx — GPS Attendance tracking for Sales staff.
 *
 * Architecture:
 *   • On Android: native TrackingService (foreground service) is the PRIMARY GPS source.
 *     Pings at minimum every 2 seconds using a dual-source strategy:
 *       - LocationManager.GPS_PROVIDER + NETWORK_PROVIDER (intervalMs=2000)
 *       - Handler alarm loop every 2 s (getLastKnownLocation fallback)
 *     Service persists even when the app is closed. BootReceiver auto-restarts it.
 *   • On Web/PWA: navigator.geolocation.watchPosition + 30-sec stationary heartbeat.
 *
 * Offline Cache:
 *   • If a GPS ping fails (network error), it is queued in localStorage (key: 'gps_cache').
 *   • On mount and on 'online' events, the queue is flushed to the backend in order.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { App } from '@capacitor/app';
import { attendanceAPI, getApiBase } from '../../api';
import toast from 'react-hot-toast';

const Tracking = registerPlugin('Tracking');
import { MapPin, Clock, Play, Square, CheckCircle, WifiOff, Database, Activity, Navigation, Zap } from 'lucide-react';

const HEARTBEAT_MS  = 30_000; // Stationary heartbeat (web/PWA only)
const MIN_PING_MS   = 2_000;  // Minimum gap between pings (debounce)
const PING_INTERVAL = 2_000;  // Native service interval in ms

// ─── GPS Offline Cache Helpers ─────────────────────────────────────────────────
const CACHE_KEY = 'gps_cache';

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); }
  catch { return []; }
}

function writeCache(queue) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(queue));
  } catch {
    try {
      const trimmed = queue.slice(-50);
      localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
    } catch {}
  }
}

function pushToCache(entry) {
  const queue = readCache();
  queue.push({ ...entry, cachedAt: Date.now() });
  writeCache(queue);
}

function clearCache() { localStorage.removeItem(CACHE_KEY); }

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

function fmtTime(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(mins) {
  if (mins == null || mins < 0) return '--';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ─── Tiny Ping Ticker ─────────────────────────────────────────────────────────
function PingTicker({ lastPingAt }) {
  const [age, setAge] = useState(0);
  useEffect(() => {
    if (!lastPingAt) return;
    const id = setInterval(() => {
      setAge(Math.floor((Date.now() - lastPingAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [lastPingAt]);
  if (!lastPingAt) return null;
  return <span style={{ color: 'var(--s-text-3)', fontSize: 11 }}>{age}s ago</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SalesAttendance() {
  const [sessions, setSessions]           = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [starting, setStarting]           = useState(false);
  const [stopping, setStopping]           = useState(false);
  const [gpsStatus, setGpsStatus]         = useState('idle');
  const [lastPingAt, setLastPingAt]       = useState(null);
  const [lastAccuracy, setLastAccuracy]   = useState(null);
  const [pingCount, setPingCount]         = useState(0);
  const [elapsed, setElapsed]             = useState(0);
  const [cacheSize, setCacheSize]         = useState(0);
  const [isOnline, setIsOnline]           = useState(navigator.onLine);

  const watchIdRef      = useRef(null);
  const heartbeatRef    = useRef(null);
  const timerRef        = useRef(null);
  const lastPingTsRef   = useRef(0);
  const sessionIdRef    = useRef(null);
  const pollRef         = useRef(null);
  const flushingRef     = useRef(false);
  const appListenerRef  = useRef(null);

  // ─── Network listeners ─────────────────────────────────────────────────────
  useEffect(() => {
    const onOnline  = () => { setIsOnline(true); flushOfflineCache(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []); // eslint-disable-line

  // ─── GPS permission ────────────────────────────────────────────────────────
  const requestGpsPermission = async () => {
    if (!Capacitor.isNativePlatform()) return;
    const status = await Geolocation.checkPermissions();
    if (status.location !== 'granted') {
      const result = await Geolocation.requestPermissions({ permissions: ['location'] });
      if (result.location !== 'granted') throw new Error('Location permission denied');
    }
  };

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

  // ─── Flush offline cache ───────────────────────────────────────────────────
  const flushOfflineCache = useCallback(async () => {
    if (flushingRef.current) return;
    const queue = readCache();
    if (queue.length === 0) { setCacheSize(0); return; }

    flushingRef.current = true;
    const remaining = [...queue];

    for (let i = 0; i < queue.length; i++) {
      const entry = queue[i];
      try {
        await attendanceAPI.ping(
          entry.sessionId, entry.latitude, entry.longitude,
          entry.accuracy, entry.speed ?? null, null, null,
          new Date(entry.cachedAt || Date.now()).toISOString()
        );
        remaining.shift();
        writeCache(remaining);
        setCacheSize(remaining.length);
      } catch {
        break;
      }
    }

    if (remaining.length === 0) {
      clearCache(); setCacheSize(0);
      if (queue.length > 0) {
        toast.success(`${queue.length} cached ping${queue.length > 1 ? 's' : ''} synced.`);
      }
    }
    flushingRef.current = false;
  }, []);

  // ─── Poll backend for fresh session data ──────────────────────────────────
  const startPolling = useCallback((sessionId) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res   = await attendanceAPI.my();
        const list  = res.data.data || [];
        const fresh = list.find(s => s.id === sessionId);
        if (fresh) { setActiveSession(fresh); setSessions(list); }
      } catch {}
    }, 10_000);
  }, []);

  const stopPolling = () => { clearInterval(pollRef.current); pollRef.current = null; };

  // ─── Send a GPS ping ────────────────────────────────────────────────────────
  const sendPing = useCallback(async (latitude, longitude, accuracy, speed = null) => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    const now = Date.now();
    if (now - lastPingTsRef.current < MIN_PING_MS) return;
    lastPingTsRef.current = now;

    if (accuracy > 100) {
      setLastAccuracy(Math.round(accuracy ?? 0));
      return;
    }

    try {
      const res = await attendanceAPI.ping(sid, latitude, longitude, accuracy, speed, null, null, new Date(now).toISOString());
      if (res.data?.session) {
        setActiveSession(res.data.session);
        setSessions(prev => prev.map(s => s.id === res.data.session.id ? res.data.session : s));
      }
      setLastPingAt(new Date());
      setLastAccuracy(Math.round(accuracy ?? 0));
      setGpsStatus('active');
      setPingCount(c => c + 1);

      const cached = readCache();
      if (cached.length > 0) flushOfflineCache();
    } catch (err) {
      pushToCache({ sessionId: sid, latitude, longitude, accuracy, speed });
      setCacheSize(readCache().length);
      setGpsStatus('active');
      setLastPingAt(new Date());
      setLastAccuracy(Math.round(accuracy ?? 0));
      setPingCount(c => c + 1);
    }
  }, [flushOfflineCache]);

  // ─── Start GPS watcher (web fallback / supplement) ─────────────────────────
  const startWatching = useCallback((sessionId) => {
    clearInterval(heartbeatRef.current); heartbeatRef.current = null;
    if (watchIdRef.current !== null) {
      if (Capacitor.isNativePlatform()) {
        Geolocation.clearWatch({ id: watchIdRef.current }).catch(() => {});
      } else {
        navigator.geolocation?.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
    }
    sessionIdRef.current = sessionId;

    const onPos = (pos) => {
      if (!pos?.coords) return;
      const { latitude, longitude, accuracy, speed } = pos.coords;
      sendPing(latitude, longitude, accuracy, speed);
    };
    const onErr = (err) => console.warn('GPS watchPosition error:', err?.message ?? err);

    if (Capacitor.isNativePlatform()) {
      // Android: native TrackingService is primary — add web watcher as supplement
      try {
        Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000 },
          (pos, err) => { if (pos?.coords) onPos(pos); else onErr(err); }
        ).then(id => { watchIdRef.current = id; }).catch(() => {});
      } catch (e) { console.warn('watchPosition supplement failed:', e); }
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
      // Web heartbeat every 30 s
      heartbeatRef.current = setInterval(async () => {
        try {
          const pos = await getCurrentPosition();
          if (pos?.coords) { lastPingTsRef.current = 0; onPos(pos); }
        } catch (e) { console.warn('Heartbeat error:', e); }
      }, HEARTBEAT_MS);
    }
  }, [sendPing]);

  const stopWatching = useCallback(() => {
    clearInterval(heartbeatRef.current); heartbeatRef.current = null;
    if (watchIdRef.current !== null) {
      if (Capacitor.isNativePlatform()) {
        Geolocation.clearWatch({ id: watchIdRef.current }).catch(() => {});
      } else {
        navigator.geolocation?.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
    }
  }, []);

  // ─── App state listener (Android foreground/background) ────────────────────
  const registerAppStateListener = useCallback((sessionId) => {
    if (appListenerRef.current) {
      appListenerRef.current.remove().catch(() => {});
      appListenerRef.current = null;
    }
    if (!Capacitor.isNativePlatform()) return;

    App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        const sid     = sessionIdRef.current || sessionId;
        const token   = localStorage.getItem('accessToken');
        const baseUrl = getApiBase();
        if (!sid) return;
        try {
          await Tracking.startTracking({
            sessionId: sid, token, apiUrl: baseUrl,
            interval: PING_INTERVAL, distance: 0,
          });
        } catch (e) { console.warn('Re-startTracking on foreground:', e); }
        flushOfflineCache();
      }
    }).then(handle => { appListenerRef.current = handle; })
      .catch(e => console.warn('App.addListener failed:', e));
  }, [flushOfflineCache]);

  const removeAppStateListener = useCallback(() => {
    if (appListenerRef.current) {
      appListenerRef.current.remove().catch(() => {});
      appListenerRef.current = null;
    }
  }, []);

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

  // ─── Start native tracking service (Android) ───────────────────────────────
  const startNativeTracking = async (sessionId) => {
    if (!Capacitor.isNativePlatform()) return;
    const token   = localStorage.getItem('accessToken');
    const baseUrl = getApiBase();
    try {
      await Tracking.startTracking({
        sessionId, token, apiUrl: baseUrl,
        interval: PING_INTERVAL,  // 2000ms
        distance: 0,              // 0m — every update regardless of movement
      });
    } catch (e) { console.warn('Native startTracking failed:', e); }
  };

  // ─── Load initial data ─────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      const res    = await attendanceAPI.my();
      const list   = res.data.data || [];
      setSessions(list);

      const active = list.find(s => s.status === 'ACTIVE');
      if (active) {
        setActiveSession(active);
        sessionIdRef.current = active.id;
        setPingCount(active.ping_count || 0);
        startTimer(active.clock_in_at);
        setGpsStatus('active');
        startPolling(active.id);
        await startNativeTracking(active.id);
        startWatching(active.id);
        registerAppStateListener(active.id);
      }

      flushOfflineCache();
      setCacheSize(readCache().length);
    } catch {
      // Silent — user might not be logged in yet
    } finally {
      setLoading(false);
    }
  }, [startWatching, startPolling, registerAppStateListener, flushOfflineCache]);

  useEffect(() => {
    loadSessions();
    return () => {
      stopWatching(); stopPolling(); removeAppStateListener();
      clearInterval(timerRef.current);
    };
  }, []); // eslint-disable-line

  // ─── Start Attendance ──────────────────────────────────────────────────────
  const handleStart = async () => {
    setStarting(true);
    setGpsStatus('acquiring');
    try {
      try { await requestGpsPermission(); }
      catch {
        toast.error('Location permission is required. Please allow it in device settings.');
        setGpsStatus('error'); return;
      }

      let gps = null;
      try {
        const pos = await getCurrentPosition();
        gps = {
          latitude: pos.coords.latitude, longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy, speed: pos.coords.speed ?? null,
        };
        setLastAccuracy(Math.round(pos.coords.accuracy));
      } catch {
        toast.error('GPS must be enabled to start attendance.');
        setGpsStatus('error'); return;
      }

      if (!gps?.latitude || !gps?.longitude) {
        toast.error('Could not get GPS fix. Please enable GPS and try again.');
        setGpsStatus('error'); return;
      }

      const res     = await attendanceAPI.start(gps);
      const session = res.data.data;
      setActiveSession(session);
      setSessions(prev => [session, ...prev.filter(s => s.id !== session.id)]);
      setLastPingAt(new Date());
      setGpsStatus('active');
      setPingCount(0);
      startTimer(session.clock_in_at);
      startPolling(session.id);

      await startNativeTracking(session.id);
      startWatching(session.id);
      registerAppStateListener(session.id);

      toast.success('Attendance started! GPS is now tracking in background.');
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
      stopWatching(); stopPolling(); removeAppStateListener();
      clearInterval(timerRef.current);
      timerRef.current = null;
      sessionIdRef.current = null;

      setActiveSession(null);
      setGpsStatus('idle');
      setElapsed(0);
      setPingCount(0);
      setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));

      await flushOfflineCache();
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
    idle: '#64748b', acquiring: '#f59e0b', active: '#22c55e', error: '#ef4444',
  }[gpsStatus];

  const gpsLabel = {
    idle: 'GPS Idle', acquiring: 'Acquiring GPS…',
    active: `GPS Active  ±${lastAccuracy ?? '?'}m`, error: 'GPS Error',
  }[gpsStatus];

  const todaysSessions = sessions.filter(s => {
    const d = new Date(s.created_at);
    return d.toDateString() === new Date().toDateString();
  });

  if (loading) {
    return (
      <div className="s-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--s-border)', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'att-spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 13, color: 'var(--s-text-3)', fontWeight: 600 }}>Loading attendance…</span>
      </div>
    );
  }

  return (
    <div className="s-page" style={{ padding: '0 0 32px 0', maxWidth: 480, margin: '0 auto' }}>

      {/* ── Top Status Bar ─────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--s-text)', letterSpacing: '-0.5px' }}>Attendance</div>
          <div style={{ fontSize: 12, color: 'var(--s-text-3)', marginTop: 2 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {!isOnline && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', padding: '4px 8px', borderRadius: 20, border: '1px solid rgba(245,158,11,0.3)' }}>
              <WifiOff size={11} /> Offline
            </div>
          )}
          {cacheSize > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '4px 8px', borderRadius: 20, border: '1px solid rgba(59,130,246,0.25)' }}>
              <Database size={11} /> {cacheSize}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Card ──────────────────────────────────────────────────────── */}
      {isActive ? (
        <div style={{ margin: '0 16px 16px' }}>

          {/* Live Ring + Timer */}
          <div style={{
            background: 'linear-gradient(145deg, rgba(34,197,94,0.12) 0%, rgba(16,185,129,0.06) 100%)',
            border: '2px solid rgba(34,197,94,0.35)',
            borderRadius: 20, padding: '24px 20px 20px', textAlign: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Pulsing ring decoration */}
            <div style={{
              position: 'absolute', top: -20, right: -20,
              width: 100, height: 100, borderRadius: '50%',
              background: 'rgba(34,197,94,0.08)',
              animation: 'att-ring 2.5s ease-in-out infinite',
            }} />

            {/* LIVE badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 20, padding: '3px 10px', marginBottom: 12 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'att-dot 1.4s infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', letterSpacing: '0.08em' }}>LIVE TRACKING</span>
            </div>

            {/* Timer */}
            <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-3px', color: '#22c55e', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 6 }}>
              {formatElapsed(elapsed)}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--s-text-3)', marginBottom: 20 }}>
              Started at {fmtTime(activeSession?.clock_in_at)}
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
              {[
                { icon: <Navigation size={14} />, label: 'Distance', value: `${(activeSession?.distance_km ?? 0).toFixed(2)} km`, color: '#3b82f6' },
                { icon: <Zap size={14} />,        label: 'Speed',    value: `${(activeSession?.current_speed_kmph ?? 0).toFixed(1)} km/h`, color: '#f59e0b' },
                { icon: <Activity size={14} />,   label: 'Pings',    value: activeSession?.ping_count ?? pingCount, color: '#10b981' },
              ].map(({ icon, label, value, color }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4, color }}>
                    {icon}
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--s-text-3)' }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--s-text)' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* GPS status row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: cacheSize > 0 ? 12 : 18 }}>
              <div style={{
                width: 9, height: 9, borderRadius: '50%', background: gpsColor,
                boxShadow: gpsStatus === 'active' ? `0 0 10px ${gpsColor}` : 'none',
                animation: gpsStatus === 'active' ? 'att-dot 1.4s infinite' : 'none',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 12, color: gpsColor, fontWeight: 700 }}>{gpsLabel}</span>
              {lastPingAt && (
                <>
                  <span style={{ color: 'var(--s-text-3)', fontSize: 12 }}>·</span>
                  <PingTicker lastPingAt={lastPingAt} />
                </>
              )}
            </div>

            {/* Offline cache banner */}
            {cacheSize > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, padding: '8px 12px', background: 'rgba(59,130,246,0.08)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.2)' }}>
                <Database size={13} color="#3b82f6" />
                <span style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600 }}>
                  {cacheSize} ping{cacheSize > 1 ? 's' : ''} cached — will sync on reconnect
                </span>
              </div>
            )}

            {/* Stop button */}
            <button
              onClick={handleStop}
              disabled={stopping}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: '16px 24px',
                background: stopping ? 'rgba(239,68,68,0.2)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#fff', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 14,
                fontSize: 16, fontWeight: 800, cursor: stopping ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s', boxShadow: stopping ? 'none' : '0 6px 24px rgba(239,68,68,0.35)',
                letterSpacing: '-0.2px',
              }}
            >
              {stopping ? (
                <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'att-spin 0.8s linear infinite' }} />
              ) : (
                <Square size={18} fill="#fff" />
              )}
              {stopping ? 'Stopping…' : 'Stop Attendance'}
            </button>
          </div>

          {/* Background tracking info */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, padding: '10px 12px', background: 'rgba(59,130,246,0.06)', borderRadius: 12, border: '1px solid rgba(59,130,246,0.12)' }}>
            <MapPin size={14} color="#3b82f6" style={{ marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: 'var(--s-text-3)', lineHeight: 1.5 }}>
              GPS is tracked every 2 seconds <strong style={{ color: 'var(--s-text-2)' }}>even when the app is closed</strong>. Pings sync automatically when internet is restored.
            </span>
          </div>
        </div>
      ) : (
        /* ── Off Duty Card ──────────────────────────────────────────────── */
        <div style={{ margin: '0 16px 16px' }}>
          <div style={{
            background: 'var(--s-card)', border: '2px solid var(--s-border)',
            borderRadius: 20, padding: '36px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 64, marginBottom: 12, lineHeight: 1 }}>📍</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--s-text)', marginBottom: 6, letterSpacing: '-0.5px' }}>
              You're Off Duty
            </div>
            <div style={{ fontSize: 13, color: 'var(--s-text-3)', marginBottom: 28 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>

            <button
              onClick={handleStart}
              disabled={starting}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                width: '100%', padding: '18px 24px',
                background: starting
                  ? 'rgba(34,197,94,0.15)'
                  : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: '#fff', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 16,
                fontSize: 17, fontWeight: 900, cursor: starting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: starting ? 'none' : '0 8px 28px rgba(34,197,94,0.45)',
                animation: starting ? 'none' : 'att-pulse-btn 2.5s ease-in-out infinite',
                letterSpacing: '-0.3px',
              }}
            >
              {starting ? (
                <>
                  <div style={{ width: 22, height: 22, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'att-spin 0.8s linear infinite' }} />
                  Getting GPS…
                </>
              ) : (
                <>
                  <Play size={22} fill="#fff" />
                  Start Attendance
                </>
              )}
            </button>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--s-border)' }} />
              <span style={{ fontSize: 11.5, color: 'var(--s-text-3)' }}>GPS will continue tracking when app is minimized</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Today's Sessions Log ───────────────────────────────────────────── */}
      {todaysSessions.length > 0 && (
        <div style={{ margin: '0 16px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--s-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Today's Sessions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todaysSessions.map(s => (
              <div key={s.id} style={{
                background: 'var(--s-card)', border: `1px solid ${s.status === 'ACTIVE' ? 'rgba(34,197,94,0.3)' : 'var(--s-border)'}`,
                borderRadius: 14, padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: s.status === 'ACTIVE' ? 'rgba(34,197,94,0.12)' : 'var(--s-surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {s.status === 'ACTIVE'
                    ? <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e', animation: 'att-dot 1.4s infinite' }} />
                    : <CheckCircle size={18} color="#22c55e" />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--s-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {fmtTime(s.clock_in_at)} → {s.clock_out_at ? fmtTime(s.clock_out_at) : '…'}
                    {s.status === 'ACTIVE' && (
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#22c55e', background: 'rgba(34,197,94,0.12)', padding: '2px 6px', borderRadius: 99, letterSpacing: '0.05em' }}>LIVE</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--s-text-3)', marginTop: 3, display: 'flex', gap: 10 }}>
                    <span>{s.ping_count} pings</span>
                    <span>·</span>
                    <span>{fmtDuration(s.duration_minutes)}</span>
                    <span>·</span>
                    <span>{(s.distance_km ?? 0).toFixed(2)} km</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CSS Animations ─────────────────────────────────────────────────── */}
      <style>{`
        @keyframes att-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes att-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.35); }
        }
        @keyframes att-ring {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0.2; }
        }
        @keyframes att-pulse-btn {
          0%, 100% { box-shadow: 0 8px 28px rgba(34,197,94,0.45); }
          50% { box-shadow: 0 8px 36px rgba(34,197,94,0.7); }
        }
      `}</style>
    </div>
  );
}
