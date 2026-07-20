package com.ttrims.ims.controller;

import com.ttrims.ims.entity.EcomWishlist;
import com.ttrims.ims.entity.Product;
import com.ttrims.ims.repository.EcomWishlistRepository;
import com.ttrims.ims.repository.ProductRepository;
import com.ttrims.ims.security.JwtUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/ecom/wishlist")
public class EcomWishlistController {

    private final EcomWishlistRepository wishlistRepo;
    private final ProductRepository productRepo;
    private final JwtUtils jwtUtils;

    public EcomWishlistController(EcomWishlistRepository wishlistRepo, ProductRepository productRepo, JwtUtils jwtUtils) {
        this.wishlistRepo = wishlistRepo;
        this.productRepo = productRepo;
        this.jwtUtils = jwtUtils;
    }

    private String getCustomerId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        return jwtUtils.getUserIdFromToken(authHeader.substring(7));
    }

    @GetMapping
    public ResponseEntity<?> getWishlist(@RequestHeader("Authorization") String authHeader) {
        String customerId = getCustomerId(authHeader);
        List<EcomWishlist> items = wishlistRepo.findByCustomerId(customerId);
        return ResponseEntity.ok(Map.of("success", true, "data", items));
    }

    @PostMapping("/{productId}")
    public ResponseEntity<?> addToWishlist(@RequestHeader("Authorization") String authHeader, @PathVariable String productId) {
        String customerId = getCustomerId(authHeader);
        Optional<EcomWishlist> existing = wishlistRepo.findByCustomerIdAndProductId(customerId, productId);
        if (existing.isPresent()) {
            return ResponseEntity.ok(Map.of("success", true, "message", "Product already in wishlist"));
        }

        Product p = productRepo.findById(productId).orElse(null);
        if (p == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "Product not found"));
        }

        EcomWishlist wish = new EcomWishlist();
        wish.setCustomerId(customerId);
        wish.setProduct(p);
        wishlistRepo.save(wish);

        return ResponseEntity.ok(Map.of("success", true, "message", "Product added to wishlist"));
    }

    @DeleteMapping("/{productId}")
    public ResponseEntity<?> removeFromWishlist(@RequestHeader("Authorization") String authHeader, @PathVariable String productId) {
        String customerId = getCustomerId(authHeader);
        Optional<EcomWishlist> item = wishlistRepo.findByCustomerIdAndProductId(customerId, productId);
        if (item.isPresent()) {
            wishlistRepo.delete(item.get());
            return ResponseEntity.ok(Map.of("success", true, "message", "Product removed from wishlist"));
        }
        return ResponseEntity.status(404).body(Map.of("success", false, "message", "Product not in wishlist"));
    }
}
