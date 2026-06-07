package com.ttrims.ims.controller;

import com.ttrims.ims.entity.User;
import com.ttrims.ims.repository.UserRepository;
import com.ttrims.ims.security.JwtUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;

    public AuthController(UserRepository userRepo, PasswordEncoder passwordEncoder, JwtUtils jwtUtils) {
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtils = jwtUtils;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "").toLowerCase().trim();
        String password = body.getOrDefault("password", "");

        if (email.isEmpty() || password.isEmpty()) {
            return ResponseEntity.badRequest().body(error("Email and password are required"));
        }

        User user = userRepo.findByEmailAndActiveTrue(email)
            .orElse(null);

        if (user == null || !passwordEncoder.matches(password, user.getPassword())) {
            return ResponseEntity.status(401).body(error("Invalid credentials"));
        }

        String accessToken = jwtUtils.generateAccessToken(user.getId());
        String refreshToken = jwtUtils.generateRefreshToken(user.getId());

        var permissions = user.getRole() != null
            ? user.getRole().getPermissions().stream().map(p -> p.getName()).collect(Collectors.toList())
            : java.util.List.of();

        Map<String, Object> userData = new HashMap<>();
        userData.put("id", user.getId());
        userData.put("name", user.getName());
        userData.put("email", user.getEmail());
        userData.put("role", user.getRole() != null ? user.getRole().getName() : null);
        userData.put("role_id", user.getRole() != null ? user.getRole().getId() : null);
        userData.put("permissions", permissions);

        Map<String, Object> data = new HashMap<>();
        data.put("accessToken", accessToken);
        data.put("refreshToken", refreshToken);
        data.put("user", userData);

        return ResponseEntity.ok(success(data));
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody Map<String, String> body) {
        String refreshToken = body.getOrDefault("refreshToken", "");
        if (refreshToken.isEmpty() || !jwtUtils.validateToken(refreshToken)) {
            return ResponseEntity.status(401).body(error("Invalid or expired refresh token"));
        }
        String userId = jwtUtils.getUserIdFromToken(refreshToken);
        User user = userRepo.findByIdAndActiveTrue(userId).orElse(null);
        if (user == null) return ResponseEntity.status(401).body(error("User not found"));

        Map<String, String> data = new HashMap<>();
        data.put("accessToken", jwtUtils.generateAccessToken(userId));
        data.put("refreshToken", jwtUtils.generateRefreshToken(userId));
        return ResponseEntity.ok(success(data));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        return ResponseEntity.ok(Map.of("success", true, "message", "Logged out successfully"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(org.springframework.security.core.Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body(error("Not authenticated"));
        User user = (User) auth.getPrincipal();
        var full = userRepo.findByIdAndActiveTrue(user.getId()).orElse(null);
        if (full == null) return ResponseEntity.status(404).body(error("User not found"));

        var permissions = full.getRole() != null
            ? full.getRole().getPermissions().stream().map(p -> p.getName()).collect(Collectors.toList())
            : java.util.List.of();

        Map<String, Object> userData = new HashMap<>();
        userData.put("id", full.getId());
        userData.put("name", full.getName());
        userData.put("email", full.getEmail());
        userData.put("role", full.getRole() != null ? full.getRole().getName() : null);
        userData.put("role_id", full.getRole() != null ? full.getRole().getId() : null);
        userData.put("permissions", permissions);
        return ResponseEntity.ok(success(userData));
    }

    private Map<String, Object> success(Object data) {
        return Map.of("success", true, "data", data);
    }
    private Map<String, Object> error(String msg) {
        return Map.of("success", false, "message", msg);
    }
}
