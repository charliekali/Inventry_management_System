package com.ttrims.ims;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ImsApplication {
    public static void main(String[] args) {
        String url = System.getenv("SPRING_DATASOURCE_URL");
        String blueprintHost = System.getenv("DB_HOST");
        if (url == null) {
            url = System.getProperty("spring.datasource.url");
        }
        if (url != null && url.startsWith("postgresql://")) {
            try {
                java.net.URI uri = new java.net.URI(url);
                String host = uri.getHost();
                
                if (blueprintHost != null && !blueprintHost.trim().isEmpty() && !blueprintHost.equals(host)) {
                    // Mismatch detected: cached url points to a stale host. Override with the new database details.
                    String dbPort = System.getenv("DB_PORT");
                    String dbName = System.getenv("DB_NAME");
                    String dbUser = System.getenv("SPRING_DATASOURCE_USERNAME");
                    String dbPass = System.getenv("SPRING_DATASOURCE_PASSWORD");
                    
                    String jdbcUrl = "jdbc:postgresql://" + blueprintHost + ":" + (dbPort != null ? dbPort : "5432") + "/" + (dbName != null ? dbName : "ims_db");
                    System.setProperty("spring.datasource.url", jdbcUrl);
                    if (dbUser != null) System.setProperty("spring.datasource.username", dbUser);
                    if (dbPass != null) System.setProperty("spring.datasource.password", dbPass);
                } else {
                    // Construct clean JDBC URL (without credentials)
                    String portStr = uri.getPort() != -1 ? ":" + uri.getPort() : "";
                    String path = uri.getPath();
                    String query = uri.getQuery();
                    String jdbcUrl = "jdbc:postgresql://" + host + portStr + path + (query != null ? "?" + query : "");
                    System.setProperty("spring.datasource.url", jdbcUrl);
                    
                    // Extract credentials and set them separately
                    String userInfo = uri.getUserInfo();
                    if (userInfo != null && userInfo.contains(":")) {
                        String[] parts = userInfo.split(":", 2);
                        System.setProperty("spring.datasource.username", parts[0]);
                        System.setProperty("spring.datasource.password", parts[1]);
                    }
                }
            } catch (Exception e) {
                // Fallback to simple prepending if URI parsing fails
                System.setProperty("spring.datasource.url", "jdbc:" + url);
            }
        }
        SpringApplication.run(ImsApplication.class, args);
    }
}
