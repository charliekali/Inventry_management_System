package com.ttrims.ims.controller;

import com.ttrims.ims.entity.*;
import com.ttrims.ims.repository.*;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/production-plans")
public class ProductionPlanController {

    private final ProductionPlanRepository planRepo;
    private final ProductionPlanIngredientRepository planIngRepo;
    private final StockBalanceRepository balanceRepo;
    private final ProductRepository productRepo;
    private final WarehouseRepository warehouseRepo;
    private final SectionRepository sectionRepo;
    private final UserRepository userRepo;
    private final StockTransactionRepository txRepo;
    private final AuthHelper auth;

    public ProductionPlanController(
            ProductionPlanRepository planRepo,
            ProductionPlanIngredientRepository planIngRepo,
            StockBalanceRepository balanceRepo,
            ProductRepository productRepo,
            WarehouseRepository warehouseRepo,
            SectionRepository sectionRepo,
            UserRepository userRepo,
            StockTransactionRepository txRepo,
            AuthHelper auth) {
        this.planRepo = planRepo;
        this.planIngRepo = planIngRepo;
        this.balanceRepo = balanceRepo;
        this.productRepo = productRepo;
        this.warehouseRepo = warehouseRepo;
        this.sectionRepo = sectionRepo;
        this.userRepo = userRepo;
        this.txRepo = txRepo;
        this.auth = auth;
    }

