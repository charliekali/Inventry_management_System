package com.ttrims.ims.controller;

import com.ttrims.ims.entity.EcomCart;
import com.ttrims.ims.entity.EcomCoupon;
import com.ttrims.ims.repository.EcomCartRepository;
import com.ttrims.ims.repository.EcomCouponRepository;
import com.ttrims.ims.security.JwtUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/ecom/cart")
public class EcomCartController {

    private final EcomCartRepository cartRepo;
    private final EcomCouponRepository couponRepo;
    private final JwtUtils jwtUtils;

    public EcomCartController(EcomCartRepository cartRepo, EcomCouponRepository couponRepo, JwtUtils jwtUtils) {
        this.cartRepo = cartRepo;
        this.couponRepo = couponRepo;
        this.jwtUtils = jwtUtils;
    }

    private String getCustomerId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        return jwtUtils.getUserIdFromToken(authHeader.substring(7));
    }

    @GetMapping
    public ResponseEntity<?> getCart(@RequestHeader("Authorization") String authHeader) {
        String customerId = getCustomerId(authHeader);
        EcomCart cart = cartRepo.findByCustomerId(customerId)
            .orElseGet(() -> {
                EcomCart newCart = new EcomCart();
                newCart.setCustomerId(customerId);
                newCart.setItems("[]");
                return cartRepo.save(newCart);
            });
        return ResponseEntity.ok(Map.of("success", true, "data", cart.getItems()));
    }

    @PostMapping("/add")
    public ResponseEntity<?> addToCart(@RequestHeader("Authorization") String authHeader, @RequestBody Map<String, Object> body) {
        String customerId = getCustomerId(authHeader);
        String itemsJson = body.getOrDefault("items", "[]").toString();

        EcomCart cart = cartRepo.findByCustomerId(customerId)
            .orElse(new EcomCart());
        cart.setCustomerId(customerId);
        cart.setItems(itemsJson);
        cartRepo.save(cart);

        return ResponseEntity.ok(Map.of("success", true, "message", "Cart updated successfully"));
    }

    @PostMapping("/apply-coupon")
    public ResponseEntity<?> applyCoupon(@RequestBody Map<String, String> body) {
        String code = body.getOrDefault("code", "").trim();
        EcomCoupon coupon = couponRepo.findByCodeAndActiveTrue(code).orElse(null);

        if (coupon == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid or expired coupon code"));
        }

        LocalDateTime now = LocalDateTime.now();
        if (coupon.getValidFrom() != null && now.isBefore(coupon.getValidFrom())) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Coupon is not yet active"));
        }
        if (coupon.getValidTo() != null && now.isAfter(coupon.getValidTo())) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Coupon has expired"));
        }

        Map<String, Object> data = new HashMap<>();
        data.put("code", coupon.getCode());
        data.put("discount_type", coupon.getDiscountType());
        data.put("discount_value", coupon.getDiscountValue());
        data.put("min_order_amount", coupon.getMinOrderAmount());
        data.put("max_discount_amount", coupon.getMaxDiscountAmount());

        return ResponseEntity.ok(Map.of("success", true, "coupon", data));
    }
}
