package com.ttrims.warehouse.fragments;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.ttrims.warehouse.MainActivity;
import com.ttrims.warehouse.R;
import com.ttrims.warehouse.adapters.ProductAdapter;
import com.ttrims.warehouse.adapters.TransactionAdapter;
import com.ttrims.warehouse.api.ApiClient;
import com.ttrims.warehouse.api.ApiService;
import com.ttrims.warehouse.databinding.FragmentDashboardBinding;
import com.ttrims.warehouse.models.ApiResponse;
import com.ttrims.warehouse.models.User;
import com.ttrims.warehouse.utils.SessionManager;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class DashboardFragment extends Fragment {

    private FragmentDashboardBinding binding;
    private ApiService api;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        binding = FragmentDashboardBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        api = ApiClient.getService(requireContext());

        User user = SessionManager.getInstance(requireContext()).getUser();
        if (user != null) {
            String role = user.getRoleName();
            String category = user.roleCategory;
            boolean isSuperAdmin = "Super Admin".equalsIgnoreCase(role) || "Super Admin".equalsIgnoreCase(category);

            if (isSuperAdmin) {
                // Show the modular app selector hub for Super Admin
                binding.layoutStatsDashboard.setVisibility(View.GONE);
                binding.layoutSuperAdminHub.setVisibility(View.VISIBLE);
                setupHubClickListeners();
            } else {
                // Show standard warehouse stats for staff
                binding.layoutStatsDashboard.setVisibility(View.VISIBLE);
                binding.layoutSuperAdminHub.setVisibility(View.GONE);
                binding.rvLowStockList.setLayoutManager(new LinearLayoutManager(getContext()));
                binding.rvRecentTransactions.setLayoutManager(new LinearLayoutManager(getContext()));
                loadDashboardData();
            }
        }
    }

    private void setupHubClickListeners() {
        binding.cardHubWarehouse.setOnClickListener(v -> navigateToTab(R.id.nav_warehouse));
        binding.cardHubProduction.setOnClickListener(v -> navigateToTab(R.id.nav_recipes));
        binding.cardHubSales.setOnClickListener(v -> navigateToTab(R.id.nav_pos));
        binding.cardHubLogistics.setOnClickListener(v -> navigateToTab(R.id.nav_key_registry));
        binding.cardHubKeys.setOnClickListener(v -> navigateToTab(R.id.nav_key_registry));

        binding.btnHubLogout.setOnClickListener(v -> {
            if (getActivity() instanceof MainActivity) {
                // Show standard logout dialog from MainActivity
                binding.btnHubLogout.post(() -> {
                    SessionManager.getInstance(requireContext()).clearSession();
                    Toast.makeText(getContext(), "Signed out", Toast.LENGTH_SHORT).show();
                    getActivity().startActivity(new android.content.Intent(getActivity(), com.ttrims.warehouse.LoginActivity.class));
                    getActivity().finish();
                });
            }
        });
    }

    private void navigateToTab(int id) {
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).selectNavigationItem(id);
        }
    }

    private void loadDashboardData() {
        api.getDashboardStats().enqueue(new Callback<ApiResponse<ApiService.DashboardStats>>() {
            @Override
            public void onResponse(Call<ApiResponse<ApiService.DashboardStats>> call,
                                   Response<ApiResponse<ApiService.DashboardStats>> response) {
                if (binding == null) return;

                if (response.isSuccessful() && response.body() != null) {
                    ApiService.DashboardStats stats = response.body().data;

                    binding.tvTotalItems.setText(String.valueOf(stats.totalItems));
                    binding.tvLowStock.setText(String.valueOf(stats.lowStockCount));

                    if (stats.lowStockItems != null) {
                        binding.rvLowStockList.setAdapter(new ProductAdapter(getContext(), stats.lowStockItems));
                    }
                    if (stats.recentTransactions != null) {
                        binding.rvRecentTransactions.setAdapter(new TransactionAdapter(getContext(), stats.recentTransactions));
                    }
                } else {
                    Toast.makeText(getContext(), "Failed to load dashboard metrics", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<ApiService.DashboardStats>> call, Throwable t) {
                if (binding == null) return;
                Toast.makeText(getContext(), getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
