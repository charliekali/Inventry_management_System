package com.ttrims.warehouse.models;

import com.google.gson.annotations.SerializedName;

public class KeyLogItem {
    @SerializedName("id")
    public String id;

    @SerializedName("key_id")
    public String keyId;

    @SerializedName("key_name")
    public String keyName;

    @SerializedName("key_number")
    public String keyNumber;

    @SerializedName("taken_by_id")
    public String takenById;

    @SerializedName("taken_by_name")
    public String takenByName;

    @SerializedName("taken_by_email")
    public String takenByEmail;

    @SerializedName("reason")
    public String reason;

    @SerializedName("taken_at")
    public String takenAt;

    @SerializedName("returned_at")
    public String returnedAt;

    @SerializedName("return_notes")
    public String returnNotes;

    @SerializedName("recorded_by_name")
    public String recordedByName;

    @SerializedName("status")
    public String status; // "PENDING_CHECKOUT", "CHECKED_OUT", "PENDING_RETURN", "RETURNED", "REJECTED"

    @SerializedName("duration_minutes")
    public Long durationMinutes;
}
