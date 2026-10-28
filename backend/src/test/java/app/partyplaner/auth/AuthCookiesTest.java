package app.partyplaner.auth;

import static org.assertj.core.api.Assertions.assertThat;

import app.partyplaner.TestProps;
import jakarta.servlet.http.Cookie;
import java.nio.file.Path;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseCookie;
import org.springframework.mock.web.MockHttpServletRequest;

class AuthCookiesTest {

    private final AuthCookies cookies = new AuthCookies(TestProps.props(true, true, Path.of("x")));

    @Test
    void accessCookieIsHttpOnlyStrictAndScopedToTheApi() {
        ResponseCookie c = cookies.access("abc");

        assertThat(c.getName()).isEqualTo("pp_access");
        assertThat(c.isHttpOnly()).isTrue();
        assertThat(c.isSecure()).isTrue();
        assertThat(c.getSameSite()).isEqualTo("Strict");
        assertThat(c.getPath()).isEqualTo("/api");
        assertThat(c.getMaxAge()).isEqualTo(Duration.ofMinutes(15));
    }

    @Test
    void refreshCookieIsOnlySentToTheAuthEndpoints() {
        ResponseCookie c = cookies.refresh("abc");

        assertThat(c.getPath()).isEqualTo("/api/auth");
        assertThat(c.getMaxAge()).isEqualTo(Duration.ofDays(14));
        assertThat(c.isHttpOnly()).isTrue();
    }

    @Test
    void guestCookieHasTheGivenLifetime() {
        ResponseCookie c = cookies.guest("abc", Duration.ofHours(2));

        assertThat(c.getName()).isEqualTo("pp_guest");
        assertThat(c.getMaxAge()).isEqualTo(Duration.ofHours(2));
        assertThat(c.isHttpOnly()).isTrue();
    }

    @Test
    void clearingExpiresTheCookieImmediatelyWithTheSamePath() {
        assertThat(cookies.clearAccess().getMaxAge()).isEqualTo(Duration.ZERO);
        assertThat(cookies.clearAccess().getPath()).isEqualTo("/api");
        assertThat(cookies.clearRefresh().getPath()).isEqualTo("/api/auth");
        assertThat(cookies.clearGuest().getMaxAge()).isEqualTo(Duration.ZERO);
    }

    @Test
    void secureFlagFollowsTheConfiguration() {
        AuthCookies insecure = new AuthCookies(TestProps.props(true, false, Path.of("x")));
        assertThat(insecure.access("a").isSecure()).isFalse();
    }

    @Test
    void readsCookiesByNameAndTreatsEmptyValuesAsMissing() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("pp_access", "token"), new Cookie("pp_refresh", ""));

        assertThat(AuthCookies.read(request, "pp_access")).isEqualTo("token");
        assertThat(AuthCookies.read(request, "pp_refresh")).isNull();
        assertThat(AuthCookies.read(request, "other")).isNull();
        assertThat(AuthCookies.read(new MockHttpServletRequest(), "pp_access")).isNull();
    }
}
