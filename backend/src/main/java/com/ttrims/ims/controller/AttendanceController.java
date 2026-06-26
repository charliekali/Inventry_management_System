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
import java.time.LocalDateTime;
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
        session.setClockInAt(LocalDateTime.now());

        // Capture initial GPS if provided
        if (body != null) {
            applyGpsToSession(session, body);
        }

        attendanceRepo.save(session);

        // If we have a starting GPS fix, save it as first location ping
        if (session.getLastLat() != null && body != null) {
            saveLocationPing(session.getId(), body);
        }

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

        // Update the denormalised last-known position on the session
        applyGpsToSession(session, body);
        session.setPingCount(session.getPingCount() + 1);
        attendanceRepo.save(session);

        // Store the breadcrumb
        AttendanceLocation loc = saveLocationPing(id, body);

        return ResponseEntity.ok(Map.of("success", true, "data", locationDto(loc),
            "message", "Location recorded"));
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
        session.setClockOutAt(LocalDateTime.now());
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

    private void applyGpsToSession(Attendance session, Map<String, Object> body) {
        if (body.get("latitude") instanceof Number lat) {
            session.setLastLat(((Number) lat).doubleValue());
        }
        if (body.get("longitude") instanceof Number lng) {
            session.setLastLng(((Number) lng).doubleValue());
        }
        session.setLastPingAt(LocalDateTime.now());
    }

    private AttendanceLocation saveLocationPing(String attendanceId, Map<String, Object> body) {
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
        loc.setRecordedAt(LocalDateTime.now());
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
        m.put("created_at", a.getCreatedAt());

        // Compute duration in minutes
        if (a.getClockInAt() != null) {
            LocalDateTime end = a.getClockOutAt() != null ? a.getClockOutAt() : LocalDateTime.now();
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
