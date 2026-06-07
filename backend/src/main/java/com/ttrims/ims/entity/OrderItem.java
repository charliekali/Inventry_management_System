package com.ttrims.ims.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "order_items")
public class OrderItem {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "qty_required", nullable = false)
    private Double qtyRequired;

    @Column(nullable = false)
    private String unit;

    public OrderItem() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Order getOrder() { return order; }
    public void setOrder(Order order) { this.order = order; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public Double getQtyRequired() { return qtyRequired; }
    public void setQtyRequired(Double qtyRequired) { this.qtyRequired = qtyRequired; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
}
