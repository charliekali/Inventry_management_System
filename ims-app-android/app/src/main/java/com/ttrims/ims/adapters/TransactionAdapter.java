package com.ttrims.ims.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.ttrims.ims.R;
import com.ttrims.ims.models.Transaction;

import java.util.List;

public class TransactionAdapter extends RecyclerView.Adapter<TransactionAdapter.ViewHolder> {

    private final List<Transaction> list;
    private final Context context;

    public TransactionAdapter(Context context, List<Transaction> list) {
        this.context = context;
        this.list = list;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_transaction, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Transaction item = list.get(position);
        holder.tvProductName.setText(item.productName != null ? item.productName : "Unknown Product");

        boolean isIn = "IN".equalsIgnoreCase(item.type);
        holder.tvQuantity.setText((isIn ? "+" : "-") + (int) item.quantity);
        holder.tvQuantity.setTextColor(context.getColor(isIn ? R.color.color_success : R.color.color_danger));

        String wh = item.warehouseName != null ? item.warehouseName : "Main Warehouse";
        String sec = item.sectionName != null ? item.sectionName : "Default Section";
        holder.tvDetails.setText(wh + " • " + sec);

        holder.tvDate.setText(item.createdAt != null ? item.createdAt : "Just now");
    }

    @Override
    public int getItemCount() {
        return list.size();
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvProductName, tvQuantity, tvDetails, tvDate;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvProductName = itemView.findViewById(R.id.tv_product_name);
            tvQuantity = itemView.findViewById(R.id.tv_quantity);
            tvDetails = itemView.findViewById(R.id.tv_details);
            tvDate = itemView.findViewById(R.id.tv_date);
        }
    }
}
