package com.ttrims.ims.controller;

import com.ttrims.ims.service.AuthHelper;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
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

    @GetMapping("/tables")
    public ResponseEntity<?> listTables() {
        auth.requirePermission("ROLES:VIEW");
        List<String> tableNames = getPublicTables();
        List<Map<String, Object>> result = new ArrayList<>();

        for (String name : tableNames) {
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
            }
        }
        result.sort(Comparator.comparing(m -> m.get("name").toString()));
        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    @GetMapping("/export/{tableName}")
    public ResponseEntity<?> exportTable(@PathVariable String tableName) {
        auth.requirePermission("ROLES:VIEW");
        if (!isSafeTableName(tableName)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid or unsafe table name"));
        }

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Export");
            
            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFillForegroundColor(IndexedColors.PALE_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            jdbcTemplate.query("SELECT * FROM " + tableName, rs -> {
                try {
                    ResultSetMetaData metaData = rs.getMetaData();
                    int columnCount = metaData.getColumnCount();

                    Row headerRow = sheet.createRow(0);
                    for (int i = 1; i <= columnCount; i++) {
                        Cell cell = headerRow.createCell(i - 1);
                        cell.setCellValue(metaData.getColumnName(i));
                        cell.setCellStyle(headerStyle);
                    }

                    int rowIndex = 1;
                    while (rs.next()) {
                        Row row = sheet.createRow(rowIndex++);
                        for (int i = 1; i <= columnCount; i++) {
                            Object val = rs.getObject(i);
                            Cell cell = row.createCell(i - 1);
                            if (val != null) {
                                if (val instanceof Number) {
                                    cell.setCellValue(((Number) val).doubleValue());
                                } else if (val instanceof Boolean) {
                                    cell.setCellValue((Boolean) val);
                                } else if (val instanceof byte[]) {
                                    cell.setCellValue(new String((byte[]) val, StandardCharsets.UTF_8));
                                } else {
                                    cell.setCellValue(val.toString());
                                }
                            }
                        }
                    }
                    
                    for (int i = 1; i <= columnCount; i++) {
                        sheet.autoSizeColumn(i - 1);
                    }
                } catch (Exception ex) {
                    throw new RuntimeException(ex);
                }
                return null;
            });

            workbook.write(baos);
            byte[] excelBytes = baos.toByteArray();
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment", tableName + "_export.xlsx");
            headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

            return new ResponseEntity<>(excelBytes, headers, HttpStatus.OK);

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", "Failed to export table: " + e.getMessage()));
        }
    }

    @GetMapping("/template/{tableName}")
    public ResponseEntity<?> getTemplate(@PathVariable String tableName) {
        auth.requirePermission("ROLES:VIEW");
        if (!isSafeTableName(tableName)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid or unsafe table name"));
        }

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Template");

            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

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

            Map<String, String> refDataRangeMap = new HashMap<>();
            Map<String, String> refDataDemoMap = new HashMap<>();
            
            Sheet refSheet = workbook.createSheet("_RefData");
            workbook.setSheetHidden(workbook.getSheetIndex(refSheet), true);
            
            if (filteredColumns.stream().anyMatch(c -> c.get("column_name").toString().toLowerCase().equals("product_id") || c.get("column_name").toString().toLowerCase().equals("raw_material_id"))) {
                List<String> list = new ArrayList<>();
                try {
                    jdbcTemplate.query("SELECT id, code, name FROM products", rs -> {
                        list.add(rs.getString("id") + " - [" + rs.getString("code") + "] " + rs.getString("name"));
                    });
                } catch(Exception e) {}
                if (!list.isEmpty()) {
                    int col = refDataRangeMap.size();
                    for (int i=0; i<list.size(); i++) {
                        Row r = refSheet.getRow(i); if (r==null) r=refSheet.createRow(i);
                        r.createCell(col).setCellValue(list.get(i));
                    }
                    String colLetter = org.apache.poi.ss.util.CellReference.convertNumToColString(col);
                    refDataRangeMap.put("product", "_RefData!$" + colLetter + "$1:$" + colLetter + "$" + list.size());
                    refDataDemoMap.put("product", list.get(0));
                }
            }

            if (filteredColumns.stream().anyMatch(c -> c.get("column_name").toString().toLowerCase().equals("warehouse_id"))) {
                List<String> list = new ArrayList<>();
                try {
                    jdbcTemplate.query("SELECT id, name FROM warehouses", rs -> {
                        list.add(rs.getString("id") + " - " + rs.getString("name"));
                    });
                } catch(Exception e) {}
                if (!list.isEmpty()) {
                    int col = refDataRangeMap.size();
                    for (int i=0; i<list.size(); i++) {
                        Row r = refSheet.getRow(i); if (r==null) r=refSheet.createRow(i);
                        r.createCell(col).setCellValue(list.get(i));
                    }
                    String colLetter = org.apache.poi.ss.util.CellReference.convertNumToColString(col);
                    refDataRangeMap.put("warehouse", "_RefData!$" + colLetter + "$1:$" + colLetter + "$" + list.size());
                    refDataDemoMap.put("warehouse", list.get(0));
                }
            }

            if (filteredColumns.stream().anyMatch(c -> c.get("column_name").toString().toLowerCase().equals("section_id"))) {
                List<String> list = new ArrayList<>();
                try {
                    jdbcTemplate.query("SELECT id, name FROM warehouse_sections", rs -> {
                        list.add(rs.getString("id") + " - " + rs.getString("name"));
                    });
                } catch(Exception e) {}
                if (!list.isEmpty()) {
                    int col = refDataRangeMap.size();
                    for (int i=0; i<list.size(); i++) {
                        Row r = refSheet.getRow(i); if (r==null) r=refSheet.createRow(i);
                        r.createCell(col).setCellValue(list.get(i));
                    }
                    String colLetter = org.apache.poi.ss.util.CellReference.convertNumToColString(col);
                    refDataRangeMap.put("section", "_RefData!$" + colLetter + "$1:$" + colLetter + "$" + list.size());
                    refDataDemoMap.put("section", list.get(0));
                }
            }

            Row headerRow = sheet.createRow(0);
            
            Cell seqHeader = headerRow.createCell(0);
            seqHeader.setCellValue("# (Seq)");
            seqHeader.setCellStyle(headerStyle);

            int colIdx = 1;
            for (Map<String, Object> m : filteredColumns) {
                Cell cell = headerRow.createCell(colIdx++);
                cell.setCellValue(m.get("column_name").toString());
                cell.setCellStyle(headerStyle);
            }

            Cell mathHeader = headerRow.createCell(colIdx);
            mathHeader.setCellValue("Demo Math");
            mathHeader.setCellStyle(headerStyle);

            Row demoRow = sheet.createRow(1);
            demoRow.createCell(0).setCellFormula("ROW()-1");

            colIdx = 1;
            DataValidationHelper validationHelper = sheet.getDataValidationHelper();
            for (Map<String, Object> m : filteredColumns) {
                Cell cell = demoRow.createCell(colIdx);
                String type = m.get("data_type").toString().toLowerCase();
                String colName = m.get("column_name").toString().toLowerCase();
                
                if (colName.equals("product_id") || colName.equals("raw_material_id")) {
                    String range = refDataRangeMap.get("product");
                    if (range != null) {
                        try {
                            CellRangeAddressList addressList = new CellRangeAddressList(1, 1000, colIdx, colIdx);
                            DataValidationConstraint constraint = validationHelper.createFormulaListConstraint(range);
                            DataValidation validation = validationHelper.createValidation(constraint, addressList);
                            validation.setShowErrorBox(true);
                            sheet.addValidationData(validation);
                            cell.setCellValue(refDataDemoMap.get("product"));
                        } catch (Exception ex) {}
                    } else {
                        cell.setCellValue("Sample " + colName);
                    }
                } else if (colName.equals("warehouse_id")) {
                    String range = refDataRangeMap.get("warehouse");
                    if (range != null) {
                        try {
                            CellRangeAddressList addressList = new CellRangeAddressList(1, 1000, colIdx, colIdx);
                            DataValidationConstraint constraint = validationHelper.createFormulaListConstraint(range);
                            DataValidation validation = validationHelper.createValidation(constraint, addressList);
                            validation.setShowErrorBox(true);
                            sheet.addValidationData(validation);
                            cell.setCellValue(refDataDemoMap.get("warehouse"));
                        } catch (Exception ex) {}
                    } else {
                        cell.setCellValue("Sample " + colName);
                    }
                } else if (colName.equals("section_id")) {
                    String range = refDataRangeMap.get("section");
                    if (range != null) {
                        try {
                            CellRangeAddressList addressList = new CellRangeAddressList(1, 1000, colIdx, colIdx);
                            DataValidationConstraint constraint = validationHelper.createFormulaListConstraint(range);
                            DataValidation validation = validationHelper.createValidation(constraint, addressList);
                            validation.setShowErrorBox(true);
                            sheet.addValidationData(validation);
                            cell.setCellValue(refDataDemoMap.get("section"));
                        } catch (Exception ex) {}
                    } else {
                        cell.setCellValue("Sample " + colName);
                    }
                } else if (type.contains("bool")) {
                    cell.setCellValue("TRUE");
                    try {
                        CellRangeAddressList addressList = new CellRangeAddressList(1, 1000, colIdx, colIdx);
                        DataValidationConstraint constraint = validationHelper.createExplicitListConstraint(new String[]{"TRUE", "FALSE"});
                        DataValidation validation = validationHelper.createValidation(constraint, addressList);
                        validation.setShowErrorBox(true);
                        sheet.addValidationData(validation);
                    } catch (Exception ex) {
                        // Ignore validation error on some environments
                    }
                } else if (type.contains("int") || type.contains("numeric") || type.contains("double")) {
                    cell.setCellValue(1.0);
                } else if (type.contains("date") || type.contains("timestamp")) {
                    cell.setCellValue("2023-01-01 10:00:00");
                } else {
                    cell.setCellValue("Sample " + colName);
                }
                colIdx++;
            }

            demoRow.createCell(colIdx).setCellFormula("SUM(B2:C2)");

            for (int i = 0; i <= colIdx; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(baos);
            byte[] excelBytes = baos.toByteArray();
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment", tableName + "_template.xlsx");
            headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

            return new ResponseEntity<>(excelBytes, headers, HttpStatus.OK);

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", "Failed to generate template: " + e.getMessage()));
        }
    }

    @PostMapping("/import/{tableName}")
    @Transactional
    public ResponseEntity<?> importTable(@PathVariable String tableName, @RequestParam("file") MultipartFile file) {
        auth.requirePermission("ROLES:VIEW");
        if (!isSafeTableName(tableName)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid or unsafe table name"));
        }

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Please upload a non-empty file"));
        }

        try (InputStream is = file.getInputStream(); XSSFWorkbook workbook = new XSSFWorkbook(is)) {
            Sheet sheet = workbook.getSheetAt(0);
            Iterator<Row> rowIterator = sheet.iterator();

            if (!rowIterator.hasNext()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "File is empty"));
            }

            Row headerRow = rowIterator.next();
            List<String> excelHeaders = new ArrayList<>();
            for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                Cell cell = headerRow.getCell(i);
                excelHeaders.add(getCellValueAsString(cell).trim().toLowerCase());
            }

            List<Map<String, Object>> columnsMetadata = jdbcTemplate.queryForList(
                    "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ?",
                    tableName.toLowerCase()
            );
            Set<String> validColumns = columnsMetadata.stream()
                    .map(m -> m.get("column_name").toString().toLowerCase())
                    .collect(Collectors.toSet());

            List<String> matchedColumns = new ArrayList<>();
            List<Integer> matchedIndices = new ArrayList<>();
            for (int i = 0; i < excelHeaders.size(); i++) {
                String header = excelHeaders.get(i);
                if (validColumns.contains(header) && !header.equals("id")) {
                    matchedColumns.add(header);
                    matchedIndices.add(i);
                }
            }

            if (matchedColumns.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "No matching columns found between Excel and database table"));
            }

            String columnsList = String.join(", ", matchedColumns);
            String placeholders = matchedColumns.stream().map(c -> "?").collect(Collectors.joining(", "));
            String sql = String.format("INSERT INTO %s (%s) VALUES (%s)", tableName, columnsList, placeholders);

            int importedCount = 0;
            while (rowIterator.hasNext()) {
                Row row = rowIterator.next();
                
                boolean isDemoData = false;
                for (int i = 0; i < matchedColumns.size(); i++) {
                    int csvIndex = matchedIndices.get(i);
                    String val = getCellValueAsString(row.getCell(csvIndex));
                    if (val != null && val.equals("Sample " + matchedColumns.get(i))) {
                        isDemoData = true;
                        break;
                    }
                }
                
                if (isDemoData) {
                    continue;
                }

                Object[] params = new Object[matchedColumns.size()];
                boolean hasData = false;
                
                for (int i = 0; i < matchedColumns.size(); i++) {
                    int csvIndex = matchedIndices.get(i);
                    String val = getCellValueAsString(row.getCell(csvIndex));
                    
                    if (val == null || val.trim().isEmpty()) {
                        params[i] = null;
                    } else {
                        if (matchedColumns.get(i).endsWith("_id") && val.contains(" - ")) {
                            val = val.split(" - ")[0].trim();
                        }
                        params[i] = val;
                        hasData = true;
                    }
                }
                
                if (hasData) {
                    jdbcTemplate.update(sql, params);
                    importedCount++;
                }
            }

            return ResponseEntity.ok(Map.of("success", true, "message", String.format("Successfully imported %d rows into %s", importedCount, tableName)));

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", "Failed to import data: " + e.getMessage()));
        }
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null) return "";
        switch (cell.getCellType()) {
            case STRING: return cell.getStringCellValue();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getLocalDateTimeCellValue().toString();
                }
                double d = cell.getNumericCellValue();
                if (d == (long) d) {
                    return String.valueOf((long) d);
                }
                return String.valueOf(d);
            case BOOLEAN: return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                switch (cell.getCachedFormulaResultType()) {
                    case NUMERIC: return String.valueOf(cell.getNumericCellValue());
                    case STRING: return cell.getStringCellValue();
                    case BOOLEAN: return String.valueOf(cell.getBooleanCellValue());
                    default: return "";
                }
            default: return "";
        }
    }
}
