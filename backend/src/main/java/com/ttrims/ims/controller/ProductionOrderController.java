package com.ttrims.ims.controller;

import com.ttrims.ims.entity.ProductionOrder;
import com.ttrims.ims.entity.ProductionOrderItem;
import com.ttrims.ims.entity.Product;
import com.ttrims.ims.repository.ProductionOrderRepository;
import com.ttrims.ims.repository.ProductionOrderItemRepository;
import com.ttrims.ims.repository.ProductRepository;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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
@RequestMapping("/api/production-orders")
public class ProductionOrderController {
    private final ProductionOrderRepository poRepo;
    private final ProductionOrderItemRepository itemRepo;
    private final ProductRepository productRepo;
    private final AuthHelper auth;

    public ProductionOrderController(ProductionOrderRepository poRepo,
                                     ProductionOrderItemRepository itemRepo,
                                     ProductRepository productRepo,
                                     AuthHelper auth) {
        this.poRepo = poRepo;
        this.itemRepo = itemRepo;
        this.productRepo = productRepo;
        this.auth = auth;
    }

    // ─── List all POs ────────────────────────────────────────────────────────
    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list() {
        auth.requirePermission("ORDERS:VIEW");
        var orders = poRepo.findAllByOrderByCreatedAtDesc()
                .stream().map(this::toDto).collect(Collectors.toList());
        return ok(orders);
    }

    // ─── Create PO (multi-item) — Super Admin only ──────────────────────────
    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        auth.requireSuperAdmin();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rawItems = (List<Map<String, Object>>) body.get("items");
        if (rawItems == null || rawItems.isEmpty()) {
            return bad("At least one item is required");
        }

        // Pre-validate all items before persisting anything
        List<Object[]> resolvedItems = new ArrayList<>(); // [Product, qty, unit]
        for (int i = 0; i < rawItems.size(); i++) {
            Map<String, Object> ri = rawItems.get(i);
            String productId = (String) ri.get("product_id");
            Object qtyObj = ri.get("quantity");
            if (productId == null || qtyObj == null) {
                return bad("Item " + (i + 1) + ": product_id and quantity are required");
            }
            double qty = ((Number) qtyObj).doubleValue();
            if (qty <= 0) return bad("Item " + (i + 1) + ": quantity must be positive");
            Product product = productRepo.findById(productId).orElse(null);
            if (product == null) return bad("Item " + (i + 1) + ": product not found");
            String unit = ri.containsKey("unit") && ri.get("unit") != null
                    ? (String) ri.get("unit") : product.getUnit();
            resolvedItems.add(new Object[]{product, qty, unit});
        }

        ProductionOrder po = new ProductionOrder();
        po.setProductionOrderNumber("PO-" + System.currentTimeMillis());
        po.setRemarks((String) body.get("remarks"));
        po.setCreatedBy(auth.currentUser());
        po.setStatus(ProductionOrder.Status.PENDING);
        poRepo.save(po);

        for (Object[] ri : resolvedItems) {
            ProductionOrderItem item = new ProductionOrderItem();
            item.setProductionOrder(po);
            item.setProduct((Product) ri[0]);
            item.setQuantity((Double) ri[1]);
            item.setUnit((String) ri[2]);
            item.setStatus(ProductionOrderItem.Status.PENDING);
            itemRepo.save(item);
        }

