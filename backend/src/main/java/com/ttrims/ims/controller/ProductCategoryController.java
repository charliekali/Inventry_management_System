package com.ttrims.ims.controller;

import com.ttrims.ims.entity.ProductCategory;
import com.ttrims.ims.repository.ProductCategoryRepository;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/product-categories")
public class ProductCategoryController {

    private final ProductCategoryRepository categoryRepo;
    private final AuthHelper auth;

    public ProductCategoryController(ProductCategoryRepository categoryRepo, AuthHelper auth) {
        this.categoryRepo = categoryRepo;
        this.auth = auth;
    }

    /**
     * GET /api/product-categories
     * Returns list grouped by category, accessible by anyone with PRODUCTS:VIEW
     */
    @GetMapping
    public ResponseEntity<?> list() {
        auth.requirePermission("PRODUCTS:VIEW");
        List<ProductCategory> all = categoryRepo.findByActiveTrueOrderByCategoryNameAscSortOrderAscSubcategoryNameAsc();

        // Group into { category: string, subcategories: string[] }
        Map<String, List<String>> grouped = new LinkedHashMap<>();
        for (ProductCategory pc : all) {
            grouped.computeIfAbsent(pc.getCategoryName(), k -> new ArrayList<>())
                   .add(pc.getSubcategoryName());
        }

        List<Map<String, Object>> result = grouped.entrySet().stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("category", e.getKey());
            m.put("subcategories", e.getValue());
            return m;
        }).collect(Collectors.toList());

        return ok(result);
    }

    /**
     * GET /api/product-categories/flat
     * Returns raw list of all entries (for admin management page)
     */
    @GetMapping("/flat")
    public ResponseEntity<?> flat() {
        auth.requirePermission("ROLES:VIEW");
        List<Map<String, Object>> result = categoryRepo
            .findByActiveTrueOrderByCategoryNameAscSortOrderAscSubcategoryNameAsc()
            .stream().map(this::toDto)
            .collect(Collectors.toList());
        return ok(result);
    }

    /**
     * POST /api/product-categories
     * Create a new subcategory entry — Super Admin only
     */
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        auth.requirePermission("ROLES:VIEW");
        String categoryName = ((String) body.getOrDefault("category_name", "")).trim();
        String subcategoryName = ((String) body.getOrDefault("subcategory_name", "")).trim();

        if (categoryName.isEmpty()) return bad("category_name is required");
        if (subcategoryName.isEmpty()) return bad("subcategory_name is required");
        if (categoryRepo.existsByCategoryNameAndSubcategoryName(categoryName, subcategoryName)) {
            return bad("This subcategory already exists under that category");
        }

        int sortOrder = body.containsKey("sort_order") ? ((Number) body.get("sort_order")).intValue() : 0;
        ProductCategory pc = new ProductCategory(categoryName, subcategoryName, sortOrder);
        categoryRepo.save(pc);
        return ResponseEntity.status(201).body(Map.of("success", true, "data", toDto(pc)));
    }

    /**
     * PATCH /api/product-categories/{id}
     * Update category/subcategory name — Super Admin only
     */
    @PatchMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        auth.requirePermission("ROLES:VIEW");
        ProductCategory pc = categoryRepo.findById(id).orElse(null);
        if (pc == null) return ResponseEntity.status(404).body(err("Category entry not found"));

        if (body.containsKey("category_name")) {
            String cn = ((String) body.get("category_name")).trim();
            if (!cn.isEmpty()) pc.setCategoryName(cn);
        }
        if (body.containsKey("subcategory_name")) {
            String sn = ((String) body.get("subcategory_name")).trim();
            if (!sn.isEmpty()) pc.setSubcategoryName(sn);
        }
        if (body.containsKey("sort_order")) {
            pc.setSortOrder(((Number) body.get("sort_order")).intValue());
        }
        categoryRepo.save(pc);
        return ok(toDto(pc));
    }

    /**
     * DELETE /api/product-categories/{id}
     * Soft-delete — Super Admin only
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        auth.requirePermission("ROLES:VIEW");
        categoryRepo.findById(id).ifPresent(pc -> { pc.setActive(false); categoryRepo.save(pc); });
        return ok("Subcategory deleted");
    }

    private Map<String, Object> toDto(ProductCategory pc) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", pc.getId());
        m.put("category_name", pc.getCategoryName());
        m.put("subcategory_name", pc.getSubcategoryName());
        m.put("sort_order", pc.getSortOrder());
        m.put("is_active", pc.isActive());
        return m;
    }

    private ResponseEntity<?> ok(Object data) { return ResponseEntity.ok(Map.of("success", true, "data", data)); }
    private ResponseEntity<?> bad(String msg) { return ResponseEntity.badRequest().body(err(msg)); }
    private Map<String, Object> err(String msg) { return Map.of("success", false, "message", msg); }
}
