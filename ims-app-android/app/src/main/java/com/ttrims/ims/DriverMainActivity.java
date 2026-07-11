package com.ttrims.ims;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentTransaction;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.ttrims.ims.databinding.ActivityMainDriverBinding;
import com.ttrims.ims.fragments.AttendanceFragment;
import com.ttrims.ims.fragments.HistoryFragment;
import com.ttrims.ims.fragments.HomeFragment;
import com.ttrims.ims.fragments.ProfileFragment;
import com.ttrims.ims.fragments.ShipmentsFragment;
import com.ttrims.ims.models.User;
import com.ttrims.ims.utils.SessionManager;
import com.ttrims.ims.utils.DeviceOptimizationHelper;

public class DriverMainActivity extends AppCompatActivity {

    private static final String TAG = "DriverMainActivity";
    private ActivityMainDriverBinding binding;
    private final String[] TAB_TAGS = {
            "home", "shipments", "history", "attendance", "profile"
    };

    // Permission chain matching Capacitor app
    private final ActivityResultLauncher<String> notifPermLauncher =
        registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            granted -> {
                checkNotificationsEnabled();
                requestFineLocation();
            });

    private boolean pendingBgLocationRequest = false;

    private final ActivityResultLauncher<String[]> fineLocationLauncher =
        registerForActivityResult(
            new ActivityResultContracts.RequestMultiplePermissions(),
            result -> {
                Boolean fine = result.getOrDefault(Manifest.permission.ACCESS_FINE_LOCATION, false);
                if (Boolean.TRUE.equals(fine)) {
                    pendingBgLocationRequest = true;
                }
            });

    private final ActivityResultLauncher<String> bgLocationLauncher =
        registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            granted -> {
                if (!granted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    showBackgroundLocationRationale();
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityMainDriverBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        // Populate topbar avatar with user initials
        User user = SessionManager.getInstance(this).getUser();
        if (user != null) {
            binding.topbarAvatar.setText(user.initials());
        }

        // Request permissions sequentially on startup
        requestAllPermissions();

        // Apply OEM specific battery and start restrictions (ColorOS/Realme)
        DeviceOptimizationHelper.applyColorOsOptimizations(this);

        // Set up bottom navigation
        binding.bottomNav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_home)       { switchTab("home",       new HomeFragment());       return true; }
            if (id == R.id.nav_shipments)  { switchTab("shipments",  new ShipmentsFragment());  return true; }
            if (id == R.id.nav_history)    { switchTab("history",    new HistoryFragment());    return true; }
            if (id == R.id.nav_attendance) { switchTab("attendance", new AttendanceFragment()); return true; }
            if (id == R.id.nav_profile)    { switchTab("profile",    new ProfileFragment());    return true; }
            return false;
        });

        // Show home by default on first create
        if (savedInstanceState == null) {
            switchTab("home", new HomeFragment());
            binding.bottomNav.setSelectedItemId(R.id.nav_home);
        }

        // Avatar click → profile tab
        binding.topbarAvatar.setOnClickListener(v -> {
            binding.bottomNav.setSelectedItemId(R.id.nav_profile);
        });
    }

    /** Updates the top-bar subtitle text when fragments change. */
    public void setTopBarSubtitle(String subtitle) {
        binding.topbarSubtitle.setText(subtitle);
    }

    /** Updates avatar initials (called after profile reload). */
    public void updateAvatar(String initials) {
        binding.topbarAvatar.setText(initials);
    }

    private void switchTab(String tag, Fragment newFragment) {
        FragmentTransaction ft = getSupportFragmentManager().beginTransaction();
        Fragment existing = getSupportFragmentManager().findFragmentByTag(tag);

        // Hide all other fragments
        for (String t : TAB_TAGS) {
            Fragment f = getSupportFragmentManager().findFragmentByTag(t);
            if (f != null && !t.equals(tag)) ft.hide(f);
        }

        if (existing == null) {
            ft.add(R.id.fragment_container, newFragment, tag);
        } else {
            ft.show(existing);
        }
        ft.commit();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (pendingBgLocationRequest) {
            pendingBgLocationRequest = false;
            requestBackgroundLocation();
        }
    }

    private void requestAllPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
                return;
            }
        }
        checkNotificationsEnabled();
        requestFineLocation();
    }

    private void requestFineLocation() {
        boolean hasFine = ContextCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        if (!hasFine) {
            fineLocationLauncher.launch(new String[]{
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            });
            return;
        }
        pendingBgLocationRequest = true;
    }

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
                            showBackgroundLocationRationale();
                        }
                    })
                    .setNegativeButton("Cancel", null)
                    .setCancelable(false)
                    .show();
            }
        }
    }

    private void showBackgroundLocationRationale() {
        new AlertDialog.Builder(this)
            .setTitle("Background Location Needed")
            .setMessage(
                "TTRIMS needs \"Allow all the time\" location access to track attendance "
                + "while the app is in the background.\n\n"
                + "Please tap 'Open Settings', go to Permissions → Location, "
                + "and select \"Allow all the time\".")
            .setPositiveButton("Open Settings", (dialog, which) -> {
                try {
                    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(Uri.fromParts("package", getPackageName(), null));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception ignored) {}
            })
            .setNegativeButton("Cancel", null)
            .setCancelable(false)
            .show();
    }

    private void checkNotificationsEnabled() {
        boolean enabled = NotificationManagerCompat.from(this).areNotificationsEnabled();
        if (!enabled) {
            new AlertDialog.Builder(this)
                .setTitle("Notifications Blocked")
                .setMessage(
                    "TTRIMS requires notification permissions to keep the background GPS service alive.\n\n"
                    + "Please enable notifications in Settings to ensure tracking works.")
                .setPositiveButton("Open Settings", (dialog, which) -> {
                    DeviceOptimizationHelper.openNotificationSettings(this);
                })
                .setNegativeButton("Skip", null)
                .setCancelable(false)
                .show();
        }
    }
}
