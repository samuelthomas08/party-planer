package app.partyplaner.share;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ShareLinkTest {

    private ShareLink link(Instant expires) {
        return new ShareLink(UUID.randomUUID(), UUID.randomUUID(), "token", expires);
    }

    @Test
    void aLinkWithoutExpiryIsActiveUntilRevoked() {
        ShareLink l = link(null);
        assertThat(l.isActive(Instant.now())).isTrue();

        l.revoke();

        assertThat(l.isActive(Instant.now())).isFalse();
        assertThat(l.getRevokedAt()).isNotNull();
    }

    @Test
    void aLinkStopsBeingActiveAtItsExpiry() {
        Instant expires = Instant.now().plusSeconds(60);
        ShareLink l = link(expires);

        assertThat(l.isActive(expires.minusSeconds(1))).isTrue();
        assertThat(l.isActive(expires.plusSeconds(1))).isFalse();
    }
}
