package com.ttrims.ims.controller;

import com.ttrims.ims.entity.Order;
import com.ttrims.ims.entity.User;
import com.ttrims.ims.entity.VisitAllocation;
import com.ttrims.ims.repository.OrderRepository;
import com.ttrims.ims.repository.UserRepository;
import com.ttrims.ims.repository.VisitAllocationRepository;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/visit-allocations")
public class VisitAllocationController {

    private final VisitAllocationRepository visitRepo;
    private final UserRepository userRepo;
    private final OrderRepository orderRepo;
    private final AuthHelper auth;

    public VisitAllocationController(VisitAllocationRepository visitRepo, UserRepository userRepo, OrderRepository orderRepo, AuthHelper auth) {
        this.visitRepo = visitRepo;
        this.userRepo = userRepo;
        this.orderRepo = orderRepo;
        this.auth = auth;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list(@RequestParam(required = false) String date,
                                  @RequestParam(required = false) String salespersonId) {
        auth.requirePermission("SALES:CRM");

        List<VisitAllocation> list;
        if (date != null && !date.trim().isEmpty() && salespersonId != null && !salespersonId.trim().isEmpty()) {
            LocalDate d = LocalDate.parse(date);
            list = visitRepo.findBySalespersonIdAndVisitDateOrderBySequenceAsc(salespersonId, d);
        } else if (date != null && !date.trim().isEmpty()) {
            LocalDate d = LocalDate.parse(date);
            list = visitRepo.findByVisitDateOrderBySalespersonIdAscSequenceAsc(d);
        } else if (salespersonId != null && !salespersonId.trim().isEmpty()) {
            list = visitRepo.findBySalespersonIdOrderByVisitDateDescSequenceAsc(salespersonId);
        } else {
            list = visitRepo.findAllByOrderByVisitDateDescSequenceAsc();
        }

        var result = list.stream().map(this::toDto).collect(Collectors.toList());
        return ok(result);
    }

    @GetMapping("/my")
    @Transactional(readOnly = true)
    public ResponseEntity<?> listMy(@RequestParam(required = false) String date) {
        User me = auth.currentUser();
        LocalDate d = (date != null && !date.trim().isEmpty()) ? LocalDate.parse(date) : LocalDate.now();
        List<VisitAllocation> list = visitRepo.findBySalespersonIdAndVisitDateOrderBySequenceAsc(me.getId(), d);
        var result = list.stream().map(this::toDto).collect(Collectors.toList());
        return ok(result);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        auth.requireSuperAdmin();

        String salespersonId = (String) body.get("salespersonId");
        String orderId = (String) body.get("orderId");
        String dateStr = (String) body.get("visitDate");
        String notes = (String) body.get("notes");

        if (salespersonId == null || salespersonId.trim().isEmpty() || dateStr == null || dateStr.trim().isEmpty()) {
            return bad("salespersonId and visitDate are required");
        }

        User salesperson = userRepo.findById(salespersonId).orElse(null);
        if (salesperson == null) return ResponseEntity.status(404).body(err("Salesperson not found"));

        Order order = null;
        if (orderId != null && !orderId.trim().isEmpty()) {
            order = orderRepo.findById(orderId).orElse(null);
            if (order == null) return ResponseEntity.status(404).body(err("Lead or customer order reference not found"));
        }

        LocalDate visitDate = LocalDate.parse(dateStr);
        Integer maxSeq = visitRepo.findMaxSequenceBySalespersonIdAndVisitDate(salespersonId, visitDate);

        VisitAllocation allocation = new VisitAllocation();
        allocation.setSalesperson(salesperson);
        allocation.setOrder(order);
        allocation.setVisitDate(visitDate);
        allocation.setSequence(maxSeq + 1);
        allocation.setStatus("PENDING");
        allocation.setNotes(notes);

        visitRepo.save(allocation);
        return ResponseEntity.status(201).body(Map.of("success", true, "data", toDto(allocation)));
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public ResponseEntity<?> updateStatus(@PathVariable String id, @RequestBody Map<String, String> body) {
        VisitAllocation allocation = visitRepo.findById(id).orElse(null);
        if (allocation == null) return ResponseEntity.status(404).body(err("Visit allocation not found"));

        User me = auth.currentUser();
        boolean isAssigned = allocation.getSalesperson().getId().equals(me.getId());
        boolean isAdmin = auth.isSuperAdmin();
        if (!isAssigned && !isAdmin) {
            return ResponseEntity.status(403).body(err("You are not authorized to update this visit status"));
        }

        String status = body.get("status");
        if (status == null || (!status.equals("PENDING") && !status.equals("COMPLETED") && !status.equals("SKIPPED"))) {
            return bad("Invalid status. Must be PENDING, COMPLETED, or SKIPPED");
        }

        allocation.setStatus(status);
        visitRepo.save(allocation);
        return ok(Map.of("success", true, "message", "Status updated successfully", "data", toDto(allocation)));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        auth.requireSuperAdmin();
        VisitAllocation allocation = visitRepo.findById(id).orElse(null);
        if (allocation == null) return ResponseEntity.status(404).body(err("Visit allocation not found"));

        if (body.containsKey("visitDate")) {
            allocation.setVisitDate(LocalDate.parse((String) body.get("visitDate")));
        }
        if (body.containsKey("notes")) {
            allocation.setNotes((String) body.get("notes"));
        }
        if (body.containsKey("sequence")) {
            allocation.setSequence(((Number) body.get("sequence")).intValue());
        }
        if (body.containsKey("status")) {
            allocation.setStatus((String) body.get("status"));
        }
        if (body.containsKey("salespersonId")) {
            User salesperson = userRepo.findById((String) body.get("salespersonId")).orElse(null);
            if (salesperson != null) {
                allocation.setSalesperson(salesperson);
            }
        }

        visitRepo.save(allocation);
        return ok(toDto(allocation));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> delete(@PathVariable String id) {
        auth.requireSuperAdmin();
        VisitAllocation allocation = visitRepo.findById(id).orElse(null);
        if (allocation == null) return ResponseEntity.status(404).body(err("Visit allocation not found"));
        visitRepo.delete(allocation);
        return ok(Map.of("success", true, "message", "Visit allocation deleted successfully"));
    }

    @PatchMapping("/reorder")
    @Transactional
    public ResponseEntity<?> reorder(@RequestBody List<String> allocationIds) {
        auth.requireSuperAdmin();
        if (allocationIds == null || allocationIds.isEmpty()) {
            return bad("No allocations specified for reordering");
        }
        for (int i = 0; i < allocationIds.size(); i++) {
            String id = allocationIds.get(i);
            Optional<VisitAllocation> opt = visitRepo.findById(id);
            if (opt.isPresent()) {
                VisitAllocation v = opt.get();
                v.setSequence(i + 1);
                visitRepo.save(v);
            }
        }
        return ok(Map.of("success", true, "message", "Allocations reordered successfully"));
    }

    private Map<String, Object> toDto(VisitAllocation v) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", v.getId());
        m.put("salesperson_id", v.getSalesperson().getId());
        m.put("salesperson_name", v.getSalesperson().getName());
        m.put("visit_date", v.getVisitDate().toString());
        m.put("sequence", v.getSequence());
        m.put("visit_status", v.getStatus());
        m.put("status", v.getStatus());
        m.put("notes", v.getNotes());
        m.put("remarks", v.getNotes());
        m.put("created_at", v.getCreatedAt() != null ? v.getCreatedAt().toString() : null);
        m.put("updated_at", v.getUpdatedAt() != null ? v.getUpdatedAt().toString() : null);

        if (v.getOrder() != null) {
            Order o = v.getOrder();
            m.put("order_id", o.getId());
            m.put("order_number", o.getOrderNumber());
            m.put("customer", o.getCustomer());
            m.put("customer_name", o.getCustomer());
            
            boolean isLead = o.getInvoiceNumber() == null || (o.getCustomFields() != null && "true".equals(o.getCustomFields().get("is_lead")));
            m.put("is_lead_order", isLead);
            
            double paid = o.getPaidAmount() != null ? o.getPaidAmount() : 0.0;
            double balance = Math.round((o.getGrandTotal() - paid) * 100.0) / 100.0;
            m.put("grand_total", o.getGrandTotal());
            m.put("balance", balance);

            Map<String, String> fields = new HashMap<>();
            if (o.getCustomFields() != null) {
                fields.putAll(o.getCustomFields());
            }
            m.put("custom_fields", fields);
        } else {
            m.put("order_id", null);
            m.put("order_number", "VISIT-" + v.getSequence());
            m.put("customer", "Custom Visit");
            m.put("customer_name", "Custom Visit");
            m.put("is_lead_order", false);
            m.put("grand_total", 0.0);
            m.put("balance", 0.0);
            m.put("custom_fields", new HashMap<String, String>());
        }

        return m;
    }

    private ResponseEntity<?> ok(Object data) { return ResponseEntity.ok(Map.of("success", true, "data", data)); }
    private ResponseEntity<?> bad(String msg) { return ResponseEntity.badRequest().body(err(msg)); }
    private Map<String, Object> err(String msg) { return Map.of("success", false, "message", msg); }
}
