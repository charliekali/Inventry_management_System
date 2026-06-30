package com.ttrims.ims.controller;

import com.ttrims.ims.entity.*;
import com.ttrims.ims.repository.*;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/products")
public class ProductController {
    private final ProductRepository productRepo;
    private final BomRepository bomRepo;
    private final StockBalanceRepository stockBalanceRepo;
    private final AuthHelper auth;

    public ProductController(ProductRepository productRepo, BomRepository bomRepo, StockBalanceRepository stockBalanceRepo, AuthHelper auth) {
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
        if (val == null) return null;
        if (val instanceof Number n) return n.doubleValue();
        if (val instanceof String s) {
            if (s.isBlank()) return null;
            try { return Double.parseDouble(s); }
            catch (NumberFormatException e) { return null; }
        }
        return null;
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        auth.requirePermission("PRODUCTS:CREATE");
        String code = (body.get("code") == null ? "" : body.get("code").toString()).toUpperCase().trim();
        String name = body.get("name") == null ? null : body.get("name").toString();
        String type = body.get("type") == null ? null : body.get("type").toString();

        if (code.isEmpty() || name == null || type == null) return bad("code, name, and type are required");
        if (!Set.of("FINISHED_GOOD","RAW_MATERIAL","BLEND","TOOL").contains(type)) return bad("type must be FINISHED_GOOD, RAW_MATERIAL, BLEND, or TOOL");
        if (productRepo.existsByCode(code)) return bad("Product code already exists");

        Product p = new Product();
        p.setCode(code);
        p.setName(name);
        p.setType(Product.Type.valueOf(type));
        p.setUnit(body.get("unit") != null ? body.get("unit").toString() : "PCS");
        p.setDescription(body.get("description") == null ? null : body.get("description").toString());
        p.setCategory(body.get("category") == null ? null : body.get("category").toString());
        Double ms = getDouble(body.get("min_stock"));
        p.setMinStock(ms != null ? ms : 0.0);
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
        p.setActive(true);
        productRepo.save(p);
        return ResponseEntity.status(201).body(Map.of("success", true, "data", toDto(p)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        auth.requirePermission("PRODUCTS:EDIT");
        Product p = productRepo.findById(id).orElse(null);
        if (p == null) return ResponseEntity.status(404).body(err("Product not found"));
        if (body.containsKey("name")) p.setName(body.get("name") == null ? null : body.get("name").toString());
        if (body.containsKey("unit")) p.setUnit(body.get("unit") == null ? null : body.get("unit").toString());
        if (body.containsKey("description")) p.setDescription(body.get("description") == null ? null : body.get("description").toString());
        if (body.containsKey("category")) p.setCategory(body.get("category") == null ? null : body.get("category").toString());
        if (body.containsKey("min_stock")) {
            Double ms = getDouble(body.get("min_stock"));
            p.setMinStock(ms != null ? ms : 0.0);
        }
        if (body.containsKey("is_active")) p.setActive(Boolean.TRUE.equals(body.get("is_active")));
        if (body.containsKey("selling_price") || body.containsKey("cost_price")) {
            Double newSelling = body.containsKey("selling_price") ? getDouble(body.get("selling_price")) : p.getSellingPrice();
            Double newCost = body.containsKey("cost_price") ? getDouble(body.get("cost_price")) : p.getCostPrice();
            if (!Objects.equals(newSelling, p.getSellingPrice()) || !Objects.equals(newCost, p.getCostPrice())) {
                auth.requireSuperAdmin();
            }
        }
        if (body.containsKey("selling_price")) p.setSellingPrice(getDouble(body.get("selling_price")));
        if (body.containsKey("cost_price")) p.setCostPrice(getDouble(body.get("cost_price")));
        applyPackConfig(p, body);
        productRepo.save(p);
        return ok(toDto(p));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id, @RequestParam(required = false, defaultValue = "false") boolean permanent) {
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
            productRepo.findById(id).ifPresent(p -> { p.setActive(false); productRepo.save(p); });
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
            m.put("raw_material_category", b.getRawMaterial().getCategory() != null ? b.getRawMaterial().getCategory() : "");
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
        if (fg == null || (fg.getType() != Product.Type.FINISHED_GOOD && fg.getType() != Product.Type.BLEND)) return bad("Finished Good or Blend not found");
        String rmId = body.get("raw_material_id") == null ? null : body.get("raw_material_id").toString();
        if (id.equals(rmId)) return bad("A product cannot be an ingredient of itself");
        Product rm = productRepo.findById(rmId).orElse(null);
        if (rm == null) return bad("Ingredient product not found");

        Bom bom = new Bom();
        bom.setFinishedGood(fg);
        bom.setRawMaterial(rm);
        Double qty = getDouble(body.get("qty_required"));
        if (qty == null) return bad("qty_required is required and must be a number");
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
        if (bom == null || !bom.getFinishedGood().getId().equals(id)) return bad("BOM line not found");
        if (body.containsKey("qty_required")) {
            Double qty = getDouble(body.get("qty_required"));
            if (qty == null) return bad("qty_required must be a number");
            bom.setQtyRequired(qty);
        }
        if (body.containsKey("unit")) bom.setUnit(body.get("unit") == null ? null : body.get("unit").toString());
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
        dto.put("selling_price", p.getSellingPrice());
        dto.put("cost_price", p.getCostPrice());
        dto.put("pack_size_g", p.getPackSizeG());
        dto.put("packs_per_kg", p.getPacksPerKg());
        dto.put("batch_size_kg", p.getBatchSizeKg());
        dto.put("process_notes", p.getProcessNotes() != null ? p.getProcessNotes() : "");
        dto.put("is_active", p.isActive());
        dto.put("created_at", p.getCreatedAt() != null ? p.getCreatedAt().toString() : "");
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
        if (body.containsKey("process_notes")) {
            Object notes = body.get("process_notes");
            p.setProcessNotes(notes == null ? null : notes.toString());
        }
    }

    /** Apply BOM recipe fields (production_step, blend_pct, notes) from request body to a Bom line. */
    private void applyBomRecipeFields(Bom bom, Map<String, Object> body) {
        if (body.containsKey("production_step")) {
            Object stepObj = body.get("production_step");
            String step = stepObj == null ? null : stepObj.toString();
            if (step == null || step.isBlank()) {
                bom.setProductionStep(null);
            } else {
                try { bom.setProductionStep(Bom.ProductionStep.valueOf(step.toUpperCase().trim())); }
                catch (IllegalArgumentException ignored) {}
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

    private ResponseEntity<?> ok(Object data) { return ResponseEntity.ok(Map.of("success", true, "data", data)); }
    private ResponseEntity<?> bad(String msg) { return ResponseEntity.badRequest().body(err(msg)); }
    private Map<String, Object> err(String msg) { return Map.of("success", false, "message", msg); }
}
