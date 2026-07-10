package com.ttrims.ims.controller;

import com.ttrims.ims.entity.Order;
import com.ttrims.ims.entity.OrderItem;
import com.ttrims.ims.entity.Product;
import com.ttrims.ims.entity.Shipment;
import com.ttrims.ims.entity.ShipmentOrder;
import com.ttrims.ims.repository.OrderRepository;
import com.ttrims.ims.repository.ShipmentOrderRepository;
import com.ttrims.ims.repository.ShipmentRepository;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

import com.ttrims.ims.service.LogisticsService;

@RestController
@RequestMapping("/api/dispatch")
public class DispatchController {
    private final OrderRepository orderRepo;
    private final ShipmentRepository shipmentRepo;
    private final ShipmentOrderRepository shipmentOrderRepo;
    private final AuthHelper auth;
    private final LogisticsService logisticsService;

    public DispatchController(OrderRepository orderRepo,
                              ShipmentRepository shipmentRepo,
                              ShipmentOrderRepository shipmentOrderRepo,
                              AuthHelper auth,
                              LogisticsService logisticsService) {
        this.orderRepo = orderRepo;
        this.shipmentRepo = shipmentRepo;
        this.shipmentOrderRepo = shipmentOrderRepo;
        this.auth = auth;
        this.logisticsService = logisticsService;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> listDispatches(@RequestParam(required = false) String status) {
        auth.requirePermission("DISPATCH:VIEW");
        List<Order> orders;
        if (status != null && !status.isBlank()) {
            orders = orderRepo.findByDispatchStatusOrderByCreatedAtDesc(status.toUpperCase());
        } else {
            orders = orderRepo.findAllByOrderByCreatedAtDesc();
        }

        List<Map<String, Object>> result = orders.stream()
            .map(this::toDto)
            .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    /**
     * Completes dispatch for a single order.
     * Requires delivery_method: COMPANY_DELIVERY | CUSTOMER_PICKUP
     */
    @PostMapping("/{id}/complete")
    @Transactional
    public ResponseEntity<?> completeDispatch(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        auth.requirePermission("DISPATCH:MANAGE");
        Order order = orderRepo.findById(id).orElse(null);
        if (order == null) return bad("Order not found");

        if ("DISPATCHED".equals(order.getDispatchStatus())) {
            return bad("Order is already dispatched");
        }

        // Determine delivery method — default to COMPANY_DELIVERY for backward compat
        String deliveryMethodStr = body != null ? (String) body.get("delivery_method") : null;
        Shipment.DeliveryMethod deliveryMethod = Shipment.DeliveryMethod.COMPANY_DELIVERY;
        if ("CUSTOMER_PICKUP".equalsIgnoreCase(deliveryMethodStr)) {
            deliveryMethod = Shipment.DeliveryMethod.CUSTOMER_PICKUP;
        }

        // Calculate bags / pcs
        int totalPcs = 0;
        int totalBags = 0;
        for (OrderItem item : order.getItems()) {
            Product p = item.getProduct();
            if (p != null) {
                double qty = item.getQtyRequired() != null ? item.getQtyRequired() : 0.0;
                if ("PCS".equalsIgnoreCase(item.getUnit()) || "PACK".equalsIgnoreCase(item.getUnit()) || "PCS".equalsIgnoreCase(p.getUnit())) {
                    totalPcs += qty;
                }
                int pcsPerBag = 0;
                if (p.getPcsPerBag() != null && p.getPcsPerBag() > 0) {
                    pcsPerBag = p.getPcsPerBag();
                } else if (p.getPcsPerInnerbag() != null && p.getInnerbagsPerBag() != null) {
                    pcsPerBag = p.getPcsPerInnerbag() * p.getInnerbagsPerBag();
                }
                if (pcsPerBag > 0) {
                    totalBags += (int) Math.ceil(qty / pcsPerBag);
                }
            }
        }

        order.setDispatchStatus("DISPATCHED");
        order.setDispatchPcs(totalPcs);
        order.setDispatchBags(totalBags);
        order.setDispatchedAt(LocalDateTime.now());
        order.setDispatchedBy(auth.currentUser().getName());
        order = orderRepo.save(order);

        Map<String, Object> extra = new LinkedHashMap<>();

        if (deliveryMethod == Shipment.DeliveryMethod.CUSTOMER_PICKUP) {
            // For customer pickup: mark the order's shipment as PICKED_UP immediately
            Optional<ShipmentOrder> shipmentOrderOpt = shipmentOrderRepo.findByOrderId(order.getId());
            if (shipmentOrderOpt.isPresent()) {
                Shipment shipment = shipmentOrderOpt.get().getShipment();
                shipment.setDeliveryMethod(Shipment.DeliveryMethod.CUSTOMER_PICKUP);
                shipment.setStatus(Shipment.Status.PICKED_UP);
                shipment.setDispatchedAt(LocalDateTime.now());
                shipment.setDeliveredAt(LocalDateTime.now());
                // Mark the stop as delivered
                ShipmentOrder so = shipmentOrderOpt.get();
                so.setStatus("DELIVERED");
                so.setDeliveredAt(LocalDateTime.now());
                so.setDeliveryNotes("Customer Self Pickup");
                shipmentOrderRepo.save(so);
                shipmentRepo.save(shipment);
                extra.put("delivery_method", "CUSTOMER_PICKUP");
                extra.put("shipment_number", shipment.getShipmentNumber());
                extra.put("message", "Customer self-pickup recorded. No driver assignment required.");
            } else {
                // Order not yet grouped — create a minimal PICKED_UP shipment
                Shipment pickup = new Shipment();
                pickup.setShipmentNumber("SHM-PKP-" + System.currentTimeMillis());
                pickup.setStatus(Shipment.Status.PICKED_UP);
                pickup.setDeliveryMethod(Shipment.DeliveryMethod.CUSTOMER_PICKUP);
                pickup.setOrigin("Main Warehouse Depot");
                pickup.setDestination(order.getDeliveryAddress() != null ? order.getDeliveryAddress() : "Customer Pickup");
                pickup.setCreatedBy(auth.currentUser().getName());
                pickup.setDispatchedAt(LocalDateTime.now());
                pickup.setDeliveredAt(LocalDateTime.now());
                pickup.setAutoGrouped(false);
                pickup = shipmentRepo.save(pickup);

                ShipmentOrder so = new ShipmentOrder();
                so.setShipment(pickup);
                so.setOrder(order);
                so.setStatus("DELIVERED");
                so.setDispatchBags(totalBags);
                so.setDispatchPcs(totalPcs);
                so.setDeliveredAt(LocalDateTime.now());
                so.setDeliveryNotes("Customer Self Pickup");
                shipmentOrderRepo.save(so);

                extra.put("delivery_method", "CUSTOMER_PICKUP");
                extra.put("shipment_number", pickup.getShipmentNumber());
                extra.put("message", "Customer self-pickup shipment created.");
            }
        } else {
            // Company delivery: ensure the order is grouped into a shipment with a driver
            try {
                logisticsService.handleAutoShipment(order);
            } catch (Exception e) {
                System.err.println("Error in auto-shipment grouping: " + e.getMessage());
                e.printStackTrace();
            }

            // Return auto-assigned driver info
            Optional<ShipmentOrder> so = shipmentOrderRepo.findByOrderId(order.getId());
            if (so.isPresent()) {
                Shipment s = so.get().getShipment();
                s.setDeliveryMethod(Shipment.DeliveryMethod.COMPANY_DELIVERY);
                shipmentRepo.save(s);
                extra.put("delivery_method", "COMPANY_DELIVERY");
                extra.put("shipment_number", s.getShipmentNumber());
                extra.put("driver_name", s.getDriverName());
                extra.put("vehicle_number", s.getVehicleNumber());
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("data", toDto(order));
        response.putAll(extra);
        return ResponseEntity.ok(response);
    }

    /**
     * Triggers bulk grouping of all eligible orders on demand.
     */
    @PostMapping("/group-all")
    @Transactional
    public ResponseEntity<?> groupAllOrders() {
        auth.requirePermission("DISPATCH:MANAGE");
        try {
            List<String> grouped = logisticsService.groupAllEligibleOrders();
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Grouped " + grouped.size() + " shipment(s)",
                "shipments", grouped
            ));
        } catch (Exception e) {
            return bad("Grouping failed: " + e.getMessage());
        }
    }

    @PostMapping("/{id}/cancel")
    @Transactional
    public ResponseEntity<?> cancelDispatch(@PathVariable String id) {
        auth.requirePermission("DISPATCH:MANAGE");
        Order order = orderRepo.findById(id).orElse(null);
        if (order == null) return bad("Order not found");

        if (!"DISPATCHED".equals(order.getDispatchStatus())) {
            return bad("Order is not dispatched yet");
        }

        order.setDispatchStatus("PENDING");
        order.setDispatchPcs(0);
        order.setDispatchBags(0);
        order.setDispatchedAt(null);
        order.setDispatchedBy(null);

        orderRepo.save(order);

        return ResponseEntity.ok(Map.of("success", true, "data", toDto(order)));
    }

    @GetMapping("/summary")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getDispatchSummary() {
        auth.requirePermission("DISPATCH:VIEW");
        List<Order> all = orderRepo.findAll();

        int pendingCount = 0;
        int dispatchedCount = 0;
        int totalBags = 0;
        int totalPcs = 0;

        for (Order o : all) {
            if ("PENDING".equals(o.getDispatchStatus())) {
                pendingCount++;
            } else if ("DISPATCHED".equals(o.getDispatchStatus())) {
                dispatchedCount++;
                totalBags += o.getDispatchBags() != null ? o.getDispatchBags() : 0;
                totalPcs += o.getDispatchPcs() != null ? o.getDispatchPcs() : 0;
            }
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("pending_dispatch_count", pendingCount);
        summary.put("completed_dispatch_count", dispatchedCount);
        summary.put("total_dispatched_bags", totalBags);
        summary.put("total_dispatched_pcs", totalPcs);

        return ResponseEntity.ok(Map.of("success", true, "data", summary));
    }

    private Map<String, Object> toDto(Order o) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", o.getId());
        dto.put("order_number", o.getOrderNumber());
        dto.put("customer", o.getCustomer());
        dto.put("status", o.getStatus().name());
        dto.put("dispatch_status", o.getDispatchStatus());
        dto.put("dispatch_bags", o.getDispatchBags());
        dto.put("dispatch_pcs", o.getDispatchPcs());
        dto.put("dispatched_at", o.getDispatchedAt() != null ? o.getDispatchedAt().toString() : null);
        dto.put("dispatched_by", o.getDispatchedBy());
        dto.put("delivery_address", o.getDeliveryAddress());
        dto.put("latitude", o.getLatitude());
        dto.put("longitude", o.getLongitude());
        dto.put("created_at", o.getCreatedAt() != null ? o.getCreatedAt().toString() : null);

        List<Map<String, Object>> itemsList = new ArrayList<>();
        if (o.getItems() != null) {
            for (OrderItem item : o.getItems()) {
                Map<String, Object> itemMap = new LinkedHashMap<>();
                itemMap.put("product_name", item.getProduct() != null ? item.getProduct().getName() : "Unknown");
                itemMap.put("product_code", item.getProduct() != null ? item.getProduct().getCode() : "—");
                itemMap.put("qty_required", item.getQtyRequired());
                itemMap.put("unit", item.getUnit());

                Product p = item.getProduct();
                if (p != null) {
                    itemMap.put("pcs_per_bag", p.getPcsPerBag());
                    itemMap.put("pcs_per_innerbag", p.getPcsPerInnerbag());
                    itemMap.put("innerbags_per_bag", p.getInnerbagsPerBag());
                }
                itemsList.add(itemMap);
            }
        }
        dto.put("items", itemsList);

        return dto;
    }

    private ResponseEntity<?> bad(String msg) { return ResponseEntity.badRequest().body(Map.of("success", false, "message", msg)); }
}
