package com.ttrims.ims;

import java.sql.*;

public class InspectStock {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://dpg-d8in6lcvikkc73c1l780-a.virginia-postgres.render.com:5432/ims_db_z4x7?sslmode=require";
        String user = "ims_db_z4x7_user";
        String pass = "OXuCjVeOESq1tooj37MjWfRXUvuPgg5k";

        try (Connection conn = DriverManager.getConnection(url, user, pass)) {
            System.out.println("Connected to Render database!");

            String query = "SELECT sb.id, p.name, p.code, w.name as wh_name, sb.quantity, sb.locked_quantity " +
                           "FROM stock_balance sb " +
                           "JOIN products p ON sb.product_id = p.id " +
                           "JOIN warehouses w ON sb.warehouse_id = w.id";
            
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery(query)) {
                System.out.printf("%-20s | %-10s | %-15s | %-10s | %-15s%n", "Product Name", "Code", "Warehouse", "Quantity", "Locked Qty");
                System.out.println("-----------------------------------------------------------------------------------------");
                while (rs.next()) {
                    String name = rs.getString("name");
                    String code = rs.getString("code");
                    String wh = rs.getString("wh_name");
                    double qty = rs.getDouble("quantity");
                    double locked = rs.getDouble("locked_quantity");
                    boolean wasNull = rs.wasNull();
                    System.out.printf("%-20s | %-10s | %-15s | %-10.2f | %-15s%n", 
                        name, code, wh, qty, wasNull ? "NULL" : String.format("%.2f", locked));
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
