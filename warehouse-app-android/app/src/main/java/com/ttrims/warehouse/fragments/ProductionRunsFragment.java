package com.ttrims.warehouse.fragments;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.ttrims.warehouse.R;
import com.ttrims.warehouse.adapters.ProductionRunAdapter;
import com.ttrims.warehouse.api.ApiClient;
import com.ttrims.warehouse.api.ApiService;
import com.ttrims.warehouse.databinding.FragmentProductionRunsBinding;
import com.ttrims.warehouse.models.ApiResponse;
import com.ttrims.warehouse.models.ProductionRun;
import com.ttrims.warehouse.models.Recipe;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ProductionRunsFragment extends Fragment {

    private FragmentProductionRunsBinding binding;
    private ApiService api;
    private List<Recipe> recipes = new ArrayList<>();
    private List<ProductionRun> list = new ArrayList<>();
    private ProductionRunAdapter adapter;
    private Recipe selectedRecipe = null;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        binding = FragmentProductionRunsBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        api = ApiClient.getService(requireContext());

        binding.rvProductionRuns.setLayoutManager(new LinearLayoutManager(getContext()));
        adapter = new ProductionRunAdapter(getContext(), list);
        binding.rvProductionRuns.setAdapter(adapter);

        binding.btnStartProdRun.setOnClickListener(v -> triggerRun());

        loadFormInfo();
    }

    private void loadFormInfo() {
        // Load recipes for spinner
        api.getRecipes().enqueue(new Callback<ApiResponse<List<Recipe>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<Recipe>>> call, Response<ApiResponse<List<Recipe>>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    recipes = response.body().data;
                    List<String> names = new ArrayList<>();
                    for (Recipe r : recipes) names.add(r.name);
                    if (getContext() != null) {
                        binding.spinnerRunRecipe.setAdapter(new ArrayAdapter<>(getContext(),
                                android.R.layout.simple_spinner_dropdown_item, names));
                    }
                }
            }
            @Override public void onFailure(Call<ApiResponse<List<Recipe>>> call, Throwable t) {}
        });

        // Load runs list
        api.getProductionRuns().enqueue(new Callback<ApiResponse<List<ProductionRun>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<ProductionRun>>> call, Response<ApiResponse<List<ProductionRun>>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    list.clear();
                    list.addAll(response.body().data);
                    adapter.notifyDataSetChanged();
                }
            }
            @Override public void onFailure(Call<ApiResponse<List<ProductionRun>>> call, Throwable t) {}
        });
    }

    private void triggerRun() {
        int pos = binding.spinnerRunRecipe.getSelectedItemPosition();
        if (pos < 0 || pos >= recipes.size()) return;
        selectedRecipe = recipes.get(pos);

        String batchStr = binding.etBatchSize.getText().toString().trim();
        if (batchStr.isEmpty()) return;
        double batch = Double.parseDouble(batchStr);

        Map<String, Object> payload = new HashMap<>();
        payload.put("recipe_id", selectedRecipe.id);
        payload.put("quantity", batch);

        api.triggerProductionRun(payload).enqueue(new Callback<ApiResponse<ProductionRun>>() {
            @Override
            public void onResponse(Call<ApiResponse<ProductionRun>> call, Response<ApiResponse<ProductionRun>> response) {
                if (response.isSuccessful()) {
                    Toast.makeText(getContext(), "✅ Production Run Initiated!", Toast.LENGTH_SHORT).show();
                    binding.etBatchSize.setText("");
                    loadFormInfo();
                }
            }
            @Override public void onFailure(Call<ApiResponse<ProductionRun>> call, Throwable t) {}
        });
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
