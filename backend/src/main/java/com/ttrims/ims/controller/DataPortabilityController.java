package com.ttrims.ims.controller;

import com.ttrims.ims.service.AuthHelper;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSetMetaData;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/data-portability")
public class DataPortabilityController {

    private final JdbcTemplate jdbcTemplate;
    private final AuthHelper auth;

    public DataPortabilityController(JdbcTemplate jdbcTemplate, AuthHelper auth) {
        this.jdbcTemplate = jdbcTemplate;
        this.auth = auth;
    }

    /**
     * Helper to check if a table name is safe and exists in the public schema.
     */
    private boolean isSafeTableName(String tableName) {
        if (tableName == null || !tableName.matches("^[a-zA-Z0-9_]+$")) {
            return false;
        }
        List<String> tables = getPublicTables();
        return tables.contains(tableName.toLowerCase());
    }

    private List<String> getPublicTables() {
        String sql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'";
        return jdbcTemplate.queryForList(sql, String.class).stream()
                .map(String::toLowerCase)
                .collect(Collectors.toList());
    }

    /**
     * GET /api/data-portability/tables
     * Returns a list of all tables with their row counts.
     */
    @GetMapping("/tables")
    public ResponseEntity<?> listTables() {
        auth.requirePermission("ROLES:VIEW");
        List<String> tableNames = getPublicTables();
        List<Map<String, Object>> result = new ArrayList<>();

        for (String name : tableNames) {
            // Exclude flyway or database migration tables if any
            if (name.startsWith("flyway") || name.startsWith("schema_version")) {
                continue;
            }
            try {
                Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + name, Long.class);
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("name", name);
                map.put("rowCount", count != null ? count : 0);
                result.add(map);
            } catch (Exception e) {
                // Ignore tables that can't be queried
            }
        }

