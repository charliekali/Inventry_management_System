package com.ttrims.warehouse.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.ttrims.warehouse.R;
import com.ttrims.warehouse.models.Role;

import java.util.List;

public class RoleAdapter extends RecyclerView.Adapter<RoleAdapter.ViewHolder> {

    private final List<Role> list;
    private final Context context;

    public RoleAdapter(Context context, List<Role> list) {
        this.context = context;
        this.list = list;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_role, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Role item = list.get(position);
        holder.tvRoleName.setText(item.name != null ? item.name : "Unnamed Role");
        holder.tvRoleDesc.setText(item.description != null ? item.description : "No description mapped.");
    }

    @Override
    public int getItemCount() {
        return list.size();
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvRoleName, tvRoleDesc;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvRoleName = itemView.findViewById(R.id.tv_role_name);
            tvRoleDesc = itemView.findViewById(R.id.tv_role_desc);
        }
    }
}
