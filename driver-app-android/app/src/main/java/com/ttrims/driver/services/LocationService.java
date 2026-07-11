package com.ttrims.driver.services;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;

import androidx.core.app.NotificationManagerCompat;

import com.ttrims.driver.MainActivity;
import com.ttrims.driver.R;

import org.json.JSONArray;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * LocationService — Replicated from the Capacitor app's TrackingService.
 * Foreground service that runs a 2-second ping loop on a background looper.
 */
public class LocationService extends Service {

    private static final String TAG = "LocationService";

    private static final String CHANNEL_ID = "TrackingChannel_v4";
    private static final int    NOTIF_ID   = 9919;

    // ─── SharedPreferences keys ───────────────────────────────────────────────
    public static final String PREFS      = "TrackingPrefs";
    public static final String K_SESSION  = "sessionId";
    public static final String K_TOKEN    = "token";
    public static final String K_API_URL  = "apiUrl";
    public static final String K_INTERVAL = "interval";
    public static final String K_DISTANCE = "distance";
    public static final String K_ACTIVE   = "serviceActive";
    public static final String K_STOP     = "userStopped";
    public static final String K_DATE     = "sessionDate";

    private static final String K_OFFLINE_QUEUE = "offlinePingQueue";
    private static final int    MAX_QUEUE_SIZE  = 500;

    // Actions
    public static final String ACTION_START = "ACTION_START_TRACKING";
    public static final String ACTION_STOP  = "ACTION_STOP_TRACKING";
    public static final String EXTRA_SESSION_ID = "EXTRA_SESSION_ID";

    // ─── Static running flag ──────────────────────────────────────────────────
    private static volatile boolean sRunning = false;
    public static boolean isRunning() { return sRunning; }

    // ─── Fields ───────────────────────────────────────────────────────────────
    private LocationManager  locationManager;
    private LocationListener locationListener;
    private PowerManager.WakeLock wakeLock;

    private android.os.HandlerThread bgThread;
    private Handler  bgHandler;

    private Runnable pingRunnable;
    private static final long PING_INTERVAL_MS = 2_000L;

    private long lastPingEpochMs = 0;
    private static final long MIN_GAP_MS = 1_000L;

    private static final long WATCHDOG_MS = 60_000L;

    private int pingCount = 0;

    private String sessionId;
    private String token;
    private String apiUrl;
    private long   intervalMs  = 2_000L;
    private float  distanceM   = 0.0f;
    private String sessionDate = "";

    private String statusMessage = "Initializing tracking...";
    private double lastAccuracy  = 0.0;

    private void updateStatus(final String msg) {
        statusMessage = msg;
        Log.i(TAG, "Status: " + msg);
        if (bgHandler != null) {
            bgHandler.post(() -> {
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    nm.notify(NOTIF_ID, buildNotification(pingCount, lastAccuracy));
                }
            });
        }
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        sRunning = true;
        Log.d(TAG, "onCreate");

        deleteOldNotificationChannel();
        createNotificationChannel();
        acquireWakeLock();

        bgThread = new android.os.HandlerThread("TrackingBgThread");
        bgThread.start();
        bgHandler = new Handler(bgThread.getLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "onStartCommand intent=" + (intent != null ? "fresh" : "sticky-restart"));

        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            markUserStopped();
            cancelWatchdogAlarm();
            TrackingWorker.cancel(this);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (intent != null && intent.hasExtra(K_SESSION)) {
            sessionId   = intent.getStringExtra(K_SESSION);
            token       = intent.getStringExtra(K_TOKEN);
            apiUrl      = intent.getStringExtra(K_API_URL);
            intervalMs  = intent.getLongExtra(K_INTERVAL, 2_000L);
            distanceM   = (float) intent.getIntExtra(K_DISTANCE, 0);
            String d    = intent.getStringExtra(K_DATE);
            sessionDate = (d != null && !d.isEmpty()) ? d : todayDateString();
            saveToPrefs();
        } else {
            loadFromPrefs();
        }

