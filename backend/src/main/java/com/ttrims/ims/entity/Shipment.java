package com.ttrims.ims.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "shipments")
public class Shipment {
    public enum Status { CREATED, EN_ROUTE, DELIVERED, FAILED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "shipment_number", nullable = false, unique = true)
    private String shipmentNumber;

    @Column(name = "vehicle_number")
    private String vehicleNumber;

    @Column(name = "driver_name")
    private String driverName;

    @Column(name = "driver_phone")
    private String driverPhone;

    private String origin;
    private String destination;

    @Enumerated(EnumType.STRING)
    private Status status = Status.CREATED;

    @Column(name = "scheduled_at")
    private LocalDateTime scheduledAt;

    @Column(name = "dispatched_at")
    private LocalDateTime dispatchedAt;

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    @Column(name = "delivery_notes", length = 1000)
    private String deliveryNotes;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "shipment", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ShipmentOrder> shipmentOrders = new ArrayList<>();

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
    }

    public Shipment() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getShipmentNumber() { return shipmentNumber; }
    public void setShipmentNumber(String shipmentNumber) { this.shipmentNumber = shipmentNumber; }

    public String getVehicleNumber() { return vehicleNumber; }
    public void setVehicleNumber(String vehicleNumber) { this.vehicleNumber = vehicleNumber; }

    public String getDriverName() { return driverName; }
    public void setDriverName(String driverName) { this.driverName = driverName; }

    public String getDriverPhone() { return driverPhone; }
    public void setDriverPhone(String driverPhone) { this.driverPhone = driverPhone; }

    public String getOrigin() { return origin; }
    public void setOrigin(String origin) { this.origin = origin; }

    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public LocalDateTime getScheduledAt() { return scheduledAt; }
    public void setScheduledAt(LocalDateTime scheduledAt) { this.scheduledAt = scheduledAt; }

    public LocalDateTime getDispatchedAt() { return dispatchedAt; }
    public void setDispatchedAt(LocalDateTime dispatchedAt) { this.dispatchedAt = dispatchedAt; }

    public LocalDateTime getDeliveredAt() { return deliveredAt; }
    public void setDeliveredAt(LocalDateTime deliveredAt) { this.deliveredAt = deliveredAt; }

    public String getDeliveryNotes() { return deliveryNotes; }
    public void setDeliveryNotes(String deliveryNotes) { this.deliveryNotes = deliveryNotes; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public List<ShipmentOrder> getShipmentOrders() { return shipmentOrders; }
    public void setShipmentOrders(List<ShipmentOrder> shipmentOrders) { this.shipmentOrders = shipmentOrders; }
}
