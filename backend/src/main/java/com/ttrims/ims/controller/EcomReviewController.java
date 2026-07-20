package com.ttrims.ims.controller;

import com.ttrims.ims.entity.EcomReview;
import com.ttrims.ims.entity.EcomCustomer;
import com.ttrims.ims.repository.EcomReviewRepository;
import com.ttrims.ims.repository.EcomCustomerRepository;
import com.ttrims.ims.security.JwtUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/ecom/reviews")
public class EcomReviewController {

    private final EcomReviewRepository reviewRepo;
    private final EcomCustomerRepository customerRepo;
    private final JwtUtils jwtUtils;

    public EcomReviewController(EcomReviewRepository reviewRepo, EcomCustomerRepository customerRepo, JwtUtils jwtUtils) {
        this.reviewRepo = reviewRepo;
        this.customerRepo = customerRepo;
        this.jwtUtils = jwtUtils;
    }

    private String getCustomerId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        return jwtUtils.getUserIdFromToken(authHeader.substring(7));
    }

    @PostMapping
    public ResponseEntity<?> submitReview(@RequestHeader("Authorization") String authHeader, @RequestBody Map<String, Object> body) {
        String customerId = getCustomerId(authHeader);
        EcomCustomer customer = customerRepo.findById(customerId).orElse(null);
        if (customer == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "Customer profile not found"));
        }

        String productId = (String) body.get("product_id");
        Integer rating = body.get("rating") != null ? ((Number) body.get("rating")).intValue() : 5;
        String title = (String) body.get("title");
        String comment = (String) body.get("comment");

        if (productId == null || productId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Product ID is required"));
        }

        EcomReview review = new EcomReview();
        review.setProductId(productId);
        wishlist_support: {
            review.setCustomerId(customerId);
            review.setCustomerName(customer.getName());
            review.setRating(rating);
            review.setTitle(title);
            review.setComment(comment);
        }
        reviewRepo.save(review);

        return ResponseEntity.ok(Map.of("success", true, "message", "Review submitted successfully", "data", review));
    }
}