        // Sort by table name
        result.sort(Comparator.comparing(m -> m.get("name").toString()));

        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    /**
     * GET /api/data-portability/export/{tableName}
     * Exports a table to CSV.
     */
    @GetMapping("/export/{tableName}")
    public ResponseEntity<?> exportTable(@PathVariable String tableName) {
        auth.requirePermission("ROLES:VIEW");
        if (!isSafeTableName(tableName)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid or unsafe table name"));
        }

        try {
            StringWriter writer = new StringWriter();
            jdbcTemplate.query("SELECT * FROM " + tableName, rs -> {
                ResultSetMetaData metaData = rs.getMetaData();
                int columnCount = metaData.getColumnCount();

                // Write Header
                for (int i = 1; i <= columnCount; i++) {
                    writer.write(escapeCsv(metaData.getColumnName(i)));
                    if (i < columnCount) writer.write(",");
                }
                writer.write("\n");

                // Write Rows
                while (rs.next()) {
                    for (int i = 1; i <= columnCount; i++) {
                        Object val = rs.getObject(i);
                        String strVal = "";
                        if (val != null) {
                            if (val instanceof byte[]) {
                                strVal = new String((byte[]) val, StandardCharsets.UTF_8);
                            } else {
                                strVal = val.toString();
                            }
                        }
                        writer.write(escapeCsv(strVal));
                        if (i < columnCount) writer.write(",");
                    }
                    writer.write("\n");
                }
                return null;
            });

            byte[] csvBytes = writer.toString().getBytes(StandardCharsets.UTF_8);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("text/csv"));
            headers.setContentDispositionFormData("attachment", tableName + "_export.csv");
            headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

            return new ResponseEntity<>(csvBytes, headers, HttpStatus.OK);

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", "Failed to export table: " + e.getMessage()));
        }
    }

    /**
     * GET /api/data-portability/template/{tableName}
     * Generates a blank CSV template with only the column headers.
     */
    @GetMapping("/template/{tableName}")
    public ResponseEntity<?> getTemplate(@PathVariable String tableName) {
        auth.requirePermission("ROLES:VIEW");
        if (!isSafeTableName(tableName)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid or unsafe table name"));
        }

        try {
            List<Map<String, Object>> columnsMetadata = jdbcTemplate.queryForList(
                    "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? ORDER BY ordinal_position",
                    tableName.toLowerCase()
            );
            List<Map<String, Object>> filteredColumns = columnsMetadata.stream()
                    .filter(m -> {
                        String col = m.get("column_name").toString().toLowerCase();
                        return !Arrays.asList("id", "created_at", "updated_at", "created_by", "updated_by").contains(col);
                    })
                    .collect(Collectors.toList());

            String header = filteredColumns.stream()
                    .map(m -> m.get("column_name").toString())
                    .map(this::escapeCsv)
                    .collect(Collectors.joining(","));

            String demoData = filteredColumns.stream()
                    .map(m -> {
                        String type = m.get("data_type").toString().toLowerCase();
                        String colName = m.get("column_name").toString().toLowerCase();
                        if (type.contains("int") || type.contains("numeric") || type.contains("double")) {
                            return "1";
                        } else if (type.contains("date") || type.contains("timestamp")) {
                            return "2023-01-01 10:00:00";
                        } else if (type.contains("bool")) {
                            return "true";
                        } else {
                            return "Sample " + colName;
                        }
                    })
                    .map(this::escapeCsv)
                    .collect(Collectors.joining(","));

            byte[] csvBytes = (header + "\n" + demoData + "\n").getBytes(StandardCharsets.UTF_8);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("text/csv"));
            headers.setContentDispositionFormData("attachment", tableName + "_template.csv");
            headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

            return new ResponseEntity<>(csvBytes, headers, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", "Failed to generate template: " + e.getMessage()));
        }
    }

    /**
     * POST /api/data-portability/import/{tableName}
     * Imports data from a CSV file into the table.
     */
    @PostMapping("/import/{tableName}")
    @Transactional
    public ResponseEntity<?> importTable(@PathVariable String tableName, @RequestParam("file") MultipartFile file) {
        auth.requirePermission("ROLES:VIEW");
        if (!isSafeTableName(tableName)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid or unsafe table name"));
        }

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Please upload a non-empty CSV file"));
        }

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String headerLine = reader.readLine();
            if (headerLine == null) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "CSV file is empty"));
            }

            List<String> csvHeaders = parseCsvLine(headerLine);
            if (csvHeaders.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "No columns found in CSV header"));
            }

            // Get actual columns of the table to prevent injecting invalid columns
            List<Map<String, Object>> columnsMetadata = jdbcTemplate.queryForList(
                    "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ?",
                    tableName.toLowerCase()
            );
            Set<String> validColumns = columnsMetadata.stream()
                    .map(m -> m.get("column_name").toString().toLowerCase())
                    .collect(Collectors.toSet());

            // Map CSV headers to valid columns
            List<String> matchedColumns = new ArrayList<>();
            List<Integer> matchedIndices = new ArrayList<>();
            for (int i = 0; i < csvHeaders.size(); i++) {
                String header = csvHeaders.get(i).trim().toLowerCase();
                if (validColumns.contains(header)) {
                    matchedColumns.add(header);
                    matchedIndices.add(i);
                }
            }

            if (matchedColumns.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "No matching columns found between CSV and database table"));
            }

            boolean hasIdColumn = matchedColumns.contains("id");
            String sql;
            if (hasIdColumn) {
                // Build UPSERT query: INSERT ... ON CONFLICT (id) DO UPDATE SET ...
                String columnsList = String.join(", ", matchedColumns);
                String placeholders = matchedColumns.stream().map(c -> "?").collect(Collectors.joining(", "));
                String updateSet = matchedColumns.stream()
                        .filter(c -> !c.equals("id"))
                        .map(c -> c + " = EXCLUDED." + c)
                        .collect(Collectors.joining(", "));

                if (updateSet.isEmpty()) {
                    // Only id column exists
                    sql = String.format("INSERT INTO %s (%s) VALUES (%s) ON CONFLICT (id) DO NOTHING", tableName, columnsList, placeholders);
                } else {
                    sql = String.format("INSERT INTO %s (%s) VALUES (%s) ON CONFLICT (id) DO UPDATE SET %s", tableName, columnsList, placeholders, updateSet);
                }
            } else {
                // Simple INSERT
                String columnsList = String.join(", ", matchedColumns);
                String placeholders = matchedColumns.stream().map(c -> "?").collect(Collectors.joining(", "));
                sql = String.format("INSERT INTO %s (%s) VALUES (%s)", tableName, columnsList, placeholders);
            }

            String line;
            int importedCount = 0;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) continue;
                List<String> values = parseCsvLine(line);
                
                boolean isDemoData = false;
                for (int i = 0; i < matchedColumns.size(); i++) {
                    int csvIndex = matchedIndices.get(i);
                    String val = csvIndex < values.size() ? values.get(csvIndex) : null;
                    if (val != null && val.equals("Sample " + matchedColumns.get(i))) {
                        isDemoData = true;
                        break;
                    }
                }
                if (isDemoData) {
                    continue;
                }

                Object[] params = new Object[matchedColumns.size()];

                for (int i = 0; i < matchedColumns.size(); i++) {
                    int csvIndex = matchedIndices.get(i);
                    String val = csvIndex < values.size() ? values.get(csvIndex) : null;
                    
                    // Handle empty/null values
                    if (val == null || val.trim().isEmpty()) {
                        params[i] = null;
                    } else {
                        params[i] = val;
                    }
                }

                jdbcTemplate.update(sql, params);
                importedCount++;
            }

            return ResponseEntity.ok(Map.of("success", true, "message", String.format("Successfully imported %d rows into %s", importedCount, tableName)));

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", "Failed to import data: " + e.getMessage()));
        }
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        String escaped = value.replace("\"", "\"\"");
        if (escaped.contains(",") || escaped.contains("\n") || escaped.contains("\r") || escaped.contains("\"")) {
            return "\"" + escaped + "\"";
        }
        return escaped;
    }

    private List<String> parseCsvLine(String line) {
        List<String> result = new ArrayList<>();
        boolean inQuotes = false;
        StringBuilder sb = new StringBuilder();

        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    sb.append('"'); // escaped quote
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                result.add(sb.toString());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        result.add(sb.toString());
        return result;
    }
}
