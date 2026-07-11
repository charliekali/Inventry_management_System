package com.ttrims.driver.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.ttrims.driver.R;
import com.ttrims.driver.models.Shipment;

import java.util.List;

public class HistoryAdapter extends RecyclerView.Adapter<HistoryAdapter.ViewHolder> {

    private final Context context;
    private final List<Shipment> shipments;

    public HistoryAdapter(Context context, List<Shipment> shipments) {
        this.context = context;
        this.shipments = shipments;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context)
                .inflate(R.layout.item_history_shipment, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder h, int position) {
        Shipment s = shipments.get(position);
        h.tvShipmentNumber.setText(s.shipmentNumber != null ? s.shipmentNumber : "—");
        h.tvStops.setText((s.orders != null ? s.orders.size() : 0) + " stops");
        h.tvStatus.setText(s.status != null ? s.status : "—");

        if ("DELIVERED".equals(s.status)) {
            h.tvStatus.setTextColor(context.getColor(R.color.color_success));
        } else {
            h.tvStatus.setTextColor(context.getColor(R.color.color_danger));
        }

        h.tvDeliveredAt.setText(s.deliveredAt != null
                ? "Completed: " + s.deliveredAt.substring(0, Math.min(10, s.deliveredAt.length()))
                : "—");
    }

    @Override
    public int getItemCount() { return shipments.size(); }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvShipmentNumber, tvStops, tvStatus, tvDeliveredAt;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvShipmentNumber = itemView.findViewById(R.id.tv_history_number);
            tvStops          = itemView.findViewById(R.id.tv_history_stops);
            tvStatus         = itemView.findViewById(R.id.tv_history_status);
            tvDeliveredAt    = itemView.findViewById(R.id.tv_history_date);
        }
    }
}
