package com.ttrims.ims.controller;

import com.ttrims.ims.entity.*;
import com.ttrims.ims.repository.*;
import com.ttrims.ims.security.JwtUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/ecom/orders")
public class EcomOrderController {

    private final EcomOrderRepository ecomOrderRepo;
    private final OrderRepository imsOrderRepo;
    private final ProductRepository productRepo;
    private final UserRepository userRepo;
    private final EcomCustomerRepository customerRepo;
    private final StockBalanceRepository stockBalanceRepo;
    private final JwtUtils jwtUtils;

    public EcomOrderController(EcomOrderRepository ecomOrderRepo, OrderRepository imsOrderRepo,
                               ProductRepository productRepo, UserRepository userRepo,
                               EcomCustomerRepository customerRepo, StockBalanceRepository stockBalanceRepo,
                               JwtUtils jwtUtils) {
        this.ecomOrderRepo = ecomOrderRepo;
        this.imsOrderRepo = imsOrderRepo;
        this.productRepo = productRepo;
        this.userRepo = userRepo;
        this.customerRepo = customerRepo;
        this.stockBalanceRepo = stockBalanceRepo;
        this.jwtUtils = jwtUtils;
    }

    private String getCustomerId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        return jwtUtils.getUserIdFromToken(authHeader.substring(7));
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> placeOrder(@RequestHeader("Authorization") String authHeader, @RequestBody Map<String, Object> body) {
        String customerId = getCustomerId(authHeader);
        EcomCustomer customer = customerRepo.findById(customerId).orElse(null);
        if (customer == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "Customer profile not found"));
        }

        List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("items");
        if (items == null || items.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Order must contain at least one item"));
        }

        String deliveryAddress = (String) body.get("delivery_address");
        String paymentMode = (String) body.getOrDefault("payment_mode", "COD");
        Double subtotal = ((Number) body.getOrDefault("subtotal", 0.0)).doubleValue();
        Double taxAmount = ((Number) body.getOrDefault("tax_amount", 0.0)).doubleValue();
        Double shippingCharge = ((Number) body.getOrDefault("shipping_charge", 0.0)).doubleValue();
        Double grandTotal = ((Number) body.getOrDefault("grand_total", 0.0)).doubleValue();
        Double lat = body.get("latitude") != null ? ((Number) body.get("latitude")).doubleValue() : null;
        Double lng = body.get("longitude") != null ? ((Number) body.get("longitude")).doubleValue() : null;

        String orderNo = "ECO-" + System.currentTimeMillis();

        // 1. Create EcomOrder
        EcomOrder ecomOrder = new EcomOrder();
        ecomOrder.setOrderNumber(orderNo);
        ecomOrder.setCustomerId(customerId);
        ecomOrder.setDeliveryAddress(deliveryAddress);
        ecomOrder.setLatitude(lat);
        ecomOrder.setLongitude(lng);
        ecomOrder.setPaymentMode(paymentMode);
        ecomOrder.setPaymentStatus("COD".equalsIgnoreCase(paymentMode) ? "PENDING" : "PAID");
        ecomOrder.setSubtotal(subtotal);
        ecomOrder.setTaxAmount(taxAmount);
        ecomOrder.setShippingCharge(shippingCharge);
        ecomOrder.setGrandTotal(grandTotal);
        ecomOrder.setStatus(EcomOrder.Status.PLACED);

        // Convert items list to static JSON details
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> itm = items.get(i);
            sb.append(String.format("{\"product_id\":\"%s\",\"name\":\"%s\",\"qty_required\":%f,\"unit_price\":%f}",
                itm.get("product_id"), itm.get("name"), ((Number)itm.get("qty_required")).doubleValue(), ((Number)itm.get("unit_price")).doubleValue()));
            if (i < items.size() - 1) sb.append(",");
        }
        sb.append("]");
        ecomOrder.setItems(sb.toString());

        // 2. Create IMS Order to synchronize with Inventory/Logistics
        Order imsOrder = new Order();
        imsOrder.setOrderNumber(orderNo);
        imsOrder.setCustomer(customer.getName());
        imsOrder.setRemarks("E-Commerce Order: " + orderNo);
        imsOrder.setStatus(Order.Status.PENDING);
        imsOrder.setDeliveryAddress(deliveryAddress);
        imsOrder.setLatitude(lat);
        imsOrder.setLongitude(lng);
        imsOrder.setSubtotal(subtotal);
        imsOrder.setTaxAmount(taxAmount);
        imsOrder.setGrandTotal(grandTotal);
        imsOrder.setPaymentMode(paymentMode);

        // Set system creator
        User systemUser = userRepo.findAll().stream().findFirst().orElse(null);
        imsOrder.setCreatedBy(systemUser);

        // Populate order items
        List<OrderItem> imsItems = new ArrayList<>();
        for (var item : items) {
            Product p = productRepo.findById((String) item.get("product_id")).orElse(null);
            if (p != null) {
                OrderItem oi = new OrderItem();
                oi.setOrder(imsOrder);
                oi.setProduct(p);
                oi.setQtyRequired(((Number) item.get("qty_required")).doubleValue());
                oi.setUnit(p.getUnit());
                oi.setUnitPrice(p.getSellingPrice() != null ? p.getSellingPrice() : 0.0);
                oi.computeLineTotal();
                imsItems.add(oi);
            }
        }
        imsOrder.setItems(imsItems);
        imsOrderRepo.save(imsOrder);

        // Link IMS Order ID to EcomOrder
        ecomOrder.setImsOrderId(imsOrder.getId());
        ecomOrderRepo.save(ecomOrder);

        return ResponseEntity.ok(Map.of("success", true, "data", ecomOrder));
    }

    @GetMapping
    public ResponseEntity<?> getOrderHistory(@RequestHeader("Authorization") String authHeader) {
        String customerId = getCustomerId(authHeader);
        return ResponseEntity.ok(Map.of("success", true, "data", ecomOrderRepo.findByCustomerIdOrderByCreatedAtDesc(customerId)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getOrderDetail(@PathVariable String id) {
        EcomOrder order = ecomOrderRepo.findById(id).orElse(null);
        if (order == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "Order not found"));
        }
        return ResponseEntity.ok(Map.of("success", true, "data", order));
    }
}
