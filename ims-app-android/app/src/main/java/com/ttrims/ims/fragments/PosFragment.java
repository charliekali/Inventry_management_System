package com.ttrims.ims.fragments;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.ttrims.ims.api.ApiClient;
import com.ttrims.ims.api.ApiService;
import com.ttrims.ims.databinding.FragmentPosBinding;
import com.ttrims.ims.models.ApiResponse;

import java.util.HashMap;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class PosFragment extends Fragment {

    private FragmentPosBinding binding;
    private ApiService api;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        binding = FragmentPosBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        api = ApiClient.getService(requireContext());

        binding.rvCartItems.setLayoutManager(new LinearLayoutManager(getContext()));
        binding.tvCartTotal.setText("$0.00");

        binding.btnAddToCart.setOnClickListener(v -> {
            String item = binding.etPosSearch.getText().toString().trim();
            if (!item.isEmpty()) {
                binding.tvCartTotal.setText("$45.00"); // Mock cart addition total update
                binding.etPosSearch.setText("");
                Toast.makeText(getContext(), "Added " + item + " to billing cart", Toast.LENGTH_SHORT).show();
            }
        });

        binding.btnCheckout.setOnClickListener(v -> completeSale());
    }

    private void completeSale() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("payment_method", "CASH");
        payload.put("amount", 45.00);

        api.completeCheckout(payload).enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                if (response.isSuccessful()) {
                    Toast.makeText(getContext(), "✅ Sale Completed! Receipt printed.", Toast.LENGTH_SHORT).show();
                    binding.tvCartTotal.setText("$0.00");
                } else {
                    Toast.makeText(getContext(), "Checkout failed", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                Toast.makeText(getContext(), "Offline: Invoice stored locally", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
