package com.ttrims.ims.controller;

import com.ttrims.ims.entity.*;
import com.ttrims.ims.repository.*;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserRepository userRepo;
    private final RoleRepository roleRepo;
    private final AttendanceRepository attendanceRepo;
    private final PasswordEncoder passwordEncoder;
    private final AuthHelper auth;

    public UserController(UserRepository userRepo, RoleRepository roleRepo,
                          AttendanceRepository attendanceRepo,
                          PasswordEncoder passwordEncoder, AuthHelper auth) {
        this.userRepo = userRepo;
        this.roleRepo = roleRepo;
        this.attendanceRepo = attendanceRepo;
        this.passwordEncoder = passwordEncoder;
        this.auth = auth;
    }

    @GetMapping
    public ResponseEntity<?> list() {
        auth.requirePermission("USERS:VIEW");
        var users = userRepo.findAllByOrderByCreatedAtDesc().stream()
            .map(this::toDto).collect(Collectors.toList());
        return ok(users);
    }

    @GetMapping("/me")
    public ResponseEntity<?> me() {
        User user = auth.currentUser();
        var full = userRepo.findByIdAndActiveTrue(user.getId()).orElseThrow();
        return ok(toDto(full));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        auth.requirePermission("USERS:CREATE");
        String name = (String) body.get("name");
        String email = ((String) body.getOrDefault("email", "")).toLowerCase().trim();
        String password = (String) body.get("password");
        String roleId = (String) body.get("role_id");

        if (name == null || email.isEmpty() || password == null || roleId == null) {
            return bad("name, email, password and role_id are required");
        }
        if (userRepo.existsByEmail(email)) return bad("Email already exists");

        Role role = roleRepo.findById(roleId).orElse(null);
        if (role == null) return bad("Role not found");

        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(role);
        user.setWarehouseId((String) body.get("warehouse_id"));
        user.setActive(true);

        userRepo.save(user);
        return ResponseEntity.status(201).body(Map.of("success", true, "data", toDto(user)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        auth.requirePermission("USERS:EDIT");
        User user = userRepo.findById(id).orElse(null);
        if (user == null) return ResponseEntity.status(404).body(err("User not found"));

        if (body.containsKey("name")) user.setName((String) body.get("name"));
        if (body.containsKey("email")) user.setEmail(((String) body.get("email")).toLowerCase().trim());
        if (body.containsKey("password") && body.get("password") != null) {
            user.setPassword(passwordEncoder.encode((String) body.get("password")));
        }
        if (body.containsKey("role_id")) {
            Role role = roleRepo.findById((String) body.get("role_id")).orElse(null);
            if (role != null) user.setRole(role);
        }
        if (body.containsKey("is_active")) user.setActive((Boolean) body.get("is_active"));
        if (body.containsKey("warehouse_id")) user.setWarehouseId((String) body.get("warehouse_id"));
        // Driver-specific fields
        if (body.containsKey("driver_status")) user.setDriverStatus((String) body.get("driver_status"));
        if (body.containsKey("vehicle_number")) user.setVehicleNumber((String) body.get("vehicle_number"));
        if (body.containsKey("delivery_zone")) user.setDeliveryZone((String) body.get("delivery_zone"));

        userRepo.save(user);
        return ok(toDto(user));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id, @RequestParam(required = false, defaultValue = "false") boolean permanent) {
        auth.requirePermission("USERS:DELETE");
        if (auth.currentUser().getId().equals(id)) return bad("Cannot deactivate or delete your own account");
        if (permanent) {
            try {
                userRepo.deleteById(id);
                return ok("User account permanently deleted");
            } catch (Exception e) {
                return bad("Cannot permanently delete this user account because they are referenced in historical transactions, production runs, or orders. Please keep them archived instead.");
            }
        } else {
            userRepo.findById(id).ifPresent(u -> { u.setActive(false); userRepo.save(u); });
            return ok("User deactivated");
        }
    }

    /** GET /api/users/drivers/status — returns all drivers with live attendance + workload data. */
    @GetMapping("/drivers/status")
    public ResponseEntity<?> driversStatus() {
        auth.requirePermission("USERS:VIEW");
        Role driverRole = roleRepo.findByName("Driver").orElse(null);
        if (driverRole == null) return ok(Collections.emptyList());

        List<User> drivers = userRepo.findAll().stream()
                .filter(u -> u.getRole() != null && u.getRole().getId().equals(driverRole.getId()) && u.isActive())
                .collect(Collectors.toList());

        // Map userId → active attendance session
        List<Attendance> activeSessions = attendanceRepo.findByStatusOrderByClockInAtDesc("ACTIVE");
        Map<String, Attendance> sessionMap = activeSessions.stream()
                .collect(Collectors.toMap(
                        Attendance::getUserId,
                        a -> a,
                        (a1, a2) -> a1
                ));

        List<Map<String, Object>> result = drivers.stream().map(d -> {
            Map<String, Object> m = new LinkedHashMap<>(toDto(d));
            Attendance session = sessionMap.get(d.getId());
            m.put("driver_status", d.getDriverStatus() != null ? d.getDriverStatus() : "AVAILABLE");
            m.put("vehicle_number", d.getVehicleNumber());
            m.put("delivery_zone", d.getDeliveryZone());
            m.put("attendance_status", session != null ? "PRESENT" : "ABSENT");
            m.put("clock_in_at", session != null ? session.getClockInAt() : null);
            m.put("last_lat", session != null ? session.getLastLat() : null);
            m.put("last_lng", session != null ? session.getLastLng() : null);
            m.put("last_ping_at", session != null ? session.getLastPingAt() : null);
            m.put("current_lat", d.getCurrentLatitude());
            m.put("current_lng", d.getCurrentLongitude());
            return m;
        }).collect(Collectors.toList());

        return ok(result);
    }

    private Map<String, Object> toDto(User u) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", u.getId());
        m.put("name", u.getName());
        m.put("email", u.getEmail());
        m.put("is_active", u.isActive());
        m.put("created_at", u.getCreatedAt());
        m.put("updated_at", u.getUpdatedAt());
        m.put("role_id", u.getRole() != null ? u.getRole().getId() : null);
        m.put("role_name", u.getRole() != null ? u.getRole().getName() : null);
        m.put("role", u.getRole() != null ? u.getRole().getName() : null);
        m.put("warehouse_id", u.getWarehouseId());
        m.put("driver_status", u.getDriverStatus());
        m.put("vehicle_number", u.getVehicleNumber());
        m.put("delivery_zone", u.getDeliveryZone());
        if (u.getRole() != null) {
            m.put("permissions", u.getRole().getPermissions().stream().map(Permission::getName).collect(Collectors.toList()));
        }
        return m;
    }

    private ResponseEntity<?> ok(Object data) { return ResponseEntity.ok(Map.of("success", true, "data", data)); }
    private ResponseEntity<?> bad(String msg) { return ResponseEntity.badRequest().body(err(msg)); }
    private Map<String, Object> err(String msg) { return Map.of("success", false, "message", msg); }
}
