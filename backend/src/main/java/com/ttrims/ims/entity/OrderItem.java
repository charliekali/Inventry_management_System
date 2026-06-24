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

    /** Price per unit at the time of order (snapshot from product selling price). */
    @Column(name = "unit_price")
    private Double unitPrice = 0.0;

    /** Discount amount on this line item. */
    @Column(name = "discount")
    private Double discount = 0.0;

    /** Computed line total: unitPrice * qtyRequired - discount. */
    @Column(name = "line_total")
    private Double lineTotal = 0.0;

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
    public Double getUnitPrice() { return unitPrice; }
    public void setUnitPrice(Double unitPrice) { this.unitPrice = unitPrice; }
    public Double getDiscount() { return discount; }
    public void setDiscount(Double discount) { this.discount = discount; }
    public Double getLineTotal() { return lineTotal; }
    public void setLineTotal(Double lineTotal) { this.lineTotal = lineTotal; }

    /** Recalculate lineTotal from unitPrice, qtyRequired, and discount. */
    public void computeLineTotal() {
        double up = unitPrice != null ? unitPrice : 0.0;
        double qty = qtyRequired != null ? qtyRequired : 0.0;
        double disc = discount != null ? discount : 0.0;
        this.lineTotal = Math.round((up * qty - disc) * 100.0) / 100.0;
    }
}
