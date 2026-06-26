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

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        auth.requirePermission("PRODUCTS:CREATE");
        String code = ((String) body.getOrDefault("code","")).toUpperCase().trim();
        String name = (String) body.get("name");
        String type = (String) body.get("type");

        if (code.isEmpty() || name == null || type == null) return bad("code, name, and type are required");
        if (!Set.of("FINISHED_GOOD","RAW_MATERIAL").contains(type)) return bad("type must be FINISHED_GOOD or RAW_MATERIAL");
        if (productRepo.existsByCode(code)) return bad("Product code already exists");

        Product p = new Product();
        p.setCode(code);
        p.setName(name);
        p.setType(Product.Type.valueOf(type));
        p.setUnit((String) body.getOrDefault("unit", "PCS"));
        p.setDescription((String) body.get("description"));
        p.setCategory((String) body.get("category"));
        p.setMinStock(body.containsKey("min_stock") ? ((Number) body.get("min_stock")).doubleValue() : 0.0);
        if (body.containsKey("selling_price") || body.containsKey("cost_price")) {
            auth.requireSuperAdmin();
        }
        if (body.containsKey("selling_price")) p.setSellingPrice(body.get("selling_price") == null ? null : ((Number) body.get("selling_price")).doubleValue());
        if (body.containsKey("cost_price")) p.setCostPrice(body.get("cost_price") == null ? null : ((Number) body.get("cost_price")).doubleValue());
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
        if (body.containsKey("name")) p.setName((String) body.get("name"));
        if (body.containsKey("unit")) p.setUnit((String) body.get("unit"));
        if (body.containsKey("description")) p.setDescription((String) body.get("description"));
        if (body.containsKey("category")) p.setCategory((String) body.get("category"));
        if (body.containsKey("min_stock")) p.setMinStock(((Number) body.get("min_stock")).doubleValue());
        if (body.containsKey("is_active")) p.setActive((Boolean) body.get("is_active"));
        if (body.containsKey("selling_price") || body.containsKey("cost_price")) {
            Double newSelling = body.containsKey("selling_price") ? (body.get("selling_price") == null ? null : ((Number) body.get("selling_price")).doubleValue()) : p.getSellingPrice();
            Double newCost = body.containsKey("cost_price") ? (body.get("cost_price") == null ? null : ((Number) body.get("cost_price")).doubleValue()) : p.getCostPrice();
            if (!Objects.equals(newSelling, p.getSellingPrice()) || !Objects.equals(newCost, p.getCostPrice())) {
                auth.requireSuperAdmin();
            }
        }
        if (body.containsKey("selling_price")) p.setSellingPrice(body.get("selling_price") == null ? null : ((Number) body.get("selling_price")).doubleValue());
        if (body.containsKey("cost_price")) p.setCostPrice(body.get("cost_price") == null ? null : ((Number) body.get("cost_price")).doubleValue());
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
        if (fg == null || fg.getType() != Product.Type.FINISHED_GOOD) return bad("Finished Good not found");
        String rmId = (String) body.get("raw_material_id");
        if (id.equals(rmId)) return bad("A product cannot be an ingredient of itself");
        Product rm = productRepo.findById(rmId).orElse(null);
        if (rm == null) return bad("Ingredient product not found");

        Bom bom = new Bom();
        bom.setFinishedGood(fg);
        bom.setRawMaterial(rm);
        bom.setQtyRequired(((Number) body.get("qty_required")).doubleValue());
        bom.setUnit((String) body.getOrDefault("unit", rm.getUnit()));
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
        if (body.containsKey("qty_required")) bom.setQtyRequired(((Number) body.get("qty_required")).doubleValue());
        if (body.containsKey("unit")) bom.setUnit((String) body.get("unit"));
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
            Object v = body.get("pack_size_g");
            p.setPackSizeG(v == null ? null : ((Number) v).doubleValue());
        }
        if (body.containsKey("packs_per_kg")) {
            Object v = body.get("packs_per_kg");
            p.setPacksPerKg(v == null ? null : ((Number) v).doubleValue());
        }
        if (body.containsKey("batch_size_kg")) {
            Object v = body.get("batch_size_kg");
            p.setBatchSizeKg(v == null ? null : ((Number) v).doubleValue());
        }
        if (body.containsKey("process_notes")) p.setProcessNotes((String) body.get("process_notes"));
    }

    /** Apply BOM recipe fields (production_step, blend_pct, notes) from request body to a Bom line. */
    private void applyBomRecipeFields(Bom bom, Map<String, Object> body) {
        if (body.containsKey("production_step")) {
            String step = (String) body.get("production_step");
            if (step == null || step.isBlank()) {
                bom.setProductionStep(null);
            } else {
                try { bom.setProductionStep(Bom.ProductionStep.valueOf(step)); }
                catch (IllegalArgumentException ignored) {}
            }
        }
        if (body.containsKey("blend_pct")) {
            Object v = body.get("blend_pct");
            bom.setBlendPct(v == null ? null : ((Number) v).doubleValue());
        }
        if (body.containsKey("notes")) bom.setNotes((String) body.get("notes"));
    }

    private ResponseEntity<?> ok(Object data) { return ResponseEntity.ok(Map.of("success", true, "data", data)); }
    private ResponseEntity<?> bad(String msg) { return ResponseEntity.badRequest().body(err(msg)); }
    private Map<String, Object> err(String msg) { return Map.of("success", false, "message", msg); }
}
