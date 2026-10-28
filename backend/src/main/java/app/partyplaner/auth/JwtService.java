package app.partyplaner.auth;

import app.partyplaner.common.AppProperties;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.time.Instant;
import app.partyplaner.user.User;
import java.util.UUID;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

/** Issues the signed JWTs: short-lived access tokens for users and read-only tokens for share-link guests. */
@Service
public class JwtService {

    private final JwtEncoder encoder;
    private final AppProperties.Security props;

    public JwtService(AppProperties properties) {
        this.props = properties.security();
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(JwtKeys.hmacKey(properties)));
    }

    /** Short-lived access token carrying the user's role and name. */
    public String issueAccessToken(User user) {
        Instant now = Instant.now();
        return encode(JwtClaimsSet.builder()
                .issuer(props.issuer())
                .subject(user.getId().toString())
                .issuedAt(now)
                .expiresAt(now.plus(props.accessTokenTtl()))
                .claim("role", user.getRole().name())
                .claim("name", user.getDisplayName())
                .build());
    }

    /** Token for a guest on a share link: read access to exactly one place, and nothing else. */
    public String issueGuestToken(UUID guestId, String name, UUID shareId, UUID placeId, Instant expiresAt) {
        return encode(JwtClaimsSet.builder()
                .issuer(props.issuer())
                .subject(guestId.toString())
                .issuedAt(Instant.now())
                .expiresAt(expiresAt)
                .claim("typ", "guest")
                .claim("name", name)
                .claim("share", shareId.toString())
                .claim("place", placeId.toString())
                .build());
    }

    private String encode(JwtClaimsSet claims) {
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
