package com.ttrims.ims.controller;

import com.ttrims.ims.entity.*;
import com.ttrims.ims.repository.*;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/stock")
public class StockController {
    private final StockBalanceRepository balanceRepo;
    private final ProductRepository productRepo;
    private final StockTransactionRepository txRepo;
    private final ProductionOrderRepository poRepo;
    private final WarehouseRepository warehouseRepo;
    private final AuthHelper auth;

    public StockController(StockBalanceRepository balanceRepo, ProductRepository productRepo, StockTransactionRepository txRepo, ProductionOrderRepository poRepo, WarehouseRepository warehouseRepo, AuthHelper auth) {
        this.balanceRepo = balanceRepo;
        this.productRepo = productRepo;
        this.txRepo = txRepo;
        this.poRepo = poRepo;
        this.warehouseRepo = warehouseRepo;
        this.auth = auth;
    }

    @GetMapping("/balance")
    public ResponseEntity<?> balance(@RequestParam(required = false) String product_id,
                                      @RequestParam(required = false) String warehouse_id,
                                      @RequestParam(required = false) String type) {
        auth.requirePermission("STOCK:VIEW");
        var all = balanceRepo.findAllActive();
        var filtered = all.stream()
            .filter(sb -> product_id == null || sb.getProduct().getId().equals(product_id))
            .filter(sb -> warehouse_id == null || sb.getWarehouse().getId().equals(warehouse_id))
            .filter(sb -> type == null || sb.getProduct().getType().name().equals(type))
            .map(this::balanceDto).collect(Collectors.toList());
        return ok(filtered);
    }

    @GetMapping("/summary")
    public ResponseEntity<?> summary(@RequestParam(required = false) String type) {
        auth.requirePermission("STOCK:VIEW");
        List<Product> products = type != null
            ? productRepo.findByTypeAndActiveTrueOrderByName(Product.Type.valueOf(type))
            : productRepo.findByActiveTrueOrderByTypeAscNameAsc();

        Map<String, Double> productQuantities = balanceRepo.sumQuantitiesGroupedByProduct().stream()
            .collect(Collectors.toMap(
                row -> (String) row[0],
                row -> row[1] != null ? ((Number) row[1]).doubleValue() : 0.0,
                (v1, v2) -> v1
            ));

        var summary = products.stream().map(p -> {
            Double total = productQuantities.getOrDefault(p.getId(), 0.0);
            Map<String, Object> m = new HashMap<>();
            m.put("id", p.getId()); m.put("code", p.getCode()); m.put("name", p.getName());
            m.put("type", p.getType().name()); m.put("unit", p.getUnit());
            m.put("min_stock", p.getMinStock()); m.put("total_quantity", total);
            m.put("is_low_stock", total <= p.getMinStock());
            return m;
        }).collect(Collectors.toList());
        return ok(summary);
    }

