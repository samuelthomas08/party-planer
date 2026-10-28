package app.partyplaner.invitation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import app.partyplaner.TestUsers;
import app.partyplaner.audit.Actor;
import app.partyplaner.audit.AuditService;
import app.partyplaner.auth.AuthService;
import app.partyplaner.common.ApiException;
import app.partyplaner.user.Role;
import app.partyplaner.user.User;
import app.partyplaner.user.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class InvitationServiceTest {

    @Mock InvitationRepository invitations;
    @Mock UserRepository users;
    @Mock AuthService auth;
    @Mock AuditService audit;

    InvitationService service;
    UUID admin = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new InvitationService(invitations, users, auth, audit);
        when(invitations.save(any(Invitation.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static void assertApi(Throwable t, HttpStatus status, String code) {
        assertThat(((ApiException) t).status()).isEqualTo(status);
        assertThat(((ApiException) t).code()).isEqualTo(code);
    }

    private Invitation stored(String token, String email, Role role, Instant expires) {
        Invitation inv = new Invitation(InvitationService.hash(token), email, role, admin, expires);
        when(invitations.findByTokenHash(InvitationService.hash(token))).thenReturn(Optional.of(inv));
        when(invitations.findByTokenHashForUpdate(InvitationService.hash(token))).thenReturn(Optional.of(inv));
        return inv;
    }

    @Test
    void createsAnInvitationWhoseTokenIsOnlyStoredAsAHash() {
        InvitationService.Created created = service.create(admin, " New@B.de ", Role.USER, 24);

        ArgumentCaptor<Invitation> saved = ArgumentCaptor.forClass(Invitation.class);
        verify(invitations).save(saved.capture());
        assertThat(created.token()).hasSizeGreaterThanOrEqualTo(40).matches("[A-Za-z0-9_-]+");
        assertThat(ReflectionHash.tokenHash(saved.getValue())).isEqualTo(InvitationService.hash(created.token())).isNotEqualTo(created.token());
        assertThat(saved.getValue().getEmail()).isEqualTo("new@b.de");
        assertThat(saved.getValue().getExpiresAt()).isBetween(Instant.now().plus(Duration.ofHours(23)), Instant.now().plus(Duration.ofHours(25)));
        verify(audit).record(eq("INVITATION_CREATED"), eq("INVITATION"), any(), any(), any(), any(), anyList());
    }

    @Test
    void everyInvitationGetsADifferentToken() {
        assertThat(service.create(admin, null, Role.USER, 24).token()).isNotEqualTo(service.create(admin, null, Role.USER, 24).token());
    }

    @Test
    void aBlankAddressMeansTheInvitedPersonChoosesIt() {
        service.create(admin, "   ", Role.USER, 24);

        ArgumentCaptor<Invitation> saved = ArgumentCaptor.forClass(Invitation.class);
        verify(invitations).save(saved.capture());
        assertThat(saved.getValue().getEmail()).isNull();
    }

    @Test
    void inviting_anAddressThatAlreadyHasAnAccountIsRefused() {
        when(users.existsByEmail("taken@b.de")).thenReturn(true);

        assertThatThrownBy(() -> service.create(admin, "taken@b.de", Role.USER, 24)).satisfies(t -> assertApi(t, HttpStatus.CONFLICT, "EMAIL_TAKEN"));
        verify(invitations, never()).save(any());
    }

    @Test
    void previewShowsWhoInvitedAndWhetherTheAddressIsFixed() {
        User inviter = TestUsers.user("admin@b.de", "pw", Role.ADMIN);
        when(users.findById(admin)).thenReturn(Optional.of(inviter));
        stored("tok", "fixed@b.de", Role.USER, Instant.now().plusSeconds(600));

        InvitationService.Preview preview = service.preview("tok");

        assertThat(preview.email()).isEqualTo("fixed@b.de");
        assertThat(preview.invitedBy()).isEqualTo(inviter.getDisplayName());
    }

    @Test
    void unknownExpiredRevokedAndUsedInvitationsAllLookTheSame() {
        stored("expired", null, Role.USER, Instant.now().minusSeconds(5));
        Invitation revoked = stored("revoked", null, Role.USER, Instant.now().plusSeconds(600));
        revoked.revoke();
        Invitation used = stored("used", null, Role.USER, Instant.now().plusSeconds(600));
        used.markUsed(UUID.randomUUID());

        for (String token : new String[]{"unknown", "expired", "revoked", "used"}) {
            assertThatThrownBy(() -> service.preview(token)).as(token).satisfies(t -> assertApi(t, HttpStatus.NOT_FOUND, "INVITE_INVALID"));
            assertThatThrownBy(() -> service.accept(token, "a@b.de", "N", "long enough password")).as(token)
                    .satisfies(t -> assertApi(t, HttpStatus.NOT_FOUND, "INVITE_INVALID"));
        }
        verify(auth, never()).registerInvited(any(), any(), any(), any());
    }

    @Test
    void acceptingCreatesTheAccountWithTheInvitedRoleAndBurnsTheInvitation() {
        Invitation inv = stored("tok", null, Role.ADMIN, Instant.now().plusSeconds(600));
        User created = TestUsers.user("new@b.de", "pw", Role.ADMIN);
        when(auth.registerInvited("new@b.de", "long enough password", "Nina", Role.ADMIN))
                .thenReturn(new AuthService.Session(created, "access", "refresh"));

        AuthService.Session session = service.accept("tok", "new@b.de", "Nina", "long enough password");

        assertThat(session.user()).isSameAs(created);
        assertThat(inv.status(Instant.now())).isEqualTo(Invitation.Status.USED);
        verify(audit).record(any(Actor.class), eq("INVITATION_ACCEPTED"), eq("INVITATION"), any(), any(), any(), any(), anyList());
    }

    @Test
    void aPresetAddressWinsOverWhatTheClientSends() {
        stored("tok", "preset@b.de", Role.USER, Instant.now().plusSeconds(600));
        when(auth.registerInvited(eq("preset@b.de"), any(), any(), any()))
                .thenReturn(new AuthService.Session(TestUsers.user("preset@b.de", "pw", Role.USER), "a", "r"));

        service.accept("tok", "attacker@b.de", "Nina", "long enough password");

        verify(auth).registerInvited(eq("preset@b.de"), any(), any(), eq(Role.USER));
    }

    @Test
    void withoutAPresetAddressOneMustBeGiven() {
        stored("tok", null, Role.USER, Instant.now().plusSeconds(600));

        assertThatThrownBy(() -> service.accept("tok", " ", "Nina", "long enough password"))
                .satisfies(t -> assertApi(t, HttpStatus.BAD_REQUEST, "VALIDATION_FAILED"));
        assertThatThrownBy(() -> service.accept("tok", null, "Nina", "long enough password"))
                .satisfies(t -> assertApi(t, HttpStatus.BAD_REQUEST, "VALIDATION_FAILED"));
    }

    @Test
    void onlyPendingInvitationsCanBeRevoked() {
        Invitation pending = new Invitation("h1", null, Role.USER, admin, Instant.now().plusSeconds(600));
        Invitation used = new Invitation("h2", null, Role.USER, admin, Instant.now().plusSeconds(600));
        used.markUsed(UUID.randomUUID());
        when(invitations.findById(any())).thenReturn(Optional.of(pending), Optional.of(used));

        service.revoke(UUID.randomUUID());
        service.revoke(UUID.randomUUID());

        assertThat(pending.status(Instant.now())).isEqualTo(Invitation.Status.REVOKED);
        assertThat(used.status(Instant.now())).isEqualTo(Invitation.Status.USED);
        verify(audit, org.mockito.Mockito.times(1)).record(eq("INVITATION_REVOKED"), any(), any(), any(), any(), any(), anyList());
    }

    /** Reads the private hash column; there is deliberately no getter for it. */
    private static final class ReflectionHash {
        static String tokenHash(Invitation inv) {
            return (String) org.springframework.test.util.ReflectionTestUtils.getField(inv, "tokenHash");
        }
    }
}
