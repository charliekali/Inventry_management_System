/**
 * SalesAttendance.jsx
 * GPS Attendance tracking for Sales staff.
 * - "Start" button: clocks in + starts 30-second GPS ping interval.
 * - "Stop" button:  clocks out + clears the interval.
 * - Shows live elapsed timer, GPS status indicator, and daily log.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { attendanceAPI } from '../../api';
import toast from 'react-hot-toast';
import { MapPin, Clock, Play, Square, Wifi, WifiOff, CheckCircle, AlertCircle } from 'lucide-react';

const PING_INTERVAL_MS = 30_000; // 30 seconds

/** Format seconds as HH:MM:SS */
function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

/** Format ISO datetime to a short time string */
function fmtTime(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Format duration in minutes as e.g. "2h 15m" */
function fmtDuration(mins) {
  if (mins == null || mins < 0) return '--';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function SalesAttendance() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  // GPS state
  const [gpsStatus, setGpsStatus] = useState('idle'); // idle | acquiring | active | error
  const [lastPingAt, setLastPingAt] = useState(null);
  const [lastAccuracy, setLastAccuracy] = useState(null);

  // Live timer
  const [elapsed, setElapsed] = useState(0);

  // Refs for cleanup
  const pingIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // ─── Load initial data ──────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      const res = await attendanceAPI.my();
      const list = res.data.data || [];
      setSessions(list);

      // Check if there's already an active session
      const active = list.find(s => s.status === 'ACTIVE');
      if (active) {
        setActiveSession(active);
        startTimer(active.clock_in_at);
        startPingLoop(active.id);
        setGpsStatus('active');
      }
    } catch {
      // silent — user might not be logged in or no sessions yet
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    loadSessions();
    return () => {
      clearInterval(pingIntervalRef.current);
      clearInterval(timerIntervalRef.current);
    };
  }, []); // eslint-disable-line

  // ─── Timer ──────────────────────────────────────────────────────────────────
  const startTimer = (clockInAt) => {
    clearInterval(timerIntervalRef.current);
    const tick = () => {
      const sec = Math.floor((Date.now() - new Date(clockInAt).getTime()) / 1000);
      setElapsed(sec > 0 ? sec : 0);
    };
    tick();
    timerIntervalRef.current = setInterval(tick, 1000);
  };

  // ─── GPS helpers ────────────────────────────────────────────────────────────
  const getCurrentPosition = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    });
  });

  // ─── Ping loop ───────────────────────────────────────────────────────────────
  const startPingLoop = (sessionId) => {
    clearInterval(pingIntervalRef.current);
    const sendPing = async () => {
      try {
        setGpsStatus('acquiring');
        const pos = await getCurrentPosition();
        const { latitude, longitude, accuracy } = pos.coords;
        await attendanceAPI.ping(sessionId, latitude, longitude, accuracy);
        setLastPingAt(new Date());
        setLastAccuracy(Math.round(accuracy));
        setGpsStatus('active');
      } catch (err) {
        setGpsStatus('error');
        console.warn('GPS ping failed:', err);
      }
    };

    pingIntervalRef.current = setInterval(sendPing, PING_INTERVAL_MS);
  };

  // ─── Start Attendance ────────────────────────────────────────────────────────
  const handleStart = async () => {
    setStarting(true);
    setGpsStatus('acquiring');
    try {
      // Try to get initial GPS fix
      let gps = null;
      try {
        const pos = await getCurrentPosition();
        gps = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setLastAccuracy(Math.round(pos.coords.accuracy));
      } catch {
        // GPS optional for start — will warn user
        toast('Location unavailable. Attendance started without GPS fix.', { icon: '⚠️' });
      }

      const res = await attendanceAPI.start(gps);
      const session = res.data.data;
      setActiveSession(session);
      setSessions(prev => [session, ...prev.filter(s => s.id !== session.id)]);
      setLastPingAt(new Date());
      setGpsStatus(gps ? 'active' : 'error');

      startTimer(session.clock_in_at);
      startPingLoop(session.id);

      toast.success('Attendance started! GPS tracking active.');
    } catch (err) {
      setGpsStatus('error');
      toast.error(err.response?.data?.message || 'Failed to start attendance');
    } finally {
      setStarting(false);
    }
  };

  // ─── Stop Attendance ─────────────────────────────────────────────────────────
  const handleStop = async () => {
    if (!activeSession) return;
    if (!window.confirm('Clock out and stop tracking your location?')) return;

    setStopping(true);
    try {
      const res = await attendanceAPI.stop(activeSession.id);
      const updated = res.data.data;

      clearInterval(pingIntervalRef.current);
      clearInterval(timerIntervalRef.current);
      pingIntervalRef.current = null;
      timerIntervalRef.current = null;

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

  // ─── Render ──────────────────────────────────────────────────────────────────
  const isActive = !!activeSession;

  const gpsIndicatorColor = {
    idle: 'var(--s-text-3)',
    acquiring: '#f59e0b',
    active: '#22c55e',
    error: '#ef4444',
  }[gpsStatus];

  const todaysSessions = sessions.filter(s => {
    const d = new Date(s.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
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

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 20px 0', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Clock size={20} color="var(--s-primary)" />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--s-text)', margin: 0 }}>
            Attendance
          </h2>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--s-text-3)', margin: 0 }}>
          Track your working hours and share your live location.
        </p>
      </div>

      {/* ── Status Card ────────────────────────────────────────────────────── */}
      <div style={{ margin: '0 16px 20px', background: isActive ? 'rgba(34,197,94,0.08)' : 'var(--s-card)', border: `2px solid ${isActive ? 'rgba(34,197,94,0.3)' : 'var(--s-border)'}`, borderRadius: 16, padding: 20, textAlign: 'center' }}>

        {isActive ? (
          <>
            {/* Live Timer */}
            <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-2px', color: '#22c55e', fontVariantNumeric: 'tabular-nums', marginBottom: 8 }}>
              {formatElapsed(elapsed)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--s-text-3)', marginBottom: 16 }}>
              Clocked in at {fmtTime(activeSession?.clock_in_at)}
            </div>

            {/* GPS Status Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: gpsIndicatorColor,
                boxShadow: gpsStatus === 'active' ? `0 0 8px ${gpsIndicatorColor}` : 'none',
                animation: gpsStatus === 'active' ? 'pulse-dot 1.5s infinite' : 'none',
              }} />
              <span style={{ fontSize: 12, color: gpsIndicatorColor, fontWeight: 600 }}>
                {gpsStatus === 'active'   && `GPS Active • ±${lastAccuracy ?? '?'}m`}
                {gpsStatus === 'acquiring' && 'Acquiring GPS…'}
                {gpsStatus === 'error'    && 'GPS Unavailable'}
                {gpsStatus === 'idle'     && 'GPS Idle'}
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
            {/* Off-duty state */}
            <div style={{ fontSize: 56, marginBottom: 12 }}>📍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--s-text)', marginBottom: 6 }}>
              You are off duty
            </div>
            <div style={{ fontSize: 13, color: 'var(--s-text-3)', marginBottom: 24 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>

            {/* Start Button */}
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

      {/* ── Today's Sessions Log ────────────────────────────────────────────── */}
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
                    {s.ping_count} GPS pings · {fmtDuration(s.duration_minutes)}
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

      {/* ── Info Footer ─────────────────────────────────────────────────────── */}
      <div style={{ margin: '0 16px', padding: '12px 14px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <MapPin size={15} color="#3b82f6" style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 11.5, color: 'var(--s-text-3)', lineHeight: 1.5 }}>
          Your live location is sent to the admin every 30 seconds while attendance is active. GPS runs only while this app is open.
        </div>
      </div>

      {/* ── CSS Animations ─────────────────────────────────────────────────── */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
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
