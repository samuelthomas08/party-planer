package app.partyplaner.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates requests from the httpOnly token cookies.
 *
 * <p>This is deliberately <em>not</em> done through Spring's resource-server bearer-token support: that
 * support switches CSRF protection off for every request that carries a bearer token, which would be wrong
 * for a token that the browser attaches automatically.
 *
 * <p>Two separate identities exist: signed-in users ({@code pp_access}, used everywhere except /api/guest)
 * and share-link guests ({@code pp_guest}, used only under /api/guest). They can never be mixed up.
 */
public class CookieJwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(CookieJwtAuthenticationFilter.class);
    private static final Set<String> PUBLIC_AUTH_PATHS = Set.of(
            "/api/auth/csrf", "/api/auth/register", "/api/auth/login", "/api/auth/refresh", "/api/auth/logout");

    private final JwtDecoder decoder;
    private final RevokedSessions revoked;

    public CookieJwtAuthenticationFilter(JwtDecoder decoder, RevokedSessions revoked) {
        this.decoder = decoder;
        this.revoked = revoked;
    }

    /** Skips the public endpoints, which must work even with a stale token. */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // Public endpoints never need (and must not be broken by) a stale token.
        return PUBLIC_AUTH_PATHS.contains(path) || path.startsWith("/api/share/") || path.startsWith("/api/invite/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        boolean guestArea = request.getRequestURI().startsWith("/api/guest/");
        String token = AuthCookies.read(request, guestArea ? AuthCookies.GUEST : AuthCookies.ACCESS);
        if (token != null) {
            try {
                Jwt jwt = decoder.decode(token);
                boolean isGuestToken = "guest".equals(jwt.getClaimAsString("typ"));
                if (isGuestToken != guestArea) {
                    log.warn("AUTH_TOKEN_KIND_MISMATCH path={} guestToken={}", request.getRequestURI(), isGuestToken);
                } else if (!isGuestToken && revoked.isRevoked(UUID.fromString(jwt.getSubject()), jwt.getIssuedAt())) {
                    log.info("AUTH_TOKEN_REVOKED user={}", jwt.getSubject());
                } else {
                    String role = isGuestToken ? "GUEST" : jwt.getClaimAsString("role");
                    SecurityContext context = SecurityContextHolder.createEmptyContext();
                    context.setAuthentication(new JwtAuthenticationToken(jwt,
                            List.of(new SimpleGrantedAuthority("ROLE_" + role)), jwt.getSubject()));
                    SecurityContextHolder.setContext(context);
                    MDC.put("user", (isGuestToken ? "guest:" : "") + jwt.getSubject().substring(0, 8));
                }
            } catch (JwtException | IllegalArgumentException e) {
                log.debug("AUTH_TOKEN_INVALID path={} reason={}", request.getRequestURI(), e.getMessage());
                SecurityContextHolder.clearContext();
            }
        }
        chain.doFilter(request, response);
    }
}