    @GetMapping("/locate/{productId}")
    public ResponseEntity<?> locate(@PathVariable String productId) {
        auth.requirePermission("STOCK:LOCATE");
        Product product = productRepo.findById(productId).orElse(null);
        if (product == null) return ResponseEntity.status(404).body(err("Product not found"));

        var locations = balanceRepo.findLocationsByProductId(productId).stream().map(sb -> {
            Map<String, Object> m = new HashMap<>();
            m.put("quantity", sb.getQuantity());
            m.put("updated_at", sb.getUpdatedAt() != null ? sb.getUpdatedAt().toString() : "");
            m.put("warehouse_id", sb.getWarehouse().getId());
            m.put("warehouse_name", sb.getWarehouse().getName());
            m.put("warehouse_location", sb.getWarehouse().getLocation());
            m.put("section_id", sb.getSection() != null ? sb.getSection().getId() : null);
            m.put("section_name", sb.getSection() != null ? sb.getSection().getName() : null);
            return m;
        }).collect(Collectors.toList());

        double total = locations.stream().mapToDouble(l -> ((Number)l.get("quantity")).doubleValue()).sum();

        return ok(Map.of(
            "product", Map.of("id", product.getId(), "code", product.getCode(),
                "name", product.getName(), "type", product.getType().name(), "unit", product.getUnit()),
            "total_quantity", total,
            "locations", locations
        ));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<?> dashboard() {
        auth.requirePermission("STOCK:VIEW");
        LocalDate today = LocalDate.now();

        long totalWarehouses = warehouseRepo.count();
        long totalProducts = productRepo.findByActiveTrueOrderByTypeAscNameAsc().size();
        long totalFG = productRepo.findByTypeAndActiveTrueOrderByName(Product.Type.FINISHED_GOOD).size();
        long totalRM = productRepo.findByTypeAndActiveTrueOrderByName(Product.Type.RAW_MATERIAL).size();

        Double todayIn = txRepo.sumInByDate(today);
        Double todayOut = txRepo.sumOutByDate(today);

        Map<String, Double> productQuantities = balanceRepo.sumQuantitiesGroupedByProduct().stream()
            .collect(Collectors.toMap(
                row -> (String) row[0],
                row -> row[1] != null ? ((Number) row[1]).doubleValue() : 0.0,
                (v1, v2) -> v1
            ));

        // Low stock items
        var lowStock = productRepo.findByActiveTrueOrderByTypeAscNameAsc().stream()
            .filter(p -> p.getMinStock() > 0)
            .map(p -> {
                Double qty = productQuantities.getOrDefault(p.getId(), 0.0);
                return qty <= p.getMinStock() ? Map.of(
                    "name", p.getName(), "code", p.getCode(),
                    "min_stock", p.getMinStock(), "unit", p.getUnit(), "total_qty", qty
                ) : null;
            })
            .filter(Objects::nonNull)
            .limit(10).collect(Collectors.toList());

        // Recent transactions
        var recent = txRepo.findWithFilters(null, null, null, null, null, null,
            org.springframework.data.domain.PageRequest.of(0, 10))
            .getContent().stream().map(tx -> {
                Map<String, Object> m = new HashMap<>();
                m.put("gr_number", tx.getGrNumber()); m.put("type", tx.getType().name());
                m.put("quantity", tx.getQuantity()); m.put("unit", tx.getUnit());
                m.put("transaction_date", tx.getTransactionDate().toString());
                m.put("product_name", tx.getProduct().getName()); m.put("product_code", tx.getProduct().getCode());
                m.put("warehouse_name", tx.getWarehouse().getName());
                m.put("section_name", tx.getSection() != null ? tx.getSection().getName() : null);
                m.put("performed_by_name", tx.getPerformedBy().getName());
                return m;
            }).collect(Collectors.toList());

        return ok(Map.of(
            "kpis", Map.of(
                "totalWarehouses", totalWarehouses, "totalProducts", totalProducts,
                "totalFG", totalFG, "totalRM", totalRM,
                "lowStockCount", lowStock.size(),
                "todayIN", todayIn != null ? todayIn : 0.0,
                "todayOUT", todayOut != null ? todayOut : 0.0
            ),
            "lowStockItems", lowStock,
            "recentTransactions", recent
        ));
    }

    @GetMapping("/production-dashboard")
    public ResponseEntity<?> productionDashboard() {
        auth.requirePermission("STOCK:VIEW");
        LocalDate today = LocalDate.now();

        // Stock IN/OUT today
        Double todayIn = txRepo.sumInByDate(today);
        Double todayOut = txRepo.sumOutByDate(today);

        // Production Orders summary
        var allPOs = poRepo.findAllByOrderByCreatedAtDesc();
        long pendingPOs = allPOs.stream().filter(po -> po.getStatus() == ProductionOrder.Status.PENDING || po.getStatus() == ProductionOrder.Status.PARTIAL).count();
        long completedPOs = allPOs.stream().filter(po -> po.getStatus() == ProductionOrder.Status.COMPLETED).count();
        long totalPOs = allPOs.size();

        Map<String, Double> productQuantities = balanceRepo.sumQuantitiesGroupedByProduct().stream()
            .collect(Collectors.toMap(
                row -> (String) row[0],
                row -> row[1] != null ? ((Number) row[1]).doubleValue() : 0.0,
                (v1, v2) -> v1
            ));

        Map<String, Double> warehouseQuantities = balanceRepo.sumQuantitiesGroupedByWarehouse().stream()
            .collect(Collectors.toMap(
                row -> (String) row[0],
                row -> row[1] != null ? ((Number) row[1]).doubleValue() : 0.0,
                (v1, v2) -> v1
            ));

        // RM products with stock levels
        var rmProducts = productRepo.findByTypeAndActiveTrueOrderByName(Product.Type.RAW_MATERIAL).stream().map(p -> {
            Double qty = productQuantities.getOrDefault(p.getId(), 0.0);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.getId()); m.put("code", p.getCode()); m.put("name", p.getName());
            m.put("unit", p.getUnit()); m.put("total_qty", Math.round(qty * 100.0) / 100.0);
            m.put("min_stock", p.getMinStock());
            m.put("is_low_stock", qty <= p.getMinStock() && p.getMinStock() > 0);
            return m;
        }).collect(Collectors.toList());

        // FG products with stock levels
        var fgProducts = productRepo.findByTypeAndActiveTrueOrderByName(Product.Type.FINISHED_GOOD).stream().map(p -> {
            Double qty = productQuantities.getOrDefault(p.getId(), 0.0);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.getId()); m.put("code", p.getCode()); m.put("name", p.getName());
            m.put("unit", p.getUnit()); m.put("total_qty", Math.round(qty * 100.0) / 100.0);
            m.put("min_stock", p.getMinStock());
            m.put("is_low_stock", qty <= p.getMinStock() && p.getMinStock() > 0);
            return m;
        }).collect(Collectors.toList());

