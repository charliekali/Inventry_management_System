package com.ttrims.warehouse.models;

import com.google.gson.annotations.SerializedName;

public class Recipe {
    @SerializedName("id")
    public String id;

    @SerializedName("name")
    public String name;

    @SerializedName("description")
    public String description;
}
