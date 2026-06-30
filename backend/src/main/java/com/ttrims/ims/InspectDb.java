package com.ttrims.ims;

import java.sql.*;

public class InspectDb {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://dpg-d8in6lcvikkc73c1l780-a.virginia-postgres.render.com:5432/ims_db_z4x7?sslmode=require";
        String user = "ims_db_z4x7_user";
        String pass = "OXuCjVeOESq1tooj37MjWfRXUvuPgg5k";

        try (Connection conn = DriverManager.getConnection(url, user, pass)) {
            System.out.println("Connected to Render database!");

            // 1. Print products table columns
            System.out.println("\n--- Columns in 'products' table ---");
            DatabaseMetaData meta = conn.getMetaData();
            try (ResultSet rs = meta.getColumns(null, null, "products", null)) {
                while (rs.next()) {
                    String columnName = rs.getString("COLUMN_NAME");
                    String typeName = rs.getString("TYPE_NAME");
                    int columnSize = rs.getInt("COLUMN_SIZE");
                    String isNullable = rs.getString("IS_NULLABLE");
                    System.out.printf("Column: %s, Type: %s(%d), Nullable: %s%n", columnName, typeName, columnSize, isNullable);
                }
            }

            // 2. Print products table constraints or indexes
            System.out.println("\n--- Indexes/Constraints on 'products' table ---");
            try (ResultSet rs = meta.getIndexInfo(null, null, "products", false, false)) {
                while (rs.next()) {
                    String indexName = rs.getString("INDEX_NAME");
                    String columnName = rs.getString("COLUMN_NAME");
                    boolean nonUnique = rs.getBoolean("NON_UNIQUE");
                    System.out.printf("Index: %s, Column: %s, Unique: %b%n", indexName, columnName, !nonUnique);
                }
            }

            // 3. Print triggers on 'products' table
            System.out.println("\n--- Triggers on 'products' table ---");
            String query = "SELECT tgname FROM pg_trigger WHERE tgrelid = 'products'::regclass";
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery(query)) {
                while (rs.next()) {
                    System.out.println("Trigger: " + rs.getString("tgname"));
                }
            }

            // 4. Drop check constraint
            System.out.println("\n--- Dropping products_type_check constraint ---");
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("ALTER TABLE products DROP CONSTRAINT IF EXISTS products_type_check");
                System.out.println("Constraint products_type_check dropped successfully (or did not exist)!");
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
