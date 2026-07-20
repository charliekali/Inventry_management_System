package com.ttrims.ims.controller;

import com.ttrims.ims.entity.Product;
import com.ttrims.ims.entity.EcomReview;
import com.ttrims.ims.repository.ProductRepository;
import com.ttrims.ims.repository.StockBalanceRepository;
import com.ttrims.ims.repository.EcomReviewRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ecom/public")
public class EcomPublicController {

    private final ProductRepository productRepo;
    private final StockBalanceRepository stockBalanceRepo;
    private final EcomReviewRepository reviewRepo;
    private final com.ttrims.ims.repository.EcomCustomerRepository customerRepo;
    private final com.ttrims.ims.repository.EcomCouponRepository couponRepo;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    private final com.ttrims.ims.repository.EcomOrderRepository ecomOrderRepo;
    private final com.ttrims.ims.repository.OrderRepository imsOrderRepo;
    private final com.ttrims.ims.repository.ShipmentOrderRepository shipmentOrderRepo;

    public EcomPublicController(ProductRepository productRepo, StockBalanceRepository stockBalanceRepo,
            EcomReviewRepository reviewRepo,
            com.ttrims.ims.repository.EcomCustomerRepository customerRepo,
            com.ttrims.ims.repository.EcomCouponRepository couponRepo,
            org.springframework.security.crypto.password.PasswordEncoder passwordEncoder,
            com.ttrims.ims.repository.EcomOrderRepository ecomOrderRepo,
            com.ttrims.ims.repository.OrderRepository imsOrderRepo,
            com.ttrims.ims.repository.ShipmentOrderRepository shipmentOrderRepo) {
        this.productRepo = productRepo;
        this.stockBalanceRepo = stockBalanceRepo;
        this.reviewRepo = reviewRepo;
        this.customerRepo = customerRepo;
        this.couponRepo = couponRepo;
        this.passwordEncoder = passwordEncoder;
        this.ecomOrderRepo = ecomOrderRepo;
        this.imsOrderRepo = imsOrderRepo;
        this.shipmentOrderRepo = shipmentOrderRepo;
    }

