# syntax=docker/dockerfile:1
# ---- build -------------------------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM eclipse-temurin:24-jdk AS build
WORKDIR /workspace
# Dependencies first, so source changes do not re-download them.
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN --mount=type=cache,target=/root/.m2 ./mvnw -q -B dependency:go-offline
COPY src src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -q -B -DskipTests package && mv target/*.jar app.jar

# ---- runtime -----------------------------------------------------------------------------------------
FROM eclipse-temurin:25-jre-alpine
# Unprivileged user; /data/images is where uploaded images live (mount a volume here).
RUN addgroup -S app && adduser -S -G app -u 10001 app \
 && mkdir -p /data/images && chown app:app /data/images
ENV IMAGE_DIR=/data/images
VOLUME /data/images
USER app
WORKDIR /app
COPY --from=build --chown=app:app /workspace/app.jar app.jar
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=40s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/actuator/health | grep -q '"status":"UP"' || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
