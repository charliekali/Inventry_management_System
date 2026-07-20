package com.ttrims.ims.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "products")
public class Product {
    public enum Type {
        FINISHED_GOOD, RAW_MATERIAL, BLEND, TOOL
    }

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

    /**
     * Weight per finished pack in grams (e.g. 100 for a 100g pouch). Used for
     * masala/spice FG.
     */
    @Column(name = "pack_size_g")
    private Double packSizeG;

    /**
     * Number of packs obtainable from 1 kg of blended product (e.g. 10 packs/kg for
     * 100g packs).
     */
    @Column(name = "packs_per_kg")
    private Double packsPerKg;

    /**
     * Standard batch input quantity in kg per production run (e.g. 50 kg per blend
     * run).
     */
    @Column(name = "batch_size_kg")
    private Double batchSizeKg;

    @Column(name = "pcs_per_innerbag")
    private Integer pcsPerInnerbag;

    @Column(name = "innerbags_per_bag")
    private Integer innerbagsPerBag;

    @Column(name = "pcs_per_bag")
    private Integer pcsPerBag;

    /**
     * Freetext production / blending process notes visible in feasibility audit.
     */
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

    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    @Column(name = "brand")
    private String brand;

    @Column(name = "tags")
    private String tags;

    @Column(name = "weight")
    private Double weight;

    @Column(name = "dimensions")
    private String dimensions;

    @Column(name = "barcode")
    private String barcode;

    @Column(name = "discount_price")
    private Double discountPrice;

    @Column(name = "wholesale_price")
    private Double wholesalePrice;

    @Column(name = "gst_percent")
    private Double gstPercent = 18.0; // Default GST percent

    @Column(name = "min_order_qty")
    private Integer minOrderQty = 1;

    @Column(name = "max_order_qty")
    private Integer maxOrderQty = 100;

    @Column(name = "specifications", length = 2000)
    private String specifications;

    @Column(name = "mfg_date")
    private LocalDateTime mfgDate;

    @Column(name = "expiry_date")
    private LocalDateTime expiryDate;

    @Column(name = "is_featured")
    private Boolean isFeatured = false;

    @Column(name = "gallery_images", columnDefinition = "TEXT")
    private String galleryImages;

    @Column(name = "short_description")
    private String shortDescription;

    @Column(name = "country_of_origin")
    private String countryOfOrigin;

    @Column(name = "shelf_life")
    private String shelfLife;

    @Column(name = "ingredients")
    private String ingredients;

    @Column(name = "tax_inclusive")
    private Boolean taxInclusive = true;

    @Column(name = "show_on_storefront")
    private Boolean showOnStorefront = false;

    @Column(name = "best_seller")
    private Boolean bestSeller = false;

    @Column(name = "new_arrival")
    private Boolean newArrival = false;

    @Column(name = "trending")
    private Boolean trending = false;

    @Column(name = "todays_deal")
    private Boolean todaysDeal = false;

    @Column(name = "sale_product")
    private Boolean saleProduct = false;

    @Column(name = "published")
    private Boolean published = true;

    @Column(name = "slug")
    private String slug;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Product() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Type getType() {
        return type;
    }

