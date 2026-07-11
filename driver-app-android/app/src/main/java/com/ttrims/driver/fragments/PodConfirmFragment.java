package com.ttrims.driver.fragments;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.ttrims.driver.R;
import com.ttrims.driver.api.ApiClient;
import com.ttrims.driver.api.ApiService;
import com.ttrims.driver.databinding.FragmentPodConfirmBinding;
import com.ttrims.driver.models.ApiResponse;
import com.ttrims.driver.models.Shipment;

import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * PodConfirmFragment — Proof of Delivery screen.
 *
 * Opens as a full-screen fragment (pushed onto back stack by ShipmentAdapter).
 * Collects: outcome, receiver name/phone, signature (SignatureView), photo (camera),
 * failure reason, notes — then PATCHes /shipments/{id}/stop/{stopId}.
 */
public class PodConfirmFragment extends Fragment {

    private static final String ARG_SHIPMENT_ID = "shipment_id";
    private static final String ARG_STOP_ID     = "stop_id";
    private static final String ARG_ORDER_NUM   = "order_num";

    private static final int REQ_CAMERA = 2001;

    private FragmentPodConfirmBinding binding;
    private String shipmentId, stopId, orderNum;
    private Runnable onDone;
    private String photoBase64 = null;

    private static final String[] OUTCOMES = {"DELIVERED", "FAILED"};
    private static final String[] FAILURE_REASONS = {
            "Customer Not Available",
            "Wrong Address",
            "Customer Refused / Rejected",
            "Payment Issue (COD)",
            "Vehicle / Logistics Issue",
            "Other Reason"
    };

    public static PodConfirmFragment newInstance(String shipmentId, String stopId,
                                                 String orderNum, Runnable onDone) {
        PodConfirmFragment f = new PodConfirmFragment();
        Bundle args = new Bundle();
        args.putString(ARG_SHIPMENT_ID, shipmentId);
        args.putString(ARG_STOP_ID, stopId);
        args.putString(ARG_ORDER_NUM, orderNum);
        f.setArguments(args);
        f.onDone = onDone;
        return f;
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        binding = FragmentPodConfirmBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        if (getArguments() != null) {
            shipmentId = getArguments().getString(ARG_SHIPMENT_ID);
            stopId     = getArguments().getString(ARG_STOP_ID);
            orderNum   = getArguments().getString(ARG_ORDER_NUM);
        }

        binding.podTitle.setText("Confirm: " + (orderNum != null ? orderNum : "Stop"));

        // Outcome spinner
        ArrayAdapter<String> outcomeAdapter = new ArrayAdapter<>(requireContext(),
                android.R.layout.simple_spinner_item,
                new String[]{"Delivered Successfully", "Failed / Rejected"});
        outcomeAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        binding.spinnerOutcome.setAdapter(outcomeAdapter);

        // Failure reason spinner
        ArrayAdapter<String> reasonAdapter = new ArrayAdapter<>(requireContext(),
                android.R.layout.simple_spinner_item, FAILURE_REASONS);
        reasonAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        binding.spinnerFailedReason.setAdapter(reasonAdapter);

        // Show/hide fields based on outcome
        binding.spinnerOutcome.setOnItemSelectedListener(
                new android.widget.AdapterView.OnItemSelectedListener() {
                    @Override
                    public void onItemSelected(android.widget.AdapterView<?> p, View v,
                                               int pos, long id) {
                        if (pos == 0) { // DELIVERED
                            binding.layoutDeliveredFields.setVisibility(View.VISIBLE);
                            binding.layoutFailedFields.setVisibility(View.GONE);
                        } else { // FAILED
                            binding.layoutDeliveredFields.setVisibility(View.GONE);
                            binding.layoutFailedFields.setVisibility(View.VISIBLE);
                        }
                    }
                    @Override public void onNothingSelected(android.widget.AdapterView<?> p) {}
                });

        // Clear signature
        binding.btnClearSignature.setOnClickListener(v -> binding.signatureView.clear());

        // Capture photo
        binding.btnCapturePhoto.setOnClickListener(v -> {
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            try { startActivityForResult(intent, REQ_CAMERA); }
            catch (ActivityNotFoundException e) {
                Toast.makeText(getContext(), "Camera not available", Toast.LENGTH_SHORT).show();
            }
        });

        // Cancel
        binding.btnPodCancel.setOnClickListener(v ->
                requireActivity().getSupportFragmentManager().popBackStack());

        // Submit
        binding.btnPodSubmit.setOnClickListener(v -> submitPod());
    }

