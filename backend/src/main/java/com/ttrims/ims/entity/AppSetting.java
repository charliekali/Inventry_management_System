package com.ttrims.ims.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Generic key-value app settings store.
 * Key format: "FORM_TYPE:FIELD_KEY:PROPERTY" e.g. "STOCK_IN:remarks:visible"
 */
@Entity
@Table(name = "app_settings", uniqueConstraints = @UniqueConstraint(columnNames = "setting_key"))
public class AppSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "setting_key", nullable = false, unique = true, length = 120)
    private String settingKey;

    @Column(name = "setting_value", nullable = false, length = 500)
    private String settingValue;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void touch() { updatedAt = LocalDateTime.now(); }

    public AppSetting() {}

    public AppSetting(String settingKey, String settingValue) {
        this.settingKey = settingKey;
        this.settingValue = settingValue;
    }

    public String getId() { return id; }
    public String getSettingKey() { return settingKey; }
    public void setSettingKey(String settingKey) { this.settingKey = settingKey; }
    public String getSettingValue() { return settingValue; }
    public void setSettingValue(String settingValue) { this.settingValue = settingValue; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
