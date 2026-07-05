package com.ttrims.ims.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "production_plan_ingredients")
public class ProductionPlanIngredient {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "production_plan_id", nullable = false)
    private ProductionPlan productionPlan;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "warehouse_id", nullable = false)
    private Warehouse warehouse;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "section_id")
    private Section section;

    @Column(name = "planned_quantity", nullable = false)
    private Double plannedQuantity;

    @Column(name = "actual_quantity", nullable = false)
    private Double actualQuantity = 0.0;

    @Column(name = "wastage_quantity", nullable = false)
    private Double wastageQuantity = 0.0;

    public ProductionPlanIngredient() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public ProductionPlan getProductionPlan() { return productionPlan; }
    public void setProductionPlan(ProductionPlan productionPlan) { this.productionPlan = productionPlan; }

    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }

    public Warehouse getWarehouse() { return warehouse; }
    public void setWarehouse(Warehouse warehouse) { this.warehouse = warehouse; }

    public Section getSection() { return section; }
    public void setSection(Section section) { this.section = section; }

    public Double getPlannedQuantity() { return plannedQuantity; }
    public void setPlannedQuantity(Double plannedQuantity) { this.plannedQuantity = plannedQuantity; }

    public Double getActualQuantity() { return actualQuantity; }
    public void setActualQuantity(Double actualQuantity) { this.actualQuantity = actualQuantity; }

    public Double getWastageQuantity() { return wastageQuantity; }
    public void setWastageQuantity(Double wastageQuantity) { this.wastageQuantity = wastageQuantity; }
}
