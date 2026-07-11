package com.ttrims.ims.fragments;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.Fragment;

import com.ttrims.ims.R;
import com.ttrims.ims.databinding.FragmentScanBinding;

public class ScanFragment extends Fragment {

    private FragmentScanBinding binding;

    private final androidx.activity.result.ActivityResultLauncher<com.journeyapps.barcodescanner.ScanOptions> barcodeLauncher = 
        registerForActivityResult(new com.journeyapps.barcodescanner.ScanContract(), result -> {
            if (result.getContents() != null) {
                String scannedCode = result.getContents();
                showActionSelectionDialog(scannedCode);
            }
        });

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        binding = FragmentScanBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        binding.btnTriggerScanner.setOnClickListener(v -> launchScanner());

        // Automatically launch camera scanner on tab select
        launchScanner();
    }

    private void launchScanner() {
        com.journeyapps.barcodescanner.ScanOptions options = new com.journeyapps.barcodescanner.ScanOptions();
        options.setPrompt("Scan Product QR/Barcode");
        options.setBeepEnabled(true);
        options.setOrientationLocked(false);
        barcodeLauncher.launch(options);
    }

    private void showActionSelectionDialog(String code) {
        if (getContext() == null) return;

        AlertDialog.Builder builder = new AlertDialog.Builder(getContext());
        builder.setTitle("Select Action for Scanned Item");
        builder.setMessage("Scanned Code: " + code + "\n\nChoose what operation you want to perform with this product.");

        builder.setPositiveButton("Stock IN", (dialog, which) -> {
            navigateToWarehouseTab(R.id.nav_stock_in, code);
        });

        builder.setNegativeButton("Stock OUT", (dialog, which) -> {
            navigateToWarehouseTab(R.id.nav_stock_out, code);
        });

        builder.setNeutralButton("Finder", (dialog, which) -> {
            navigateToWarehouseTab(R.id.nav_finder, code);
        });

        builder.setCancelable(true);
        builder.show();
    }

    private void navigateToWarehouseTab(int tabId, String code) {
        if (getParentFragment() instanceof WarehouseHostFragment) {
            ((WarehouseHostFragment) getParentFragment()).switchTabWithScannedCode(tabId, code);
        } else {
            Toast.makeText(getContext(), "Navigation error", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
