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
            { "SALES", "LEADS" }, { "SALES", "CUSTOMERS" }
    };

    @Override
    @Transactional
    public void run(String... args) {
        runSchemaMigrations();
        seedPermissions();
        Role superAdminRole = seedRole("Super Admin", "Full system access", true, getAllPermissions());
        seedRole("Viewer", "Read-only access", true, getPermsByAction("VIEW"));
        seedRole("Warehouse Manager", "Stock transactions and reports", true, getWMPerms());
        seedRole("Store Keeper", "Handle stock IN/OUT", true, getStoreKeeperPerms());
        seedSuperAdmin(superAdminRole);
        seedProductCategories();
        seedPostgresInstances();
        seedBusinessData();
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

        // Drop status check constraint to support PARTIAL status
        try {
            jdbc.execute("ALTER TABLE production_orders DROP CONSTRAINT IF EXISTS production_orders_status_check");
            log.info("Schema migration: dropped constraint production_orders_status_check (if existed)");
        } catch (Exception e) {
            log.warn("Schema migration: could not drop constraint production_orders_status_check — {}", e.getMessage());
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

    private void seedBusinessData() {
        // 1. Seed Warehouses
        Warehouse cwh = warehouseRepo.findByActiveTrueOrderByName().stream()
                .filter(w -> "Central Warehouse".equals(w.getName()))
                .findFirst()
                .orElse(null);
        if (cwh == null) {
            cwh = new Warehouse();
            cwh.setName("Central Warehouse");
            cwh.setLocation("Graining Section Block A");
            cwh.setActive(true);
            cwh = warehouseRepo.save(cwh);
            log.info("Created warehouse: Central Warehouse");
        }

        // 2. Seed Sections
        Warehouse finalCwh = cwh;
        Section grn = sectionRepo.findByWarehouseId(cwh.getId()).stream()
                .filter(s -> "Graining Section".equals(s.getName()))
                .findFirst()
                .orElse(null);
        if (grn == null) {
            grn = new Section();
            grn.setWarehouse(cwh);
            grn.setName("Graining Section");
            grn.setDescription("Section for grinding and blending bulk spices");
            grn.setActive(true);
            grn = sectionRepo.save(grn);
            log.info("Created section: Graining Section");
        }

        Section rss = sectionRepo.findByWarehouseId(cwh.getId()).stream()
                .filter(s -> "Raw Spice Store".equals(s.getName()))
                .findFirst()
                .orElse(null);
        if (rss == null) {
            rss = new Section();
            rss.setWarehouse(cwh);
            rss.setName("Raw Spice Store");
            rss.setDescription("Storage for unprocessed raw spices");
            rss.setActive(true);
            rss = sectionRepo.save(rss);
            log.info("Created section: Raw Spice Store");
        }

        // 3. Seed Raw Materials
        Product rmChd = seedProduct("RM-CHD", "Chilli Powder Raw", Product.Type.RAW_MATERIAL, "PCS", null, null, null,
                "Raw whole chilli ground to powder form", "Spices");
        Product rmCrd = seedProduct("RM-CRD", "Coriander Seeds Raw", Product.Type.RAW_MATERIAL, "PCS", null, null, null,
                "Raw coriander seeds whole", "Spices");
        Product rmCum = seedProduct("RM-CUM", "Cumin Seeds Raw", Product.Type.RAW_MATERIAL, "PCS", null, null, null,
                "Raw cumin seeds whole", "Spices");
        Product rmTrm = seedProduct("RM-TRM", "Turmeric Raw", Product.Type.RAW_MATERIAL, "PCS", null, null, null,
                "Raw turmeric whole", "Spices");
        Product rmBlk = seedProduct("RM-BLK", "Black Pepper Raw", Product.Type.RAW_MATERIAL, "PCS", null, null, null,
                "Raw black pepper whole", "Spices");
        Product rmPch = seedProduct("RM-PCH", "100g Pouch", Product.Type.RAW_MATERIAL, "PCS", null, null, null,
                "Packaging pouch 100g size", "Packaging & Other");

        // 4. Seed Finished Goods
        Product fgGm100 = seedProduct("FG-GM100", "Garam Masala 100g", Product.Type.FINISHED_GOOD, "PCS", 100.0, 10.0,
                50.0, "Grind raw whole spices, blend, and pack in 100g pouches.", "Masala & Blends");
        Product fgCm100 = seedProduct("FG-CM100", "Chicken Masala 100g", Product.Type.FINISHED_GOOD, "PCS", 100.0, 10.0,
                50.0, "Dry roast spices, grind, blend with salt, and pack.", "Masala & Blends");

        // 5. Seed BOMs
        // Garam Masala 100g ingredients (for 1 KG of Finished Good)
        seedBom(fgGm100, rmChd, 0.2, "PCS", Bom.ProductionStep.GRINDING, 20.0, "Dry chili ground");
        seedBom(fgGm100, rmCrd, 0.3, "PCS", Bom.ProductionStep.ROASTING, 30.0, "Roast and grind coriander");
        seedBom(fgGm100, rmCum, 0.2, "PCS", Bom.ProductionStep.ROASTING, 20.0, "Roast and grind cumin");
        seedBom(fgGm100, rmTrm, 0.2, "PCS", Bom.ProductionStep.CLEANING, 20.0, "Clean and grind turmeric");
        seedBom(fgGm100, rmBlk, 0.1, "PCS", Bom.ProductionStep.GRINDING, 10.0, "Grind black pepper");
        seedBom(fgGm100, rmPch, 10.0, "PCS", Bom.ProductionStep.PACKING, 0.0, "Pack in 100g pouches");

        // Chicken Masala 100g ingredients (for 1 KG of Finished Good)
        seedBom(fgCm100, rmChd, 0.4, "PCS", Bom.ProductionStep.GRINDING, 40.0, "Chili powder");
        seedBom(fgCm100, rmCrd, 0.3, "PCS", Bom.ProductionStep.ROASTING, 30.0, "Coriander seeds");
        seedBom(fgCm100, rmCum, 0.15, "PCS", Bom.ProductionStep.ROASTING, 15.0, "Cumin seeds");
        seedBom(fgCm100, rmTrm, 0.15, "PCS", Bom.ProductionStep.CLEANING, 15.0, "Turmeric powder");
        seedBom(fgCm100, rmPch, 10.0, "PCS", Bom.ProductionStep.PACKING, 0.0, "Pack in 100g pouches");

        // 6. Seed Stock Balances
        seedStock(rmChd, cwh, rss, 200.0);
        seedStock(rmCrd, cwh, rss, 150.0);
        seedStock(rmCum, cwh, rss, 180.0);
        seedStock(rmTrm, cwh, rss, 120.0);
        seedStock(rmBlk, cwh, rss, 50.0);
        seedStock(rmPch, cwh, rss, 3000.0);

        seedStock(fgGm100, cwh, grn, 20.0);
        seedStock(fgCm100, cwh, grn, 15.0);
    }

    private Product seedProduct(String code, String name, Product.Type type, String unit, Double packSizeG,
            Double packsPerKg, Double batchSizeKg, String description, String category) {
        Product p = productRepo.findByCodeAndActiveTrue(code).orElse(null);
        if (p == null) {
            p = new Product();
            p.setCode(code);
            p.setName(name);
            p.setType(type);
            p.setUnit(unit);
            p.setPackSizeG(packSizeG);
            p.setPacksPerKg(packsPerKg);
            p.setBatchSizeKg(batchSizeKg);
            p.setDescription(description);
            p.setCategory(category);
            p.setActive(true);
            p = productRepo.save(p);
            log.info("Created product: {}", code);
        } else {
            p.setUnit(unit);
            p = productRepo.save(p);
            log.info("Updated product unit: {}", code);
        }
        return p;
    }

    private void seedBom(Product fg, Product rm, double qty, String unit, Bom.ProductionStep step, double blendPct,
            String notes) {
        List<Bom> boms = bomRepo.findByFinishedGood(fg);
        Bom bom = boms.stream().filter(b -> b.getRawMaterial().getId().equals(rm.getId())).findFirst().orElse(null);
        if (bom == null) {
            bom = new Bom();
            bom.setFinishedGood(fg);
            bom.setRawMaterial(rm);
            bom.setQtyRequired(qty);
            bom.setUnit(unit);
            bom.setProductionStep(step);
            bom.setBlendPct(blendPct);
            bom.setNotes(notes);
            bomRepo.save(bom);
            log.info("Added BOM line: {} -> {}", fg.getCode(), rm.getCode());
        } else {
            bom.setUnit(unit);
            bom.setQtyRequired(qty);
            bomRepo.save(bom);
            log.info("Updated BOM line unit/qty: {} -> {}", fg.getCode(), rm.getCode());
        }
    }

    private void seedStock(Product p, Warehouse w, Section s, double qty) {
        StockBalance bal = balanceRepo.findByProductAndWarehouseAndSection(p, w, s).orElse(null);
        if (bal == null) {
            bal = new StockBalance();
            bal.setProduct(p);
            bal.setWarehouse(w);
            bal.setSection(s);
            bal.setQuantity(qty);
            balanceRepo.save(bal);
            log.info("Seeded stock: {} at {}/{} = {}", p.getCode(), w.getName(), s.getName(), qty);
        }
    }
}
