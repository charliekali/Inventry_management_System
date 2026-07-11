package com.ttrims.ims.adapters;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.ttrims.ims.R;
import com.ttrims.ims.api.ApiClient;
import com.ttrims.ims.api.ApiService;
import com.ttrims.ims.models.ApiResponse;
import com.ttrims.ims.models.Shipment;
import com.ttrims.ims.models.ShipmentStop;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ShipmentAdapter extends RecyclerView.Adapter<ShipmentAdapter.ViewHolder> {

    private final Context context;
    private final List<Shipment> shipments;
    private final Runnable onStopConfirmed;

    public ShipmentAdapter(Context context, List<Shipment> shipments, Runnable onStopConfirmed) {
        this.context = context;
        this.shipments = shipments;
        this.onStopConfirmed = onStopConfirmed;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_shipment, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder h, int position) {
        Shipment s = shipments.get(position);

        h.tvShipmentNumber.setText(s.shipmentNumber != null ? s.shipmentNumber : "—");
        h.tvVehicle.setText(s.vehicleNumber != null ? s.vehicleNumber : "—");
        h.tvStopsSummary.setText(
                (s.orders != null ? s.orders.size() : 0) + " stops");
        h.tvDistance.setText(s.distanceKm != null
                ? String.format("%.1f km", s.distanceKm) : "— km");

        // Status badge
        h.badgeStatus.setText(s.status != null ? s.status : "—");
        applyStatusBadge(h.badgeStatus, s.status);

        // Start trip button (only for CREATED)
        if ("CREATED".equals(s.status)) {
            h.btnStartTrip.setVisibility(View.VISIBLE);
            h.btnStartTrip.setOnClickListener(v -> startTrip(s, h));
        } else {
            h.btnStartTrip.setVisibility(View.GONE);
        }

        // Toggle stops
        h.stopsContainer.setVisibility(View.GONE);
        h.tvToggleArrow.setText("▼");

        h.btnToggleStops.setOnClickListener(v -> {
            boolean expanded = h.stopsContainer.getVisibility() == View.VISIBLE;
            if (expanded) {
                h.stopsContainer.setVisibility(View.GONE);
                h.tvToggleArrow.setText("▼");
            } else {
                h.stopsContainer.setVisibility(View.VISIBLE);
                h.tvToggleArrow.setText("▲");
                populateStops(s, h);
            }
        });
    }

    private void startTrip(Shipment s, ViewHolder h) {
        h.btnStartTrip.setEnabled(false);
        h.btnStartTrip.setText("Starting…");

        Map<String, String> body = new HashMap<>();
        body.put("status", "EN_ROUTE");

        ApiClient.getService(context).updateShipmentStatus(s.id, body)
                .enqueue(new Callback<ApiResponse<Shipment>>() {
                    @Override
                    public void onResponse(Call<ApiResponse<Shipment>> call,
                                           Response<ApiResponse<Shipment>> response) {
                        if (response.isSuccessful()) {
                            Toast.makeText(context, "🚀 Trip started!", Toast.LENGTH_SHORT).show();
                            if (onStopConfirmed != null) onStopConfirmed.run();
                        } else {
                            Toast.makeText(context, "Failed to start trip", Toast.LENGTH_SHORT).show();
                            h.btnStartTrip.setEnabled(true);
                            h.btnStartTrip.setText("Start Delivery Route");
                        }
                    }

                    @Override
                    public void onFailure(Call<ApiResponse<Shipment>> call, Throwable t) {
                        Toast.makeText(context, "Network error", Toast.LENGTH_SHORT).show();
                        h.btnStartTrip.setEnabled(true);
                        h.btnStartTrip.setText("Start Delivery Route");
                    }
                });
    }

    private void populateStops(Shipment s, ViewHolder h) {
        h.stopsContainer.removeAllViews();
        if (s.orders == null || s.orders.isEmpty()) {
            addEmptyStop(h.stopsContainer, "No stops in this shipment.");
            return;
        }

        boolean isEnRoute = "EN_ROUTE".equals(s.status);

        for (int i = 0; i < s.orders.size(); i++) {
            ShipmentStop stop = s.orders.get(i);
            View stopView = LayoutInflater.from(context)
                    .inflate(R.layout.item_stop, h.stopsContainer, false);

            TextView tvStopNum = stopView.findViewById(R.id.tv_stop_number);
            TextView tvCustomer = stopView.findViewById(R.id.tv_stop_customer);
            TextView tvAddress = stopView.findViewById(R.id.tv_stop_address);
            TextView badgeStopStatus = stopView.findViewById(R.id.badge_stop_status);
            LinearLayout stopActions = stopView.findViewById(R.id.stop_actions);
            MaterialButton btnNavigate = stopView.findViewById(R.id.btn_navigate_stop);
            MaterialButton btnConfirm = stopView.findViewById(R.id.btn_confirm_stop);

            tvStopNum.setText("Stop #" + (i + 1) + ": " + stop.orderNumber);
            tvCustomer.setText("Customer: " + (stop.customer != null ? stop.customer : "—"));
            tvAddress.setText("Address: " + (stop.deliveryAddress != null ? stop.deliveryAddress : "—"));
            badgeStopStatus.setText(stop.stopStatus != null ? stop.stopStatus : "PENDING");
            applyStopStatusBadge(badgeStopStatus, stop.stopStatus);

            if (isEnRoute && stop.isPending()) {
                stopActions.setVisibility(View.VISIBLE);

                btnNavigate.setOnClickListener(v -> {
                    if (stop.latitude != null && stop.longitude != null) {
                        Uri uri = Uri.parse("google.navigation:q=" + stop.latitude + "," + stop.longitude);
                        Intent mapIntent = new Intent(Intent.ACTION_VIEW, uri);
                        mapIntent.setPackage("com.google.android.apps.maps");
                        if (mapIntent.resolveActivity(context.getPackageManager()) != null) {
                            context.startActivity(mapIntent);
                        } else {
                            // Fallback to browser Maps
                            Uri webUri = Uri.parse("https://maps.google.com/?q=" +
                                    stop.latitude + "," + stop.longitude);
                            context.startActivity(new Intent(Intent.ACTION_VIEW, webUri));
                        }
                    } else if (stop.deliveryAddress != null) {
                        Uri uri = Uri.parse("geo:0,0?q=" + Uri.encode(stop.deliveryAddress));
                        context.startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    }
                });

                btnConfirm.setOnClickListener(v -> {
                    openPodScreen(s, stop);
                });
            } else {
                stopActions.setVisibility(View.GONE);
            }

            h.stopsContainer.addView(stopView);
        }
    }

    private void openPodScreen(Shipment shipment, ShipmentStop stop) {
        // Navigate to POD fragment via the activity's fragment manager
        if (context instanceof androidx.fragment.app.FragmentActivity) {
            androidx.fragment.app.FragmentActivity activity =
                    (androidx.fragment.app.FragmentActivity) context;

            com.ttrims.ims.fragments.PodConfirmFragment podFragment =
                    com.ttrims.ims.fragments.PodConfirmFragment.newInstance(
                            shipment.id, stop.stopId, stop.orderNumber, onStopConfirmed);

            activity.getSupportFragmentManager().beginTransaction()
                    .setCustomAnimations(android.R.anim.slide_in_left, android.R.anim.slide_out_right)
                    .add(com.ttrims.ims.R.id.fragment_container, podFragment, "pod")
                    .addToBackStack("pod")
                    .commit();
        }
    }

    private void addEmptyStop(LinearLayout container, String msg) {
        TextView tv = new TextView(context);
        tv.setText(msg);
        tv.setTextColor(context.getColor(R.color.text_muted));
        tv.setTextSize(12);
        container.addView(tv);
    }

    private void applyStatusBadge(TextView badge, String status) {
        if (status == null) return;
        switch (status) {
            case "EN_ROUTE":
                badge.setTextColor(context.getColor(R.color.badge_en_route_text));
                break;
            case "DELIVERED":
                badge.setTextColor(context.getColor(R.color.badge_delivered_text));
                break;
            case "FAILED":
                badge.setTextColor(context.getColor(R.color.badge_failed_text));
                break;
            default:
                badge.setTextColor(context.getColor(R.color.badge_created_text));
        }
    }

    private void applyStopStatusBadge(TextView badge, String status) {
        if ("DELIVERED".equals(status)) {
            badge.setTextColor(context.getColor(R.color.color_success));
        } else if ("FAILED".equals(status)) {
            badge.setTextColor(context.getColor(R.color.color_danger));
        } else {
            badge.setTextColor(context.getColor(R.color.text_secondary));
        }
    }

    @Override
    public int getItemCount() { return shipments.size(); }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvShipmentNumber, tvVehicle, tvDistance, tvStopsSummary;
        TextView badgeStatus, tvToggleLabel, tvToggleArrow;
        LinearLayout btnToggleStops, stopsContainer;
        MaterialButton btnStartTrip;

        ViewHolder(View view) {
            super(view);
            tvShipmentNumber = view.findViewById(R.id.tv_shipment_number);
            tvVehicle        = view.findViewById(R.id.tv_vehicle);
            tvDistance       = view.findViewById(R.id.tv_distance);
            tvStopsSummary   = view.findViewById(R.id.tv_stops_summary);
            badgeStatus      = view.findViewById(R.id.badge_shipment_status);
            tvToggleLabel    = view.findViewById(R.id.tv_toggle_label);
            tvToggleArrow    = view.findViewById(R.id.tv_toggle_arrow);
            btnToggleStops   = view.findViewById(R.id.btn_toggle_stops);
            stopsContainer   = view.findViewById(R.id.stops_container);
            btnStartTrip     = view.findViewById(R.id.btn_start_trip);
        }
    }
}
