package com.ttrims.warehouse.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.ttrims.warehouse.R;
import com.ttrims.warehouse.models.KeyRecord;

import java.util.List;

public class KeyAdapter extends RecyclerView.Adapter<KeyAdapter.ViewHolder> {

    private final List<KeyRecord> list;
    private final Context context;

    public KeyAdapter(Context context, List<KeyRecord> list) {
        this.context = context;
        this.list = list;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_key, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        KeyRecord item = list.get(position);
        holder.tvKeyName.setText(item.keyName != null ? item.keyName : "Rack Key");

        boolean available = "AVAILABLE".equalsIgnoreCase(item.status);
        holder.tvKeyStatus.setText(available ? "Available" : "Checked Out");
        holder.tvKeyStatus.setTextColor(context.getColor(available ? R.color.color_success : R.color.color_danger));

        holder.tvKeyHolder.setText(available ? "Currently in safety box" : "Holder: " + item.holderName);
    }

    @Override
    public int getItemCount() {
        return list.size();
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvKeyName, tvKeyStatus, tvKeyHolder;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvKeyName = itemView.findViewById(R.id.tv_key_name);
            tvKeyStatus = itemView.findViewById(R.id.tv_key_status);
            tvKeyHolder = itemView.findViewById(R.id.tv_key_holder);
        }
    }
}
