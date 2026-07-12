package com.ttrims.ims.service;

import com.ttrims.ims.entity.*;
import com.ttrims.ims.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class LogisticsService {
    private static final Logger log = LoggerFactory.getLogger(LogisticsService.class);
    private static final double DEPOT_LAT = 9.9252;
    private static final double DEPOT_LNG = 78.1198;
    private static final double SERVICE_RADIUS_KM = 5.0;
    private static final int MAX_STOPS_PER_SHIPMENT = 5;

    private final ShipmentRepository shipmentRepo;
    private final ShipmentOrderRepository shipmentOrderRepo;
    private final OrderRepository orderRepo;
    private final UserRepository userRepo;
    private final RoleRepository roleRepo;
    private final AttendanceRepository attendanceRepo;

    public LogisticsService(ShipmentRepository shipmentRepo,
                            ShipmentOrderRepository shipmentOrderRepo,
                            OrderRepository orderRepo,
                            UserRepository userRepo,
                            RoleRepository roleRepo,
                            AttendanceRepository attendanceRepo) {
        this.shipmentRepo = shipmentRepo;
        this.shipmentOrderRepo = shipmentOrderRepo;
        this.orderRepo = orderRepo;
        this.userRepo = userRepo;
        this.roleRepo = roleRepo;
        this.attendanceRepo = attendanceRepo;
    }

    // ─── Auto Shipment Creation ────────────────────────────────────────────────

    /**
     * Groups ALL eligible pending orders into optimized shipments.
     * Called on demand (e.g. via /dispatch/group-all) or when a single order is dispatched.
     * Returns list of created/updated shipment numbers.
     */
    @Transactional
    public List<String> groupAllEligibleOrders() {
        log.info("Running bulk auto-grouping for all eligible pending orders");

        List<Order> eligible = orderRepo.findEligibleForGrouping();
        if (eligible.isEmpty()) {
            log.info("No eligible orders found for grouping.");
            return Collections.emptyList();
        }

        // Assign default coordinates for orders missing lat/lng
        for (Order order : eligible) {
            ensureCoordinates(order);
        }

        // Find existing CREATED auto-grouped shipments that still have capacity
        List<Shipment> openShipments = shipmentRepo.findByStatusOrderByCreatedAtDesc(Shipment.Status.CREATED)
                .stream()
                .filter(s -> Boolean.TRUE.equals(s.getAutoGrouped()))
                .collect(Collectors.toList());

        // Set of order IDs already in a shipment
        Set<String> alreadyGrouped = new HashSet<>();
        for (Shipment s : openShipments) {
            for (ShipmentOrder so : s.getShipmentOrders()) {
                alreadyGrouped.add(so.getOrder().getId());
            }
        }

        // Only process truly unassigned orders
        List<Order> unassigned = eligible.stream()
                .filter(o -> !alreadyGrouped.contains(o.getId()))
                .collect(Collectors.toList());

        Set<String> createdOrUpdated = new LinkedHashSet<>();

        for (Order order : unassigned) {
            Shipment target = findOrCreateShipment(order, openShipments);
            linkOrderToShipment(order, target);
            if (!openShipments.contains(target)) {
                openShipments.add(target);
            }
            createdOrUpdated.add(target.getShipmentNumber());
        }

        // Re-optimize routes for all touched shipments
        Set<String> touchedIds = new HashSet<>();
        for (String sNum : createdOrUpdated) {
            openShipments.stream()
                    .filter(s -> s.getShipmentNumber().equals(sNum))
                    .findFirst()
                    .ifPresent(s -> {
                        if (!touchedIds.contains(s.getId())) {
                            touchedIds.add(s.getId());
                            optimizeRoute(s);
                        }
                    });
        }

        return new ArrayList<>(createdOrUpdated);
    }

    /**
     * Handles auto-shipment for a single order after dispatch is confirmed.
     * Checks if the order is already grouped; if not, groups it.
     */
    @Transactional
    public void handleAutoShipment(Order order) {
        log.info("Starting automated shipment allocation for order: {}", order.getOrderNumber());

        // Check if already in a shipment
        Optional<ShipmentOrder> existing = shipmentOrderRepo.findByOrderId(order.getId());
        if (existing.isPresent()) {
            log.info("Order {} is already in shipment {}. Skipping.",
                    order.getOrderNumber(), existing.get().getShipment().getShipmentNumber());
            return;
        }

        ensureCoordinates(order);

        List<Shipment> activeShipments = shipmentRepo.findByStatusOrderByCreatedAtDesc(Shipment.Status.CREATED);
        Shipment targetShipment = findOrCreateShipment(order, activeShipments);
        linkOrderToShipment(order, targetShipment);
        optimizeRoute(targetShipment);
    }

    // ─── Shipment Merge / Split / Move ────────────────────────────────────────

    /**
     * Merges multiple CREATED shipments into the first one.
     * Releases old shipments and re-optimizes the merged one.
     */
    @Transactional
    public Shipment mergeShipments(List<String> shipmentIds) {
        if (shipmentIds == null || shipmentIds.size() < 2) {
            throw new IllegalArgumentException("At least 2 shipment IDs are required for a merge");
        }

        List<Shipment> shipments = shipmentIds.stream()
                .map(id -> shipmentRepo.findById(id).orElseThrow(() -> new IllegalArgumentException("Shipment not found: " + id)))
                .collect(Collectors.toList());

        for (Shipment s : shipments) {
            if (s.getStatus() != Shipment.Status.CREATED) {
                throw new IllegalStateException("Only CREATED shipments can be merged. Shipment " + s.getShipmentNumber() + " has status " + s.getStatus());
            }
        }

        Shipment primary = shipments.get(0);
        List<Shipment> secondaries = shipments.subList(1, shipments.size());

        for (Shipment secondary : secondaries) {
            // Re-link all orders from secondary to primary
            for (ShipmentOrder so : secondary.getShipmentOrders()) {
                so.setShipment(primary);
                so.setStopSequence(primary.getShipmentOrders().size() + 1);
                shipmentOrderRepo.save(so);
                primary.getShipmentOrders().add(so);
            }
            secondary.getShipmentOrders().clear();

            // Release driver of secondary if different from primary
            if (secondary.getDriver() != null &&
                    (primary.getDriver() == null || !secondary.getDriver().getId().equals(primary.getDriver().getId()))) {
                User driver = secondary.getDriver();
                driver.setDriverStatus("AVAILABLE");
                userRepo.save(driver);
            }

            shipmentRepo.delete(secondary);
            log.info("Merged shipment {} into {}", secondary.getShipmentNumber(), primary.getShipmentNumber());
        }

        optimizeRoute(primary);
        return shipmentRepo.save(primary);
    }

    /**
     * Splits specified orders out of an existing shipment into a new one.
     */
    @Transactional
    public Shipment splitShipment(String shipmentId, List<String> orderIdsToSplit) {
        Shipment original = shipmentRepo.findById(shipmentId)
                .orElseThrow(() -> new IllegalArgumentException("Shipment not found: " + shipmentId));

        if (original.getStatus() != Shipment.Status.CREATED) {
            throw new IllegalStateException("Only CREATED shipments can be split");
        }

        if (orderIdsToSplit == null || orderIdsToSplit.isEmpty()) {
            throw new IllegalArgumentException("No orders specified for split");
        }

        // Create the new shipment
        Shipment newShipment = new Shipment();
        newShipment.setShipmentNumber("SHM-" + System.currentTimeMillis());
        newShipment.setStatus(Shipment.Status.CREATED);
        newShipment.setOrigin(original.getOrigin());
        newShipment.setScheduledAt(original.getScheduledAt());
        newShipment.setCreatedBy("Admin Split");
        newShipment.setAutoGrouped(false);
        newShipment = shipmentRepo.save(newShipment);

        Set<String> splitSet = new HashSet<>(orderIdsToSplit);
        List<ShipmentOrder> toMove = original.getShipmentOrders().stream()
                .filter(so -> splitSet.contains(so.getOrder().getId()))
                .collect(Collectors.toList());

        if (toMove.isEmpty()) {
            shipmentRepo.delete(newShipment);
            throw new IllegalArgumentException("None of the specified order IDs were found in this shipment");
        }

        for (ShipmentOrder so : toMove) {
            original.getShipmentOrders().remove(so);
            so.setShipment(newShipment);
            shipmentOrderRepo.save(so);
        }
        newShipment.getShipmentOrders().addAll(toMove);

        // Auto-allocate driver for new shipment
        if (!newShipment.getShipmentOrders().isEmpty()) {
            Order firstOrder = newShipment.getShipmentOrders().get(0).getOrder();
            double lat = firstOrder.getLatitude() != null ? firstOrder.getLatitude() : DEPOT_LAT;
            double lng = firstOrder.getLongitude() != null ? firstOrder.getLongitude() : DEPOT_LNG;
            allocateDriver(newShipment, lat, lng);
        }

        optimizeRoute(original);
        optimizeRoute(newShipment);

        shipmentRepo.save(original);
        return shipmentRepo.save(newShipment);
    }

    /**
     * Moves a single order from one CREATED shipment to another.
     */
    @Transactional
    public void moveOrder(String orderId, String fromShipmentId, String toShipmentId) {
        Shipment from = shipmentRepo.findById(fromShipmentId)
                .orElseThrow(() -> new IllegalArgumentException("Source shipment not found"));
        Shipment to = shipmentRepo.findById(toShipmentId)
                .orElseThrow(() -> new IllegalArgumentException("Destination shipment not found"));

        if (to.getShipmentOrders().size() >= MAX_STOPS_PER_SHIPMENT) {
            throw new IllegalStateException("Destination shipment is full (max " + MAX_STOPS_PER_SHIPMENT + " stops)");
        }

        ShipmentOrder soToMove = from.getShipmentOrders().stream()
                .filter(so -> so.getOrder().getId().equals(orderId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Order not found in source shipment"));

        from.getShipmentOrders().remove(soToMove);
        soToMove.setShipment(to);
        soToMove.setStopSequence(to.getShipmentOrders().size() + 1);
        to.getShipmentOrders().add(soToMove);
        shipmentOrderRepo.save(soToMove);

        optimizeRoute(from);
        optimizeRoute(to);

        shipmentRepo.save(from);
        shipmentRepo.save(to);
    }

    /**
     * Adds an unassigned order to an existing CREATED shipment.
     */
    @Transactional
    public void addOrderToShipment(String orderId, String shipmentId) {
        Order order = orderRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        Shipment shipment = shipmentRepo.findById(shipmentId)
                .orElseThrow(() -> new IllegalArgumentException("Shipment not found"));

        if (shipment.getShipmentOrders().size() >= MAX_STOPS_PER_SHIPMENT) {
            throw new IllegalStateException("Shipment is full (max " + MAX_STOPS_PER_SHIPMENT + " stops)");
        }

        // Remove from any existing shipment first
        Optional<ShipmentOrder> existing = shipmentOrderRepo.findByOrderId(orderId);
        existing.ifPresent(so -> {
            so.getShipment().getShipmentOrders().remove(so);
            shipmentOrderRepo.delete(so);
        });

        ensureCoordinates(order);
        ShipmentOrder so = buildShipmentOrder(order, shipment);
        shipmentOrderRepo.save(so);
        shipment.getShipmentOrders().add(so);
        optimizeRoute(shipment);
        shipmentRepo.save(shipment);
    }

    /**
     * Removes an order from a shipment, returning it to the unassigned pool.
     */
    @Transactional
    public void removeOrderFromShipment(String orderId, String shipmentId) {
        Shipment shipment = shipmentRepo.findById(shipmentId)
                .orElseThrow(() -> new IllegalArgumentException("Shipment not found"));

        ShipmentOrder so = shipment.getShipmentOrders().stream()
                .filter(s -> s.getOrder().getId().equals(orderId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Order not found in this shipment"));

        shipment.getShipmentOrders().remove(so);
        shipmentOrderRepo.delete(so);

        optimizeRoute(shipment);
        shipmentRepo.save(shipment);
    }

    /**
     * Cancels all auto-created CREATED shipments and re-runs full clustering from scratch.
     */
    @Transactional
    public List<String> regenerateGroupings() {
        log.info("Regenerating all shipment groupings...");

        List<Shipment> autoCreated = shipmentRepo.findByStatusOrderByCreatedAtDesc(Shipment.Status.CREATED)
                .stream()
                .filter(s -> Boolean.TRUE.equals(s.getAutoGrouped()))
                .collect(Collectors.toList());

        // Release drivers
        for (Shipment s : autoCreated) {
            if (s.getDriver() != null) {
                User driver = s.getDriver();
                driver.setDriverStatus("AVAILABLE");
                userRepo.save(driver);
            }
        }

        // Delete all auto-grouped CREATED shipments (cascade deletes shipment orders)
        shipmentRepo.deleteAll(autoCreated);
        log.info("Deleted {} auto-grouped shipments for regeneration", autoCreated.size());

        // Re-group all eligible orders
        return groupAllEligibleOrders();
    }

    // ─── Route Optimization ────────────────────────────────────────────────────

    public void optimizeRoute(Shipment shipment) {
        List<ShipmentOrder> stops = shipment.getShipmentOrders();
        if (stops == null || stops.isEmpty()) return;

        log.info("Running Nearest-Neighbor route optimization for Shipment: {}", shipment.getShipmentNumber());

        List<ShipmentOrder> unvisited = new ArrayList<>(stops);
        List<ShipmentOrder> optimized = new ArrayList<>();

        double currentLat = DEPOT_LAT;
        double currentLng = DEPOT_LNG;
        double totalDistance = 0.0;
        int seq = 1;

        while (!unvisited.isEmpty()) {
            ShipmentOrder nextStop = null;
            double minDistance = Double.MAX_VALUE;

            for (ShipmentOrder so : unvisited) {
                Order order = so.getOrder();
                double orderLat = order.getLatitude() != null ? order.getLatitude() : DEPOT_LAT;
                double orderLng = order.getLongitude() != null ? order.getLongitude() : DEPOT_LNG;

                double dist = calculateDistance(currentLat, currentLng, orderLat, orderLng);
                if (dist < minDistance) {
                    minDistance = dist;
                    nextStop = so;
                }
            }

            if (nextStop != null) {
                nextStop.setStopSequence(seq++);
                shipmentOrderRepo.save(nextStop);

                optimized.add(nextStop);
                unvisited.remove(nextStop);

                Order o = nextStop.getOrder();
                currentLat = o.getLatitude() != null ? o.getLatitude() : DEPOT_LAT;
                currentLng = o.getLongitude() != null ? o.getLongitude() : DEPOT_LNG;
                totalDistance += minDistance;
            }
        }

        // Return to depot distance
        totalDistance += calculateDistance(currentLat, currentLng, DEPOT_LAT, DEPOT_LNG);

        shipment.setShipmentOrders(optimized);
        shipment.setDistanceKm(Math.round(totalDistance * 100.0) / 100.0);
        // Estimate duration: 30 km/h avg speed + 15 mins per stop
        int duration = (int) Math.round((totalDistance / 30.0) * 60.0) + (stops.size() * 15);
        shipment.setDurationMin(duration);

        // Save sequence list
        String seqString = optimized.stream()
                .map(so -> so.getOrder().getId())
                .collect(Collectors.joining(","));
        shipment.setRouteSequence(seqString);

        if (!optimized.isEmpty()) {
            shipment.setDestination(optimized.get(optimized.size() - 1).getOrder().getDeliveryAddress());
        }

        shipmentRepo.save(shipment);
        log.info("Optimized route for Shipment: {}. Distance: {} km, Duration: {} mins",
                shipment.getShipmentNumber(), shipment.getDistanceKm(), shipment.getDurationMin());
    }

    // ─── Driver Allocation ─────────────────────────────────────────────────────

    /**
     * Determines whether an attendance session counts as "present today".
     * A session is considered today if its clock-in time falls on the current calendar date
     * (server timezone). This prevents sessions from yesterday that were never closed out
     * from polluting the eligible-driver pool.
     */
    private boolean isTodaySession(Attendance session) {
        if (session.getClockInAt() == null) return false;
        LocalDate today = LocalDate.now(ZoneId.systemDefault());
        LocalDate sessionDay = session.getClockInAt().atZone(ZoneId.systemDefault()).toLocalDate();
        return today.equals(sessionDay);
    }

    /**
     * Auto-allocates an eligible driver to the given shipment.
     * Eligibility rules (strict — no unsafe fallbacks):
     *   1. Driver role + active user account.
     *   2. Has an ACTIVE attendance session clocked in today (= Present & Logged In).
     *   3. driverStatus is AVAILABLE or IDLE.
     * If no eligible driver is found the shipment is marked Unassigned so the
     * admin can use the manual override in the Dispatch console.
     */
    public void allocateDriver(Shipment shipment, double targetLat, double targetLng) {
        Role driverRole = roleRepo.findByName("Driver").orElse(null);
        if (driverRole == null) {
            log.warn("Driver role not found. Skipping auto driver allocation.");
            shipment.setDriverName("Unassigned");
            return;
        }

        // All system drivers with an active account
        List<User> allDrivers = userRepo.findAll().stream()
                .filter(u -> u.getRole() != null && u.getRole().getId().equals(driverRole.getId()) && u.isActive())
                .collect(Collectors.toList());

        // Drivers who have an ACTIVE session that started TODAY (Present + Logged In)
        List<Attendance> activeSessions = attendanceRepo.findByStatusOrderByClockInAtDesc("ACTIVE");
        Set<String> presentTodayIds = activeSessions.stream()
                .filter(this::isTodaySession)
                .map(Attendance::getUserId)
                .collect(Collectors.toSet());

        // Eligible = Present today + driverStatus AVAILABLE or IDLE
        List<User> eligibleDrivers = allDrivers.stream()
                .filter(d -> presentTodayIds.contains(d.getId()))
                .filter(d -> "AVAILABLE".equalsIgnoreCase(d.getDriverStatus())
                          || "IDLE".equalsIgnoreCase(d.getDriverStatus()))
                .collect(Collectors.toList());

        if (eligibleDrivers.isEmpty()) {
            log.warn("No eligible drivers (Present + Available) found for Shipment {}. Marking as Unassigned.",
                    shipment.getShipmentNumber());
            shipment.setDriverName("Unassigned");
            shipment.setDriver(null);
            return;
        }

        // Score each eligible driver: proximity + workload + zone bonus
        User bestDriver = null;
        double bestScore = Double.MAX_VALUE;

        for (User driver : eligibleDrivers) {
            double driverLat = driver.getCurrentLatitude() != null ? driver.getCurrentLatitude() : DEPOT_LAT;
            double driverLng = driver.getCurrentLongitude() != null ? driver.getCurrentLongitude() : DEPOT_LNG;

            double dist = calculateDistance(driverLat, driverLng, targetLat, targetLng);
            long activeShipments = shipmentRepo.countActiveShipmentsByDriver(driver.getId());

            // Zone matching bonus: reduce score by 5 km if zones match
            double zoneBonus = 0;
            if (driver.getDeliveryZone() != null && !driver.getDeliveryZone().isBlank()
                    && shipment.getDestination() != null
                    && shipment.getDestination().toLowerCase().contains(driver.getDeliveryZone().toLowerCase())) {
                zoneBonus = -5.0;
            }

            // Score = distance + 3 km penalty per active shipment + zone bonus
            double score = dist + (activeShipments * 3.0) + zoneBonus;

            if (score < bestScore) {
                bestScore = score;
                bestDriver = driver;
            }
        }

        if (bestDriver != null) {
            assignDriverToShipment(shipment, bestDriver);
            log.info("Auto-assigned driver: {} to Shipment {} (score: {:.2f})",
                    bestDriver.getName(), shipment.getShipmentNumber(), bestScore);
        } else {
            shipment.setDriverName("Unassigned");
            shipment.setDriver(null);
        }
    }

    private void assignDriverToShipment(Shipment shipment, User driver) {
        driver.setDriverStatus("BUSY");
        userRepo.save(driver);
        shipment.setDriver(driver);
        shipment.setDriverName(driver.getName());
        shipment.setDriverPhone(driver.getDeliveryZone() != null ? driver.getDeliveryZone() : "077-1234560");
        shipment.setVehicleNumber(driver.getVehicleNumber() != null ? driver.getVehicleNumber() : "WP-CAR-7788");
    }

    /**
     * Returns a list of all drivers enriched with attendance and workload data.
     * Used by the Driver Attendance Dashboard in the Admin panel.
     * Each entry contains:
     *   - driver fields (id, name, email, vehicle, zone, driverStatus)
     *   - attendanceStatus: PRESENT | ABSENT
     *   - clockInAt: ISO timestamp of today's clock-in (if present)
     *   - lastLat / lastLng: GPS coordinates from the attendance session
     *   - lastPingAt: most recent GPS ping timestamp
     *   - activeShipments: count of CREATED + IN_TRANSIT shipments
     *   - eligibleForAutoAssign: true only when PRESENT + AVAILABLE/IDLE
     */
    public List<Map<String, Object>> getEligibleDrivers() {
        Role driverRole = roleRepo.findByName("Driver").orElse(null);
        if (driverRole == null) return Collections.emptyList();

        List<User> allDrivers = userRepo.findAll().stream()
                .filter(u -> u.getRole() != null && u.getRole().getId().equals(driverRole.getId()) && u.isActive())
                .collect(Collectors.toList());

        // Build a map: userId → today's active attendance session
        List<Attendance> activeSessions = attendanceRepo.findByStatusOrderByClockInAtDesc("ACTIVE");
        Map<String, Attendance> todaySessionByDriver = activeSessions.stream()
                .filter(this::isTodaySession)
                .collect(Collectors.toMap(
                        Attendance::getUserId,
                        a -> a,
                        (a1, a2) -> a1 // keep first if duplicates
                ));

        List<Map<String, Object>> result = new ArrayList<>();
        for (User driver : allDrivers) {
            Attendance session = todaySessionByDriver.get(driver.getId());
            boolean presentToday = session != null;
            boolean eligible = presentToday
                    && ("AVAILABLE".equalsIgnoreCase(driver.getDriverStatus())
                        || "IDLE".equalsIgnoreCase(driver.getDriverStatus()));

            long activeShipmentsCount = shipmentRepo.countActiveShipmentsByDriver(driver.getId());

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id", driver.getId());
            entry.put("name", driver.getName());
            entry.put("email", driver.getEmail());
            entry.put("vehicle_number", driver.getVehicleNumber());
            entry.put("delivery_zone", driver.getDeliveryZone());
            entry.put("driver_status", driver.getDriverStatus() != null ? driver.getDriverStatus() : "AVAILABLE");
            entry.put("current_lat", driver.getCurrentLatitude());
            entry.put("current_lng", driver.getCurrentLongitude());
            entry.put("attendance_status", presentToday ? "PRESENT" : "ABSENT");
            entry.put("clock_in_at", session != null ? session.getClockInAt() : null);
            entry.put("last_lat", session != null ? session.getLastLat() : null);
            entry.put("last_lng", session != null ? session.getLastLng() : null);
            entry.put("last_ping_at", session != null ? session.getLastPingAt() : null);
            entry.put("active_shipments", activeShipmentsCount);
            entry.put("eligible_for_auto_assign", eligible);
            result.add(entry);
        }
        return result;
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    private Shipment findOrCreateShipment(Order order, List<Shipment> openShipments) {
        // Try to cluster into an existing open shipment
        for (Shipment s : openShipments) {
            if (s.getShipmentOrders().size() >= MAX_STOPS_PER_SHIPMENT) continue;

            if (!s.getShipmentOrders().isEmpty()) {
                Order firstOrder = s.getShipmentOrders().get(0).getOrder();
                if (firstOrder != null && firstOrder.getLatitude() != null) {
                    double dist = calculateDistance(order.getLatitude(), order.getLongitude(),
                            firstOrder.getLatitude(), firstOrder.getLongitude());
                    if (dist <= SERVICE_RADIUS_KM) {
                        log.info("Clustered order {} into existing Shipment {} (dist: {} km)",
                                order.getOrderNumber(), s.getShipmentNumber(), dist);
                        return s;
                    }
                }
            } else {
                // Empty shipment — can be reused
                return s;
            }
        }

        // Create a new shipment
        Shipment newShipment = new Shipment();
        newShipment.setShipmentNumber("SHM-" + System.currentTimeMillis());
        newShipment.setStatus(Shipment.Status.CREATED);
        newShipment.setOrigin("Main Warehouse Depot");
        newShipment.setDestination(order.getDeliveryAddress());
        newShipment.setScheduledAt(LocalDateTime.now().plusHours(2));
        newShipment.setCreatedBy("Automation Engine");
        newShipment.setAutoGrouped(true);
        allocateDriver(newShipment, order.getLatitude(), order.getLongitude());
        newShipment = shipmentRepo.save(newShipment);
        log.info("Created new automated Shipment {} for order {}", newShipment.getShipmentNumber(), order.getOrderNumber());
        return newShipment;
    }

    private void linkOrderToShipment(Order order, Shipment shipment) {
        // Guard: don't double-link
        boolean alreadyLinked = shipment.getShipmentOrders().stream()
                .anyMatch(so -> so.getOrder().getId().equals(order.getId()));
        if (alreadyLinked) return;

        ShipmentOrder so = buildShipmentOrder(order, shipment);
        shipmentOrderRepo.save(so);
        shipment.getShipmentOrders().add(so);
    }

    private ShipmentOrder buildShipmentOrder(Order order, Shipment shipment) {
        int orderPcs = 0;
        int orderBags = 0;
        for (OrderItem item : order.getItems()) {
            Product p = item.getProduct();
            if (p != null) {
                double qty = item.getQtyRequired() != null ? item.getQtyRequired() : 0.0;
                if ("PCS".equalsIgnoreCase(item.getUnit()) || "PACK".equalsIgnoreCase(item.getUnit()) || "PCS".equalsIgnoreCase(p.getUnit())) {
                    orderPcs += qty;
                }
                int pcsPerBag = 0;
                if (p.getPcsPerBag() != null && p.getPcsPerBag() > 0) {
                    pcsPerBag = p.getPcsPerBag();
                } else if (p.getPcsPerInnerbag() != null && p.getInnerbagsPerBag() != null) {
                    pcsPerBag = p.getPcsPerInnerbag() * p.getInnerbagsPerBag();
                }
                if (pcsPerBag > 0) {
                    orderBags += (int) Math.ceil(qty / pcsPerBag);
                }
            }
        }
        ShipmentOrder so = new ShipmentOrder();
        so.setShipment(shipment);
        so.setOrder(order);
        so.setStatus("PENDING");
        so.setDispatchBags(orderBags);
        so.setDispatchPcs(orderPcs);
        return so;
    }

    private void ensureCoordinates(Order order) {
        if (order.getLatitude() == null || order.getLongitude() == null) {
            Random rand = new Random(order.getId().hashCode());
            double latOffset = (rand.nextDouble() - 0.5) * 0.06;
            double lngOffset = (rand.nextDouble() - 0.5) * 0.06;
            order.setLatitude(DEPOT_LAT + latOffset);
            order.setLongitude(DEPOT_LNG + lngOffset);
            if (order.getDeliveryAddress() == null || order.getDeliveryAddress().isBlank()) {
                order.setDeliveryAddress("Delivery Zone " + (char) ('A' + rand.nextInt(4)));
            }
            orderRepo.save(order);
        }
    }

    private double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371;
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
