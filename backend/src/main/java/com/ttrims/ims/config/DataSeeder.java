package com.ttrims.ims.config;

import com.ttrims.ims.entity.*;
import com.ttrims.ims.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.*;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final PermissionRepository permissionRepo;
    private final RoleRepository roleRepo;
    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;
    private final ProductCategoryRepository categoryRepo;
    private final PostgresInstanceRepository postgresRepo;
    private final ProductRepository productRepo;
    private final BomRepository bomRepo;
    private final WarehouseRepository warehouseRepo;
    private final SectionRepository sectionRepo;
    private final StockBalanceRepository balanceRepo;
    private final JdbcTemplate jdbc;

    public DataSeeder(PermissionRepository permissionRepo,
            RoleRepository roleRepo,
            UserRepository userRepo,
            PasswordEncoder passwordEncoder,
            ProductCategoryRepository categoryRepo,
            PostgresInstanceRepository postgresRepo,
            ProductRepository productRepo,
            BomRepository bomRepo,
            WarehouseRepository warehouseRepo,
            SectionRepository sectionRepo,
            StockBalanceRepository balanceRepo,
            JdbcTemplate jdbc) {
        this.permissionRepo = permissionRepo;
        this.roleRepo = roleRepo;
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
        this.categoryRepo = categoryRepo;
        this.postgresRepo = postgresRepo;
        this.productRepo = productRepo;
        this.bomRepo = bomRepo;
        this.warehouseRepo = warehouseRepo;
        this.sectionRepo = sectionRepo;
        this.balanceRepo = balanceRepo;
        this.jdbc = jdbc;
    }

    private static final String[][] PERMISSION_DEFS = {
            { "USERS", "VIEW" }, { "USERS", "CREATE" }, { "USERS", "EDIT" }, { "USERS", "DELETE" },
            { "ROLES", "VIEW" }, { "ROLES", "CREATE" }, { "ROLES", "EDIT" }, { "ROLES", "DELETE" },
            { "WAREHOUSES", "VIEW" }, { "WAREHOUSES", "CREATE" }, { "WAREHOUSES", "EDIT" }, { "WAREHOUSES", "DELETE" },
            { "SECTIONS", "VIEW" }, { "SECTIONS", "CREATE" }, { "SECTIONS", "EDIT" }, { "SECTIONS", "DELETE" },
            { "PRODUCTS", "VIEW" }, { "PRODUCTS", "CREATE" }, { "PRODUCTS", "EDIT" }, { "PRODUCTS", "DELETE" },
            { "TRANSACTIONS", "VIEW" }, { "TRANSACTIONS", "STOCK_IN" }, { "TRANSACTIONS", "STOCK_OUT" },
            { "STOCK", "VIEW" }, { "STOCK", "LOCATE" },
            { "ORDERS", "VIEW" }, { "ORDERS", "CREATE" }, { "ORDERS", "EDIT" }, { "ORDERS", "CHECK_FEASIBILITY" },
            { "ORDERS", "FULFILL" },
            { "PRODUCTION_ORDERS", "VIEW" }, { "PRODUCTION_ORDERS", "CREATE" }, { "PRODUCTION_ORDERS", "EDIT" },
            { "BOM", "VIEW" }, { "BOM", "CREATE" }, { "BOM", "EDIT" }, { "BOM", "DELETE" },
            { "REPORTS", "VIEW" },
            { "SALES", "CRM" }, { "SALES", "COLLECT" },
            { "PRODUCTION", "RUN" }, { "PRODUCTION", "HISTORY" },
            { "SALES", "ADD_LEAD" }, { "SALES", "LOG_FOLLOWUP" },
            { "SALES", "LEADS" }, { "SALES", "CUSTOMERS" },
            { "ATTENDANCE", "VIEW" }, { "ATTENDANCE", "TRACK" }
    };

    @Override
    @Transactional
    public void run(String... args) {
        runSchemaMigrations();
        seedPermissions();
        Role superAdminRole = seedRole("Super Admin", "Full system access", true, getAllPermissions());
        Role viewerRole = seedRole("Viewer", "Read-only access", true, getPermsByAction("VIEW"));
        Role managerRole = seedRole("Warehouse Manager", "Stock transactions and reports", true, getWMPerms());
        Role keeperRole = seedRole("Store Keeper", "Handle stock IN/OUT", true, getStoreKeeperPerms());
        
        // 1. One-time database purge of all dummy/test data for production readiness
        if (productRepo.findByCode("RM-CHD").isPresent()) {
            log.info("🧹 Dummy data detected! Performing a one-time database purge for production readiness...");
            jdbc.execute("DELETE FROM payment_transactions");
            jdbc.execute("DELETE FROM order_follow_ups");
            jdbc.execute("DELETE FROM order_items");
            jdbc.execute("DELETE FROM orders");
            jdbc.execute("DELETE FROM production_order_items");
            jdbc.execute("DELETE FROM production_orders");
            jdbc.execute("DELETE FROM stock_transactions");
            jdbc.execute("DELETE FROM stock_balance");
            jdbc.execute("DELETE FROM bom");
            jdbc.execute("DELETE FROM products");
            jdbc.execute("DELETE FROM sections");
            jdbc.execute("DELETE FROM warehouses");
            jdbc.execute("DELETE FROM users WHERE email IN ('manager@ttrims.com', 'keeper@ttrims.com', 'viewer@ttrims.com')");
            log.info("✨ Database purged successfully! Ready for production.");
        }

        // 2. Production Seeding
        seedUser("admin@ttrims.com", "Super Admin", "Admin@123", superAdminRole);
        seedUser("sugu@123.com", "Sugu", "123456", superAdminRole);
        seedProductCategories();
        seedPostgresInstances();
    }

    // ─── Schema Migrations ────────────────────────────────────────────────────
    // Drop stale columns left over from the single-product ProductionOrder schema.
    // IF EXISTS makes each statement idempotent — safe to re-run on every startup.
    private void runSchemaMigrations() {
        String[][] drops = {
                // Old single-product columns no longer in the entity
                { "production_orders", "quantity" },
                { "production_orders", "unit" },
                { "production_orders", "product_id" },
        };
        for (String[] drop : drops) {
            try {
                jdbc.execute("ALTER TABLE " + drop[0] + " DROP COLUMN IF EXISTS " + drop[1]);
                log.info("Schema migration: dropped column {}.{} (if existed)", drop[0], drop[1]);
            } catch (Exception e) {
                log.warn("Schema migration: could not drop {}.{} — {}", drop[0], drop[1], e.getMessage());
            }
        }

        // Create attendance tables if they don't already exist (idempotent)
        try {
            jdbc.execute(
                "CREATE TABLE IF NOT EXISTS attendance (" +
                "  id VARCHAR(36) PRIMARY KEY, " +
                "  user_id VARCHAR(36) NOT NULL, " +
                "  user_name VARCHAR(255), " +
                "  user_email VARCHAR(255), " +
                "  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', " +
                "  clock_in_at TIMESTAMP, " +
                "  clock_out_at TIMESTAMP, " +
                "  last_lat DOUBLE PRECISION, " +
                "  last_lng DOUBLE PRECISION, " +
                "  last_ping_at TIMESTAMP, " +
                "  ping_count INTEGER DEFAULT 0, " +
                "  created_at TIMESTAMP" +
                ")");
            log.info("Schema migration: attendance table ensured");
        } catch (Exception e) {
            log.warn("Schema migration: attendance table — {}", e.getMessage());
        }

        try {
            jdbc.execute("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION DEFAULT 0.0");
            jdbc.execute("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS current_speed_kmph DOUBLE PRECISION DEFAULT 0.0");
            log.info("Schema migration: attendance distance and speed columns ensured");
        } catch (Exception e) {
            log.warn("Schema migration: attendance columns — {}", e.getMessage());
        }

        try {
            jdbc.execute(
                "CREATE TABLE IF NOT EXISTS attendance_locations (" +
                "  id VARCHAR(36) PRIMARY KEY, " +
                "  attendance_id VARCHAR(36) NOT NULL, " +
                "  latitude DOUBLE PRECISION NOT NULL, " +
                "  longitude DOUBLE PRECISION NOT NULL, " +
                "  accuracy DOUBLE PRECISION, " +
                "  recorded_at TIMESTAMP" +
                ")");
            log.info("Schema migration: attendance_locations table ensured");
        } catch (Exception e) {
            log.warn("Schema migration: attendance_locations table — {}", e.getMessage());
        }

        try {
            jdbc.execute("ALTER TABLE attendance_locations ADD COLUMN IF NOT EXISTS speed_kmph DOUBLE PRECISION DEFAULT 0.0");
            jdbc.execute("ALTER TABLE attendance_locations ADD COLUMN IF NOT EXISTS distance_from_last_km DOUBLE PRECISION DEFAULT 0.0");
            log.info("Schema migration: attendance_locations speed and distance columns ensured");
        } catch (Exception e) {
            log.warn("Schema migration: attendance_locations columns — {}", e.getMessage());
        }

        // Drop status check constraint to support PARTIAL status
        try {
            jdbc.execute("ALTER TABLE production_orders DROP CONSTRAINT IF EXISTS production_orders_status_check");
            log.info("Schema migration: dropped constraint production_orders_status_check (if existed)");
        } catch (Exception e) {
            log.warn("Schema migration: could not drop constraint production_orders_status_check — {}", e.getMessage());
        }

        // Key Registry tables
        try {
            jdbc.execute(
                "CREATE TABLE IF NOT EXISTS factory_keys (" +
                "  id VARCHAR(36) PRIMARY KEY, " +
                "  name VARCHAR(255) NOT NULL, " +
                "  description VARCHAR(500), " +
                "  key_number VARCHAR(100), " +
                "  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE', " +
                "  created_at TIMESTAMP, " +
                "  updated_at TIMESTAMP" +
                ")");
            log.info("Schema migration: factory_keys table ensured");
        } catch (Exception e) {
            log.warn("Schema migration: factory_keys table — {}", e.getMessage());
        }

        try {
            jdbc.execute(
                "CREATE TABLE IF NOT EXISTS key_logs (" +
                "  id VARCHAR(36) PRIMARY KEY, " +
                "  key_id VARCHAR(36) NOT NULL, " +
                "  key_name VARCHAR(255), " +
                "  key_number VARCHAR(100), " +
                "  taken_by_id VARCHAR(36), " +
                "  taken_by_name VARCHAR(255) NOT NULL, " +
                "  taken_by_email VARCHAR(255), " +
                "  reason TEXT NOT NULL, " +
                "  taken_at TIMESTAMP NOT NULL, " +
                "  returned_at TIMESTAMP, " +
                "  return_notes TEXT, " +
                "  recorded_by_id VARCHAR(36), " +
                "  recorded_by_name VARCHAR(255), " +
                "  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_CHECKOUT', " +
                "  created_at TIMESTAMP" +
                ")");
            log.info("Schema migration: key_logs table ensured");
        } catch (Exception e) {
            log.warn("Schema migration: key_logs table — {}", e.getMessage());
        }

        try {
            jdbc.execute("ALTER TABLE key_logs ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'CHECKED_OUT'");
            log.info("Schema migration: added status column to key_logs if it did not exist");
        } catch (Exception e) {
            log.debug("Schema migration: key_logs status column alter query — {}", e.getMessage());
        }
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
        permissionRepo.findAll().forEach(p -> {
            if (p.getAction().equals(action))
                perms.add(p);
        });
        return perms;
    }

    private Set<Permission> getWMPerms() {
        Set<Permission> perms = new HashSet<>();
        Set<String> allowedModules = Set.of("WAREHOUSES", "SECTIONS", "PRODUCTS", "TRANSACTIONS", "STOCK", "ORDERS",
                "BOM", "REPORTS");
        Set<String> allowedActions = Set.of("VIEW", "STOCK_IN", "STOCK_OUT", "LOCATE", "CHECK_FEASIBILITY", "CREATE",
                "FULFILL");
        permissionRepo.findAll().forEach(p -> {
            if (allowedModules.contains(p.getModule()) && allowedActions.contains(p.getAction()))
                perms.add(p);
        });
        return perms;
    }

    private Set<Permission> getStoreKeeperPerms() {
        Set<Permission> perms = new HashSet<>();
        Map<String, Set<String>> allowed = Map.of(
                "TRANSACTIONS", Set.of("VIEW", "STOCK_IN", "STOCK_OUT"),
                "STOCK", Set.of("VIEW", "LOCATE"),
                "PRODUCTS", Set.of("VIEW"),
                "WAREHOUSES", Set.of("VIEW"),
                "SECTIONS", Set.of("VIEW"));
        permissionRepo.findAll().forEach(p -> {
            Set<String> acts = allowed.get(p.getModule());
            if (acts != null && acts.contains(p.getAction()))
                perms.add(p);
        });
        return perms;
    }

    private void seedUser(String email, String name, String password, Role role) {
        User user = userRepo.findByEmailAndActiveTrue(email).orElse(null);
        if (user == null) {
            user = new User();
            user.setName(name);
            user.setEmail(email);
            user.setPassword(passwordEncoder.encode(password));
            user.setRole(role);
            user.setActive(true);
            userRepo.save(user);
            log.info("✅ User created: {} / {}", email, password);
        } else {
            user.setRole(role);
            userRepo.save(user);
            log.info("✅ User role synced for: {}", email);
        }
    }

    private static final String[][] DEFAULT_CATEGORIES = {
            // { categoryName, subcategoryName, sortOrder }
            { "Masala & Blends", "Whole Masala", "1" },
            { "Masala & Blends", "Ground Masala", "2" },
            { "Masala & Blends", "Blended Masala", "3" },
            { "Masala & Blends", "Curry Powder", "4" },
            { "Masala & Blends", "Biryani Masala", "5" },
            { "Masala & Blends", "Garam Masala", "6" },
            { "Spices", "Whole Spice", "1" },
            { "Spices", "Ground Spice", "2" },
            { "Spices", "Chilli", "3" },
            { "Spices", "Pepper", "4" },
            { "Spices", "Turmeric", "5" },
            { "Spices", "Coriander", "6" },
            { "Spices", "Cumin", "7" },
            { "Spices", "Cardamom", "8" },
            { "Spices", "Cloves", "9" },
            { "Spices", "Cinnamon", "10" },
            { "Spices", "Fenugreek", "11" },
            { "Spices", "Mustard Seed", "12" },
            { "Herbs & Aromatics", "Dried Herb", "1" },
            { "Herbs & Aromatics", "Bay Leaf", "2" },
            { "Herbs & Aromatics", "Curry Leaf", "3" },
            { "Packaging & Other", "Packaging Material", "1" },
            { "Packaging & Other", "Salt & Seasoning", "2" },
            { "Packaging & Other", "Food Additive", "3" },
            { "Packaging & Other", "Other", "4" },
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
        if (seeded > 0)
            log.info("✅ Seeded {} product categories/subcategories", seeded);
    }

    private void seedPostgresInstances() {
        PostgresInstance instance = postgresRepo.findByName("ttrims-postgres").orElse(new PostgresInstance());
        instance.setName("ttrims-postgres");
        instance.setDatabaseName("ims_db_z4x7");
        instance.setUsername("ims_db_z4x7_user");
        instance.setPassword("OXuCjVeOESq1tooj37MjWfRXUvuPgg5k");
        instance.setRegion("Virginia (US East)");
        instance.setVersion("17");
        instance.setPlanOption("Hobby");
        instance.setStatus("ACTIVE");
        instance.setConnectionString("postgres://avnadmin:AVNS_ybK9qHZdRnPrWSH-aRC@pg-1168d9e5-sudrs007-d282.b.aivencloud.com:13913/defaultdb?sslmode=require");
        if (instance.getId() == null) {
            instance.setCreatedAt(LocalDateTime.now().minusMinutes(2));
        }
        instance.setUpdatedAt(LocalDateTime.now());
        postgresRepo.save(instance);
        log.info("✅ Seeded/Updated Render Postgres instance: ttrims-postgres");
    }


}
