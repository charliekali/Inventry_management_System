package com.ttrims.ims.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "order_follow_ups")
public class OrderFollowUp {

    public enum FollowUpStatus {
        PENDING,
        CONTACTED,
        PROMISE_TO_PAY,
        ESCALATED,
        RESOLVED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(name = "next_follow_up_date", nullable = false)
    private LocalDate nextFollowUpDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "follow_up_status", nullable = false)
    private FollowUpStatus followUpStatus;

    @Column(name = "contact_person")
    private String contactPerson;

    @Column(name = "comments", length = 1000)
    private String comments;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "recorded_by")
    private User recordedBy;

    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt;

    @PrePersist
    void prePersist() {
        if (recordedAt == null) recordedAt = LocalDateTime.now();
    }

    public OrderFollowUp() {}

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Order getOrder() { return order; }
    public void setOrder(Order order) { this.order = order; }

    public LocalDate getNextFollowUpDate() { return nextFollowUpDate; }
    public void setNextFollowUpDate(LocalDate nextFollowUpDate) { this.nextFollowUpDate = nextFollowUpDate; }

    public FollowUpStatus getFollowUpStatus() { return followUpStatus; }
    public void setFollowUpStatus(FollowUpStatus followUpStatus) { this.followUpStatus = followUpStatus; }

    public String getContactPerson() { return contactPerson; }
    public void setContactPerson(String contactPerson) { this.contactPerson = contactPerson; }

    public String getComments() { return comments; }
    public void setComments(String comments) { this.comments = comments; }

    public User getRecordedBy() { return recordedBy; }
    public void setRecordedBy(User recordedBy) { this.recordedBy = recordedBy; }

    public LocalDateTime getRecordedAt() { return recordedAt; }
    public void setRecordedAt(LocalDateTime recordedAt) { this.recordedAt = recordedAt; }
}
