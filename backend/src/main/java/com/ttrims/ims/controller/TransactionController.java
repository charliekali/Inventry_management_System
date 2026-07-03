package com.ttrims.ims.controller;

import com.ttrims.ims.entity.*;
import com.ttrims.ims.repository.*;
import com.ttrims.ims.service.AuthHelper;
import com.ttrims.ims.controller.ProductionOrderController;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {
    private final StockTransactionRepository txRepo;
    private final StockBalanceRepository balanceRepo;
    private final ProductRepository productRepo;
    private final WarehouseRepository warehouseRepo;
    private final SectionRepository sectionRepo;
    private final BomRepository bomRepo;
    private final AuthHelper auth;
    private final ProductionOrderRepository poRepo;
    private final ProductionOrderItemRepository itemRepo;
    private final ProductionOrderController poController;

    public TransactionController(StockTransactionRepository txRepo,
                                 StockBalanceRepository balanceRepo,
                                 ProductRepository productRepo,
                                 WarehouseRepository warehouseRepo,
                                 SectionRepository sectionRepo,
                                 BomRepository bomRepo,
                                 AuthHelper auth,
                                 ProductionOrderRepository poRepo,
                                 ProductionOrderItemRepository itemRepo,
                                 ProductionOrderController poController) {
        this.txRepo = txRepo;
        this.balanceRepo = balanceRepo;
        this.productRepo = productRepo;
        this.warehouseRepo = warehouseRepo;
        this.sectionRepo = sectionRepo;
        this.bomRepo = bomRepo;
        this.auth = auth;
        this.poRepo = poRepo;
        this.itemRepo = itemRepo;
        this.poController = poController;
    }

    @PostMapping("/in")
    @Transactional
    public ResponseEntity<?> stockIn(@RequestBody Map<String, Object> body) {
        auth.requirePermission("TRANSACTIONS:STOCK_IN");
        var result = processTransaction(body, StockTransaction.Type.IN);
        return result.containsKey("error")
            ? ResponseEntity.badRequest().body(Map.of("success", false, "message", result.get("error")))
            : ResponseEntity.status(201).body(Map.of("success", true, "data", result.get("tx"),
                "message", "Stock IN recorded. GR Number: " + result.get("grNumber")));
    }

    @PostMapping("/out")
    @Transactional
    public ResponseEntity<?> stockOut(@RequestBody Map<String, Object> body) {
        auth.requirePermission("TRANSACTIONS:STOCK_OUT");
        var result = processTransaction(body, StockTransaction.Type.OUT);
        return result.containsKey("error")
            ? ResponseEntity.badRequest().body(Map.of("success", false, "message", result.get("error")))
            : ResponseEntity.status(201).body(Map.of("success", true, "data", result.get("tx"),
                "message", "Stock OUT recorded. GR Number: " + result.get("grNumber")));
    }

    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String product_id,
            @RequestParam(required = false) String warehouse_id,
            @RequestParam(required = false) String date_from,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String date_to,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int limit) {
        auth.requirePermission("TRANSACTIONS:VIEW");

        StockTransaction.Type txType = type != null ? StockTransaction.Type.valueOf(type) : null;
        LocalDate from = date_from != null ? LocalDate.parse(date_from) : null;
        LocalDate to = date_to != null ? LocalDate.parse(date_to) : null;

        Page<StockTransaction> result = txRepo.findWithFilters(
            txType, product_id, warehouse_id, from, to, search,
            PageRequest.of(page - 1, limit));

        var items = result.getContent().stream().map(this::toDto).collect(Collectors.toList());
        return ResponseEntity.ok(Map.of("success", true, "data", items,
            "pagination", Map.of("total", result.getTotalElements(), "page", page,
                "limit", limit, "pages", result.getTotalPages())));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id) {
        auth.requirePermission("TRANSACTIONS:VIEW");
        return txRepo.findById(id)
            .map(tx -> ResponseEntity.ok(Map.of("success", true, "data", toDto(tx))))
            .orElse(ResponseEntity.status(404).body(Map.of("success", false, "message", "Transaction not found")));
    }

    private Map<String, Object> processTransaction(Map<String, Object> body, StockTransaction.Type type) {
        String productId = (String) body.get("product_id");
        String warehouseId = (String) body.get("warehouse_id");
        Object qtyObj = body.get("quantity");
        if (productId == null || warehouseId == null || qtyObj == null) {
            return Map.of("error", "product_id, warehouse_id, and quantity are required");
        }

        double quantity = ((Number) qtyObj).doubleValue();
        if (quantity <= 0) return Map.of("error", "Quantity must be positive");

        Product product = productRepo.findById(productId).orElse(null);
        if (product == null || !product.isActive()) return Map.of("error", "Product not found");

        String remarks = (String) body.get("remarks");
        if (type == StockTransaction.Type.IN) {
            double deduction = product.getDeductionValue() != null ? product.getDeductionValue() : 0.0;
            if (deduction > 0) {
                quantity = quantity - deduction;
                if (quantity <= 0) {
                    return Map.of("error", "Quantity after deduction must be positive. Deduction: " + deduction + " " + product.getUnit());
                }
                String note = "[Deducted " + deduction + " " + product.getUnit() + "]";
                if (remarks == null || remarks.isBlank()) {
                    remarks = note;
                } else {
                    remarks = remarks + " " + note;
                }
            }
        }

        Warehouse warehouse = warehouseRepo.findById(warehouseId).orElse(null);
        if (warehouse == null) return Map.of("error", "Warehouse not found");

        Section section = null;
        String sectionId = (String) body.get("section_id");
        if (sectionId != null) section = sectionRepo.findById(sectionId).orElse(null);

        // Update balance
        try {
            updateBalance(product, warehouse, section, type == StockTransaction.Type.IN ? quantity : -quantity);
        } catch (Exception e) {
            return Map.of("error", e.getMessage());
        }

        String grNumber = generateGR();
        LocalDate txDate = body.containsKey("transaction_date")
            ? LocalDate.parse((String) body.get("transaction_date"))
            : LocalDate.now();

        StockTransaction tx = new StockTransaction();
        tx.setGrNumber(grNumber);
        tx.setType(type);
        tx.setProduct(product);
        tx.setWarehouse(warehouse);
        tx.setSection(section);
        tx.setQuantity(quantity);
        tx.setUnit((String) body.getOrDefault("unit", product.getUnit()));
        tx.setReferenceDoc((String) body.get("reference_doc"));
        tx.setRemarks(remarks);
        tx.setPerformedBy(auth.currentUser());
        tx.setTransactionDate(txDate);

        @SuppressWarnings("unchecked")
        Map<String, String> customFields = (Map<String, String>) body.get("custom_fields");
        if (customFields != null) {
            tx.setCustomFields(customFields);
        }

        txRepo.save(tx);

        return Map.of("tx", toDto(tx), "grNumber", grNumber);
    }

    private void updateBalance(Product product, Warehouse warehouse, Section section, double delta) {
        Optional<StockBalance> existing = balanceRepo.findByProductAndWarehouseAndSection(product, warehouse, section);
        if (existing.isPresent()) {
            StockBalance b = existing.get();
            double newQty = b.getQuantity() + delta;
            if (newQty < 0) throw new RuntimeException("Insufficient stock for this transaction");
            b.setQuantity(newQty);
            balanceRepo.save(b);
        } else {
            if (delta < 0) throw new RuntimeException("Insufficient stock for this transaction");
            StockBalance sb = new StockBalance();
            sb.setProduct(product);
            sb.setWarehouse(warehouse);
            sb.setSection(section);
            sb.setQuantity(delta);
            balanceRepo.save(sb);
        }
    }

    private String generateGR() {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long nextSeq = 1;
        try {
            List<StockTransaction> latest = txRepo.findLatestTransaction(PageRequest.of(0, 1));
            if (!latest.isEmpty()) {
                StockTransaction lastTx = latest.get(0);
                String lastGr = lastTx.getGrNumber();
                if (lastGr != null && lastGr.startsWith("GR-")) {
                    String[] parts = lastGr.split("-");
                    if (parts.length >= 3) {
                        String lastDateStr = parts[1];
                        if (lastDateStr.equals(dateStr)) {
                            long lastSeq = Long.parseLong(parts[2]);
                            nextSeq = lastSeq + 1;
                        }
                    }
                }
            }
        } catch (Exception e) {
            nextSeq = txRepo.countByTransactionDate(LocalDate.now()) + 1;
        }
        return String.format("GR-%s-%04d", dateStr, nextSeq);
    }

    private Map<String, Object> toDto(StockTransaction tx) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", tx.getId());
        m.put("gr_number", tx.getGrNumber());
        m.put("type", tx.getType().name());
        m.put("quantity", tx.getQuantity());
        m.put("unit", tx.getUnit());
        m.put("reference_doc", tx.getReferenceDoc());
        m.put("remarks", tx.getRemarks());
        m.put("transaction_date", tx.getTransactionDate().toString());
        m.put("created_at", tx.getCreatedAt() != null ? tx.getCreatedAt().toString() : "");
        m.put("product_id", tx.getProduct().getId());
        m.put("product_name", tx.getProduct().getName());
        m.put("product_code", tx.getProduct().getCode());
        m.put("product_type", tx.getProduct().getType().name());
        m.put("warehouse_id", tx.getWarehouse().getId());
        m.put("warehouse_name", tx.getWarehouse().getName());
        m.put("section_id", tx.getSection() != null ? tx.getSection().getId() : null);
        m.put("section_name", tx.getSection() != null ? tx.getSection().getName() : null);
        m.put("performed_by_name", tx.getPerformedBy().getName());
        m.put("custom_fields", tx.getCustomFields());
        return m;
    }

    @PostMapping("/production-run")
    @Transactional
    public ResponseEntity<?> productionRun(@RequestBody Map<String, Object> body) {
        auth.requirePermission("TRANSACTIONS:STOCK_IN");
        auth.requirePermission("TRANSACTIONS:STOCK_OUT");

        String productId = (String) body.get("product_id");
        String warehouseId = (String) body.get("warehouse_id");
        Object qtyObj = body.get("quantity");
        if (productId == null || warehouseId == null || qtyObj == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "product_id, warehouse_id, and quantity are required"));
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

        Section section = null;
        String sectionId = (String) body.get("section_id");
        if (sectionId != null && !sectionId.isBlank()) {
            section = sectionRepo.findById(sectionId).orElse(null);
        }

        List<Bom> bomList = bomRepo.findByFinishedGoodId(productId);
        if (bomList.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Product does not have a BOM recipe defined"));
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> ingredientInputs = (List<Map<String, Object>>) body.get("ingredients");
        if (ingredientInputs == null || ingredientInputs.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Ingredients consumption details are required"));
        }

        Map<String, Map<String, Object>> inputMap = new HashMap<>();
        for (var input : ingredientInputs) {
            String id = (String) input.get("product_id");
            if (id != null) {
                inputMap.put(id, input);
            }
        }

        String prodRunRef = "PROD-RUN-" + System.currentTimeMillis();
        LocalDate txDate = body.containsKey("transaction_date")
            ? LocalDate.parse((String) body.get("transaction_date"))
            : LocalDate.now();
        String remarks = (String) body.getOrDefault("remarks", "Produced via Production Run");

        double wastagePct = body.containsKey("wastage_pct") ? ((Number) body.get("wastage_pct")).doubleValue() : 0.0;
        double damagePct = body.containsKey("damage_pct") ? ((Number) body.get("damage_pct")).doubleValue() : 0.0;

        List<StockTransaction> transactionsToSave = new ArrayList<>();

        for (Bom bom : bomList) {
            Product ingProduct = bom.getRawMaterial();
            Map<String, Object> input = inputMap.get(ingProduct.getId());
            if (input == null) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Missing consumption details for ingredient: " + ingProduct.getName()));
            }

            String ingWarehouseId = (String) input.get("warehouse_id");
            if (ingWarehouseId == null || ingWarehouseId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Warehouse is required for ingredient: " + ingProduct.getName()));
            }

            Warehouse ingWarehouse = warehouseRepo.findById(ingWarehouseId).orElse(null);
            if (ingWarehouse == null) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Warehouse not found for ingredient: " + ingProduct.getName()));
            }

            Section ingSection = null;
            String ingSectionId = (String) input.get("section_id");
            if (ingSectionId != null && !ingSectionId.isBlank()) {
                ingSection = sectionRepo.findById(ingSectionId).orElse(null);
            }

            double ingQtyToConsume = ((Number) input.get("quantity")).doubleValue();
            if (ingQtyToConsume <= 0) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Quantity to consume must be positive for ingredient: " + ingProduct.getName()));
            }

            try {
                updateBalance(ingProduct, ingWarehouse, ingSection, -ingQtyToConsume);
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Insufficient stock for " + ingProduct.getName() + " in selected location."));
            }

            StockTransaction txOut = new StockTransaction();
            txOut.setType(StockTransaction.Type.OUT);
            txOut.setProduct(ingProduct);
            txOut.setWarehouse(ingWarehouse);
            txOut.setSection(ingSection);
            txOut.setQuantity(ingQtyToConsume);
            txOut.setUnit(ingProduct.getUnit());
            txOut.setReferenceDoc(prodRunRef);
            txOut.setRemarks(String.format("Consumed for production of %s (%s)", product.getName(), product.getCode()));
            txOut.setPerformedBy(auth.currentUser());
            txOut.setTransactionDate(txDate);
            
            Map<String, String> customMap = new HashMap<>();
            customMap.put("production_run_id", prodRunRef);
            customMap.put("parent_product_id", productId);
            customMap.put("parent_product_name", product.getName());
            txOut.setCustomFields(customMap);

            transactionsToSave.add(txOut);
        }

        updateBalance(product, warehouse, section, quantity);

        StockTransaction txIn = new StockTransaction();
        txIn.setType(StockTransaction.Type.IN);
        txIn.setProduct(product);
        txIn.setWarehouse(warehouse);
        txIn.setSection(section);
        txIn.setQuantity(quantity);
        txIn.setUnit(product.getUnit());
        txIn.setReferenceDoc(prodRunRef);
        txIn.setRemarks(remarks);
        txIn.setPerformedBy(auth.currentUser());
        txIn.setTransactionDate(txDate);

        Map<String, String> customMap = new HashMap<>();
        customMap.put("production_run_id", prodRunRef);
        customMap.put("wastage_pct", String.valueOf(wastagePct));
        customMap.put("damage_pct", String.valueOf(damagePct));
        txIn.setCustomFields(customMap);

        transactionsToSave.add(txIn);

        String baseGr = generateGR();
        for (int i = 0; i < transactionsToSave.size(); i++) {
            var tx = transactionsToSave.get(i);
            tx.setGrNumber(baseGr + "-" + (i + 1));
            txRepo.save(tx);
        }

        String productionOrderId = (String) body.get("production_order_id");
        String productionOrderItemId = (String) body.get("production_order_item_id");
        if (productionOrderId != null && !productionOrderId.isBlank()) {
            poRepo.findById(productionOrderId).ifPresent(po -> {
                // Mark the specific item as completed
                if (productionOrderItemId != null && !productionOrderItemId.isBlank()) {
                    itemRepo.findById(productionOrderItemId).ifPresent(item -> {
                        item.setStatus(ProductionOrderItem.Status.COMPLETED);
                        itemRepo.save(item);
                    });
                }
                // Recompute overall PO status based on all items
                poController.recomputePoStatus(po);
            });
        }

        return ResponseEntity.status(201).body(Map.of(
            "success", true,
            "message", "Production run executed successfully. Reference: " + prodRunRef,
            "reference", prodRunRef
        ));
    }

    @GetMapping("/production-runs")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getProductionRuns() {
        auth.requirePermission("TRANSACTIONS:VIEW");
        List<StockTransaction> txList = txRepo.findProductionTransactions();

        // Group by referenceDoc
        Map<String, List<StockTransaction>> grouped = txList.stream()
            .filter(t -> t.getReferenceDoc() != null)
            .collect(Collectors.groupingBy(StockTransaction::getReferenceDoc));

        List<Map<String, Object>> runs = new ArrayList<>();

        for (var entry : grouped.entrySet()) {
            String refDoc = entry.getKey();
            List<StockTransaction> runTxs = entry.getValue();

            // Find the IN transaction (the produced output)
            StockTransaction produced = runTxs.stream()
                .filter(t -> t.getType() == StockTransaction.Type.IN)
                .findFirst().orElse(null);

            if (produced == null) continue; // Skip malformed runs

            // Map the OUT transactions (the consumed ingredients)
            List<Map<String, Object>> consumedItems = runTxs.stream()
                .filter(t -> t.getType() == StockTransaction.Type.OUT)
                .map(t -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("product_id", t.getProduct().getId());
                    m.put("product_name", t.getProduct().getName());
                    m.put("product_code", t.getProduct().getCode());
                    m.put("warehouse_name", t.getWarehouse().getName());
                    m.put("section_name", t.getSection() != null ? t.getSection().getName() : null);
                    m.put("quantity", t.getQuantity());
                    m.put("unit", t.getUnit());
                    return m;
                }).collect(Collectors.toList());

            Map<String, Object> run = new LinkedHashMap<>();
            run.put("reference_doc", refDoc);
            run.put("product_id", produced.getProduct().getId());
            run.put("product_name", produced.getProduct().getName());
            run.put("product_code", produced.getProduct().getCode());
            run.put("warehouse_name", produced.getWarehouse().getName());
            run.put("section_name", produced.getSection() != null ? produced.getSection().getName() : null);
            run.put("quantity_produced", produced.getQuantity());
            run.put("unit", produced.getUnit());
            run.put("transaction_date", produced.getTransactionDate().toString());
            run.put("created_at", produced.getCreatedAt() != null ? produced.getCreatedAt().toString() : "");
            run.put("performed_by", produced.getPerformedBy().getName());
            run.put("remarks", produced.getRemarks());

            double wastage = 0.0;
            double damage = 0.0;
            if (produced.getCustomFields() != null) {
                try {
                    String wStr = produced.getCustomFields().get("wastage_pct");
                    if (wStr != null) wastage = Double.parseDouble(wStr);
                    String dStr = produced.getCustomFields().get("damage_pct");
                    if (dStr != null) damage = Double.parseDouble(dStr);
                } catch (Exception ignored) {}
            }
            run.put("wastage_pct", wastage);
            run.put("damage_pct", damage);
            run.put("ingredients", consumedItems);

            runs.add(run);
        }

        // Sort runs by created_at desc (newest first)
        runs.sort((a, b) -> {
            String ca = (String) a.get("created_at");
            String cb = (String) b.get("created_at");
            return cb.compareTo(ca);
        });

        return ResponseEntity.ok(Map.of("success", true, "data", runs));
    }
}
