package com.ttrims.ims.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "factory_keys")
public class FactoryKey {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** Human-readable name, e.g. "Main Gate Key", "Warehouse A Door" */
    @Column(nullable = false)
    private String name;

    /** Optional description of what the key opens */
    @Column
    private String description;

    /** Physical tag/label number on the key, e.g. "K-001" */
    @Column(name = "key_number")
    private String keyNumber;

    /** AVAILABLE or CHECKED_OUT */
    @Column(nullable = false)
    private String status = "AVAILABLE";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }

    @PreUpdate
    void preUpdate() { updatedAt = LocalDateTime.now(); }

    // ─── Getters & Setters ────────────────────────────────────────────────────
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getKeyNumber() { return keyNumber; }
    public void setKeyNumber(String keyNumber) { this.keyNumber = keyNumber; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
