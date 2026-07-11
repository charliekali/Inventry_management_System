package com.ttrims.ims.services;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

/**
 * BootReceiver — restarts LocationService after device reboot or app update.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (action == null) return;

        boolean isBoot   = Intent.ACTION_BOOT_COMPLETED.equals(action)
                        || "android.intent.action.QUICKBOOT_POWERON".equals(action);
        boolean isUpdate = Intent.ACTION_MY_PACKAGE_REPLACED.equals(action);

        if (!isBoot && !isUpdate) return;

        Log.d(TAG, "Received action: " + action);

        SharedPreferences prefs = context.getSharedPreferences(
            LocationService.PREFS, Context.MODE_PRIVATE);

        boolean wasActive   = prefs.getBoolean(LocationService.K_ACTIVE, false);
        boolean userStopped = prefs.getBoolean(LocationService.K_STOP, false);
        String  sessionId   = prefs.getString(LocationService.K_SESSION, null);
        String  token       = prefs.getString(LocationService.K_TOKEN,   null);
        String  apiUrl      = prefs.getString(LocationService.K_API_URL, null);

        if (!wasActive || userStopped || sessionId == null || token == null || apiUrl == null) {
            Log.d(TAG, "No active session at " + action + " — skipping service start");
            return;
        }

        Log.d(TAG, action + " detected with active session=" + sessionId + " — restarting LocationService");

        long  interval = prefs.getLong(LocationService.K_INTERVAL, 2_000L);
        float distance = prefs.getFloat(LocationService.K_DISTANCE, 0.0f);
        String date    = prefs.getString(LocationService.K_DATE, "");

        Intent serviceIntent = new Intent(context, LocationService.class);
        serviceIntent.setAction(LocationService.ACTION_START);
        serviceIntent.putExtra(LocationService.K_SESSION,  sessionId);
        serviceIntent.putExtra(LocationService.K_TOKEN,    token);
        serviceIntent.putExtra(LocationService.K_API_URL,  apiUrl);
        serviceIntent.putExtra(LocationService.K_INTERVAL, interval);
        serviceIntent.putExtra(LocationService.K_DISTANCE, (int) distance);
        serviceIntent.putExtra(LocationService.K_DATE,     date);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            Log.d(TAG, "LocationService restarted successfully after " + action);
        } catch (Exception e) {
            Log.e(TAG, "Failed to restart service after " + action + ": " + e.getMessage());
        }
    }
}
