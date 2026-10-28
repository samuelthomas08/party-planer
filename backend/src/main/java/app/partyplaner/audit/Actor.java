package app.partyplaner.audit;

import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

/** Who did it: a signed-in user, a guest on a share link, or the system itself (scheduled jobs). */
public record Actor(UUID id, String name, String type) {

    public static Actor system() {
        return new Actor(null, "System", "SYSTEM");
    }

    public static Actor user(UUID id, String name) {
        return new Actor(id, name, "USER");
    }

    /** Taken from the current request's token; falls back to the system actor outside a request. */
    public static Actor current() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            String name = jwt.getClaimAsString("name");
            String type = "guest".equals(jwt.getClaimAsString("typ")) ? "GUEST" : "USER";
            return new Actor(UUID.fromString(jwt.getSubject()), name == null ? "?" : name, type);
        }
        return system();
    }
}
