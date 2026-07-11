package com.ttrims.ims.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class User {
    @SerializedName("id")
    public String id;

    @SerializedName("name")
    public String name;

    @SerializedName("email")
    public String email;

    @SerializedName("role_category")
    public String roleCategory;

    @SerializedName("driver_status")
    public String driverStatus;   // AVAILABLE | BUSY | OFFLINE | VEHICLE_BREAKDOWN

    @SerializedName("vehicle_number")
    public String vehicleNumber;

    @SerializedName("delivery_zone")
    public String deliveryZone;

    @SerializedName("permissions")
    public List<String> permissions;

    @SerializedName("role")
    public com.google.gson.JsonElement role;

    public String getRoleName() {
        if (role == null || role.isJsonNull()) return "Staff";
        if (role.isJsonPrimitive()) return role.getAsString();
        if (role.isJsonObject() && role.getAsJsonObject().has("name")) {
            com.google.gson.JsonElement nameElement = role.getAsJsonObject().get("name");
            if (nameElement != null && !nameElement.isJsonNull()) {
                return nameElement.getAsString();
            }
        }
        return "Staff";
    }

    /** Returns initials for the avatar (up to 2 chars). */
    public String initials() {
        if (name == null || name.trim().isEmpty()) return "U";
        String[] parts = name.trim().split("\\s+");
        if (parts.length >= 2) {
            return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
        }
        return name.substring(0, Math.min(name.length(), 2)).toUpperCase();
    }

    public boolean hasPermission(String perm) {
        if (permissions == null) return false;
        return permissions.contains(perm);
    }
}