    @GetMapping("/products")
    public ResponseEntity<?> listProducts(@RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) Boolean todaysDeal,
            @RequestParam(required = false) Boolean isFeatured,
            @RequestParam(required = false) String sortBy) {
        List<Product> products = productRepo.findByActiveTrueOrderByTypeAscNameAsc();

        // Filter finished goods only for e-commerce and visible on storefront
        List<Map<String, Object>> filtered = products.stream()
                .filter(p -> p.getType() == Product.Type.FINISHED_GOOD)
                .filter(p -> Boolean.TRUE.equals(p.getShowOnStorefront()))
                .filter(p -> {
                    if (search != null && !search.isBlank()) {
                        String s = search.toLowerCase();
                        return p.getName().toLowerCase().contains(s) || p.getCode().toLowerCase().contains(s);
                    }
                    return true;
                })
                .filter(p -> {
                    if (category != null && !category.isBlank()) {
                        return category.equalsIgnoreCase(p.getCategory());
                    }
                    return true;
                })
                .filter(p -> {
                    if (brand != null && !brand.isBlank()) {
                        return brand.equalsIgnoreCase(p.getBrand());
                    }
                    return true;
                })
                .filter(p -> {
                    if (todaysDeal != null) {
                        return todaysDeal.equals(p.getTodaysDeal());
                    }
                    return true;
                })
                .filter(p -> {
                    if (isFeatured != null) {
                        return isFeatured.equals(p.getIsFeatured());
                    }
                    return true;
                })
                .map(this::toProductMap)
                .collect(Collectors.toList());

        // Sorting
        if ("newest".equalsIgnoreCase(sortBy)) {
            filtered.sort((a, b) -> ((String) b.get("created_at")).compareTo((String) a.get("created_at")));
        } else if ("price_asc".equalsIgnoreCase(sortBy)) {
            filtered.sort((a, b) -> Double.compare((Double) a.get("price"), (Double) b.get("price")));
        } else if ("price_desc".equalsIgnoreCase(sortBy)) {
            filtered.sort((a, b) -> Double.compare((Double) b.get("price"), (Double) a.get("price")));
        }

        return ResponseEntity.ok(Map.of("success", true, "data", filtered));
    }

    @GetMapping("/products/{id}")
    public ResponseEntity<?> getProduct(@PathVariable String id) {
        Product p = productRepo.findById(id).orElse(null);
        if (p == null || !p.isActive() || !Boolean.TRUE.equals(p.getShowOnStorefront())) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "Product not found"));
        }
        Map<String, Object> data = toProductMap(p);
        // Fetch reviews
        List<EcomReview> reviews = reviewRepo.findByProductIdOrderByCreatedAtDesc(id);
        data.put("reviews", reviews);

        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }

    @GetMapping("/categories")
    public ResponseEntity<?> listCategories() {
        List<String> categories = productRepo.findByActiveTrueOrderByTypeAscNameAsc().stream()
                .filter(p -> p.getType() == Product.Type.FINISHED_GOOD && Boolean.TRUE.equals(p.getShowOnStorefront()))
                .map(Product::getCategory)
                .filter(c -> c != null && !c.isBlank())
                .distinct()
                .collect(Collectors.toList());
        return ResponseEntity.ok(Map.of("success", true, "data", categories));
    }

    @GetMapping("/products/{id}/reviews")
    public ResponseEntity<?> getReviews(@PathVariable String id) {
        return ResponseEntity.ok(Map.of("success", true, "data", reviewRepo.findByProductIdOrderByCreatedAtDesc(id)));
    }

    @PostMapping("/seed")
    public ResponseEntity<?> seedTestData() {
        // 1. Seed Customer
        com.ttrims.ims.entity.EcomCustomer customer = customerRepo.findByEmail("customer@ttrims.com").orElse(null);
        if (customer == null) {
            customer = new com.ttrims.ims.entity.EcomCustomer();
            customer.setName("John Retailer");
            customer.setEmail("customer@ttrims.com");
            customer.setPassword(passwordEncoder.encode("password123"));
            customer.setPhone("+91 98765 43210");
            customer.setAddresses("123 Spice Market, Bangalore, Karnataka - 560001");
            customerRepo.save(customer);
        }

        // 2. Seed Coupons
        if (couponRepo.findByCodeAndActiveTrue("WELCOME10").isEmpty()) {
            com.ttrims.ims.entity.EcomCoupon coupon = new com.ttrims.ims.entity.EcomCoupon();
            coupon.setCode("WELCOME10");
            coupon.setDiscountType("PERCENTAGE");
            coupon.setDiscountValue(10.0);
            coupon.setMinOrderAmount(100.0);
            coupon.setMaxDiscountAmount(500.0);
            coupon.setActive(true);
            couponRepo.save(coupon);
        }
        if (couponRepo.findByCodeAndActiveTrue("SPICE50").isEmpty()) {
            com.ttrims.ims.entity.EcomCoupon coupon = new com.ttrims.ims.entity.EcomCoupon();
            coupon.setCode("SPICE50");
            coupon.setDiscountType("FLAT");
            coupon.setDiscountValue(50.0);
            coupon.setMinOrderAmount(300.0);
            coupon.setActive(true);
            couponRepo.save(coupon);
        }

        // 3. Update active products of type FINISHED_GOOD with e-commerce metadata
        List<Product> products = productRepo.findByActiveTrueOrderByTypeAscNameAsc();
        String[] spicesImages = {
                "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=400",
                "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=400",
                "https://images.unsplash.com/photo-1532336414038-cf19250c5757?auto=format&fit=crop&q=80&w=400",
                "https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&q=80&w=400"
        };
        int imgIndex = 0;
        for (Product p : products) {
            if (p.getType() == Product.Type.FINISHED_GOOD) {
                p.setBrand("TTRIMS Organic");
                p.setDescription(
                        "Premium quality spices, freshly ground and sealed under high standards to preserve flavor and aroma.");
                p.setImageUrl(spicesImages[imgIndex % spicesImages.length]);
                p.setWeight(250.0);
                p.setGstPercent(18.0);
                p.setDiscountPrice((p.getSellingPrice() != null ? p.getSellingPrice() : 150.0) * 0.9);
                p.setIsFeatured(true);
                productRepo.save(p);
                imgIndex++;
            }
        }

        return ResponseEntity.ok(Map.of("success", true, "message",
                "Test customer, coupons, and e-commerce product metadata successfully seeded!"));
    }

    @GetMapping("/orders/track/{orderNumber}")
    public ResponseEntity<?> trackOrder(@PathVariable String orderNumber) {
        com.ttrims.ims.entity.EcomOrder ecomOrder = ecomOrderRepo.findByOrderNumber(orderNumber).orElse(null);
        if (ecomOrder == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "Order not found"));
        }

        // Query the corresponding IMS Order
        com.ttrims.ims.entity.Order imsOrder = imsOrderRepo.findByInvoiceNumber(orderNumber).orElse(null);
        String resolvedStatus = "PLACED";

        if (imsOrder != null) {
            if (imsOrder.getStatus() == com.ttrims.ims.entity.Order.Status.CANCELLED) {
                resolvedStatus = "CANCELLED";
            } else {
                // Check if a shipment is assigned to this order
                var shipmentOrderOpt = shipmentOrderRepo.findByOrderId(imsOrder.getId());
                if (shipmentOrderOpt.isPresent()) {
                    com.ttrims.ims.entity.Shipment shipment = shipmentOrderOpt.get().getShipment();
                    if (shipment != null) {
                        if (shipment.getStatus() == com.ttrims.ims.entity.Shipment.Status.DELIVERED) {
                            resolvedStatus = "DELIVERED";
                        } else if (shipment.getStatus() == com.ttrims.ims.entity.Shipment.Status.EN_ROUTE ||
                                shipment.getStatus() == com.ttrims.ims.entity.Shipment.Status.PICKED_UP) {
                            resolvedStatus = "SHIPPED";
                        } else {
                            resolvedStatus = "PROCESSING";
                        }
                    }
                } else {
                    if (imsOrder.getStatus() == com.ttrims.ims.entity.Order.Status.FULFILLED) {
                        resolvedStatus = "PROCESSING";
                    } else if (imsOrder.getStatus() == com.ttrims.ims.entity.Order.Status.FEASIBLE ||
                            imsOrder.getStatus() == com.ttrims.ims.entity.Order.Status.PARTIAL) {
                        resolvedStatus = "CONFIRMED";
                    } else if ("DISPATCHED".equalsIgnoreCase(imsOrder.getDispatchStatus())) {
                        resolvedStatus = "SHIPPED";
                    }
                }
            }
        }

        Map<String, Object> data = new HashMap<>();
        data.put("orderNumber", ecomOrder.getOrderNumber());
        data.put("status", resolvedStatus);
        data.put("deliveryAddress", ecomOrder.getDeliveryAddress());
        data.put("grandTotal", ecomOrder.getGrandTotal());
        data.put("createdAt", ecomOrder.getCreatedAt() != null ? ecomOrder.getCreatedAt().toString() : "");

        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }

    private Map<String, Object> toProductMap(Product p) {
        Double stock = stockBalanceRepo.sumByProductId(p.getId());
        if (stock == null)
            stock = 0.0;

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", p.getId());
        map.put("code", p.getCode());
        map.put("name", p.getName());
        map.put("category", p.getCategory() != null ? p.getCategory() : "");
        map.put("description", p.getDescription() != null ? p.getDescription() : "");
        map.put("brand", p.getBrand() != null ? p.getBrand() : "Generic");
        map.put("image_url", p.getImageUrl() != null ? p.getImageUrl() : "");
        map.put("price", p.getSellingPrice() != null ? p.getSellingPrice() : 0.0);
        map.put("discount_price", p.getDiscountPrice());
        map.put("wholesale_price", p.getWholesalePrice());
        map.put("gst_percent", p.getGstPercent());
        map.put("min_order_qty", p.getMinOrderQty());
        map.put("max_order_qty", p.getMaxOrderQty());
        map.put("specifications", p.getSpecifications());
        map.put("stock", stock);
        map.put("tags", p.getTags() != null ? p.getTags() : "");
        map.put("todays_deal", Boolean.TRUE.equals(p.getTodaysDeal()));
        map.put("is_featured", Boolean.TRUE.equals(p.getIsFeatured()));
        map.put("created_at", p.getCreatedAt() != null ? p.getCreatedAt().toString() : "");
        return map;
    }
}
