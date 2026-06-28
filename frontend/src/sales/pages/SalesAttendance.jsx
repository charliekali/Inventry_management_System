/**
 * SalesAttendance.jsx
 * GPS Attendance tracking for Sales staff.
 * - "Start": clocks in, requests location permission, starts watchPosition.
 * - watchPosition fires on every ≥1-metre movement (distanceFilter) AND
 *   a 60-sec heartbeat keeps stationary users live on the admin map.
 * - "Stop":  clocks out and clears all watchers.
 * - Uses @capacitor/geolocation on Android (runtime permission dialog).
 * - Falls back to navigator.geolocation.watchPosition on web.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { attendanceAPI, getApiBase } from '../../api';
import toast from 'react-hot-toast';

const Tracking = registerPlugin('Tracking');
import { MapPin, Clock, Play, Square, CheckCircle } from 'lucide-react';

const HEARTBEAT_MS = 60_000;          // 60-second stationary heartbeat
const MIN_PING_GAP_MS = 3_000;        // debounce: min gap between backend pings
const DISTANCE_FILTER_M = 1;          // record on every 1-metre movement

/** Haversine formula to compute distance in KM on client side */
function calculateHaversine(lat1, lon1, lat2, lon2) {
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

/** Format seconds as HH:MM:SS */
function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [
    h.toString().padStart(2, '0'),
    m.toString().padStart(2, '0'),
    s.toString().padStart(2, '0'),
  ].join(':');
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
  const watchIdRef      = useRef(null);   // Geolocation.watchPosition ID
  const heartbeatRef    = useRef(null);   // 60-sec stationary heartbeat interval
  const timerIntervalRef = useRef(null);  // elapsed-time display interval
  const lastPingTsRef   = useRef(0);      // timestamp of last backend ping (debounce)
  const lastPositionRef = useRef(null);
  const cumulativeDistanceRef = useRef(0.0);
  const lastPositionTsRef = useRef(0);
  const sessionIdRef    = useRef(null);   // current session ID accessible inside callbacks

  // ─── Unified GPS: Capacitor plugin on Android, browser API on web ───────────
  const requestGpsPermission = async () => {
    if (Capacitor.isNativePlatform()) {
      if (!Geolocation || typeof Geolocation.checkPermissions !== 'function') {
        throw new Error('Native Geolocation plugin is not available.');
      }
      try {
        const status = await Geolocation.checkPermissions();
        if (status.location !== 'granted') {
          if (typeof Geolocation.requestPermissions === 'function') {
            const result = await Geolocation.requestPermissions({ permissions: ['location'] });
            if (result.location !== 'granted') {
              throw new Error('Location permission denied by user');
            }
          } else {
            throw new Error('Native requestPermissions is not available.');
          }
        }
      } catch (err) {
        throw new Error('Could not request location permission: ' + err.message);
      }
    }
    // Web: browser handles permission natively via getCurrentPosition
  };

  const getCurrentPosition = async () => {
    if (Capacitor.isNativePlatform()) {
      if (!Geolocation || typeof Geolocation.getCurrentPosition !== 'function') {
        throw new Error('Native Geolocation plugin is not available.');
      }
      // Use the Capacitor native plugin — properly triggers Android permission dialog
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      return {
        coords: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        },
      };
    } else {
      // Web / browser fallback
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported in this browser'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        });
      });
    }
  };

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
        sessionIdRef.current = active.id;
        startTimer(active.clock_in_at);

        // Initialize client-side JS metrics refs
        cumulativeDistanceRef.current = active.distance_km || 0.0;
        if (active.last_lat && active.last_lng) {
          lastPositionRef.current = { latitude: active.last_lat, longitude: active.last_lng };
          lastPositionTsRef.current = Date.now();
        }

        if (Capacitor.isNativePlatform()) {
          const token = localStorage.getItem('accessToken');
          const baseUrl = getApiBase();
          try {
            await Tracking.startTracking({
              sessionId: active.id,
              token: token,
              apiUrl: baseUrl,
              distanceKm: active.distance_km || 0.0,
              lastLatitude: active.last_lat || 0.0,
              lastLongitude: active.last_lng || 0.0,
              interval: 30000,
              distance: 1
            });
          } catch (nativeErr) {
            console.warn('Native startTracking on load failed:', nativeErr);
          }
        } else {
          startWatching(active.id);
        }
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
      stopWatching();
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

  // ─── Stop watching (cleanup helper) ─────────────────────────────────────────
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
    lastPingTsRef.current = 0;
  };

  // ─── Send a ping to the backend (debounced) ──────────────────────────────────
  const sendPing = async (latitude, longitude, accuracy, speed = null) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    const now = Date.now();
    if (now - lastPingTsRef.current < MIN_PING_GAP_MS) return; // debounce
    lastPingTsRef.current = now;

    let distFromLast = 0.0;
    let cumulativeDistance = cumulativeDistanceRef.current;
    let speedKmph = 0.0;

    // Accuracy Filter: Discard location jumps with poor accuracy (>100 meters)
    if (accuracy <= 100.0) {
      if (lastPositionRef.current) {
        distFromLast = calculateHaversine(
          lastPositionRef.current.latitude,
          lastPositionRef.current.longitude,
          latitude,
          longitude
        );

        // Dynamic Drift Filter: Ignore movements less than the GPS accuracy (or min 10m) to prevent phantom drift while stationary
        const driftThresholdKm = Math.max(0.010, accuracy / 1000.0);
        if (distFromLast < driftThresholdKm) {
          distFromLast = 0.0;
        }

        // Jump Filter: Ignore movements larger than 2.0 km per interval (unrealistic GPS jumps)
        if (distFromLast > 2.0) {
          distFromLast = 0.0;
        }
      }

      // Calculate Speed: use native speed if available, otherwise estimate from time & distance
      if (speed !== null && speed > 0) {
        speedKmph = speed * 3.6;
      } else if (lastPositionRef.current && distFromLast > 0 && lastPositionTsRef.current) {
        const timeDiffMs = now - lastPositionTsRef.current;
        if (timeDiffMs > 1000) {
          const hours = timeDiffMs / 3600000.0;
          speedKmph = distFromLast / hours;
          if (speedKmph > 200.0) {
            speedKmph = 200.0;
          }
        }
      }

      if (!lastPositionRef.current || distFromLast > 0.0) {
        lastPositionRef.current = { latitude, longitude };
        lastPositionTsRef.current = now;
      }

      cumulativeDistanceRef.current += distFromLast;
      cumulativeDistance = cumulativeDistanceRef.current;
    } else {
      // If accuracy is poor, we still might want to capture native GPS speed if available
      if (speed !== null && speed > 0) {
        speedKmph = speed * 3.6;
      }
    }

    try {
      const res = await attendanceAPI.ping(sid, latitude, longitude, accuracy, speedKmph, distFromLast, cumulativeDistance);
      if (res.data && res.data.session) {
        setActiveSession(res.data.session);
        setSessions(prev => prev.map(s => s.id === res.data.session.id ? res.data.session : s));
      }
      setLastPingAt(new Date());
      setLastAccuracy(Math.round(accuracy ?? 0));
      setGpsStatus('active');
    } catch (err) {
      console.warn('GPS ping failed:', err);
    }
  };

  // ─── Start movement-based watching ──────────────────────────────────────────
  // Uses watchPosition with distanceFilter:1 so every ≥1 m movement fires a callback.
  // A 60-sec heartbeat also runs for stationary users so the admin map stays fresh.
  const startWatching = (sessionId) => {
    try {
      stopWatching();
      sessionIdRef.current = sessionId;

      const onPosition = (pos) => {
        if (!pos || !pos.coords) return;
        const { latitude, longitude, accuracy, speed } = pos.coords;
        sendPing(latitude, longitude, accuracy, speed);
      };
      const onError = (err) => {
        setGpsStatus('error');
        console.warn('watchPosition error:', err);
      };

      if (Capacitor.isNativePlatform()) {
        if (Geolocation && typeof Geolocation.watchPosition === 'function') {
          Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 10000 },
            (pos, err) => {
              if (err) { onError(err); return; }
              if (pos) onPosition(pos);
            }
          ).then(id => { watchIdRef.current = id; }).catch(onError);
        } else {
          throw new Error('Native Geolocation plugin watchPosition is not available.');
        }
      } else {
        if (navigator.geolocation) {
          watchIdRef.current = navigator.geolocation.watchPosition(
            onPosition, onError,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        } else {
          throw new Error('Web Geolocation API is not supported in this browser.');
        }
      }

      // Heartbeat: if stationary for >60s, re-read position and ping anyway
      heartbeatRef.current = setInterval(async () => {
        try {
          const pos = await getCurrentPosition();
          if (pos && pos.coords) {
            sendPing(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
          }
        } catch (hbErr) {
          console.warn('Heartbeat GPS read failed:', hbErr);
        }
      }, HEARTBEAT_MS);
    } catch (err) {
      console.error('Failed to start position tracking:', err);
      setGpsStatus('error');
      toast.error('Failed to start GPS tracking: ' + err.message);
    }
  };

  // ─── Start Attendance ────────────────────────────────────────────────────────
  const handleStart = async () => {
    setStarting(true);
    setGpsStatus('acquiring');
    try {
      // Step 1: Request GPS permission (triggers Android dialog if not yet granted)
      try {
        await requestGpsPermission();
      } catch (permErr) {
        toast.error('Location permission is required for attendance tracking. Please allow location access in your device settings.');
        setGpsStatus('error');
        setStarting(false);
        return;
      }

      // Step 2: Get initial GPS fix
      let gps = null;
      try {
        const pos = await getCurrentPosition();
        gps = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
        };
        setLastAccuracy(Math.round(pos.coords.accuracy));
      } catch (gpsErr) {
        toast.error('GPS tracking must be active to start attendance. Please ensure GPS is enabled.');
        setGpsStatus('error');
        setStarting(false);
        return;
      }

      if (!gps || gps.latitude == null || gps.longitude == null) {
        toast.error('GPS tracking must be active to start attendance. Please ensure GPS is enabled.');
        setGpsStatus('error');
        setStarting(false);
        return;
      }

      const res = await attendanceAPI.start(gps);
      const session = res.data.data;
      setActiveSession(session);
      setSessions(prev => [session, ...prev.filter(s => s.id !== session.id)]);
      setLastPingAt(new Date());
      setGpsStatus(gps ? 'active' : 'error');

      // Initialize client-side distance refs
      cumulativeDistanceRef.current = 0.0;
      if (gps) {
        lastPositionRef.current = { latitude: gps.latitude, longitude: gps.longitude };
        lastPositionTsRef.current = Date.now();
      } else {
        lastPositionRef.current = null;
        lastPositionTsRef.current = 0;
      }

      startTimer(session.clock_in_at);
      if (Capacitor.isNativePlatform()) {
        const token = localStorage.getItem('accessToken');
        const baseUrl = getApiBase();
        try {
          await Tracking.startTracking({
            sessionId: session.id,
            token: token,
            apiUrl: baseUrl,
            distanceKm: 0.0,
            lastLatitude: gps?.latitude || 0.0,
            lastLongitude: gps?.longitude || 0.0,
            interval: 30000,
            distance: 1
          });
        } catch (nativeErr) {
          console.warn('Native startTracking failed:', nativeErr);
        }
      } else {
        startWatching(session.id);
      }

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

      if (Capacitor.isNativePlatform()) {
        try {
          await Tracking.stopTracking();
        } catch (nativeErr) {
          console.warn('Native stopTracking failed:', nativeErr);
        }
      } else {
        stopWatching();
      }
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
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

            {/* Speed & Distance Tracking Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '0 auto 20px', maxWidth: '340px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 8px', border: '1px solid var(--s-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--s-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Speed</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--s-text)' }}>
                  {activeSession?.current_speed_kmph?.toFixed(1) || '0.0'} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--s-text-3)' }}>km/h</span>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 8px', border: '1px solid var(--s-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--s-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Distance</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--s-text)' }}>
                  {activeSession?.distance_km?.toFixed(2) || '0.00'} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--s-text-3)' }}>km</span>
                </div>
              </div>
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
          Your location is recorded every time you move ≥1 metre, and at least once per minute while stationary. GPS runs only while this app is open.
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
