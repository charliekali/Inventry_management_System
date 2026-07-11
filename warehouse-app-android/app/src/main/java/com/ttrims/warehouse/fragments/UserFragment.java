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
import com.ttrims.warehouse.adapters.UserAdapter;
import com.ttrims.warehouse.api.ApiClient;
import com.ttrims.warehouse.api.ApiService;
import com.ttrims.warehouse.databinding.FragmentUsersBinding;
import com.ttrims.warehouse.models.ApiResponse;
import com.ttrims.warehouse.models.User;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class UserFragment extends Fragment {

    private FragmentUsersBinding binding;
    private ApiService api;
    private List<User> list = new ArrayList<>();
    private UserAdapter adapter;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        binding = FragmentUsersBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        api = ApiClient.getService(requireContext());

        binding.rvUsers.setLayoutManager(new LinearLayoutManager(getContext()));
        adapter = new UserAdapter(getContext(), list);
        binding.rvUsers.setAdapter(adapter);

        binding.btnAddUser.setOnClickListener(v -> showAddUserDialog());

        loadUsers();
    }

    private void loadUsers() {
        setLoading(true);
        api.getUsers().enqueue(new Callback<ApiResponse<List<User>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<User>>> call, Response<ApiResponse<List<User>>> response) {
                setLoading(false);
                if (response.isSuccessful() && response.body() != null) {
                    list.clear();
                    list.addAll(response.body().data);
                    adapter.notifyDataSetChanged();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<List<User>>> call, Throwable t) {
                setLoading(false);
                Toast.makeText(getContext(), getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showAddUserDialog() {
        if (getContext() == null) return;

        AlertDialog.Builder builder = new AlertDialog.Builder(getContext());
        builder.setTitle("Add New Staff Account");

        LinearLayout layout = new LinearLayout(getContext());
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(32, 24, 32, 24);

        final EditText etName = new EditText(getContext());
        etName.setHint("Staff Name");
        layout.addView(etName);

        final EditText etEmail = new EditText(getContext());
        etEmail.setHint("Staff Email");
        layout.addView(etEmail);

        builder.setView(layout);

        builder.setPositiveButton("Create Account", (dialog, which) -> {
            String name = etName.getText().toString().trim();
            String email = etEmail.getText().toString().trim();

            if (name.isEmpty() || email.isEmpty()) return;

            Map<String, String> payload = new HashMap<>();
            payload.put("name", name);
            payload.put("email", email);

            api.createUser(payload).enqueue(new Callback<ApiResponse<User>>() {
                @Override
                public void onResponse(Call<ApiResponse<User>> call, Response<ApiResponse<User>> response) {
                    if (response.isSuccessful()) {
                        Toast.makeText(getContext(), "Account created successfully!", Toast.LENGTH_SHORT).show();
                        loadUsers();
                    }
                }
                @Override public void onFailure(Call<ApiResponse<User>> call, Throwable t) {}
            });
        });

        builder.setNegativeButton("Cancel", null);
        builder.show();
    }

    private void setLoading(boolean isLoading) {
        binding.userProgress.setVisibility(isLoading ? View.VISIBLE : View.GONE);
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
