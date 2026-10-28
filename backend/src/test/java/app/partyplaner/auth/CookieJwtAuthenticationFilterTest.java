package app.partyplaner.auth;

import static org.assertj.core.api.Assertions.assertThat;

import app.partyplaner.TestProps;
import app.partyplaner.user.Role;
import app.partyplaner.user.User;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.test.util.ReflectionTestUtils;

class CookieJwtAuthenticationFilterTest {

    private final JwtService jwt = new JwtService(TestProps.props());
    private final RevokedSessions revoked = new RevokedSessions(TestProps.props());
    private final NimbusJwtDecoder decoder = decoder();
    private final CookieJwtAuthenticationFilter filter = new CookieJwtAuthenticationFilter(decoder, revoked);

    private static NimbusJwtDecoder decoder() {
        NimbusJwtDecoder d = NimbusJwtDecoder.withSecretKey(
                new javax.crypto.spec.SecretKeySpec(TestProps.SECRET.getBytes(), "HmacSHA256")).macAlgorithm(MacAlgorithm.HS256).build();
        d.setJwtValidator(JwtValidators.createDefaultWithIssuer("test-issuer"));
        return d;
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private User user(Role role) {
        User u = new User("a@b.de", "hash", "Ada", role);
        ReflectionTestUtils.setField(u, "id", UUID.randomUUID());
        return u;
    }

    /** Runs the filter and returns the authentication that downstream code would see. */
    private Authentication run(String uri, Cookie... cookies) throws Exception {
        SecurityContextHolder.clearContext(); // the real chain does this between requests
        MockHttpServletRequest request = new MockHttpServletRequest("GET", uri);
        request.setRequestURI(uri);
        request.setCookies(cookies);
        AtomicReference<Authentication> seen = new AtomicReference<>();
        filter.doFilter(request, new MockHttpServletResponse(),
                (req, res) -> seen.set(SecurityContextHolder.getContext().getAuthentication()));
        return seen.get();
    }

    @Test
    void authenticatesAValidUserTokenWithItsRole() throws Exception {
        User user = user(Role.ADMIN);

        Authentication auth = run("/api/folders", new Cookie("pp_access", jwt.issueAccessToken(user)));

        assertThat(auth).isNotNull();
        assertThat(auth.getName()).isEqualTo(user.getId().toString());
        assertThat(auth.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_ADMIN");
    }

    @Test
    void leavesRequestsWithoutTokenAnonymous() throws Exception {
        assertThat(run("/api/folders")).isNull();
    }

    @Test
    void ignoresGarbageAndForeignTokens() throws Exception {
        assertThat(run("/api/folders", new Cookie("pp_access", "not-a-jwt"))).isNull();
        assertThat(run("/api/folders", new Cookie("pp_access", "a.b.c"))).isNull();
    }

    @Test
    void rejectsTokensOfUsersWhoseSessionsWereRevoked() throws Exception {
        User user = user(Role.USER);
        String token = jwt.issueAccessToken(user);
        revoked.revokeAllBefore(user.getId());

        assertThat(run("/api/folders", new Cookie("pp_access", token))).isNull();
    }

    @Test
    void aGuestTokenInTheUserCookieDoesNotWorkOutsideTheGuestArea() throws Exception {
        String guest = jwt.issueGuestToken(UUID.randomUUID(), "G", UUID.randomUUID(), UUID.randomUUID(), Instant.now().plusSeconds(600));

        assertThat(run("/api/folders", new Cookie("pp_access", guest))).isNull();
    }

    @Test
    void aUserTokenDoesNotWorkInTheGuestArea() throws Exception {
        String userToken = jwt.issueAccessToken(user(Role.ADMIN));

        assertThat(run("/api/guest/place", new Cookie("pp_guest", userToken))).isNull();
        assertThat(run("/api/guest/place", new Cookie("pp_access", userToken))).isNull();
    }

    @Test
    void authenticatesAGuestOnlyInTheGuestAreaWithTheGuestRole() throws Exception {
        String guest = jwt.issueGuestToken(UUID.randomUUID(), "G", UUID.randomUUID(), UUID.randomUUID(), Instant.now().plusSeconds(600));

        Authentication auth = run("/api/guest/place", new Cookie("pp_guest", guest));

        assertThat(auth).isNotNull();
        assertThat(auth.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_GUEST");
        assertThat(run("/api/folders", new Cookie("pp_guest", guest))).isNull();
    }

    @Test
    void doesNotTouchThePublicEndpointsEvenWithABrokenToken() throws Exception {
        for (String uri : new String[]{"/api/auth/login", "/api/auth/refresh", "/api/auth/csrf", "/api/share/abc", "/api/invite/abc"}) {
            assertThat(run(uri, new Cookie("pp_access", "garbage"))).as(uri).isNull();
        }
    }

    @Test
    void stillAuthenticatesMeAndProfileEndpoints() throws Exception {
        String token = jwt.issueAccessToken(user(Role.USER));

        assertThat(run("/api/auth/me", new Cookie("pp_access", token))).isNotNull();
        assertThat(run("/api/auth/password", new Cookie("pp_access", token))).isNotNull();
    }
}
