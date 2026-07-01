package com.ttrims.ims.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "visit_allocations")
public class VisitAllocation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "salesperson_id", nullable = false)
    private User salesperson;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "order_id", nullable = true)
    private Order order;

    @Column(name = "visit_date", nullable = false)
    private LocalDate visitDate;

    @Column(nullable = false)
    private Integer sequence = 0;

    @Column(nullable = false)
    private String status = "PENDING"; // PENDING, COMPLETED, SKIPPED

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = "PENDING";
        if (sequence == null) sequence = 0;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public VisitAllocation() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public User getSalesperson() { return salesperson; }
    public void setSalesperson(User salesperson) { this.salesperson = salesperson; }

    public Order getOrder() { return order; }
    public void setOrder(Order order) { this.order = order; }

    public LocalDate getVisitDate() { return visitDate; }
    public void setVisitDate(LocalDate visitDate) { this.visitDate = visitDate; }

    public Integer getSequence() { return sequence; }
    public void setSequence(Integer sequence) { this.sequence = sequence; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
