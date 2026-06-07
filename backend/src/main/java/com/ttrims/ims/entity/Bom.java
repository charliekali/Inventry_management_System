package com.ttrims.ims.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "bom", uniqueConstraints = @UniqueConstraint(columnNames = {"finished_good_id","raw_material_id"}))
public class Bom {

    /** Production steps in a masala / spice manufacturing process. */
    public enum ProductionStep {
        CLEANING,   // initial cleaning of raw spice
        DRYING,     // sun-drying / oven drying
        ROASTING,   // dry roasting / tempering
        GRINDING,   // grinding whole spice to powder
        BLENDING,   // mixing all ingredients to final blend
        PACKING     // filling into packs / pouches / jars
    }
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "finished_good_id", nullable = false)
    private Product finishedGood;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "raw_material_id", nullable = false)
    private Product rawMaterial;

    @Column(name = "qty_required", nullable = false)
    private Double qtyRequired;

    @Column(nullable = false)
    private String unit;

    /** Which production step this ingredient is used at. */
    @Enumerated(EnumType.STRING)
    @Column(name = "production_step")
    private ProductionStep productionStep;

    /** Percentage of this ingredient in the finished blend (0-100). Auto-derived but can be overridden. */
    @Column(name = "blend_pct")
    private Double blendPct;

    /** Optional per-ingredient processing note (e.g. "coarse grind", "dry roast first"). */
    @Column(length = 500)
    private String notes;

    public Bom() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Product getFinishedGood() { return finishedGood; }
    public void setFinishedGood(Product finishedGood) { this.finishedGood = finishedGood; }
    public Product getRawMaterial() { return rawMaterial; }
    public void setRawMaterial(Product rawMaterial) { this.rawMaterial = rawMaterial; }
    public Double getQtyRequired() { return qtyRequired; }
    public void setQtyRequired(Double qtyRequired) { this.qtyRequired = qtyRequired; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public ProductionStep getProductionStep() { return productionStep; }
    public void setProductionStep(ProductionStep productionStep) { this.productionStep = productionStep; }
    public Double getBlendPct() { return blendPct; }
    public void setBlendPct(Double blendPct) { this.blendPct = blendPct; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
