package app.partyplaner.invitation;

import app.partyplaner.audit.Actor;
import app.partyplaner.audit.AuditService;
import app.partyplaner.audit.Change;
import app.partyplaner.auth.AuthService;
import app.partyplaner.common.ApiException;
import app.partyplaner.user.Role;
import app.partyplaner.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Invitation use cases. The raw token exists only in the response to creation and is never logged or stored. */
@Service
public class InvitationService {

    private static final Logger log = LoggerFactory.getLogger(InvitationService.class);

    /** A new invitation together with its raw token. */
    public record Created(Invitation invitation, String token) {
    }

    private final InvitationRepository invitations;
    private final UserRepository users;
    private final AuthService auth;
    private final AuditService audit;
    private final SecureRandom random = new SecureRandom();

    public InvitationService(InvitationRepository invitations, UserRepository users, AuthService auth, AuditService audit) {
        this.invitations = invitations;
        this.users = users;
        this.auth = auth;
        this.audit = audit;
    }

    /** Creates an invitation valid for the given number of hours. */
    @Transactional
    public Created create(UUID adminId, String email, Role role, int expiresInHours) {
        String normalized = email == null || email.isBlank() ? null : email.trim().toLowerCase(Locale.ROOT);
        if (normalized != null && users.existsByEmail(normalized)) {
            log.info("INVITE_REJECTED admin={} reason=email-taken", adminId);
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "E-mail is already registered");
        }
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Invitation inv = invitations.save(new Invitation(hash(token), normalized, role, adminId,
                Instant.now().plus(Duration.ofHours(expiresInHours))));
        // The token is a credential: it is returned once to the admin and never logged or stored in clear.
        log.info("INVITE_CREATED admin={} invitation={} role={} presetEmail={} expires={}", adminId, inv.getId(), role,
                normalized != null, inv.getExpiresAt());
        audit.record("INVITATION_CREATED", "INVITATION", inv.getId(), normalized, null, null,
                List.of(Change.of("ROLE", null, role.name()), Change.of("EXPIRES", null, inv.getExpiresAt().toString())));
        return new Created(inv, token);
    }

    /** The latest invitations. */
    @Transactional(readOnly = true)
    public List<Invitation> list() {
        return invitations.findTop50ByOrderByCreatedAtDesc();
    }

    /** Revokes a pending invitation. */
    @Transactional
    public void revoke(UUID id) {
        Invitation inv = invitations.findById(id).orElseThrow(() -> ApiException.notFound("Invitation"));
        if (inv.status(Instant.now()) == Invitation.Status.PENDING) {
            inv.revoke();
            log.info("INVITE_REVOKED invitation={}", id);
            audit.record("INVITATION_REVOKED", "INVITATION", id, inv.getEmail(), null, null, List.of());
        }
    }

    /** What a visitor sees before accepting. */
    public record Preview(String email, String invitedBy, Instant expiresAt) {
    }

    /** Looks up a pending invitation. */
    @Transactional(readOnly = true)
    public Preview preview(String token) {
        Invitation inv = invitations.findByTokenHash(hash(token)).filter(this::pending).orElseThrow(this::invalid);
        String by = users.findById(inv.getCreatedBy()).map(u -> u.getDisplayName()).orElse("");
        log.info("INVITE_PREVIEW invitation={}", inv.getId());
        return new Preview(inv.getEmail(), by, inv.getExpiresAt());
    }

    /** Creates the account, signs the new user in and burns the invitation, all in one transaction. */
    @Transactional
    public AuthService.Session accept(String token, String email, String displayName, String password) {
        Invitation inv = invitations.findByTokenHashForUpdate(hash(token)).filter(this::pending).orElseThrow(this::invalid);
        String chosen = inv.getEmail() != null ? inv.getEmail() : email;
        if (chosen == null || chosen.isBlank()) {
            throw ApiException.badRequest("VALIDATION_FAILED", "E-mail is required");
        }
        AuthService.Session session = auth.registerInvited(chosen, password, displayName, inv.getRole());
        inv.markUsed(session.user().getId());
        log.info("INVITE_ACCEPTED invitation={} user={} role={}", inv.getId(), session.user().getId(), inv.getRole());
        audit.record(Actor.user(session.user().getId(), session.user().getDisplayName()), "INVITATION_ACCEPTED", "INVITATION",
                inv.getId(), session.user().getDisplayName(), null, null, List.of(Change.of("ROLE", null, inv.getRole().name())));
        return session;
    }

    private boolean pending(Invitation inv) {
        return inv.status(Instant.now()) == Invitation.Status.PENDING;
    }

    private ApiException invalid() {
        log.info("INVITE_REJECTED reason=unknown-used-revoked-or-expired");
        return new ApiException(HttpStatus.NOT_FOUND, "INVITE_INVALID", "This invitation is not valid");
    }

    /** SHA-256 hex digest of a token. */
    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
