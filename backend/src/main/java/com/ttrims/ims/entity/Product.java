package com.ttrims.ims.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "products")
public class Product {
    public enum Type { FINISHED_GOOD, RAW_MATERIAL, BLEND, TOOL }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Type type;

    @Column(nullable = false)
    private String unit = "PCS";

    private String description;

    private String category;

    /** Weight per finished pack in grams (e.g. 100 for a 100g pouch). Used for masala/spice FG. */
    @Column(name = "pack_size_g")
    private Double packSizeG;

    /** Number of packs obtainable from 1 kg of blended product (e.g. 10 packs/kg for 100g packs). */
    @Column(name = "packs_per_kg")
    private Double packsPerKg;

    /** Standard batch input quantity in kg per production run (e.g. 50 kg per blend run). */
    @Column(name = "batch_size_kg")
    private Double batchSizeKg;

    @Column(name = "pcs_per_innerbag")
    private Integer pcsPerInnerbag;

    @Column(name = "innerbags_per_bag")
    private Integer innerbagsPerBag;

    @Column(name = "pcs_per_bag")
    private Integer pcsPerBag;


    /** Freetext production / blending process notes visible in feasibility audit. */
    @Column(name = "process_notes", length = 1000)
    private String processNotes;

    /** Default selling price per unit (used in sales orders and POS). */
    @Column(name = "selling_price")
    private Double sellingPrice;

    /** Cost price per unit (for margin calculations). */
    @Column(name = "cost_price")
    private Double costPrice;

    @Column(name = "min_stock")
    private Double minStock = 0.0;

    @Column(name = "deduction_value")
    private Double deductionValue = 0.0;

    @Column(name = "is_active")
    private boolean active = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }

    @PreUpdate
    void preUpdate() { updatedAt = LocalDateTime.now(); }

    public Product() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Type getType() { return type; }
    public void setType(Type type) { this.type = type; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Double getPackSizeG() { return packSizeG; }
    public void setPackSizeG(Double packSizeG) { this.packSizeG = packSizeG; }
    public Double getPacksPerKg() { return packsPerKg; }
    public void setPacksPerKg(Double packsPerKg) { this.packsPerKg = packsPerKg; }
    public Double getBatchSizeKg() { return batchSizeKg; }
    public void setBatchSizeKg(Double batchSizeKg) { this.batchSizeKg = batchSizeKg; }
    public Integer getPcsPerInnerbag() { return pcsPerInnerbag; }
    public void setPcsPerInnerbag(Integer pcsPerInnerbag) { this.pcsPerInnerbag = pcsPerInnerbag; }
    public Integer getInnerbagsPerBag() { return innerbagsPerBag; }
    public void setInnerbagsPerBag(Integer innerbagsPerBag) { this.innerbagsPerBag = innerbagsPerBag; }
    public Integer getPcsPerBag() { return pcsPerBag; }
    public void setPcsPerBag(Integer pcsPerBag) { this.pcsPerBag = pcsPerBag; }
    public String getProcessNotes() { return processNotes; }
    public void setProcessNotes(String processNotes) { this.processNotes = processNotes; }
    public Double getSellingPrice() { return sellingPrice; }
    public void setSellingPrice(Double sellingPrice) { this.sellingPrice = sellingPrice; }
    public Double getCostPrice() { return costPrice; }
    public void setCostPrice(Double costPrice) { this.costPrice = costPrice; }
    public Double getMinStock() { return minStock; }
    public void setMinStock(Double minStock) { this.minStock = minStock; }
    public Double getDeductionValue() { return deductionValue; }
    public void setDeductionValue(Double deductionValue) { this.deductionValue = deductionValue; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
cd