    // ─── POST /api/production-plans (Create a new Production Plan & Lock Stock) ───
    @PostMapping
    @Transactional
    public ResponseEntity<?> createPlan(@RequestBody Map<String, Object> body) {
        auth.requirePermission("PRODUCTION:RUN");

        String productId = (String) body.get("product_id");
        String warehouseId = (String) body.get("warehouse_id");
        String assignedUserId = (String) body.get("assigned_user_id");
        Object qtyObj = body.get("quantity");
        String dateStr = (String) body.get("plan_date");

        if (productId == null || warehouseId == null || assignedUserId == null || qtyObj == null || dateStr == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "product_id, warehouse_id, assigned_user_id, quantity, and plan_date are required"));
        }

        double quantity = ((Number) qtyObj).doubleValue();
        if (quantity <= 0) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Quantity must be positive"));
        }

        Product product = productRepo.findById(productId).orElse(null);
        if (product == null || !product.isActive()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Product not found"));
        }

        Warehouse warehouse = warehouseRepo.findById(warehouseId).orElse(null);
        if (warehouse == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Warehouse not found"));
        }

        User assignedUser = userRepo.findById(assignedUserId).orElse(null);
        if (assignedUser == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Assigned user not found"));
        }

        Section section = null;
        String sectionId = (String) body.get("section_id");
        if (sectionId != null && !sectionId.isBlank()) {
            section = sectionRepo.findById(sectionId).orElse(null);
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> ingredientInputs = (List<Map<String, Object>>) body.get("ingredients");
        if (ingredientInputs == null || ingredientInputs.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Ingredients allocation details are required"));
        }

        // 1. Validate ingredient stock availability (Available = Physical - Locked)
        List<Map<String, Object>> locksToApply = new ArrayList<>();
        for (var input : ingredientInputs) {
            String ingProductId = (String) input.get("product_id");
            String ingWarehouseId = (String) input.get("warehouse_id");
            String ingSectionId = (String) input.get("section_id");
            double ingQty = ((Number) input.get("quantity")).doubleValue();

            Product ingProduct = productRepo.findById(ingProductId).orElse(null);
            if (ingProduct == null) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Ingredient product not found"));
            }

            Warehouse ingWarehouse = warehouseRepo.findById(ingWarehouseId).orElse(null);
            if (ingWarehouse == null) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Ingredient warehouse not found"));
            }

            Section ingSection = null;
            if (ingSectionId != null && !ingSectionId.isBlank()) {
                ingSection = sectionRepo.findById(ingSectionId).orElse(null);
            }

            // Fetch balance
            StockBalance bal = balanceRepo.findByLocation(
                    ingProductId, ingWarehouseId, ingSection != null ? ingSection.getId() : null)
                    .orElse(null);

            double physicalStock = bal != null ? bal.getQuantity() : 0.0;
            double lockedStock = bal != null ? bal.getLockedQuantity() : 0.0;
            double availableStock = physicalStock - lockedStock;

            if (availableStock < ingQty) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message",
                        "Insufficient available stock for " + ingProduct.getName() + " (Available: " + availableStock + " " + ingProduct.getUnit() + ", Required: " + ingQty + ")"));
            }

            Map<String, Object> lockDetails = new HashMap<>();
            lockDetails.put("balance", bal);
            lockDetails.put("quantity", ingQty);
            lockDetails.put("product", ingProduct);
            lockDetails.put("warehouse", ingWarehouse);
            lockDetails.put("section", ingSection);
            locksToApply.add(lockDetails);
        }

        // 2. Create the Production Plan
        ProductionPlan plan = new ProductionPlan();
        plan.setPlanNumber("PLAN-" + System.currentTimeMillis());
        plan.setProduct(product);
        plan.setPlannedQuantity(quantity);
        plan.setWarehouse(warehouse);
        plan.setSection(section);
        plan.setAssignedUser(assignedUser);
        plan.setPlanDate(LocalDate.parse(dateStr));
        plan.setStatus("PLANNED");
        planRepo.save(plan);

        // 3. Apply locks and save ingredients
        for (var lock : locksToApply) {
            StockBalance bal = (StockBalance) lock.get("balance");
            double ingQty = (Double) lock.get("quantity");
            Product ingProduct = (Product) lock.get("product");
            Warehouse ingWarehouse = (Warehouse) lock.get("warehouse");
            Section ingSection = (Section) lock.get("section");

            // Increase locked quantity in StockBalance
            bal.setLockedQuantity(bal.getLockedQuantity() + ingQty);
            balanceRepo.save(bal);

            // Create plan ingredient
            ProductionPlanIngredient planIng = new ProductionPlanIngredient();
            planIng.setProductionPlan(plan);
            planIng.setProduct(ingProduct);
            planIng.setWarehouse(ingWarehouse);
            planIng.setSection(ingSection);
            planIng.setPlannedQuantity(ingQty);
            planIngRepo.save(planIng);
        }

        return ResponseEntity.status(201).body(Map.of(
                "success", true,
                "message", "Production plan created and stock locked successfully.",
                "plan_number", plan.getPlanNumber()
        ));
    }

    // ─── GET /api/production-plans (List all plans) ───
    @GetMapping
    public ResponseEntity<?> listPlans() {
        auth.requirePermission("PRODUCTION:HISTORY");
        List<ProductionPlan> plans = planRepo.findAllByOrderByPlanDateDesc();
        List<Map<String, Object>> dtoList = plans.stream().map(this::toPlanDto).collect(Collectors.toList());
        return ResponseEntity.ok(Map.of("success", true, "data", dtoList));
    }

    // ─── GET /api/production-plans/my-today (Check active plan for logged-in user) ───
    @GetMapping("/my-today")
    public ResponseEntity<?> getMyTodayPlan() {
        User me = auth.currentUser();
        List<ProductionPlan> plans = planRepo.findByAssignedUserIdAndPlanDate(me.getId(), LocalDate.now());
        
        // Find active/planned ones first
        Optional<ProductionPlan> activePlan = plans.stream()
                .filter(p -> "PLANNED".equals(p.getStatus()))
                .findFirst();

        if (activePlan.isPresent()) {
            return ResponseEntity.ok(Map.of("success", true, "hasPlan", true, "plan", toPlanDto(activePlan.get())));
        }
        
        // Fallback to any plan today (e.g. completed ones)
        if (!plans.isEmpty()) {
            return ResponseEntity.ok(Map.of("success", true, "hasPlan", true, "plan", toPlanDto(plans.get(0))));
        }

        return ResponseEntity.ok(Map.of("success", true, "hasPlan", false));
    }

    // ─── POST /api/production-plans/{id}/actual (Submit Actual Production Entry) ───
    @PostMapping("/{id}/actual")
    @Transactional
    public ResponseEntity<?> recordActual(@PathVariable String id, @RequestBody Map<String, Object> body) {
        auth.requirePermission("PRODUCTION:RUN");

        ProductionPlan plan = planRepo.findById(id).orElse(null);
        if (plan == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Production plan not found"));
        }

        if (!"PLANNED".equals(plan.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "This plan has already been processed or cancelled"));
        }

        Object actualQtyObj = body.get("actual_quantity");
        if (actualQtyObj == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "actual_quantity is required"));
        }

        double actualQty = ((Number) actualQtyObj).doubleValue();
        if (actualQty <= 0) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Actual quantity must be positive"));
        }

        if (actualQty > plan.getPlannedQuantity()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Actual quantity cannot exceed planned quantity of " + plan.getPlannedQuantity()));
        }

        // Calculate proportional factor
        double ratio = actualQty / plan.getPlannedQuantity();

        List<ProductionPlanIngredient> ingredients = planIngRepo.findByProductionPlanId(plan.getId());
        List<StockTransaction> transactionsToSave = new ArrayList<>();

        // 1. Process Raw Materials: Stock Out of actual consumed, unlock planned
        for (ProductionPlanIngredient ing : ingredients) {
            double actualConsumed = Math.round((ing.getPlannedQuantity() * ratio) * 1000.0) / 1000.0;
            ing.setActualQuantity(actualConsumed);
            planIngRepo.save(ing);

            // Fetch balance to deduct physical quantity and unlock planned quantity
            StockBalance bal = balanceRepo.findByLocation(
                    ing.getProduct().getId(),
                    ing.getWarehouse().getId(),
                    ing.getSection() != null ? ing.getSection().getId() : null)
                    .orElse(null);

            if (bal != null) {
                // Deduct physical quantity
                bal.setQuantity(Math.max(0.0, bal.getQuantity() - actualConsumed));
                // Unlock planned quantity
                bal.setLockedQuantity(Math.max(0.0, bal.getLockedQuantity() - ing.getPlannedQuantity()));
                balanceRepo.save(bal);
            }

            // Save Stock Out transaction
            StockTransaction txOut = new StockTransaction();
            txOut.setType(StockTransaction.Type.OUT);
            txOut.setProduct(ing.getProduct());
            txOut.setWarehouse(ing.getWarehouse());
            txOut.setSection(ing.getSection());
            txOut.setQuantity(actualConsumed);
            txOut.setUnit(ing.getProduct().getUnit());
            txOut.setReferenceDoc(plan.getPlanNumber());
            txOut.setRemarks(String.format("Consumed for actual production of %s (Plan: %s)", plan.getProduct().getName(), plan.getPlanNumber()));
            txOut.setPerformedBy(auth.currentUser());
            txOut.setTransactionDate(LocalDate.now());

            Map<String, String> customMap = new HashMap<>();
            customMap.put("production_plan_id", plan.getId());
            customMap.put("parent_product_id", plan.getProduct().getId());
            customMap.put("parent_product_name", plan.getProduct().getName());
            txOut.setCustomFields(customMap);

            transactionsToSave.add(txOut);
        }

        // 2. Process Finished Good: Stock In (GR)
        StockBalance fgBal = balanceRepo.findByLocation(
                plan.getProduct().getId(),
                plan.getWarehouse().getId(),
                plan.getSection() != null ? plan.getSection().getId() : null)
                .orElse(null);

        if (fgBal == null) {
            fgBal = new StockBalance();
            fgBal.setProduct(plan.getProduct());
            fgBal.setWarehouse(plan.getWarehouse());
            fgBal.setSection(plan.getSection());
            fgBal.setQuantity(0.0);
            fgBal.setLockedQuantity(0.0);
        }
        fgBal.setQuantity(fgBal.getQuantity() + actualQty);
        balanceRepo.save(fgBal);

        // Save Stock In transaction
        StockTransaction txIn = new StockTransaction();
        txIn.setType(StockTransaction.Type.IN);
        txIn.setProduct(plan.getProduct());
        txIn.setWarehouse(plan.getWarehouse());
        txIn.setSection(plan.getSection());
        txIn.setQuantity(actualQty);
        txIn.setUnit(plan.getProduct().getUnit());
        txIn.setReferenceDoc(plan.getPlanNumber());
        txIn.setRemarks(String.format("Produced via Actual Entry (Plan: %s)", plan.getPlanNumber()));
        txIn.setPerformedBy(auth.currentUser());
        txIn.setTransactionDate(LocalDate.now());

        Map<String, String> customMap = new HashMap<>();
        customMap.put("production_plan_id", plan.getId());
        txIn.setCustomFields(customMap);

        transactionsToSave.add(txIn);

        // Save all transactions with GR numbers
        String baseGr = "GR-" + System.currentTimeMillis();
        for (int i = 0; i < transactionsToSave.size(); i++) {
            var tx = transactionsToSave.get(i);
            tx.setGrNumber(baseGr + "-" + (i + 1));
            txRepo.save(tx);
        }

        // 3. Update Plan Status
        plan.setActualQuantity(actualQty);
        plan.setStatus("COMPLETED");
        planRepo.save(plan);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Actual production recorded, stock deducted, and GR completed successfully.",
                "gr_number", baseGr
        ));
    }

    // ─── DTO Helpers ──────────────────────────────────────────────────────────
    private Map<String, Object> toPlanDto(ProductionPlan p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.getId());
        m.put("plan_number", p.getPlanNumber());
        m.put("product_id", p.getProduct().getId());
        m.put("product_name", p.getProduct().getName());
        m.put("product_code", p.getProduct().getCode());
        m.put("product_unit", p.getProduct().getUnit());
        m.put("planned_quantity", p.getPlannedQuantity());
        m.put("actual_quantity", p.getActualQuantity());
        m.put("warehouse_id", p.getWarehouse().getId());
        m.put("warehouse_name", p.getWarehouse().getName());
        m.put("section_id", p.getSection() != null ? p.getSection().getId() : null);
        m.put("section_name", p.getSection() != null ? p.getSection().getName() : null);
        m.put("assigned_user_id", p.getAssignedUser().getId());
        m.put("assigned_user_name", p.getAssignedUser().getName());
        m.put("plan_date", p.getPlanDate().toString());
        m.put("status", p.getStatus());
        m.put("created_at", p.getCreatedAt());

        // Include ingredients
        List<ProductionPlanIngredient> ingredients = planIngRepo.findByProductionPlanId(p.getId());
        List<Map<String, Object>> ingList = ingredients.stream().map(ing -> {
            Map<String, Object> im = new LinkedHashMap<>();
            im.put("id", ing.getId());
            im.put("product_id", ing.getProduct().getId());
            im.put("product_name", ing.getProduct().getName());
            im.put("product_code", ing.getProduct().getCode());
            im.put("product_unit", ing.getProduct().getUnit());
            im.put("warehouse_id", ing.getWarehouse().getId());
            im.put("warehouse_name", ing.getWarehouse().getName());
            im.put("section_id", ing.getSection() != null ? ing.getSection().getId() : null);
            im.put("section_name", ing.getSection() != null ? ing.getSection().getName() : null);
            im.put("planned_quantity", ing.getPlannedQuantity());
            im.put("actual_quantity", ing.getActualQuantity());
            return im;
        }).collect(Collectors.toList());
        m.put("ingredients", ingList);

        return m;
    }
}
