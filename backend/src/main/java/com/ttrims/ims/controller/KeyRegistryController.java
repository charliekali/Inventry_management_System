package com.ttrims.ims.controller;

import com.ttrims.ims.entity.FactoryKey;
import com.ttrims.ims.entity.KeyLog;
import com.ttrims.ims.entity.User;
import com.ttrims.ims.repository.FactoryKeyRepository;
import com.ttrims.ims.repository.KeyLogRepository;
import com.ttrims.ims.repository.UserRepository;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/key-registry")
public class KeyRegistryController {

    private final FactoryKeyRepository keyRepo;
    private final KeyLogRepository logRepo;
    private final UserRepository userRepo;
    private final AuthHelper auth;

    public KeyRegistryController(FactoryKeyRepository keyRepo,
                                 KeyLogRepository logRepo,
                                 UserRepository userRepo,
                                 AuthHelper auth) {
        this.keyRepo = keyRepo;
        this.logRepo = logRepo;
        this.userRepo = userRepo;
        this.auth = auth;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MASTER KEY CATALOGUE
    // ═══════════════════════════════════════════════════════════════════════════

    /** GET /api/key-registry/keys — list all keys */
    @GetMapping("/keys")
    public ResponseEntity<?> listKeys() {
        // Open to all authenticated users
        var list = keyRepo.findAllByOrderByNameAsc().stream()
                .map(this::keyDto).collect(Collectors.toList());
        return ok(list);
    }

    /** POST /api/key-registry/keys — add a new key */
    @PostMapping("/keys")
    public ResponseEntity<?> addKey(@RequestBody Map<String, Object> body) {
        auth.requireSuperAdmin();
        String name = (String) body.get("name");
        if (name == null || name.isBlank()) return bad("Key name is required");

        FactoryKey key = new FactoryKey();
        key.setName(name.trim());
        key.setDescription((String) body.get("description"));
        key.setKeyNumber((String) body.get("key_number"));
        key.setStatus("AVAILABLE");
        keyRepo.save(key);
        return ResponseEntity.status(201).body(Map.of("success", true, "data", keyDto(key)));
    }

    /** PATCH /api/key-registry/keys/{id} — update name/description/key_number */
    @PatchMapping("/keys/{id}")
    public ResponseEntity<?> updateKey(@PathVariable String id, @RequestBody Map<String, Object> body) {
        auth.requireSuperAdmin();
        FactoryKey key = keyRepo.findById(id).orElse(null);
        if (key == null) return ResponseEntity.status(404).body(err("Key not found"));

        if (body.containsKey("name") && body.get("name") != null)
            key.setName(((String) body.get("name")).trim());
        if (body.containsKey("description"))
            key.setDescription((String) body.get("description"));
        if (body.containsKey("key_number"))
            key.setKeyNumber((String) body.get("key_number"));

        keyRepo.save(key);
        return ok(keyDto(key));
    }

    /** DELETE /api/key-registry/keys/{id} — delete only if AVAILABLE */
    @DeleteMapping("/keys/{id}")
    public ResponseEntity<?> deleteKey(@PathVariable String id) {
        auth.requireSuperAdmin();
        FactoryKey key = keyRepo.findById(id).orElse(null);
        if (key == null) return ResponseEntity.status(404).body(err("Key not found"));
        if (!"AVAILABLE".equals(key.getStatus()))
            return bad("Cannot delete a key that is not AVAILABLE");

        keyRepo.deleteById(id);
        return ok("Key deleted");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // KEY CHECKOUT / RETURN LOGS & REQUESTS
    // ═══════════════════════════════════════════════════════════════════════════

    /** GET /api/key-registry/logs — full history (Admin only) */
    @GetMapping("/logs")
    public ResponseEntity<?> listLogs() {
        auth.requireSuperAdmin();
        var list = logRepo.findAllByOrderByTakenAtDesc().stream()
                .map(this::logDto).collect(Collectors.toList());
        return ok(list);
    }

    /** GET /api/key-registry/logs/active — currently checked-out keys */
    @GetMapping("/logs/active")
    public ResponseEntity<?> activeLogs() {
        // Open to all authenticated users so staff know who has a key
        var list = logRepo.findByReturnedAtIsNullOrderByTakenAtDesc().stream()
                .filter(l -> "CHECKED_OUT".equals(l.getStatus()) || "PENDING_RETURN".equals(l.getStatus()))
                .map(this::logDto).collect(Collectors.toList());
        return ok(list);
    }

    /** GET /api/key-registry/logs/my — user's own logs/requests */
    @GetMapping("/logs/my")
    public ResponseEntity<?> myLogs() {
        User currentUser = auth.currentUser();
        var list = logRepo.findByTakenByIdOrderByCreatedAtDesc(currentUser.getId()).stream()
                .map(this::logDto).collect(Collectors.toList());
        return ok(list);
    }

    /** GET /api/key-registry/requests/pending — admin approvals list */
    @GetMapping("/requests/pending")
    public ResponseEntity<?> pendingRequests() {
        auth.requireSuperAdmin();
        var list = logRepo.findByStatusInOrderByCreatedAtDesc(List.of("PENDING_CHECKOUT", "PENDING_RETURN")).stream()
                .map(this::logDto).collect(Collectors.toList());
        return ok(list);
    }

    /** POST /api/key-registry/logs — log checkout (Admin) or request checkout (Staff) */
    @PostMapping("/logs")
    public ResponseEntity<?> checkout(@RequestBody Map<String, Object> body) {
        User currentUser = auth.currentUser();

        String keyId = (String) body.get("key_id");
        if (keyId == null) return bad("key_id is required");

        FactoryKey factoryKey = keyRepo.findById(keyId).orElse(null);
        if (factoryKey == null) return bad("Key not found");
        if (!"AVAILABLE".equals(factoryKey.getStatus()))
            return bad("This key is not available for checkout (current status: " + factoryKey.getStatus() + ")");

        String reason = (String) body.get("reason");
        if (reason == null || reason.isBlank()) return bad("reason is required");

        KeyLog log = new KeyLog();
        log.setKeyId(keyId);
        log.setKeyName(factoryKey.getName());
        log.setKeyNumber(factoryKey.getKeyNumber());
        log.setReason(reason.trim());

        if (auth.isSuperAdmin()) {
            // Admin logs directly (bypasses queue)
            String takenByName = (String) body.get("taken_by_name");
            if (takenByName == null || takenByName.isBlank()) return bad("taken_by_name is required");

            log.setTakenByName(takenByName.trim());
            log.setTakenByEmail((String) body.get("taken_by_email"));
            log.setTakenById((String) body.get("taken_by_id"));
            log.setRecordedById(currentUser.getId());
            log.setRecordedByName(currentUser.getName());
            log.setStatus("CHECKED_OUT");

            if (body.get("taken_at") instanceof String takenAtStr && !takenAtStr.isBlank()) {
                try {
                    log.setTakenAt(LocalDateTime.parse(takenAtStr.replace("Z", "").replace("T", "T")));
                } catch (Exception e) {
                    log.setTakenAt(LocalDateTime.now());
                }
            } else {
                log.setTakenAt(LocalDateTime.now());
            }

            factoryKey.setStatus("CHECKED_OUT");
        } else {
            // Staff submits request
            log.setTakenByName(currentUser.getName());
            log.setTakenByEmail(currentUser.getEmail());
            log.setTakenById(currentUser.getId());
            log.setTakenAt(LocalDateTime.now());
            log.setStatus("PENDING_CHECKOUT");

            factoryKey.setStatus("PENDING_CHECKOUT");
        }

        logRepo.save(log);
        keyRepo.save(factoryKey);

        return ResponseEntity.status(201).body(Map.of("success", true, "data", logDto(log)));
    }

    /** PATCH /api/key-registry/logs/{id}/return — mark returned (Admin) or request return (Staff) */
    @PatchMapping("/logs/{id}/return")
    public ResponseEntity<?> returnKey(@PathVariable String id, @RequestBody Map<String, Object> body) {
        User currentUser = auth.currentUser();

        KeyLog log = logRepo.findById(id).orElse(null);
        if (log == null) return ResponseEntity.status(404).body(err("Log entry not found"));
        if ("RETURNED".equals(log.getStatus())) return bad("This key has already been returned");
        if ("PENDING_RETURN".equals(log.getStatus())) return bad("A return request is already pending approval");

        String notes = (String) body.get("return_notes");
        FactoryKey factoryKey = keyRepo.findById(log.getKeyId()).orElse(null);

        if (auth.isSuperAdmin()) {
            // Admin returns directly
            log.setReturnedAt(LocalDateTime.now());
            log.setReturnNotes(notes);
            log.setStatus("RETURNED");
            log.setRecordedById(currentUser.getId());
            log.setRecordedByName(currentUser.getName());

            if (factoryKey != null) {
                factoryKey.setStatus("AVAILABLE");
                keyRepo.save(factoryKey);
            }
        } else {
            // Staff requests return
            boolean isOwner = currentUser.getId().equals(log.getTakenById()) ||
                    currentUser.getName().equalsIgnoreCase(log.getTakenByName());
            if (!isOwner) {
                return bad("You cannot request return for a key checked out to " + log.getTakenByName());
            }

            log.setStatus("PENDING_RETURN");
            log.setReturnNotes(notes);

            if (factoryKey != null) {
                factoryKey.setStatus("PENDING_RETURN");
                keyRepo.save(factoryKey);
            }
        }

        logRepo.save(log);
        return ok(logDto(log));
    }

    /** POST /api/key-registry/requests/{id}/approve — Admin approve checkout/return */
    @PostMapping("/requests/{id}/approve")
    public ResponseEntity<?> approveRequest(@PathVariable String id) {
        auth.requireSuperAdmin();
        User admin = auth.currentUser();

        KeyLog log = logRepo.findById(id).orElse(null);
        if (log == null) return ResponseEntity.status(404).body(err("Request log not found"));

        FactoryKey factoryKey = keyRepo.findById(log.getKeyId()).orElse(null);

        if ("PENDING_CHECKOUT".equals(log.getStatus())) {
            log.setStatus("CHECKED_OUT");
            log.setRecordedById(admin.getId());
            log.setRecordedByName(admin.getName());
            log.setTakenAt(LocalDateTime.now()); // Set official start time to approval time

            if (factoryKey != null) {
                factoryKey.setStatus("CHECKED_OUT");
                keyRepo.save(factoryKey);
            }
        } else if ("PENDING_RETURN".equals(log.getStatus())) {
            log.setStatus("RETURNED");
            log.setReturnedAt(LocalDateTime.now());
            log.setRecordedById(admin.getId());
            log.setRecordedByName(admin.getName());

            if (factoryKey != null) {
                factoryKey.setStatus("AVAILABLE");
                keyRepo.save(factoryKey);
            }
        } else {
            return bad("Request log is not pending approval (status: " + log.getStatus() + ")");
        }

        logRepo.save(log);
        return ok(logDto(log));
    }

    /** POST /api/key-registry/requests/{id}/reject — Admin reject checkout/return */
    @PostMapping("/requests/{id}/reject")
    public ResponseEntity<?> rejectRequest(@PathVariable String id) {
        auth.requireSuperAdmin();
        User admin = auth.currentUser();

        KeyLog log = logRepo.findById(id).orElse(null);
        if (log == null) return ResponseEntity.status(404).body(err("Request log not found"));

        FactoryKey factoryKey = keyRepo.findById(log.getKeyId()).orElse(null);

        if ("PENDING_CHECKOUT".equals(log.getStatus())) {
            log.setStatus("REJECTED");
            log.setRecordedById(admin.getId());
            log.setRecordedByName(admin.getName());

            if (factoryKey != null) {
                factoryKey.setStatus("AVAILABLE");
                keyRepo.save(factoryKey);
            }
        } else if ("PENDING_RETURN".equals(log.getStatus())) {
            // Revert return request back to checked out status
            log.setStatus("CHECKED_OUT");
            log.setRecordedById(admin.getId());
            log.setRecordedByName(admin.getName());

            if (factoryKey != null) {
                factoryKey.setStatus("CHECKED_OUT");
                keyRepo.save(factoryKey);
            }
        } else {
            return bad("Request log is not pending approval (status: " + log.getStatus() + ")");
        }

        logRepo.save(log);
        return ok(logDto(log));
    }

    // ─── DTO helpers ──────────────────────────────────────────────────────────

    private Map<String, Object> keyDto(FactoryKey k) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", k.getId());
        m.put("name", k.getName());
        m.put("description", k.getDescription());
        m.put("key_number", k.getKeyNumber());
        m.put("status", k.getStatus());
        m.put("created_at", k.getCreatedAt());
        m.put("updated_at", k.getUpdatedAt());
        return m;
    }

    private Map<String, Object> logDto(KeyLog l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", l.getId());
        m.put("key_id", l.getKeyId());
        m.put("key_name", l.getKeyName());
        m.put("key_number", l.getKeyNumber());
        m.put("taken_by_id", l.getTakenById());
        m.put("taken_by_name", l.getTakenByName());
        m.put("taken_by_email", l.getTakenByEmail());
        m.put("reason", l.getReason());
        m.put("taken_at", l.getTakenAt());
        m.put("returned_at", l.getReturnedAt());
        m.put("return_notes", l.getReturnNotes());
        m.put("recorded_by_name", l.getRecordedByName());
        m.put("status", l.getStatus());
        m.put("created_at", l.getCreatedAt());

        // Duration in minutes
        if (l.getTakenAt() != null && !"PENDING_CHECKOUT".equals(l.getStatus()) && !"REJECTED".equals(l.getStatus())) {
            LocalDateTime end = l.getReturnedAt() != null ? l.getReturnedAt() : LocalDateTime.now();
            m.put("duration_minutes", Duration.between(l.getTakenAt(), end).toMinutes());
        }
        return m;
    }

    private ResponseEntity<?> ok(Object data) {
        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }
    private ResponseEntity<?> bad(String msg) {
        return ResponseEntity.badRequest().body(err(msg));
    }
    private Map<String, Object> err(String msg) {
        return Map.of("success", false, "message", msg);
    }
}
