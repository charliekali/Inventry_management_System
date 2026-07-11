package com.ttrims.ims.fragments;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentManager;

import com.ttrims.ims.R;
import com.ttrims.ims.databinding.FragmentWarehouseHostBinding;

public class WarehouseHostFragment extends Fragment {

    private FragmentWarehouseHostBinding binding;
    public static final String EXTRA_INITIAL_TAB = "initial_tab_id";

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        binding = FragmentWarehouseHostBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        binding.warehouseBottomNav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            Fragment fragment = null;

            if (id == R.id.nav_finder) {
                fragment = new FinderFragment();
            } else if (id == R.id.nav_stock_in) {
                fragment = new StockInFragment();
            } else if (id == R.id.nav_scan) {
                fragment = new ScanFragment();
            } else if (id == R.id.nav_stock_out) {
                fragment = new StockOutFragment();
            } else if (id == R.id.nav_warehouse) {
                fragment = new WarehouseFragment();
            }

            if (fragment != null) {
                switchChildFragment(fragment);
                return true;
            }
            return false;
        });

        // Resolve default initial tab (either passed as an argument or defaults to Finder)
        int initialTabId = R.id.nav_finder;
        if (getArguments() != null) {
            initialTabId = getArguments().getInt(EXTRA_INITIAL_TAB, R.id.nav_finder);
        }

        binding.warehouseBottomNav.setSelectedItemId(initialTabId);
    }

    public void switchTabWithScannedCode(int tabId, String scannedCode) {
        Fragment fragment = null;
        Bundle args = new Bundle();
        args.putString("pre_selected_product_code", scannedCode);

        if (tabId == R.id.nav_stock_in) {
            fragment = new StockInFragment();
        } else if (tabId == R.id.nav_stock_out) {
            fragment = new StockOutFragment();
        } else if (tabId == R.id.nav_finder) {
            fragment = new FinderFragment();
        }

        if (fragment != null) {
            fragment.setArguments(args);
            switchChildFragment(fragment);
            binding.warehouseBottomNav.setSelectedItemId(tabId);
        }
    }

    public void switchChildFragment(Fragment fragment) {
        getChildFragmentManager().beginTransaction()
                .replace(R.id.warehouse_child_container, fragment)
                .commit();
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