    public void setType(Type type) {
        this.type = type;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public Double getPackSizeG() {
        return packSizeG;
    }

    public void setPackSizeG(Double packSizeG) {
        this.packSizeG = packSizeG;
    }

    public Double getPacksPerKg() {
        return packsPerKg;
    }

    public void setPacksPerKg(Double packsPerKg) {
        this.packsPerKg = packsPerKg;
    }

    public Double getBatchSizeKg() {
        return batchSizeKg;
    }

    public void setBatchSizeKg(Double batchSizeKg) {
        this.batchSizeKg = batchSizeKg;
    }

    public Integer getPcsPerInnerbag() {
        return pcsPerInnerbag;
    }

    public void setPcsPerInnerbag(Integer pcsPerInnerbag) {
        this.pcsPerInnerbag = pcsPerInnerbag;
    }

    public Integer getInnerbagsPerBag() {
        return innerbagsPerBag;
    }

    public void setInnerbagsPerBag(Integer innerbagsPerBag) {
        this.innerbagsPerBag = innerbagsPerBag;
    }

    public Integer getPcsPerBag() {
        return pcsPerBag;
    }

    public void setPcsPerBag(Integer pcsPerBag) {
        this.pcsPerBag = pcsPerBag;
    }

    public String getProcessNotes() {
        return processNotes;
    }

    public void setProcessNotes(String processNotes) {
        this.processNotes = processNotes;
    }

    public Double getSellingPrice() {
        return sellingPrice;
    }

    public void setSellingPrice(Double sellingPrice) {
        this.sellingPrice = sellingPrice;
    }

    public Double getCostPrice() {
        return costPrice;
    }

    public void setCostPrice(Double costPrice) {
        this.costPrice = costPrice;
    }

    public Double getMinStock() {
        return minStock != null ? minStock : 0.0;
    }

    public void setMinStock(Double minStock) {
        this.minStock = minStock;
    }

    public Double getDeductionValue() {
        return deductionValue;
    }

    public void setDeductionValue(Double deductionValue) {
        this.deductionValue = deductionValue;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getBrand() {
        return brand;
    }

    public void setBrand(String brand) {
        this.brand = brand;
    }

    public String getTags() {
        return tags;
    }

    public void setTags(String tags) {
        this.tags = tags;
    }

    public Double getWeight() {
        return weight;
    }

    public void setWeight(Double weight) {
        this.weight = weight;
    }

    public String getDimensions() {
        return dimensions;
    }

    public void setDimensions(String dimensions) {
        this.dimensions = dimensions;
    }

    public String getBarcode() {
        return barcode;
    }

    public void setBarcode(String barcode) {
        this.barcode = barcode;
    }

    public Double getDiscountPrice() {
        return discountPrice;
    }

    public void setDiscountPrice(Double discountPrice) {
        this.discountPrice = discountPrice;
    }

    public Double getWholesalePrice() {
        return wholesalePrice;
    }

    public void setWholesalePrice(Double wholesalePrice) {
        this.wholesalePrice = wholesalePrice;
    }

    public Double getGstPercent() {
        return gstPercent;
    }

    public void setGstPercent(Double gstPercent) {
        this.gstPercent = gstPercent;
    }

    public Integer getMinOrderQty() {
        return minOrderQty;
    }

    public void setMinOrderQty(Integer minOrderQty) {
        this.minOrderQty = minOrderQty;
    }

    public Integer getMaxOrderQty() {
        return maxOrderQty;
    }

    public void setMaxOrderQty(Integer maxOrderQty) {
        this.maxOrderQty = maxOrderQty;
    }

    public String getSpecifications() {
        return specifications;
    }

    public void setSpecifications(String specifications) {
        this.specifications = specifications;
    }

    public LocalDateTime getMfgDate() {
        return mfgDate;
    }

    public void setMfgDate(LocalDateTime mfgDate) {
        this.mfgDate = mfgDate;
    }

    public LocalDateTime getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(LocalDateTime expiryDate) {
        this.expiryDate = expiryDate;
    }

    public Boolean getIsFeatured() {
        return isFeatured;
    }

    public void setIsFeatured(Boolean isFeatured) {
        this.isFeatured = isFeatured;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getGalleryImages() {
        return galleryImages;
    }

    public void setGalleryImages(String galleryImages) {
        this.galleryImages = galleryImages;
    }

    public String getShortDescription() {
        return shortDescription;
    }

    public void setShortDescription(String shortDescription) {
        this.shortDescription = shortDescription;
    }

    public String getCountryOfOrigin() {
        return countryOfOrigin;
    }

    public void setCountryOfOrigin(String countryOfOrigin) {
        this.countryOfOrigin = countryOfOrigin;
    }

    public String getShelfLife() {
        return shelfLife;
    }

    public void setShelfLife(String shelfLife) {
        this.shelfLife = shelfLife;
    }

    public String getIngredients() {
        return ingredients;
    }

    public void setIngredients(String ingredients) {
        this.ingredients = ingredients;
    }

    public Boolean getTaxInclusive() {
        return taxInclusive;
    }

    public void setTaxInclusive(Boolean taxInclusive) {
        this.taxInclusive = taxInclusive;
    }

    public Boolean getShowOnStorefront() {
        return showOnStorefront;
    }

    public void setShowOnStorefront(Boolean showOnStorefront) {
        this.showOnStorefront = showOnStorefront;
    }

    public Boolean getBestSeller() {
        return bestSeller;
    }

    public void setBestSeller(Boolean bestSeller) {
        this.bestSeller = bestSeller;
    }

    public Boolean getNewArrival() {
        return newArrival;
    }

    public void setNewArrival(Boolean newArrival) {
        this.newArrival = newArrival;
    }

    public Boolean getTrending() {
        return trending;
    }

    public void setTrending(Boolean trending) {
        this.trending = trending;
    }

    public Boolean getTodaysDeal() {
        return todaysDeal;
    }

    public void setTodaysDeal(Boolean todaysDeal) {
        this.todaysDeal = todaysDeal;
    }

    public Boolean getSaleProduct() {
        return saleProduct;
    }

    public void setSaleProduct(Boolean saleProduct) {
        this.saleProduct = saleProduct;
    }

    public Boolean getPublished() {
        return published;
    }

    public void setPublished(Boolean published) {
        this.published = published;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}