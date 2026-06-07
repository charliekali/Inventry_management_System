package com.ttrims.ims.controller;

import com.ttrims.ims.entity.AppSetting;
import com.ttrims.ims.repository.AppSettingRepository;
import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Manages dynamic form field settings for Stock IN and Stock OUT forms.
 *
 * Key format stored in app_settings: "STOCK_IN:field_key:property"
 * Properties: visible, required, label, field_order
 *
 * Default field definitions are seeded on first GET if no settings exist yet.
 */
@RestController
@RequestMapping("/api/form-settings")
public class FormSettingsController {

    private final AppSettingRepository settingRepo;
    private final AuthHelper auth;

    // Default field definitions for Stock IN / OUT forms
    private static final List<Map<String, Object>> DEFAULT_STOCK_FIELDS = List.of(
        field("product_id",       "Product",                true,  true,  1),
        field("transaction_date", "Transaction Date",        true,  true,  2),
        field("warehouse_id",     "Warehouse",               true,  true,  3),
        field("section_id",       "Section",                 false, false, 4),
        field("quantity",         "Quantity",                true,  true,  5),
        field("unit",             "Unit of Measure",         true,  false, 6),
        field("reference_doc",    "Reference Doc / Slip #",  true,  false, 7),
        field("remarks",          "Remarks",                 true,  false, 8)
    );

    // Default field definitions for Sales Order creation form
    private static final List<Map<String, Object>> DEFAULT_ORDER_FIELDS = List.of(
        field("customer",         "Customer Name",           true,  true,  1),
        field("remarks",          "Remarks",                 true,  false, 2)
    );

    private List<Map<String, Object>> getDefaultFieldsForForm(String formType) {
        if ("ORDER".equals(formType)) {
            return DEFAULT_ORDER_FIELDS;
        }
        return DEFAULT_STOCK_FIELDS;
    }

    private static Map<String, Object> field(String key, String label, boolean visible, boolean required, int order) {
        Map<String, Object> m = new HashMap<>();
        m.put("field_key", key);
        m.put("label", label);
        m.put("visible", visible);
        m.put("required", required);
        m.put("field_order", order);
        return m;
    }

    public FormSettingsController(AppSettingRepository settingRepo, AuthHelper auth) {
        this.settingRepo = settingRepo;
        this.auth = auth;
    }

    // ─── GET /api/form-settings?form=STOCK_IN ─────────────────────────────────

