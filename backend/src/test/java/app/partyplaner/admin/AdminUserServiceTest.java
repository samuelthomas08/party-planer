package app.partyplaner.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import app.partyplaner.TestProps;
import app.partyplaner.TestUsers;
import app.partyplaner.TestUsers.FakeEncoder;
import app.partyplaner.audit.AuditService;
import app.partyplaner.auth.RefreshTokenRepository;
import app.partyplaner.auth.RevokedSessions;
import app.partyplaner.common.ApiException;
import app.partyplaner.equipment.EquipmentRepository;
import app.partyplaner.image.ImageService;
import app.partyplaner.place.PlaceRepository;
import app.partyplaner.user.Role;
import app.partyplaner.user.User;
import app.partyplaner.user.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminUserServiceTest {

    @Mock UserRepository users;
    @Mock PlaceRepository places;
    @Mock EquipmentRepository equipment;
    @Mock RefreshTokenRepository refreshTokens;
    @Mock AuditService audit;
    @Mock ImageService images;

    RevokedSessions revoked = new RevokedSessions(TestProps.props());
    AdminUserService service;

    UUID actorId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new AdminUserService(users, places, equipment, refreshTokens, revoked, new FakeEncoder(), audit, images);
        when(users.countByRoleAndEnabled(Role.ADMIN, true)).thenReturn(2L);
    }

    private User target(Role role) {
        User u = TestUsers.user(UUID.randomUUID() + "@b.de", "pw", role);
        when(users.findById(u.getId())).thenReturn(Optional.of(u));
        return u;
    }

    private static void assertConflict(Throwable t, String code) {
        assertThat(t).isInstanceOf(ApiException.class);
        assertThat(((ApiException) t).status()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(((ApiException) t).code()).isEqualTo(code);
    }

    @Test
    void nobodyCanChangeTheirOwnRoleOrDisableThemselves() {
        User self = target(Role.ADMIN);

        assertThatThrownBy(() -> service.update(self.getId(), self.getId(), Role.USER, null, null))
                .satisfies(t -> assertConflict(t, "CANNOT_MODIFY_SELF"));
        assertThatThrownBy(() -> service.update(self.getId(), self.getId(), null, false, null))
                .satisfies(t -> assertConflict(t, "CANNOT_MODIFY_SELF"));
        assertThat(self.getRole()).isEqualTo(Role.ADMIN);
        assertThat(self.isEnabled()).isTrue();
    }

    @Test
    void theLastActiveAdminCannotBeDemotedDisabledOrDeleted() {
        when(users.countByRoleAndEnabled(Role.ADMIN, true)).thenReturn(1L);
        User lastAdmin = target(Role.ADMIN);

        assertThatThrownBy(() -> service.update(actorId, lastAdmin.getId(), Role.USER, null, null)).satisfies(t -> assertConflict(t, "LAST_ADMIN"));
        assertThatThrownBy(() -> service.update(actorId, lastAdmin.getId(), null, false, null)).satisfies(t -> assertConflict(t, "LAST_ADMIN"));
        assertThatThrownBy(() -> service.delete(actorId, lastAdmin.getId())).satisfies(t -> assertConflict(t, "LAST_ADMIN"));
        verify(users, never()).delete(any());
    }

    @Test
    void demotingOneOfSeveralAdminsWorksAndCutsOffTheirOldAdminToken() {
        User admin = target(Role.ADMIN);
        Instant tokenIssuedBefore = Instant.now();

        service.update(actorId, admin.getId(), Role.USER, null, null);

        assertThat(admin.getRole()).isEqualTo(Role.USER);
        assertThat(revoked.isRevoked(admin.getId(), tokenIssuedBefore)).isTrue();
        verify(audit).record(eq("USER_UPDATED"), eq("USER"), eq(admin.getId()), any(), any(), any(), anyList());
    }

    @Test
    void disablingAUserEndsTheirRefreshTokensAndAccessTokens() {
        User user = target(Role.USER);
        Instant tokenIssuedBefore = Instant.now();

        service.update(actorId, user.getId(), null, false, null);

        assertThat(user.isEnabled()).isFalse();
        verify(refreshTokens).revokeAllForUser(eq(user.getId()), any(Instant.class));
        assertThat(revoked.isRevoked(user.getId(), tokenIssuedBefore)).isTrue();
    }

    @Test
    void renamingDoesNotKickTheUserOut() {
        User user = target(Role.USER);

        service.update(actorId, user.getId(), null, null, "  New Name ");

        assertThat(user.getDisplayName()).isEqualTo("New Name");
        assertThat(revoked.isRevoked(user.getId(), Instant.now())).isFalse();
        verify(refreshTokens, never()).revokeAllForUser(any(), any());
    }

    @Test
    void anUpdateThatChangesNothingWritesNoAuditEntry() {
        User user = target(Role.USER);

        service.update(actorId, user.getId(), Role.USER, true, user.getDisplayName());

        verify(audit, never()).record(any(String.class), any(), any(), any(), any(), any(), anyList());
    }

    @Test
    void resettingAPasswordReplacesItUnlocksAndEndsAllSessions() {
        User user = target(Role.USER);

        service.resetPassword(user.getId(), "a brand new password");

        assertThat(user.getPasswordHash()).isEqualTo("enc:a brand new password");
        verify(refreshTokens).revokeAllForUser(eq(user.getId()), any(Instant.class));
        assertThat(revoked.isRevoked(user.getId(), Instant.now())).isTrue();
    }

    @Test
    void deletingAUserRemovesTheirImageFilesAfterTheRowIsGone() {
        User user = target(Role.USER);
        when(images.keysOwnedBy(user.getId())).thenReturn(List.of("ab/x.png"));

        service.delete(actorId, user.getId());

        var order = org.mockito.Mockito.inOrder(users, images);
        order.verify(users).delete(user);
        order.verify(images).deleteFilesAfterCommit(List.of("ab/x.png"));
    }

    @Test
    void youCannotDeleteYourself() {
        User self = target(Role.USER);

        assertThatThrownBy(() -> service.delete(self.getId(), self.getId())).satisfies(t -> assertConflict(t, "CANNOT_MODIFY_SELF"));
    }

    @Test
    void creatingAnAddressThatExistsIsRefused() {
        when(users.existsByEmail("taken@b.de")).thenReturn(true);

        assertThatThrownBy(() -> service.create(" Taken@B.de ", "Name", "long enough password", Role.USER))
                .satisfies(t -> assertConflict(t, "EMAIL_TAKEN"));
    }

    @Test
    void unlockingClearsTheLockout() {
        User user = target(Role.USER);
        for (int i = 0; i < 5; i++) user.registerFailedLogin(5, java.time.Duration.ofMinutes(15), Instant.now());

        service.unlock(user.getId());

        assertThat(user.isLocked(Instant.now())).isFalse();
    }

    @Test
    void unknownUsersAre404() {
        UUID missing = UUID.randomUUID();
        when(users.findById(missing)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.unlock(missing)).isInstanceOf(ApiException.class)
                .satisfies(t -> assertThat(((ApiException) t).status()).isEqualTo(HttpStatus.NOT_FOUND));
    }
}
