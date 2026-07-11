package com.ttrims.ims.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;

/** Represents a single delivery stop (order) within a shipment. */
public class ShipmentStop {
    @SerializedName("id")
    public String id;

    @SerializedName("order_number")
    public String orderNumber;

    @SerializedName("customer")
    public String customer;

    @SerializedName("status")
    public String status;

    @SerializedName("stop_id")
    public String stopId;

    @SerializedName("stop_status")
    public String stopStatus;   // PENDING | DELIVERED | FAILED

    @SerializedName("stop_sequence")
    public Integer stopSequence;

    @SerializedName("delivery_address")
    public String deliveryAddress;

    @SerializedName("latitude")
    public Double latitude;

    @SerializedName("longitude")
    public Double longitude;

    @SerializedName("dispatch_bags")
    public Integer dispatchBags;

    @SerializedName("dispatch_pcs")
    public Integer dispatchPcs;

    @SerializedName("delivered_at")
    public String deliveredAt;

    @SerializedName("delivery_notes")
    public String deliveryNotes;

    @SerializedName("receiver_name")
    public String receiverName;

    @SerializedName("receiver_mobile")
    public String receiverMobile;

    @SerializedName("failed_reason")
    public String failedReason;

    @SerializedName("items")
    public List<Item> items;

    public static class Item {
        @SerializedName("product_name")
        public String productName;
        @SerializedName("product_code")
        public String productCode;
        @SerializedName("qty_required")
        public Double qtyRequired;
        @SerializedName("unit")
        public String unit;
    }

    public boolean isPending() {
        return "PENDING".equals(stopStatus) || stopStatus == null;
    }
}
