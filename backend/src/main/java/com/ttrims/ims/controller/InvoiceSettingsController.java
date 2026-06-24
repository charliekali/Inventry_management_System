package com.ttrims.ims.controller;

import com.ttrims.ims.entity.AppSetting;
import com.ttrims.ims.repository.AppSettingRepository;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/invoice-settings")
public class InvoiceSettingsController {

    private final AppSettingRepository settingRepo;
    private final AuthHelper auth;

    private static final Map<String, String> DEFAULT_SETTINGS = Map.ofEntries(
        Map.entry("theme", "modern"),
        Map.entry("primaryColor", "#3b82f6"),
        Map.entry("companyName", "TTRIMS IMS"),
        Map.entry("companyAddress", "12, Industrial Area Phase II, Bangalore, KA, India"),
        Map.entry("companyPhone", "+91 80 4123 4567"),
        Map.entry("companyEmail", "billing@ttrims.com"),
        Map.entry("companyWebsite", "www.ttrims.com"),
        Map.entry("gstin", "29AAFCT5683K1Z2"),
        Map.entry("logoUrl", ""),
        Map.entry("terms", "1. Goods once sold will not be taken back.\n2. Payments must be completed within agreed schedules.\n3. All disputes are subject to Bangalore jurisdiction only."),
        Map.entry("showGstin", "true"),
        Map.entry("showSignature", "true"),
        Map.entry("showTerms", "true"),
        Map.entry("showLogo", "true")
    );

    public InvoiceSettingsController(AppSettingRepository settingRepo, AuthHelper auth) {
        this.settingRepo = settingRepo;
        this.auth = auth;
    }

    @GetMapping
    public ResponseEntity<?> getSettings() {
        auth.requirePermission("ORDERS:VIEW");
        
        List<AppSetting> stored = settingRepo.findBySettingKeyStartingWith("INVOICE:");
        if (stored.isEmpty()) {
            seedDefaults();
            stored = settingRepo.findBySettingKeyStartingWith("INVOICE:");
        }

        Map<String, String> result = stored.stream()
            .collect(Collectors.toMap(
                s -> s.getSettingKey().substring("INVOICE:".length()),
                AppSetting::getSettingValue
            ));

        // Ensure all default keys are present in return list
        for (Map.Entry<String, String> entry : DEFAULT_SETTINGS.entrySet()) {
            result.putIfAbsent(entry.getKey(), entry.getValue());
        }

        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    @PutMapping
    @Transactional
    public ResponseEntity<?> saveSettings(@RequestBody Map<String, String> body) {
        // Enforce Super Admin requirement as requested
        auth.requireSuperAdmin();

        for (Map.Entry<String, String> entry : body.entrySet()) {
            String key = "INVOICE:" + entry.getKey();
            String value = entry.getValue() != null ? entry.getValue().trim() : "";
            
            AppSetting setting = settingRepo.findBySettingKey(key)
                .orElse(new AppSetting(key, value));
            setting.setSettingValue(value);
            settingRepo.save(setting);
        }

        return ResponseEntity.ok(Map.of("success", true, "message", "Invoice design settings saved successfully"));
    }

    private void seedDefaults() {
        for (Map.Entry<String, String> entry : DEFAULT_SETTINGS.entrySet()) {
            String key = "INVOICE:" + entry.getKey();
            if (settingRepo.findBySettingKey(key).isEmpty()) {
                settingRepo.save(new AppSetting(key, entry.getValue()));
            }
        }
    }
}
