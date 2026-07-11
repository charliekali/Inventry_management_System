package com.ttrims.ims.services;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

/**
 * TrackingWatchdog — checks every 60s if LocationService is alive during an active session,
 * and restarts it if it has been killed.
 */
public class TrackingWatchdog extends BroadcastReceiver {

    private static final String TAG = "TrackingWatchdog";
    public static final String ACTION_WATCHDOG = "com.ttrims.ims.TRACKING_WATCHDOG";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        SharedPreferences prefs = context.getSharedPreferences(
            LocationService.PREFS, Context.MODE_PRIVATE);

        boolean isActive    = prefs.getBoolean(LocationService.K_ACTIVE, false);
        boolean userStopped = prefs.getBoolean(LocationService.K_STOP, false);
        String  sessionId   = prefs.getString(LocationService.K_SESSION, null);
        String  token       = prefs.getString(LocationService.K_TOKEN, null);
        String  apiUrl      = prefs.getString(LocationService.K_API_URL, null);

        if (!isActive || userStopped || sessionId == null || token == null || apiUrl == null) {
            Log.d(TAG, "Watchdog: no active session or user stopped — alarm chain ends");
            return;
        }

        if (LocationService.isRunning()) {
            Log.d(TAG, "Watchdog: service is already running — all good");
            rescheduleAlarm(context);
            return;
        }

        Log.w(TAG, "Watchdog: LocationService DEAD with active session=" + sessionId + " — RESTARTING");

        long   interval = prefs.getLong(LocationService.K_INTERVAL, 2_000L);
        float  distance = prefs.getFloat(LocationService.K_DISTANCE, 0.0f);
        String date     = prefs.getString(LocationService.K_DATE, "");

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
            Log.d(TAG, "Watchdog: LocationService restarted successfully");
        } catch (Exception e) {
            Log.e(TAG, "Watchdog: failed to restart service: " + e.getMessage());
        }

        rescheduleAlarm(context);
    }

    private void rescheduleAlarm(Context context) {
        try {
            android.app.AlarmManager am = (android.app.AlarmManager)
                context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            Intent alarmIntent = new Intent(context, TrackingWatchdog.class);
            alarmIntent.setAction(ACTION_WATCHDOG);
            int flags = android.app.PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= android.app.PendingIntent.FLAG_IMMUTABLE;
            }
            android.app.PendingIntent pi = android.app.PendingIntent.getBroadcast(
                context, 0, alarmIntent, flags);

            long triggerAt = android.os.SystemClock.elapsedRealtime() + 60_000L;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(
                    android.app.AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
            } else {
                am.setExact(
                    android.app.AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
            }

            Log.d(TAG, "Watchdog: next alarm scheduled in 60s");
        } catch (Exception e) {
            Log.e(TAG, "Watchdog: failed to reschedule alarm: " + e.getMessage());
        }
    }
}
