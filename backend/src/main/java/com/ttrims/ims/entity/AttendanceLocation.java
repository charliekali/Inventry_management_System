package com.ttrims.ims.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "attendance_locations")
public class AttendanceLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "attendance_id", nullable = false)
    private String attendanceId;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    /** GPS accuracy in metres — lower is better. */
    @Column
    private Double accuracy;

    @Column(name = "recorded_at")
    private Instant recordedAt;

    @Column(name = "speed_kmph")
    private Double speedKmph = 0.0;

    @Column(name = "distance_from_last_km")
    private Double distanceFromLastKm = 0.0;

    @PrePersist
    void prePersist() {
        if (recordedAt == null) recordedAt = Instant.now();
        if (speedKmph == null) speedKmph = 0.0;
        if (distanceFromLastKm == null) distanceFromLastKm = 0.0;
    }

    // ─── Getters & Setters ────────────────────────────────────────────────────
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getAttendanceId() { return attendanceId; }
    public void setAttendanceId(String attendanceId) { this.attendanceId = attendanceId; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public Double getAccuracy() { return accuracy; }
    public void setAccuracy(Double accuracy) { this.accuracy = accuracy; }
    public Double getSpeedKmph() { return speedKmph != null ? speedKmph : 0.0; }
    public void setSpeedKmph(Double speedKmph) { this.speedKmph = speedKmph; }
    public Double getDistanceFromLastKm() { return distanceFromLastKm != null ? distanceFromLastKm : 0.0; }
    public void setDistanceFromLastKm(Double distanceFromLastKm) { this.distanceFromLastKm = distanceFromLastKm; }
    public Instant getRecordedAt() { return recordedAt; }
    public void setRecordedAt(Instant recordedAt) { this.recordedAt = recordedAt; }
}
