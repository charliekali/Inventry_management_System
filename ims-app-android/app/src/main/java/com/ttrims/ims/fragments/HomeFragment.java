package com.ttrims.ims.fragments;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.fragment.app.Fragment;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.ttrims.ims.DriverMainActivity;
import com.ttrims.ims.R;
import com.ttrims.ims.api.ApiClient;
import com.ttrims.ims.api.ApiService;
import com.ttrims.ims.databinding.FragmentHomeBinding;
import com.ttrims.ims.models.ApiResponse;
import com.ttrims.ims.models.Shipment;
import com.ttrims.ims.models.User;
import com.ttrims.ims.utils.SessionManager;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class HomeFragment extends Fragment {

    private FragmentHomeBinding binding;
    private ApiService api;
    private FusedLocationProviderClient fusedLocation;
    private static final int PERM_LOCATION = 1001;

    private static final String[] STATUS_LABELS = {
            "Available", "On Trip", "Offline", "Breakdown"
    };
    private static final String[] STATUS_VALUES = {
            "AVAILABLE", "BUSY", "OFFLINE", "VEHICLE_BREAKDOWN"
    };

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        binding = FragmentHomeBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        api = ApiClient.getService(requireContext());
        fusedLocation = LocationServices.getFusedLocationProviderClient(requireContext());

        setupDutyStatusSpinner();
        loadHomeData();

        binding.btnCheckWork.setOnClickListener(v -> loadHomeData());
        binding.btnReportGps.setOnClickListener(v -> reportCurrentGps());
        binding.btnOpenShipments.setOnClickListener(v -> {
            if (getActivity() instanceof DriverMainActivity) {
                ((DriverMainActivity) getActivity()).setTopBarSubtitle("Shipments");
                requireActivity().findViewById(R.id.nav_shipments).performClick();
            }
        });
        binding.btnViewHistory.setOnClickListener(v -> {
            if (getActivity() instanceof DriverMainActivity) {
                requireActivity().findViewById(R.id.nav_history).performClick();
            }
        });

        if (getActivity() instanceof DriverMainActivity) {
            ((DriverMainActivity) getActivity()).setTopBarSubtitle("Home");
        }
    }

    private void setupDutyStatusSpinner() {
        ArrayAdapter<String> adapter = new ArrayAdapter<>(requireContext(),
                android.R.layout.simple_spinner_item, STATUS_LABELS);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        binding.spinnerDutyStatus.setAdapter(adapter);

        // Pre-select based on stored user status
        User user = SessionManager.getInstance(requireContext()).getUser();
        if (user != null && user.driverStatus != null) {
            int idx = Arrays.asList(STATUS_VALUES).indexOf(user.driverStatus);
            if (idx >= 0) binding.spinnerDutyStatus.setSelection(idx);
        }

        binding.spinnerDutyStatus.setOnItemSelectedListener(
                new android.widget.AdapterView.OnItemSelectedListener() {
                    @Override
                    public void onItemSelected(android.widget.AdapterView<?> parent, View view,
                                               int position, long id) {
                        updateDriverStatus(STATUS_VALUES[position]);
                    }

                    @Override
                    public void onNothingSelected(android.widget.AdapterView<?> parent) {}
                });
    }

    private void loadHomeData() {
        binding.homeProgress.setVisibility(View.VISIBLE);

        // Load assigned shipments to show active shipment summary
        api.listAssignedShipments().enqueue(new Callback<ApiResponse<List<Shipment>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<Shipment>>> call,
                                   Response<ApiResponse<List<Shipment>>> response) {
                if (binding == null) return;
                binding.homeProgress.setVisibility(View.GONE);
                if (response.isSuccessful() && response.body() != null) {
                    List<Shipment> list = response.body().data;
                    updateHomeUI(list);
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<List<Shipment>>> call, Throwable t) {
                if (binding == null) return;
                binding.homeProgress.setVisibility(View.GONE);
            }
        });

        // Update user info
        User user = SessionManager.getInstance(requireContext()).getUser();
        if (user != null) {
            binding.driverName.setText(user.name);
            binding.driverAvatar.setText(user.initials());
            String vehicle = user.vehicleNumber != null ? user.vehicleNumber : "—";
            binding.driverVehicle.setText("Vehicle: " + vehicle);
            binding.tvDutyStatus.setText(friendlyStatus(user.driverStatus));
        }
    }

    private void updateHomeUI(List<Shipment> shipments) {
        if (shipments == null || shipments.isEmpty()) {
            binding.cardActiveShipment.setVisibility(View.GONE);
            binding.cardNoShipment.setVisibility(View.VISIBLE);
            return;
        }

        // Find the active shipment (CREATED or EN_ROUTE)
        Shipment active = null;
        for (Shipment s : shipments) {
            if (s.isActive()) { active = s; break; }
        }

        if (active != null) {
            binding.cardActiveShipment.setVisibility(View.VISIBLE);
            binding.cardNoShipment.setVisibility(View.GONE);
            binding.tvActiveShipmentNumber.setText(active.shipmentNumber);
            binding.badgeActiveStatus.setText(active.status);
            binding.tvCompletedStops.setText(active.completedStops() + " / " +
                    (active.orders != null ? active.orders.size() : 0));
            binding.tvRemainingStops.setText(String.valueOf(active.remainingStops()));
        } else {
            binding.cardActiveShipment.setVisibility(View.GONE);
            binding.cardNoShipment.setVisibility(View.VISIBLE);
        }
    }

    private void updateDriverStatus(String status) {
        Map<String, String> body = new HashMap<>();
        body.put("status", status);
        api.updateDriverStatus(body).enqueue(new Callback<ApiResponse<Map<String, String>>>() {
            @Override
            public void onResponse(Call<ApiResponse<Map<String, String>>> call,
                                   Response<ApiResponse<Map<String, String>>> response) {
                if (response.isSuccessful()) {
                    binding.tvDutyStatus.setText(friendlyStatus(status));
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Map<String, String>>> call, Throwable t) {
                Toast.makeText(getContext(), getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void reportCurrentGps() {
        if (ActivityCompat.checkSelfPermission(requireContext(),
                Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, PERM_LOCATION);
            return;
        }
        fusedLocation.getLastLocation().addOnSuccessListener(loc -> {
            if (loc == null) {
                Toast.makeText(getContext(), "Unable to get location", Toast.LENGTH_SHORT).show();
                return;
            }
            Map<String, Double> body = new HashMap<>();
            body.put("lat", loc.getLatitude());
            body.put("lng", loc.getLongitude());
            body.put("accuracy", (double) loc.getAccuracy());
            api.reportLocation(body).enqueue(new Callback<ApiResponse<Void>>() {
                @Override
                public void onResponse(Call<ApiResponse<Void>> call,
                                       Response<ApiResponse<Void>> response) {
                    Toast.makeText(getContext(), "📍 GPS reported successfully", Toast.LENGTH_SHORT).show();
                }
                @Override
                public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                    Toast.makeText(getContext(), getString(R.string.error_network), Toast.LENGTH_SHORT).show();
                }
            });
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        if (requestCode == PERM_LOCATION && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            reportCurrentGps();
        } else {
            Toast.makeText(getContext(), getString(R.string.gps_permission_denied), Toast.LENGTH_LONG).show();
        }
    }

    private String friendlyStatus(String s) {
        if (s == null) return "Unknown";
        switch (s) {
            case "AVAILABLE":         return "Available ●";
            case "BUSY":              return "On Trip ●";
            case "OFFLINE":           return "Offline ●";
            case "VEHICLE_BREAKDOWN": return "Breakdown ●";
            default:                  return s;
        }
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
