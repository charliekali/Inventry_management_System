package com.ttrims.warehouse.fragments;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.ttrims.warehouse.R;
import com.ttrims.warehouse.api.ApiClient;
import com.ttrims.warehouse.api.ApiService;
import com.ttrims.warehouse.databinding.FragmentStockOutBinding;
import com.ttrims.warehouse.models.ApiResponse;
import com.ttrims.warehouse.models.Product;
import com.ttrims.warehouse.models.Warehouse;
import com.ttrims.warehouse.models.Transaction;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class StockOutFragment extends Fragment {

    private FragmentStockOutBinding binding;
    private ApiService api;

    private List<Warehouse> warehouses = new ArrayList<>();
    private List<Product> products = new ArrayList<>();

    private Warehouse selectedWarehouse = null;
    private Warehouse.Section selectedSection = null;
    private Product selectedProduct = null;

    private void selectProductByCode(String code) {
        if (products == null || code == null) return;
        for (int i = 0; i < products.size(); i++) {
            if (code.equalsIgnoreCase(products.get(i).code) || code.equalsIgnoreCase(products.get(i).id)) {
                binding.spinnerProduct.setSelection(i);
                Toast.makeText(getContext(), "Selected: " + products.get(i).name, Toast.LENGTH_SHORT).show();
                return;
            }
        }
        Toast.makeText(getContext(), "Product SKU/code not found: " + code, Toast.LENGTH_LONG).show();
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        binding = FragmentStockOutBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        api = ApiClient.getService(requireContext());

        setupSpinners();
        loadFormData();

        binding.btnSubmitStockOut.setOnClickListener(v -> submitStockOut());
    }

    private void setupSpinners() {
        binding.spinnerWarehouse.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (position >= 0 && position < warehouses.size()) {
                    selectedWarehouse = warehouses.get(position);
                    populateSectionsSpinner(selectedWarehouse.sections);
                }
            }
            @Override public void onNothingSelected(AdapterView<?> parent) {}
        });

        binding.spinnerSection.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (selectedWarehouse != null && selectedWarehouse.sections != null && position >= 0 && position < selectedWarehouse.sections.size()) {
                    selectedSection = selectedWarehouse.sections.get(position);
                }
            }
            @Override public void onNothingSelected(AdapterView<?> parent) {}
        });

        binding.spinnerProduct.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (position >= 0 && position < products.size()) {
                    selectedProduct = products.get(position);
                }
            }
            @Override public void onNothingSelected(AdapterView<?> parent) {}
        });
    }

    private void loadFormData() {
        // 1. Load warehouses
        api.getWarehouses().enqueue(new Callback<ApiResponse<List<Warehouse>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<Warehouse>>> call, Response<ApiResponse<List<Warehouse>>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    warehouses = response.body().data;
                    List<String> names = new ArrayList<>();
                    for (Warehouse w : warehouses) names.add(w.name);
                    if (getContext() != null) {
                        binding.spinnerWarehouse.setAdapter(new ArrayAdapter<>(getContext(),
                                android.R.layout.simple_spinner_dropdown_item, names));
                    }
                }
            }
            @Override public void onFailure(Call<ApiResponse<List<Warehouse>>> call, Throwable t) {}
        });

        // 2. Load products
        api.getProducts("").enqueue(new Callback<ApiResponse<List<Product>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<Product>>> call, Response<ApiResponse<List<Product>>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    products = response.body().data;
                    List<String> names = new ArrayList<>();
                    for (Product p : products) names.add(p.name + " (" + p.code + ")");
                    if (getContext() != null) {
                        binding.spinnerProduct.setAdapter(new ArrayAdapter<>(getContext(),
                                android.R.layout.simple_spinner_dropdown_item, names));
                    }
                    if (getArguments() != null) {
                        String scanCode = getArguments().getString("pre_selected_product_code");
                        if (scanCode != null) {
                            selectProductByCode(scanCode);
                        }
                    }
                }
            }
            @Override public void onFailure(Call<ApiResponse<List<Product>>> call, Throwable t) {}
        });
    }

    private void populateSectionsSpinner(List<Warehouse.Section> sections) {
        List<String> names = new ArrayList<>();
        if (sections != null) {
            for (Warehouse.Section s : sections) names.add(s.name);
        }
        if (getContext() != null) {
            binding.spinnerSection.setAdapter(new ArrayAdapter<>(getContext(),
                    android.R.layout.simple_spinner_dropdown_item, names));
        }
        if (sections == null || sections.isEmpty()) {
            selectedSection = null;
        }
    }

    private void submitStockOut() {
        if (selectedWarehouse == null || selectedSection == null || selectedProduct == null) {
            Toast.makeText(getContext(), "Please select warehouse, section, and product", Toast.LENGTH_SHORT).show();
            return;
        }

        String qtyStr = binding.etQuantity.getText().toString().trim();
        if (qtyStr.isEmpty()) {
            binding.tilQuantity.setError("Quantity is required");
            return;
        }

        binding.tilQuantity.setError(null);
        double quantity = Double.parseDouble(qtyStr);

        setLoading(true);

        Map<String, Object> payload = new HashMap<>();
        payload.put("warehouse_id", selectedWarehouse.id);
        payload.put("section_id", selectedSection.id);
        payload.put("product_id", selectedProduct.id);
        payload.put("quantity", quantity);

        api.logStockOut(payload).enqueue(new Callback<ApiResponse<Transaction>>() {
            @Override
            public void onResponse(Call<ApiResponse<Transaction>> call, Response<ApiResponse<Transaction>> response) {
                setLoading(false);
                if (response.isSuccessful()) {
                    Toast.makeText(getContext(), "✅ Stock Dispatched Successfully!", Toast.LENGTH_SHORT).show();
                    binding.etQuantity.setText("");
                } else {
                    Toast.makeText(getContext(), "Transaction failed (insufficient stock?)", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Transaction>> call, Throwable t) {
                setLoading(false);
                Toast.makeText(getContext(), getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void setLoading(boolean isLoading) {
        binding.btnSubmitStockOut.setEnabled(!isLoading);
        binding.progressLoading.setVisibility(isLoading ? View.VISIBLE : View.GONE);
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
