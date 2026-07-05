package com.ttrims.ims.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "stock_balance",
    uniqueConstraints = @UniqueConstraint(columnNames = {"product_id","warehouse_id","section_id"}))
public class StockBalance {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "warehouse_id", nullable = false)
    private Warehouse warehouse;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "section_id")
    private Section section;

    private Double quantity = 0.0;

    @Column(name = "locked_quantity")
    private Double lockedQuantity = 0.0;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist @PreUpdate
    void onSave() { updatedAt = LocalDateTime.now(); }

    public StockBalance() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public Warehouse getWarehouse() { return warehouse; }
    public void setWarehouse(Warehouse warehouse) { this.warehouse = warehouse; }
    public Section getSection() { return section; }
    public void setSection(Section section) { this.section = section; }
    public Double getQuantity() { return quantity; }
    public void setQuantity(Double quantity) { this.quantity = quantity; }
    public Double getLockedQuantity() { return lockedQuantity != null ? lockedQuantity : 0.0; }
    public void setLockedQuantity(Double lockedQuantity) { this.lockedQuantity = lockedQuantity; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