    @GetMapping
    public ResponseEntity<?> getSettings(@RequestParam(defaultValue = "STOCK_IN") String form) {
        String formType = form.toUpperCase();
        String prefix = formType + ":";

        List<AppSetting> stored = settingRepo.findBySettingKeyStartingWith(prefix);
        List<Map<String, Object>> defaultFields = getDefaultFieldsForForm(formType);

        // Seed defaults into DB if nothing stored yet
        if (stored.isEmpty()) {
            seedDefaults(formType);
            stored = settingRepo.findBySettingKeyStartingWith(prefix);
        }

        // Build a map of key → value from stored settings
        Map<String, String> kvMap = stored.stream()
            .collect(Collectors.toMap(AppSetting::getSettingKey, AppSetting::getSettingValue));

        // Identify all unique field keys stored for this form
        Set<String> allKeys = new HashSet<>();
        defaultFields.forEach(def -> allKeys.add((String) def.get("field_key")));
        
        for (AppSetting s : stored) {
            String k = s.getSettingKey(); // e.g., STOCK_IN:temperature:label
            String[] parts = k.split(":");
            if (parts.length == 3) {
                allKeys.add(parts[1]);
            }
        }

        // Reconstruct field objects
        List<Map<String, Object>> fields = allKeys.stream().map(fieldKey -> {
            boolean isDefault = defaultFields.stream().anyMatch(d -> d.get("field_key").equals(fieldKey));
            Map<String, Object> def = defaultFields.stream()
                .filter(d -> d.get("field_key").equals(fieldKey))
                .findFirst()
                .orElseGet(() -> field(fieldKey, fieldKey, true, false, 99));

            Map<String, Object> f = new LinkedHashMap<>();
            f.put("field_key", fieldKey);
            f.put("label",       kvMap.getOrDefault(prefix + fieldKey + ":label",       (String) def.get("label")));
            f.put("visible",     Boolean.parseBoolean(kvMap.getOrDefault(prefix + fieldKey + ":visible",  def.get("visible").toString())));
            f.put("required",    Boolean.parseBoolean(kvMap.getOrDefault(prefix + fieldKey + ":required", def.get("required").toString())));
            f.put("field_order", Integer.parseInt(kvMap.getOrDefault(prefix + fieldKey + ":field_order", def.get("field_order").toString())));
            f.put("is_custom",   !isDefault);
            f.put("locked_visible",  isLockedVisible(formType, fieldKey));
            f.put("locked_required", isLockedRequired(formType, fieldKey));
            return f;
        })
        .sorted(Comparator.comparingInt(f -> (Integer) f.get("field_order")))
        .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("success", true, "data", fields));
    }

    // ─── PUT /api/form-settings ───────────────────────────────────────────────
    // Body: { "form": "STOCK_IN", "fields": [ { "field_key": "remarks", "visible": false, "required": false, "label": "Notes", "field_order": 8 } ] }

    @PutMapping
    public ResponseEntity<?> saveSettings(@RequestBody Map<String, Object> body) {
        auth.requirePermission("ROLES:VIEW");

        String formType = ((String) body.getOrDefault("form", "STOCK_IN")).toUpperCase();
        String prefix = formType + ":";

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fields = (List<Map<String, Object>>) body.get("fields");
        if (fields == null) return ResponseEntity.badRequest().body(Map.of("success", false, "message", "fields array required"));

        for (Map<String, Object> f : fields) {
            String fieldKey = (String) f.get("field_key");
            if (fieldKey == null) continue;

            if (Boolean.TRUE.equals(f.get("deleted"))) {
                deleteKey(prefix + fieldKey + ":visible");
                deleteKey(prefix + fieldKey + ":required");
                deleteKey(prefix + fieldKey + ":label");
                deleteKey(prefix + fieldKey + ":field_order");
                continue;
            }

            upsert(prefix + fieldKey + ":visible",     String.valueOf(f.getOrDefault("visible", true)));
            upsert(prefix + fieldKey + ":required",    String.valueOf(f.getOrDefault("required", false)));
            upsert(prefix + fieldKey + ":label",       String.valueOf(f.getOrDefault("label", fieldKey)));
            upsert(prefix + fieldKey + ":field_order", String.valueOf(f.getOrDefault("field_order", 99)));
        }

        return ResponseEntity.ok(Map.of("success", true, "message", "Form settings saved successfully"));
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private void upsert(String key, String value) {
        AppSetting s = settingRepo.findBySettingKey(key).orElse(new AppSetting(key, value));
        s.setSettingValue(value);
        settingRepo.save(s);
    }

    private void deleteKey(String key) {
        settingRepo.findBySettingKey(key).ifPresent(settingRepo::delete);
    }

    private void seedDefaults(String formType) {
        String prefix = formType + ":";
        List<Map<String, Object>> defaultFields = getDefaultFieldsForForm(formType);
        for (Map<String, Object> def : defaultFields) {
            String fieldKey = (String) def.get("field_key");
            upsert(prefix + fieldKey + ":label",       (String) def.get("label"));
            upsert(prefix + fieldKey + ":visible",     def.get("visible").toString());
            upsert(prefix + fieldKey + ":required",    def.get("required").toString());
            upsert(prefix + fieldKey + ":field_order", def.get("field_order").toString());
        }
    }

    private static final Set<String> LOCKED_STOCK_VISIBLE  = Set.of("product_id", "warehouse_id", "quantity", "transaction_date");
    private static final Set<String> LOCKED_STOCK_REQUIRED = Set.of("product_id", "warehouse_id", "quantity", "transaction_date");

    private static final Set<String> LOCKED_ORDER_VISIBLE  = Set.of("customer");
    private static final Set<String> LOCKED_ORDER_REQUIRED = Set.of("customer");

    private boolean isLockedVisible(String formType, String key)  {
        if ("ORDER".equals(formType)) {
            return LOCKED_ORDER_VISIBLE.contains(key);
        }
        return LOCKED_STOCK_VISIBLE.contains(key);
    }

    private boolean isLockedRequired(String formType, String key) {
        if ("ORDER".equals(formType)) {
            return LOCKED_ORDER_REQUIRED.contains(key);
        }
        return LOCKED_STOCK_REQUIRED.contains(key);
    }
}
