package com.ttrims.driver.models;

import com.google.gson.annotations.SerializedName;

/**
 * Generic API response wrapper matching the backend's
 * { success: boolean, data: T, message: String } envelope.
 */
public class ApiResponse<T> {
    @SerializedName("success")
    public boolean success;

    @SerializedName("data")
    public T data;

    @SerializedName("message")
    public String message;
}
