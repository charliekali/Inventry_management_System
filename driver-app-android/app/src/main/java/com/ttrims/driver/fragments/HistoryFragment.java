package com.ttrims.driver.fragments;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.ttrims.driver.MainActivity;
import com.ttrims.driver.R;
import com.ttrims.driver.api.ApiClient;
import com.ttrims.driver.api.ApiService;
import com.ttrims.driver.databinding.FragmentHistoryBinding;
import com.ttrims.driver.models.ApiResponse;
import com.ttrims.driver.models.Shipment;
import com.ttrims.driver.adapters.HistoryAdapter;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class HistoryFragment extends Fragment {

    private FragmentHistoryBinding binding;
    private ApiService api;
    private List<Shipment> completedShipments = new ArrayList<>();

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        binding = FragmentHistoryBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        api = ApiClient.getService(requireContext());

        // Simple vertical list using a basic adapter
        binding.rvHistory.setLayoutManager(new LinearLayoutManager(requireContext()));

        binding.swipeRefreshHistory.setColorSchemeColors(
                requireContext().getColor(R.color.primary));
        binding.swipeRefreshHistory.setOnRefreshListener(this::loadHistory);

        loadHistory();

        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).setTopBarSubtitle("History");
        }
    }

    private void loadHistory() {
        binding.historyProgress.setVisibility(View.VISIBLE);
        binding.tvNoHistory.setVisibility(View.GONE);

        api.listAssignedShipments().enqueue(new Callback<ApiResponse<List<Shipment>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<Shipment>>> call,
                                   Response<ApiResponse<List<Shipment>>> response) {
                if (binding == null) return;
                binding.historyProgress.setVisibility(View.GONE);
                binding.swipeRefreshHistory.setRefreshing(false);

                if (response.isSuccessful() && response.body() != null) {
                    List<Shipment> all = response.body().data;
                    // Filter completed (DELIVERED or FAILED)
                    completedShipments.clear();
                    if (all != null) {
                        for (Shipment s : all) {
                            if ("DELIVERED".equals(s.status) || "FAILED".equals(s.status)) {
                                completedShipments.add(s);
                            }
                        }
                    }

                    if (completedShipments.isEmpty()) {
                        binding.tvNoHistory.setVisibility(View.VISIBLE);
                    } else {
                        binding.rvHistory.setAdapter(
                                new HistoryAdapter(requireContext(), completedShipments));
                    }
                } else {
                    binding.tvNoHistory.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<List<Shipment>>> call, Throwable t) {
                if (binding == null) return;
                binding.historyProgress.setVisibility(View.GONE);
                binding.swipeRefreshHistory.setRefreshing(false);
                binding.tvNoHistory.setVisibility(View.VISIBLE);
            }
        });
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
