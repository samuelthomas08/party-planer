package app.partyplaner.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Gives every request an id (MDC + X-Request-Id header) and logs one summary line per request. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestLogFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger("app.partyplaner.http");
    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9-]{4,36}");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String incoming = request.getHeader("X-Request-Id");
        String id = incoming != null && SAFE_ID.matcher(incoming).matches() ? incoming : UUID.randomUUID().toString().substring(0, 8);
        MDC.put("requestId", id);
        response.setHeader("X-Request-Id", id);
        long start = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            logRequest(request, response, (System.nanoTime() - start) / 1_000_000);
            MDC.clear();
        }
    }

    private void logRequest(HttpServletRequest request, HttpServletResponse response, long millis) {
        String path = request.getRequestURI();
        if (path.equals("/api/admin/logs/stream") || path.startsWith("/actuator")) {
            return;
        }
        int status = response.getStatus();
        String line = "HTTP {} {} -> {} ({} ms)";
        boolean mutating = !"GET".equals(request.getMethod()) && !"HEAD".equals(request.getMethod());
        if (status >= 500) {
            log.error(line, request.getMethod(), path, status, millis);
        } else if (status >= 400 && status != 401) {
            log.warn(line, request.getMethod(), path, status, millis);
        } else if (mutating && !path.equals("/api/client-logs") || status == 401) {
            log.info(line, request.getMethod(), path, status, millis);
        } else {
            log.debug(line, request.getMethod(), path, status, millis);
        }
    }
}
