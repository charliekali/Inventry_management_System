package com.ttrims.warehouse.models;

import com.google.gson.annotations.SerializedName;

public class KeyItem {
    @SerializedName("id")
    public String id;

    @SerializedName("name")
    public String name;

    @SerializedName("description")
    public String description;

    @SerializedName("key_number")
    public String keyNumber;

    @SerializedName("status")
    public String status; // "AVAILABLE", "CHECKED_OUT", "PENDING_CHECKOUT", "PENDING_RETURN"
}
