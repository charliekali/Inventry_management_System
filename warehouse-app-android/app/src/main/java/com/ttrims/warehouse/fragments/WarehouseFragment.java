package com.ttrims.warehouse.fragments;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.ttrims.warehouse.R;
import com.ttrims.warehouse.adapters.WarehouseAdapter;
import com.ttrims.warehouse.api.ApiClient;
import com.ttrims.warehouse.api.ApiService;
import com.ttrims.warehouse.databinding.FragmentWarehouseBinding;
import com.ttrims.warehouse.models.ApiResponse;
import com.ttrims.warehouse.models.Warehouse;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class WarehouseFragment extends Fragment implements WarehouseAdapter.OnSectionAddListener {

    private FragmentWarehouseBinding binding;
    private ApiService api;
    private List<Warehouse> list = new ArrayList<>();
    private WarehouseAdapter adapter;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        binding = FragmentWarehouseBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        api = ApiClient.getService(requireContext());

        binding.rvWarehouses.setLayoutManager(new LinearLayoutManager(getContext()));
        adapter = new WarehouseAdapter(getContext(), list, this);
        binding.rvWarehouses.setAdapter(adapter);

        binding.btnAddWarehouse.setOnClickListener(v -> showAddWarehouseDialog());

        loadWarehouses();
    }

    private void loadWarehouses() {
        setLoading(true);
        api.getWarehouses().enqueue(new Callback<ApiResponse<List<Warehouse>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<Warehouse>>> call, Response<ApiResponse<List<Warehouse>>> response) {
                setLoading(false);
                if (response.isSuccessful() && response.body() != null) {
                    list.clear();
                    list.addAll(response.body().data);
                    adapter.notifyDataSetChanged();
                } else {
                    Toast.makeText(getContext(), "Failed to load warehouses", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<List<Warehouse>>> call, Throwable t) {
                setLoading(false);
                Toast.makeText(getContext(), getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showAddWarehouseDialog() {
        if (getContext() == null) return;

        AlertDialog.Builder builder = new AlertDialog.Builder(getContext());
        builder.setTitle("Add New Warehouse");

        LinearLayout layout = new LinearLayout(getContext());
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(32, 24, 32, 24);

        final EditText etName = new EditText(getContext());
        etName.setHint("Warehouse Name (e.g. Central Depo)");
        layout.addView(etName);

        final EditText etCode = new EditText(getContext());
        etCode.setHint("Warehouse Code (e.g. WH-CEN)");
        layout.addView(etCode);

        builder.setView(layout);

        builder.setPositiveButton("Create", (dialog, which) -> {
            String name = etName.getText().toString().trim();
            String code = etCode.getText().toString().trim();

            if (name.isEmpty() || code.isEmpty()) {
                Toast.makeText(getContext(), "All fields are required", Toast.LENGTH_SHORT).show();
                return;
            }

            Map<String, String> payload = new HashMap<>();
            payload.put("name", name);
            payload.put("code", code);

            api.createWarehouse(payload).enqueue(new Callback<ApiResponse<Warehouse>>() {
                @Override
                public void onResponse(Call<ApiResponse<Warehouse>> call, Response<ApiResponse<Warehouse>> response) {
                    if (response.isSuccessful()) {
                        Toast.makeText(getContext(), "Warehouse created!", Toast.LENGTH_SHORT).show();
                        loadWarehouses();
                    } else {
                        Toast.makeText(getContext(), "Creation failed", Toast.LENGTH_SHORT).show();
                    }
                }

                @Override
                public void onFailure(Call<ApiResponse<Warehouse>> call, Throwable t) {
                    Toast.makeText(getContext(), getString(R.string.error_network), Toast.LENGTH_SHORT).show();
                }
            });
        });

        builder.setNegativeButton("Cancel", null);
        builder.show();
    }

    @Override
    public void onAddSection(Warehouse warehouse) {
        if (getContext() == null) return;

        AlertDialog.Builder builder = new AlertDialog.Builder(getContext());
        builder.setTitle("Add Section to " + warehouse.name);

        LinearLayout layout = new LinearLayout(getContext());
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(32, 24, 32, 24);

        final EditText etName = new EditText(getContext());
        etName.setHint("Section Name (e.g. Row A Shelf 1)");
        layout.addView(etName);

        final EditText etCode = new EditText(getContext());
        etCode.setHint("Section Code (e.g. SEC-A1)");
        layout.addView(etCode);

        builder.setView(layout);

        builder.setPositiveButton("Add Section", (dialog, which) -> {
            String name = etName.getText().toString().trim();
            String code = etCode.getText().toString().trim();

            if (name.isEmpty() || code.isEmpty()) {
                Toast.makeText(getContext(), "All fields are required", Toast.LENGTH_SHORT).show();
                return;
            }

            Map<String, String> payload = new HashMap<>();
            payload.put("name", name);
            payload.put("code", code);

            api.createSection(warehouse.id, payload).enqueue(new Callback<ApiResponse<Warehouse.Section>>() {
                @Override
                public void onResponse(Call<ApiResponse<Warehouse.Section>> call, Response<ApiResponse<Warehouse.Section>> response) {
                    if (response.isSuccessful()) {
                        Toast.makeText(getContext(), "Section added!", Toast.LENGTH_SHORT).show();
                        loadWarehouses();
                    } else {
                        Toast.makeText(getContext(), "Failed to add section", Toast.LENGTH_SHORT).show();
                    }
                }

                @Override
                public void onFailure(Call<ApiResponse<Warehouse.Section>> call, Throwable t) {
                    Toast.makeText(getContext(), getString(R.string.error_network), Toast.LENGTH_SHORT).show();
                }
            });
        });

        builder.setNegativeButton("Cancel", null);
        builder.show();
    }

    private void setLoading(boolean isLoading) {
        binding.warehouseProgress.setVisibility(isLoading ? View.VISIBLE : View.GONE);
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
