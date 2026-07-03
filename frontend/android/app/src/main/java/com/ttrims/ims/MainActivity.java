package com.ttrims.ims;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.WindowManager;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
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
                // Whether granted or denied, proceed to ask for location next
                requestFineLocation();
            });

    // ── Step 2: ACCESS_FINE_LOCATION (+ COARSE) ───────────────────────────────
    private final ActivityResultLauncher<String[]> fineLocationLauncher =
        registerForActivityResult(
            new ActivityResultContracts.RequestMultiplePermissions(),
            result -> {
                Boolean fine = result.getOrDefault(Manifest.permission.ACCESS_FINE_LOCATION, false);
                if (Boolean.TRUE.equals(fine)) {
                    // Step 3: background location (must be asked AFTER fine location on Android 10+)
                    requestBackgroundLocation();
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
        // Already granted (or pre-Android 13) — skip straight to location
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
            return;   // callback → requestBackgroundLocation()
        }
        // Already have fine location — proceed to background
        requestBackgroundLocation();
    }

    /**
     * Step 3 — background location.
     *
     * Android 10+ (Q) requires ACCESS_BACKGROUND_LOCATION to be requested
     * as a SEPARATE, standalone dialog AFTER ACCESS_FINE_LOCATION is granted.
     *
     * On Android 11+, the system prompt will NOT show "Allow all the time" directly.
     * Instead, it shows a dialog guiding the user to Settings, where they must
     * select "Allow all the time". We show an educational dialog first to explain this.
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
                        + "In the next step, please select \"Allow all the time\" (if visible) "
                        + "or choose to go to Settings and change the location permission to "
                        + "\"Allow all the time\".")
                    .setPositiveButton("Continue", (dialog, which) -> {
                        try {
                            bgLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION);
                        } catch (Exception e) {
                            // Fallback: Open settings directly
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
}
