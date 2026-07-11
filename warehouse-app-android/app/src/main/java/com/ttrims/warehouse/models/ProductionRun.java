package com.ttrims.warehouse.models;

import com.google.gson.annotations.SerializedName;

public class ProductionRun {
    @SerializedName("id")
    public String id;

    @SerializedName("recipe_name")
    public String recipeName;

    @SerializedName("status")
    public String status; // "PENDING", "IN_PROGRESS", "COMPLETED"

    @SerializedName("quantity")
    public double quantity;

    @SerializedName("yield_percentage")
    public double yieldPercentage;
}
