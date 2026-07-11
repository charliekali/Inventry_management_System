package com.ttrims.warehouse.models;

import com.google.gson.annotations.SerializedName;

public class User {
    @SerializedName("id")
    public String id;

    @SerializedName("name")
    public String name;

    @SerializedName("email")
    public String email;

    @SerializedName("role_category")
    public String roleCategory;

    @SerializedName("role")
    public com.google.gson.JsonElement role;

    public String getRoleName() {
        if (role == null || role.isJsonNull()) return "Staff";
        if (role.isJsonPrimitive()) return role.getAsString();
        if (role.isJsonObject() && role.getAsJsonObject().has("name")) {
            com.google.gson.JsonElement nameEl = role.getAsJsonObject().get("name");
            if (nameEl != null && !nameEl.isJsonNull()) {
                return nameEl.getAsString();
            }
        }
        return "Staff";
    }

    public String initials() {
        if (name == null || name.trim().isEmpty()) return "U";
        String[] parts = name.trim().split("\\s+");
        if (parts.length >= 2) {
            return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
        }
        return name.substring(0, Math.min(name.length(), 2)).toUpperCase();
    }
}
