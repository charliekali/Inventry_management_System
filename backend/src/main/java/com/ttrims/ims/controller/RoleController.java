package com.ttrims.ims.controller;

import com.ttrims.ims.entity.*;
import com.ttrims.ims.repository.*;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/roles")
public class RoleController {
    private final RoleRepository roleRepo;
    private final PermissionRepository permRepo;
    private final AuthHelper auth;

    public RoleController(RoleRepository roleRepo, PermissionRepository permRepo, AuthHelper auth) {
        this.roleRepo = roleRepo;
        this.permRepo = permRepo;
        this.auth = auth;
    }

    @GetMapping
    public ResponseEntity<?> list() {
        auth.requirePermission("ROLES:VIEW");
        var roles = roleRepo.findAll().stream().map(this::toDto).collect(Collectors.toList());
        return ok(roles);
    }

    @GetMapping("/permissions")
    public ResponseEntity<?> listPermissions() {
        auth.requirePermission("ROLES:VIEW");
        var grouped = permRepo.findAll().stream()
            .collect(Collectors.groupingBy(Permission::getModule));
        return ok(grouped);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        auth.requirePermission("ROLES:CREATE");
        String name = (String) body.get("name");
        if (name == null || name.isBlank()) return bad("Role name is required");
        if (roleRepo.existsByName(name)) return bad("Role name already exists");

        Set<Permission> perms = new HashSet<>();
        if (body.containsKey("permission_ids")) {
            List<String> ids = (List<String>) body.get("permission_ids");
            perms.addAll(permRepo.findAllById(ids));
        }

        Role role = new Role();
        role.setName(name);
        role.setDescription((String) body.get("description"));
        role.setPermissions(perms);
        roleRepo.save(role);
        return ResponseEntity.status(201).body(Map.of("success", true, "data", toDto(role)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        auth.requirePermission("ROLES:EDIT");
        Role role = roleRepo.findById(id).orElse(null);
        if (role == null) return ResponseEntity.status(404).body(err("Role not found"));
        if (role.isSystem() && body.containsKey("name") && !role.getName().equals(body.get("name"))) return bad("Cannot rename system roles");

        if (body.containsKey("description")) role.setDescription((String) body.get("description"));
        if (!role.isSystem() && body.containsKey("name")) role.setName((String) body.get("name"));

        if (body.containsKey("permission_ids")) {
            List<String> ids = (List<String>) body.get("permission_ids");
            role.setPermissions(new HashSet<>(permRepo.findAllById(ids)));
        }
        roleRepo.save(role);
        return ok(toDto(role));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        auth.requirePermission("ROLES:DELETE");
        Role role = roleRepo.findById(id).orElse(null);
        if (role == null) return ResponseEntity.status(404).body(err("Role not found"));
        if (role.isSystem()) return bad("Cannot delete system roles");
        roleRepo.deleteById(id);
        return ok("Role deleted");
    }

    private Map<String, Object> toDto(Role r) {
        return Map.of(
            "id", r.getId(),
            "name", r.getName(),
            "description", r.getDescription() != null ? r.getDescription() : "",
            "is_system", r.isSystem(),
            "created_at", r.getCreatedAt() != null ? r.getCreatedAt() : "",
            "permissions", r.getPermissions().stream().map(p -> Map.of(
                "id", p.getId(), "name", p.getName(), "module", p.getModule(), "action", p.getAction()
            )).collect(Collectors.toList())
        );
    }

    private ResponseEntity<?> ok(Object data) { return ResponseEntity.ok(Map.of("success", true, "data", data)); }
    private ResponseEntity<?> bad(String msg) { return ResponseEntity.badRequest().body(err(msg)); }
    private Map<String, Object> err(String msg) { return Map.of("success", false, "message", msg); }
}
