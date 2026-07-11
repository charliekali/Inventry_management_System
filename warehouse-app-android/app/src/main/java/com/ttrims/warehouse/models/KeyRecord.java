package com.ttrims.warehouse.models;

import com.google.gson.annotations.SerializedName;

public class KeyRecord {
    @SerializedName("id")
    public String id;

    @SerializedName("key_name")
    public String keyName;

    @SerializedName("holder_name")
    public String holderName;

    @SerializedName("status")
    public String status; // "AVAILABLE", "CHECKED_OUT"
}
