package com.ttrims.ims;

import java.sql.*;

public class InspectStock {
    public static void main(String[] args) {
        String url = System.getenv("SPRING_DATASOURCE_URL");
        if (url == null) {
            url = "jdbc:postgresql://aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require&prepareThreshold=0";
        }
        String user = System.getenv("SPRING_DATASOURCE_USERNAME");
        if (user == null) {
            user = "postgres.sergoskjjzfrdrzfieye";
        }
        String pass = System.getenv("SPRING_DATASOURCE_PASSWORD");
        if (pass == null) {
            pass = "W0N4i4sBP613kz37";
        }

        try (Connection conn = DriverManager.getConnection(url, user, pass)) {
            System.out.println("Connected to database: " + url);

            // 1. Print all products
            System.out.println("\n--- All Products ---");
            String prodQuery = "SELECT id, name, code, type, is_active FROM products";
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery(prodQuery)) {
                System.out.printf("%-36s | %-20s | %-10s | %-15s | %-6s%n", "ID", "Name", "Code", "Type", "Active");
                System.out.println("------------------------------------------------------------------------------------------------");
                while (rs.next()) {
                    System.out.printf("%-36s | %-20s | %-10s | %-15s | %-6b%n",
                        rs.getString("id"), rs.getString("name"), rs.getString("code"), rs.getString("type"), rs.getBoolean("is_active"));
                }
            }

            // 2. Print all BOM records
            System.out.println("\n--- All BOM Records ---");
            String bomQuery = "SELECT b.id, fg.name as fg_name, fg.code as fg_code, rm.id as rm_id, rm.name as rm_name, rm.code as rm_code, b.qty_required " +
                              "FROM bom b " +
                              "JOIN products fg ON b.finished_good_id = fg.id " +
                              "JOIN products rm ON b.raw_material_id = rm.id";
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery(bomQuery)) {
                System.out.printf("%-20s (%-6s) -> %-20s (%-6s) | Qty: %-10s | RM ID: %s%n", "Finished Good", "Code", "Raw Material", "Code", "Qty", "RM ID");
                System.out.println("-------------------------------------------------------------------------------------------------------------------------");
                while (rs.next()) {
                    System.out.printf("%-20s (%-6s) -> %-20s (%-6s) | Qty: %-10.2f | RM ID: %s%n",
                        rs.getString("fg_name"), rs.getString("fg_code"),
                        rs.getString("rm_name"), rs.getString("rm_code"),
                        rs.getDouble("qty_required"), rs.getString("rm_id"));
                }
            }

            // 3. Print all stock balances
            System.out.println("\n--- All Stock Balances ---");
            String stockQuery = "SELECT sb.id, p.id as p_id, p.name, p.code, w.name as wh_name, sb.quantity, sb.locked_quantity " +
                                "FROM stock_balance sb " +
                                "JOIN products p ON sb.product_id = p.id " +
                                "JOIN warehouses w ON sb.warehouse_id = w.id";
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery(stockQuery)) {
                System.out.printf("%-20s | %-10s | %-15s | %-10s | %-10s | Product ID%n", "Product Name", "Code", "Warehouse", "Quantity", "Locked", "Product ID");
                System.out.println("-------------------------------------------------------------------------------------------------------------------------");
                while (rs.next()) {
                    String name = rs.getString("name");
                    String code = rs.getString("code");
                    String wh = rs.getString("wh_name");
                    double qty = rs.getDouble("quantity");
                    double locked = rs.getDouble("locked_quantity");
                    boolean wasNull = rs.wasNull();
                    System.out.printf("%-20s | %-10s | %-15s | %-10.2f | %-10s | %s%n", 
                        name, code, wh, qty, wasNull ? "NULL" : String.format("%.2f", locked), rs.getString("p_id"));
                }
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