    @Override
    public void onActivityResult(int req, int resultCode, @Nullable Intent data) {
        super.onActivityResult(req, resultCode, data);
        if (req == REQ_CAMERA && resultCode == android.app.Activity.RESULT_OK && data != null) {
            Bitmap bmp = (Bitmap) data.getExtras().get("data");
            if (bmp != null) {
                binding.ivPhotoPreview.setImageBitmap(bmp);
                binding.ivPhotoPreview.setVisibility(View.VISIBLE);
                binding.tvPhotoStatus.setText("✓ Photo captured");

                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                bmp.compress(Bitmap.CompressFormat.JPEG, 80, baos);
                photoBase64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
            }
        }
    }

    private void submitPod() {
        int outcomeIdx = binding.spinnerOutcome.getSelectedItemPosition();
        String outcome = OUTCOMES[outcomeIdx]; // DELIVERED or FAILED

        // Validate signature for DELIVERED
        if ("DELIVERED".equals(outcome) && binding.signatureView.isEmpty()) {
            Toast.makeText(getContext(),
                    getString(R.string.pod_error_signature), Toast.LENGTH_LONG).show();
            return;
        }

        binding.btnPodSubmit.setEnabled(false);
        binding.podProgress.setVisibility(View.VISIBLE);

        Map<String, Object> body = new HashMap<>();
        body.put("stop_status", outcome);
        body.put("notes", safeText(binding.etNotes));

        if ("DELIVERED".equals(outcome)) {
            body.put("receiver_name",   safeText(binding.etReceiverName));
            body.put("receiver_mobile", safeText(binding.etReceiverMobile));
            String sig = binding.signatureView.toBase64();
            if (sig != null) body.put("signature", sig);
            if (photoBase64 != null) body.put("photo", photoBase64);
        } else {
            String reason = FAILURE_REASONS[binding.spinnerFailedReason.getSelectedItemPosition()];
            body.put("failed_reason", reason);
        }

        ApiClient.getService(requireContext())
                .updateStopStatus(shipmentId, stopId, body)
                .enqueue(new Callback<ApiResponse<Shipment>>() {
                    @Override
                    public void onResponse(Call<ApiResponse<Shipment>> call,
                                           Response<ApiResponse<Shipment>> response) {
                        if (binding == null) return;
                        binding.podProgress.setVisibility(View.GONE);
                        binding.btnPodSubmit.setEnabled(true);

                        if (response.isSuccessful()) {
                            String msg = "DELIVERED".equals(outcome)
                                    ? "✅ Delivery confirmed!" : "📋 Stop recorded.";
                            Toast.makeText(getContext(), msg, Toast.LENGTH_SHORT).show();
                            requireActivity().getSupportFragmentManager().popBackStack();
                            if (onDone != null) onDone.run();
                        } else {
                            Toast.makeText(getContext(), "Submission failed. Try again.",
                                    Toast.LENGTH_SHORT).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<ApiResponse<Shipment>> call, Throwable t) {
                        if (binding == null) return;
                        binding.podProgress.setVisibility(View.GONE);
                        binding.btnPodSubmit.setEnabled(true);
                        Toast.makeText(getContext(), getString(R.string.error_network),
                                Toast.LENGTH_SHORT).show();
                    }
                });
    }

    private String safeText(com.google.android.material.textfield.TextInputEditText et) {
        return et.getText() != null ? et.getText().toString().trim() : "";
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
