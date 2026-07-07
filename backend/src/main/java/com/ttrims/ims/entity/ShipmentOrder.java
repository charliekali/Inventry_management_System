package com.ttrims.ims.entity;

import jakarta.persistence.*;

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
}
