package com.ttrims.driver.models;

import com.google.gson.annotations.SerializedName;

public class User {
    @SerializedName("id")
    public String id;

    @SerializedName("name")
    public String name;

    @SerializedName("email")
    public String email;

    @SerializedName("driver_status")
    public String driverStatus;   // AVAILABLE | BUSY | OFFLINE | VEHICLE_BREAKDOWN

    @SerializedName("vehicle_number")
    public String vehicleNumber;

    @SerializedName("delivery_zone")
    public String deliveryZone;

    @SerializedName("permissions")
    public java.util.List<String> permissions;

    @SerializedName("role")
    public com.google.gson.JsonElement role;

    public String getRoleName() {
        if (role == null || role.isJsonNull()) return "Driver";
        if (role.isJsonPrimitive()) return role.getAsString();
        if (role.isJsonObject() && role.getAsJsonObject().has("name")) {
            com.google.gson.JsonElement nameElement = role.getAsJsonObject().get("name");
            if (nameElement != null && !nameElement.isJsonNull()) {
                return nameElement.getAsString();
            }
        }
        return "Driver";
    }

    /** Returns initials for the avatar (up to 2 chars). */
    public String initials() {
        if (name == null || name.isEmpty()) return "DR";
        String[] parts = name.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (!p.isEmpty()) sb.append(Character.toUpperCase(p.charAt(0)));
            if (sb.length() == 2) break;
        }
        return sb.toString();
    }

    public boolean hasPermission(String perm) {
        if (permissions == null) return false;
        return permissions.contains(perm);
    }
}
