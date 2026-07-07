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
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/shipments")
public class ShipmentController {

    private final ShipmentRepository shipmentRepo;
    private final ShipmentOrderRepository shipmentOrderRepo;
    private final OrderRepository orderRepo;
    private final AuthHelper auth;

    public ShipmentController(ShipmentRepository shipmentRepo,
                              ShipmentOrderRepository shipmentOrderRepo,
                              OrderRepository orderRepo,
                              AuthHelper auth) {
        this.shipmentRepo = shipmentRepo;
        this.shipmentOrderRepo = shipmentOrderRepo;
        this.orderRepo = orderRepo;
        this.auth = auth;
    }

    @GetMapping
    public ResponseEntity<?> listShipments(@RequestParam(required = false) String status) {
        auth.requirePermission("SHIPMENTS:VIEW");
        List<Shipment> shipments;
        if (status != null && !status.isBlank()) {
            try {
                Shipment.Status s = Shipment.Status.valueOf(status.toUpperCase());
                shipments = shipmentRepo.findByStatusOrderByCreatedAtDesc(s);
            } catch (IllegalArgumentException e) {
                shipments = shipmentRepo.findAllByOrderByCreatedAtDesc();
            }
        } else {
            shipments = shipmentRepo.findAllByOrderByCreatedAtDesc();
        }

        List<Map<String, Object>> result = shipments.stream()
                .map(this::toDto)
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getShipment(@PathVariable String id) {
        auth.requirePermission("SHIPMENTS:VIEW");
        Shipment shipment = shipmentRepo.findById(id).orElse(null);
        if (shipment == null) return bad("Shipment not found");
        return ResponseEntity.ok(Map.of("success", true, "data", toDto(shipment)));
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> createShipment(@RequestBody Map<String, Object> body) {
        auth.requirePermission("SHIPMENTS:CREATE");

        String vehicleNumber = (String) body.get("vehicle_number");
        String driverName = (String) body.get("driver_name");
        String driverPhone = (String) body.get("driver_phone");
        String origin = (String) body.get("origin");
        String destination = (String) body.get("destination");
        String scheduledAtStr = (String) body.get("scheduled_at");
        List<String> orderIds = (List<String>) body.get("order_ids");

        if (orderIds == null || orderIds.isEmpty()) {
            return bad("At least one order must be selected for shipment");
        }

        Shipment shipment = new Shipment();
        shipment.setShipmentNumber("SHM-" + System.currentTimeMillis());
        shipment.setVehicleNumber(vehicleNumber);
        shipment.setDriverName(driverName);
        shipment.setDriverPhone(driverPhone);
        shipment.setOrigin(origin);
        shipment.setDestination(destination);
        shipment.setCreatedBy(auth.currentUser().getName());

        if (scheduledAtStr != null && !scheduledAtStr.isBlank()) {
            try {
                shipment.setScheduledAt(LocalDateTime.parse(scheduledAtStr, DateTimeFormatter.ISO_DATE_TIME));
            } catch (Exception e) {
                shipment.setScheduledAt(LocalDateTime.now().plusDays(1));
            }
        } else {
            shipment.setScheduledAt(LocalDateTime.now());
        }

        shipment.setStatus(Shipment.Status.CREATED);
        shipment = shipmentRepo.save(shipment);

        List<ShipmentOrder> shipmentOrders = new ArrayList<>();
        for (String orderId : orderIds) {
            Order order = orderRepo.findById(orderId).orElse(null);
            if (order == null) continue;

            // Calculate bags/pcs for this order
            int orderPcs = 0;
            int orderBags = 0;

            for (OrderItem item : order.getItems()) {
                Product p = item.getProduct();
                if (p != null) {
                    double qty = item.getQtyRequired() != null ? item.getQtyRequired() : 0.0;
                    if ("PCS".equalsIgnoreCase(item.getUnit()) || "PACK".equalsIgnoreCase(item.getUnit()) || "PCS".equalsIgnoreCase(p.getUnit())) {
                        orderPcs += qty;
                    }

                    int pcsPerBag = 0;
                    if (p.getPcsPerBag() != null && p.getPcsPerBag() > 0) {
                        pcsPerBag = p.getPcsPerBag();
                    } else if (p.getPcsPerInnerbag() != null && p.getInnerbagsPerBag() != null) {
                        pcsPerBag = p.getPcsPerInnerbag() * p.getInnerbagsPerBag();
                    }

                    if (pcsPerBag > 0) {
                        orderBags += (int) Math.ceil(qty / pcsPerBag);
                    }
                }
            }

            ShipmentOrder so = new ShipmentOrder();
            so.setShipment(shipment);
            so.setOrder(order);
            so.setDispatchBags(orderBags);
            so.setDispatchPcs(orderPcs);
            shipmentOrderRepo.save(so);
            shipmentOrders.add(so);
        }

        shipment.setShipmentOrders(shipmentOrders);
        return ResponseEntity.ok(Map.of("success", true, "data", toDto(shipment)));
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public ResponseEntity<?> updateStatus(@PathVariable String id, @RequestBody Map<String, String> body) {
        auth.requirePermission("SHIPMENTS:MANAGE");
        Shipment shipment = shipmentRepo.findById(id).orElse(null);
        if (shipment == null) return bad("Shipment not found");

        String statusStr = body.get("status");
        if (statusStr == null) return bad("Status is required");

        try {
            Shipment.Status newStatus = Shipment.Status.valueOf(statusStr.toUpperCase());
            
            if (newStatus == Shipment.Status.EN_ROUTE && shipment.getStatus() == Shipment.Status.CREATED) {
                shipment.setDispatchedAt(LocalDateTime.now());
            }
            
            shipment.setStatus(newStatus);
            shipmentRepo.save(shipment);
            return ResponseEntity.ok(Map.of("success", true, "data", toDto(shipment)));
        } catch (IllegalArgumentException e) {
            return bad("Invalid status");
        }
    }

    @PostMapping("/{id}/deliver")
    @Transactional
    public ResponseEntity<?> deliverShipment(@PathVariable String id, @RequestBody Map<String, String> body) {
        auth.requirePermission("DELIVERY:CONFIRM");
        Shipment shipment = shipmentRepo.findById(id).orElse(null);
        if (shipment == null) return bad("Shipment not found");

        if (shipment.getStatus() == Shipment.Status.DELIVERED) {
            return bad("Shipment already delivered");
        }

        String notes = body.get("delivery_notes");
        String status = body.get("status"); // DELIVERED or FAILED

        Shipment.Status shipmentStatus = Shipment.Status.DELIVERED;
        if ("FAILED".equalsIgnoreCase(status)) {
            shipmentStatus = Shipment.Status.FAILED;
        }

        shipment.setStatus(shipmentStatus);
        shipment.setDeliveredAt(LocalDateTime.now());
        shipment.setDeliveryNotes(notes);
        shipmentRepo.save(shipment);

        // If delivered successfully, mark all linked orders as DISPATCHED
        if (shipmentStatus == Shipment.Status.DELIVERED) {
            for (ShipmentOrder so : shipment.getShipmentOrders()) {
                Order order = so.getOrder();
                if (order != null) {
                    order.setDispatchStatus("DISPATCHED");
                    order.setDispatchBags(so.getDispatchBags());
                    order.setDispatchPcs(so.getDispatchPcs());
                    order.setDispatchedAt(LocalDateTime.now());
                    order.setDispatchedBy(auth.currentUser().getName());
                    orderRepo.save(order);
                }
            }
        }

        return ResponseEntity.ok(Map.of("success", true, "data", toDto(shipment)));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> cancelShipment(@PathVariable String id) {
        auth.requirePermission("SHIPMENTS:MANAGE");
        Shipment shipment = shipmentRepo.findById(id).orElse(null);
        if (shipment == null) return bad("Shipment not found");

        if (shipment.getStatus() != Shipment.Status.CREATED) {
            return bad("Only shipments in CREATED state can be cancelled");
        }

        shipmentRepo.delete(shipment);
        return ResponseEntity.ok(Map.of("success", true, "message", "Shipment cancelled successfully"));
    }

    @GetMapping("/analytics")
    public ResponseEntity<?> getAnalytics() {
        auth.requirePermission("SHIPMENTS:VIEW");
        List<Shipment> all = shipmentRepo.findAll();

        int created = 0, enRoute = 0, delivered = 0, failed = 0;
        int totalBags = 0;
        int totalPcs = 0;

        for (Shipment s : all) {
            switch (s.getStatus()) {
                case CREATED -> created++;
                case EN_ROUTE -> enRoute++;
                case DELIVERED -> {
                    delivered++;
                    for (ShipmentOrder so : s.getShipmentOrders()) {
                        totalBags += so.getDispatchBags() != null ? so.getDispatchBags() : 0;
                        totalPcs += so.getDispatchPcs() != null ? so.getDispatchPcs() : 0;
                    }
                }
                case FAILED -> failed++;
            }
        }

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total_shipments", all.size());
        stats.put("created", created);
        stats.put("en_route", enRoute);
        stats.put("delivered", delivered);
        stats.put("failed", failed);
        stats.put("delivered_bags", totalBags);
        stats.put("delivered_pcs", totalPcs);

        return ResponseEntity.ok(Map.of("success", true, "data", stats));
    }

    private Map<String, Object> toDto(Shipment s) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", s.getId());
        dto.put("shipment_number", s.getShipmentNumber());
        dto.put("vehicle_number", s.getVehicleNumber());
        dto.put("driver_name", s.getDriverName());
        dto.put("driver_phone", s.getDriverPhone());
        dto.put("origin", s.getOrigin());
        dto.put("destination", s.getDestination());
        dto.put("status", s.getStatus().name());
        dto.put("scheduled_at", s.getScheduledAt() != null ? s.getScheduledAt().toString() : null);
        dto.put("dispatched_at", s.getDispatchedAt() != null ? s.getDispatchedAt().toString() : null);
        dto.put("delivered_at", s.getDeliveredAt() != null ? s.getDeliveredAt().toString() : null);
        dto.put("delivery_notes", s.getDeliveryNotes());
        dto.put("created_by", s.getCreatedBy());
        dto.put("created_at", s.getCreatedAt() != null ? s.getCreatedAt().toString() : null);

        List<Map<String, Object>> ordersList = new ArrayList<>();
        int totalBags = 0;
        int totalPcs = 0;

        for (ShipmentOrder so : s.getShipmentOrders()) {
            Order o = so.getOrder();
            if (o != null) {
                Map<String, Object> orderMap = new LinkedHashMap<>();
                orderMap.put("id", o.getId());
                orderMap.put("order_number", o.getOrderNumber());
                orderMap.put("customer", o.getCustomer());
                orderMap.put("status", o.getStatus().name());
                orderMap.put("dispatch_bags", so.getDispatchBags());
                orderMap.put("dispatch_pcs", so.getDispatchPcs());
                orderMap.put("notes", so.getNotes());

                // Items serialization
                List<Map<String, Object>> itemsList = new ArrayList<>();
                for (OrderItem item : o.getItems()) {
                    Map<String, Object> itemMap = new LinkedHashMap<>();
                    itemMap.put("product_name", item.getProduct() != null ? item.getProduct().getName() : "Unknown");
                    itemMap.put("product_code", item.getProduct() != null ? item.getProduct().getCode() : "—");
                    itemMap.put("qty_required", item.getQtyRequired());
                    itemMap.put("unit", item.getUnit());
                    itemsList.add(itemMap);
                }
                orderMap.put("items", itemsList);

                ordersList.add(orderMap);

                totalBags += so.getDispatchBags() != null ? so.getDispatchBags() : 0;
                totalPcs += so.getDispatchPcs() != null ? so.getDispatchPcs() : 0;
            }
        }
        dto.put("orders", ordersList);
        dto.put("total_bags", totalBags);
        dto.put("total_pcs", totalPcs);

        return dto;
    }

    private ResponseEntity<?> bad(String msg) {
        return ResponseEntity.badRequest().body(Map.of("success", false, "message", msg));
    }
}
