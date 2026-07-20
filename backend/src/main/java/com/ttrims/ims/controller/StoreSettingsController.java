package com.ttrims.ims.controller;

import com.ttrims.ims.entity.AppSetting;
import com.ttrims.ims.repository.AppSettingRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/store-settings")
@CrossOrigin(origins = "*")
public class StoreSettingsController {

    private final AppSettingRepository settingRepo;

    private static final Map<String, String> DEFAULT_STORE_SETTINGS = Map.of(
        "STORE_CONFIG:primary_color", "#113425",
        "STORE_CONFIG:accent_color", "#d96226",
        "STORE_CONFIG:logo_text", "TTRIMS Marketplace",
        "STORE_CONFIG:homepage_layout", "banners,categories,deals,trending,testimonials,newsletter",
        "STORE_CONFIG:shipping_charge", "40",
        "STORE_CONFIG:free_shipping_min", "500",
        "STORE_CONFIG:gst_percent", "18",
        "STORE_CONFIG:banners", "[\n" +
            "  {\n" +
            "    \"id\": 1,\n" +
            "    \"image\": \"https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=1200\",\n" +
            "    \"title\": \"Traceable & Pure Spices\",\n" +
            "    \"subtitle\": \"Straight from certified regional organic farms to your kitchen.\",\n" +
            "    \"link\": \"/store/shop?category=Spices\",\n" +
            "    \"active\": true\n" +
            "  },\n" +
            "  {\n" +
            "    \"id\": 2,\n" +
            "    \"image\": \"https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=1200\",\n" +
            "    \"title\": \"Fresh Grains & Pulses\",\n" +
            "    \"subtitle\": \"100% natural, sorted, and packed with hygienic care.\",\n" +
            "    \"link\": \"/store/shop?category=Grains\",\n" +
            "    \"active\": true\n" +
            "  }\n" +
            "]"
    );

    public StoreSettingsController(AppSettingRepository settingRepo) {
        this.settingRepo = settingRepo;
    }

    @GetMapping
    public ResponseEntity<?> getStoreSettings() {
        List<AppSetting> stored = settingRepo.findBySettingKeyStartingWith("STORE_CONFIG:");
        
        // Seed default settings if empty
        if (stored.isEmpty()) {
            for (Map.Entry<String, String> entry : DEFAULT_STORE_SETTINGS.entrySet()) {
                settingRepo.save(new AppSetting(entry.getKey(), entry.getValue()));
            }
            stored = settingRepo.findBySettingKeyStartingWith("STORE_CONFIG:");
        }

        Map<String, String> responseMap = stored.stream().collect(Collectors.toMap(
            s -> s.getSettingKey().substring("STORE_CONFIG:".length()),
            AppSetting::getSettingValue,
            (v1, v2) -> v1
        ));

        return ResponseEntity.ok(Map.of("success", true, "data", responseMap));
    }

    @PostMapping
    public ResponseEntity<?> saveStoreSettings(@RequestBody Map<String, String> body) {
        for (Map.Entry<String, String> entry : body.entrySet()) {
            String key = "STORE_CONFIG:" + entry.getKey();
            AppSetting setting = settingRepo.findBySettingKey(key)
                .orElse(new AppSetting(key, entry.getValue()));
            setting.setSettingValue(entry.getValue());
            settingRepo.save(setting);
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Store configs saved successfully"));
    }
}
