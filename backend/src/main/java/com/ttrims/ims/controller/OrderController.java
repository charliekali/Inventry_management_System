package com.ttrims.ims.controller;

import com.ttrims.ims.entity.*;
import com.ttrims.ims.repository.*;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
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
    private final ProductionOrderRepository poRepo;
    private final PaymentTransactionRepository paymentTxRepo;
    private final OrderFollowUpRepository orderFollowUpRepo;

    public OrderController(OrderRepository orderRepo, ProductRepository productRepo, BomRepository bomRepo, StockBalanceRepository balanceRepo, AuthHelper auth, ProductionOrderRepository poRepo, PaymentTransactionRepository paymentTxRepo, OrderFollowUpRepository orderFollowUpRepo) {
        this.orderRepo = orderRepo;
        this.productRepo = productRepo;
        this.bomRepo = bomRepo;
        this.balanceRepo = balanceRepo;
        this.auth = auth;
        this.poRepo = poRepo;
        this.paymentTxRepo = paymentTxRepo;
        this.orderFollowUpRepo = orderFollowUpRepo;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list() {
        auth.requirePermission("ORDERS:VIEW");
        var orders = orderRepo.findAllByOrderByCreatedAtDesc().stream().map(this::toDto).collect(Collectors.toList());
        return ok(orders);
    }

    @GetMapping("/sales-dashboard")
    @Transactional(readOnly = true)
    public ResponseEntity<?> salesDashboard() {
        auth.requirePermission("ORDERS:VIEW");
        
        var allOrders = orderRepo.findAllByOrderByCreatedAtDesc();
        
        long totalOrders = allOrders.size();
        long pendingOrders = allOrders.stream().filter(o -> o.getStatus() == Order.Status.PENDING).count();
        long feasibleOrders = allOrders.stream().filter(o -> o.getStatus() == Order.Status.FEASIBLE).count();
        long partialOrders = allOrders.stream().filter(o -> o.getStatus() == Order.Status.PARTIAL).count();
        long insufficientOrders = allOrders.stream().filter(o -> o.getStatus() == Order.Status.INSUFFICIENT).count();
        long fulfilledOrders = allOrders.stream().filter(o -> o.getStatus() == Order.Status.FULFILLED).count();
        
        Map<String, Long> statusCounts = new LinkedHashMap<>();
        statusCounts.put("PENDING", pendingOrders);
        statusCounts.put("FEASIBLE", feasibleOrders);
        statusCounts.put("PARTIAL", partialOrders);
        statusCounts.put("INSUFFICIENT", insufficientOrders);
        statusCounts.put("FULFILLED", fulfilledOrders);

        var recentOrders = allOrders.stream()
            .limit(10)
            .map(this::toDto)
            .collect(Collectors.toList());

        // Top 5 demanded products (by total quantity required across all non-fulfilled orders)
        Map<String, Map<String, Object>> productDemands = new LinkedHashMap<>();
        allOrders.stream()
            .filter(o -> o.getStatus() != Order.Status.FULFILLED)
            .flatMap(o -> o.getItems().stream())
            .forEach(item -> {
                String key = item.getProduct().getId();
                productDemands.computeIfAbsent(key, k -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", item.getProduct().getId());
                    m.put("name", item.getProduct().getName());
                    m.put("code", item.getProduct().getCode());
                    m.put("unit", item.getProduct().getUnit());
                    m.put("total_qty", 0.0);
                    m.put("order_count", 0L);
                    return m;
                });
                var m = productDemands.get(key);
                m.put("total_qty", ((Number) m.get("total_qty")).doubleValue() + item.getQtyRequired());
                m.put("order_count", ((Number) m.get("order_count")).longValue() + 1);
            });

        var topProducts = productDemands.values().stream()
            .sorted((a, b) -> Double.compare(((Number) b.get("total_qty")).doubleValue(), ((Number) a.get("total_qty")).doubleValue()))
            .limit(5)
            .collect(Collectors.toList());

        // Active production orders
        var allPOs = poRepo.findAll();
        long activeProductionOrders = allPOs.stream()
            .filter(po -> po.getStatus() == ProductionOrder.Status.PENDING || po.getStatus() == ProductionOrder.Status.PARTIAL)
            .count();

        // Total pending items count
        double totalPendingItemsQty = allOrders.stream()
            .filter(o -> o.getStatus() != Order.Status.FULFILLED)
            .flatMap(o -> o.getItems().stream())
            .mapToDouble(item -> item.getQtyRequired())
            .sum();

        // Calculate Revenue KPIs
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime todayStart = now.toLocalDate().atStartOfDay();
        LocalDateTime todayEnd = now.toLocalDate().atTime(23, 59, 59, 999999999);
        LocalDateTime monthStart = now.toLocalDate().withDayOfMonth(1).atStartOfDay();

        Double todaySalesVal = orderRepo.calculateRevenueBetween(todayStart, todayEnd);
        Double monthSalesVal = orderRepo.calculateRevenueBetween(monthStart, todayEnd);
        Double allTimeSalesVal = orderRepo.calculateAllTimeRevenue();
        long todayOrderCountVal = orderRepo.countOrdersCreatedBetween(todayStart, todayEnd);
        long posOrderCountVal = orderRepo.countPosOrders();

        var recentInvoices = orderRepo.findTop10ByInvoiceNumberIsNotNullOrderByInvoiceDateDesc().stream()
            .map(this::toDto)
            .collect(Collectors.toList());

        return ok(Map.of(
            "kpis", Map.of(
                "totalOrders", totalOrders,
                "pendingOrders", pendingOrders + feasibleOrders + partialOrders + insufficientOrders,
                "fulfilledOrders", fulfilledOrders,
                "activeProductionOrders", activeProductionOrders,
                "totalPendingItemsQty", Math.round(totalPendingItemsQty * 100.0) / 100.0,
                "todaySales", Math.round(todaySalesVal * 100.0) / 100.0,
                "monthSales", Math.round(monthSalesVal * 100.0) / 100.0,
                "allTimeSales", Math.round(allTimeSalesVal * 100.0) / 100.0,
                "todayOrderCount", todayOrderCountVal,
                "posOrderCount", posOrderCountVal
            ),
            "statusCounts", statusCounts,
            "recentOrders", recentOrders,
            "topDemandedProducts", topProducts,
            "recentInvoices", recentInvoices
        ));
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
            "qty_required", i.getQtyRequired(), "unit", i.getUnit(),
            "unit_price", i.getUnitPrice() != null ? i.getUnitPrice() : 0.0,
            "discount", i.getDiscount() != null ? i.getDiscount() : 0.0,
            "line_total", i.getLineTotal() != null ? i.getLineTotal() : 0.0
        )).collect(Collectors.toList()));
        return ok(dto);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        boolean isLead = body != null && body.containsKey("is_lead") && Boolean.TRUE.equals(body.get("is_lead"));
        if (isLead) {
            auth.requirePermission("SALES:ADD_LEAD");
        } else {
            auth.requirePermission("ORDERS:CREATE");
        }
        String customer = (String) body.get("customer");
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("items");
        
        if (customer == null || customer.trim().isEmpty()) return bad("customer name is required");
        if (!isLead && (items == null || items.isEmpty())) return bad("items are required");

        Order order = new Order();
        order.setOrderNumber("ORD-" + System.currentTimeMillis());
        order.setCustomer(customer.trim());
        order.setRemarks((String) body.get("remarks"));
        order.setCreatedBy(auth.currentUser());
        order.setStatus(Order.Status.PENDING);

        @SuppressWarnings("unchecked")
        Map<String, String> customFields = (Map<String, String>) body.get("custom_fields");
        if (customFields != null) {
            order.setCustomFields(customFields);
        }

        double subtotal = 0.0;
        if (items != null) {
            for (var item : items) {
                Product p = productRepo.findById((String) item.get("product_id")).orElse(null);
                if (p != null) {
                    OrderItem oi = new OrderItem();
                    oi.setOrder(order);
                    oi.setProduct(p);
                    oi.setQtyRequired(((Number) item.get("qty_required")).doubleValue());
                    oi.setUnit((String) item.getOrDefault("unit", p.getUnit()));
                    
                    double unitPrice = auth.isSuperAdmin()
                        ? (item.containsKey("unit_price") && item.get("unit_price") != null 
                            ? ((Number) item.get("unit_price")).doubleValue() 
                            : (p.getSellingPrice() != null ? p.getSellingPrice() : 0.0))
                        : (p.getSellingPrice() != null ? p.getSellingPrice() : 0.0);
                    double discount = item.containsKey("discount") && item.get("discount") != null 
                        ? ((Number) item.get("discount")).doubleValue() 
                        : 0.0;
                    
                    oi.setUnitPrice(unitPrice);
                    oi.setDiscount(discount);
                    oi.computeLineTotal();
                    
                    subtotal += oi.getLineTotal();
                    order.getItems().add(oi);
                }
            }
        }

        double taxPercent = body.containsKey("tax_percent") && body.get("tax_percent") != null 
            ? ((Number) body.get("tax_percent")).doubleValue() 
            : 0.0;
        
        order.setSubtotal(Math.round(subtotal * 100.0) / 100.0);
        order.setTaxPercent(taxPercent);
        double taxAmount = Math.round((subtotal * taxPercent / 100.0) * 100.0) / 100.0;
        order.setTaxAmount(taxAmount);

        double grandTotal = body.containsKey("grand_total") && body.get("grand_total") != null 
            ? ((Number) body.get("grand_total")).doubleValue() 
            : (subtotal + taxAmount);
        order.setGrandTotal(Math.round(grandTotal * 100.0) / 100.0);

        if (body.containsKey("payment_mode")) {
            order.setPaymentMode((String) body.get("payment_mode"));
        }
        if (body.containsKey("paid_amount")) {
            order.setPaidAmount(body.get("paid_amount") == null ? 0.0 : ((Number) body.get("paid_amount")).doubleValue());
        }
        if (body.containsKey("is_pos_order")) {
            order.setIsPosOrder((Boolean) body.get("is_pos_order"));
        }

        orderRepo.save(order);
        return ResponseEntity.status(201).body(Map.of("success", true, "data", toDto(order)));
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public ResponseEntity<?> updateStatus(@PathVariable String id, @RequestBody Map<String, String> body) {
        String newStatusStr = body.get("status");
        if (newStatusStr == null) return bad("status is required");
        Order.Status newStatus;
        try {
            newStatus = Order.Status.valueOf(newStatusStr);
        } catch (IllegalArgumentException e) {
            return bad("Invalid status");
        }

        if (newStatus == Order.Status.FULFILLED) {
            auth.requirePermission("ORDERS:FULFILL");
        } else {
            auth.requirePermission("ORDERS:EDIT");
        }
        Order order = orderRepo.findById(id).orElse(null);
        if (order == null) return ResponseEntity.status(404).body(err("Order not found"));
        
        if (newStatus == Order.Status.FULFILLED && order.getStatus() != Order.Status.FULFILLED) {
            if (order.getInvoiceNumber() == null) {
                order.setInvoiceNumber(generateInvoiceNumber());
                order.setInvoiceDate(LocalDateTime.now());
            }
        }
        
        order.setStatus(newStatus);
        orderRepo.save(order);
        return ok("Order status updated");
    }

    @GetMapping("/{id}/invoice")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getInvoice(@PathVariable String id) {
        auth.requirePermission("ORDERS:VIEW");
        Order order = orderRepo.findById(id).orElse(null);
        if (order == null) return ResponseEntity.status(404).body(err("Order not found"));
        if (order.getInvoiceNumber() == null) {
            return ResponseEntity.status(404).body(err("Invoice not generated for this order"));
        }
        
        Map<String, Object> dto = toDto(order);
        dto.put("items", order.getItems().stream().map(i -> Map.of(
            "id", i.getId(), "product_id", i.getProduct().getId(),
            "product_name", i.getProduct().getName(), "product_code", i.getProduct().getCode(),
            "qty_required", i.getQtyRequired(), "unit", i.getUnit(),
            "unit_price", i.getUnitPrice() != null ? i.getUnitPrice() : 0.0,
            "discount", i.getDiscount() != null ? i.getDiscount() : 0.0,
            "line_total", i.getLineTotal() != null ? i.getLineTotal() : 0.0
        )).collect(Collectors.toList()));
        
        return ok(dto);
    }

    @GetMapping("/invoices")
    @Transactional(readOnly = true)
    public ResponseEntity<?> listInvoices() {
        auth.requirePermission("ORDERS:VIEW");
        List<Order> invoices = orderRepo.findAll().stream()
            .filter(o -> o.getInvoiceNumber() != null)
            .sorted((a, b) -> b.getInvoiceDate().compareTo(a.getInvoiceDate()))
            .collect(Collectors.toList());
        var data = invoices.stream().map(this::toDto).collect(Collectors.toList());
        return ok(data);
    }

    @PatchMapping("/{id}/payment")
    @Transactional
    public ResponseEntity<?> collectPayment(@PathVariable String id, @RequestBody Map<String, Object> body) {
        auth.requirePermission("SALES:COLLECT");
        Order order = orderRepo.findById(id).orElse(null);
        if (order == null) return ResponseEntity.status(404).body(err("Order not found"));
        if (order.getInvoiceNumber() == null) {
            return ResponseEntity.badRequest().body(err("Cannot collect payment for an order without an invoice"));
        }
        if (body.get("amount") == null) return ResponseEntity.badRequest().body(err("Payment amount is required"));
        double amount = ((Number) body.get("amount")).doubleValue();
        if (amount <= 0) return ResponseEntity.badRequest().body(err("Payment amount must be greater than zero"));
        String mode = (String) body.get("payment_mode");
        String notes = (String) body.get("notes");
        if (mode != null) {
            order.setPaymentMode(mode);
        }
        double currentPaid = order.getPaidAmount() != null ? order.getPaidAmount() : 0.0;
        double balance = order.getGrandTotal() - currentPaid;
        if (balance <= 0) return ResponseEntity.badRequest().body(err("This invoice is already fully paid"));
        double actualAmount = Math.min(balance, amount);
        double newPaid = Math.round((currentPaid + actualAmount) * 100.0) / 100.0;
        order.setPaidAmount(newPaid);
        orderRepo.save(order);

        // Log the individual payment installment
        PaymentTransaction tx = new PaymentTransaction();
        tx.setOrder(order);
        tx.setAmount(Math.round(actualAmount * 100.0) / 100.0);
        tx.setPaymentMode(mode != null ? mode : order.getPaymentMode());
        tx.setNotes(notes);
        tx.setRecordedBy(auth.currentUser());
        tx.setRecordedAt(LocalDateTime.now());
        paymentTxRepo.save(tx);

        return ok(Map.of(
            "paid_amount", newPaid,
            "balance", Math.round((order.getGrandTotal() - newPaid) * 100.0) / 100.0,
            "fully_paid", newPaid >= order.getGrandTotal()
        ));
    }

    @GetMapping("/{id}/payment-history")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getPaymentHistory(@PathVariable String id) {
        auth.requirePermission("ORDERS:VIEW");
        Order order = orderRepo.findById(id).orElse(null);
        if (order == null) return ResponseEntity.status(404).body(err("Order not found"));

        List<PaymentTransaction> txList = paymentTxRepo.findByOrderIdOrderByRecordedAtAsc(id);
        double runningBalance = order.getGrandTotal();
        List<Map<String, Object>> history = new ArrayList<>();
        for (PaymentTransaction tx : txList) {
            runningBalance = Math.round((runningBalance - tx.getAmount()) * 100.0) / 100.0;
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id", tx.getId());
            entry.put("amount", tx.getAmount());
            entry.put("payment_mode", tx.getPaymentMode());
            entry.put("notes", tx.getNotes() != null ? tx.getNotes() : "");
            entry.put("recorded_by", tx.getRecordedBy() != null ? tx.getRecordedBy().getName() : "System");
            entry.put("recorded_at", tx.getRecordedAt().toString());
            entry.put("balance_after", runningBalance);
            history.add(entry);
        }
        return ok(Map.of(
            "order_id", id,
            "invoice_number", order.getInvoiceNumber() != null ? order.getInvoiceNumber() : "",
            "grand_total", order.getGrandTotal(),
            "paid_amount", order.getPaidAmount() != null ? order.getPaidAmount() : 0.0,
            "balance", Math.round((order.getGrandTotal() - (order.getPaidAmount() != null ? order.getPaidAmount() : 0.0)) * 100.0) / 100.0,
            "installment_count", history.size(),
            "history", history
        ));
    }

    @GetMapping("/{id}/followups")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getFollowUps(@PathVariable String id) {
        auth.requirePermission("SALES:CRM");
        Order order = orderRepo.findById(id).orElse(null);
        if (order == null) return ResponseEntity.status(404).body(err("Order not found"));

        List<OrderFollowUp> followups = orderFollowUpRepo.findByOrderIdOrderByRecordedAtDesc(id);
        List<Map<String, Object>> history = followups.stream().map(f -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", f.getId());
            m.put("next_follow_up_date", f.getNextFollowUpDate() != null ? f.getNextFollowUpDate().toString() : null);
            m.put("follow_up_status", f.getFollowUpStatus() != null ? f.getFollowUpStatus().name() : null);
            m.put("contact_person", f.getContactPerson() != null ? f.getContactPerson() : "");
            m.put("comments", f.getComments() != null ? f.getComments() : "");
            m.put("recorded_by", f.getRecordedBy() != null ? f.getRecordedBy().getName() : "System");
            m.put("recorded_at", f.getRecordedAt() != null ? f.getRecordedAt().toString() : null);
            return m;
        }).collect(Collectors.toList());

        return ok(Map.of(
            "order_id", id,
            "invoice_number", order.getInvoiceNumber() != null ? order.getInvoiceNumber() : "",
            "followups", history
        ));
    }

    @PostMapping("/{id}/followups")
    @Transactional
    public ResponseEntity<?> addFollowUp(@PathVariable String id, @RequestBody Map<String, Object> body) {
        auth.requirePermission("SALES:LOG_FOLLOWUP");
        Order order = orderRepo.findById(id).orElse(null);
        if (order == null) return ResponseEntity.status(404).body(err("Order not found"));

        String nextDateStr = (String) body.get("next_follow_up_date");
        String statusStr = (String) body.get("follow_up_status");
        String contactPerson = (String) body.get("contact_person");
        String comments = (String) body.get("comments");

        if (nextDateStr == null) return bad("Next follow-up date is required");
        if (statusStr == null) return bad("Follow-up status is required");
        if (comments == null || comments.trim().isEmpty()) return bad("Comments/updates are required");

        OrderFollowUp followUp = new OrderFollowUp();
        followUp.setOrder(order);
        try {
            followUp.setNextFollowUpDate(LocalDate.parse(nextDateStr));
        } catch (Exception e) {
            return bad("Invalid next follow-up date format, should be YYYY-MM-DD");
        }

        try {
            followUp.setFollowUpStatus(OrderFollowUp.FollowUpStatus.valueOf(statusStr.toUpperCase()));
        } catch (IllegalArgumentException e) {
            return bad("Invalid status. Allowed values: PENDING, CONTACTED, PROMISE_TO_PAY, ESCALATED, RESOLVED");
        }

        followUp.setContactPerson(contactPerson != null ? contactPerson.trim() : null);
        followUp.setComments(comments.trim());
        followUp.setRecordedBy(auth.currentUser());
        followUp.setRecordedAt(LocalDateTime.now());

        orderFollowUpRepo.save(followUp);

        return ok(Map.of("message", "Follow-up logged successfully", "id", followUp.getId()));
    }

    @GetMapping("/outstanding")
    @Transactional(readOnly = true)
    public ResponseEntity<?> listOutstanding() {
        if (!auth.hasPermission("SALES:CRM") && !auth.hasPermission("SALES:COLLECT") && !auth.hasPermission("SALES:LEADS") && !auth.hasPermission("SALES:CUSTOMERS")) {
            auth.requirePermission("SALES:CRM");
        }
        LocalDateTime now = LocalDateTime.now();
        List<Map<String, Object>> result = orderRepo.findAll().stream()
            .filter(o -> o.getStatus() == Order.Status.PENDING || (o.getInvoiceNumber() != null && o.getGrandTotal() > (o.getPaidAmount() != null ? o.getPaidAmount() : 0.0)))
            .sorted(Comparator.comparing(o -> o.getInvoiceDate() != null ? o.getInvoiceDate() : o.getCreatedAt()))
            .map(o -> {
                double paid = o.getPaidAmount() != null ? o.getPaidAmount() : 0.0;
                double balance = Math.round((o.getGrandTotal() - paid) * 100.0) / 100.0;
                LocalDateTime invoiceTime = o.getInvoiceDate() != null ? o.getInvoiceDate() : o.getCreatedAt();
                long daysOverdue = ChronoUnit.DAYS.between(invoiceTime.toLocalDate(), now.toLocalDate());

                // Find the last payment date
                List<PaymentTransaction> txList = paymentTxRepo.findByOrderIdOrderByRecordedAtAsc(o.getId());
                String lastPaymentDate = txList.isEmpty() ? null : txList.get(txList.size() - 1).getRecordedAt().toString();

                Map<String, Object> entry = new LinkedHashMap<>(toDto(o));
                if (o.getInvoiceNumber() == null) {
                    entry.put("invoice_number", o.getOrderNumber());
                    entry.put("invoice_date", o.getCreatedAt().toString());
                }
                entry.put("balance", balance);
                entry.put("days_overdue", daysOverdue);
                entry.put("last_payment_date", lastPaymentDate);
                entry.put("installment_count", txList.size());

                // Find the latest follow-up information
                List<OrderFollowUp> followUps = orderFollowUpRepo.findByOrderIdOrderByRecordedAtDesc(o.getId());
                if (!followUps.isEmpty()) {
                    OrderFollowUp latest = followUps.get(0);
                    entry.put("next_follow_up_date", latest.getNextFollowUpDate() != null ? latest.getNextFollowUpDate().toString() : null);
                    entry.put("follow_up_status", latest.getFollowUpStatus() != null ? latest.getFollowUpStatus().name() : null);
                    entry.put("latest_comment", latest.getComments());
                    entry.put("contact_person", latest.getContactPerson());
                    entry.put("follow_up_recorded_at", latest.getRecordedAt() != null ? latest.getRecordedAt().toString() : null);
                    entry.put("follow_up_recorded_by", latest.getRecordedBy() != null ? latest.getRecordedBy().getName() : null);
                } else {
                    entry.put("next_follow_up_date", null);
                    entry.put("follow_up_status", null);
                    entry.put("latest_comment", null);
                    entry.put("contact_person", null);
                    entry.put("follow_up_recorded_at", null);
                    entry.put("follow_up_recorded_by", null);
                }
                return entry;
            })
            .collect(Collectors.toList());
        return ok(result);
    }

    @PostMapping("/pos")
    @Transactional
    public ResponseEntity<?> posCreate(@RequestBody Map<String, Object> body) {
        auth.requirePermission("ORDERS:CREATE");
        String customer = (String) body.get("customer");
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("items");
        if (customer == null || items == null || items.isEmpty()) return bad("customer and items are required");

        Order order = new Order();
        order.setOrderNumber("ORD-POS-" + System.currentTimeMillis());
        order.setCustomer(customer);
        order.setRemarks((String) body.get("remarks"));
        order.setCreatedBy(auth.currentUser());
        order.setStatus(Order.Status.FULFILLED);
        order.setIsPosOrder(true);
        order.setInvoiceNumber(generateInvoiceNumber());
        order.setInvoiceDate(LocalDateTime.now());

        @SuppressWarnings("unchecked")
        Map<String, String> customFields = (Map<String, String>) body.get("custom_fields");
        if (customFields != null) {
            order.setCustomFields(customFields);
        }

        double subtotal = 0.0;
        for (var item : items) {
            Product p = productRepo.findById((String) item.get("product_id")).orElse(null);
            if (p != null) {
                OrderItem oi = new OrderItem();
                oi.setOrder(order);
                oi.setProduct(p);
                oi.setQtyRequired(((Number) item.get("qty_required")).doubleValue());
                oi.setUnit((String) item.getOrDefault("unit", p.getUnit()));
                
                double unitPrice = auth.isSuperAdmin()
                    ? (item.containsKey("unit_price") && item.get("unit_price") != null 
                        ? ((Number) item.get("unit_price")).doubleValue() 
                        : (p.getSellingPrice() != null ? p.getSellingPrice() : 0.0))
                    : (p.getSellingPrice() != null ? p.getSellingPrice() : 0.0);
                double discount = item.containsKey("discount") && item.get("discount") != null 
                    ? ((Number) item.get("discount")).doubleValue() 
                    : 0.0;
                
                oi.setUnitPrice(unitPrice);
                oi.setDiscount(discount);
                oi.computeLineTotal();
                
                subtotal += oi.getLineTotal();
                order.getItems().add(oi);
            }
        }
        
        double taxPercent = body.containsKey("tax_percent") && body.get("tax_percent") != null 
            ? ((Number) body.get("tax_percent")).doubleValue() 
            : 0.0;
        
        order.setSubtotal(Math.round(subtotal * 100.0) / 100.0);
        order.setTaxPercent(taxPercent);
        double taxAmount = Math.round((subtotal * taxPercent / 100.0) * 100.0) / 100.0;
        order.setTaxAmount(taxAmount);
        order.setGrandTotal(Math.round((subtotal + taxAmount) * 100.0) / 100.0);
        
        order.setPaymentMode((String) body.getOrDefault("payment_mode", "CASH"));
        order.setPaidAmount(body.containsKey("paid_amount") && body.get("paid_amount") != null 
            ? ((Number) body.get("paid_amount")).doubleValue() 
            : order.getGrandTotal());

        orderRepo.save(order);
        
        Map<String, Object> dto = toDto(order);
        dto.put("items", order.getItems().stream().map(i -> Map.of(
            "id", i.getId(), "product_id", i.getProduct().getId(),
            "product_name", i.getProduct().getName(), "product_code", i.getProduct().getCode(),
            "qty_required", i.getQtyRequired(), "unit", i.getUnit(),
            "unit_price", i.getUnitPrice() != null ? i.getUnitPrice() : 0.0,
            "discount", i.getDiscount() != null ? i.getDiscount() : 0.0,
            "line_total", i.getLineTotal() != null ? i.getLineTotal() : 0.0
        )).collect(Collectors.toList()));
        
        return ResponseEntity.status(201).body(Map.of("success", true, "data", dto));
    }

    private synchronized String generateInvoiceNumber() {
        java.time.LocalDate today = java.time.LocalDate.now();
        String dateStr = today.format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "INV-" + dateStr + "-";
        
        Optional<Order> latest = orderRepo.findFirstByInvoiceNumberStartingWithOrderByInvoiceNumberDesc(prefix);
        int nextNum = 1;
        if (latest.isPresent()) {
            String lastNumStr = latest.get().getInvoiceNumber();
            try {
                String[] parts = lastNumStr.split("-");
                if (parts.length == 3) {
                    nextNum = Integer.parseInt(parts[2]) + 1;
                }
            } catch (NumberFormatException e) {
                // Ignore and use 1
            }
        }
        return String.format("%s%04d", prefix, nextNum);
    }

    private double getKgMultiplier(Product product) {
        if ("KG".equalsIgnoreCase(product.getUnit())) {
            return 1.0;
        }
        if (product.getPacksPerKg() != null && product.getPacksPerKg() > 0) {
            return 1.0 / product.getPacksPerKg();
        }
        if (product.getPackSizeG() != null && product.getPackSizeG() > 0) {
            return product.getPackSizeG() / 1000.0;
        }
        return 1.0;
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

            // Convert shortfall (packs) to kilograms of blend needed
            double shortfallInKg = shortfall * getKgMultiplier(product);

            for (Bom bom : bomItems) {
                Product subRm = bom.getRawMaterial();
                double qtyPerUnit = bom.getQtyRequired();
                double rmAvailable = Optional.ofNullable(balanceRepo.sumByProductId(subRm.getId())).orElse(0.0);

                // Multiply by the kilograms needed
                double subRmNeeded = qtyPerUnit * shortfallInKg;

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
                
                // Convert kilograms of blend to finished good units (packs) for detailed output
                double possibleFgUnitsFromThisRm = possibleFromThisRm / getKgMultiplier(product);
                bomLine.put("max_producible_from_this_rm", Math.round(possibleFgUnitsFromThisRm * 1000.0) / 1000.0);

                minProducible = Math.min(minProducible, possibleFromThisRm);

                boolean subSufficient = (boolean) subRmResult.get("sufficient_directly") 
                    || (subRmResult.containsKey("sufficient_with_production") && (boolean) subRmResult.get("sufficient_with_production"));
                
                if (!subSufficient) {
                    allIngredientsOk = false;
                }

                subAnalysisList.add(bomLine);
            }

            double producibleUnits = minProducible == Double.MAX_VALUE ? 0.0 : minProducible;
            // Convert kilograms of blend to finished good units (packs)
            double producibleFgUnits = producibleUnits / getKgMultiplier(product);

            result.put("producible_units", Math.round(producibleFgUnits * 1000.0) / 1000.0);
            result.put("sub_analysis", subAnalysisList);
            result.put("rm_analysis", subAnalysisList);

            boolean sufficientWithProduction = producibleFgUnits >= shortfall;
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

        // For each finished good or blend that has a BOM using any of these RMs, compute max producible units
        List<Product> allFGs = productRepo.findByActiveTrueOrderByTypeAscNameAsc()
            .stream().filter(p -> p.getType() == Product.Type.FINISHED_GOOD || p.getType() == Product.Type.BLEND)
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
                
                // Convert kilograms of blend to finished good units (packs)
                double possibleFgUnits = possibleFromThisRm / getKgMultiplier(fg);
                bomLine.put("max_units_from_this_rm", Math.round(possibleFgUnits * 1000.0) / 1000.0);
                
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

            // Total RM consumed if producing maxUnits (using raw blend kg)
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

            // Convert max yield in kg of blend to finished good units (packs)
            double maxFgUnits = maxUnits / getKgMultiplier(fg);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("fg_id", fg.getId());
            result.put("fg_name", fg.getName());
            result.put("fg_code", fg.getCode());
            result.put("fg_unit", fg.getUnit());
            result.put("max_producible_units", Math.round(maxFgUnits * 1000.0) / 1000.0);
            result.put("max_full_batches", (long) Math.floor(maxFgUnits));
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
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", o.getId());
        m.put("order_number", o.getOrderNumber());
        m.put("customer", o.getCustomer());
        m.put("customer_name", o.getCustomer());
        m.put("status", o.getStatus().name());
        m.put("remarks", o.getRemarks());
        m.put("created_by_name", o.getCreatedBy() != null ? o.getCreatedBy().getName() : "");
        m.put("created_at", o.getCreatedAt() != null ? o.getCreatedAt().toString() : "");
        m.put("item_count", o.getItems().size());
        m.put("custom_fields", o.getCustomFields());
        m.put("invoice_number", o.getInvoiceNumber());
        m.put("invoice_date", o.getInvoiceDate() != null ? o.getInvoiceDate().toString() : null);
        m.put("subtotal", o.getSubtotal() != null ? o.getSubtotal() : 0.0);
        m.put("tax_percent", o.getTaxPercent() != null ? o.getTaxPercent() : 0.0);
        m.put("tax_amount", o.getTaxAmount() != null ? o.getTaxAmount() : 0.0);
        m.put("grand_total", o.getGrandTotal() != null ? o.getGrandTotal() : 0.0);
        m.put("payment_mode", o.getPaymentMode());
        m.put("paid_amount", o.getPaidAmount() != null ? o.getPaidAmount() : 0.0);
        m.put("is_pos_order", o.getIsPosOrder() != null ? o.getIsPosOrder() : false);
        return m;
    }

    private ResponseEntity<?> ok(Object data) { return ResponseEntity.ok(Map.of("success", true, "data", data)); }
    private ResponseEntity<?> bad(String msg) { return ResponseEntity.badRequest().body(err(msg)); }
    private Map<String, Object> err(String msg) { return Map.of("success", false, "message", msg); }
}
