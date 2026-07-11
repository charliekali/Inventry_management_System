package com.ttrims.ims.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.ttrims.ims.R;
import com.ttrims.ims.models.Warehouse;

import java.util.List;

public class WarehouseAdapter extends RecyclerView.Adapter<WarehouseAdapter.ViewHolder> {

    private final List<Warehouse> list;
    private final Context context;
    private final OnSectionAddListener addListener;

    public interface OnSectionAddListener {
        void onAddSection(Warehouse warehouse);
    }

    public WarehouseAdapter(Context context, List<Warehouse> list, OnSectionAddListener addListener) {
        this.context = context;
        this.list = list;
        this.addListener = addListener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_warehouse, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Warehouse item = list.get(position);
        holder.tvWarehouseName.setText(item.name != null ? item.name : "Warehouse");
        holder.tvWarehouseCode.setText("Code: " + (item.code != null ? item.code : "—"));

        if (item.sections != null && !item.sections.isEmpty()) {
            StringBuilder sb = new StringBuilder();
            for (Warehouse.Section sec : item.sections) {
                sb.append(sec.name).append(" (").append(sec.code).append("), ");
            }
            if (sb.length() > 2) sb.setLength(sb.length() - 2); // Remove trailing comma space
            holder.tvSectionsList.setText(sb.toString());
        } else {
            holder.tvSectionsList.setText("No sections defined.");
        }

        holder.btnAddSection.setOnClickListener(v -> {
            if (addListener != null) {
                addListener.onAddSection(item);
            }
        });
    }

    @Override
    public int getItemCount() {
        return list.size();
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvWarehouseName, tvWarehouseCode, tvSectionsList;
        Button btnAddSection;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvWarehouseName = itemView.findViewById(R.id.tv_warehouse_name);
            tvWarehouseCode = itemView.findViewById(R.id.tv_warehouse_code);
            tvSectionsList = itemView.findViewById(R.id.tv_sections_list);
            btnAddSection = itemView.findViewById(R.id.btn_add_section);
        }
    }
}
