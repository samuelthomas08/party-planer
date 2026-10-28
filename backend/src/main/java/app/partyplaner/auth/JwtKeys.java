package app.partyplaner.auth;

import app.partyplaner.common.AppProperties;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

/** Derives the HMAC signing key from configuration. */
final class JwtKeys {

    private JwtKeys() {
    }

    static SecretKey hmacKey(AppProperties props) {
        return new SecretKeySpec(props.security().jwtSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }
}
