package com.ttrims.ims.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "shipment_orders")
public class ShipmentOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shipment_id", nullable = false)
    private Shipment shipment;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(name = "dispatch_bags")
    private Integer dispatchBags = 0;

    @Column(name = "dispatch_pcs")
    private Integer dispatchPcs = 0;

    private String notes;

    @Column(name = "status")
    private String status = "PENDING"; // PENDING, DELIVERED, FAILED, CANCELLED

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    @Column(name = "delivery_notes", length = 1000)
    private String deliveryNotes;

    @Column(name = "delivery_photo", columnDefinition = "TEXT")
    private String deliveryPhoto;

    @Column(name = "delivery_signature", columnDefinition = "TEXT")
    private String deliverySignature;

    @Column(name = "receiver_name")
    private String receiverName;

    @Column(name = "receiver_mobile")
    private String receiverMobile;

    @Column(name = "delivery_lat")
    private Double deliveryLatitude;

    @Column(name = "delivery_lng")
    private Double deliveryLongitude;

    @Column(name = "failed_reason")
    private String failedReason;

    @Column(name = "stop_sequence")
    private Integer stopSequence = 0;

    public ShipmentOrder() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Shipment getShipment() { return shipment; }
    public void setShipment(Shipment shipment) { this.shipment = shipment; }

    public Order getOrder() { return order; }
    public void setOrder(Order order) { this.order = order; }

    public Integer getDispatchBags() { return dispatchBags; }
    public void setDispatchBags(Integer dispatchBags) { this.dispatchBags = dispatchBags; }

    public Integer getDispatchPcs() { return dispatchPcs; }
    public void setDispatchPcs(Integer dispatchPcs) { this.dispatchPcs = dispatchPcs; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getDeliveredAt() { return deliveredAt; }
    public void setDeliveredAt(LocalDateTime deliveredAt) { this.deliveredAt = deliveredAt; }

    public String getDeliveryNotes() { return deliveryNotes; }
    public void setDeliveryNotes(String deliveryNotes) { this.deliveryNotes = deliveryNotes; }

    public String getDeliveryPhoto() { return deliveryPhoto; }
    public void setDeliveryPhoto(String deliveryPhoto) { this.deliveryPhoto = deliveryPhoto; }

    public String getDeliverySignature() { return deliverySignature; }
    public void setDeliverySignature(String deliverySignature) { this.deliverySignature = deliverySignature; }

    public String getReceiverName() { return receiverName; }
    public void setReceiverName(String receiverName) { this.receiverName = receiverName; }

    public String getReceiverMobile() { return receiverMobile; }
    public void setReceiverMobile(String receiverMobile) { this.receiverMobile = receiverMobile; }

    public Double getDeliveryLatitude() { return deliveryLatitude; }
    public void setDeliveryLatitude(Double deliveryLatitude) { this.deliveryLatitude = deliveryLatitude; }

    public Double getDeliveryLongitude() { return deliveryLongitude; }
    public void setDeliveryLongitude(Double deliveryLongitude) { this.deliveryLongitude = deliveryLongitude; }

    public String getFailedReason() { return failedReason; }
    public void setFailedReason(String failedReason) { this.failedReason = failedReason; }

    public Integer getStopSequence() { return stopSequence; }
    public void setStopSequence(Integer stopSequence) { this.stopSequence = stopSequence; }
}
