package com.ttrims.ims.fragments;

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

import com.google.android.material.tabs.TabLayout;
import com.ttrims.ims.R;
import com.ttrims.ims.adapters.KeyRegistryAdapter;
import com.ttrims.ims.api.ApiClient;
import com.ttrims.ims.api.ApiService;
import com.ttrims.ims.databinding.FragmentKeyRegistryBinding;
import com.ttrims.ims.models.ApiResponse;
import com.ttrims.ims.models.KeyItem;
import com.ttrims.ims.models.KeyLogItem;
import com.ttrims.ims.models.User;
import com.ttrims.ims.utils.SessionManager;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class KeyRegistryFragment extends Fragment implements KeyRegistryAdapter.OnKeyActionListener {

    private FragmentKeyRegistryBinding binding;
    private ApiService api;
    private User currentUser;
    private boolean isAdmin = false;

    private final List<Object> listItems = new ArrayList<>();
    private KeyRegistryAdapter adapter;
    private int currentTabPosition = 0; // 0 = Approvals (if Admin) or Keys, etc.

    // Tab names mapping
    private final List<String> tabTitles = new ArrayList<>();

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        binding = FragmentKeyRegistryBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        api = ApiClient.getService(requireContext());

        currentUser = SessionManager.getInstance(requireContext()).getUser();
        if (currentUser != null) {
            String role = currentUser.getRoleName();
            String category = currentUser.roleCategory;
            isAdmin = "Super Admin".equalsIgnoreCase(role) || "Super Admin".equalsIgnoreCase(category);
        }

        setupTabs();

        binding.rvKeyRegistry.setLayoutManager(new LinearLayoutManager(getContext()));
        adapter = new KeyRegistryAdapter(getContext(), listItems, currentUser != null ? currentUser.id : null, this);
        binding.rvKeyRegistry.setAdapter(adapter);

        binding.swipeRefresh.setOnRefreshListener(this::loadActiveTabData);
        binding.keyTabs.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
            @Override
            public void onTabSelected(TabLayout.Tab tab) {
                currentTabPosition = tab.getPosition();
                loadActiveTabData();
            }
            @Override public void onTabUnselected(TabLayout.Tab tab) {}
            @Override public void onTabReselected(TabLayout.Tab tab) {}
        });

        loadActiveTabData();
    }

    private void setupTabs() {
        binding.keyTabs.removeAllTabs();
        tabTitles.clear();

        if (isAdmin) {
            tabTitles.add("Approvals");
            tabTitles.add("Keys Catalogue");
            tabTitles.add("Active Logs");
            tabTitles.add("My Logs");
        } else {
            tabTitles.add("Keys Catalogue");
            tabTitles.add("Active Logs");
            tabTitles.add("My Logs");
        }

        for (String title : tabTitles) {
            binding.keyTabs.addTab(binding.keyTabs.newTab().setText(title));
        }
    }

    private void loadActiveTabData() {
        setLoading(true);
        String selectedTitle = tabTitles.get(currentTabPosition);

        if ("Approvals".equalsIgnoreCase(selectedTitle)) {
            fetchPendingRequests();
        } else if ("Keys Catalogue".equalsIgnoreCase(selectedTitle)) {
            fetchKeyCatalog();
        } else if ("Active Logs".equalsIgnoreCase(selectedTitle)) {
            fetchActiveLogs();
        } else if ("My Logs".equalsIgnoreCase(selectedTitle)) {
            fetchMyLogs();
        }
    }

    private void fetchPendingRequests() {
        api.getPendingRequests().enqueue(new Callback<ApiResponse<List<KeyLogItem>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<KeyLogItem>>> call, Response<ApiResponse<List<KeyLogItem>>> response) {
                setLoading(false);
                if (response.isSuccessful() && response.body() != null) {
                    listItems.clear();
                    listItems.addAll(response.body().data);
                    adapter.notifyDataSetChanged();
                    toggleEmptyView(listItems.isEmpty());
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<List<KeyLogItem>>> call, Throwable t) {
                showError();
            }
        });
    }

    private void fetchKeyCatalog() {
        api.getKeyCatalog().enqueue(new Callback<ApiResponse<List<KeyItem>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<KeyItem>>> call, Response<ApiResponse<List<KeyItem>>> response) {
                setLoading(false);
                if (response.isSuccessful() && response.body() != null) {
                    listItems.clear();
                    listItems.addAll(response.body().data);
                    adapter.notifyDataSetChanged();
                    toggleEmptyView(listItems.isEmpty());
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<List<KeyItem>>> call, Throwable t) {
                showError();
            }
        });
    }

    private void fetchActiveLogs() {
        api.getActiveLogs().enqueue(new Callback<ApiResponse<List<KeyLogItem>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<KeyLogItem>>> call, Response<ApiResponse<List<KeyLogItem>>> response) {
                setLoading(false);
                if (response.isSuccessful() && response.body() != null) {
                    listItems.clear();
                    listItems.addAll(response.body().data);
                    adapter.notifyDataSetChanged();
                    toggleEmptyView(listItems.isEmpty());
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<List<KeyLogItem>>> call, Throwable t) {
                showError();
            }
        });
    }

    private void fetchMyLogs() {
        api.getMyLogs().enqueue(new Callback<ApiResponse<List<KeyLogItem>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<KeyLogItem>>> call, Response<ApiResponse<List<KeyLogItem>>> response) {
                setLoading(false);
                if (response.isSuccessful() && response.body() != null) {
                    listItems.clear();
                    listItems.addAll(response.body().data);
                    adapter.notifyDataSetChanged();
                    toggleEmptyView(listItems.isEmpty());
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<List<KeyLogItem>>> call, Throwable t) {
                showError();
            }
        });
    }

    // ── OnKeyActionListener Interface Callbacks ──

    @Override
    public void onCheckoutRequest(KeyItem item) {
        if (getContext() == null) return;

        AlertDialog.Builder builder = new AlertDialog.Builder(getContext());
        builder.setTitle("Request Checkout: " + item.name);

        final EditText etReason = new EditText(getContext());
        etReason.setHint("Enter checkout reason (e.g. rack count)");
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        etReason.setLayoutParams(lp);

        LinearLayout layout = new LinearLayout(getContext());
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(48, 24, 48, 24);
        layout.addView(etReason);
        builder.setView(layout);

        builder.setPositiveButton("Submit", (dialog, which) -> {
            String reason = etReason.getText().toString().trim();
            if (reason.isEmpty()) {
                Toast.makeText(getContext(), "Reason is required", Toast.LENGTH_SHORT).show();
                return;
            }
            submitCheckout(item.id, reason);
        });

        builder.setNegativeButton("Cancel", null);
        builder.show();
    }

    private void submitCheckout(String keyId, String reason) {
        setLoading(true);
        Map<String, String> payload = new HashMap<>();
        payload.put("key_id", keyId);
        payload.put("reason", reason);

        api.requestCheckout(payload).enqueue(new Callback<ApiResponse<KeyLogItem>>() {
            @Override
            public void onResponse(Call<ApiResponse<KeyLogItem>> call, Response<ApiResponse<KeyLogItem>> response) {
                if (response.isSuccessful()) {
                    Toast.makeText(getContext(), isAdmin ? "Key checkout logged!" : "Checkout request submitted!", Toast.LENGTH_SHORT).show();
                    loadActiveTabData();
                } else {
                    setLoading(false);
                    Toast.makeText(getContext(), "Request failed", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<KeyLogItem>> call, Throwable t) {
                setLoading(false);
                Toast.makeText(getContext(), "Network error", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public void onReturnRequest(KeyLogItem log) {
        if (getContext() == null) return;

        AlertDialog.Builder builder = new AlertDialog.Builder(getContext());
        builder.setTitle("Return Key: " + log.keyName);

        final EditText etNotes = new EditText(getContext());
        etNotes.setHint("Enter return notes (optional)");
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        etNotes.setLayoutParams(lp);

        LinearLayout layout = new LinearLayout(getContext());
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(48, 24, 48, 24);
        layout.addView(etNotes);
        builder.setView(layout);

        builder.setPositiveButton("Return", (dialog, which) -> {
            String notes = etNotes.getText().toString().trim();
            submitReturn(log.id, notes);
        });

        builder.setNegativeButton("Cancel", null);
        builder.show();
    }

    private void submitReturn(String logId, String notes) {
        setLoading(true);
        Map<String, String> payload = new HashMap<>();
        payload.put("return_notes", notes);

        api.requestReturn(logId, payload).enqueue(new Callback<ApiResponse<KeyLogItem>>() {
            @Override
            public void onResponse(Call<ApiResponse<KeyLogItem>> call, Response<ApiResponse<KeyLogItem>> response) {
                if (response.isSuccessful()) {
                    Toast.makeText(getContext(), isAdmin ? "Key returned successfully!" : "Return request submitted!", Toast.LENGTH_SHORT).show();
                    loadActiveTabData();
                } else {
                    setLoading(false);
                    Toast.makeText(getContext(), "Request failed", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<KeyLogItem>> call, Throwable t) {
                setLoading(false);
                Toast.makeText(getContext(), "Network error", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public void onApproveRequest(KeyLogItem log) {
        setLoading(true);
        api.approveKeyRequest(log.id).enqueue(new Callback<ApiResponse<KeyLogItem>>() {
            @Override
            public void onResponse(Call<ApiResponse<KeyLogItem>> call, Response<ApiResponse<KeyLogItem>> response) {
                if (response.isSuccessful()) {
                    Toast.makeText(getContext(), "Request approved!", Toast.LENGTH_SHORT).show();
                    loadActiveTabData();
                } else {
                    setLoading(false);
                    Toast.makeText(getContext(), "Failed to approve", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<KeyLogItem>> call, Throwable t) {
                setLoading(false);
                Toast.makeText(getContext(), "Network error", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public void onRejectRequest(KeyLogItem log) {
        setLoading(true);
        api.rejectKeyRequest(log.id).enqueue(new Callback<ApiResponse<KeyLogItem>>() {
            @Override
            public void onResponse(Call<ApiResponse<KeyLogItem>> call, Response<ApiResponse<KeyLogItem>> response) {
                if (response.isSuccessful()) {
                    Toast.makeText(getContext(), "Request rejected!", Toast.LENGTH_SHORT).show();
                    loadActiveTabData();
                } else {
                    setLoading(false);
                    Toast.makeText(getContext(), "Failed to reject", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<KeyLogItem>> call, Throwable t) {
                setLoading(false);
                Toast.makeText(getContext(), "Network error", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void setLoading(boolean isLoading) {
        if (binding == null) return;
        binding.swipeRefresh.setRefreshing(false);
        binding.progressLoading.setVisibility(isLoading ? View.VISIBLE : View.GONE);
    }

    private void toggleEmptyView(boolean show) {
        if (binding == null) return;
        binding.tvEmptyView.setVisibility(show ? View.VISIBLE : View.GONE);
    }

    private void showError() {
        setLoading(false);
        toggleEmptyView(true);
        Toast.makeText(getContext(), getString(R.string.error_network), Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
