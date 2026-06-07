package com.ttrims.ims.config;

import com.ttrims.ims.entity.*;
import com.ttrims.ims.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final PermissionRepository permissionRepo;
    private final RoleRepository roleRepo;
    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;
    private final ProductCategoryRepository categoryRepo;

    public DataSeeder(PermissionRepository permissionRepo,
                      RoleRepository roleRepo,
                      UserRepository userRepo,
                      PasswordEncoder passwordEncoder,
                      ProductCategoryRepository categoryRepo) {
        this.permissionRepo = permissionRepo;
        this.roleRepo = roleRepo;
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
        this.categoryRepo = categoryRepo;
    }

    private static final String[][] PERMISSION_DEFS = {
        {"USERS","VIEW"},{"USERS","CREATE"},{"USERS","EDIT"},{"USERS","DELETE"},
        {"ROLES","VIEW"},{"ROLES","CREATE"},{"ROLES","EDIT"},{"ROLES","DELETE"},
        {"WAREHOUSES","VIEW"},{"WAREHOUSES","CREATE"},{"WAREHOUSES","EDIT"},{"WAREHOUSES","DELETE"},
        {"SECTIONS","VIEW"},{"SECTIONS","CREATE"},{"SECTIONS","EDIT"},{"SECTIONS","DELETE"},
        {"PRODUCTS","VIEW"},{"PRODUCTS","CREATE"},{"PRODUCTS","EDIT"},{"PRODUCTS","DELETE"},
        {"TRANSACTIONS","VIEW"},{"TRANSACTIONS","STOCK_IN"},{"TRANSACTIONS","STOCK_OUT"},
        {"STOCK","VIEW"},{"STOCK","LOCATE"},
        {"ORDERS","VIEW"},{"ORDERS","CREATE"},{"ORDERS","EDIT"},{"ORDERS","CHECK_FEASIBILITY"},
        {"BOM","VIEW"},{"BOM","CREATE"},{"BOM","EDIT"},{"BOM","DELETE"},
        {"REPORTS","VIEW"}
    };

    @Override
    @Transactional
    public void run(String... args) {
        seedPermissions();
        Role superAdminRole = seedRole("Super Admin", "Full system access", true, getAllPermissions());
        seedRole("Viewer", "Read-only access", true, getPermsByAction("VIEW"));
        seedRole("Warehouse Manager", "Stock transactions and reports", true, getWMPerms());
        seedRole("Store Keeper", "Handle stock IN/OUT", true, getStoreKeeperPerms());
        seedSuperAdmin(superAdminRole);
        seedProductCategories();
    }

    private void seedPermissions() {
        for (String[] def : PERMISSION_DEFS) {
            String name = def[0] + ":" + def[1];
            if (!permissionRepo.existsByName(name)) {
                Permission perm = new Permission();
                perm.setName(name);
                perm.setModule(def[0]);
                perm.setAction(def[1]);
                permissionRepo.save(perm);
                log.info("Created permission: {}", name);
            }
        }
    }

    private Role seedRole(String name, String desc, boolean system, Set<Permission> perms) {
        Role role = roleRepo.findByName(name).orElse(null);
        if (role == null) {
            role = new Role();
            role.setName(name);
            role.setDescription(desc);
            role.setSystem(system);
            role.setPermissions(perms);
            roleRepo.save(role);
            log.info("Created role: {}", name);
        } else {
            role.setPermissions(perms);
            roleRepo.save(role);
            log.info("Synced/Updated permissions for role: {}", name);
        }
        return role;
    }

    private Set<Permission> getAllPermissions() {
        return new HashSet<>(permissionRepo.findAll());
    }

    private Set<Permission> getPermsByAction(String action) {
        Set<Permission> perms = new HashSet<>();
        permissionRepo.findAll().forEach(p -> { if (p.getAction().equals(action)) perms.add(p); });
        return perms;
    }

    private Set<Permission> getWMPerms() {
        Set<Permission> perms = new HashSet<>();
        Set<String> allowedModules = Set.of("WAREHOUSES","SECTIONS","PRODUCTS","TRANSACTIONS","STOCK","ORDERS","BOM","REPORTS");
        Set<String> allowedActions = Set.of("VIEW","STOCK_IN","STOCK_OUT","LOCATE","CHECK_FEASIBILITY","CREATE");
        permissionRepo.findAll().forEach(p -> {
            if (allowedModules.contains(p.getModule()) && allowedActions.contains(p.getAction())) perms.add(p);
        });
        return perms;
    }

    private Set<Permission> getStoreKeeperPerms() {
        Set<Permission> perms = new HashSet<>();
        Map<String, Set<String>> allowed = Map.of(
            "TRANSACTIONS", Set.of("VIEW","STOCK_IN","STOCK_OUT"),
            "STOCK", Set.of("VIEW","LOCATE"),
            "PRODUCTS", Set.of("VIEW"),
            "WAREHOUSES", Set.of("VIEW"),
            "SECTIONS", Set.of("VIEW")
        );
        permissionRepo.findAll().forEach(p -> {
            Set<String> acts = allowed.get(p.getModule());
            if (acts != null && acts.contains(p.getAction())) perms.add(p);
        });
        return perms;
    }

    private void seedSuperAdmin(Role superAdminRole) {
        User user = userRepo.findByEmailAndActiveTrue("admin@ttrims.com").orElse(null);
        if (user == null) {
            user = new User();
            user.setName("Super Admin");
            user.setEmail("admin@ttrims.com");
            user.setPassword(passwordEncoder.encode("Admin@123"));
            user.setRole(superAdminRole);
            user.setActive(true);
            userRepo.save(user);
            log.info("✅ Super Admin created: admin@ttrims.com / Admin@123");
        } else {
            user.setRole(superAdminRole);
            userRepo.save(user);
            log.info("✅ Super Admin role synced for: admin@ttrims.com");
        }
    }

    private static final String[][] DEFAULT_CATEGORIES = {
        // { categoryName, subcategoryName, sortOrder }
        {"Masala & Blends", "Whole Masala",    "1"},
        {"Masala & Blends", "Ground Masala",   "2"},
        {"Masala & Blends", "Blended Masala",  "3"},
        {"Masala & Blends", "Curry Powder",    "4"},
        {"Masala & Blends", "Biryani Masala",  "5"},
        {"Masala & Blends", "Garam Masala",    "6"},
        {"Spices",          "Whole Spice",     "1"},
        {"Spices",          "Ground Spice",    "2"},
        {"Spices",          "Chilli",          "3"},
        {"Spices",          "Pepper",          "4"},
        {"Spices",          "Turmeric",        "5"},
        {"Spices",          "Coriander",       "6"},
        {"Spices",          "Cumin",           "7"},
        {"Spices",          "Cardamom",        "8"},
        {"Spices",          "Cloves",          "9"},
        {"Spices",          "Cinnamon",        "10"},
        {"Spices",          "Fenugreek",       "11"},
        {"Spices",          "Mustard Seed",    "12"},
        {"Herbs & Aromatics", "Dried Herb",   "1"},
        {"Herbs & Aromatics", "Bay Leaf",     "2"},
        {"Herbs & Aromatics", "Curry Leaf",   "3"},
        {"Packaging & Other", "Packaging Material", "1"},
        {"Packaging & Other", "Salt & Seasoning",   "2"},
        {"Packaging & Other", "Food Additive",       "3"},
        {"Packaging & Other", "Other",               "4"},
    };

    private void seedProductCategories() {
        int seeded = 0;
        for (String[] row : DEFAULT_CATEGORIES) {
            String cat = row[0], sub = row[1];
            int order = Integer.parseInt(row[2]);
            if (!categoryRepo.existsByCategoryNameAndSubcategoryName(cat, sub)) {
                categoryRepo.save(new ProductCategory(cat, sub, order));
                seeded++;
            }
        }
        if (seeded > 0) log.info("✅ Seeded {} product categories/subcategories", seeded);
    }
}
