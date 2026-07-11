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
import com.ttrims.driver.adapters.ShipmentAdapter;
import com.ttrims.driver.api.ApiClient;
import com.ttrims.driver.api.ApiService;
import com.ttrims.driver.databinding.FragmentShipmentsBinding;
import com.ttrims.driver.models.ApiResponse;
import com.ttrims.driver.models.Shipment;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ShipmentsFragment extends Fragment {

    private FragmentShipmentsBinding binding;
    private ApiService api;
    private ShipmentAdapter adapter;
    private List<Shipment> shipments = new ArrayList<>();

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        binding = FragmentShipmentsBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        api = ApiClient.getService(requireContext());

        // RecyclerView setup
        adapter = new ShipmentAdapter(requireContext(), shipments, this::onStopConfirmed);
        binding.rvShipments.setLayoutManager(new LinearLayoutManager(requireContext()));
        binding.rvShipments.setAdapter(adapter);

        // SwipeRefresh
        binding.swipeRefreshShipments.setColorSchemeColors(
                requireContext().getColor(R.color.primary));
        binding.swipeRefreshShipments.setProgressBackgroundColorSchemeColor(
                requireContext().getColor(R.color.bg_card));
        binding.swipeRefreshShipments.setOnRefreshListener(this::loadShipments);

        binding.btnRefreshShipments.setOnClickListener(v -> loadShipments());

        loadShipments();

        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).setTopBarSubtitle("Shipments");
        }
    }

    private void loadShipments() {
        binding.shipmentsProgress.setVisibility(View.VISIBLE);
        binding.layoutEmptyShipments.setVisibility(View.GONE);

        api.listAssignedShipments().enqueue(new Callback<ApiResponse<List<Shipment>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<Shipment>>> call,
                                   Response<ApiResponse<List<Shipment>>> response) {
                if (binding == null) return;
                binding.shipmentsProgress.setVisibility(View.GONE);
                binding.swipeRefreshShipments.setRefreshing(false);

                if (response.isSuccessful() && response.body() != null && response.body().data != null) {
                    List<Shipment> data = response.body().data;
                    shipments.clear();
                    shipments.addAll(data);
                    adapter.notifyDataSetChanged();

                    // Update daily stats bar
                    int total = 0, delivered = 0, failed = 0, remaining = 0;
                    for (Shipment s : data) {
                        if (s.orders != null) total += s.orders.size();
                        delivered += s.completedStops();
                        remaining += s.remainingStops();
                    }
                    binding.tvStatTotal.setText(String.valueOf(total));
                    binding.tvStatDelivered.setText(String.valueOf(delivered));
                    binding.tvStatFailed.setText("0"); // individual failed count if needed
                    binding.tvStatPending.setText(String.valueOf(remaining));

                    if (data.isEmpty()) {
                        binding.layoutEmptyShipments.setVisibility(View.VISIBLE);
                    }
                } else {
                    binding.layoutEmptyShipments.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<List<Shipment>>> call, Throwable t) {
                if (binding == null) return;
                binding.shipmentsProgress.setVisibility(View.GONE);
                binding.swipeRefreshShipments.setRefreshing(false);
                binding.layoutEmptyShipments.setVisibility(View.VISIBLE);
            }
        });
    }

    /** Called by adapter after a stop is confirmed — refresh to update counts. */
    public void onStopConfirmed() {
        loadShipments();
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
