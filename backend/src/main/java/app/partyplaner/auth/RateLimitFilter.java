package app.partyplaner.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.web.filter.OncePerRequestFilter;

/** Fixed-window, per-IP limiter for the unauthenticated auth endpoints. In-memory: sufficient for a single instance. */
public class RateLimitFilter extends OncePerRequestFilter {

    private record Window(long startedAt, int count) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final Duration window;
    private final int maxLogin;
    private final int maxRefresh;

    public RateLimitFilter(Duration window, int maxLogin, int maxRefresh) {
        this.window = window;
        this.maxLogin = maxLogin;
        this.maxRefresh = maxRefresh;
    }

    /** Only POSTs to the limited auth endpoints are counted. */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod()) || limitFor(request.getRequestURI()) == 0;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        long now = System.currentTimeMillis();
        String key = request.getRemoteAddr() + (path.endsWith("/refresh") || path.startsWith("/api/share/") || path.startsWith("/api/invite/") ? "#refresh" : "#credentials");
        if (windows.size() > 10_000) {
            windows.values().removeIf(w -> now - w.startedAt > window.toMillis());
        }
        Window updated = windows.merge(key, new Window(now, 1),
                (old, fresh) -> now - old.startedAt > window.toMillis() ? fresh : new Window(old.startedAt, old.count + 1));
        if (updated.count > limitFor(path)) {
            long retryAfter = Math.max(1, (updated.startedAt + window.toMillis() - now) / 1000);
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            response.setContentType("application/json");
            response.getWriter().write("{\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    private int limitFor(String path) {
        if (path.endsWith("/api/auth/login") || path.endsWith("/api/auth/register")) {
            return maxLogin;
        }
        if (path.endsWith("/api/auth/refresh") || path.startsWith("/api/share/") || path.startsWith("/api/invite/")) {
            return maxRefresh;
        }
        return 0;
    }
}
