package com.ttrims.ims.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.ttrims.ims.R;
import com.ttrims.ims.models.KeyItem;
import com.ttrims.ims.models.KeyLogItem;

import java.util.List;

public class KeyRegistryAdapter extends RecyclerView.Adapter<KeyRegistryAdapter.ViewHolder> {

    private final List<Object> list;
    private final Context context;
    private final OnKeyActionListener listener;
    private final String currentUserId;

    public interface OnKeyActionListener {
        void onCheckoutRequest(KeyItem item);
        void onReturnRequest(KeyLogItem log);
        void onApproveRequest(KeyLogItem log);
        void onRejectRequest(KeyLogItem log);
    }

    public KeyRegistryAdapter(Context context, List<Object> list, String currentUserId, OnKeyActionListener listener) {
        this.context = context;
        this.list = list;
        this.currentUserId = currentUserId;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_key_registry, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Object obj = list.get(position);
        holder.layoutActions.setVisibility(View.GONE);
        holder.layoutDetail.setVisibility(View.GONE);

        if (obj instanceof KeyItem) {
            KeyItem item = (KeyItem) obj;
            holder.tvTitle.setText(item.name);
            holder.tvTagNumber.setText("Tag: " + (item.keyNumber != null ? item.keyNumber : "N/A") + " • " + (item.description != null ? item.description : ""));
            holder.tvStatus.setText(formatStatusLabel(item.status));
            holder.tvStatus.setTextColor(getStatusColor(item.status));

            // Set checkout click listener
            if ("AVAILABLE".equalsIgnoreCase(item.status)) {
                holder.itemView.setOnClickListener(v -> {
                    if (listener != null) listener.onCheckoutRequest(item);
                });
            } else {
                holder.itemView.setOnClickListener(null);
            }

        } else if (obj instanceof KeyLogItem) {
            KeyLogItem log = (KeyLogItem) obj;
            holder.tvTitle.setText(log.keyName);
            holder.tvTagNumber.setText("Tag: " + (log.keyNumber != null ? log.keyNumber : "N/A"));
            holder.tvStatus.setText(formatStatusLabel(log.status));
            holder.tvStatus.setTextColor(getStatusColor(log.status));

            holder.layoutDetail.setVisibility(View.VISIBLE);
            holder.tvHolder.setText("Holder: " + log.takenByName);
            holder.tvReason.setText("Reason: " + (log.reason != null ? log.reason : "N/A"));

            String timeStr = "Taken: " + formatDateTimeString(log.takenAt);
            if (log.returnedAt != null) {
                timeStr += " • Returned: " + formatDateTimeString(log.returnedAt);
            } else if (log.durationMinutes != null) {
                timeStr += " • Checked out: " + log.durationMinutes + "m";
            }
            holder.tvTime.setText(timeStr);

            // If it is pending approval
            if ("PENDING_CHECKOUT".equalsIgnoreCase(log.status) || "PENDING_RETURN".equalsIgnoreCase(log.status)) {
                holder.layoutActions.setVisibility(View.VISIBLE);
                holder.btnApprove.setOnClickListener(v -> {
                    if (listener != null) listener.onApproveRequest(log);
                });
                holder.btnReject.setOnClickListener(v -> {
                    if (listener != null) listener.onRejectRequest(log);
                });
            } else if ("CHECKED_OUT".equalsIgnoreCase(log.status)) {
                // Allow return if current user is the owner
                if (currentUserId != null && currentUserId.equals(log.takenById)) {
                    holder.itemView.setOnClickListener(v -> {
                        if (listener != null) listener.onReturnRequest(log);
                    });
                } else {
                    holder.itemView.setOnClickListener(null);
                }
            } else {
                holder.itemView.setOnClickListener(null);
            }
        }
    }

    private String formatStatusLabel(String status) {
        if (status == null) return "Available";
        switch (status.toUpperCase()) {
            case "AVAILABLE": return "Available";
            case "CHECKED_OUT": return "Checked Out";
            case "PENDING_CHECKOUT": return "Pending Checkout";
            case "PENDING_RETURN": return "Pending Return";
            case "RETURNED": return "Returned";
            case "REJECTED": return "Rejected";
            default: return status;
        }
    }

    private int getStatusColor(String status) {
        if (status == null) return context.getColor(R.color.color_success);
        switch (status.toUpperCase()) {
            case "AVAILABLE":
            case "RETURNED":
                return context.getColor(R.color.color_success);
            case "CHECKED_OUT":
            case "REJECTED":
                return context.getColor(R.color.color_danger);
            case "PENDING_CHECKOUT":
            case "PENDING_RETURN":
                return context.getColor(R.color.color_warning);
            default:
                return context.getColor(R.color.text_primary);
        }
    }

    private String formatDateTimeString(String iso) {
        if (iso == null) return "--";
        try {
            return iso.replace("T", " ").substring(0, 16);
        } catch (Exception e) {
            return iso;
        }
    }

    @Override
    public int getItemCount() {
        return list.size();
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvTitle, tvStatus, tvTagNumber, tvHolder, tvReason, tvTime;
        LinearLayout layoutDetail, layoutActions;
        Button btnApprove, btnReject;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvTitle = itemView.findViewById(R.id.tv_title);
            tvStatus = itemView.findViewById(R.id.tv_status_badge);
            tvTagNumber = itemView.findViewById(R.id.tv_tag_number);
            tvHolder = itemView.findViewById(R.id.tv_holder);
            tvReason = itemView.findViewById(R.id.tv_reason);
            tvTime = itemView.findViewById(R.id.tv_time);
            layoutDetail = itemView.findViewById(R.id.layout_detail_block);
            layoutActions = itemView.findViewById(R.id.layout_action_buttons);
            btnApprove = itemView.findViewById(R.id.btn_approve);
            btnReject = itemView.findViewById(R.id.btn_reject);
        }
    }
}
