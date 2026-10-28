package app.partyplaner.auth;

import app.partyplaner.common.AppProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * Both tokens live in httpOnly, SameSite=Strict cookies, so they are never exposed to JavaScript.
 * The refresh cookie is scoped to /api/auth and therefore not sent with ordinary API calls.
 */
@Component
public class AuthCookies {

    public static final String ACCESS = "pp_access";
    public static final String REFRESH = "pp_refresh";
    public static final String GUEST = "pp_guest";
    private static final String ACCESS_PATH = "/api";
    private static final String REFRESH_PATH = "/api/auth";

    private final AppProperties.Security props;

    public AuthCookies(AppProperties properties) {
        this.props = properties.security();
    }

    public ResponseCookie access(String token) {
        return build(ACCESS, token, ACCESS_PATH, props.accessTokenTtl());
    }

    public ResponseCookie refresh(String token) {
        return build(REFRESH, token, REFRESH_PATH, props.refreshTokenTtl());
    }

    public ResponseCookie guest(String token, Duration ttl) {
        return build(GUEST, token, ACCESS_PATH, ttl);
    }

    public ResponseCookie clearGuest() {
        return build(GUEST, "", ACCESS_PATH, Duration.ZERO);
    }

    public ResponseCookie clearAccess() {
        return build(ACCESS, "", ACCESS_PATH, Duration.ZERO);
    }

    public ResponseCookie clearRefresh() {
        return build(REFRESH, "", REFRESH_PATH, Duration.ZERO);
    }

    public static String read(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (cookie.getName().equals(name) && !cookie.getValue().isEmpty()) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private ResponseCookie build(String name, String value, String path, Duration maxAge) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(props.cookieSecure())
                .sameSite("Strict")
                .path(path)
                .maxAge(maxAge)
                .build();
    }
}
