package com.ttrims.ims.controller;

import com.ttrims.ims.entity.Attendance;
import com.ttrims.ims.entity.AttendanceLocation;
import com.ttrims.ims.entity.User;
import com.ttrims.ims.repository.AttendanceLocationRepository;
import com.ttrims.ims.repository.AttendanceRepository;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    private final AttendanceRepository attendanceRepo;
    private final AttendanceLocationRepository locationRepo;
    private final AuthHelper auth;

    public AttendanceController(AttendanceRepository attendanceRepo,
                                AttendanceLocationRepository locationRepo,
                                AuthHelper auth) {
        this.attendanceRepo = attendanceRepo;
        this.locationRepo = locationRepo;
        this.auth = auth;
    }

    // ─── POST /api/attendance/start ──────────────────────────────────────────
    /** Sales staff: clock in and start a new attendance session. */
    @PostMapping("/start")
    public ResponseEntity<?> start(@RequestBody(required = false) Map<String, Object> body) {
        User me = auth.currentUser();

        // Enforce GPS tracking on start
        if (body == null || body.get("latitude") == null || body.get("longitude") == null) {
            return bad("GPS tracking must be active to start attendance");
        }

        // Prevent duplicate active sessions for the same user
        Optional<Attendance> existing = attendanceRepo.findByUserIdAndStatus(me.getId(), "ACTIVE");
        if (existing.isPresent()) {
            return ResponseEntity.ok(Map.of("success", true, "data", toDto(existing.get()),
                "message", "Existing active session resumed"));
        }

        Attendance session = new Attendance();
        session.setUserId(me.getId());
        session.setUserName(me.getName());
        session.setUserEmail(me.getEmail());
        session.setStatus("ACTIVE");
        session.setClockInAt(Instant.now());

        // Parse client-supplied timestamp or fallback to Instant.now()
        Instant recordedAt = Instant.now();
        if (body.get("recorded_at") != null) {
            Object rec = body.get("recorded_at");
            if (rec instanceof Number num) {
                recordedAt = Instant.ofEpochMilli(num.longValue());
            } else if (rec instanceof String str) {
                try {
                    recordedAt = Instant.parse(str);
                } catch (Exception ignored) {}
            }
        }

        // Capture initial GPS
        applyGpsToSession(session, body, recordedAt);

        attendanceRepo.save(session);

        // Save it as the first location ping
        saveLocationPing(session.getId(), body, recordedAt);

        return ResponseEntity.status(201)
            .body(Map.of("success", true, "data", toDto(session),
                "message", "Attendance started"));
    }

    // ─── POST /api/attendance/{id}/ping ─────────────────────────────────────
    /** Sales staff: submit a GPS breadcrumb for an active session. */
    @PostMapping("/{id}/ping")
    public ResponseEntity<?> ping(@PathVariable String id,
                                  @RequestBody Map<String, Object> body) {
        User me = auth.currentUser();
        Attendance session = attendanceRepo.findById(id).orElse(null);

        if (session == null) return bad("Attendance session not found");
        if (!session.getUserId().equals(me.getId()) && !auth.isSuperAdmin()) {
            return bad("Not authorised to ping this session");
        }
        if (!"ACTIVE".equals(session.getStatus())) {
            return bad("Session is no longer active");
        }

        double accuracy = 0.0;
        if (body.get("accuracy") instanceof Number acc) {
            accuracy = acc.doubleValue();
        }

        // GPS Accuracy Filter: Ignore pings with accuracy worse than 100 meters
        if (accuracy > 100.0) {
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Location skipped due to low accuracy (" + accuracy + "m)"
            ));
        }

        // Parse client-supplied timestamp (supports both epoch millis and ISO string)
        Instant recordedAt = Instant.now();
        if (body.get("recorded_at") != null) {
            Object rec = body.get("recorded_at");
            if (rec instanceof Number num) {
                recordedAt = Instant.ofEpochMilli(num.longValue());
            } else if (rec instanceof String str) {
                try {
                    recordedAt = Instant.parse(str);
                } catch (Exception ignored) {}
            }
        }

        // Get the last recorded position to calculate distance and speed
        Optional<AttendanceLocation> lastLocOpt = locationRepo.findFirstByAttendanceIdOrderByRecordedAtDesc(id);
        double distFromLast = 0.0;
        double calculatedSpeed = 0.0;

        if (body.get("cumulative_distance") instanceof Number clientCumDist) {
            session.setDistanceKm(clientCumDist.doubleValue());
            if (body.get("distance_from_last") instanceof Number clientDistLast) {
                distFromLast = clientDistLast.doubleValue();
            }
            if (body.get("speed") instanceof Number clientSpeed) {
                calculatedSpeed = clientSpeed.doubleValue();
            }
        } else {
            // Server-side fallback calculation (no client cumulative_distance provided)
            if (body.get("latitude") instanceof Number latNum && body.get("longitude") instanceof Number lngNum) {
                double currentLat = latNum.doubleValue();
                double currentLng = lngNum.doubleValue();

                if (lastLocOpt.isPresent()) {
                    AttendanceLocation lastLoc = lastLocOpt.get();
                    distFromLast = calculateHaversineDistance(lastLoc.getLatitude(), lastLoc.getLongitude(), currentLat, currentLng);

                    // GPS Drift Filter: ignore changes smaller than 2 metres
                    if (distFromLast < 0.002) {
                        distFromLast = 0.0;
                    }

                    // ── Speed calculation ──────────────────────────────────────────────
                    // Client sends speed in m/s (Web Geolocation API standard).
                    // Use it only when it is a valid non-negative value.
                    // Fall back to time-based estimate otherwise.
                    double clientSpeedMps = -1.0;
                    if (body.get("speed") instanceof Number spd) {
                        clientSpeedMps = spd.doubleValue();
                    }

                    if (clientSpeedMps >= 0) {
                        // Valid GPS hardware speed → convert m/s to km/h
                        calculatedSpeed = clientSpeedMps * 3.6;
                    } else if (lastLoc.getRecordedAt() != null) {
                        // No valid GPS speed → estimate from distance / elapsed time
                        long seconds = Duration.between(lastLoc.getRecordedAt(), recordedAt).getSeconds();
                        if (seconds > 0 && distFromLast > 0) {
                            calculatedSpeed = (distFromLast / seconds) * 3600.0; // km/h
                        }
                    }

                } else {
                    // First ping for this session — no previous location
                    if (body.get("speed") instanceof Number spd && spd.doubleValue() >= 0) {
                        calculatedSpeed = spd.doubleValue() * 3.6;
                    }
                }
            }

            if (Double.isNaN(calculatedSpeed) || Double.isInfinite(calculatedSpeed) || calculatedSpeed < 0) {
                calculatedSpeed = 0.0;
            }
            if (calculatedSpeed > 200.0) calculatedSpeed = 200.0;

            session.setDistanceKm((session.getDistanceKm() != null ? session.getDistanceKm() : 0.0) + distFromLast);
        }

        session.setCurrentSpeedKmph(calculatedSpeed);
        applyGpsToSession(session, body, recordedAt);
        session.setPingCount(session.getPingCount() + 1);
        attendanceRepo.save(session);

        // Store the location breadcrumb with calculated metrics
        AttendanceLocation loc = new AttendanceLocation();
        loc.setAttendanceId(id);
        if (body.get("latitude") instanceof Number lat) {
            loc.setLatitude(((Number) lat).doubleValue());
        }
        if (body.get("longitude") instanceof Number lng) {
            loc.setLongitude(((Number) lng).doubleValue());
        }
        if (body.get("accuracy") instanceof Number acc) {
            loc.setAccuracy(((Number) acc).doubleValue());
        }
        loc.setSpeedKmph(calculatedSpeed);
        loc.setDistanceFromLastKm(distFromLast);
        loc.setRecordedAt(recordedAt);
        locationRepo.save(loc);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "data", locationDto(loc),
            "session", toDto(session),
            "message", "Location recorded"
        ));
    }

    // ─── POST /api/attendance/{id}/stop ─────────────────────────────────────
    /** Sales staff: clock out and end the session. */
    @PostMapping("/{id}/stop")
    public ResponseEntity<?> stop(@PathVariable String id) {
        User me = auth.currentUser();
        Attendance session = attendanceRepo.findById(id).orElse(null);

        if (session == null) return bad("Attendance session not found");
        if (!session.getUserId().equals(me.getId()) && !auth.isSuperAdmin()) {
            return bad("Not authorised to stop this session");
        }

        session.setStatus("ENDED");
        session.setClockOutAt(session.getLastPingAt() != null ? session.getLastPingAt() : Instant.now());
        session.setCurrentSpeedKmph(0.0); // Reset speed to 0 on checkout
        attendanceRepo.save(session);

        return ResponseEntity.ok(Map.of("success", true, "data", toDto(session),
            "message", "Attendance ended"));
    }

    // ─── GET /api/attendance/my ──────────────────────────────────────────────
    /** Sales staff: get their own attendance sessions (for the daily log card). */
    @GetMapping("/my")
    public ResponseEntity<?> myAttendance() {
        User me = auth.currentUser();
        List<Map<String, Object>> list = attendanceRepo
            .findByUserIdOrderByCreatedAtDesc(me.getId())
            .stream().limit(20).map(this::toDto).collect(Collectors.toList());
        return ok(list);
    }

    // ─── GET /api/attendance/active ─────────────────────────────────────────
    /** Admin: get all currently active attendance sessions for the live map. */
    @GetMapping("/active")
    public ResponseEntity<?> active() {
        auth.requireSuperAdmin();
        List<Map<String, Object>> list = attendanceRepo
            .findByStatusOrderByClockInAtDesc("ACTIVE")
            .stream().map(this::toDto).collect(Collectors.toList());
        return ok(list);
    }

    // ─── GET /api/attendance/{id}/trail ─────────────────────────────────────
    /** Admin: get full GPS breadcrumb trail for a session (to draw polyline). */
    @GetMapping("/{id}/trail")
    public ResponseEntity<?> trail(@PathVariable String id) {
        auth.requireSuperAdmin();
        List<Map<String, Object>> points = locationRepo
            .findByAttendanceIdOrderByRecordedAtAsc(id)
            .stream().map(this::locationDto).collect(Collectors.toList());
        return ok(points);
    }

    // ─── GET /api/attendance/history ────────────────────────────────────────
    /** Admin: get all attendance sessions (paginated, newest first). */
    @GetMapping("/history")
    public ResponseEntity<?> history() {
        auth.requireSuperAdmin();
        List<Map<String, Object>> list = attendanceRepo
            .findAllByOrderByCreatedAtDesc()
            .stream().limit(200).map(this::toDto).collect(Collectors.toList());
        return ok(list);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private double calculateHaversineDistance(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371; // Earth's radius in kilometers
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // returns distance in kilometers
    }

    private void applyGpsToSession(Attendance session, Map<String, Object> body, Instant recordedAt) {
        if (body.get("latitude") instanceof Number lat) {
            session.setLastLat(((Number) lat).doubleValue());
        }
        if (body.get("longitude") instanceof Number lng) {
            session.setLastLng(((Number) lng).doubleValue());
        }
        session.setLastPingAt(recordedAt);
    }

    private AttendanceLocation saveLocationPing(String attendanceId, Map<String, Object> body, Instant recordedAt) {
        AttendanceLocation loc = new AttendanceLocation();
        loc.setAttendanceId(attendanceId);
        if (body.get("latitude") instanceof Number lat) {
            loc.setLatitude(((Number) lat).doubleValue());
        }
        if (body.get("longitude") instanceof Number lng) {
            loc.setLongitude(((Number) lng).doubleValue());
        }
        if (body.get("accuracy") instanceof Number acc) {
            loc.setAccuracy(((Number) acc).doubleValue());
        }
        loc.setRecordedAt(recordedAt);
        return locationRepo.save(loc);
    }

    private Map<String, Object> toDto(Attendance a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.getId());
        m.put("user_id", a.getUserId());
        m.put("user_name", a.getUserName());
        m.put("user_email", a.getUserEmail());
        m.put("status", a.getStatus());
        m.put("clock_in_at", a.getClockInAt());
        m.put("clock_out_at", a.getClockOutAt());
        m.put("last_lat", a.getLastLat());
        m.put("last_lng", a.getLastLng());
        m.put("last_ping_at", a.getLastPingAt());
        m.put("ping_count", a.getPingCount());
        m.put("distance_km", a.getDistanceKm() != null ? a.getDistanceKm() : 0.0);
        m.put("current_speed_kmph", a.getCurrentSpeedKmph() != null ? a.getCurrentSpeedKmph() : 0.0);
        m.put("created_at", a.getCreatedAt());

        // Compute duration in minutes
        if (a.getClockInAt() != null) {
            Instant end = a.getClockOutAt() != null ? a.getClockOutAt() : 
                          (a.getLastPingAt() != null ? a.getLastPingAt() : Instant.now());
            long mins = Duration.between(a.getClockInAt(), end).toMinutes();
            m.put("duration_minutes", mins);
        }
        return m;
    }

    private Map<String, Object> locationDto(AttendanceLocation l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", l.getId());
        m.put("attendance_id", l.getAttendanceId());
        m.put("lat", l.getLatitude());
        m.put("lng", l.getLongitude());
        m.put("accuracy", l.getAccuracy());
        m.put("speed_kmph", l.getSpeedKmph() != null ? l.getSpeedKmph() : 0.0);
        m.put("distance_from_last_km", l.getDistanceFromLastKm() != null ? l.getDistanceFromLastKm() : 0.0);
        m.put("recorded_at", l.getRecordedAt());
        return m;
    }

    private ResponseEntity<?> ok(Object data) {
        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }

    private ResponseEntity<?> bad(String msg) {
        return ResponseEntity.badRequest().body(Map.of("success", false, "message", msg));
    }
}
