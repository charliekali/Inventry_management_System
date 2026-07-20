package com.ttrims.ims.controller;

import com.ttrims.ims.entity.*;
import com.ttrims.ims.repository.*;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/products")
public class ProductController {
    private final ProductRepository productRepo;
    private final BomRepository bomRepo;
    private final StockBalanceRepository stockBalanceRepo;
    private final AuthHelper auth;

    public ProductController(ProductRepository productRepo, BomRepository bomRepo,
            StockBalanceRepository stockBalanceRepo, AuthHelper auth) {
        this.productRepo = productRepo;
        this.bomRepo = bomRepo;
        this.stockBalanceRepo = stockBalanceRepo;
        this.auth = auth;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String type,
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "true") boolean active) {
        auth.requirePermission("PRODUCTS:VIEW");
        List<Product> products;
        if (search != null && !search.isBlank()) {
            products = productRepo.search(search, active);
        } else if (type != null) {
            products = active
                    ? productRepo.findByTypeAndActiveTrueOrderByName(Product.Type.valueOf(type))
                    : productRepo.findByTypeAndActiveFalseOrderByName(Product.Type.valueOf(type));
        } else {
            products = active
                    ? productRepo.findByActiveTrueOrderByTypeAscNameAsc()
                    : productRepo.findByActiveFalseOrderByTypeAscNameAsc();
        }
        return ok(products.stream().map(this::toDto).collect(Collectors.toList()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id) {
        auth.requirePermission("PRODUCTS:VIEW");
        Optional<Product> p = productRepo.findById(id);
        if (p.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "Product not found"));
        }
        return ok(toDto(p.get()));
    }

    private Double getDouble(Object val) {
        if (val == null)
            return null;
        if (val instanceof Number n)
            return n.doubleValue();
        if (val instanceof String s) {
            if (s.isBlank())
                return null;
            try {
                return Double.parseDouble(s);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private Integer getInteger(Object val) {
        if (val == null)
            return null;
        if (val instanceof Number n)
            return n.intValue();
        if (val instanceof String s) {
            if (s.isBlank())
                return null;
            try {
                return (int) Double.parseDouble(s);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        auth.requirePermission("PRODUCTS:CREATE");
        String code = (body.get("code") == null ? "" : body.get("code").toString()).toUpperCase().trim();
        String name = body.get("name") == null ? null : body.get("name").toString();
        String type = body.get("type") == null ? null : body.get("type").toString();

        if (code.isEmpty() || name == null || type == null)
            return bad("code, name, and type are required");
        if (!Set.of("FINISHED_GOOD", "RAW_MATERIAL", "BLEND", "TOOL").contains(type))
            return bad("type must be FINISHED_GOOD, RAW_MATERIAL, BLEND, or TOOL");
        if (productRepo.existsByCode(code))
            return bad("Product code already exists");

        Product p = new Product();
        p.setCode(code);
        p.setName(name);
        p.setType(Product.Type.valueOf(type));
        p.setUnit(body.get("unit") != null ? body.get("unit").toString() : "PCS");
        p.setDescription(body.get("description") == null ? null : body.get("description").toString());
        p.setCategory(body.get("category") == null ? null : body.get("category").toString());
        Double ms = getDouble(body.get("min_stock"));
        p.setMinStock(ms != null ? ms : 0.0);
        Double dv = getDouble(body.get("deduction_value"));
        p.setDeductionValue(dv != null ? dv : 0.0);
        Double sellingPrice = null;
        Double costPrice = null;
        if (body.containsKey("selling_price")) {
            sellingPrice = getDouble(body.get("selling_price"));
        }
        if (body.containsKey("cost_price")) {
            costPrice = getDouble(body.get("cost_price"));
        }

        if (sellingPrice != null || costPrice != null) {
            auth.requireSuperAdmin();
        }

        p.setSellingPrice(sellingPrice);
        p.setCostPrice(costPrice);
        applyPackConfig(p, body);
        applyEcomConfig(p, body);
        p.setActive(true);
        productRepo.save(p);
        return ResponseEntity.status(201).body(Map.of("success", true, "data", toDto(p)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        auth.requirePermission("PRODUCTS:EDIT");
        Product p = productRepo.findById(id).orElse(null);
        if (p == null)
            return ResponseEntity.status(404).body(err("Product not found"));
        if (body.containsKey("name"))
            p.setName(body.get("name") == null ? null : body.get("name").toString());
        if (body.containsKey("unit"))
            p.setUnit(body.get("unit") == null ? null : body.get("unit").toString());
        if (body.containsKey("description"))
            p.setDescription(body.get("description") == null ? null : body.get("description").toString());
        if (body.containsKey("category"))
            p.setCategory(body.get("category") == null ? null : body.get("category").toString());
        if (body.containsKey("min_stock")) {
            Double ms = getDouble(body.get("min_stock"));
            p.setMinStock(ms != null ? ms : 0.0);
        }
        if (body.containsKey("deduction_value")) {
            Double dv = getDouble(body.get("deduction_value"));
            p.setDeductionValue(dv != null ? dv : 0.0);
        }
        if (body.containsKey("is_active"))
            p.setActive(Boolean.TRUE.equals(body.get("is_active")));
        if (body.containsKey("selling_price") || body.containsKey("cost_price")) {
            Double newSelling = body.containsKey("selling_price") ? getDouble(body.get("selling_price"))
                    : p.getSellingPrice();
            Double newCost = body.containsKey("cost_price") ? getDouble(body.get("cost_price")) : p.getCostPrice();
            if (!Objects.equals(newSelling, p.getSellingPrice()) || !Objects.equals(newCost, p.getCostPrice())) {
                auth.requireSuperAdmin();
            }
        }
        if (body.containsKey("selling_price"))
            p.setSellingPrice(getDouble(body.get("selling_price")));
        if (body.containsKey("cost_price"))
            p.setCostPrice(getDouble(body.get("cost_price")));
        applyPackConfig(p, body);
        applyEcomConfig(p, body);
        productRepo.save(p);
        return ok(toDto(p));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id,
            @RequestParam(required = false, defaultValue = "false") boolean permanent) {
        auth.requirePermission("PRODUCTS:DELETE");
        if (permanent) {
            try {
                // Cascaded force delete across all referencing tables
                productRepo.deleteBomByProductId(id);
                productRepo.deleteStockBalanceByProductId(id);
                productRepo.deleteStockTransactionByProductId(id);
                productRepo.deleteProductionOrderItemByProductId(id);
                productRepo.deleteOrderItemByProductId(id);

                // Now delete the product itself
                productRepo.deleteById(id);
                return ok("Product permanently deleted");
            } catch (Exception e) {
                return bad("Failed to permanently delete product: " + e.getMessage());
            }
        } else {
            productRepo.findById(id).ifPresent(p -> {
                p.setActive(false);
                productRepo.save(p);
            });
            return ok("Product archived");
        }
    }

    // ─── BOM ──────────────────────────────────────────────────────────────────

    @GetMapping("/{id}/bom")
    public ResponseEntity<?> getBom(@PathVariable String id) {
        auth.requirePermission("BOM:VIEW");
        var bom = bomRepo.findByFinishedGoodId(id).stream().map(b -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", b.getId());
            m.put("finished_good_id", b.getFinishedGood().getId());
            m.put("raw_material_id", b.getRawMaterial().getId());
            m.put("raw_material_name", b.getRawMaterial().getName());
            m.put("raw_material_code", b.getRawMaterial().getCode());
            m.put("raw_material_category",
                    b.getRawMaterial().getCategory() != null ? b.getRawMaterial().getCategory() : "");
            m.put("qty_required", b.getQtyRequired());
            m.put("unit", b.getUnit());
            m.put("production_step", b.getProductionStep() != null ? b.getProductionStep().name() : null);
            m.put("blend_pct", b.getBlendPct());
            m.put("notes", b.getNotes() != null ? b.getNotes() : "");
            return m;
        }).collect(Collectors.toList());
        return ok(bom);
    }

    @PostMapping("/{id}/bom")
    @Transactional
    public ResponseEntity<?> addBom(@PathVariable String id, @RequestBody Map<String, Object> body) {
        auth.requirePermission("BOM:CREATE");
        Product fg = productRepo.findById(id).orElse(null);
        if (fg == null || (fg.getType() != Product.Type.FINISHED_GOOD && fg.getType() != Product.Type.BLEND))
            return bad("Finished Good or Blend not found");
        String rmId = body.get("raw_material_id") == null ? null : body.get("raw_material_id").toString();
        if (id.equals(rmId))
            return bad("A product cannot be an ingredient of itself");
        Product rm = productRepo.findById(rmId).orElse(null);
        if (rm == null)
            return bad("Ingredient product not found");

        Bom bom = new Bom();
        bom.setFinishedGood(fg);
        bom.setRawMaterial(rm);
        Double qty = getDouble(body.get("qty_required"));
        if (qty == null)
            return bad("qty_required is required and must be a number");
        bom.setQtyRequired(qty);
        bom.setUnit(body.get("unit") != null ? body.get("unit").toString() : rm.getUnit());
        applyBomRecipeFields(bom, body);
        bomRepo.save(bom);
        return ResponseEntity.status(201).body(Map.of("success", true, "data", bom.getId()));
    }

    @PatchMapping("/{id}/bom/{bomId}")
    @Transactional
    public ResponseEntity<?> updateBom(@PathVariable String id, @PathVariable String bomId,
            @RequestBody Map<String, Object> body) {
        auth.requirePermission("BOM:CREATE");
        Bom bom = bomRepo.findById(bomId).orElse(null);
        if (bom == null || !bom.getFinishedGood().getId().equals(id))
            return bad("BOM line not found");
        if (body.containsKey("qty_required")) {
            Double qty = getDouble(body.get("qty_required"));
            if (qty == null)
                return bad("qty_required must be a number");
            bom.setQtyRequired(qty);
        }
        if (body.containsKey("unit"))
            bom.setUnit(body.get("unit") == null ? null : body.get("unit").toString());
        applyBomRecipeFields(bom, body);
        bomRepo.save(bom);
        return ok("BOM line updated");
    }

    @DeleteMapping("/{id}/bom/{bomId}")
    @Transactional
    public ResponseEntity<?> deleteBom(@PathVariable String id, @PathVariable String bomId) {
        auth.requirePermission("BOM:DELETE");
        bomRepo.deleteByIdAndFinishedGoodId(bomId, id);
        return ok("BOM item deleted");
    }

    private Map<String, Object> toDto(Product p) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", p.getId());
        dto.put("code", p.getCode());
        dto.put("name", p.getName());
        dto.put("type", p.getType().name());
        dto.put("unit", p.getUnit());
        dto.put("category", p.getCategory() != null ? p.getCategory() : "");
        dto.put("description", p.getDescription() != null ? p.getDescription() : "");
        dto.put("min_stock", p.getMinStock());
        dto.put("deduction_value", p.getDeductionValue());
        dto.put("selling_price", p.getSellingPrice());
        dto.put("cost_price", p.getCostPrice());
        dto.put("pack_size_g", p.getPackSizeG());
        dto.put("packs_per_kg", p.getPacksPerKg());
        dto.put("batch_size_kg", p.getBatchSizeKg());
        dto.put("pcs_per_innerbag", p.getPcsPerInnerbag());
        dto.put("innerbags_per_bag", p.getInnerbagsPerBag());
        dto.put("pcs_per_bag", p.getPcsPerBag());
        dto.put("process_notes", p.getProcessNotes() != null ? p.getProcessNotes() : "");
        dto.put("is_active", p.isActive());
        dto.put("created_at", p.getCreatedAt() != null ? p.getCreatedAt().toString() : "");

        // E-commerce fields mapping
        dto.put("image_url", p.getImageUrl() != null ? p.getImageUrl() : "");
        dto.put("brand", p.getBrand() != null ? p.getBrand() : "");
        dto.put("tags", p.getTags() != null ? p.getTags() : "");
        dto.put("weight", p.getWeight());
        dto.put("dimensions", p.getDimensions() != null ? p.getDimensions() : "");
        dto.put("barcode", p.getBarcode() != null ? p.getBarcode() : "");
        dto.put("discount_price", p.getDiscountPrice());
        dto.put("wholesale_price", p.getWholesalePrice());
        dto.put("gst_percent", p.getGstPercent());
        dto.put("min_order_qty", p.getMinOrderQty());
        dto.put("max_order_qty", p.getMaxOrderQty());
        dto.put("specifications", p.getSpecifications() != null ? p.getSpecifications() : "");
        dto.put("gallery_images", p.getGalleryImages() != null ? p.getGalleryImages() : "");
        dto.put("short_description", p.getShortDescription() != null ? p.getShortDescription() : "");
        dto.put("country_of_origin", p.getCountryOfOrigin() != null ? p.getCountryOfOrigin() : "");
        dto.put("shelf_life", p.getShelfLife() != null ? p.getShelfLife() : "");
        dto.put("ingredients", p.getIngredients() != null ? p.getIngredients() : "");
        dto.put("tax_inclusive", p.getTaxInclusive());
        dto.put("show_on_storefront", p.getShowOnStorefront());
        dto.put("best_seller", p.getBestSeller());
        dto.put("new_arrival", p.getNewArrival());
        dto.put("trending", p.getTrending());
        dto.put("todays_deal", p.getTodaysDeal());
        dto.put("sale_product", p.getSaleProduct());
        dto.put("published", p.getPublished());
        dto.put("is_featured", p.getIsFeatured());
        return dto;
    }

    /** Apply pack configuration fields from request body to a Product. */
    private void applyPackConfig(Product p, Map<String, Object> body) {
        if (body.containsKey("pack_size_g")) {
            p.setPackSizeG(getDouble(body.get("pack_size_g")));
        }
        if (body.containsKey("packs_per_kg")) {
            p.setPacksPerKg(getDouble(body.get("packs_per_kg")));
        }
        if (body.containsKey("batch_size_kg")) {
            p.setBatchSizeKg(getDouble(body.get("batch_size_kg")));
        }
        if (body.containsKey("pcs_per_innerbag")) {
            p.setPcsPerInnerbag(getInteger(body.get("pcs_per_innerbag")));
        }
        if (body.containsKey("innerbags_per_bag")) {
            p.setInnerbagsPerBag(getInteger(body.get("innerbags_per_bag")));
        }
        if (body.containsKey("pcs_per_bag")) {
            p.setPcsPerBag(getInteger(body.get("pcs_per_bag")));
        }
        if (body.containsKey("process_notes")) {
            Object notes = body.get("process_notes");
            p.setProcessNotes(notes == null ? null : notes.toString());
        }
    }

    private void applyEcomConfig(Product p, Map<String, Object> body) {
        if (body.containsKey("image_url")) p.setImageUrl(body.get("image_url") == null ? null : body.get("image_url").toString());
        if (body.containsKey("brand")) p.setBrand(body.get("brand") == null ? null : body.get("brand").toString());
        if (body.containsKey("tags")) p.setTags(body.get("tags") == null ? null : body.get("tags").toString());
        if (body.containsKey("weight")) p.setWeight(getDouble(body.get("weight")));
        if (body.containsKey("dimensions")) p.setDimensions(body.get("dimensions") == null ? null : body.get("dimensions").toString());
        if (body.containsKey("barcode")) p.setBarcode(body.get("barcode") == null ? null : body.get("barcode").toString());
        if (body.containsKey("discount_price")) p.setDiscountPrice(getDouble(body.get("discount_price")));
        if (body.containsKey("wholesale_price")) p.setWholesalePrice(getDouble(body.get("wholesale_price")));
        if (body.containsKey("gst_percent")) p.setGstPercent(getDouble(body.get("gst_percent")));
        if (body.containsKey("min_order_qty")) p.setMinOrderQty(getInteger(body.get("min_order_qty")));
        if (body.containsKey("max_order_qty")) p.setMaxOrderQty(getInteger(body.get("max_order_qty")));
        if (body.containsKey("specifications")) p.setSpecifications(body.get("specifications") == null ? null : body.get("specifications").toString());
        if (body.containsKey("gallery_images")) p.setGalleryImages(body.get("gallery_images") == null ? null : body.get("gallery_images").toString());
        if (body.containsKey("short_description")) p.setShortDescription(body.get("short_description") == null ? null : body.get("short_description").toString());
        if (body.containsKey("country_of_origin")) p.setCountryOfOrigin(body.get("country_of_origin") == null ? null : body.get("country_of_origin").toString());
        if (body.containsKey("shelf_life")) p.setShelfLife(body.get("shelf_life") == null ? null : body.get("shelf_life").toString());
        if (body.containsKey("ingredients")) p.setIngredients(body.get("ingredients") == null ? null : body.get("ingredients").toString());
        if (body.containsKey("tax_inclusive")) p.setTaxInclusive(Boolean.TRUE.equals(body.get("tax_inclusive")));
        if (body.containsKey("show_on_storefront")) p.setShowOnStorefront(Boolean.TRUE.equals(body.get("show_on_storefront")));
        if (body.containsKey("best_seller")) p.setBestSeller(Boolean.TRUE.equals(body.get("best_seller")));
        if (body.containsKey("new_arrival")) p.setNewArrival(Boolean.TRUE.equals(body.get("new_arrival")));
        if (body.containsKey("trending")) p.setTrending(Boolean.TRUE.equals(body.get("trending")));
        if (body.containsKey("todays_deal")) p.setTodaysDeal(Boolean.TRUE.equals(body.get("todays_deal")));
        if (body.containsKey("sale_product")) p.setSaleProduct(Boolean.TRUE.equals(body.get("sale_product")));
        if (body.containsKey("published")) p.setPublished(Boolean.TRUE.equals(body.get("published")));
        if (body.containsKey("is_featured")) p.setIsFeatured(Boolean.TRUE.equals(body.get("is_featured")));
    }

    /**
     * Apply BOM recipe fields (production_step, blend_pct, notes) from request body
     * to a Bom line.
     */
    private void applyBomRecipeFields(Bom bom, Map<String, Object> body) {
        if (body.containsKey("production_step")) {
            Object stepObj = body.get("production_step");
            String step = stepObj == null ? null : stepObj.toString();
            if (step == null || step.isBlank()) {
                bom.setProductionStep(null);
            } else {
                try {
                    bom.setProductionStep(Bom.ProductionStep.valueOf(step.toUpperCase().trim()));
                } catch (IllegalArgumentException ignored) {
                }
            }
        }
        if (body.containsKey("blend_pct")) {
            bom.setBlendPct(getDouble(body.get("blend_pct")));
        }
        if (body.containsKey("notes")) {
            Object notes = body.get("notes");
            bom.setNotes(notes == null ? null : notes.toString());
        }
    }

    @PostMapping("/bulk")
    @Transactional
    public ResponseEntity<?> createBulk(@RequestBody List<Map<String, Object>> bodyList) {
        auth.requirePermission("PRODUCTS:CREATE");
        List<Map<String, Object>> errors = new ArrayList<>();
        List<Product> saved = new ArrayList<>();

        for (int i = 0; i < bodyList.size(); i++) {
            Map<String, Object> body = bodyList.get(i);
            int rowNum = i + 1;

            String code = (body.get("code") == null ? "" : body.get("code").toString()).toUpperCase().trim();
            String name = body.get("name") == null ? null : body.get("name").toString();
            String type = body.get("type") == null ? null : body.get("type").toString();

            if (code.isEmpty() || name == null || type == null) {
                errors.add(Map.of("row", rowNum, "error", "code, name, and type are required"));
                continue;
            }
            if (!Set.of("FINISHED_GOOD", "RAW_MATERIAL", "BLEND", "TOOL").contains(type)) {
                errors.add(Map.of("row", rowNum, "error", "type must be FINISHED_GOOD, RAW_MATERIAL, BLEND, or TOOL"));
                continue;
            }
            if (productRepo.existsByCode(code)) {
                errors.add(Map.of("row", rowNum, "error", "Product code '" + code + "' already exists"));
                continue;
            }

            Product p = new Product();
            p.setCode(code);
            p.setName(name);
            p.setType(Product.Type.valueOf(type));
            p.setUnit(body.get("unit") != null ? body.get("unit").toString() : "PCS");
            p.setDescription(body.get("description") == null ? null : body.get("description").toString());
            p.setCategory(body.get("category") == null ? null : body.get("category").toString());
            Double ms = getDouble(body.get("min_stock"));
            p.setMinStock(ms != null ? ms : 0.0);
            Double dv = getDouble(body.get("deduction_value"));
            p.setDeductionValue(dv != null ? dv : 0.0);
            p.setActive(true);

            productRepo.save(p);
            saved.add(p);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", errors.isEmpty());
        result.put("imported", saved.size());
        result.put("failed", errors.size());
        result.put("errors", errors);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/next-code")
    public ResponseEntity<?> getNextCode(@RequestParam String type) {
        auth.requirePermission("PRODUCTS:VIEW");
        String prefix = "FINISHED_GOOD".equals(type) ? "FG-"
                : "RAW_MATERIAL".equals(type) ? "RM-" : "BLEND".equals(type) ? "BL-" : "TL-";

        List<Product> products = productRepo.findAll();
        int maxNum = 0;
        for (Product p : products) {
            String code = p.getCode();
            if (code != null && code.toUpperCase().startsWith(prefix)) {
                String suffix = code.substring(prefix.length()).trim();
                suffix = suffix.replaceAll("\\D", "");
                if (!suffix.isEmpty()) {
                    try {
                        int num = Integer.parseInt(suffix);
                        if (num > maxNum)
                            maxNum = num;
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }
        String nextCode = prefix + String.format("%03d", maxNum + 1);
        return ResponseEntity.ok(Map.of("success", true, "code", nextCode));
    }

    @GetMapping("/template")
    public ResponseEntity<?> getTemplate() {
        auth.requirePermission("PRODUCTS:VIEW");
        String csv = "code,name,type,unit,description,category,min_stock,deduction_value\n" +
                "FG-999,Sample Product,FINISHED_GOOD,PCS,Optional description,Optional category,0,0\n";
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=products_template.csv")
                .contentType(org.springframework.http.MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    @PostMapping("/import")
    @Transactional
    public ResponseEntity<?> importCsv(@RequestParam("file") MultipartFile file) {
        auth.requirePermission("PRODUCTS:CREATE");
        if (file.isEmpty())
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Uploaded file is empty"));

        List<Map<String, Object>> errors = new ArrayList<>();
        List<Product> createdProducts = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String headerLine = reader.readLine();
            if (headerLine == null)
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "message", "CSV file has no header row"));

            String line;
            int rowNum = 1;
            while ((line = reader.readLine()) != null) {
                rowNum++;
                if (line.isBlank())
                    continue;
                String[] cols = parseCsvLine(line);

                String code = cols.length > 0 ? cols[0].toUpperCase().trim() : "";
                String name = cols.length > 1 ? cols[1].trim() : "";
                String typeStr = cols.length > 2 ? cols[2].toUpperCase().trim() : "";
                String unit = cols.length > 3 ? cols[3].trim() : "PCS";
                String description = cols.length > 4 ? cols[4].trim() : "";
                String category = cols.length > 5 ? cols[5].trim() : "";
                String minStockStr = cols.length > 6 ? cols[6].trim() : "0";
                String dedValueStr = cols.length > 7 ? cols[7].trim() : "0";

                if (code.isEmpty()) {
                    errors.add(Map.of("row", rowNum, "error", "code is missing"));
                    continue;
                }
                if (name.isEmpty()) {
                    errors.add(Map.of("row", rowNum, "error", "name is missing"));
                    continue;
                }
                if (typeStr.isEmpty()) {
                    errors.add(Map.of("row", rowNum, "error", "type is missing"));
                    continue;
                }

                Product.Type type;
                try {
                    type = Product.Type.valueOf(typeStr);
                } catch (IllegalArgumentException e) {
                    errors.add(Map.of("row", rowNum, "error",
                            "Invalid type: " + typeStr + ". Must be FINISHED_GOOD, RAW_MATERIAL, BLEND, or TOOL"));
                    continue;
                }

                if (productRepo.existsByCode(code)) {
                    errors.add(Map.of("row", rowNum, "error", "Product code '" + code + "' already exists"));
                    continue;
                }

                double minStock = 0.0;
                try {
                    if (!minStockStr.isEmpty())
                        minStock = Double.parseDouble(minStockStr);
                } catch (NumberFormatException e) {
                    errors.add(Map.of("row", rowNum, "error", "Invalid min_stock: " + minStockStr));
                    continue;
                }

                double deductionValue = 0.0;
                try {
                    if (!dedValueStr.isEmpty())
                        deductionValue = Double.parseDouble(dedValueStr);
                } catch (NumberFormatException e) {
                    errors.add(Map.of("row", rowNum, "error", "Invalid deduction_value: " + dedValueStr));
                    continue;
                }

                Product p = new Product();
                p.setCode(code);
                p.setName(name);
                p.setType(type);
                p.setUnit(unit.isEmpty() ? "PCS" : unit);
                p.setDescription(description.isEmpty() ? null : description);
                p.setCategory(category.isEmpty() ? null : category);
                p.setMinStock(minStock);
                p.setDeductionValue(deductionValue);
                p.setActive(true);
                productRepo.save(p);
                createdProducts.add(p);
            }
        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body(Map.of("success", false, "message", "Failed to parse CSV: " + e.getMessage()));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("imported", createdProducts.size());
        result.put("failed", errors.size());
        result.put("errors", errors);
        return ResponseEntity.ok(result);
    }

    private String[] parseCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        boolean inQuotes = false;
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    current.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                fields.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        fields.add(current.toString());
        return fields.toArray(new String[0]);
    }

    private ResponseEntity<?> ok(Object data) {
        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }

    private ResponseEntity<?> bad(String msg) {
        return ResponseEntity.badRequest().body(err(msg));
    }

    private Map<String, Object> err(String msg) {
        return Map.of("success", false, "message", msg);
    }
}
