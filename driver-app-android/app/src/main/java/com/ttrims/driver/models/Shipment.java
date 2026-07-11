package com.ttrims.driver.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class Shipment {
    @SerializedName("id")
    public String id;

    @SerializedName("shipment_number")
    public String shipmentNumber;

    @SerializedName("vehicle_number")
    public String vehicleNumber;

    @SerializedName("driver_name")
    public String driverName;

    @SerializedName("driver_phone")
    public String driverPhone;

    @SerializedName("status")
    public String status;   // CREATED | EN_ROUTE | DELIVERED | FAILED | PICKED_UP

    @SerializedName("delivery_method")
    public String deliveryMethod;  // COMPANY_DELIVERY | CUSTOMER_PICKUP

    @SerializedName("origin")
    public String origin;

    @SerializedName("destination")
    public String destination;

    @SerializedName("distance_km")
    public Double distanceKm;

    @SerializedName("duration_min")
    public Integer durationMin;

    @SerializedName("total_bags")
    public int totalBags;

    @SerializedName("total_pcs")
    public int totalPcs;

    @SerializedName("scheduled_at")
    public String scheduledAt;

    @SerializedName("dispatched_at")
    public String dispatchedAt;

    @SerializedName("delivered_at")
    public String deliveredAt;

    @SerializedName("orders")
    public List<ShipmentStop> orders;

    @SerializedName("driver")
    public DriverInfo driver;

    /** Nested driver info returned in the shipment DTO */
    public static class DriverInfo {
        @SerializedName("id")
        public String id;
        @SerializedName("name")
        public String name;
        @SerializedName("driver_status")
        public String driverStatus;
        @SerializedName("lat")
        public Double lat;
        @SerializedName("lng")
        public Double lng;
        @SerializedName("vehicle_number")
        public String vehicleNumber;
    }

    /** True if this shipment is currently active (assignable to a driver view). */
    public boolean isActive() {
        return "CREATED".equals(status) || "EN_ROUTE".equals(status);
    }

    /** Counts stops in each state. */
    public int completedStops() {
        if (orders == null) return 0;
        int n = 0;
        for (ShipmentStop s : orders) {
            if ("DELIVERED".equals(s.stopStatus) || "FAILED".equals(s.stopStatus)) n++;
        }
        return n;
    }

    public int remainingStops() {
        if (orders == null) return 0;
        return orders.size() - completedStops();
    }
}
