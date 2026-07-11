package com.ttrims.warehouse.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class Warehouse {
    @SerializedName("id")
    public String id;

    @SerializedName("name")
    public String name;

    @SerializedName("code")
    public String code;

    @SerializedName("sections")
    public List<Section> sections;

    public static class Section {
        @SerializedName("id")
        public String id;

        @SerializedName("name")
        public String name;

        @SerializedName("code")
        public String code;
    }
}
