package com.ttrims.ims.controller;

import com.ttrims.ims.entity.EcomCoupon;
import com.ttrims.ims.entity.EcomOrder;
import com.ttrims.ims.entity.EcomReview;
import com.ttrims.ims.repository.EcomCouponRepository;
import com.ttrims.ims.repository.EcomOrderRepository;
import com.ttrims.ims.repository.EcomReviewRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ecom/admin")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class EcomAdminController {

    private final EcomOrderRepository ecomOrderRepo;
    private final EcomCouponRepository ecomCouponRepo;
    private final EcomReviewRepository ecomReviewRepo;

    public EcomAdminController(EcomOrderRepository ecomOrderRepo,
                               EcomCouponRepository ecomCouponRepo,
                               EcomReviewRepository ecomReviewRepo) {
        this.ecomOrderRepo = ecomOrderRepo;
        this.ecomCouponRepo = ecomCouponRepo;
        this.ecomReviewRepo = ecomReviewRepo;
    }

    // 1. Analytics & Sales KPIs
    @GetMapping("/analytics")
    public ResponseEntity<?> getAnalytics() {
        List<EcomOrder> orders = ecomOrderRepo.findAll();
        double totalSales = 0.0;
        long pendingCount = 0;

        for (EcomOrder o : orders) {
            if (o.getStatus() == EcomOrder.Status.DELIVERED) {
                totalSales += o.getGrandTotal();
            }
            if (o.getStatus() == EcomOrder.Status.PLACED || o.getStatus() == EcomOrder.Status.PROCESSING || o.getStatus() == EcomOrder.Status.SHIPPED) {
                pendingCount++;
            }
        }

        double avgOrderValue = orders.isEmpty() ? 0.0 : (totalSales / orders.size());

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalSales", totalSales);
        stats.put("ordersCount", orders.size());
        stats.put("pendingCount", pendingCount);
        stats.put("averageOrderValue", avgOrderValue);

        return ResponseEntity.ok(Map.of("success", true, "data", stats));
    }

    // 2. Orders List
    @GetMapping("/orders")
    public ResponseEntity<?> getOrders() {
        List<EcomOrder> orders = ecomOrderRepo.findAll();
        return ResponseEntity.ok(Map.of("success", true, "data", orders));
    }

    // Update Order Status
    @PatchMapping("/orders/{id}/status")
    public ResponseEntity<?> updateOrderStatus(@PathVariable String id, @RequestBody Map<String, String> body) {
        EcomOrder order = ecomOrderRepo.findById(id).orElse(null);
        if (order == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "Order not found"));
        }
        String newStatus = body.get("status");
        if (newStatus != null) {
            order.setStatus(EcomOrder.Status.valueOf(newStatus.toUpperCase()));
            ecomOrderRepo.save(order);
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Status updated successfully"));
    }

    // 3. Coupon CRUD
    @GetMapping("/coupons")
    public ResponseEntity<?> getCoupons() {
        List<EcomCoupon> coupons = ecomCouponRepo.findAll();
        return ResponseEntity.ok(Map.of("success", true, "data", coupons));
    }

    @PostMapping("/coupons")
    public ResponseEntity<?> createCoupon(@RequestBody EcomCoupon coupon) {
        EcomCoupon saved = ecomCouponRepo.save(coupon);
        return ResponseEntity.ok(Map.of("success", true, "data", saved));
    }

    @DeleteMapping("/coupons/{id}")
    public ResponseEntity<?> deleteCoupon(@PathVariable String id) {
        ecomCouponRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true, "message", "Coupon deleted"));
    }

    // 4. Review Moderation
    @GetMapping("/reviews")
    public ResponseEntity<?> getReviews() {
        List<EcomReview> reviews = ecomReviewRepo.findAll();
        return ResponseEntity.ok(Map.of("success", true, "data", reviews));
    }

    @DeleteMapping("/reviews/{id}")
    public ResponseEntity<?> deleteReview(@PathVariable String id) {
        ecomReviewRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true, "message", "Review deleted"));
    }
}
