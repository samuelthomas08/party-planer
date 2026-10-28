package app.partyplaner.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RateLimitFilterTest {

    private int call(RateLimitFilter filter, String method, String uri, String ip) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        request.setRequestURI(uri);
        request.setRemoteAddr(ip);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        if (response.getStatus() == 429) {
            assertThat(response.getHeader("Retry-After")).isNotNull();
            assertThat(response.getContentAsString()).contains("RATE_LIMITED");
        }
        return response.getStatus();
    }

    @Test
    void allowsUpToTheLimitThenAnswers429() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(Duration.ofMinutes(1), 3, 9);

        for (int i = 0; i < 3; i++) {
            assertThat(call(filter, "POST", "/api/auth/login", "1.1.1.1")).isEqualTo(200);
        }
        assertThat(call(filter, "POST", "/api/auth/login", "1.1.1.1")).isEqualTo(429);
    }

    @Test
    void loginAndRegisterShareOneBudget() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(Duration.ofMinutes(1), 2, 9);

        call(filter, "POST", "/api/auth/login", "2.2.2.2");
        call(filter, "POST", "/api/auth/register", "2.2.2.2");

        assertThat(call(filter, "POST", "/api/auth/login", "2.2.2.2")).isEqualTo(429);
    }

    @Test
    void countsEveryClientAddressSeparately() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(Duration.ofMinutes(1), 1, 9);

        assertThat(call(filter, "POST", "/api/auth/login", "3.3.3.3")).isEqualTo(200);
        assertThat(call(filter, "POST", "/api/auth/login", "3.3.3.3")).isEqualTo(429);
        assertThat(call(filter, "POST", "/api/auth/login", "4.4.4.4")).isEqualTo(200);
    }

    @Test
    void refreshAndPublicLinkEndpointsUseTheLargerBudget() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(Duration.ofMinutes(1), 1, 3);

        for (int i = 0; i < 3; i++) {
            assertThat(call(filter, "POST", "/api/auth/refresh", "5.5.5.5")).isEqualTo(200);
        }
        assertThat(call(filter, "POST", "/api/auth/refresh", "5.5.5.5")).isEqualTo(429);

        for (int i = 0; i < 3; i++) {
            assertThat(call(filter, "POST", "/api/share/abc/guest", "6.6.6.6")).isEqualTo(200);
        }
        assertThat(call(filter, "POST", "/api/invite/abc/accept", "6.6.6.6")).isEqualTo(429);
    }

    @Test
    void ignoresReadsAndOtherEndpoints() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(Duration.ofMinutes(1), 1, 1);

        for (int i = 0; i < 5; i++) {
            assertThat(call(filter, "GET", "/api/auth/login", "7.7.7.7")).isEqualTo(200);
            assertThat(call(filter, "POST", "/api/folders", "7.7.7.7")).isEqualTo(200);
        }
    }

    @Test
    void startsANewWindowAfterTheOldOneExpired() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(Duration.ofMillis(50), 1, 9);

        assertThat(call(filter, "POST", "/api/auth/login", "8.8.8.8")).isEqualTo(200);
        assertThat(call(filter, "POST", "/api/auth/login", "8.8.8.8")).isEqualTo(429);
        Thread.sleep(80);
        assertThat(call(filter, "POST", "/api/auth/login", "8.8.8.8")).isEqualTo(200);
    }
}
