package com.ttrims.ims.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "attendance")
public class Attendance {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "user_name")
    private String userName;

    @Column(name = "user_email")
    private String userEmail;

    /** ACTIVE while the person is checked in, ENDED when they stop. */
    @Column(nullable = false)
    private String status = "ACTIVE";

    @Column(name = "clock_in_at")
    private LocalDateTime clockInAt;

    @Column(name = "clock_out_at")
    private LocalDateTime clockOutAt;

    /** Latitude of the most recent GPS ping (updated on every ping for quick access). */
    @Column(name = "last_lat")
    private Double lastLat;

    /** Longitude of the most recent GPS ping. */
    @Column(name = "last_lng")
    private Double lastLng;

    @Column(name = "last_ping_at")
    private LocalDateTime lastPingAt;

    @Column(name = "ping_count")
    private int pingCount = 0;

    @Column(name = "distance_km")
    private Double distanceKm = 0.0;

    @Column(name = "current_speed_kmph")
    private Double currentSpeedKmph = 0.0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        if (clockInAt == null) clockInAt = LocalDateTime.now();
        if (distanceKm == null) distanceKm = 0.0;
        if (currentSpeedKmph == null) currentSpeedKmph = 0.0;
    }

    // ─── Getters & Setters ────────────────────────────────────────────────────
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getClockInAt() { return clockInAt; }
    public void setClockInAt(LocalDateTime clockInAt) { this.clockInAt = clockInAt; }
    public LocalDateTime getClockOutAt() { return clockOutAt; }
    public void setClockOutAt(LocalDateTime clockOutAt) { this.clockOutAt = clockOutAt; }
    public Double getLastLat() { return lastLat; }
    public void setLastLat(Double lastLat) { this.lastLat = lastLat; }
    public Double getLastLng() { return lastLng; }
    public void setLastLng(Double lastLng) { this.lastLng = lastLng; }
    public LocalDateTime getLastPingAt() { return lastPingAt; }
    public void setLastPingAt(LocalDateTime lastPingAt) { this.lastPingAt = lastPingAt; }
    public int getPingCount() { return pingCount; }
    public void setPingCount(int pingCount) { this.pingCount = pingCount; }
    public Double getDistanceKm() { return distanceKm != null ? distanceKm : 0.0; }
    public void setDistanceKm(Double distanceKm) { this.distanceKm = distanceKm; }
    public Double getCurrentSpeedKmph() { return currentSpeedKmph != null ? currentSpeedKmph : 0.0; }
    public void setCurrentSpeedKmph(Double currentSpeedKmph) { this.currentSpeedKmph = currentSpeedKmph; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
