package com.ttrims.ims.controller;

import com.ttrims.ims.entity.PickupLocation;
import com.ttrims.ims.entity.PickupTask;
import com.ttrims.ims.entity.User;
import com.ttrims.ims.repository.PickupLocationRepository;
import com.ttrims.ims.repository.PickupTaskRepository;
import com.ttrims.ims.repository.UserRepository;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;
import java.net.URL;
import java.net.HttpURLConnection;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;
import java.util.regex.Matcher;

@RestController
@RequestMapping("/api/pickups")
public class PickupController {

    private final PickupLocationRepository locationRepo;
    private final PickupTaskRepository taskRepo;
    private final UserRepository userRepo;
    private final AuthHelper auth;

    public PickupController(PickupLocationRepository locationRepo,
                            PickupTaskRepository taskRepo,
                            UserRepository userRepo,
                            AuthHelper auth) {
        this.locationRepo = locationRepo;
        this.taskRepo = taskRepo;
        this.userRepo = userRepo;
        this.auth = auth;
    }

    // ─── Locations Endpoints ───────────────────────────────────────────────

    @GetMapping("/locations")
    public ResponseEntity<?> listLocations() {
        auth.requirePermission("DISPATCH:VIEW");
        List<PickupLocation> locations = locationRepo.findAllByOrderByNameAsc();
        return ResponseEntity.ok(Map.of("success", true, "data", locations));
    }

    @PostMapping("/locations")
    @Transactional
    public ResponseEntity<?> createLocation(@RequestBody Map<String, Object> body) {
        auth.requirePermission("DISPATCH:MANAGE");
        String name = (String) body.get("name");
        if (name == null || name.isBlank()) {
            return bad("Location name is required");
        }
        PickupLocation loc = new PickupLocation();
        loc.setName(name);
        loc.setAddress((String) body.get("address"));
        if (body.get("latitude") != null) {
            loc.setLatitude(((Number) body.get("latitude")).doubleValue());
        }
        if (body.get("longitude") != null) {
            loc.setLongitude(((Number) body.get("longitude")).doubleValue());
        }
        loc.setContactPerson((String) body.get("contact_person"));
        loc.setContactPhone((String) body.get("contact_phone"));
        loc.setGoogleMapsLink((String) body.get("google_maps_link"));

        loc = locationRepo.save(loc);
        return ResponseEntity.ok(Map.of("success", true, "data", loc));
    }

    @PatchMapping("/locations/{id}")
    @Transactional
    public ResponseEntity<?> updateLocation(@PathVariable String id, @RequestBody Map<String, Object> body) {
        auth.requirePermission("DISPATCH:MANAGE");
        PickupLocation loc = locationRepo.findById(id).orElse(null);
        if (loc == null) return bad("Location not found");

        if (body.containsKey("name")) loc.setName((String) body.get("name"));
        if (body.containsKey("address")) loc.setAddress((String) body.get("address"));
        if (body.containsKey("latitude")) {
            loc.setLatitude(body.get("latitude") != null ? ((Number) body.get("latitude")).doubleValue() : null);
        }
        if (body.containsKey("longitude")) {
            loc.setLongitude(body.get("longitude") != null ? ((Number) body.get("longitude")).doubleValue() : null);
        }
        if (body.containsKey("contact_person")) loc.setContactPerson((String) body.get("contact_person"));
        if (body.containsKey("contact_phone")) loc.setContactPhone((String) body.get("contact_phone"));
        if (body.containsKey("google_maps_link")) loc.setGoogleMapsLink((String) body.get("google_maps_link"));

        loc = locationRepo.save(loc);
        return ResponseEntity.ok(Map.of("success", true, "data", loc));
    }

    @DeleteMapping("/locations/{id}")
    @Transactional
    public ResponseEntity<?> deleteLocation(@PathVariable String id) {
        auth.requirePermission("DISPATCH:MANAGE");
        if (!locationRepo.existsById(id)) return bad("Location not found");
        try {
            locationRepo.deleteById(id);
            return ResponseEntity.ok(Map.of("success", true, "message", "Location deleted"));
        } catch (Exception e) {
            return bad("Cannot delete location: it may be referenced by existing pickup tasks");
        }
    }

