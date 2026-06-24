package com.ttrims.ims.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "production_order_items")
public class ProductionOrderItem {

    public enum Status { PENDING, COMPLETED, CANCELLED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "production_order_id", nullable = false)
    private ProductionOrder productionOrder;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private Double quantity;

    @Column(nullable = false)
    private String unit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.PENDING;

    public ProductionOrderItem() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public ProductionOrder getProductionOrder() { return productionOrder; }
    public void setProductionOrder(ProductionOrder productionOrder) { this.productionOrder = productionOrder; }

    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }

    public Double getQuantity() { return quantity; }
    public void setQuantity(Double quantity) { this.quantity = quantity; }

    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
}
