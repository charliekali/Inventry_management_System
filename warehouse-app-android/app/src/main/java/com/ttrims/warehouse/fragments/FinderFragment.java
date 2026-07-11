package com.ttrims.warehouse.fragments;

import android.os.Bundle;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.ttrims.warehouse.R;
import com.ttrims.warehouse.adapters.ProductAdapter;
import com.ttrims.warehouse.api.ApiClient;
import com.ttrims.warehouse.api.ApiService;
import com.ttrims.warehouse.databinding.FragmentFinderBinding;
import com.ttrims.warehouse.models.ApiResponse;
import com.ttrims.warehouse.models.Product;

import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class FinderFragment extends Fragment {

    private FragmentFinderBinding binding;
    private ApiService api;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        binding = FragmentFinderBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        api = ApiClient.getService(requireContext());

        binding.rvSearchResults.setLayoutManager(new LinearLayoutManager(getContext()));

        binding.btnSearch.setOnClickListener(v -> executeSearch());

        binding.etSearch.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEARCH ||
                    (event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER && event.getAction() == KeyEvent.ACTION_DOWN)) {
                executeSearch();
                return true;
            }
            return false;
        });
    }

    private void executeSearch() {
        String query = binding.etSearch.getText().toString().trim();
        if (query.isEmpty()) {
            Toast.makeText(getContext(), "Enter a search query", Toast.LENGTH_SHORT).show();
            return;
        }

        setLoading(true);

        api.getProducts(query).enqueue(new Callback<ApiResponse<List<Product>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<Product>>> call, Response<ApiResponse<List<Product>>> response) {
                setLoading(false);
                if (response.isSuccessful() && response.body() != null) {
                    List<Product> results = response.body().data;
                    if (results != null && !results.isEmpty()) {
                        binding.tvNoResults.setVisibility(View.GONE);
                        binding.rvSearchResults.setVisibility(View.VISIBLE);
                        binding.rvSearchResults.setAdapter(new ProductAdapter(getContext(), results));
                    } else {
                        showNoResults("No products found matching: " + query);
                    }
                } else {
                    showNoResults("Search failed. Try again.");
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<List<Product>>> call, Throwable t) {
                setLoading(false);
                showNoResults(getString(R.string.error_network));
            }
        });
    }

    private void showNoResults(String message) {
        binding.rvSearchResults.setVisibility(View.GONE);
        binding.tvNoResults.setText(message);
        binding.tvNoResults.setVisibility(View.VISIBLE);
    }

    private void setLoading(boolean isLoading) {
        binding.btnSearch.setEnabled(!isLoading);
        binding.searchProgress.setVisibility(isLoading ? View.VISIBLE : View.GONE);
        if (isLoading) {
            binding.tvNoResults.setVisibility(View.GONE);
        }
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
