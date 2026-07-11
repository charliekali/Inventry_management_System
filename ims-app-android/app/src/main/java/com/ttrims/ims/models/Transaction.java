package com.ttrims.ims.models;

import com.google.gson.annotations.SerializedName;

public class Transaction {
    @SerializedName("id")
    public String id;

    @SerializedName("type")
    public String type; // "IN" or "OUT"

    @SerializedName("quantity")
    public double quantity;

    @SerializedName("product_name")
    public String productName;

    @SerializedName("product_code")
    public String productCode;

    @SerializedName("warehouse_name")
    public String warehouseName;

    @SerializedName("section_name")
    public String sectionName;

    @SerializedName("created_at")
    public String createdAt;
}
