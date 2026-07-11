package com.ttrims.driver.models;

import com.google.gson.annotations.SerializedName;

public class AttendanceSession {
    @SerializedName("id")
    public String id;

    @SerializedName("user_id")
    public String userId;

    @SerializedName("status")
    public String status;   // ACTIVE | ENDED

    @SerializedName("clock_in_at")
    public String clockInAt;

    @SerializedName("clock_out_at")
    public String clockOutAt;

    @SerializedName("cumulative_distance")
    public Double cumulativeDistance;

    @SerializedName("duration_minutes")
    public Integer durationMinutes;

    public boolean isActive() {
        return "ACTIVE".equals(status);
    }
}
