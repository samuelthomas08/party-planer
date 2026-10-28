package app.partyplaner;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Entry point of the Party Planer API (Spring Boot). */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class PartyPlanerApplication {

    public static void main(String[] args) {
        SpringApplication.run(PartyPlanerApplication.class, args);
    }
}
