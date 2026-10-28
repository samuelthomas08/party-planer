package app.partyplaner.common;

import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;

/** Helper to read the user id from the authenticated JWT. */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static UUID id(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
