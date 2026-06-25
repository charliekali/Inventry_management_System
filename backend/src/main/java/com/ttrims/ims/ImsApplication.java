package com.ttrims.ims;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ImsApplication {
    public static void main(String[] args) {
        String url = System.getenv("SPRING_DATASOURCE_URL");
        if (url == null) {
            url = System.getProperty("spring.datasource.url");
        }
        if (url != null && url.startsWith("postgresql://")) {
            try {
                java.net.URI uri = new java.net.URI(url);
                String host = uri.getHost();
                int port = uri.getPort();
                String path = uri.getPath();
                String query = uri.getQuery();
                
                // Construct clean JDBC URL (without credentials)
                String jdbcUrl = "jdbc:postgresql://" + host + (port != -1 ? ":" + port : "") + path + (query != null ? "?" + query : "");
                System.setProperty("spring.datasource.url", jdbcUrl);
                
                // Extract credentials and set them separately
                String userInfo = uri.getUserInfo();
                if (userInfo != null && userInfo.contains(":")) {
                    String[] parts = userInfo.split(":", 2);
                    System.setProperty("spring.datasource.username", parts[0]);
                    System.setProperty("spring.datasource.password", parts[1]);
                }
            } catch (Exception e) {
                // Fallback to simple prepending if URI parsing fails
                System.setProperty("spring.datasource.url", "jdbc:" + url);
            }
        }
        SpringApplication.run(ImsApplication.class, args);
    }
}
