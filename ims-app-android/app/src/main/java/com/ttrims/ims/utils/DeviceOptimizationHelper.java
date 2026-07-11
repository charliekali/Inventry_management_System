package com.ttrims.ims.utils;

import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

/**
 * DeviceOptimizationHelper — handles OEM-specific battery and notification settings.
 * Replicated from the Capacitor app for parity.
 */
public class DeviceOptimizationHelper {

    private static final String TAG = "DeviceOptimization";

    /** Returns true if the device is Realme, Oppo, or OnePlus running ColorOS. */
    public static boolean isColorOsDevice() {
        String manufacturer = Build.MANUFACTURER.toLowerCase();
        String brand        = Build.BRAND.toLowerCase();
        String model        = Build.MODEL.toLowerCase();
        return manufacturer.contains("realme")
            || manufacturer.contains("oppo")
            || manufacturer.contains("oneplus")
            || brand.contains("realme")
            || brand.contains("oppo")
            || brand.contains("oneplus")
            || model.contains("cph")
            || isColorOsInstalled();
    }

    private static boolean isColorOsInstalled() {
        try {
            String display = Build.DISPLAY.toLowerCase();
            return display.contains("coloros") || display.contains("realmeui");
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Show all required optimization dialogs for Realme / ColorOS devices.
     */
    public static void applyColorOsOptimizations(Context context) {
        if (!isColorOsDevice()) {
            Log.d(TAG, "Not a ColorOS device — skipping Realme-specific optimizations");
            return;
        }

        SharedPreferences prefs = context.getSharedPreferences("DeviceOptimizations", Context.MODE_PRIVATE);
        if (prefs.getBoolean("optimizations_shown", false)) {
            Log.d(TAG, "Device optimizations already shown — skipping");
            return;
        }

        Log.w(TAG, "ColorOS device detected (brand=" + Build.BRAND
            + " manufacturer=" + Build.MANUFACTURER + ")");

        prefs.edit().putBoolean("optimizations_shown", true).apply();
        showAutostartDialog(context);
    }

    private static void showAutostartDialog(Context context) {
        new AlertDialog.Builder(context)
            .setTitle("⚠ Enable Autostart (Required)")
            .setMessage(
                "TTRIMS needs Autostart enabled to keep GPS tracking running in the background on your Realme/Oppo/OnePlus device.\n\n"
                + "Please follow these steps:\n"
                + "1. Tap 'Open Settings'\n"
                + "2. Find TTRIMS in the app list\n"
                + "3. Toggle Autostart → ON\n\n"
                + "Without this, GPS tracking will stop when you leave the app.")
            .setPositiveButton("Open Autostart Settings", (d, w) -> {
                openAutostartSettings(context);
                showBatteryOptimizationDialog(context);
            })
            .setNegativeButton("Skip (Not Recommended)", (d, w) -> {
                showBatteryOptimizationDialog(context);
            })
            .setCancelable(false)
            .show();
    }

    private static void openAutostartSettings(Context context) {
        String[][] autoStartComponents = {
            {"com.coloros.safecenter",
             "com.coloros.safecenter.startupapp.StartupAppListActivity"},
            {"com.coloros.safecenter",
             "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
            {"com.oppo.safe",
             "com.oppo.safe.permission.startup.StartupAppListActivity"},
            {"com.realme.safecenter",
             "com.realme.safecenter.startupapp.StartupAppListActivity"},
        };

        for (String[] comp : autoStartComponents) {
            try {
                Intent intent = new Intent();
                intent.setComponent(new ComponentName(comp[0], comp[1]));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                Log.d(TAG, "Opened Autostart via: " + comp[0]);
                return;
            } catch (Exception ignored) {}
        }

        try {
            Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            fallback.setData(Uri.fromParts("package", context.getPackageName(), null));
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(fallback);
        } catch (Exception e) {
            Log.e(TAG, "Fallback failed: " + e.getMessage());
        }
    }

    private static void showBatteryOptimizationDialog(Context context) {
        new AlertDialog.Builder(context)
            .setTitle("Set Battery to Unrestricted")
            .setMessage(
                "Realme / ColorOS restricts background apps to save battery.\n\n"
                + "To keep GPS tracking active:\n"
                + "1. Tap 'Open Battery Settings'\n"
                + "2. Find TTRIMS in the list\n"
                + "3. Select 'No restrictions' or 'Unrestricted'\n\n"
                + "This prevents ColorOS from freezing the GPS service.")
            .setPositiveButton("Open Battery Settings", (d, w) -> {
                openBatteryOptimizationSettings(context);
            })
            .setNegativeButton("Skip", null)
            .setCancelable(false)
            .show();
    }

    private static void openBatteryOptimizationSettings(Context context) {
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + context.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            Log.d(TAG, "Opened standard battery optimization request");
            return;
        } catch (Exception ignored) {}

        String[][] batteryComponents = {
            {"com.coloros.oppoguardelf",
             "com.coloros.powermanager.fuelgauge.PowerUsageModelActivity"},
            {"com.coloros.oppoguardelf",
             "com.coloros.powermanager.fuelgauge.PowerConsumptionActivity"},
            {"com.oppo.oppogxtest",
             "com.oppo.oppogxtest.power.StartPowerActivity"},
        };

        for (String[] comp : batteryComponents) {
            try {
                Intent intent = new Intent();
                intent.setComponent(new ComponentName(comp[0], comp[1]));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                Log.d(TAG, "Opened ColorOS battery via: " + comp[0]);
                return;
            } catch (Exception ignored) {}
        }

        try {
            Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "All battery intents failed: " + e.getMessage());
        }
    }

    public static void openNotificationSettings(Context context) {
        try {
            Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName());
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.fromParts("package", context.getPackageName(), null));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(fallback);
            } catch (Exception ignored) {}
        }
    }
}
