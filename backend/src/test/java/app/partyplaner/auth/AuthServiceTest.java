package app.partyplaner.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import app.partyplaner.TestProps;
import app.partyplaner.TestUsers;
import app.partyplaner.TestUsers.FakeEncoder;
import app.partyplaner.admin.SettingsService;
import app.partyplaner.audit.Actor;
import app.partyplaner.audit.AuditService;
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
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthServiceTest {

    @Mock UserRepository users;
    @Mock RefreshTokenRepository refreshTokens;
    @Mock SettingsService settings;
    @Mock AuditService audit;

    FakeEncoder encoder = new FakeEncoder();
    AuthService service;

    @BeforeEach
    void setUp() {
        service = new AuthService(users, refreshTokens, encoder, new JwtService(TestProps.props()), settings, audit, TestProps.props());
        when(users.saveAndFlush(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            ReflectionTestUtils.setField(u, "id", UUID.randomUUID());
            return u;
        });
        when(refreshTokens.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));
        when(settings.registrationEnabled()).thenReturn(true);
    }

    private static void assertApi(Throwable t, HttpStatus status, String code) {
        assertThat(t).isInstanceOf(ApiException.class);
        assertThat(((ApiException) t).status()).isEqualTo(status);
        assertThat(((ApiException) t).code()).isEqualTo(code);
    }

    // ------------------------------------------------------------------ register

    @Test
    void theVeryFirstAccountBecomesAdmin() {
        when(users.count()).thenReturn(0L);

        AuthService.Session session = service.register("  Ada@Example.COM ", "long enough password", " Ada ");

        assertThat(session.user().getRole()).isEqualTo(Role.ADMIN);
        assertThat(session.user().getEmail()).isEqualTo("ada@example.com");
        assertThat(session.user().getDisplayName()).isEqualTo("Ada");
        assertThat(session.accessToken()).isNotBlank();
        assertThat(session.refreshToken()).isNotBlank();
    }

    @Test
    void theFirstAccountMayRegisterEvenIfRegistrationIsClosed() {
        when(users.count()).thenReturn(0L);
        when(settings.registrationEnabled()).thenReturn(false);

        assertThat(service.register("a@b.de", "long enough password", "A").user().getRole()).isEqualTo(Role.ADMIN);
    }

    @Test
    void laterAccountsAreNormalUsers() {
        when(users.count()).thenReturn(3L);

        assertThat(service.register("b@b.de", "long enough password", "B").user().getRole()).isEqualTo(Role.USER);
    }

    @Test
    void registrationCanBeClosed() {
        when(users.count()).thenReturn(3L);
        when(settings.registrationEnabled()).thenReturn(false);

        assertThatThrownBy(() -> service.register("b@b.de", "long enough password", "B"))
                .satisfies(t -> assertApi(t, HttpStatus.FORBIDDEN, "REGISTRATION_DISABLED"));
        verify(users, never()).saveAndFlush(any());
    }

    @Test
    void anAlreadyRegisteredAddressIsRefused() {
        when(users.count()).thenReturn(3L);
        when(users.existsByEmail("a@b.de")).thenReturn(true);

        assertThatThrownBy(() -> service.register("A@B.de", "long enough password", "A"))
                .satisfies(t -> assertApi(t, HttpStatus.CONFLICT, "EMAIL_TAKEN"));
    }

    @Test
    void thePasswordMayNotBeTheEmailAddress() {
        when(users.count()).thenReturn(3L);

        assertThatThrownBy(() -> service.register("someone@example.com", "SOMEONE@example.com", "A"))
                .satisfies(t -> assertApi(t, HttpStatus.BAD_REQUEST, "PASSWORD_WEAK"));
    }

    @Test
    void storesTheRefreshTokenOnlyAsHash() {
        when(users.count()).thenReturn(3L);

        AuthService.Session session = service.register("a@b.de", "long enough password", "A");

        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokens).save(saved.capture());
        assertThat(ReflectionTestUtils.getField(saved.getValue(), "tokenHash")).isEqualTo(AuthService.hash(session.refreshToken()));
        assertThat(ReflectionTestUtils.getField(saved.getValue(), "tokenHash")).isNotEqualTo(session.refreshToken());
    }

    // ------------------------------------------------------------------ login

    @Test
    void anUnknownAddressGetsTheSameAnswerAsAWrongPasswordAndStillSpendsHashingTime() {
        when(users.findByEmail("nobody@b.de")).thenReturn(Optional.empty());
        int before = encoder.matchesCalls;

        assertThatThrownBy(() -> service.login("nobody@b.de", "whatever"))
                .satisfies(t -> assertApi(t, HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS"));
        assertThat(encoder.matchesCalls).isGreaterThan(before);
    }

    @Test
    void aWrongPasswordIsCountedAndTheFifthFailureLocksTheAccount() {
        User user = TestUsers.user("a@b.de", "right-password", Role.USER);
        when(users.findByEmail("a@b.de")).thenReturn(Optional.of(user));

        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> service.login("a@b.de", "wrong"))
                    .satisfies(t -> assertApi(t, HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS"));
        }

        assertThat(user.isLocked(Instant.now())).isTrue();
    }

    @Test
    void aLockedAccountIsRefusedEvenWithTheRightPasswordAndWithTheGenericError() {
        User user = TestUsers.user("a@b.de", "right-password", Role.USER);
        for (int i = 0; i < 5; i++) user.registerFailedLogin(5, Duration.ofMinutes(15), Instant.now());
        when(users.findByEmail("a@b.de")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.login("a@b.de", "right-password"))
                .satisfies(t -> assertApi(t, HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS"));
    }

    @Test
    void aDisabledAccountCannotLogInAndTheAttemptIsAudited() {
        User user = TestUsers.user("a@b.de", "right-password", Role.USER);
        user.setEnabled(false);
        when(users.findByEmail("a@b.de")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.login("a@b.de", "right-password"))
                .satisfies(t -> assertApi(t, HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS"));
        verify(audit).record(any(Actor.class), eq("LOGIN_FAILED"), anyString(), any(), any(), any(), any(), any());
    }

    @Test
    void aSuccessfulLoginClearsEarlierFailuresAndIssuesBothTokens() {
        User user = TestUsers.user("a@b.de", "right-password", Role.USER);
        user.registerFailedLogin(5, Duration.ofMinutes(15), Instant.now());
        when(users.findByEmail("a@b.de")).thenReturn(Optional.of(user));

        AuthService.Session session = service.login(" A@b.de ", "right-password");

        assertThat(user.getFailedLoginAttempts()).isZero();
        assertThat(session.accessToken()).isNotBlank();
        assertThat(session.refreshToken()).isNotBlank();
        verify(audit).record(any(Actor.class), eq("LOGIN"), anyString(), any(), any(), any(), any(), any());
    }

    // ------------------------------------------------------------------ refresh

    private RefreshToken token(String raw, UUID userId, UUID family, Instant expires) {
        RefreshToken t = new RefreshToken(userId, family, AuthService.hash(raw), expires);
        when(refreshTokens.findByTokenHash(AuthService.hash(raw))).thenReturn(Optional.of(t));
        return t;
    }

    @Test
    void refreshWithoutOrWithAnUnknownTokenFails() {
        assertThatThrownBy(() -> service.refresh(null)).satisfies(t -> assertApi(t, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED"));
        when(refreshTokens.findByTokenHash(anyString())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.refresh("nope")).satisfies(t -> assertApi(t, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED"));
    }

    @Test
    void refreshRotatesTheTokenWithinTheSameFamily() {
        User user = TestUsers.user("a@b.de", "pw", Role.USER);
        UUID family = UUID.randomUUID();
        RefreshToken old = token("old", user.getId(), family, Instant.now().plus(Duration.ofDays(1)));
        when(users.findById(user.getId())).thenReturn(Optional.of(user));

        AuthService.Session session = service.refresh("old");

        assertThat(old.isRevoked()).isTrue();
        assertThat(session.refreshToken()).isNotEqualTo("old");
        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokens).save(saved.capture());
        assertThat(saved.getValue().getFamilyId()).isEqualTo(family);
    }

    @Test
    void anExpiredRefreshTokenIsRejected() {
        token("old", UUID.randomUUID(), UUID.randomUUID(), Instant.now().minusSeconds(5));

        assertThatThrownBy(() -> service.refresh("old")).satisfies(t -> assertApi(t, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED"));
    }

    @Test
    void replayingARotatedTokenLongAfterwardsRevokesTheWholeFamily() {
        UUID family = UUID.randomUUID();
        RefreshToken stolen = token("old", UUID.randomUUID(), family, Instant.now().plus(Duration.ofDays(1)));
        stolen.revoke(Instant.now().minus(Duration.ofMinutes(5)));

        assertThatThrownBy(() -> service.refresh("old")).satisfies(t -> assertApi(t, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED"));

        verify(refreshTokens).revokeFamily(eq(family), any(Instant.class));
    }

    @Test
    void replayingJustAfterRotationIsTreatedAsARaceNotAsTheft() {
        RefreshToken justRotated = token("old", UUID.randomUUID(), UUID.randomUUID(), Instant.now().plus(Duration.ofDays(1)));
        justRotated.revoke(Instant.now().minusSeconds(2));

        assertThatThrownBy(() -> service.refresh("old")).satisfies(t -> assertApi(t, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED"));

        verify(refreshTokens, never()).revokeFamily(any(), any());
    }

    @Test
    void refreshFailsForDisabledOrDeletedUsers() {
        User user = TestUsers.user("a@b.de", "pw", Role.USER);
        user.setEnabled(false);
        token("old", user.getId(), UUID.randomUUID(), Instant.now().plus(Duration.ofDays(1)));
        when(users.findById(user.getId())).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.refresh("old")).satisfies(t -> assertApi(t, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED"));
    }

    // ------------------------------------------------------------------ logout, profile, password

    @Test
    void logoutRevokesTheSessionFamily() {
        User user = TestUsers.user("a@b.de", "pw", Role.USER);
        UUID family = UUID.randomUUID();
        token("tok", user.getId(), family, Instant.now().plus(Duration.ofDays(1)));
        when(users.findById(user.getId())).thenReturn(Optional.of(user));

        service.logout("tok");

        verify(refreshTokens).revokeFamily(eq(family), any(Instant.class));
    }

    @Test
    void logoutWithoutATokenDoesNothing() {
        service.logout(null);

        verify(refreshTokens, never()).revokeFamily(any(), any());
    }

    @Test
    void currentUserMustBeEnabled() {
        User user = TestUsers.user("a@b.de", "pw", Role.USER);
        user.setEnabled(false);
        when(users.findById(user.getId())).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.currentUser(user.getId())).satisfies(t -> assertApi(t, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED"));
    }

    @Test
    void updatingTheProfileTrimsTheName() {
        User user = TestUsers.user("a@b.de", "pw", Role.USER);
        when(users.findById(user.getId())).thenReturn(Optional.of(user));

        assertThat(service.updateProfile(user.getId(), "  New Name ").getDisplayName()).isEqualTo("New Name");
    }

    @Test
    void changingThePasswordNeedsTheCurrentOneAndEndsAllOtherSessions() {
        User user = TestUsers.user("a@b.de", "old-password", Role.USER);
        when(users.findById(user.getId())).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.changePassword(user.getId(), "wrong", "brand new password"))
                .satisfies(t -> assertApi(t, HttpStatus.FORBIDDEN, "WRONG_PASSWORD"));
        verify(refreshTokens, never()).revokeAllForUser(any(), any());

        AuthService.Session fresh = service.changePassword(user.getId(), "old-password", "brand new password");

        assertThat(user.getPasswordHash()).isEqualTo("enc:brand new password");
        verify(refreshTokens).revokeAllForUser(eq(user.getId()), any(Instant.class));
        assertThat(fresh.refreshToken()).isNotBlank();
    }

    @Test
    void registerInvitedIgnoresTheRegistrationSwitchAndUsesTheGivenRole() {
        when(settings.registrationEnabled()).thenReturn(false);

        User created = service.registerInvited("new@b.de", "long enough password", "New", Role.ADMIN).user();

        assertThat(created.getRole()).isEqualTo(Role.ADMIN);
        assertThat(created.getEmail()).isEqualTo("new@b.de");
    }
}
