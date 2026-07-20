package com.ttrims.ims.controller;

import com.ttrims.ims.entity.EcomCustomer;
import com.ttrims.ims.repository.EcomCustomerRepository;
import com.ttrims.ims.security.JwtUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/ecom/auth")
public class EcomAuthController {

    private final EcomCustomerRepository customerRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;

    public EcomAuthController(EcomCustomerRepository customerRepo, PasswordEncoder passwordEncoder, JwtUtils jwtUtils) {
        this.customerRepo = customerRepo;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtils = jwtUtils;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "").trim();
        String email = body.getOrDefault("email", "").toLowerCase().trim();
        String password = body.getOrDefault("password", "");
        String phone = body.getOrDefault("phone", "").trim();

        if (name.isEmpty() || email.isEmpty() || password.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Name, email, and password are required"));
        }

        if (customerRepo.findByEmail(email).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Email already registered"));
        }

        EcomCustomer customer = new EcomCustomer();
        customer.setName(name);
        customer.setEmail(email);
        customer.setPassword(passwordEncoder.encode(password));
        customer.setPhone(phone);
        customerRepo.save(customer);

        String token = jwtUtils.generateAccessToken(customer.getId(), false);
        return ResponseEntity.ok(Map.of("success", true, "token", token, "customer", toCustomerMap(customer)));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "").toLowerCase().trim();
        String password = body.getOrDefault("password", "");

        if (email.isEmpty() || password.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Email and password are required"));
        }

        EcomCustomer customer = customerRepo.findByEmail(email).orElse(null);
        if (customer == null || !passwordEncoder.matches(password, customer.getPassword())) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "Invalid email or password"));
        }

        String token = jwtUtils.generateAccessToken(customer.getId(), false);
        return ResponseEntity.ok(Map.of("success", true, "token", token, "customer", toCustomerMap(customer)));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader.substring(7);
        String customerId = jwtUtils.getUserIdFromToken(token);
        EcomCustomer customer = customerRepo.findById(customerId).orElse(null);
        if (customer == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "Customer not found"));
        }
        return ResponseEntity.ok(Map.of("success", true, "customer", toCustomerMap(customer)));
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(@RequestHeader("Authorization") String authHeader, @RequestBody Map<String, String> body) {
        String token = authHeader.substring(7);
        String customerId = jwtUtils.getUserIdFromToken(token);
        EcomCustomer customer = customerRepo.findById(customerId).orElse(null);
        if (customer == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "Customer not found"));
        }

        if (body.containsKey("name")) customer.setName(body.get("name"));
        if (body.containsKey("phone")) customer.setPhone(body.get("phone"));
        if (body.containsKey("addresses")) customer.setAddresses(body.get("addresses"));
        if (body.containsKey("password") && !body.get("password").isBlank()) {
            customer.setPassword(passwordEncoder.encode(body.get("password")));
        }

        customerRepo.save(customer);
        return ResponseEntity.ok(Map.of("success", true, "customer", toCustomerMap(customer)));
    }

    private Map<String, Object> toCustomerMap(EcomCustomer customer) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", customer.getId());
        map.put("name", customer.getName());
        map.put("email", customer.getEmail());
        map.put("phone", customer.getPhone());
        map.put("addresses", customer.getAddresses());
        return map;
    }
}
