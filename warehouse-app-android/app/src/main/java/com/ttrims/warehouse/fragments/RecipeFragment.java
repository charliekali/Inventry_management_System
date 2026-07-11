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
import com.ttrims.warehouse.adapters.RecipeAdapter;
import com.ttrims.warehouse.api.ApiClient;
import com.ttrims.warehouse.api.ApiService;
import com.ttrims.warehouse.databinding.FragmentRecipesBinding;
import com.ttrims.warehouse.models.ApiResponse;
import com.ttrims.warehouse.models.Recipe;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RecipeFragment extends Fragment {

    private FragmentRecipesBinding binding;
    private ApiService api;
    private List<Recipe> list = new ArrayList<>();
    private RecipeAdapter adapter;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        binding = FragmentRecipesBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        api = ApiClient.getService(requireContext());

        binding.rvRecipes.setLayoutManager(new LinearLayoutManager(getContext()));
        adapter = new RecipeAdapter(getContext(), list);
        binding.rvRecipes.setAdapter(adapter);

        binding.btnAddRecipe.setOnClickListener(v -> showAddRecipeDialog());

        loadRecipes();
    }

    private void loadRecipes() {
        setLoading(true);
        api.getRecipes().enqueue(new Callback<ApiResponse<List<Recipe>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<Recipe>>> call, Response<ApiResponse<List<Recipe>>> response) {
                setLoading(false);
                if (response.isSuccessful() && response.body() != null) {
                    list.clear();
                    list.addAll(response.body().data);
                    adapter.notifyDataSetChanged();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<List<Recipe>>> call, Throwable t) {
                setLoading(false);
                Toast.makeText(getContext(), getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showAddRecipeDialog() {
        if (getContext() == null) return;

        AlertDialog.Builder builder = new AlertDialog.Builder(getContext());
        builder.setTitle("Create Recipe Formula");

        LinearLayout layout = new LinearLayout(getContext());
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(32, 24, 32, 24);

        final EditText etName = new EditText(getContext());
        etName.setHint("Recipe Name");
        layout.addView(etName);

        final EditText etDesc = new EditText(getContext());
        etDesc.setHint("Description details");
        layout.addView(etDesc);

        builder.setView(layout);

        builder.setPositiveButton("Create", (dialog, which) -> {
            String name = etName.getText().toString().trim();
            String desc = etDesc.getText().toString().trim();

            if (name.isEmpty()) return;

            Map<String, String> payload = new HashMap<>();
            payload.put("name", name);
            payload.put("description", desc);

            api.createRecipe(payload).enqueue(new Callback<ApiResponse<Recipe>>() {
                @Override
                public void onResponse(Call<ApiResponse<Recipe>> call, Response<ApiResponse<Recipe>> response) {
                    if (response.isSuccessful()) {
                        Toast.makeText(getContext(), "Recipe Created!", Toast.LENGTH_SHORT).show();
                        loadRecipes();
                    }
                }
                @Override public void onFailure(Call<ApiResponse<Recipe>> call, Throwable t) {}
            });
        });

        builder.setNegativeButton("Cancel", null);
        builder.show();
    }

    private void setLoading(boolean isLoading) {
        binding.recipeProgress.setVisibility(isLoading ? View.VISIBLE : View.GONE);
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
