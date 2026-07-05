package com.ttrims.ims;

import android.Manifest;
import android.app.AlertDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.view.WindowManager;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * MainActivity — entry point for the Capacitor web app.
 *
 * On first launch (or whenever a permission is missing) it requests all the
 * permissions the tracking service needs, in the correct order:
 *
 *  1. POST_NOTIFICATIONS  (Android 13+)  — shows the tracking notification
 *  2. ACCESS_FINE_LOCATION               — precise GPS
 *  3. ACCESS_BACKGROUND_LOCATION         — GPS while app is in background
 *     (Android 10+ requires this to be asked SEPARATELY, AFTER fine location)
 *
 * Why here and not in the plugin?
 *   The tracking service is a foreground service started from the plugin, but
 *   the notification permission MUST be granted before the first
 *   startForeground() call — otherwise Android 13+ silently drops the
 *   notification and shows an ANR/crash on some devices.
 */
public class MainActivity extends BridgeActivity {

    // ── Step 1: POST_NOTIFICATIONS ────────────────────────────────────────────
    private final ActivityResultLauncher<String> notifPermLauncher =
        registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            granted -> {
                // Check system-level notification state (catches OEM ROM blocks)
                checkNotificationsEnabled();
                // Whether granted or denied, proceed to ask for location next
                requestFineLocation();
            });

    // ── API 36 fix: background location must be requested from a fresh lifecycle ──
    // On targetSdk 36, Android rejects ACCESS_BACKGROUND_LOCATION requests that
    // originate inside another permission callback (e.g. the fine-location result).
    // We set this flag in the foreground-location callback and drain it in onResume()
    // so the background request always comes from a clean lifecycle event.
    private boolean pendingBgLocationRequest = false;

    // ── Step 2: ACCESS_FINE_LOCATION (+ COARSE) ───────────────────────────────
    private final ActivityResultLauncher<String[]> fineLocationLauncher =
        registerForActivityResult(
            new ActivityResultContracts.RequestMultiplePermissions(),
            result -> {
                Boolean fine = result.getOrDefault(Manifest.permission.ACCESS_FINE_LOCATION, false);
                if (Boolean.TRUE.equals(fine)) {
                    // API 36: do NOT call requestBackgroundLocation() here directly.
                    // Set the flag — onResume() will pick it up on the next lifecycle event.
                    pendingBgLocationRequest = true;
                }
                // If denied, the app still works but tracking won't have GPS
            });

    // ── Step 3: ACCESS_BACKGROUND_LOCATION ────────────────────────────────────
    private final ActivityResultLauncher<String> bgLocationLauncher =
        registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            granted -> {
                if (!granted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    // Show a rationale dialog explaining why "Allow all the time" is needed
                    showBackgroundLocationRationale();
                }
            });

    // ─────────────────────────────────────────────────────────────────────────

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // ── CRITICAL: register custom plugin BEFORE super.onCreate() ─────────────
        // Without this, JS calls to Capacitor.Plugins.Tracking.startTracking()
        // are silently ignored — the bridge has no record of TrackingPlugin,
        // so the service NEVER starts and no notification ever appears.
        registerPlugin(TrackingPlugin.class);

        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        // ── Full-screen setup ─────────────────────────────────────────────────
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        WindowInsetsControllerCompat wic =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (wic != null) {
            wic.hide(WindowInsetsCompat.Type.statusBars());
            wic.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // ── Request permissions on first run ──────────────────────────────────
        requestAllPermissions();

        // ── Native auto-start: resume tracking without waiting for JS ─────────
        autoStartTrackingIfNeeded();

        // ── Realme / ColorOS specific optimizations ───────────────────────────
        DeviceOptimizationHelper.applyColorOsOptimizations(this);

        // ── Diagnostic notification: confirms notification channel works ───────
        // This fires INDEPENDENTLY of the tracking service. If you see this
        // notification, the channel is fine. If you don't, the channel is blocked.
        // postDiagnosticNotification(); // Disabled to avoid showing diagnostic banner on launch
    }

    /**
     * onResume is the correct place to request ACCESS_BACKGROUND_LOCATION on
     * targetSdk 36. Android enforces that background location requests come
     * from a fresh lifecycle event — not from inside another permission callback.
     *
     * pendingBgLocationRequest is set by fineLocationLauncher when foreground
     * location is freshly granted. It is also set by requestFineLocation() when
     * foreground was already granted (e.g. second app open with background still missing).
     */
    @Override
    public void onResume() {
        super.onResume();
        if (pendingBgLocationRequest) {
            pendingBgLocationRequest = false;
            requestBackgroundLocation();
        }
    }

    // ─── Permission request chain ─────────────────────────────────────────────

    /**
     * Entry point — start with notifications (Android 13+), then chain to location.
     */
    private void requestAllPermissions() {
        // Android 13+ — POST_NOTIFICATIONS must be requested at runtime
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
                return;   // callback → requestFineLocation()
            }
        }
        // Permission is granted (or pre-Android 13) — but OEM ROM may still
        // block the channel. Check and guide user if needed.
        checkNotificationsEnabled();
        // Proceed to location
        requestFineLocation();
    }

    /** Step 2 — request precise + coarse location together. */
    private void requestFineLocation() {
        boolean hasFine = ContextCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        if (!hasFine) {
            fineLocationLauncher.launch(new String[]{
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            });
            return;   // callback sets pendingBgLocationRequest → onResume() handles background
        }
        // Fine already granted — still defer background request to onResume()
        // so it always originates from a fresh lifecycle event (API 36 requirement).
        pendingBgLocationRequest = true;
    }

    /**
     * Step 3 — background location (ACCESS_BACKGROUND_LOCATION).
     *
     * ALWAYS called from onResume() — never directly from a permission callback.
     *
     * On Android 11+ (API 30+), the system no longer shows "Allow all the time"
     * inline. Instead it routes the user to the app's Location permission page
     * in Settings. We show an educational dialog first so users know what to do.
     *
     * On Android 36, background location requests chained inside a foreground
     * permission callback are silently rejected. The onResume() lifecycle boundary
     * is the earliest point Android 36 accepts as a valid user-interaction context
     * for this request.
     */
    private void requestBackgroundLocation() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            boolean hasBg = ContextCompat.checkSelfPermission(
                this, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                    == PackageManager.PERMISSION_GRANTED;

            if (!hasBg) {
                new AlertDialog.Builder(this)
                    .setTitle("Enable \"Allow all the time\"")
                    .setMessage(
                        "To track attendance when the screen is off or you are using other apps, "
                        + "TTRIMS requires background location.\n\n"
                        + "In the next step, tap \"Allow all the time\" "
                        + "(or go to Settings → Location → Allow all the time).")
                    .setPositiveButton("Continue", (dialog, which) -> {
                        try {
                            bgLocationLauncher.launch(
                                Manifest.permission.ACCESS_BACKGROUND_LOCATION);
                        } catch (Exception e) {
                            // Fallback: open location permission settings directly
                            showBackgroundLocationRationale();
                        }
                    })
                    .setNegativeButton("Cancel", null)
                    .setCancelable(false)
                    .show();
            }
        }
        // On Android 9 and below, background location is included in ACCESS_FINE_LOCATION
    }

    /**
     * Shown when the user denied background location.
     * Guides them to Settings → App info → Permissions → Location → "Allow all the time".
     */
    private void showBackgroundLocationRationale() {
        new AlertDialog.Builder(this)
            .setTitle("Background Location Needed")
            .setMessage(
                "TTRIMS needs \"Allow all the time\" location access to track attendance "
                + "while the app is in the background.\n\n"
                + "Please tap 'Open Settings', go to Permissions → Location, "
                + "and select \"Allow all the time\".")
            .setPositiveButton("Open Settings", (d, w) -> {
                Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                i.setData(Uri.fromParts("package", getPackageName(), null));
                startActivity(i);
            })
            .setNegativeButton("Not Now", null)
            .show();
    }

    // ─── Notification enabled guard ───────────────────────────────────────────────

    /**
     * Checks whether notifications are actually enabled at the system level.
     *
     * On many OEM ROMs (Xiaomi MIUI, Samsung One UI, OnePlus ColorOS),
     * notification permission can be "granted" by the runtime, but the
     * notification channel is blocked silently in the system Settings.
     *
     * This check catches that case and shows a clear dialog guiding the user
     * to enable notifications manually.
     */
    private void checkNotificationsEnabled() {
        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) {
            Log.e("MainActivity", "Notifications are BLOCKED at system level — showing dialog");
            new AlertDialog.Builder(this)
                .setTitle("Enable Notifications")
                .setMessage(
                    "TTRIMS needs notifications to show the GPS tracking status bar while you're on duty.\n\n"
                    + "Please tap 'Open Settings', then enable Notifications for TTRIMS.")
                .setPositiveButton("Open Settings", (d, w) -> {
                    // Use the helper — opens the app's notification settings directly
                    // (not just App Info, which requires extra navigation on ColorOS)
                    DeviceOptimizationHelper.openNotificationSettings(this);
                })
                .setNegativeButton("Not Now", null)
                .setCancelable(false)
                .show();
        }
    }

    // ─── Diagnostic notification ───────────────────────────────────────────────────

    /**
     * Posts a simple test notification immediately on app open.
     * This fires INDEPENDENTLY of TrackingService — it bypasses the entire
     * Capacitor/JS/service chain.
     *
     * Diagnostic logic:
     *   If this notification appears → notification channel works fine.
     *                                   The bug is in the service start path.
     *   If this doesn't appear      → notification channel/permission is blocked.
     *                                   Go to Settings → Apps → TTRIMS → Notifications.
     *
     * Uses a separate channel ("TTRIMSDiag") so it's never affected by
     * TrackingChannel importance settings.
     */
    @SuppressWarnings("MissingPermission")
    private void postDiagnosticNotification() {
        try {
            String DIAG_CHANNEL = "TTRIMSDiag";

            // Create the diagnostic channel (IMPORTANCE_HIGH = always visible)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel ch = new NotificationChannel(
                    DIAG_CHANNEL, "TTRIMS Diagnostics", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("App startup diagnostics");
                NotificationManager nm = getSystemService(NotificationManager.class);
                if (nm != null) nm.createNotificationChannel(ch);
            }

            NotificationCompat.Builder b = new NotificationCompat.Builder(this, DIAG_CHANNEL)
                .setContentTitle("TTRIMS is running")
                .setContentText("App started successfully. Tracking plugin is registered.")
                .setSmallIcon(R.drawable.ic_stat_tracking)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true);

            NotificationManagerCompat.from(this).notify(9921, b.build());
            Log.d("MainActivity", "Diagnostic notification posted");
        } catch (Exception e) {
            Log.e("MainActivity", "postDiagnosticNotification failed: " + e.getMessage());
        }
    }

    // ─── Native auto-start (no JS required) ─────────────────────────────────────


    /**
     * Called every time the app opens (onCreate).
     *
     * Reads TrackingPrefs to see if an attendance session was active when the
     * app was last used. If yes, and the foreground service is not already
     * running, it starts TrackingService directly in Java — bypassing the
     * Capacitor/JS bridge entirely.
     *
     * This means:
     *   • After a force-kill + reopen the service auto-restarts
     *   • Even if Capacitor crashes on load, the GPS service still starts
     *   • The service is always in sync with SharedPrefs state
     */
    private void autoStartTrackingIfNeeded() {
        try {
            SharedPreferences prefs = getSharedPreferences(
                TrackingService.PREFS, MODE_PRIVATE);

            boolean isActive    = prefs.getBoolean(TrackingService.K_ACTIVE,  false);
            boolean userStopped = prefs.getBoolean(TrackingService.K_STOP,    false);
            String  sessionId   = prefs.getString(TrackingService.K_SESSION,  null);
            String  token       = prefs.getString(TrackingService.K_TOKEN,    null);
            String  apiUrl      = prefs.getString(TrackingService.K_API_URL,  null);
            long    interval    = prefs.getLong(TrackingService.K_INTERVAL,   2_000L);
            float   distance    = prefs.getFloat(TrackingService.K_DISTANCE,  0.0f);
            String  date        = prefs.getString(TrackingService.K_DATE,     "");

            if (!isActive || userStopped) {
                Log.d("MainActivity", "autoStart: no active session — skipping");
                return;
            }
            if (sessionId == null || token == null || apiUrl == null) {
                Log.d("MainActivity", "autoStart: missing prefs (sessionId/token/apiUrl) — skipping");
                return;
            }
            if (TrackingService.isRunning()) {
                Log.d("MainActivity", "autoStart: service already running — skipping");
                return;
            }

            Log.w("MainActivity",
                "autoStart: service NOT running with active session=" + sessionId + " — STARTING NOW");

            Intent intent = new Intent(this, TrackingService.class);
            intent.putExtra(TrackingService.K_SESSION,  sessionId);
            intent.putExtra(TrackingService.K_TOKEN,    token);
            intent.putExtra(TrackingService.K_API_URL,  apiUrl);
            intent.putExtra(TrackingService.K_INTERVAL, interval);
            intent.putExtra(TrackingService.K_DISTANCE, (int) distance);
            intent.putExtra(TrackingService.K_DATE,     date);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent);
            } else {
                startService(intent);
            }
            Log.d("MainActivity", "autoStart: TrackingService started successfully");

        } catch (Exception e) {
            Log.e("MainActivity", "autoStart error: " + e.getMessage());
        }
    }
}
