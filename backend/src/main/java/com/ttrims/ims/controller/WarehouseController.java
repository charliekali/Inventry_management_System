package com.ttrims.ims.controller;

import com.ttrims.ims.entity.*;
import com.ttrims.ims.repository.*;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/warehouses")
public class WarehouseController {
    private final WarehouseRepository warehouseRepo;
    private final SectionRepository sectionRepo;
    private final AuthHelper auth;

    public WarehouseController(WarehouseRepository warehouseRepo, SectionRepository sectionRepo, AuthHelper auth) {
        this.warehouseRepo = warehouseRepo;
        this.sectionRepo = sectionRepo;
        this.auth = auth;
    }

    @GetMapping
    public ResponseEntity<?> list() {
        auth.requirePermission("WAREHOUSES:VIEW");
        var whs = warehouseRepo.findByActiveTrueOrderByName().stream()
            .map(w -> {
                Map<String, Object> m = toDto(w);
                m.put("section_count", sectionRepo.findByWarehouseAndActiveTrueOrderByName(w).size());
                return m;
            }).collect(Collectors.toList());
        return ok(whs);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, String> body) {
        auth.requirePermission("WAREHOUSES:CREATE");
        if (body.get("name") == null) return bad("Warehouse name is required");
        Warehouse wh = new Warehouse();
        wh.setName(body.get("name"));
        wh.setLocation(body.get("location"));
        wh.setActive(true);
        warehouseRepo.save(wh);
        return ResponseEntity.status(201).body(Map.of("success", true, "data", toDto(wh)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        auth.requirePermission("WAREHOUSES:EDIT");
        Warehouse wh = warehouseRepo.findById(id).orElse(null);
        if (wh == null) return ResponseEntity.status(404).body(err("Warehouse not found"));
        if (body.containsKey("name")) wh.setName((String) body.get("name"));
        if (body.containsKey("location")) wh.setLocation((String) body.get("location"));
        if (body.containsKey("is_active")) wh.setActive((Boolean) body.get("is_active"));
        warehouseRepo.save(wh);
        return ok(toDto(wh));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        auth.requirePermission("WAREHOUSES:DELETE");
        warehouseRepo.findById(id).ifPresent(w -> { w.setActive(false); warehouseRepo.save(w); });
        return ok("Warehouse archived");
    }

    // ─── Sections ─────────────────────────────────────────────────────────────

    @GetMapping("/{warehouseId}/sections")
    @Transactional(readOnly = true)
    public ResponseEntity<?> listSections(@PathVariable String warehouseId) {
        auth.requirePermission("SECTIONS:VIEW");
        Warehouse wh = warehouseRepo.findById(warehouseId).orElse(null);
        if (wh == null) return ResponseEntity.status(404).body(err("Warehouse not found"));
        var sections = sectionRepo.findByWarehouseAndActiveTrueOrderByName(wh).stream()
            .map(this::sectionDto).collect(Collectors.toList());
        return ok(sections);
    }

    @PostMapping("/{warehouseId}/sections")
    public ResponseEntity<?> createSection(@PathVariable String warehouseId, @RequestBody Map<String, String> body) {
        auth.requirePermission("SECTIONS:CREATE");
        Warehouse wh = warehouseRepo.findById(warehouseId).orElse(null);
        if (wh == null) return ResponseEntity.status(404).body(err("Warehouse not found"));
        if (body.get("name") == null) return bad("Section name is required");
        Section s = new Section();
        s.setWarehouse(wh);
        s.setName(body.get("name"));
        s.setDescription(body.get("description"));
        s.setActive(true);
        sectionRepo.save(s);
        return ResponseEntity.status(201).body(Map.of("success", true, "data", sectionDto(s)));
    }

    @PatchMapping("/{warehouseId}/sections/{id}")
    public ResponseEntity<?> updateSection(@PathVariable String warehouseId, @PathVariable String id, @RequestBody Map<String, Object> body) {
        auth.requirePermission("SECTIONS:EDIT");
        Section s = sectionRepo.findById(id).orElse(null);
        if (s == null || !s.getWarehouse().getId().equals(warehouseId)) return ResponseEntity.status(404).body(err("Section not found"));
        if (body.containsKey("name")) s.setName((String) body.get("name"));
        if (body.containsKey("description")) s.setDescription((String) body.get("description"));
        if (body.containsKey("is_active")) s.setActive((Boolean) body.get("is_active"));
        sectionRepo.save(s);
        return ok(sectionDto(s));
    }

    @DeleteMapping("/{warehouseId}/sections/{id}")
    public ResponseEntity<?> deleteSection(@PathVariable String warehouseId, @PathVariable String id) {
        auth.requirePermission("SECTIONS:DELETE");
        sectionRepo.findById(id).ifPresent(s -> { s.setActive(false); sectionRepo.save(s); });
        return ok("Section archived");
    }

    private Map<String, Object> toDto(Warehouse w) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", w.getId()); m.put("name", w.getName()); m.put("location", w.getLocation());
        m.put("is_active", w.isActive()); m.put("created_at", w.getCreatedAt());
        return m;
    }

    private Map<String, Object> sectionDto(Section s) {
        return Map.of("id", s.getId(), "name", s.getName(),
            "description", s.getDescription() != null ? s.getDescription() : "",
            "is_active", s.isActive(), "warehouse_id", s.getWarehouse().getId(),
            "warehouse_name", s.getWarehouse().getName(),
            "created_at", s.getCreatedAt() != null ? s.getCreatedAt().toString() : "");
    }

    private ResponseEntity<?> ok(Object data) { return ResponseEntity.ok(Map.of("success", true, "data", data)); }
    private ResponseEntity<?> bad(String msg) { return ResponseEntity.badRequest().body(err(msg)); }
    private Map<String, Object> err(String msg) { return Map.of("success", false, "message", msg); }
}
