package com.ttrims.ims.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "key_logs")
public class KeyLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    // ── Key reference (denormalised for display) ───────────────────────────────
    @Column(name = "key_id", nullable = false)
    private String keyId;

    @Column(name = "key_name")
    private String keyName;

    @Column(name = "key_number")
    private String keyNumber;

    // ── Person who took the key ────────────────────────────────────────────────
    @Column(name = "taken_by_id")
    private String takenById;

    @Column(name = "taken_by_name", nullable = false)
    private String takenByName;

    @Column(name = "taken_by_email")
    private String takenByEmail;

    // ── Checkout details ───────────────────────────────────────────────────────
    @Column(nullable = false, length = 1000)
    private String reason;

    @Column(name = "taken_at", nullable = false)
    private LocalDateTime takenAt;

    // ── Return details (NULL = still checked out) ──────────────────────────────
    @Column(name = "returned_at")
    private LocalDateTime returnedAt;

    @Column(name = "return_notes", length = 1000)
    private String returnNotes;

    // ── Admin who created / closed the log ────────────────────────────────────
    @Column(name = "recorded_by_id")
    private String recordedById;

    @Column(name = "recorded_by_name")
    private String recordedByName;

    @Column(nullable = false)
    private String status = "PENDING_CHECKOUT";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = LocalDateTime.now(); }

    // ─── Getters & Setters ────────────────────────────────────────────────────
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getKeyId() { return keyId; }
    public void setKeyId(String keyId) { this.keyId = keyId; }
    public String getKeyName() { return keyName; }
    public void setKeyName(String keyName) { this.keyName = keyName; }
    public String getKeyNumber() { return keyNumber; }
    public void setKeyNumber(String keyNumber) { this.keyNumber = keyNumber; }
    public String getTakenById() { return takenById; }
    public void setTakenById(String takenById) { this.takenById = takenById; }
    public String getTakenByName() { return takenByName; }
    public void setTakenByName(String takenByName) { this.takenByName = takenByName; }
    public String getTakenByEmail() { return takenByEmail; }
    public void setTakenByEmail(String takenByEmail) { this.takenByEmail = takenByEmail; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public LocalDateTime getTakenAt() { return takenAt; }
    public void setTakenAt(LocalDateTime takenAt) { this.takenAt = takenAt; }
    public LocalDateTime getReturnedAt() { return returnedAt; }
    public void setReturnedAt(LocalDateTime returnedAt) { this.returnedAt = returnedAt; }
    public String getReturnNotes() { return returnNotes; }
    public void setReturnNotes(String returnNotes) { this.returnNotes = returnNotes; }
    public String getRecordedById() { return recordedById; }
    public void setRecordedById(String recordedById) { this.recordedById = recordedById; }
    public String getRecordedByName() { return recordedByName; }
    public void setRecordedByName(String recordedByName) { this.recordedByName = recordedByName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