        // Check compatibility with original EXTRA_SESSION_ID action
        if (intent != null && ACTION_START.equals(intent.getAction()) && sessionId == null) {
            sessionId = intent.getStringExtra(EXTRA_SESSION_ID);
            // If started this way, fetch token & url from SessionManager
            com.ttrims.driver.utils.SessionManager sm = com.ttrims.driver.utils.SessionManager.getInstance(this);
            token = sm.getAccessToken();
            apiUrl = sm.getCustomApiUrl();
            if (apiUrl == null || apiUrl.isEmpty()) {
                apiUrl = com.ttrims.driver.api.ApiClient.DEFAULT_BASE_URL;
            }
            if (apiUrl.endsWith("/")) {
                apiUrl = apiUrl.substring(0, apiUrl.length() - 1);
            }
            intervalMs = 2_000L;
            distanceM = 0.0f;
            sessionDate = todayDateString();
            saveToPrefs();
        }

        if (sessionId == null || token == null || apiUrl == null) {
            Log.e(TAG, "Missing params — stopping");
            stopSelf();
            return START_NOT_STICKY;
        }

        promoteToForeground();
        updateStatus("Starting GPS service...");

        stopLocationUpdates();
        startLocationUpdates();
        startPingLoop();

        scheduleWatchdogAlarm();
        TrackingWorker.enqueue(this);
        flushOfflineQueue();

        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        Log.w(TAG, "onTaskRemoved");
        SharedPreferences p = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (p.getBoolean(K_ACTIVE, false) && !p.getBoolean(K_STOP, false)) {
            scheduleImmediateRestart();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopPingLoop();
        stopLocationUpdates();
        if (bgThread != null) bgThread.quit();
        releaseWakeLock();

        SharedPreferences p = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (p.getBoolean(K_ACTIVE, false) && !p.getBoolean(K_STOP, false)) {
            Log.w(TAG, "onDestroy with active session — scheduling self-restart");
            scheduleImmediateRestart();
        }

        sRunning = false;
        Log.d(TAG, "onDestroy done");
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    // ─── Prefs ────────────────────────────────────────────────────────────────

    private void saveToPrefs() {
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(K_SESSION,  sessionId)
            .putString(K_TOKEN,    token)
            .putString(K_API_URL,  apiUrl)
            .putLong(K_INTERVAL,   intervalMs)
            .putFloat(K_DISTANCE,  distanceM)
            .putString(K_DATE,     sessionDate)
            .putBoolean(K_ACTIVE,  true)
            .putBoolean(K_STOP,    false)
            .apply();
    }

    private void loadFromPrefs() {
        SharedPreferences p = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        sessionId   = p.getString(K_SESSION,  null);
        token       = p.getString(K_TOKEN,    null);
        apiUrl      = p.getString(K_API_URL,  null);
        intervalMs  = p.getLong(K_INTERVAL,   2_000L);
        distanceM   = p.getFloat(K_DISTANCE,  0.0f);
        sessionDate = p.getString(K_DATE,     todayDateString());
        Log.d(TAG, "Restored from prefs: session=" + sessionId);
    }

    private void markUserStopped() {
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(K_ACTIVE, false)
            .putBoolean(K_STOP,   true)
            .apply();
    }

    // ─── Location updates (on background looper) ──────────────────────────────

    @SuppressWarnings("MissingPermission")
    private void startLocationUpdates() {
        try {
            locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (locationManager == null) {
                updateStatus("Error: LocationManager not found");
                Log.e(TAG, "LocationManager is null!");
                return;
            }

            Looper bgLooper = bgThread.getLooper();

            locationListener = new LocationListener() {
                @Override
                public void onLocationChanged(Location loc) {
                    handleLocation(loc, "gps-callback");
                }
                @Override public void onStatusChanged(String p, int s, Bundle e) {}
                @Override public void onProviderEnabled(String p)  {
                    Log.i(TAG, "Provider ON: "  + p);
                    updateStatus("Provider enabled: " + p);
                }
                @Override public void onProviderDisabled(String p) {
                    Log.w(TAG, "Provider OFF: " + p);
                    updateStatus("Warning: Provider disabled: " + p);
                }
            };

            boolean anyRegistered = false;
            StringBuilder activeProviders = new StringBuilder();

            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    PING_INTERVAL_MS,
                    distanceM,
                    locationListener,
                    bgLooper);
                Log.d(TAG, "GPS registered on bgThread @ " + PING_INTERVAL_MS + "ms");
                anyRegistered = true;
                activeProviders.append("GPS ");
            }

            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    PING_INTERVAL_MS,
                    distanceM,
                    locationListener,
                    bgLooper);
                Log.d(TAG, "Network location registered on bgThread");
                anyRegistered = true;
                activeProviders.append("Network");
            }

            if (!anyRegistered) {
                locationManager.requestLocationUpdates(
                    LocationManager.PASSIVE_PROVIDER,
                    PING_INTERVAL_MS,
                    distanceM,
                    locationListener,
                    bgLooper);
                Log.w(TAG, "Only PASSIVE provider available");
                updateStatus("Waiting for GPS... (Enable location settings)");
            } else {
                updateStatus("Waiting for first GPS fix (" + activeProviders.toString().trim() + ")...");
            }

        } catch (SecurityException e) {
            Log.e(TAG, "Location permission denied: " + e.getMessage());
            updateStatus("Error: Location permission denied");
        } catch (Exception e) {
            Log.e(TAG, "startLocationUpdates failed: " + e.getMessage());
            updateStatus("Error starting location: " + e.getMessage());
        }
    }

    private void stopLocationUpdates() {
        if (locationManager != null && locationListener != null) {
            try { locationManager.removeUpdates(locationListener); } catch (Exception ignored) {}
            locationListener = null;
        }
    }

    // ─── 2-second ping loop ───────────────────────────────────────────────────

    private void startPingLoop() {
        stopPingLoop();
        pingRunnable = new Runnable() {
            @Override
            public void run() {
                if (wakeLock != null && !wakeLock.isHeld()) {
                    Log.w(TAG, "WakeLock dropped by OS — re-acquiring");
                    try { wakeLock.acquire(10 * 60 * 60 * 1000L); } catch (Exception ignored) {}
                }

                sendBestLocation();

                bgHandler.postDelayed(this, PING_INTERVAL_MS);
            }
        };
        bgHandler.postDelayed(pingRunnable, PING_INTERVAL_MS);
        Log.d(TAG, "Ping loop started at " + PING_INTERVAL_MS + "ms on bgThread");
    }

    private void stopPingLoop() {
        if (bgHandler != null && pingRunnable != null) {
            bgHandler.removeCallbacks(pingRunnable);
            pingRunnable = null;
        }
    }

    @SuppressWarnings("MissingPermission")
    private void sendBestLocation() {
        if (locationManager == null) return;

        Location best = null;
        try {
            Location gps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            Location net = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            Location pas = locationManager.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER);

            for (Location c : new Location[]{gps, net, pas}) {
                if (c == null) continue;
                long age = System.currentTimeMillis() - c.getTime();
                if (age > 60_000) continue;
                if (best == null || c.getAccuracy() < best.getAccuracy()) best = c;
            }
        } catch (SecurityException ignored) {}

        if (best != null) {
            handleLocation(best, "loop");
        } else {
            Log.d(TAG, "Loop tick: waiting for first GPS fix…");
            if (statusMessage.startsWith("Waiting for first GPS fix")) {
                updateStatus("Waiting for first GPS fix (Searching satellites...)");
            }
        }
    }

    private void handleLocation(Location loc, String source) {
        if (loc == null) return;

        long now = System.currentTimeMillis();
        if (now - lastPingEpochMs < MIN_GAP_MS) return;
        lastPingEpochMs = now;

        double lat      = loc.getLatitude();
        double lng      = loc.getLongitude();
        double accuracy = loc.getAccuracy();

        if (accuracy > 500.0) {
            Log.d(TAG, "[" + source + "] Accuracy " + accuracy + "m > 500m — skipping");
            updateStatus("Location skipped (weak accuracy: " + (int)accuracy + "m)");
            return;
        }

        boolean hasSpeed = loc.hasSpeed() && loc.getSpeed() >= 0;
        double  speedMps = hasSpeed ? loc.getSpeed() : -1.0;

        Log.d(TAG, String.format(Locale.US,
            "[%s] lat=%.6f lng=%.6f acc=%.0fm", source, lat, lng, accuracy));

        pingCount++;
        pingServer(lat, lng, accuracy, speedMps, hasSpeed, loc.getTime());
        refreshNotification(accuracy);
    }

    // ─── HTTP ping ────────────────────────────────────────────────────────────

    private void pingServer(final double lat, final double lng,
                             final double accuracy,
                             final double speedMps, final boolean hasSpeed,
                             final long   timestamp) {
        if (sessionId == null || token == null || apiUrl == null) return;

        String json = buildPingJson(lat, lng, accuracy, speedMps, hasSpeed, timestamp);
        boolean success = sendPing(json);

        if (!success) {
            queueOfflinePing(json);
        } else {
            flushOfflineQueue();
        }
    }

    private String buildPingJson(double lat, double lng, double acc,
                                 double speed, boolean hasSpeed, long ts) {
        if (hasSpeed && speed >= 0) {
            return String.format(Locale.US,
                "{\"latitude\":%.7f,\"longitude\":%.7f,\"accuracy\":%.2f,\"speed\":%.4f,\"recorded_at\":%d}",
                lat, lng, acc, speed, ts);
        }
        return String.format(Locale.US,
            "{\"latitude\":%.7f,\"longitude\":%.7f,\"accuracy\":%.2f,\"recorded_at\":%d}",
            lat, lng, acc, ts);
    }

    private boolean sendPing(String json) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(apiUrl + "/attendance/" + sessionId + "/ping");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; utf-8");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setDoOutput(true);
            conn.setConnectTimeout(8_000);
            conn.setReadTimeout(8_000);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(json.getBytes("utf-8"));
            }

            int code = conn.getResponseCode();
            Log.d(TAG, "Ping #" + pingCount + " → HTTP " + code);
            
            if (code >= 200 && code < 300) {
                updateStatus("Tracking active (HTTP " + code + ")");
                return true;
            } else {
                updateStatus("Server error: HTTP " + code);
                return false;
            }

        } catch (Exception e) {
            Log.e(TAG, "Ping failed: " + e.getMessage());
            updateStatus("Network error: " + e.getMessage());
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    // ─── Offline queue ────────────────────────────────────────────────────────

    private void queueOfflinePing(String json) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String existing = prefs.getString(K_OFFLINE_QUEUE, "[]");
            JSONArray arr = new JSONArray(existing);

            if (arr.length() >= MAX_QUEUE_SIZE) {
                JSONArray trimmed = new JSONArray();
                for (int i = arr.length() - MAX_QUEUE_SIZE + 1; i < arr.length(); i++) {
                    trimmed.put(arr.getString(i));
                }
                arr = trimmed;
            }
            arr.put(json);
            prefs.edit().putString(K_OFFLINE_QUEUE, arr.toString()).apply();
            Log.d(TAG, "Queued offline ping (size: " + arr.length() + ")");
        } catch (Exception e) {
            Log.e(TAG, "queueOfflinePing error: " + e.getMessage());
        }
    }

    private void flushOfflineQueue() {
        Runnable flush = () -> {
            try {
                SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                String existing = prefs.getString(K_OFFLINE_QUEUE, "[]");
                JSONArray arr = new JSONArray(existing);
                if (arr.length() == 0) return;

                Log.d(TAG, "Flushing " + arr.length() + " queued pings…");
                JSONArray remaining = new JSONArray();
                for (int i = 0; i < arr.length(); i++) {
                    String pingJson = arr.getString(i);
                    if (!sendPing(pingJson)) {
                        remaining.put(pingJson);
                        for (int j = i + 1; j < arr.length(); j++) remaining.put(arr.getString(j));
                        break;
                    }
                }
                prefs.edit().putString(K_OFFLINE_QUEUE, remaining.toString()).apply();
                Log.d(TAG, "Flush done. Remaining: " + remaining.length());
            } catch (Exception e) {
                Log.e(TAG, "flushOfflineQueue error: " + e.getMessage());
            }
        };

        if (bgHandler != null) {
            bgHandler.post(flush);
        } else {
            new Thread(flush).start();
        }
    }

    // ─── AlarmManager watchdog ────────────────────────────────────────────────

    private void scheduleWatchdogAlarm() {
        try {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            PendingIntent pi = getWatchdogPendingIntent();
            am.cancel(pi);

            long triggerAt = SystemClock.elapsedRealtime() + WATCHDOG_MS;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
            } else {
                am.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
            }
            Log.d(TAG, "Watchdog scheduled in 60s");
        } catch (Exception e) {
            Log.e(TAG, "scheduleWatchdogAlarm error: " + e.getMessage());
        }
    }

    private void cancelWatchdogAlarm() {
        try {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am != null) am.cancel(getWatchdogPendingIntent());
        } catch (Exception ignored) {}
    }

    private PendingIntent getWatchdogPendingIntent() {
        Intent intent = new Intent(this, TrackingWatchdog.class);
        intent.setAction(TrackingWatchdog.ACTION_WATCHDOG);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(this, 0, intent, flags);
    }

    private void scheduleImmediateRestart() {
        try {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            Intent intent = new Intent(this, TrackingWatchdog.class);
            intent.setAction(TrackingWatchdog.ACTION_WATCHDOG);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pi = PendingIntent.getBroadcast(this, 1, intent, flags);

            long triggerAt = SystemClock.elapsedRealtime() + 3_000L;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
            } else {
                am.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
            }
            Log.d(TAG, "Immediate restart in 3s");
        } catch (Exception e) {
            Log.e(TAG, "scheduleImmediateRestart error: " + e.getMessage());
        }
    }

    // ─── Notification ─────────────────────────────────────────────────────────

    private String todayDateString() {
        return new SimpleDateFormat("yyyy/MM/dd", Locale.US).format(new Date());
    }

    private void deleteOldNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.deleteNotificationChannel("TrackingChannel");
                nm.deleteNotificationChannel("TrackingChannel_v2");
                nm.deleteNotificationChannel("TrackingChannel_v3");
                nm.deleteNotificationChannel("ttrims_location_tracking");
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "TTRIMS GPS Tracking", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Live GPS tracking for attendance sessions.");
            ch.setShowBadge(false);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);

            boolean enabled = NotificationManagerCompat.from(this).areNotificationsEnabled();
            Log.d(TAG, "Notifications enabled by system: " + enabled);
        }
    }

    private Notification buildNotification(int pings, double accuracy) {
        Intent tap = getPackageManager().getLaunchIntentForPackage(getPackageName());
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT |
            (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent tapPi = PendingIntent.getActivity(this, 0, tap, piFlags);

        String title    = "TTRIMS \u2022 " + sessionDate;
        String body     = "Status: " + statusMessage;
        String subText  = (pings > 0 && accuracy > 0)
            ? String.format(Locale.US, "Ping #%d  \u2022  \u00b1%.0fm  \u2022  %s", pings, accuracy, statusMessage)
            : statusMessage;

        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b = new Notification.Builder(this, CHANNEL_ID);
        } else {
            b = new Notification.Builder(this);
        }

        b.setContentTitle(title)
         .setContentText(subText)
         .setSubText("Tracking active")
         .setSmallIcon(R.drawable.ic_stat_tracking)
         .setOngoing(true)
         .setAutoCancel(false)
         .setOnlyAlertOnce(true)
         .setShowWhen(false)
         .setContentIntent(tapPi)
         .setStyle(new Notification.BigTextStyle()
             .setBigContentTitle("TTRIMS Live Tracking")
             .bigText(body)
             .setSummaryText(title));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        }

        Notification n = b.build();
        n.flags |= Notification.FLAG_ONGOING_EVENT | Notification.FLAG_NO_CLEAR;
        return n;
    }

    private boolean hasLocationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    private void promoteToForeground() {
        Notification n = buildNotification(0, 0);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                if (hasLocationPermission()) {
                    startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
                    Log.d(TAG, "startForeground: LOCATION type (API 34+)");
                } else {
                    startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
                    Log.w(TAG, "startForeground: DATA_SYNC fallback — location permission missing");
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                if (hasLocationPermission()) {
                    startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
                    Log.d(TAG, "startForeground: LOCATION type (API 29-33)");
                } else {
                    startForeground(NOTIF_ID, n);
                    Log.w(TAG, "startForeground: no type (API 29-33, no location permission)");
                }
            } else {
                startForeground(NOTIF_ID, n);
                Log.d(TAG, "startForeground: no type (pre-API 29)");
            }
        } catch (Exception e) {
            Log.e(TAG, "startForeground failed: " + e.getMessage());
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
                } else {
                    startForeground(NOTIF_ID, n);
                }
                Log.d(TAG, "startForeground: fallback succeeded");
            } catch (Exception ex) {
                Log.e(TAG, "Fallback startForeground ALSO failed: " + ex.getMessage());
            }
        }
    }

    private void refreshNotification(double accuracy) {
        lastAccuracy = accuracy;
        Notification n = buildNotification(pingCount, accuracy);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIF_ID, n);
    }

    // ─── WakeLock ─────────────────────────────────────────────────────────────

    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "IMS:TrackingWakeLock");
                wakeLock.acquire(10 * 60 * 60 * 1000L);
                Log.d(TAG, "WakeLock acquired");
            }
        } catch (Exception e) {
            Log.e(TAG, "WakeLock acquire failed: " + e.getMessage());
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception ignored) {}
            Log.d(TAG, "WakeLock released");
        }
    }
}
