package com.ttrims.warehouse.models;

import com.google.gson.annotations.SerializedName;

public class ApiResponse<T> {
    @SerializedName("success")
    public boolean success;

    @SerializedName("data")
    public T data;

    @SerializedName("message")
    public String message;
}
