package app.partyplaner.auth;

import app.partyplaner.common.AppProperties;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Access tokens are stateless and live up to 15 minutes. When an admin disables, demotes or deletes a user,
 * every token issued before that moment is rejected immediately through this in-memory list.
 * (Single-instance by design; entries expire together with the longest-lived access token.)
 */
@Component
public class RevokedSessions {

    private static final Logger log = LoggerFactory.getLogger(RevokedSessions.class);

    private final Map<UUID, Instant> revokedAt = new ConcurrentHashMap<>();
    private final Duration ttl;

    public RevokedSessions(AppProperties props) {
        this.ttl = props.security().accessTokenTtl();
    }

    public void revokeAllBefore(UUID userId) {
        // Token timestamps have 1 s resolution: round UP so a token minted in the same second is also rejected.
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS).plusSeconds(1);
        revokedAt.put(userId, now);
        revokedAt.values().removeIf(t -> t.isBefore(Instant.now().minus(ttl).minusSeconds(60)));
        log.info("SESSION_ACCESS_REVOKED user={}", userId);
    }

    public boolean isRevoked(UUID userId, Instant issuedAt) {
        Instant cutoff = revokedAt.get(userId);
        return cutoff != null && issuedAt != null && issuedAt.isBefore(cutoff);
    }
}
