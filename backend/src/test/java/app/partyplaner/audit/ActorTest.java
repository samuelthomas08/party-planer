package app.partyplaner.audit;

import static org.assertj.core.api.Assertions.assertThat;

import app.partyplaner.common.CurrentUser;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class ActorTest {

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private Jwt jwt(UUID subject, String name, String typ) {
        Jwt.Builder b = Jwt.withTokenValue("t").header("alg", "none").subject(subject.toString()).issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60));
        if (name != null) b.claim("name", name);
        if (typ != null) b.claim("typ", typ);
        return b.build();
    }

    private void authenticate(Jwt jwt) {
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(new JwtAuthenticationToken(jwt));
        SecurityContextHolder.setContext(ctx);
    }

    @Test
    void outsideARequestTheSystemIsTheActor() {
        assertThat(Actor.current()).isEqualTo(Actor.system());
        assertThat(Actor.system().type()).isEqualTo("SYSTEM");
    }

    @Test
    void aUserTokenYieldsAUserActor() {
        UUID id = UUID.randomUUID();
        authenticate(jwt(id, "Ada", null));

        assertThat(Actor.current()).isEqualTo(new Actor(id, "Ada", "USER"));
    }

    @Test
    void aGuestTokenYieldsAGuestActor() {
        UUID id = UUID.randomUUID();
        authenticate(jwt(id, "Gina", "guest"));

        assertThat(Actor.current().type()).isEqualTo("GUEST");
    }

    @Test
    void aMissingNameDoesNotCrash() {
        authenticate(jwt(UUID.randomUUID(), null, null));

        assertThat(Actor.current().name()).isEqualTo("?");
    }

    @Test
    void currentUserReadsTheSubject() {
        UUID id = UUID.randomUUID();

        assertThat(CurrentUser.id(jwt(id, "x", null))).isEqualTo(id);
    }
}