        // Re-fetch to load items
        ProductionOrder saved = poRepo.findById(po.getId()).orElse(po);
        return ResponseEntity.status(201).body(Map.of("success", true, "data", toDto(saved)));
    }

    // ─── Update PO status — Super Admin only ────────────────────────────────
    @PatchMapping("/{id}/status")
    @Transactional
    public ResponseEntity<?> updateStatus(@PathVariable String id, @RequestBody Map<String, String> body) {
        auth.requireSuperAdmin();
        ProductionOrder po = poRepo.findById(id).orElse(null);
        if (po == null) return ResponseEntity.status(404).body(err("Production order not found"));
        try {
            ProductionOrder.Status newStatus = ProductionOrder.Status.valueOf(body.get("status"));
            po.setStatus(newStatus);
            // If cancelling the whole PO, cancel all pending items too
            if (newStatus == ProductionOrder.Status.CANCELLED) {
                po.getItems().forEach(item -> {
                    if (item.getStatus() == ProductionOrderItem.Status.PENDING) {
                        item.setStatus(ProductionOrderItem.Status.CANCELLED);
                        itemRepo.save(item);
                    }
                });
            }
            poRepo.save(po);
            return ok("Production order status updated");
        } catch (IllegalArgumentException e) {
            return bad("Invalid status");
        }
    }

    // ─── Update individual item status (called by TransactionController) ──────
    @PatchMapping("/{poId}/items/{itemId}/status")
    @Transactional
    public ResponseEntity<?> updateItemStatus(@PathVariable String poId,
                                               @PathVariable String itemId,
                                               @RequestBody Map<String, String> body) {
        auth.requirePermission("ORDERS:EDIT");
        ProductionOrder po = poRepo.findById(poId).orElse(null);
        if (po == null) return ResponseEntity.status(404).body(err("Production order not found"));
        ProductionOrderItem item = itemRepo.findById(itemId).orElse(null);
        if (item == null) return ResponseEntity.status(404).body(err("Item not found"));

        try {
            item.setStatus(ProductionOrderItem.Status.valueOf(body.get("status")));
            itemRepo.save(item);
        } catch (IllegalArgumentException e) {
            return bad("Invalid item status");
        }

        // Recompute PO-level status
        recomputePoStatus(po);
        return ok("Item status updated");
    }

    // ─── CSV Export ───────────────────────────────────────────────────────────
    @GetMapping("/export")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> exportCsv() {
        auth.requirePermission("ORDERS:VIEW");
        StringBuilder sb = new StringBuilder();
        sb.append("production_order_number,product_code,product_name,quantity,unit,item_status,po_status,remarks,created_by,created_at\n");
        poRepo.findAllByOrderByCreatedAtDesc().forEach(po ->
            po.getItems().forEach(item -> {
                sb.append(escapeCsv(po.getProductionOrderNumber())).append(",");
                sb.append(escapeCsv(item.getProduct().getCode())).append(",");
                sb.append(escapeCsv(item.getProduct().getName())).append(",");
                sb.append(item.getQuantity()).append(",");
                sb.append(escapeCsv(item.getUnit())).append(",");
                sb.append(item.getStatus().name()).append(",");
                sb.append(po.getStatus().name()).append(",");
                sb.append(escapeCsv(po.getRemarks() != null ? po.getRemarks() : "")).append(",");
                sb.append(escapeCsv(po.getCreatedBy().getName())).append(",");
                sb.append(po.getCreatedAt() != null ? po.getCreatedAt().toString() : "").append("\n");
            })
        );
        byte[] bytes = sb.toString().getBytes(StandardCharsets.UTF_8);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv"));
        headers.setContentDispositionFormData("attachment", "production_orders_export.csv");
        return ResponseEntity.ok().headers(headers).body(bytes);
    }

    // ─── CSV Import ───────────────────────────────────────────────────────────
    // CSV format (matching export):
    // production_order_number, product_code, product_name, quantity, unit, item_status, po_status, remarks
    // Rows with the same production_order_number are grouped into one PO.
    // If production_order_number is blank, each row becomes its own PO.
    @PostMapping("/import")
    @Transactional
    public ResponseEntity<?> importCsv(@RequestParam("file") MultipartFile file) {
        auth.requireSuperAdmin();
        if (file.isEmpty()) return bad("Uploaded file is empty");

        Map<String, Product> productByCode = new HashMap<>();
        productRepo.findAll().forEach(p -> productByCode.put(p.getCode().toLowerCase(), p));

        // Group rows by PO number (blank = individual PO per row)
        Map<String, List<Map<String, String>>> poGroups = new LinkedHashMap<>();
        List<Map<String, Object>> errors = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String headerLine = reader.readLine();
            if (headerLine == null) return bad("CSV file has no header row");

            String line;
            int rowNum = 1;
            while ((line = reader.readLine()) != null) {
                rowNum++;
                if (line.isBlank()) continue;
                String[] cols = parseCsvLine(line);

                String poNumber    = cols.length > 0 ? cols[0].trim() : "";
                String productCode = cols.length > 1 ? cols[1].trim() : "";
                String quantityStr = cols.length > 3 ? cols[3].trim() : "";
                String unit        = cols.length > 4 ? cols[4].trim() : "";
                String remarks     = cols.length > 7 ? cols[7].trim() : "";

                if (productCode.isEmpty()) {
                    errors.add(Map.of("row", rowNum, "error", "product_code is missing"));
                    continue;
                }
                if (!productByCode.containsKey(productCode.toLowerCase())) {
                    errors.add(Map.of("row", rowNum, "error", "Product code '" + productCode + "' not found"));
                    continue;
                }
                try {
                    double qty = Double.parseDouble(quantityStr);
                    if (qty <= 0) throw new NumberFormatException();
                } catch (NumberFormatException e) {
                    errors.add(Map.of("row", rowNum, "error", "Invalid quantity '" + quantityStr + "'"));
                    continue;
                }

                // Use poNumber as grouping key; blank rows get a unique key
                String groupKey = poNumber.isEmpty() ? "AUTO-" + rowNum : poNumber;
                poGroups.computeIfAbsent(groupKey, k -> new ArrayList<>())
                        .add(Map.of("product_code", productCode, "quantity", quantityStr,
                                    "unit", unit, "remarks", remarks));
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err("Failed to parse CSV: " + e.getMessage()));
        }

        List<Map<String, Object>> created = new ArrayList<>();

        for (Map.Entry<String, List<Map<String, String>>> entry : poGroups.entrySet()) {
            String groupKey = entry.getKey();
            List<Map<String, String>> rows = entry.getValue();

            ProductionOrder po = new ProductionOrder();
            po.setProductionOrderNumber("PO-" + System.currentTimeMillis() + "-" + created.size());
            String sharedRemarks = rows.get(0).get("remarks");
            po.setRemarks(sharedRemarks.isEmpty() ? null : sharedRemarks);
            po.setCreatedBy(auth.currentUser());
            po.setStatus(ProductionOrder.Status.PENDING);
            poRepo.save(po);

            for (Map<String, String> row : rows) {
                Product product = productByCode.get(row.get("product_code").toLowerCase());
                ProductionOrderItem item = new ProductionOrderItem();
                item.setProductionOrder(po);
                item.setProduct(product);
                item.setQuantity(Double.parseDouble(row.get("quantity")));
                String u = row.get("unit");
                item.setUnit(u.isEmpty() ? product.getUnit() : u);
                item.setStatus(ProductionOrderItem.Status.PENDING);
                itemRepo.save(item);
            }

            created.add(Map.of("group", groupKey, "production_order_number", po.getProductionOrderNumber(),
                               "items", rows.size()));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("imported", created.size());
        result.put("failed", errors.size());
        result.put("created", created);
        result.put("errors", errors);
        return ResponseEntity.ok(result);
    }

    // ─── Internal helper: recompute PO status from item statuses ─────────────
    public void recomputePoStatus(ProductionOrder po) {
        List<ProductionOrderItem> items = itemRepo.findByProductionOrderId(po.getId());
        if (items.isEmpty()) return;
        long completed  = items.stream().filter(i -> i.getStatus() == ProductionOrderItem.Status.COMPLETED).count();
        long cancelled  = items.stream().filter(i -> i.getStatus() == ProductionOrderItem.Status.CANCELLED).count();
        long total      = items.size();

        if (completed == total) {
            po.setStatus(ProductionOrder.Status.COMPLETED);
        } else if (completed + cancelled == total && completed > 0) {
            po.setStatus(ProductionOrder.Status.PARTIAL);
        } else if (completed > 0) {
            po.setStatus(ProductionOrder.Status.PARTIAL);
        } else if (cancelled == total) {
            po.setStatus(ProductionOrder.Status.CANCELLED);
        } else {
            po.setStatus(ProductionOrder.Status.PENDING);
        }
        poRepo.save(po);
    }

    // ─── DTO ─────────────────────────────────────────────────────────────────
    private Map<String, Object> toDto(ProductionOrder po) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", po.getId());
        m.put("production_order_number", po.getProductionOrderNumber());
        m.put("status", po.getStatus().name());
        m.put("remarks", po.getRemarks());
        m.put("created_by_name", po.getCreatedBy().getName());
        m.put("created_at", po.getCreatedAt() != null ? po.getCreatedAt().toString() : "");
        m.put("updated_at", po.getUpdatedAt() != null ? po.getUpdatedAt().toString() : "");
        m.put("item_count", po.getItems().size());
        List<Map<String, Object>> itemDtos = po.getItems().stream().map(item -> {
            Map<String, Object> im = new LinkedHashMap<>();
            im.put("id", item.getId());
            im.put("product_id", item.getProduct().getId());
            im.put("product_name", item.getProduct().getName());
            im.put("product_code", item.getProduct().getCode());
            im.put("product_unit", item.getProduct().getUnit());
            im.put("quantity", item.getQuantity());
            im.put("unit", item.getUnit());
            im.put("status", item.getStatus().name());
            return im;
        }).collect(Collectors.toList());
        m.put("items", itemDtos);
        return m;
    }

    // ─── CSV helpers ─────────────────────────────────────────────────────────
    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
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

    private ResponseEntity<?> ok(Object data) { return ResponseEntity.ok(Map.of("success", true, "data", data)); }
    private ResponseEntity<?> bad(String msg) { return ResponseEntity.badRequest().body(err(msg)); }
    private Map<String, Object> err(String msg) { return Map.of("success", false, "message", msg); }
}
