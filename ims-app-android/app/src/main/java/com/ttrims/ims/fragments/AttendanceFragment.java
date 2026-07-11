package com.ttrims.ims.fragments;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.fragment.app.Fragment;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import android.content.Intent;
import com.ttrims.ims.services.LocationService;
import com.ttrims.ims.DriverMainActivity;
import com.ttrims.ims.R;
import com.ttrims.ims.api.ApiClient;
import com.ttrims.ims.api.ApiService;
import com.ttrims.ims.databinding.FragmentAttendanceBinding;
import com.ttrims.ims.models.ApiResponse;
import com.ttrims.ims.models.AttendanceSession;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class AttendanceFragment extends Fragment {

    private FragmentAttendanceBinding binding;
    private ApiService api;
    private FusedLocationProviderClient fusedLocation;
    private LocationCallback locationCallback;
    private static final int PERM_LOCATION = 1002;

    private AttendanceSession activeSession = null;
    private Handler timerHandler = new Handler(Looper.getMainLooper());
    private long clockInTime = 0;

    private Runnable timerRunnable = new Runnable() {
        @Override
        public void run() {
            if (activeSession != null && clockInTime > 0) {
                long elapsed = (System.currentTimeMillis() - clockInTime) / 1000;
                binding.tvElapsedTime.setText(formatElapsed(elapsed));
                timerHandler.postDelayed(this, 1000);
            }
        }
    };

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        binding = FragmentAttendanceBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        api = ApiClient.getService(requireContext());
        fusedLocation = LocationServices.getFusedLocationProviderClient(requireContext());

        loadAttendance();

        binding.btnClockIn.setOnClickListener(v -> clockIn());
        binding.btnClockOut.setOnClickListener(v -> clockOut());

        if (getActivity() instanceof DriverMainActivity) {
            ((DriverMainActivity) getActivity()).setTopBarSubtitle("Attendance");
        }
    }

    private void loadAttendance() {
        binding.attendanceProgress.setVisibility(View.VISIBLE);
        api.myAttendance().enqueue(new Callback<ApiResponse<java.util.List<AttendanceSession>>>() {
            @Override
            public void onResponse(Call<ApiResponse<java.util.List<AttendanceSession>>> call,
                                   Response<ApiResponse<java.util.List<AttendanceSession>>> response) {
                if (binding == null) return;
                binding.attendanceProgress.setVisibility(View.GONE);
                if (response.isSuccessful() && response.body() != null) {
                    java.util.List<AttendanceSession> sessions = response.body().data;
                    if (sessions != null) {
                        // Find the ACTIVE session
                        for (AttendanceSession s : sessions) {
                            if (s.isActive()) { activeSession = s; break; }
                        }
                        updateAttendanceUI();
                    }
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<java.util.List<AttendanceSession>>> call, Throwable t) {
                if (binding == null) return;
                binding.attendanceProgress.setVisibility(View.GONE);
            }
        });
    }

    private void clockIn() {
        if (ActivityCompat.checkSelfPermission(requireContext(),
                Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, PERM_LOCATION);
            return;
        }

        binding.btnClockIn.setEnabled(false);
        binding.btnClockIn.setText("Clocking In…");

        fusedLocation.getLastLocation().addOnCompleteListener(task -> {
            Map<String, Object> body = new HashMap<>();
            if (task.isSuccessful() && task.getResult() != null) {
                body.put("latitude", task.getResult().getLatitude());
                body.put("longitude", task.getResult().getLongitude());
                body.put("accuracy", (double) task.getResult().getAccuracy());
            }

            api.attendanceStart(body).enqueue(new Callback<ApiResponse<AttendanceSession>>() {
                @Override
                public void onResponse(Call<ApiResponse<AttendanceSession>> call,
                                       Response<ApiResponse<AttendanceSession>> response) {
                    if (binding == null) return;
                    binding.btnClockIn.setEnabled(true);
                    binding.btnClockIn.setText(getString(R.string.btn_clock_in));

                    if (response.isSuccessful() && response.body() != null) {
                        activeSession = response.body().data;
                        clockInTime = System.currentTimeMillis();
                        updateAttendanceUI();
                        startGpsPings();
                        Toast.makeText(getContext(), "✅ Clocked In!", Toast.LENGTH_SHORT).show();
                    } else {
                        Toast.makeText(getContext(), "Clock-in failed. Already active?",
                                Toast.LENGTH_SHORT).show();
                    }
                }

                @Override
                public void onFailure(Call<ApiResponse<AttendanceSession>> call, Throwable t) {
                    if (binding == null) return;
                    binding.btnClockIn.setEnabled(true);
                    binding.btnClockIn.setText(getString(R.string.btn_clock_in));
                    Toast.makeText(getContext(), getString(R.string.error_network), Toast.LENGTH_SHORT).show();
                }
            });
        });
    }

    private void clockOut() {
        if (activeSession == null) return;

        binding.btnClockOut.setEnabled(false);
        binding.btnClockOut.setText("Clocking Out…");
        stopGpsPings();

        api.attendanceStop(activeSession.id).enqueue(new Callback<ApiResponse<AttendanceSession>>() {
            @Override
            public void onResponse(Call<ApiResponse<AttendanceSession>> call,
                                   Response<ApiResponse<AttendanceSession>> response) {
                if (binding == null) return;
                binding.btnClockOut.setEnabled(true);
                binding.btnClockOut.setText(getString(R.string.btn_clock_out));

                if (response.isSuccessful()) {
                    activeSession = null;
                    timerHandler.removeCallbacks(timerRunnable);
                    updateAttendanceUI();
                    Toast.makeText(getContext(), "👋 Clocked Out!", Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(getContext(), "Clock-out failed", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<AttendanceSession>> call, Throwable t) {
                if (binding == null) return;
                binding.btnClockOut.setEnabled(true);
                binding.btnClockOut.setText(getString(R.string.btn_clock_out));
                Toast.makeText(getContext(), getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void updateAttendanceUI() {
        if (activeSession != null) {
            binding.tvAttendanceStatus.setText(getString(R.string.attendance_active));
            binding.tvAttendanceStatus.setTextColor(requireContext().getColor(R.color.color_success));
            binding.btnClockIn.setVisibility(View.GONE);
            binding.btnClockOut.setVisibility(View.VISIBLE);
            binding.tvElapsedLabel.setVisibility(View.VISIBLE);
            binding.tvElapsedTime.setVisibility(View.VISIBLE);
            clockInTime = System.currentTimeMillis();
            timerHandler.post(timerRunnable);
        } else {
            binding.tvAttendanceStatus.setText(getString(R.string.attendance_inactive));
            binding.tvAttendanceStatus.setTextColor(requireContext().getColor(R.color.text_muted));
            binding.btnClockIn.setVisibility(View.VISIBLE);
            binding.btnClockOut.setVisibility(View.GONE);
            binding.tvElapsedLabel.setVisibility(View.GONE);
            binding.tvElapsedTime.setVisibility(View.GONE);
            timerHandler.removeCallbacks(timerRunnable);
        }
    }

    /** Starts the persistent foreground location tracking service. */
    private void startGpsPings() {
        if (activeSession == null) return;
        if (ActivityCompat.checkSelfPermission(requireContext(),
                Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return;

        com.ttrims.ims.utils.SessionManager sm = com.ttrims.ims.utils.SessionManager.getInstance(requireContext());
        String token = sm.getAccessToken();
        String apiUrl = sm.getCustomApiUrl();
        if (apiUrl == null || apiUrl.isEmpty()) {
            apiUrl = com.ttrims.ims.api.ApiClient.DEFAULT_BASE_URL;
        }
        if (apiUrl.endsWith("/")) {
            apiUrl = apiUrl.substring(0, apiUrl.length() - 1);
        }

        Intent serviceIntent = new Intent(requireContext(), LocationService.class);
        serviceIntent.setAction(LocationService.ACTION_START);
        serviceIntent.putExtra(LocationService.K_SESSION, activeSession.id);
        serviceIntent.putExtra(LocationService.K_TOKEN, token);
        serviceIntent.putExtra(LocationService.K_API_URL, apiUrl);
        serviceIntent.putExtra(LocationService.K_INTERVAL, 2000L);
        serviceIntent.putExtra(LocationService.K_DISTANCE, 0);
        serviceIntent.putExtra(LocationService.EXTRA_SESSION_ID, activeSession.id); // for backward compatibility

        requireContext().startForegroundService(serviceIntent);
    }

    private void stopGpsPings() {
        Intent serviceIntent = new Intent(requireContext(), LocationService.class);
        serviceIntent.setAction(LocationService.ACTION_STOP);
        requireContext().startService(serviceIntent);
    }

    private String formatElapsed(long seconds) {
        long h = seconds / 3600;
        long m = (seconds % 3600) / 60;
        long s = seconds % 60;
        return String.format(Locale.getDefault(), "%02d:%02d:%02d", h, m, s);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        if (requestCode == PERM_LOCATION && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            clockIn();
        }
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        timerHandler.removeCallbacks(timerRunnable);
        binding = null;
    }
}
