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

    @org.springframework.beans.factory.annotation.Autowired
    private EcomCouponRepository ecomCouponRepo;

    @org.springframework.beans.factory.annotation.Autowired
    private EcomReviewRepository ecomReviewRepo;

    @org.springframework.beans.factory.annotation.Autowired
    private EcomOrderRepository ecomOrderRepo;

    @org.springframework.beans.factory.annotation.Autowired
    private EcomCustomerRepository ecomCustomerRepo;


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
            { "DISPATCH", "VIEW" }, { "DISPATCH", "MANAGE" },
            { "REPORTS", "VIEW" },
            { "SALES", "CRM" }, { "SALES", "COLLECT" },
            { "PRODUCTION", "PLAN" }, { "PRODUCTION", "RUN" }, { "PRODUCTION", "HISTORY" },
            { "SALES", "ADD_LEAD" }, { "SALES", "LOG_FOLLOWUP" },
            { "SALES", "LEADS" }, { "SALES", "CUSTOMERS" },
            { "ATTENDANCE", "VIEW" }, { "ATTENDANCE", "TRACK" },
            { "SHIPMENTS", "VIEW" }, { "SHIPMENTS", "CREATE" }, { "SHIPMENTS", "MANAGE" },
            { "DELIVERY", "CONFIRM" }
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
        Role logisticsRole = seedRole("Logistics Coordinator", "Manage shipments and delivery", true,
                getLogisticsPerms());
        Role driverRole = seedRole("Driver", "Assigned deliveries, locations, and proof of delivery", true,
                getDriverPerms());

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
            jdbc.execute(
                    "DELETE FROM users WHERE email IN ('manager@ttrims.com', 'keeper@ttrims.com', 'viewer@ttrims.com')");
            log.info("✨ Database purged successfully! Ready for production.");
        }

        // 2. Production Seeding
        seedUser("admin@ttrims.com", "Super Admin", "Admin@123", superAdminRole);
        seedUser("sugu@123.com", "Sugu", "123456", superAdminRole);
        seedDriverUser("driver1@ttrims.com", "Driver One", "driver1_123", driverRole, "WP-LH-4512", 9.9252, 78.1198);
        seedDriverUser("driver2@ttrims.com", "Driver Two", "driver2_123", driverRole, "WP-LH-8822", 9.9291, 78.1018);
        seedDriverUser("driver3@ttrims.com", "Driver Three", "driver3_123", driverRole, "WP-LH-1199", 9.9037, 78.1098);
        seedProductCategories();
        seedPostgresInstances();
        seedProducts();
        seedEcomDummyData();
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
            jdbc.execute(
                    "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS current_speed_kmph DOUBLE PRECISION DEFAULT 0.0");
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
            jdbc.execute(
                    "ALTER TABLE attendance_locations ADD COLUMN IF NOT EXISTS speed_kmph DOUBLE PRECISION DEFAULT 0.0");
            jdbc.execute(
                    "ALTER TABLE attendance_locations ADD COLUMN IF NOT EXISTS distance_from_last_km DOUBLE PRECISION DEFAULT 0.0");
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

        // Add wastage_quantity column to production_plan_ingredients
        try {
            jdbc.execute(
                    "ALTER TABLE production_plan_ingredients ADD COLUMN IF NOT EXISTS wastage_quantity DOUBLE PRECISION DEFAULT 0.0");
            log.info("Schema migration: wastage_quantity column in production_plan_ingredients ensured");
        } catch (Exception e) {
            log.warn("Schema migration: wastage_quantity column — {}", e.getMessage());
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
            jdbc.execute(
                    "ALTER TABLE key_logs ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'CHECKED_OUT'");
            log.info("Schema migration: added status column to key_logs if it did not exist");
        } catch (Exception e) {
            log.debug("Schema migration: key_logs status column alter query — {}", e.getMessage());
        }

        // --- Logistics Automation Schema Migrations ---
        try {
            jdbc.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS driver_status VARCHAR(30) DEFAULT 'AVAILABLE'");
            jdbc.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION");
            jdbc.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION");
            jdbc.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(100)");
            log.info("Schema migration: users columns for driver tracking ensured");
        } catch (Exception e) {
            log.warn("Schema migration users: {}", e.getMessage());
        }

        try {
            jdbc.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address VARCHAR(500)");
            jdbc.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION");
            jdbc.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION");
            log.info("Schema migration: orders columns for delivery address & GPS ensured");
        } catch (Exception e) {
            log.warn("Schema migration orders: {}", e.getMessage());
        }

        try {
            jdbc.execute("ALTER TABLE shipments ADD COLUMN IF NOT EXISTS driver_id VARCHAR(36)");
            jdbc.execute("ALTER TABLE shipments ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION DEFAULT 0.0");
            jdbc.execute("ALTER TABLE shipments ADD COLUMN IF NOT EXISTS duration_min INTEGER DEFAULT 0");
            jdbc.execute("ALTER TABLE shipments ADD COLUMN IF NOT EXISTS route_sequence TEXT");
            log.info("Schema migration: shipments columns for automated routing ensured");
        } catch (Exception e) {
            log.warn("Schema migration shipments: {}", e.getMessage());
        }

        try {
            jdbc.execute("ALTER TABLE shipment_orders ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING'");
            jdbc.execute("ALTER TABLE shipment_orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP");
            jdbc.execute("ALTER TABLE shipment_orders ADD COLUMN IF NOT EXISTS delivery_notes VARCHAR(1000)");
            jdbc.execute("ALTER TABLE shipment_orders ADD COLUMN IF NOT EXISTS delivery_photo TEXT");
            jdbc.execute("ALTER TABLE shipment_orders ADD COLUMN IF NOT EXISTS delivery_signature TEXT");
            jdbc.execute("ALTER TABLE shipment_orders ADD COLUMN IF NOT EXISTS receiver_name VARCHAR(255)");
            jdbc.execute("ALTER TABLE shipment_orders ADD COLUMN IF NOT EXISTS receiver_mobile VARCHAR(50)");
            jdbc.execute("ALTER TABLE shipment_orders ADD COLUMN IF NOT EXISTS delivery_lat DOUBLE PRECISION");
            jdbc.execute("ALTER TABLE shipment_orders ADD COLUMN IF NOT EXISTS delivery_lng DOUBLE PRECISION");
            jdbc.execute("ALTER TABLE shipment_orders ADD COLUMN IF NOT EXISTS failed_reason VARCHAR(100)");
            jdbc.execute("ALTER TABLE shipment_orders ADD COLUMN IF NOT EXISTS stop_sequence INTEGER DEFAULT 0");
            log.info("Schema migration: shipment_orders columns for proof of delivery ensured");
        } catch (Exception e) {
            log.warn("Schema migration shipment_orders: {}", e.getMessage());
        }

        try {
            jdbc.execute("ALTER TABLE products ALTER COLUMN image_url TYPE TEXT");
            jdbc.execute("ALTER TABLE products ALTER COLUMN gallery_images TYPE TEXT");
            log.info("Schema migration: products image_url and gallery_images columns altered to TEXT");
        } catch (Exception e) {
            log.warn("Schema migration products alter: {}", e.getMessage());
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
                "BOM", "DISPATCH", "REPORTS");
        Set<String> allowedActions = Set.of("VIEW", "STOCK_IN", "STOCK_OUT", "LOCATE", "CHECK_FEASIBILITY", "CREATE",
                "FULFILL", "MANAGE");
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

    private Set<Permission> getLogisticsPerms() {
        Set<Permission> perms = new HashSet<>();
        Map<String, Set<String>> allowed = Map.of(
                "DISPATCH", Set.of("VIEW", "MANAGE"),
                "SHIPMENTS", Set.of("VIEW", "CREATE", "MANAGE"),
                "DELIVERY", Set.of("CONFIRM"),
                "ORDERS", Set.of("VIEW"),
                "WAREHOUSES", Set.of("VIEW"),
                "SECTIONS", Set.of("VIEW"),
                "STOCK", Set.of("VIEW"));
        permissionRepo.findAll().forEach(p -> {
            Set<String> acts = allowed.get(p.getModule());
            if (acts != null && acts.contains(p.getAction()))
                perms.add(p);
        });
        return perms;
    }

    private Set<Permission> getDriverPerms() {
        Set<Permission> perms = new HashSet<>();
        Map<String, Set<String>> allowed = Map.of(
                "SHIPMENTS", Set.of("VIEW"),
                "DELIVERY", Set.of("CONFIRM"),
                "ORDERS", Set.of("VIEW"));
        permissionRepo.findAll().forEach(p -> {
            Set<String> acts = allowed.get(p.getModule());
            if (acts != null && acts.contains(p.getAction()))
                perms.add(p);
        });
        return perms;
    }

    private void seedDriverUser(String email, String name, String password, Role role, String vehicle, double lat,
            double lng) {
        User user = userRepo.findByEmailAndActiveTrue(email).orElse(null);
        if (user == null) {
            user = new User();
            user.setName(name);
            user.setEmail(email);
            user.setPassword(passwordEncoder.encode(password));
            user.setRole(role);
            user.setActive(true);
            user.setDriverStatus("AVAILABLE");
            user.setVehicleNumber(vehicle);
            user.setCurrentLatitude(lat);
            user.setCurrentLongitude(lng);
            userRepo.save(user);
            log.info("✅ Driver created: {} / {}", email, password);
        } else {
            user.setRole(role);
            user.setVehicleNumber(vehicle);
            user.setCurrentLatitude(lat);
            user.setCurrentLongitude(lng);
            userRepo.save(user);
            log.info("✅ Driver synced: {}", email);
        }
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
        instance.setDatabaseName("postgres");
        instance.setUsername("postgres.sergoskjjzfrdrzfieye");
        instance.setPassword("••••••••");
        instance.setRegion("Supabase Cloud (Seoul)");
        instance.setVersion("16");
        instance.setPlanOption("Free Tier (Pooled)");
        instance.setStatus("ACTIVE");
        String connectionString = System.getenv("SPRING_DATASOURCE_URL");
        if (connectionString == null) {
            connectionString = "postgresql://postgres.sergoskjjzfrdrzfieye:••••••••@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require&prepareThreshold=0";
        } else {
            // Convert jdbc:postgresql to standard postgresql connection string URI and mask
            // password for display
            connectionString = connectionString.replace("jdbc:postgresql", "postgres")
                    .replaceAll("(?<=:)[^@/:]+(?=@)", "••••••••");
        }
        instance.setConnectionString(connectionString);
        if (instance.getId() == null) {
            instance.setCreatedAt(LocalDateTime.now().minusMinutes(2));
        }
        instance.setUpdatedAt(LocalDateTime.now());
        postgresRepo.save(instance);
        log.info("✅ Seeded/Updated Postgres instance: ttrims-postgres");
    }

    private void seedProducts() {
        if (productRepo.count() == 0) {
            Product p1 = new Product();
            p1.setCode("FG-TURMERIC500");
            p1.setName("Organic Turmeric Powder");
            p1.setType(Product.Type.FINISHED_GOOD);
            p1.setUnit("PCS");
            p1.setCategory("Spices");
            p1.setSellingPrice(199.0);
            p1.setDiscountPrice(169.0);
            p1.setShowOnStorefront(true);
            p1.setPublished(true);
            p1.setBrand("TTRIMS Spices");
            p1.setShortDescription("Premium organic turmeric powder with high curcumin content.");
            p1.setWeight(500.0);
            p1.setGstPercent(5.0);
            p1.setTaxInclusive(true);
            p1.setCountryOfOrigin("India");
            p1.setShelfLife("12 Months");
            p1.setIngredients("100% Organic Turmeric Rhizomes");
            p1.setSpecifications("<ul><li>High Curcumin content (5%+)</li><li>Zero artificial additives</li><li>Gluten-free</li></ul>");
            p1.setImageUrl("https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=300");
            productRepo.save(p1);

            Product p2 = new Product();
            p2.setCode("FG-PEPPER250");
            p2.setName("Premium Black Pepper");
            p2.setType(Product.Type.FINISHED_GOOD);
            p2.setUnit("PCS");
            p2.setCategory("Spices");
            p2.setSellingPrice(299.0);
            p2.setDiscountPrice(249.0);
            p2.setShowOnStorefront(true);
            p2.setPublished(true);
            p2.setBrand("TTRIMS Spices");
            p2.setShortDescription("Freshly ground handpicked Malabar black pepper.");
            p2.setWeight(250.0);
            p2.setGstPercent(5.0);
            p2.setTaxInclusive(true);
            p2.setCountryOfOrigin("India");
            p2.setShelfLife("12 Months");
            p2.setIngredients("Premium Black Pepper Pods");
            p2.setSpecifications("<ul><li>Bold & aromatic flavor</li><li>Sorted mechanically for uniform sizing</li></ul>");
            p2.setImageUrl("https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&q=80&w=300");
            productRepo.save(p2);

            log.info("✅ Seeded initial Finished Goods products for E-Commerce Catalog");
        }
    }

    private void seedEcomDummyData() {
        if (ecomCouponRepo.count() == 0) {
            EcomCoupon c1 = new EcomCoupon();
            c1.setCode("WELCOME10");
            c1.setDiscountType("PERCENTAGE");
            c1.setDiscountValue(10.0);
            c1.setMinOrderAmount(500.0);
            c1.setValidFrom(LocalDateTime.now());
            c1.setValidTo(LocalDateTime.now().plusMonths(6));
            c1.setActive(true);
            ecomCouponRepo.save(c1);

            EcomCoupon c2 = new EcomCoupon();
            c2.setCode("FLAT100");
            c2.setDiscountType("FLAT");
            c2.setDiscountValue(100.0);
            c2.setMinOrderAmount(1000.0);
            c2.setValidFrom(LocalDateTime.now());
            c2.setValidTo(LocalDateTime.now().plusMonths(6));
            c2.setActive(true);
            ecomCouponRepo.save(c2);

            log.info("✅ Seeded initial E-Commerce Coupons");
        }

        if (ecomOrderRepo.count() == 0) {
            EcomCustomer cust = new EcomCustomer();
            cust.setName("Rohan Kumar");
            cust.setEmail("rohan@gmail.com");
            cust.setPassword(passwordEncoder.encode("123456"));
            cust.setPhone("9876543210");
            cust.setCreatedAt(LocalDateTime.now());
            ecomCustomerRepo.save(cust);

            EcomOrder o1 = new EcomOrder();
            o1.setOrderNumber("ECOM-1001");
            o1.setCustomerId(cust.getId());
            o1.setSubtotal(338.0);
            o1.setTaxAmount(16.90);
            o1.setShippingCharge(50.0);
            o1.setGrandTotal(404.90);
            o1.setPaymentMode("COD");
            o1.setPaymentStatus("PENDING");
            o1.setDeliveryAddress("12 Main St, Madurai, TN, 625001");
            o1.setStatus(EcomOrder.Status.PLACED);
            o1.setItems("[{\"name\":\"Organic Turmeric Powder\",\"quantity\":2,\"price\":169.0}]");
            o1.setCreatedAt(LocalDateTime.now().minusHours(3));
            ecomOrderRepo.save(o1);

            EcomOrder o2 = new EcomOrder();
            o2.setOrderNumber("ECOM-1002");
            o2.setCustomerId(cust.getId());
            o2.setSubtotal(199.0);
            o2.setTaxAmount(9.95);
            o2.setShippingCharge(50.0);
            o2.setGrandTotal(258.95);
            o2.setPaymentMode("ONLINE");
            o2.setPaymentStatus("PAID");
            o2.setDeliveryAddress("Apartment 4B, Anna Nagar, Chennai, TN, 600040");
            o2.setStatus(EcomOrder.Status.DELIVERED);
            o2.setItems("[{\"name\":\"Premium Black Pepper\",\"quantity\":1,\"price\":199.0}]");
            o2.setCreatedAt(LocalDateTime.now().minusDays(1));
            ecomOrderRepo.save(o2);

            log.info("✅ Seeded initial E-Commerce Orders");
        }

        if (ecomReviewRepo.count() == 0) {
            String customerId = "dummy-customer-id";
            List<EcomCustomer> customers = ecomCustomerRepo.findAll();
            if (!customers.isEmpty()) {
                customerId = customers.get(0).getId();
            } else {
                EcomCustomer cust = new EcomCustomer();
                cust.setName("Rohan Kumar");
                cust.setEmail("rohan@gmail.com");
                cust.setPassword(passwordEncoder.encode("123456"));
                cust.setPhone("9876543210");
                cust.setCreatedAt(LocalDateTime.now());
                ecomCustomerRepo.save(cust);
                customerId = cust.getId();
            }

            EcomReview r1 = new EcomReview();
            r1.setProductId("seeded-id");
            r1.setCustomerId(customerId);
            r1.setCustomerName("Rohan K.");
            r1.setRating(5);
            r1.setTitle("Amazing Turmeric!");
            r1.setComment("Very fresh and aromatic. Curcumin percentage is clearly high. Fully satisfied!");
            r1.setCreatedAt(LocalDateTime.now().minusHours(2));
            ecomReviewRepo.save(r1);

            EcomReview r2 = new EcomReview();
            r2.setProductId("seeded-id-2");
            r2.setCustomerId(customerId);
            r2.setCustomerName("Priya S.");
            r2.setRating(4);
            r2.setTitle("Great Pepper");
            r2.setComment("Sorted pepper pods with nice flavor. Good packaging.");
            r2.setCreatedAt(LocalDateTime.now().minusHours(5));
            ecomReviewRepo.save(r2);

            log.info("✅ Seeded initial E-Commerce Customer Reviews");
        }
    }

}
