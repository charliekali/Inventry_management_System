package com.ttrims.ims.controller;

import com.ttrims.ims.entity.PostgresInstance;
import com.ttrims.ims.repository.PostgresInstanceRepository;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/postgres-instances")
public class PostgresInstanceController {

    private final PostgresInstanceRepository postgresRepo;
    private final AuthHelper auth;

    public PostgresInstanceController(PostgresInstanceRepository postgresRepo, AuthHelper auth) {
        this.postgresRepo = postgresRepo;
        this.auth = auth;
    }

    @GetMapping
    public ResponseEntity<?> list() {
        auth.requirePermission("INFRASTRUCTURE:VIEW");
        List<PostgresInstance> instances = postgresRepo.findAll();
        instances.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
        return ResponseEntity.ok(Map.of("success", true, "data", instances));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, String> body) {
        auth.requirePermission("INFRASTRUCTURE:MANAGE");

        String name = body.get("name");
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Instance name is required"));
        }
        name = name.trim().toLowerCase().replaceAll("[^a-z0-9-]", "-");
        if (name.length() < 3 || name.length() > 40) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Instance name must be between 3 and 40 characters (alphanumeric and hyphens only)"));
        }

        if (postgresRepo.existsByName(name)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "A Postgres instance with this name already exists"));
        }

        String dbName = body.get("databaseName");
        if (dbName == null || dbName.trim().isEmpty()) {
            dbName = "db_" + generateRandomString(8);
        } else {
            dbName = dbName.trim().toLowerCase().replaceAll("[^a-z0-9_]", "_");
        }

        String username = body.get("username");
        if (username == null || username.trim().isEmpty()) {
            username = "user_" + generateRandomString(8);
        } else {
            username = username.trim().toLowerCase().replaceAll("[^a-z0-9_]", "_");
        }

        String region = body.get("region");
        if (region == null || region.trim().isEmpty()) {
            region = "Virginia (US East)";
        }

        String version = body.get("version");
        if (version == null || version.trim().isEmpty()) {
            version = "18";
        }

        String planOption = body.get("planOption");
        if (planOption == null || planOption.trim().isEmpty()) {
            planOption = "Hobby";
        }

        String datadogApiKey = body.get("datadogApiKey");
        String datadogRegion = body.get("datadogRegion");
        if (datadogRegion == null || datadogRegion.trim().isEmpty()) {
            datadogRegion = "US1 (default)";
        }

        String password = generateRandomPassword(16);

        PostgresInstance instance = new PostgresInstance();
        instance.setName(name);
        instance.setDatabaseName(dbName);
        instance.setUsername(username);
        instance.setPassword(password);
        instance.setRegion(region);
        instance.setVersion(version);
        instance.setPlanOption(planOption);
        instance.setDatadogApiKey(datadogApiKey);
        instance.setDatadogRegion(datadogRegion);
        instance.setStatus("PROVISIONING");
        instance.setCreatedAt(LocalDateTime.now());
        instance.setUpdatedAt(LocalDateTime.now());

        String regionSlug = region.toLowerCase().replaceAll("[^a-z0-9]", "-");
        instance.setConnectionString("postgresql://" + username + ":" + password + "@" + name + "." + regionSlug + ".ttrims.internal:5432/" + dbName);

        postgresRepo.save(instance);

        final String instanceId = instance.getId();
        CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(12000); 
                postgresRepo.findById(instanceId).ifPresent(inst -> {
                    if ("PROVISIONING".equals(inst.getStatus())) {
                        inst.setStatus("ACTIVE");
                        postgresRepo.save(inst);
                    }
                });
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });

        return ResponseEntity.ok(Map.of("success", true, "data", instance));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        auth.requirePermission("INFRASTRUCTURE:MANAGE");

        PostgresInstance instance = postgresRepo.findById(id).orElse(null);
        if (instance == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "Postgres instance not found"));
        }

        instance.setStatus("DELETING");
        postgresRepo.save(instance);

        CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(5000); 
                postgresRepo.findById(id).ifPresent(postgresRepo::delete);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });

        return ResponseEntity.ok(Map.of("success", true, "message", "Database deletion initiated"));
    }

    @GetMapping("/{id}/metrics")
    public ResponseEntity<?> getMetrics(@PathVariable String id) {
        auth.requirePermission("INFRASTRUCTURE:VIEW");

        PostgresInstance instance = postgresRepo.findById(id).orElse(null);
        if (instance == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "Postgres instance not found"));
        }

        if (!"ACTIVE".equals(instance.getStatus())) {
            return ResponseEntity.ok(Map.of("success", true, "data", Map.of(
                "cpu", 0, "memory", 0, "connections", 0, "storage", 0, "active", false
            )));
        }

        Random r = new Random();
        int baseCpu = 2 + r.nextInt(10); 
        int baseConn = 1 + r.nextInt(5);

        double baseMem = 128.0;
        double maxStorage = 1024.0; 
        if ("Starter".equals(instance.getPlanOption())) {
            baseMem = 512.0;
            maxStorage = 10.0 * 1024.0;
        } else if ("Pro Production".equals(instance.getPlanOption())) {
            baseMem = 2048.0;
            maxStorage = 50.0 * 1024.0;
        } else if ("Enterprise Dedicated".equals(instance.getPlanOption())) {
            baseMem = 8192.0;
            maxStorage = 250.0 * 1024.0;
        }

        double currentMem = baseMem + (r.nextDouble() * 50.0);
        double currentStorage = (maxStorage * 0.05) + (r.nextDouble() * 20.0); 

        return ResponseEntity.ok(Map.of(
            "success", true,
            "data", Map.of(
                "cpu", baseCpu + r.nextInt(5),
                "memory", Math.round(currentMem),
                "connections", baseConn + r.nextInt(3),
                "storage", Math.round(currentStorage),
                "active", true
            )
        ));
    }

    @GetMapping("/{id}/logs")
    public ResponseEntity<?> getLogs(@PathVariable String id) {
        auth.requirePermission("INFRASTRUCTURE:VIEW");

        PostgresInstance instance = postgresRepo.findById(id).orElse(null);
        if (instance == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "Postgres instance not found"));
        }

        List<Map<String, String>> logs = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();

        if ("PROVISIONING".equals(instance.getStatus())) {
            logs.add(logEntry(now.minusSeconds(10), "INFO", "Provisioning virtual infrastructure in region " + instance.getRegion()));
            logs.add(logEntry(now.minusSeconds(8), "INFO", "Allocating network storage volume (Plan: " + instance.getPlanOption() + ")"));
            logs.add(logEntry(now.minusSeconds(6), "INFO", "Configuring PostgreSQL v" + instance.getVersion() + " engine config"));
            logs.add(logEntry(now.minusSeconds(4), "INFO", "Booting instance node and initializing system catalogs"));
            logs.add(logEntry(now.minusSeconds(2), "INFO", "Creating default database '" + instance.getDatabaseName() + "' and admin user"));
            logs.add(logEntry(now, "INFO", "Preparing instance network endpoints..."));
        } else if ("DELETING".equals(instance.getStatus())) {
            logs.add(logEntry(now.minusSeconds(4), "WARNING", "Received teardown signal for instance " + instance.getName()));
            logs.add(logEntry(now.minusSeconds(3), "INFO", "Terminating active client connection sessions (0 remaining)"));
            logs.add(logEntry(now.minusSeconds(2), "INFO", "Shutting down PostgreSQL server daemon"));
            logs.add(logEntry(now.minusSeconds(1), "INFO", "Detaching storage disk volume"));
            logs.add(logEntry(now, "INFO", "Releasing elastic IP endpoints and cleaning resources"));
        } else if ("ACTIVE".equals(instance.getStatus())) {
            logs.add(logEntry(now.minusMinutes(30), "INFO", "database system is shut down"));
            logs.add(logEntry(now.minusMinutes(29), "INFO", "database system was shut down at " + now.minusMinutes(30).toString().replace("T", " ")));
            logs.add(logEntry(now.minusMinutes(29), "INFO", "database system is ready to accept connections on port 5432"));
            logs.add(logEntry(now.minusMinutes(29), "INFO", "autovacuum launcher started"));

            if (instance.getDatadogApiKey() != null && !instance.getDatadogApiKey().trim().isEmpty()) {
                logs.add(logEntry(now.minusMinutes(28), "INFO", "Datadog Agent initialized successfully. Sending metrics to " + instance.getDatadogRegion()));
            }

            logs.add(logEntry(now.minusMinutes(15), "INFO", "connection received: host=10.244.3.41 port=49122"));
            logs.add(logEntry(now.minusMinutes(15), "INFO", "connection authorized: user=" + instance.getUsername() + " database=" + instance.getDatabaseName() + " SSL=on"));
            logs.add(logEntry(now.minusMinutes(14), "DEBUG", "autovacuum: processing database '" + instance.getDatabaseName() + "'"));

            logs.add(logEntry(now.minusSeconds(120), "INFO", "connection received: host=10.244.3.41 port=51102"));
            logs.add(logEntry(now.minusSeconds(120), "INFO", "connection authorized: user=" + instance.getUsername() + " database=" + instance.getDatabaseName() + " SSL=on"));
            logs.add(logEntry(now.minusSeconds(90), "DEBUG", "SELECT current_setting('server_version_num')"));
            logs.add(logEntry(now.minusSeconds(45), "DEBUG", "SELECT COUNT(*) FROM app_settings"));
        }

        return ResponseEntity.ok(Map.of("success", true, "data", logs));
    }

    private Map<String, String> logEntry(LocalDateTime time, String level, String message) {
        return Map.of(
            "timestamp", time.toString().replace("T", " ").substring(0, 19),
            "level", level,
            "message", message
        );
    }

    private String generateRandomString(int length) {
        String chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder sb = new StringBuilder();
        Random r = new Random();
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(r.nextInt(chars.length())));
        }
        return sb.toString();
    }

    private String generateRandomPassword(int length) {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_!@";
        StringBuilder sb = new StringBuilder();
        Random r = new Random();
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(r.nextInt(chars.length())));
        }
        return sb.toString();
    }
}
