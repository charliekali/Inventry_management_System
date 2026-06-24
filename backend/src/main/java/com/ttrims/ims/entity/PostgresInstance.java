package com.ttrims.ims.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "postgres_instances")
public class PostgresInstance {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "name", nullable = false, unique = true)
    private String name;

    @Column(name = "database_name", nullable = false)
    private String databaseName;

    @Column(name = "username", nullable = false)
    private String username;

    @Column(name = "password", nullable = false)
    private String password;

    @Column(name = "region", nullable = false)
    private String region;

    @Column(name = "version", nullable = false)
    private String version;

    @Column(name = "datadog_api_key")
    private String datadogApiKey;

    @Column(name = "datadog_region")
    private String datadogRegion;

    @Column(name = "plan_option", nullable = false)
    private String planOption;

    @Column(name = "status", nullable = false)
    private String status = "PROVISIONING";

    @Column(name = "connection_string", nullable = false, length = 500)
    private String connectionString;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (connectionString == null) {
            String regionSlug = region.toLowerCase().replaceAll("[^a-z0-9]", "-");
            connectionString = "postgresql://" + username + ":" + password + "@" + name + "." + regionSlug + ".ttrims.internal:5432/" + databaseName;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public PostgresInstance() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDatabaseName() { return databaseName; }
    public void setDatabaseName(String databaseName) { this.databaseName = databaseName; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public String getDatadogApiKey() { return datadogApiKey; }
    public void setDatadogApiKey(String datadogApiKey) { this.datadogApiKey = datadogApiKey; }

    public String getDatadogRegion() { return datadogRegion; }
    public void setDatadogRegion(String datadogRegion) { this.datadogRegion = datadogRegion; }

    public String getPlanOption() { return planOption; }
    public void setPlanOption(String planOption) { this.planOption = planOption; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getConnectionString() { return connectionString; }
    public void setConnectionString(String connectionString) { this.connectionString = connectionString; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
