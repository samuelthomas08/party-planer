package app.partyplaner.invitation;

import static org.assertj.core.api.Assertions.assertThat;

import app.partyplaner.invitation.Invitation.Status;
import app.partyplaner.user.Role;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class InvitationTest {

    private Invitation invitation(Instant expires) {
        return new Invitation("hash", null, Role.USER, UUID.randomUUID(), expires);
    }

    @Test
    void isPendingUntilItExpires() {
        Instant expires = Instant.now().plusSeconds(60);
        Invitation i = invitation(expires);

        assertThat(i.status(Instant.now())).isEqualTo(Status.PENDING);
        assertThat(i.status(expires.plusSeconds(1))).isEqualTo(Status.EXPIRED);
    }

    @Test
    void usedWinsOverEverythingElse() {
        Invitation i = invitation(Instant.now().minusSeconds(60));
        i.markUsed(UUID.randomUUID());

        assertThat(i.status(Instant.now())).isEqualTo(Status.USED);
    }

    @Test
    void revokedIsNotPendingAnymore() {
        Invitation i = invitation(Instant.now().plusSeconds(60));
        i.revoke();

        assertThat(i.status(Instant.now())).isEqualTo(Status.REVOKED);
    }
}
