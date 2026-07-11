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

import com.ttrims.ims.R;
import com.ttrims.ims.adapters.RoleAdapter;
import com.ttrims.ims.api.ApiClient;
import com.ttrims.ims.api.ApiService;
import com.ttrims.ims.databinding.FragmentRolesBinding;
import com.ttrims.ims.models.ApiResponse;
import com.ttrims.ims.models.Role;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RoleFragment extends Fragment {

    private FragmentRolesBinding binding;
    private ApiService api;
    private List<Role> list = new ArrayList<>();
    private RoleAdapter adapter;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        binding = FragmentRolesBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        api = ApiClient.getService(requireContext());

        binding.rvRoles.setLayoutManager(new LinearLayoutManager(getContext()));
        adapter = new RoleAdapter(getContext(), list);
        binding.rvRoles.setAdapter(adapter);

        loadRoles();
    }

    private void loadRoles() {
        setLoading(true);
        api.getRoles().enqueue(new Callback<ApiResponse<List<Role>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<Role>>> call, Response<ApiResponse<List<Role>>> response) {
                setLoading(false);
                if (response.isSuccessful() && response.body() != null) {
                    list.clear();
                    list.addAll(response.body().data);
                    adapter.notifyDataSetChanged();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<List<Role>>> call, Throwable t) {
                setLoading(false);
                Toast.makeText(getContext(), getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void setLoading(boolean isLoading) {
        binding.roleProgress.setVisibility(isLoading ? View.VISIBLE : View.GONE);
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
