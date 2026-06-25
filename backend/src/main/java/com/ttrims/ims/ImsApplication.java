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
            System.setProperty("spring.datasource.url", "jdbc:" + url);
        }
        SpringApplication.run(ImsApplication.class, args);
    }
}
