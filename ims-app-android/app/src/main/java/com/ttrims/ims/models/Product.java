package com.ttrims.ims.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class Product {
    @SerializedName("id")
    public String id;

    @SerializedName("code")
    public String code;

    @SerializedName("name")
    public String name;

    @SerializedName("unit")
    public String unit;

    @SerializedName("description")
    public String description;

    @SerializedName("category")
    public String category;

    @SerializedName("total_stock")
    public double totalStock;

    @SerializedName("low_stock_threshold")
    public double lowStockThreshold;

    @SerializedName("balances")
    public List<StockBalance> balances;

    public static class StockBalance {
        @SerializedName("warehouse_name")
        public String warehouseName;

        @SerializedName("section_name")
        public String sectionName;

        @SerializedName("balance")
        public double balance;
    }
}
