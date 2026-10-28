package app.partyplaner.auth;

import static org.assertj.core.api.Assertions.assertThat;

import app.partyplaner.TestProps;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RevokedSessionsTest {

    private final RevokedSessions sessions = new RevokedSessions(TestProps.props());

    @Test
    void nothingIsRevokedByDefault() {
        assertThat(sessions.isRevoked(UUID.randomUUID(), Instant.now())).isFalse();
    }

    @Test
    void rejectsTokensIssuedBeforeOrInTheSameSecondAsTheRevocation() {
        UUID user = UUID.randomUUID();
        Instant issuedJustBefore = Instant.now();

        sessions.revokeAllBefore(user);

        // the cut-off is rounded up to the next second, so even a token minted "now" is rejected
        assertThat(sessions.isRevoked(user, issuedJustBefore)).isTrue();
        assertThat(sessions.isRevoked(user, issuedJustBefore.minusSeconds(600))).isTrue();
    }

    @Test
    void acceptsTokensIssuedAfterTheCutOff() {
        UUID user = UUID.randomUUID();
        sessions.revokeAllBefore(user);

        assertThat(sessions.isRevoked(user, Instant.now().plusSeconds(5))).isFalse();
    }

    @Test
    void onlyAffectsTheRevokedUser() {
        UUID revoked = UUID.randomUUID();
        sessions.revokeAllBefore(revoked);

        assertThat(sessions.isRevoked(UUID.randomUUID(), Instant.now().minusSeconds(60))).isFalse();
    }

    @Test
    void aTokenWithoutIssueTimeIsNotConsideredRevoked() {
        UUID user = UUID.randomUUID();
        sessions.revokeAllBefore(user);

        assertThat(sessions.isRevoked(user, null)).isFalse();
    }
}
