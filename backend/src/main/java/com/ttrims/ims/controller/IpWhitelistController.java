package com.ttrims.ims.controller;

import com.ttrims.ims.entity.IpWhitelist;
import com.ttrims.ims.entity.User;
import com.ttrims.ims.repository.IpWhitelistRepository;
import com.ttrims.ims.repository.UserRepository;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ip-whitelist")
public class IpWhitelistController {

    private final IpWhitelistRepository ipWhitelistRepo;
    private final UserRepository userRepo;
    private final AuthHelper auth;

    public IpWhitelistController(IpWhitelistRepository ipWhitelistRepo, UserRepository userRepo, AuthHelper auth) {
        this.ipWhitelistRepo = ipWhitelistRepo;
        this.userRepo = userRepo;
        this.auth = auth;
    }

    @GetMapping
    public ResponseEntity<?> list() {
        auth.requireSuperAdmin();
        List<Map<String, Object>> result = ipWhitelistRepo.findAllByOrderByCreatedAtDesc().stream()
            .map(w -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", w.getId());
                m.put("userId", w.getUser().getId());
                m.put("userName", w.getUser().getName());
                m.put("userEmail", w.getUser().getEmail());
                m.put("ipAddress", w.getIpAddress());
                m.put("createdAt", w.getCreatedAt());
                return m;
            }).collect(Collectors.toList());
        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, String> body) {
        auth.requireSuperAdmin();
        String userId = body.get("userId");
        String ipAddress = body.get("ipAddress");

        if (userId == null || userId.trim().isEmpty() || ipAddress == null || ipAddress.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "userId and ipAddress are required"));
        }

        User user = userRepo.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "User not found"));
        }

        if (ipWhitelistRepo.existsByUserIdAndIpAddress(userId, ipAddress)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "IP is already whitelisted for this user"));
        }

        IpWhitelist whitelist = new IpWhitelist(user, ipAddress.trim());
        ipWhitelistRepo.save(whitelist);

        Map<String, Object> res = new HashMap<>();
        res.put("id", whitelist.getId());
        res.put("userId", user.getId());
        res.put("userName", user.getName());
        res.put("userEmail", user.getEmail());
        res.put("ipAddress", whitelist.getIpAddress());
        res.put("createdAt", whitelist.getCreatedAt());

        return ResponseEntity.status(201).body(Map.of("success", true, "data", res));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        auth.requireSuperAdmin();
        if (!ipWhitelistRepo.existsById(id)) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "Whitelist entry not found"));
        }
        ipWhitelistRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true, "message", "IP Whitelist entry deleted successfully"));
    }
}
