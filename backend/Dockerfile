# Stage 1: Build Java backend application
FROM maven:3.9.6-eclipse-temurin-21-alpine AS builder
WORKDIR /build
COPY pom.xml .
# Cache maven dependencies
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Create lightweight running container
FROM eclipse-temurin:21-jre-alpine
# Create a non-root user and group
RUN addgroup -S ims && adduser -S ims -G ims
USER ims
WORKDIR /app
COPY --from=builder --chown=ims:ims /build/target/*.jar app.jar
EXPOSE 5000
ENTRYPOINT ["java", "-jar", "app.jar"]
