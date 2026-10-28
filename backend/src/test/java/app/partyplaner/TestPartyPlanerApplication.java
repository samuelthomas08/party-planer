package app.partyplaner;

import org.springframework.boot.SpringApplication;

public class TestPartyPlanerApplication {

	public static void main(String[] args) {
		SpringApplication.from(PartyPlanerApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
