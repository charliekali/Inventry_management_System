package com.ttrims.driver.services;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.concurrent.TimeUnit;

/**
 * TrackingWorker — WorkManager periodic worker (runs every 15 minutes) as a secondary safety net.
 */
public class TrackingWorker extends Worker {

    private static final String TAG       = "TrackingWorker";
    public  static final String WORK_NAME = "TrackingWatchdogWork";

    public TrackingWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(
            LocationService.PREFS, Context.MODE_PRIVATE);

        boolean isActive    = prefs.getBoolean(LocationService.K_ACTIVE, false);
        boolean userStopped = prefs.getBoolean(LocationService.K_STOP, false);
        String  sessionId   = prefs.getString(LocationService.K_SESSION, null);
        String  token       = prefs.getString(LocationService.K_TOKEN, null);
        String  apiUrl      = prefs.getString(LocationService.K_API_URL, null);

        if (!isActive || userStopped || sessionId == null || token == null || apiUrl == null) {
            Log.d(TAG, "Worker: no active session — nothing to do");
            return Result.success();
        }

        if (LocationService.isRunning()) {
            Log.d(TAG, "Worker: service is running — all good");
            return Result.success();
        }

        Log.w(TAG, "Worker: LocationService DEAD with active session=" + sessionId + " — RESTARTING");

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
            Log.d(TAG, "Worker: LocationService restarted successfully");
        } catch (Exception e) {
            Log.e(TAG, "Worker: failed to restart service: " + e.getMessage());
            return Result.retry();
        }

        return Result.success();
    }

    public static void enqueue(Context context) {
        try {
            PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                    TrackingWorker.class, 15, TimeUnit.MINUTES)
                .setConstraints(new Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.NOT_REQUIRED)
                    .build())
                .build();

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request);

            Log.d(TAG, "Periodic worker enqueued (every 15 min)");
        } catch (Exception e) {
            Log.e(TAG, "Failed to enqueue periodic worker: " + e.getMessage());
        }
    }

    public static void cancel(Context context) {
        try {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME);
            Log.d(TAG, "Periodic worker cancelled");
        } catch (Exception e) {
            Log.e(TAG, "Failed to cancel periodic worker: " + e.getMessage());
        }
    }
}
