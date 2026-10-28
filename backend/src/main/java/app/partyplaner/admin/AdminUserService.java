package app.partyplaner.admin;

import app.partyplaner.audit.AuditService;
import app.partyplaner.audit.Change;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Administrative user management: create, change role / enabled state, reset password, unlock, delete.
 * <p>Guards keep the system operable: nobody can lock themselves out and the last active admin cannot be removed.
 * Changes that must take effect immediately also revoke the affected user's outstanding access tokens.
 */
@Service
public class AdminUserService {

    private static final Logger log = LoggerFactory.getLogger(AdminUserService.class);

    /** Admin view of an account. */
    public record UserAdminResponse(UUID id, String email, String displayName, Role role, boolean enabled, boolean locked,
                                    Instant createdAt, long places, long equipment) {
    }

    private final UserRepository users;
    private final PlaceRepository places;
    private final EquipmentRepository equipment;
    private final RefreshTokenRepository refreshTokens;
    private final RevokedSessions revoked;
    private final PasswordEncoder encoder;
    private final AuditService audit;
    private final ImageService images;

    public AdminUserService(UserRepository users, PlaceRepository places, EquipmentRepository equipment,
                            RefreshTokenRepository refreshTokens, RevokedSessions revoked, PasswordEncoder encoder,
                            AuditService audit, ImageService images) {
        this.images = images;
        this.users = users;
        this.places = places;
        this.equipment = equipment;
        this.refreshTokens = refreshTokens;
        this.revoked = revoked;
        this.encoder = encoder;
        this.audit = audit;
    }

    /** All accounts, oldest first. */
    @Transactional(readOnly = true)
    public List<UserAdminResponse> list() {
        log.debug("ADMIN_USERS_LIST");
        return users.findAllByOrderByCreatedAtAsc().stream().map(this::toResponse).toList();
    }

    /** Creates an account directly; fails with {@code EMAIL_TAKEN} if the address is registered. */
    @Transactional
    public UserAdminResponse create(String email, String displayName, String password, Role role) {
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmail(normalized)) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "E-mail is already registered");
        }
        User user;
        try {
            user = users.saveAndFlush(new User(normalized, encoder.encode(password), displayName.trim(), role));
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "E-mail is already registered");
        }
        log.info("ADMIN_USER_CREATED user={} role={}", user.getId(), role);
        audit.record("USER_CREATED", "USER", user.getId(), user.getDisplayName(), null, null,
                List.of(Change.of("ROLE", null, role.name())));
        return toResponse(user);
    }

    /** Applies role / enabled / name changes. Session-relevant changes revoke the user's access tokens at once. */
    @Transactional
    public UserAdminResponse update(UUID actorId, UUID id, Role role, Boolean enabled, String displayName) {
        User user = find(id);
        List<Change> changes = new ArrayList<>();
        boolean sessionsAffected = false;

        if (role != null && role != user.getRole()) {
            guardAdminLoss(actorId, user, "role change");
            changes.add(Change.of("ROLE", user.getRole().name(), role.name()));
            user.setRole(role);
            sessionsAffected = true;
        }
        if (enabled != null && enabled != user.isEnabled()) {
            if (!enabled) {
                guardAdminLoss(actorId, user, "disable");
            }
            changes.add(Change.of(enabled ? "ENABLED" : "DISABLED"));
            user.setEnabled(enabled);
            if (!enabled) {
                refreshTokens.revokeAllForUser(id, Instant.now());
            }
            sessionsAffected = true;
        }
        if (displayName != null && !displayName.isBlank() && !displayName.trim().equals(user.getDisplayName())) {
            changes.add(Change.of("NAME", user.getDisplayName(), displayName.trim()));
            user.setDisplayName(displayName.trim());
        }
        if (sessionsAffected) {
            revoked.revokeAllBefore(id);
        }
        log.info("ADMIN_USER_UPDATED actor={} user={} changes={}", actorId, id, changes.size());
        if (!changes.isEmpty()) {
            audit.record("USER_UPDATED", "USER", id, user.getDisplayName(), null, null, changes);
        }
        return toResponse(user);
    }

    /** Replaces the password, clears any lockout and ends all sessions of the user. */
    @Transactional
    public void resetPassword(UUID id, String password) {
        User user = find(id);
        user.setPasswordHash(encoder.encode(password));
        user.unlock();
        refreshTokens.revokeAllForUser(id, Instant.now());
        revoked.revokeAllBefore(id);
        log.warn("ADMIN_PASSWORD_RESET user={}", id);
        audit.record("USER_PASSWORD_RESET", "USER", id, user.getDisplayName(), null, null, List.of());
    }

    /** Clears the failed-login lockout. */
    @Transactional
    public void unlock(UUID id) {
        User user = find(id);
        user.unlock();
        log.info("ADMIN_USER_UNLOCKED user={}", id);
        audit.record("USER_UNLOCKED", "USER", id, user.getDisplayName(), null, null, List.of());
    }

    /** Deletes the account; the database cascades to all of the user's data and their image files are removed after commit. */
    @Transactional
    public void delete(UUID actorId, UUID id) {
        User user = find(id);
        guardAdminLoss(actorId, user, "delete");
        long placeCount = places.countByOwnerId(id);
        revoked.revokeAllBefore(id);
        List<String> imageFiles = images.keysOwnedBy(id);
        // Deleting the row cascades to the user's folders, places, equipment, images, tokens and share links.
        users.delete(user);
        users.flush();
        images.deleteFilesAfterCommit(imageFiles);
        log.warn("ADMIN_USER_DELETED actor={} user={} places={}", actorId, id, placeCount);
        audit.record("USER_DELETED", "USER", id, user.getDisplayName(), null, null,
                List.of(Change.of("PLACES_COUNT", null, Long.toString(placeCount))));
    }

    /** You cannot lock yourself out, and the system must never be left without an active administrator. */
    private void guardAdminLoss(UUID actorId, User target, String operation) {
        if (target.getId().equals(actorId)) {
            log.warn("ADMIN_REJECTED op={} reason=self user={}", operation, actorId);
            throw new ApiException(HttpStatus.CONFLICT, "CANNOT_MODIFY_SELF", "You cannot do this to your own account");
        }
        if (target.getRole() == Role.ADMIN && target.isEnabled() && users.countByRoleAndEnabled(Role.ADMIN, true) <= 1) {
            log.warn("ADMIN_REJECTED op={} reason=last-admin", operation);
            throw new ApiException(HttpStatus.CONFLICT, "LAST_ADMIN", "The last administrator cannot be removed");
        }
    }

    private User find(UUID id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound("User"));
    }

    private UserAdminResponse toResponse(User u) {
        return new UserAdminResponse(u.getId(), u.getEmail(), u.getDisplayName(), u.getRole(), u.isEnabled(),
                u.isLocked(Instant.now()), u.getCreatedAt(), places.countByOwnerId(u.getId()), equipment.countByOwnerId(u.getId()));
    }
}
