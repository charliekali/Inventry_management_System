package com.ttrims.ims.service;

import com.ttrims.ims.entity.*;
import com.ttrims.ims.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class LogisticsService {
    private static final Logger log = LoggerFactory.getLogger(LogisticsService.class);
    private static final double DEPOT_LAT = 6.9271;
    private static final double DEPOT_LNG = 79.8612;
    private static final double SERVICE_RADIUS_KM = 5.0;
    private static final int MAX_STOPS_PER_SHIPMENT = 5;

    private final ShipmentRepository shipmentRepo;
    private final ShipmentOrderRepository shipmentOrderRepo;
    private final OrderRepository orderRepo;
    private final UserRepository userRepo;
    private final RoleRepository roleRepo;

    public LogisticsService(ShipmentRepository shipmentRepo,
                            ShipmentOrderRepository shipmentOrderRepo,
                            OrderRepository orderRepo,
                            UserRepository userRepo,
                            RoleRepository roleRepo) {
        this.shipmentRepo = shipmentRepo;
        this.shipmentOrderRepo = shipmentOrderRepo;
        this.orderRepo = orderRepo;
        this.userRepo = userRepo;
        this.roleRepo = roleRepo;
    }

    @Transactional
    public void handleAutoShipment(Order order) {
        log.info("Starting automated shipment allocation for order: {}", order.getOrderNumber());

        // 1. Ensure order has coordinates for clustering (default to Colombo offset if null)
        if (order.getLatitude() == null || order.getLongitude() == null) {
            Random rand = new Random(order.getId().hashCode());
            // Random offset within ~5km of depot
            double latOffset = (rand.nextDouble() - 0.5) * 0.06;
            double lngOffset = (rand.nextDouble() - 0.5) * 0.06;
            order.setLatitude(DEPOT_LAT + latOffset);
            order.setLongitude(DEPOT_LNG + lngOffset);
            if (order.getDeliveryAddress() == null || order.getDeliveryAddress().isBlank()) {
                order.setDeliveryAddress("Colombo Delivery Zone " + (char)('A' + rand.nextInt(4)));
            }
            orderRepo.save(order);
        }

        // 2. Find eligible active shipments (status = CREATED, same day)
        List<Shipment> activeShipments = shipmentRepo.findByStatusOrderByCreatedAtDesc(Shipment.Status.CREATED);
        Shipment targetShipment = null;

        for (Shipment s : activeShipments) {
            if (s.getShipmentOrders().size() >= MAX_STOPS_PER_SHIPMENT) {
                continue; // Skip full shipments
            }

            // Get first stop location to check proximity
            if (!s.getShipmentOrders().isEmpty()) {
                Order firstOrder = s.getShipmentOrders().get(0).getOrder();
                if (firstOrder != null && firstOrder.getLatitude() != null) {
                    double dist = calculateDistance(order.getLatitude(), order.getLongitude(),
                            firstOrder.getLatitude(), firstOrder.getLongitude());
                    if (dist <= SERVICE_RADIUS_KM) {
                        targetShipment = s;
                        log.info("Clustered order {} into existing Shipment {} (Distance: {} km)", 
                                order.getOrderNumber(), s.getShipmentNumber(), dist);
                        break;
                    }
                }
            }
        }

        // 3. Create new shipment if no matching cluster found
        if (targetShipment == null) {
            targetShipment = new Shipment();
            targetShipment.setShipmentNumber("SHM-" + System.currentTimeMillis());
            targetShipment.setStatus(Shipment.Status.CREATED);
            targetShipment.setOrigin("Main Warehouse Depot");
            targetShipment.setDestination(order.getDeliveryAddress());
            targetShipment.setScheduledAt(LocalDateTime.now().plusHours(2));
            targetShipment.setCreatedBy("Automation Engine");

            // Auto allocate driver
            allocateDriver(targetShipment, order.getLatitude(), order.getLongitude());
            targetShipment = shipmentRepo.save(targetShipment);
            log.info("Created new automated Shipment {} for order {}", 
                    targetShipment.getShipmentNumber(), order.getOrderNumber());
        }

        // 4. Link order to shipment
        ShipmentOrder so = new ShipmentOrder();
        so.setShipment(targetShipment);
        so.setOrder(order);
        so.setStatus("PENDING");

        // Calculate dispatch bags/pcs
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
        so.setDispatchBags(orderBags);
        so.setDispatchPcs(orderPcs);
        shipmentOrderRepo.save(so);

        // Fetch targetShipment again to refresh association
        if (targetShipment.getShipmentOrders() == null) {
            targetShipment.setShipmentOrders(new ArrayList<>());
        }
        targetShipment.getShipmentOrders().add(so);

        // 5. Run route optimization
        optimizeRoute(targetShipment);
    }

    private void allocateDriver(Shipment shipment, double targetLat, double targetLng) {
        Role driverRole = roleRepo.findByName("Driver").orElse(null);
        if (driverRole == null) {
            log.warn("Driver role not found. Skipping auto driver allocation.");
            shipment.setDriverName("Unassigned");
            return;
        }

        // Query all drivers
        List<User> allDrivers = userRepo.findAll().stream()
                .filter(u -> u.getRole() != null && u.getRole().getId().equals(driverRole.getId()) && u.isActive())
                .collect(Collectors.toList());

        // Filter available drivers (status = AVAILABLE or IDLE)
        List<User> availableDrivers = allDrivers.stream()
                .filter(d -> "AVAILABLE".equalsIgnoreCase(d.getDriverStatus()) || "IDLE".equalsIgnoreCase(d.getDriverStatus()) || d.getDriverStatus() == null)
                .collect(Collectors.toList());

        if (availableDrivers.isEmpty()) {
            log.warn("No available drivers found. Assigning fallback driver.");
            if (!allDrivers.isEmpty()) {
                User fallback = allDrivers.get(0);
                shipment.setDriver(fallback);
                shipment.setDriverName(fallback.getName());
                shipment.setDriverPhone("077-1234560");
                shipment.setVehicleNumber(fallback.getVehicleNumber());
            } else {
                shipment.setDriverName("Unassigned");
            }
            return;
        }

        // Proximity check: Nearest available driver
        User bestDriver = null;
        double minDistance = Double.MAX_VALUE;

        for (User driver : availableDrivers) {
            double driverLat = driver.getCurrentLatitude() != null ? driver.getCurrentLatitude() : DEPOT_LAT;
            double driverLng = driver.getCurrentLongitude() != null ? driver.getCurrentLongitude() : DEPOT_LNG;

            double dist = calculateDistance(driverLat, driverLng, targetLat, targetLng);
            if (dist < minDistance) {
                minDistance = dist;
                bestDriver = driver;
            }
        }

        if (bestDriver != null) {
            bestDriver.setDriverStatus("BUSY");
            userRepo.save(bestDriver);

            shipment.setDriver(bestDriver);
            shipment.setDriverName(bestDriver.getName());
            shipment.setDriverPhone("077-123456" + bestDriver.getName().length());
            shipment.setVehicleNumber(bestDriver.getVehicleNumber() != null ? bestDriver.getVehicleNumber() : "WP-CAR-7788");
            log.info("Auto-assigned driver: {} (Vehicle: {}) to Shipment (Distance: {} km)", 
                    bestDriver.getName(), shipment.getVehicleNumber(), minDistance);
        }
    }

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

    private double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371; // Earth radius in km
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
