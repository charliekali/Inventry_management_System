package com.ttrims.ims.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.ttrims.ims.R;
import com.ttrims.ims.models.Product;

import java.util.List;

public class ProductAdapter extends RecyclerView.Adapter<ProductAdapter.ViewHolder> {

    private final List<Product> list;
    private final Context context;

    public ProductAdapter(Context context, List<Product> list) {
        this.context = context;
        this.list = list;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_product, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Product item = list.get(position);
        holder.tvProductName.setText(item.name != null ? item.name : "Product Name");
        holder.tvProductSku.setText("SKU: " + (item.code != null ? item.code : "—") + " (" + (item.category != null ? item.category : "Uncategorized") + ")");
        holder.tvTotalStock.setText((int) item.totalStock + " " + (item.unit != null ? item.unit : "units"));

        if (item.balances != null && !item.balances.isEmpty()) {
            StringBuilder sb = new StringBuilder("Balances:\n");
            for (Product.StockBalance bal : item.balances) {
                sb.append(" • ").append(bal.warehouseName)
                  .append(" (").append(bal.sectionName).append("): ")
                  .append((int) bal.balance).append(" ")
                  .append(item.unit != null ? item.unit : "units").append("\n");
            }
            // Remove trailing newline
            if (sb.length() > 0) sb.setLength(sb.length() - 1);
            holder.tvLocations.setText(sb.toString());
        } else {
            holder.tvLocations.setText("No stock mapped in warehouses.");
        }
    }

    @Override
    public int getItemCount() {
        return list.size();
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvProductName, tvProductSku, tvTotalStock, tvLocations;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvProductName = itemView.findViewById(R.id.tv_product_name);
            tvProductSku = itemView.findViewById(R.id.tv_product_sku);
            tvTotalStock = itemView.findViewById(R.id.tv_total_stock);
            tvLocations = itemView.findViewById(R.id.tv_locations);
        }
    }
}