    // ─── Resolve coordinates from Google Maps Link ─────────────────────────
    @PostMapping("/locations/resolve-coords")
    public ResponseEntity<?> resolveCoords(@RequestBody Map<String, String> body) {
        auth.requirePermission("DISPATCH:MANAGE");
        String urlString = body.get("url");
        if (urlString == null || urlString.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "URL is required"));
        }

        try {
            String finalUrl = urlString;
            
            // Resolve redirects for shortened Google Maps links
            if (urlString.contains("maps.app.goo.gl") || urlString.contains("goo.gl/maps") || urlString.contains("t.co") || urlString.contains("bit.ly")) {
                int redirects = 0;
                while (redirects < 5) {
                    URL url = new URL(finalUrl);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setInstanceFollowRedirects(false);
                    conn.setConnectTimeout(5000);
                    conn.setReadTimeout(5000);
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
                    
                    int status = conn.getResponseCode();
                    if (status >= 300 && status < 400) {
                        String loc = conn.getHeaderField("Location");
                        if (loc != null && !loc.isBlank()) {
                            finalUrl = loc;
                            redirects++;
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }

            Double lat = null;
            Double lng = null;

            // Pattern 1: @lat,lng
            Pattern p1 = Pattern.compile("@(-?\\d+\\.\\d+),(-?\\d+\\.\\d+)");
            Matcher m1 = p1.matcher(finalUrl);
            if (m1.find()) {
                lat = Double.parseDouble(m1.group(1));
                lng = Double.parseDouble(m1.group(2));
            }

            // Pattern 2: !3dlat!4dlng
            if (lat == null) {
                Pattern p2 = Pattern.compile("!3d(-?\\d+\\.\\d+)!4d(-?\\d+\\.\\d+)");
                Matcher m2 = p2.matcher(finalUrl);
                if (m2.find()) {
                    lat = Double.parseDouble(m2.group(1));
                    lng = Double.parseDouble(m2.group(2));
                }
            }

            // Pattern 3: ll=lat,lng
            if (lat == null) {
                Pattern p3 = Pattern.compile("[?&]ll=(-?\\d+\\.\\d+),(-?\\d+\\.\\d+)");
                Matcher m3 = p3.matcher(finalUrl);
                if (m3.find()) {
                    lat = Double.parseDouble(m3.group(1));
                    lng = Double.parseDouble(m3.group(2));
                }
            }

            // Pattern 4: q=lat,lng
            if (lat == null) {
                Pattern p4 = Pattern.compile("[?&]q=(-?\\d+\\.\\d+),(-?\\d+\\.\\d+)");
                Matcher m4 = p4.matcher(finalUrl);
                if (m4.find()) {
                    lat = Double.parseDouble(m4.group(1));
                    lng = Double.parseDouble(m4.group(2));
                }
            }

            // Pattern 5: place/lat,lng
            if (lat == null) {
                Pattern p5 = Pattern.compile("place/(-?\\d+\\.\\d+),(-?\\d+\\.\\d+)");
                Matcher m5 = p5.matcher(finalUrl);
                if (m5.find()) {
                    lat = Double.parseDouble(m5.group(1));
                    lng = Double.parseDouble(m5.group(2));
                }
            }

            if (lat != null && lng != null) {
                String suggestedName = "";
                if (finalUrl.contains("/place/")) {
                    String part = finalUrl.split("/place/")[1];
                    if (part.contains("/")) {
                        part = part.split("/")[0];
                    }
                    if (part.contains("@")) {
                        part = part.split("@")[0];
                    }
                    suggestedName = URLDecoder.decode(part, StandardCharsets.UTF_8).replace("+", " ");
                }

                return ResponseEntity.ok(Map.of(
                    "success", true,
                    "latitude", lat,
                    "longitude", lng,
                    "address", suggestedName,
                    "expanded_url", finalUrl
                ));
            } else {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Could not extract coordinates from URL."));
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", "Error resolving URL: " + e.getMessage()));
        }
    }

    // ─── Tasks Endpoints ───────────────────────────────────────────────────

    @GetMapping("/tasks")
    public ResponseEntity<?> listTasks(@RequestParam(required = false) String driver_id) {
        auth.requirePermission("DISPATCH:VIEW");
        List<PickupTask> tasks;
        if (driver_id != null && !driver_id.isBlank()) {
            tasks = taskRepo.findByDriverIdOrderByCreatedAtDesc(driver_id);
        } else {
            tasks = taskRepo.findAllByOrderByCreatedAtDesc();
        }
        List<Map<String, Object>> result = tasks.stream()
                .map(this::taskToDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    @PostMapping("/tasks")
    @Transactional
    public ResponseEntity<?> createTask(@RequestBody Map<String, Object> body) {
        auth.requirePermission("DISPATCH:MANAGE");
        String locationId = (String) body.get("pickup_location_id");
        String driverId = (String) body.get("driver_id");
        String scheduledAtStr = (String) body.get("scheduled_at");

        if (locationId == null || locationId.isBlank()) return bad("pickup_location_id is required");
        if (driverId == null || driverId.isBlank()) return bad("driver_id is required");

        PickupLocation loc = locationRepo.findById(locationId).orElse(null);
        if (loc == null) return bad("Pickup location not found");

        User driver = userRepo.findById(driverId).orElse(null);
        if (driver == null) return bad("Driver not found");

        PickupTask task = new PickupTask();
        task.setPickupLocation(loc);
        task.setDriver(driver);
        task.setRemarks((String) body.get("remarks"));
        task.setCreatedBy(auth.currentUser().getName());
        task.setStatus(PickupTask.Status.PENDING);

        if (scheduledAtStr != null && !scheduledAtStr.isBlank()) {
            try {
                task.setScheduledAt(LocalDateTime.parse(scheduledAtStr, DateTimeFormatter.ISO_DATE_TIME));
            } catch (Exception e) {
                task.setScheduledAt(LocalDateTime.now());
            }
        } else {
            task.setScheduledAt(LocalDateTime.now());
        }

        // Set driver status to BUSY
        driver.setDriverStatus("BUSY");
        userRepo.save(driver);

        task = taskRepo.save(task);
        return ResponseEntity.ok(Map.of("success", true, "data", taskToDto(task)));
    }

    @PatchMapping("/tasks/{id}/status")
    @Transactional
    public ResponseEntity<?> updateTaskStatus(@PathVariable String id, @RequestBody Map<String, Object> body) {
        auth.requirePermission("DELIVERY:CONFIRM");
        PickupTask task = taskRepo.findById(id).orElse(null);
        if (task == null) return bad("Pickup task not found");

        String statusStr = (String) body.get("status");
        if (statusStr == null || statusStr.isBlank()) return bad("Status is required");

        try {
            PickupTask.Status newStatus = PickupTask.Status.valueOf(statusStr.toUpperCase());
            task.setStatus(newStatus);
            if (body.containsKey("remarks")) {
                task.setRemarks((String) body.get("remarks"));
            }

            if (newStatus == PickupTask.Status.COMPLETED || newStatus == PickupTask.Status.FAILED) {
                task.setCompletedAt(LocalDateTime.now());
                // Release driver
                User driver = task.getDriver();
                if (driver != null) {
                    driver.setDriverStatus("AVAILABLE");
                    userRepo.save(driver);
                }
            }

            task = taskRepo.save(task);
            return ResponseEntity.ok(Map.of("success", true, "data", taskToDto(task)));
        } catch (IllegalArgumentException e) {
            return bad("Invalid status");
        }
    }

    @PatchMapping("/tasks/{id}/reassign")
    @Transactional
    public ResponseEntity<?> reassignTask(@PathVariable String id, @RequestBody Map<String, String> body) {
        auth.requirePermission("DISPATCH:MANAGE");
        PickupTask task = taskRepo.findById(id).orElse(null);
        if (task == null) return bad("Task not found");

        String driverId = body.get("driver_id");
        if (driverId == null || driverId.isBlank()) return bad("driver_id is required");

        User newDriver = userRepo.findById(driverId).orElse(null);
        if (newDriver == null) return bad("New driver not found");

        // Release old driver if task is active
        if (task.getStatus() == PickupTask.Status.PENDING || task.getStatus() == PickupTask.Status.EN_ROUTE) {
            User oldDriver = task.getDriver();
            if (oldDriver != null) {
                oldDriver.setDriverStatus("AVAILABLE");
                userRepo.save(oldDriver);
            }
        }

        task.setDriver(newDriver);

        // Set new driver status to BUSY
        newDriver.setDriverStatus("BUSY");
        userRepo.save(newDriver);

        task = taskRepo.save(task);
        return ResponseEntity.ok(Map.of("success", true, "data", taskToDto(task)));
    }

    @DeleteMapping("/tasks/{id}")
    @Transactional
    public ResponseEntity<?> deleteTask(@PathVariable String id) {
        auth.requirePermission("DISPATCH:MANAGE");
        PickupTask task = taskRepo.findById(id).orElse(null);
        if (task == null) return bad("Task not found");

        if (task.getStatus() == PickupTask.Status.PENDING || task.getStatus() == PickupTask.Status.EN_ROUTE) {
            // Release driver
            User driver = task.getDriver();
            if (driver != null) {
                driver.setDriverStatus("AVAILABLE");
                userRepo.save(driver);
            }
        }

        taskRepo.delete(task);
        return ResponseEntity.ok(Map.of("success", true, "message", "Pickup task deleted successfully"));
    }

    private Map<String, Object> taskToDto(PickupTask task) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", task.getId());
        m.put("status", task.getStatus().name());
        m.put("remarks", task.getRemarks());
        m.put("scheduled_at", task.getScheduledAt() != null ? task.getScheduledAt().toString() : null);
        m.put("completed_at", task.getCompletedAt() != null ? task.getCompletedAt().toString() : null);
        m.put("created_by", task.getCreatedBy());
        m.put("created_at", task.getCreatedAt() != null ? task.getCreatedAt().toString() : null);

        if (task.getPickupLocation() != null) {
            m.put("pickup_location", task.getPickupLocation());
        }
        if (task.getDriver() != null) {
            m.put("driver_id", task.getDriver().getId());
            m.put("driver_name", task.getDriver().getName());
            m.put("driver_phone", task.getDriver().getDeliveryZone() != null ? task.getDriver().getDeliveryZone() : "077-1234560");
            m.put("vehicle_number", task.getDriver().getVehicleNumber());
        }
        return m;
    }

    private ResponseEntity<?> bad(String msg) {
        return ResponseEntity.badRequest().body(Map.of("success", false, "message", msg));
    }
}
