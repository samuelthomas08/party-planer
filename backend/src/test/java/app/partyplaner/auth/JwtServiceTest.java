package app.partyplaner.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.partyplaner.TestProps;
import app.partyplaner.user.Role;
import app.partyplaner.user.User;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.test.util.ReflectionTestUtils;

class JwtServiceTest {

    private final JwtService service = new JwtService(TestProps.props());

    private NimbusJwtDecoder decoder(String secret) {
        NimbusJwtDecoder d = NimbusJwtDecoder.withSecretKey(
                new javax.crypto.spec.SecretKeySpec(secret.getBytes(), "HmacSHA256")).macAlgorithm(MacAlgorithm.HS256).build();
        d.setJwtValidator(JwtValidators.createDefaultWithIssuer("test-issuer"));
        return d;
    }

    private User user(Role role) {
        User u = new User("a@b.de", "hash", "Ada", role);
        ReflectionTestUtils.setField(u, "id", UUID.randomUUID());
        return u;
    }

    @Test
    void accessTokenCarriesSubjectRoleNameAndAShortLifetime() {
        User user = user(Role.ADMIN);

        Jwt jwt = decoder(TestProps.SECRET).decode(service.issueAccessToken(user));

        assertThat(jwt.getSubject()).isEqualTo(user.getId().toString());
        assertThat(jwt.getClaimAsString("role")).isEqualTo("ADMIN");
        assertThat(jwt.getClaimAsString("name")).isEqualTo("Ada");
        assertThat(jwt.getClaimAsString("typ")).isNull();
        assertThat(Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt())).isEqualTo(Duration.ofMinutes(15));
    }

    @Test
    void guestTokenIsMarkedAsGuestAndNamesExactlyOneShareAndPlace() {
        UUID guest = UUID.randomUUID();
        UUID share = UUID.randomUUID();
        UUID place = UUID.randomUUID();

        Jwt jwt = decoder(TestProps.SECRET).decode(
                service.issueGuestToken(guest, "Gina", share, place, Instant.now().plus(Duration.ofHours(1))));

        assertThat(jwt.getClaimAsString("typ")).isEqualTo("guest");
        assertThat(jwt.getClaimAsString("share")).isEqualTo(share.toString());
        assertThat(jwt.getClaimAsString("place")).isEqualTo(place.toString());
        assertThat(jwt.getClaimAsString("name")).isEqualTo("Gina");
        assertThat(jwt.getClaimAsString("role")).isNull();
    }

    @Test
    void tokenSignedWithAnotherKeyIsRejected() {
        String token = service.issueAccessToken(user(Role.USER));

        assertThatThrownBy(() -> decoder("a-completely-different-secret-0123456789").decode(token)).isInstanceOf(JwtException.class);
    }

    @Test
    void tamperedPayloadIsRejected() {
        String[] parts = service.issueAccessToken(user(Role.USER)).split("\\.");
        String forged = parts[0] + "." + java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"sub\":\"x\",\"role\":\"ADMIN\"}".getBytes()) + "." + parts[2];

        assertThatThrownBy(() -> decoder(TestProps.SECRET).decode(forged)).isInstanceOf(JwtException.class);
    }

    @Test
    void aTokenIsRejectedOnceItsLifetimeIsOver() {
        String token = service.issueGuestToken(UUID.randomUUID(), "G", UUID.randomUUID(), UUID.randomUUID(), Instant.now().plusSeconds(120));
        NimbusJwtDecoder later = decoder(TestProps.SECRET);
        var timestamps = new org.springframework.security.oauth2.jwt.JwtTimestampValidator(Duration.ZERO);
        timestamps.setClock(java.time.Clock.fixed(Instant.now().plus(Duration.ofHours(1)), java.time.ZoneOffset.UTC));
        later.setJwtValidator(timestamps);

        assertThatThrownBy(() -> later.decode(token)).isInstanceOf(JwtException.class);
    }
}
