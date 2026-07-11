package com.ttrims.ims.fragments;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.ttrims.ims.LoginActivity;
import com.ttrims.ims.DriverMainActivity;
import com.ttrims.ims.R;
import com.ttrims.ims.api.ApiClient;
import com.ttrims.ims.api.ApiService;
import com.ttrims.ims.databinding.FragmentProfileBinding;
import com.ttrims.ims.models.ApiResponse;
import com.ttrims.ims.models.User;
import com.ttrims.ims.utils.SessionManager;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ProfileFragment extends Fragment {

    private FragmentProfileBinding binding;
    private SessionManager session;
    private ApiService api;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        binding = FragmentProfileBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        session = SessionManager.getInstance(requireContext());
        api     = ApiClient.getService(requireContext());

        loadProfile();

        binding.btnLogout.setOnClickListener(v -> handleLogout());

        if (getActivity() instanceof DriverMainActivity) {
            ((DriverMainActivity) getActivity()).setTopBarSubtitle("Profile");
        }
    }

    private void loadProfile() {
        // Show stored user first (instant)
        User stored = session.getUser();
        if (stored != null) bindUser(stored);

        // Refresh from backend
        binding.profileProgress.setVisibility(View.VISIBLE);
        api.me().enqueue(new Callback<ApiResponse<User>>() {
            @Override
            public void onResponse(Call<ApiResponse<User>> call,
                                   Response<ApiResponse<User>> response) {
                if (binding == null) return;
                binding.profileProgress.setVisibility(View.GONE);
                if (response.isSuccessful() && response.body() != null && response.body().data != null) {
                    User user = response.body().data;
                    session.saveUser(user);
                    bindUser(user);
                    // Update topbar avatar
                    if (getActivity() instanceof DriverMainActivity) {
                        ((DriverMainActivity) getActivity()).updateAvatar(user.initials());
                    }
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<User>> call, Throwable t) {
                if (binding == null) return;
                binding.profileProgress.setVisibility(View.GONE);
            }
        });
    }

    private void bindUser(User user) {
        if (user == null || binding == null) return;
        binding.profileAvatar.setText(user.initials());
        binding.profileName.setText(user.name != null ? user.name : "Driver");
        binding.profileEmail.setText(user.email != null ? user.email : "—");
        String roleName = user.getRoleName();
        binding.profileRole.setText(roleName != null ? roleName.toUpperCase() : "DRIVER");
        String vehicle = user.vehicleNumber != null ? user.vehicleNumber : "Not assigned";
        binding.profileVehicle.setText(vehicle);
    }

    private void handleLogout() {
        binding.btnLogout.setEnabled(false);
        binding.btnLogout.setText("Signing out…");

        // Try server logout (best-effort)
        api.logout().enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call,
                                   Response<ApiResponse<Void>> response) {
                performLocalLogout();
            }

            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                // Even if network fails, clear local session and go to login
                performLocalLogout();
            }
        });
    }

    private void performLocalLogout() {
        session.logout();
        Toast.makeText(getContext(), "Signed out.", Toast.LENGTH_SHORT).show();
        Intent intent = new Intent(requireContext(), LoginActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
