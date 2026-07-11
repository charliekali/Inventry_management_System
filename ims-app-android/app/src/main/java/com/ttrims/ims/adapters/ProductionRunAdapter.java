package com.ttrims.ims.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.ttrims.ims.R;
import com.ttrims.ims.models.ProductionRun;

import java.util.List;

public class ProductionRunAdapter extends RecyclerView.Adapter<ProductionRunAdapter.ViewHolder> {

    private final List<ProductionRun> list;
    private final Context context;

    public ProductionRunAdapter(Context context, List<ProductionRun> list) {
        this.context = context;
        this.list = list;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_production_run, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        ProductionRun item = list.get(position);
        holder.tvRunRecipe.setText(item.recipeName != null ? item.recipeName : "Formula Batch");
        holder.tvRunStatus.setText(item.status != null ? item.status : "IN_PROGRESS");

        boolean comp = "COMPLETED".equalsIgnoreCase(item.status);
        holder.tvRunStatus.setTextColor(context.getColor(comp ? R.color.color_success : R.color.accent_cyan));

        holder.tvRunDetails.setText("Batch Size: " + item.quantity + " KG • Yield: " + (item.yieldPercentage > 0 ? item.yieldPercentage + "%" : "Pending"));
    }

    @Override
    public int getItemCount() {
        return list.size();
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvRunRecipe, tvRunStatus, tvRunDetails;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvRunRecipe = itemView.findViewById(R.id.tv_run_recipe);
            tvRunStatus = itemView.findViewById(R.id.tv_run_status);
            tvRunDetails = itemView.findViewById(R.id.tv_run_details);
        }
    }
}