        // Low stock items
        long lowStockCount = rmProducts.stream().filter(m -> Boolean.TRUE.equals(m.get("is_low_stock"))).count()
                           + fgProducts.stream().filter(m -> Boolean.TRUE.equals(m.get("is_low_stock"))).count();

        // Warehouse summaries
        var warehouses = warehouseRepo.findAll().stream().map(w -> {
            double totalStock = warehouseQuantities.getOrDefault(w.getId(), 0.0);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", w.getId()); m.put("name", w.getName()); m.put("location", w.getLocation());
            m.put("total_stock", Math.round(totalStock * 100.0) / 100.0);
            return m;
        }).collect(Collectors.toList());

        // Recent production transactions (last 15)
        var productionTxs = txRepo.findProductionTransactions().stream().limit(15).map(tx -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("gr_number", tx.getGrNumber());
            m.put("type", tx.getType().name());
            m.put("quantity", tx.getQuantity());
            m.put("unit", tx.getUnit());
            m.put("transaction_date", tx.getTransactionDate().toString());
            m.put("product_name", tx.getProduct().getName());
            m.put("product_code", tx.getProduct().getCode());
            m.put("product_type", tx.getProduct().getType().name());
            m.put("warehouse_name", tx.getWarehouse().getName());
            m.put("performed_by", tx.getPerformedBy().getName());
            m.put("reference_doc", tx.getReferenceDoc() != null ? tx.getReferenceDoc() : "");
            return m;
        }).collect(Collectors.toList());

        return ok(Map.of(
            "kpis", Map.of(
                "todayIN", todayIn != null ? todayIn : 0.0,
                "todayOUT", todayOut != null ? todayOut : 0.0,
                "pendingPOs", pendingPOs,
                "completedPOs", completedPOs,
                "totalPOs", totalPOs,
                "lowStockCount", lowStockCount,
                "totalRM", rmProducts.size(),
                "totalFG", fgProducts.size()
            ),
            "rawMaterials", rmProducts,
            "finishedGoods", fgProducts,
            "warehouses", warehouses,
            "recentProductionTx", productionTxs
        ));
    }

    @GetMapping("/warehouse-dashboard")
    public ResponseEntity<?> warehouseDashboard() {
        auth.requirePermission("STOCK:VIEW");
        LocalDate today = LocalDate.now();

        long totalWarehouses = warehouseRepo.count();
        Double todayIn = txRepo.sumInByDate(today);
        Double todayOut = txRepo.sumOutByDate(today);

        var allBalances = balanceRepo.findAllActive();
        double totalStockQty = allBalances.stream().mapToDouble(StockBalance::getQuantity).sum();

        Map<String, Double> productQuantities = balanceRepo.sumQuantitiesGroupedByProduct().stream()
            .collect(Collectors.toMap(
                row -> (String) row[0],
                row -> row[1] != null ? ((Number) row[1]).doubleValue() : 0.0,
                (v1, v2) -> v1
            ));

        Map<String, Double> warehouseQuantities = balanceRepo.sumQuantitiesGroupedByWarehouse().stream()
            .collect(Collectors.toMap(
                row -> (String) row[0],
                row -> row[1] != null ? ((Number) row[1]).doubleValue() : 0.0,
                (v1, v2) -> v1
            ));

        // Low stock items
        var lowStock = productRepo.findByActiveTrueOrderByTypeAscNameAsc().stream()
            .filter(p -> p.getMinStock() > 0)
            .map(p -> {
                Double qty = productQuantities.getOrDefault(p.getId(), 0.0);
                return qty <= p.getMinStock() ? Map.of(
                    "name", p.getName(), "code", p.getCode(),
                    "min_stock", p.getMinStock(), "unit", p.getUnit(), "total_qty", qty,
                    "type", p.getType().name()
                ) : null;
            })
            .filter(Objects::nonNull)
            .collect(Collectors.toList());

        // Warehouse summaries
        var warehouses = warehouseRepo.findAll().stream().map(w -> {
            double totalStock = warehouseQuantities.getOrDefault(w.getId(), 0.0);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", w.getId()); m.put("name", w.getName()); m.put("location", w.getLocation());
            m.put("total_stock", Math.round(totalStock * 100.0) / 100.0);
            return m;
        }).collect(Collectors.toList());

        // Recent transactions (limit 15)
        var recent = txRepo.findWithFilters(null, null, null, null, null, null,
            org.springframework.data.domain.PageRequest.of(0, 15))
            .getContent().stream().map(tx -> {
                Map<String, Object> m = new HashMap<>();
                m.put("gr_number", tx.getGrNumber()); m.put("type", tx.getType().name());
                m.put("quantity", tx.getQuantity()); m.put("unit", tx.getUnit());
                m.put("transaction_date", tx.getTransactionDate().toString());
                m.put("product_name", tx.getProduct().getName()); m.put("product_code", tx.getProduct().getCode());
                m.put("warehouse_name", tx.getWarehouse().getName());
                m.put("section_name", tx.getSection() != null ? tx.getSection().getName() : null);
                m.put("performed_by_name", tx.getPerformedBy().getName());
                m.put("reference_doc", tx.getReferenceDoc() != null ? tx.getReferenceDoc() : "");
                return m;
            }).collect(Collectors.toList());

        return ok(Map.of(
            "kpis", Map.of(
                "totalWarehouses", totalWarehouses,
                "totalStockQty", totalStockQty,
                "lowStockCount", lowStock.size(),
                "todayIN", todayIn != null ? todayIn : 0.0,
                "todayOUT", todayOut != null ? todayOut : 0.0
            ),
            "lowStockItems", lowStock,
            "warehouses", warehouses,
            "recentTransactions", recent
        ));
    }

    private Map<String, Object> balanceDto(StockBalance sb) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", sb.getId()); m.put("quantity", sb.getQuantity());
        m.put("product_id", sb.getProduct().getId()); m.put("product_name", sb.getProduct().getName());
        m.put("product_code", sb.getProduct().getCode()); m.put("product_type", sb.getProduct().getType().name());
        m.put("product_unit", sb.getProduct().getUnit()); m.put("min_stock", sb.getProduct().getMinStock());
        m.put("warehouse_id", sb.getWarehouse().getId()); m.put("warehouse_name", sb.getWarehouse().getName());
        m.put("section_id", sb.getSection() != null ? sb.getSection().getId() : null);
        m.put("section_name", sb.getSection() != null ? sb.getSection().getName() : null);
        m.put("is_low_stock", sb.getQuantity() <= sb.getProduct().getMinStock());
        m.put("updated_at", sb.getUpdatedAt() != null ? sb.getUpdatedAt().toString() : "");
        return m;
    }

    private ResponseEntity<?> ok(Object data) { return ResponseEntity.ok(Map.of("success", true, "data", data)); }
    private Map<String, Object> err(String msg) { return Map.of("success", false, "message", msg); }
}
