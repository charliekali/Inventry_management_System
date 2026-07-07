/**
 * LogisticsAttendance.jsx — GPS Attendance tracking for Logistics Drivers.
 *
 * Reuses the native TrackingService and Geolocation plugins to handle background GPS tracking and offline caching.
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
const CACHE_KEY = 'gps_cache_driver';

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
  return <span style={{ color: 'var(--w-text-3)', fontSize: 11 }}>{age}s ago</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LogisticsAttendance() {
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
        toast.success(`${queue.length} cached pings synced.`);
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

      if (navigator.onLine) {
        await flushOfflineCache();
      }
    } catch {
      pushToCache({ sessionId: sid, latitude, longitude, accuracy, speed });
      setCacheSize(readCache().length);
      setLastPingAt(new Date());
      setLastAccuracy(Math.round(accuracy ?? 0));
      setGpsStatus('active');
      setPingCount(c => c + 1);
    }
  }, [flushOfflineCache]);

  // ─── Web GPS Watch loop ─────────────────────────────────────────────────────
  const startWatching = useCallback((sessionId) => {
    if (Capacitor.isNativePlatform()) return;
    if (watchIdRef.current) return;

    sessionIdRef.current = sessionId;
    setGpsStatus('acquiring');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        sendPing(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.speed);
      },
      () => {
        setGpsStatus('error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    heartbeatRef.current = setInterval(async () => {
      if (Date.now() - lastPingTsRef.current < HEARTBEAT_MS) return;
      try {
        const pos = await getCurrentPosition();
        sendPing(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.speed);
      } catch {}
    }, HEARTBEAT_MS);
  }, [sendPing]);

  const stopWatching = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
  };

  // ─── Native GPS foreground service launcher ──────────────────────────────────
  const startNativeTracking = async (sessionId) => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const baseUrl = getApiBase();
      const endpoint = `${baseUrl}/attendance/${sessionId}/ping`;
      await Tracking.startTracking({
        endpoint,
        intervalMs: PING_INTERVAL,
        title: 'Driver Duty active',
        message: 'TTRIMS is tracking your location coordinates.',
      });
      setGpsStatus('active');
    } catch (e) {
      console.error('Failed to start native tracking foreground service:', e);
      toast.error('Native tracking failed to start. Defaulting to Web GPS.');
      startWatching(sessionId);
    }
  };

  // ─── App state listener for native recovery ─────────────────────────────
  const registerAppStateListener = (sessionId) => {
    if (!Capacitor.isNativePlatform()) return;
    removeAppStateListener();
    App.addListener('appStateChange', async (state) => {
      if (state.isActive) {
        try {
          const check = await Tracking.isTracking();
          if (check.isTracking) {
            setGpsStatus('active');
            setLastPingAt(new Date());
          } else {
            setGpsStatus('error');
          }
        } catch {}
      }
    }).then(listener => {
      appListenerRef.current = listener;
    });
  };

  const removeAppStateListener = () => {
    if (appListenerRef.current) {
      appListenerRef.current.remove();
      appListenerRef.current = null;
    }
  };

  // ─── Timer counter ──────────────────────────────────────────────────────────
  const startTimer = (clockInIso) => {
    clearInterval(timerRef.current);
    const start = clockInIso ? new Date(clockInIso).getTime() : Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
  };

  // ─── Lifecycle / Initial Load ────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    attendanceAPI.my()
      .then(res => {
        if (!active) return;
        const list = res.data.data || [];
        setSessions(list);
        
        const activeSess = list.find(s => s.status === 'ACTIVE');
        if (activeSess) {
          setActiveSession(activeSess);
          sessionIdRef.current = activeSess.id;
          setGpsStatus('active');
          startTimer(activeSess.clock_in_at);
          startPolling(activeSess.id);

          if (Capacitor.isNativePlatform()) {
            Tracking.isTracking().then(check => {
              if (!check.isTracking) startNativeTracking(activeSess.id);
            });
            registerAppStateListener(activeSess.id);
          } else {
            startWatching(activeSess.id);
          }
        }
        setCacheSize(readCache().length);
      })
      .catch(() => toast.error('Failed to load attendance logs'))
      .finally(() => { if (active) setLoading(false); });

    return () => {
      active = false;
      stopWatching();
      stopPolling();
      removeAppStateListener();
      clearInterval(timerRef.current);
    };
  }, [startPolling, startWatching]); // eslint-disable-line

  // ─── Start Attendance ──────────────────────────────────────────────────────
  const handleStart = async () => {
    setStarting(true);
    try {
      await requestGpsPermission();
      setGpsStatus('acquiring');

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

      toast.success('Duty Attendance started! GPS is tracking.');
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
    if (!window.confirm('Clock out and stop duty location tracking?')) return;

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
      toast.success('Duty Attendance ended.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to stop attendance');
    } finally {
      setStopping(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  const isActive = !!activeSession;

  const gpsColor = {
    idle: '#64748b', acquiring: '#f59e0b', active: '#10b981', error: '#ef4444',
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
      <div className="w-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--w-border)', borderTopColor: 'var(--w-primary)', borderRadius: '50%', animation: 'att-spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 13, color: 'var(--w-text-3)', fontWeight: 600 }}>Loading attendance…</span>
      </div>
    );
  }

  return (
    <div className="w-page w-fade-in" style={{ padding: '0 0 32px 0', maxWidth: 480, margin: '0 auto' }}>

      {/* ── Top Status Bar ─────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--w-text)', letterSpacing: '-0.5px' }}>Driver Attendance</div>
          <div style={{ fontSize: 12, color: 'var(--w-text-3)', marginTop: 2 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--w-primary)', background: 'rgba(59,130,246,0.1)', padding: '4px 8px', borderRadius: 20, border: '1px solid rgba(59,130,246,0.25)' }}>
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
            background: 'rgba(16,185,129,0.03)',
            border: '2px solid rgba(16,185,129,0.25)',
            borderRadius: 20, padding: '24px 20px 20px', textAlign: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Pulsing ring decoration */}
            <div style={{
              position: 'absolute', top: -20, right: -20,
              width: 100, height: 100, borderRadius: '50%',
              background: 'rgba(16,185,129,0.04)',
              animation: 'att-ring 2.5s ease-in-out infinite',
            }} />

            {/* LIVE badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, padding: '3px 10px', marginBottom: 12 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', animation: 'att-dot 1.4s infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981', letterSpacing: '0.08em' }}>ON DUTY</span>
            </div>

            {/* Timer */}
            <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-3px', color: '#10b981', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 6 }}>
              {formatElapsed(elapsed)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--w-text-3)', marginBottom: 20 }}>
              Clocked in at {fmtTime(activeSession?.clock_in_at)}
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
              {[
                { icon: <Navigation size={14} />, label: 'Distance', value: `${(activeSession?.distance_km ?? 0).toFixed(2)} km`, color: 'var(--w-primary)' },
                { icon: <Zap size={14} />,        label: 'Speed',    value: `${(activeSession?.current_speed_kmph ?? 0).toFixed(1)} km/h`, color: '#f59e0b' },
                { icon: <Activity size={14} />,   label: 'Pings',    value: activeSession?.ping_count ?? pingCount, color: '#10b981' },
              ].map(({ icon, label, value, color }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '10px 6px', border: '1px solid var(--w-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4, color }}>
                    {icon}
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--w-text-3)' }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--w-text)' }}>{value}</div>
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
                  <span style={{ color: 'var(--w-text-3)', fontSize: 12 }}>·</span>
                  <PingTicker lastPingAt={lastPingAt} />
                </>
              )}
            </div>

            {/* Offline cache banner */}
            {cacheSize > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, padding: '8px 12px', background: 'rgba(59,130,246,0.08)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.2)' }}>
                <Database size={13} color="var(--w-primary)" />
                <span style={{ fontSize: 12, color: 'var(--w-primary)', fontWeight: 600 }}>
                  {cacheSize} ping{cacheSize > 1 ? 's' : ''} cached — will sync on reconnect
                </span>
              </div>
            )}

            <button
              className="w-btn"
              onClick={handleStop}
              disabled={stopping}
              style={{
                width: '100%',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 16px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Square size={16} fill="white" />
              {stopping ? 'Stopping…' : 'Clock Out (Stop Duty)'}
            </button>

          </div>
        </div>
      ) : (
        <div style={{ margin: '0 16px 16px' }}>
          <div style={{
            background: 'var(--w-card-bg)',
            border: '1px solid var(--w-border)',
            borderRadius: 20, padding: 30, textAlign: 'center',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--w-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <MapPin size={28} color="var(--w-text-3)" />
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--w-text)', marginBottom: 8 }}>Ready to start your shift?</h3>
            <p style={{ fontSize: 13, color: 'var(--w-text-3)', lineHeight: 1.5, marginBottom: 24 }}>
              Click below to clock in. The system will start recording your duty hours and track your coordinates for auto-routing.
            </p>

            <button
              className="w-btn"
              onClick={handleStart}
              disabled={starting}
              style={{
                width: '100%',
                background: 'var(--w-primary)',
                color: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px 16px',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(59,130,246,0.25)',
              }}
            >
              <Play size={16} fill="white" />
              {starting ? 'Starting…' : 'Clock In (Start Duty)'}
            </button>
          </div>
        </div>
      )}

      {/* ── Today's Logs / History ─────────────────────────────────────────── */}
      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Clock size={16} color="var(--w-text-3)" />
          <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--w-text-2)' }}>Today's Duty Log</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {todaysSessions.length === 0 ? (
            <div style={{ padding: '20px 16px', background: 'rgba(255,255,255,0.01)', border: '1px dotted var(--w-border)', borderRadius: 12, textAlign: 'center', fontSize: 12.5, color: 'var(--w-text-3)' }}>
              No duty logs recorded today.
            </div>
          ) : (
            todaysSessions.map(s => {
              const isSessionActive = s.status === 'ACTIVE';
              return (
                <div key={s.id} style={{
                  background: 'var(--w-card-bg)',
                  border: isSessionActive ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--w-border)',
                  borderRadius: 12, padding: 14,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--w-text)' }}>
                        {fmtTime(s.clock_in_at)} — {s.clock_out_at ? fmtTime(s.clock_out_at) : 'Active'}
                      </span>
                      {isSessionActive && (
                        <span style={{ fontSize: 10, background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>ACTIVE</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--w-text-3)', marginTop: 4 }}>
                      Distance: <span style={{ fontWeight: 600, color: 'var(--w-text-2)' }}>{s.distance_km?.toFixed(2) ?? '0.00'} km</span>
                      {' · '}
                      Pings: <span style={{ fontWeight: 600, color: 'var(--w-text-2)' }}>{s.ping_count}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: isSessionActive ? '#10b981' : 'var(--w-text)' }}>
                      {isSessionActive ? formatElapsed(elapsed) : fmtDuration(s.clock_out_at ? Math.round((new Date(s.clock_out_at) - new Date(s.clock_in_at)) / 60000) : 0)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
