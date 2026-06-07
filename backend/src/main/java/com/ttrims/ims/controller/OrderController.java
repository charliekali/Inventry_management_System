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
@RequestMapping("/api/orders")
public class OrderController {
    private final OrderRepository orderRepo;
    private final ProductRepository productRepo;
    private final BomRepository bomRepo;
    private final StockBalanceRepository balanceRepo;
    private final AuthHelper auth;

    public OrderController(OrderRepository orderRepo, ProductRepository productRepo, BomRepository bomRepo, StockBalanceRepository balanceRepo, AuthHelper auth) {
        this.orderRepo = orderRepo;
        this.productRepo = productRepo;
        this.bomRepo = bomRepo;
        this.balanceRepo = balanceRepo;
        this.auth = auth;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list() {
        auth.requirePermission("ORDERS:VIEW");
        var orders = orderRepo.findAllByOrderByCreatedAtDesc().stream().map(this::toDto).collect(Collectors.toList());
        return ok(orders);
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> get(@PathVariable String id) {
        auth.requirePermission("ORDERS:VIEW");
        Order order = orderRepo.findById(id).orElse(null);
        if (order == null) return ResponseEntity.status(404).body(err("Order not found"));
        var dto = toDto(order);
        dto.put("items", order.getItems().stream().map(i -> Map.of(
            "id", i.getId(), "product_id", i.getProduct().getId(),
            "product_name", i.getProduct().getName(), "product_code", i.getProduct().getCode(),
            "product_type", i.getProduct().getType().name(),
            "qty_required", i.getQtyRequired(), "unit", i.getUnit()
        )).collect(Collectors.toList()));
        return ok(dto);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        auth.requirePermission("ORDERS:CREATE");
        String customer = (String) body.get("customer");
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("items");
        if (customer == null || items == null || items.isEmpty()) return bad("customer and items are required");

        Order order = new Order();
        order.setOrderNumber("ORD-" + System.currentTimeMillis());
        order.setCustomer(customer);
        order.setRemarks((String) body.get("remarks"));
        order.setCreatedBy(auth.currentUser());
        order.setStatus(Order.Status.PENDING);

        @SuppressWarnings("unchecked")
        Map<String, String> customFields = (Map<String, String>) body.get("custom_fields");
        if (customFields != null) {
            order.setCustomFields(customFields);
        }

        for (var item : items) {
            Product p = productRepo.findById((String) item.get("product_id")).orElse(null);
            if (p != null) {
                OrderItem oi = new OrderItem();
                oi.setOrder(order);
                oi.setProduct(p);
                oi.setQtyRequired(((Number) item.get("qty_required")).doubleValue());
                oi.setUnit((String) item.getOrDefault("unit", p.getUnit()));
                order.getItems().add(oi);
            }
        }
        orderRepo.save(order);
        return ResponseEntity.status(201).body(Map.of("success", true, "data", toDto(order)));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable String id, @RequestBody Map<String, String> body) {
        auth.requirePermission("ORDERS:EDIT");
        Order order = orderRepo.findById(id).orElse(null);
        if (order == null) return ResponseEntity.status(404).body(err("Order not found"));
        try {
            order.setStatus(Order.Status.valueOf(body.get("status")));
            orderRepo.save(order);
            return ok("Order status updated");
        } catch (IllegalArgumentException e) {
            return bad("Invalid status");
        }
    }

    private Map<String, Object> analyzeItemRecursive(String productId, double qtyNeeded, Set<String> visited) {
        Product product = productRepo.findById(productId).orElse(null);
        if (product == null) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("error", "Product not found");
            return err;
        }

        double availableStock = Optional.ofNullable(balanceRepo.sumByProductId(productId)).orElse(0.0);
        double shortfall = Math.max(0, qtyNeeded - availableStock);
        boolean sufficientDirectly = availableStock >= qtyNeeded;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("product_id", productId);
        result.put("product_name", product.getName());
        result.put("product_code", product.getCode());
        result.put("product_type", product.getType().name());
        result.put("unit", product.getUnit());
        result.put("qty_needed_for_shortfall", Math.round(qtyNeeded * 1000.0) / 1000.0);
        result.put("qty_available", Math.round(availableStock * 1000.0) / 1000.0);
        result.put("shortfall", Math.round(shortfall * 1000.0) / 1000.0);
        result.put("sufficient_for_shortfall", sufficientDirectly);
        result.put("sufficient_directly", sufficientDirectly);

        // Pack configuration fields
        result.put("pack_size_g", product.getPackSizeG());
        result.put("packs_per_kg", product.getPacksPerKg());
        result.put("batch_size_kg", product.getBatchSizeKg());
        result.put("process_notes", product.getProcessNotes() != null ? product.getProcessNotes() : "");

        List<Bom> bomItems = bomRepo.findByFinishedGoodId(productId);
        boolean hasBom = !bomItems.isEmpty();
        result.put("has_bom", hasBom);

        if (hasBom && shortfall > 0) {
            if (visited.contains(productId)) {
                result.put("error", "Circular BOM dependency detected");
                result.put("sufficient_with_production", false);
                result.put("producible_units", 0.0);
                return result;
            }
            visited.add(productId);

            List<Map<String, Object>> subAnalysisList = new ArrayList<>();
            double minProducible = Double.MAX_VALUE;
            boolean allIngredientsOk = true;

            for (Bom bom : bomItems) {
                Product subRm = bom.getRawMaterial();
                double qtyPerUnit = bom.getQtyRequired();
                double rmAvailable = Optional.ofNullable(balanceRepo.sumByProductId(subRm.getId())).orElse(0.0);

                double subRmNeeded = qtyPerUnit * shortfall;

                Map<String, Object> subRmResult = analyzeItemRecursive(subRm.getId(), subRmNeeded, new HashSet<>(visited));
                
                Map<String, Object> bomLine = new LinkedHashMap<>(subRmResult);
                bomLine.put("qty_per_unit", qtyPerUnit);
                bomLine.put("production_step", bom.getProductionStep() != null ? bom.getProductionStep().name() : null);
                bomLine.put("blend_pct", bom.getBlendPct());
                bomLine.put("notes", bom.getNotes() != null ? bom.getNotes() : "");
                
                String cat = subRm.getCategory() != null ? subRm.getCategory().toLowerCase() : "";
                boolean isPackaging = cat.contains("packag");
                bomLine.put("is_packaging", isPackaging);

                double subRmAvailableForProduction = rmAvailable;
                if (subRmResult.containsKey("has_bom") && (boolean) subRmResult.get("has_bom")) {
                    subRmAvailableForProduction = rmAvailable + ((Number) subRmResult.get("producible_units")).doubleValue();
                }
                double possibleFromThisRm = qtyPerUnit > 0 ? subRmAvailableForProduction / qtyPerUnit : Double.MAX_VALUE;
                bomLine.put("max_producible_from_this_rm", Math.round(possibleFromThisRm * 1000.0) / 1000.0);

                minProducible = Math.min(minProducible, possibleFromThisRm);

                boolean subSufficient = (boolean) subRmResult.get("sufficient_directly") 
                    || (subRmResult.containsKey("sufficient_with_production") && (boolean) subRmResult.get("sufficient_with_production"));
                
                if (!subSufficient) {
                    allIngredientsOk = false;
                }

                subAnalysisList.add(bomLine);
            }

            double producibleUnits = minProducible == Double.MAX_VALUE ? 0.0 : minProducible;
            result.put("producible_units", Math.round(producibleUnits * 1000.0) / 1000.0);
            result.put("sub_analysis", subAnalysisList);
            result.put("rm_analysis", subAnalysisList);

            boolean sufficientWithProduction = producibleUnits >= shortfall;
            result.put("sufficient_with_production", sufficientWithProduction);
            result.put("all_ingredients_ok", allIngredientsOk);
        } else {
            result.put("producible_units", 0.0);
            result.put("sufficient_with_production", false);
            result.put("all_ingredients_ok", true);
            result.put("sub_analysis", new ArrayList<>());
            result.put("rm_analysis", new ArrayList<>());
        }

        return result;
    }

    @PostMapping("/feasibility")
    public ResponseEntity<?> checkFeasibility(@RequestBody Map<String, Object> body) {
        auth.requirePermission("ORDERS:CHECK_FEASIBILITY");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("items");
        if (items == null || items.isEmpty()) return bad("items array is required");

        List<Map<String, Object>> results = new ArrayList<>();
        String overallStatus = "FEASIBLE";

        for (var item : items) {
            String productId = (String) item.get("product_id");
            double qtyRequired = ((Number) item.get("qty_required")).doubleValue();

            Product product = productRepo.findById(productId).orElse(null);
            if (product == null) {
                results.add(Map.of("product_id", productId, "error", "Product not found"));
                continue;
            }

            Map<String, Object> analysis = analyzeItemRecursive(productId, qtyRequired, new HashSet<>());

            Map<String, Object> r = new LinkedHashMap<>();
            r.put("product_id", productId);
            r.put("product_name", product.getName());
            r.put("product_code", product.getCode());
            r.put("product_type", product.getType().name());
            r.put("unit", product.getUnit());
            r.put("qty_required", qtyRequired);

            r.put("pack_size_g", product.getPackSizeG());
            r.put("packs_per_kg", product.getPacksPerKg());
            r.put("batch_size_kg", product.getBatchSizeKg());
            r.put("process_notes", product.getProcessNotes() != null ? product.getProcessNotes() : "");

            double fgStock = (double) analysis.get("qty_available");
            double fgShortfall = (double) analysis.get("shortfall");
            boolean canFromFGStock = (boolean) analysis.get("sufficient_directly");

            r.put("fg_available", fgStock);
            r.put("fg_shortfall", fgShortfall);
            r.put("can_fulfill_from_stock", canFromFGStock);

            boolean hasBom = (boolean) analysis.get("has_bom");
            r.put("has_bom", hasBom);

            double producibleUnits = (double) analysis.get("producible_units");
            r.put("producible_units", producibleUnits);

            double producibleForShortfall = Math.min(producibleUnits, fgShortfall);
            r.put("producible_for_shortfall", Math.round(producibleForShortfall * 1000.0) / 1000.0);

            double totalAvailable = fgStock + producibleUnits;
            double remainingShortfall = Math.max(0, qtyRequired - totalAvailable);
            boolean canFulfillTotal = totalAvailable >= qtyRequired;

            r.put("total_available", Math.round(totalAvailable * 1000.0) / 1000.0);
            r.put("remaining_shortfall", Math.round(remainingShortfall * 1000.0) / 1000.0);
            r.put("can_fulfill_total", canFulfillTotal);
            r.put("can_fulfill_with_production", canFulfillTotal && hasBom);

            List<Map<String, Object>> ingredientAnalysis = new ArrayList<>();
            List<Map<String, Object>> packagingAnalysis  = new ArrayList<>();
            List<Map<String, Object>> subAnalysis = (List<Map<String, Object>>) analysis.get("sub_analysis");

            boolean allIngredientsOk = true;
            boolean allPackagingOk = true;
            boolean packagingPresent = false;

            if (subAnalysis != null) {
                for (var subItem : subAnalysis) {
                    boolean isPkg = (boolean) subItem.get("is_packaging");
                    boolean subSufficient = (boolean) subItem.get("sufficient_directly") 
                        || (subItem.containsKey("sufficient_with_production") && (boolean) subItem.get("sufficient_with_production"));
                    
                    if (isPkg) {
                        packagingPresent = true;
                        packagingAnalysis.add(subItem);
                        if (!subSufficient) allPackagingOk = false;
                    } else {
                        ingredientAnalysis.add(subItem);
                        if (!subSufficient) allIngredientsOk = false;
                    }
                }
            }

            r.put("all_ingredients_ok", allIngredientsOk);
            r.put("all_packaging_ok", allPackagingOk);
            r.put("packaging_present", packagingPresent);
            r.put("ingredient_analysis", ingredientAnalysis);
            r.put("packaging_analysis", packagingAnalysis);
            r.put("rm_analysis", subAnalysis != null ? subAnalysis : new ArrayList<>());

            Double batchRunsNeeded = null;
            if (product.getBatchSizeKg() != null && product.getBatchSizeKg() > 0) {
                double packsPerKgVal = 0.0;
                if (product.getPacksPerKg() != null && product.getPacksPerKg() > 0) {
                    packsPerKgVal = product.getPacksPerKg();
                } else if (product.getPackSizeG() != null && product.getPackSizeG() > 0) {
                    packsPerKgVal = 1000.0 / product.getPackSizeG();
                }
                if (packsPerKgVal > 0) {
                    double kgNeeded = fgShortfall / packsPerKgVal;
                    batchRunsNeeded = Math.ceil(kgNeeded / product.getBatchSizeKg());
                }
            }
            r.put("batch_runs_needed", batchRunsNeeded);

            String status;
            if (canFromFGStock) {
                status = "FEASIBLE";
            } else if (canFulfillTotal && hasBom) {
                if (packagingPresent && !allPackagingOk) {
                    status = "PARTIAL";
                    if ("FEASIBLE".equals(overallStatus)) overallStatus = "PARTIAL";
                } else {
                    status = "FEASIBLE_WITH_PRODUCTION";
                }
            } else if (totalAvailable > 0 || fgStock > 0) {
                status = "PARTIAL";
                if ("FEASIBLE".equals(overallStatus)) overallStatus = "PARTIAL";
            } else {
                status = "INSUFFICIENT";
                overallStatus = "INSUFFICIENT";
            }
            r.put("status", status);

            results.add(r);
        }

        long feasible        = results.stream().filter(r -> "FEASIBLE".equals(r.get("status"))).count();
        long partial         = results.stream().filter(r -> "PARTIAL".equals(r.get("status"))).count();
        long insufficient    = results.stream().filter(r -> "INSUFFICIENT".equals(r.get("status"))).count();
        long withProduction  = results.stream().filter(r -> "FEASIBLE_WITH_PRODUCTION".equals(r.get("status"))).count();

        return ok(Map.of(
            "overall_status", overallStatus,
            "items", results,
            "summary", Map.of(
                "total_items", results.size(),
                "feasible", feasible,
                "feasible_with_production", withProduction,
                "partial", partial,
                "insufficient", insufficient
            )
        ));
    }

    private boolean productUsesMaterialRecursive(String productId, Set<String> inputRmIds, Set<String> visited) {
        List<Bom> bomList = bomRepo.findByFinishedGoodId(productId);
        if (bomList.isEmpty()) {
            return false;
        }
        if (visited.contains(productId)) {
            return false;
        }
        visited.add(productId);
        for (Bom bom : bomList) {
            String rmId = bom.getRawMaterial().getId();
            if (inputRmIds.contains(rmId)) {
                return true;
            }
            if (productUsesMaterialRecursive(rmId, inputRmIds, new HashSet<>(visited))) {
                return true;
            }
        }
        return false;
    }

    private double getEffectiveAvailableQtyRecursive(String productId, Map<String, Double> effectiveQty, Set<String> visited) {
        double inHand = effectiveQty.getOrDefault(productId, 0.0);
        List<Bom> bomList = bomRepo.findByFinishedGoodId(productId);
        if (bomList.isEmpty()) {
            return inHand;
        }
        if (visited.contains(productId)) {
            return inHand;
        }
        visited.add(productId);
        
        double minPossible = Double.MAX_VALUE;
        boolean hasRawIngredients = false;
        
        for (Bom bom : bomList) {
            Product subRm = bom.getRawMaterial();
            double qtyPerUnit = bom.getQtyRequired();
            if (qtyPerUnit <= 0) continue;
            
            double subRmAvailable = getEffectiveAvailableQtyRecursive(subRm.getId(), effectiveQty, new HashSet<>(visited));
            double possibleFromThisRm = subRmAvailable / qtyPerUnit;
            minPossible = Math.min(minPossible, possibleFromThisRm);
            hasRawIngredients = true;
        }
        
        double producible = (hasRawIngredients && minPossible != Double.MAX_VALUE) ? minPossible : 0.0;
        return inHand + producible;
    }

    /**
     * POST /api/orders/production-yield
     *
     * Given a list of raw materials in hand (with optional wastage % and damage %),
     * calculate how many units of each Finished Good can be produced.
     *
     * Request body:
     * {
     *   "wastage_pct": 5.0,          // % lost to process wastage (e.g. 5 means 5%)
     *   "damage_pct": 2.0,           // % lost to damage/rejection (e.g. 2 means 2%)
     *   "raw_materials": [
     *     { "raw_material_id": "...", "qty_available": 100.0 },
     *     ...
     *   ]
     * }
     */
    @PostMapping("/production-yield")
    @Transactional(readOnly = true)
    public ResponseEntity<?> productionYield(@RequestBody Map<String, Object> body) {
        auth.requirePermission("ORDERS:CHECK_FEASIBILITY");

        double wastagePct = body.containsKey("wastage_pct")
            ? ((Number) body.get("wastage_pct")).doubleValue() : 0.0;
        double damagePct = body.containsKey("damage_pct")
            ? ((Number) body.get("damage_pct")).doubleValue() : 0.0;

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rmInputs = (List<Map<String, Object>>) body.get("raw_materials");
        if (rmInputs == null || rmInputs.isEmpty()) return bad("raw_materials list is required");

        // Build a map of rmId -> effective qty after wastage + damage
        double lossMultiplier = 1.0 - ((wastagePct + damagePct) / 100.0);
        Map<String, Double> effectiveQty = new LinkedHashMap<>();
        Map<String, Map<String, Object>> rmDetails = new LinkedHashMap<>();

        for (var rm : rmInputs) {
            String rmId = (String) rm.get("raw_material_id");
            double qtyRaw = ((Number) rm.get("qty_available")).doubleValue();
            Product rmProduct = productRepo.findById(rmId).orElse(null);
            if (rmProduct == null) continue;

            double wastageQty    = qtyRaw * (wastagePct / 100.0);
            double damageQty     = qtyRaw * (damagePct / 100.0);
            double effectiveQtyVal = Math.max(0, qtyRaw * lossMultiplier);
            effectiveQty.put(rmId, effectiveQtyVal);

            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("raw_material_id", rmId);
            detail.put("rm_name", rmProduct.getName());
            detail.put("rm_code", rmProduct.getCode());
            detail.put("unit", rmProduct.getUnit());
            detail.put("qty_raw", qtyRaw);
            detail.put("wastage_qty", Math.round(wastageQty * 1000.0) / 1000.0);
            detail.put("damage_qty", Math.round(damageQty * 1000.0) / 1000.0);
            detail.put("effective_qty", Math.round(effectiveQtyVal * 1000.0) / 1000.0);
            rmDetails.put(rmId, detail);
        }

        // For each finished good that has a BOM using any of these RMs, compute max producible units
        List<Product> allFGs = productRepo.findByActiveTrueOrderByTypeAscNameAsc()
            .stream().filter(p -> p.getType() == Product.Type.FINISHED_GOOD)
            .collect(Collectors.toList());

        List<Map<String, Object>> yieldResults = new ArrayList<>();

        for (Product fg : allFGs) {
            List<Bom> bomList = bomRepo.findByFinishedGoodId(fg.getId());
            if (bomList.isEmpty()) continue;

            // Check if any BOM RM (direct or indirect) is in our input set
            boolean anyMatch = productUsesMaterialRecursive(fg.getId(), effectiveQty.keySet(), new HashSet<>());
            if (!anyMatch) continue;

            // Max units = min over all BOM items of (recursiveAvailable / qtyPerUnit)
            double maxUnits = Double.MAX_VALUE;
            boolean hasAllMaterials = true;
            List<Map<String, Object>> bomBreakdown = new ArrayList<>();

            for (Bom bom : bomList) {
                String rmId = bom.getRawMaterial().getId();
                double qtyPerUnit = bom.getQtyRequired();
                double available = getEffectiveAvailableQtyRecursive(rmId, effectiveQty, new HashSet<>());
                double possibleFromThisRm = qtyPerUnit > 0 ? available / qtyPerUnit : Double.MAX_VALUE;

                Map<String, Object> bomLine = new LinkedHashMap<>();
                bomLine.put("rm_id", rmId);
                bomLine.put("rm_name", bom.getRawMaterial().getName());
                bomLine.put("rm_code", bom.getRawMaterial().getCode());
                bomLine.put("unit", bom.getUnit());
                bomLine.put("qty_per_unit_fg", qtyPerUnit);
                bomLine.put("effective_qty_available", Math.round(available * 1000.0) / 1000.0);
                bomLine.put("max_units_from_this_rm", Math.round(possibleFromThisRm * 1000.0) / 1000.0);
                
                boolean hasThisRm = effectiveQty.containsKey(rmId) || available > 0;
                bomLine.put("is_in_input", hasThisRm);

                if (!hasThisRm) {
                    hasAllMaterials = false;
                    bomLine.put("missing", true);
                } else {
                    maxUnits = Math.min(maxUnits, possibleFromThisRm);
                    bomLine.put("missing", false);
                }
                bomBreakdown.add(bomLine);
            }

            if (maxUnits == Double.MAX_VALUE) maxUnits = 0;

            // Total RM consumed if producing maxUnits
            List<Map<String, Object>> consumption = new ArrayList<>();
            for (Bom bom : bomList) {
                double consumed = bom.getQtyRequired() * maxUnits;
                Map<String, Object> c = new LinkedHashMap<>();
                c.put("rm_name", bom.getRawMaterial().getName());
                c.put("rm_code", bom.getRawMaterial().getCode());
                c.put("unit", bom.getUnit());
                c.put("qty_consumed", Math.round(consumed * 1000.0) / 1000.0);
                consumption.add(c);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("fg_id", fg.getId());
            result.put("fg_name", fg.getName());
            result.put("fg_code", fg.getCode());
            result.put("fg_unit", fg.getUnit());
            result.put("max_producible_units", Math.round(maxUnits * 1000.0) / 1000.0);
            result.put("max_full_batches", (long) Math.floor(maxUnits));
            result.put("has_all_materials", hasAllMaterials);
            result.put("wastage_pct", wastagePct);
            result.put("damage_pct", damagePct);
            result.put("bom_breakdown", bomBreakdown);
            result.put("rm_consumption", consumption);
            yieldResults.add(result);
        }

        // Sort: those with all materials first, then by max producible desc
        yieldResults.sort((a, b) -> {
            boolean aHas = (boolean) a.get("has_all_materials");
            boolean bHas = (boolean) b.get("has_all_materials");
            if (aHas != bHas) return aHas ? -1 : 1;
            double aMax = ((Number) a.get("max_producible_units")).doubleValue();
            double bMax = ((Number) b.get("max_producible_units")).doubleValue();
            return Double.compare(bMax, aMax);
        });

        return ok(Map.of(
            "wastage_pct", wastagePct,
            "damage_pct", damagePct,
            "loss_pct_total", wastagePct + damagePct,
            "raw_material_summary", new ArrayList<>(rmDetails.values()),
            "finished_goods_yield", yieldResults
        ));
    }

    private Map<String, Object> toDto(Order o) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", o.getId()); m.put("order_number", o.getOrderNumber());
        m.put("customer", o.getCustomer()); m.put("status", o.getStatus().name());
        m.put("remarks", o.getRemarks());
        m.put("created_by_name", o.getCreatedBy().getName());
        m.put("created_at", o.getCreatedAt() != null ? o.getCreatedAt().toString() : "");
        m.put("item_count", o.getItems().size());
        m.put("custom_fields", o.getCustomFields());
        return m;
    }

    private ResponseEntity<?> ok(Object data) { return ResponseEntity.ok(Map.of("success", true, "data", data)); }
    private ResponseEntity<?> bad(String msg) { return ResponseEntity.badRequest().body(err(msg)); }
    private Map<String, Object> err(String msg) { return Map.of("success", false, "message", msg); }
}
