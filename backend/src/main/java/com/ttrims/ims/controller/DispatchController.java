package com.ttrims.ims.controller;

import com.ttrims.ims.entity.Order;
import com.ttrims.ims.entity.OrderItem;
import com.ttrims.ims.entity.Product;
import com.ttrims.ims.repository.OrderRepository;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dispatch")
public class DispatchController {
    private final OrderRepository orderRepo;
    private final AuthHelper auth;

    public DispatchController(OrderRepository orderRepo, AuthHelper auth) {
        this.orderRepo = orderRepo;
        this.auth = auth;
    }

    @GetMapping
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

    @PostMapping("/{id}/complete")
    @Transactional
    public ResponseEntity<?> completeDispatch(@PathVariable String id) {
        auth.requirePermission("DISPATCH:MANAGE");
        Order order = orderRepo.findById(id).orElse(null);
        if (order == null) return bad("Order not found");
        
        if ("DISPATCHED".equals(order.getDispatchStatus())) {
            return bad("Order is already dispatched");
        }

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

        orderRepo.save(order);

        return ResponseEntity.ok(Map.of("success", true, "data", toDto(order)));
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
        dto.put("created_at", o.getCreatedAt() != null ? o.getCreatedAt().toString() : null);
        return dto;
    }

    private ResponseEntity<?> bad(String msg) { return ResponseEntity.badRequest().body(Map.of("success", false, "message", msg)); }
}
