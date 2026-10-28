package app.partyplaner.auth;

import app.partyplaner.admin.SettingsService;
import app.partyplaner.audit.Actor;
import app.partyplaner.audit.AuditService;
import app.partyplaner.audit.Change;
import app.partyplaner.common.ApiException;
import app.partyplaner.common.AppProperties;
import app.partyplaner.user.Role;
import app.partyplaner.user.User;
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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Authentication logic: registration, login with lockout, rotating refresh tokens with reuse detection,
 * profile and password changes.
 * <p>Failure answers are deliberately uniform ({@code INVALID_CREDENTIALS}) so they do not reveal whether an
 * account exists, is locked or is disabled.
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    static final int MAX_FAILED_ATTEMPTS = 5;
    static final Duration LOCK_DURATION = Duration.ofMinutes(15);
    /** Window in which a just-rotated token is treated as a benign race (e.g. two tabs) rather than theft. */
    static final Duration REUSE_GRACE = Duration.ofSeconds(15);

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwt;
    private final SettingsService settings;
    private final AuditService audit;
    private final SecureRandom random = new SecureRandom();
    private final AppProperties props;
    private final String dummyHash;

    public AuthService(UserRepository users, RefreshTokenRepository refreshTokens, PasswordEncoder passwordEncoder,
                       JwtService jwt, SettingsService settings, AuditService audit, AppProperties props) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.jwt = jwt;
        this.settings = settings;
        this.audit = audit;
        this.props = props;
        // Used to spend the same time on unknown e-mail addresses as on wrong passwords.
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    /** A freshly issued session: the user plus both tokens (to be put into cookies). */
    public record Session(User user, String accessToken, String refreshToken) {
    }

    /** Creates an account. The very first account becomes admin. */
    @Transactional
    public Session register(String email, String password, String displayName) {
        String normalized = normalize(email);
        boolean first = users.count() == 0;
        if (!first && !settings.registrationEnabled()) {
            log.warn("AUTH_REGISTER_REJECTED reason=registration-disabled");
            throw new ApiException(HttpStatus.FORBIDDEN, "REGISTRATION_DISABLED", "Registration is disabled");
        }
        if (password.equalsIgnoreCase(normalized)) {
            throw ApiException.badRequest("PASSWORD_WEAK", "Password must not equal the e-mail address");
        }
        if (users.existsByEmail(normalized)) {
            log.info("AUTH_REGISTER_REJECTED reason=email-taken");
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "E-mail is already registered");
        }
        User user;
        try {
            user = users.saveAndFlush(new User(normalized, passwordEncoder.encode(password), displayName.trim(),
                    first ? Role.ADMIN : Role.USER));
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "E-mail is already registered");
        }
        log.info("AUTH_REGISTER_OK user={} role={}", user.getId(), user.getRole());
        audit.record(Actor.user(user.getId(), user.getDisplayName()), "USER_REGISTERED", "USER", user.getId(),
                user.getDisplayName(), null, null, first ? List.of(Change.of("FIRST_ADMIN")) : List.of());
        return newSession(user, UUID.randomUUID());
    }

    /** Account creation through an invitation: bypasses the "registration open" switch, the invitation decides the role. */
    @Transactional
    public Session registerInvited(String email, String password, String displayName, Role role) {
        String normalized = normalize(email);
        if (password.equalsIgnoreCase(normalized)) {
            throw ApiException.badRequest("PASSWORD_WEAK", "Password must not equal the e-mail address");
        }
        if (users.existsByEmail(normalized)) {
            log.info("AUTH_INVITE_REGISTER_REJECTED reason=email-taken");
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "E-mail is already registered");
        }
        User user;
        try {
            user = users.saveAndFlush(new User(normalized, passwordEncoder.encode(password), displayName.trim(), role));
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "E-mail is already registered");
        }
        log.info("AUTH_INVITE_REGISTER_OK user={} role={}", user.getId(), role);
        return newSession(user, UUID.randomUUID());
    }

    /** Checks the credentials with lockout (5 failed attempts lock the account for 15 minutes). */
    @Transactional(noRollbackFor = ApiException.class)
    public Session login(String email, String password) {
        Instant now = Instant.now();
        User user = users.findByEmail(normalize(email)).orElse(null);
        if (user == null) {
            passwordEncoder.matches(password, dummyHash);
            log.info("AUTH_LOGIN_FAILED reason=unknown-email");
            throw invalidCredentials();
        }
        Actor actor = Actor.user(user.getId(), user.getDisplayName());
        if (!user.isEnabled()) {
            log.warn("AUTH_LOGIN_REJECTED user={} reason=disabled", user.getId());
            audit.record(actor, "LOGIN_FAILED", "USER", user.getId(), user.getDisplayName(), null, null,
                    List.of(Change.of("ACCOUNT_DISABLED")));
            throw invalidCredentials();
        }
        if (user.isLocked(now)) {
            // Same answer as for a wrong password so locking does not reveal that the account exists.
            log.warn("AUTH_LOGIN_REJECTED user={} reason=locked", user.getId());
            throw invalidCredentials();
        }
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            user.registerFailedLogin(MAX_FAILED_ATTEMPTS, LOCK_DURATION, now);
            log.warn("AUTH_LOGIN_FAILED user={} reason=bad-password attempts={}", user.getId(), user.getFailedLoginAttempts());
            audit.record(actor, "LOGIN_FAILED", "USER", user.getId(), user.getDisplayName(), null, null,
                    user.isLocked(now) ? List.of(Change.of("ACCOUNT_LOCKED")) : List.of());
            throw invalidCredentials();
        }
        user.registerSuccessfulLogin();
        log.info("AUTH_LOGIN_OK user={}", user.getId());
        audit.record(actor, "LOGIN", "USER", user.getId(), user.getDisplayName(), null, null, List.of());
        return newSession(user, UUID.randomUUID());
    }

    /** Rotates a refresh token. A replayed, long-rotated token revokes the whole session family (theft detection). */
    @Transactional(noRollbackFor = ApiException.class)
    public Session refresh(String presentedToken) {
        if (presentedToken == null) {
            throw unauthenticated();
        }
        Instant now = Instant.now();
        RefreshToken token = refreshTokens.findByTokenHash(hash(presentedToken)).orElseThrow(() -> {
            log.info("AUTH_REFRESH_REJECTED reason=unknown-token");
            return unauthenticated();
        });

        if (token.isRevoked()) {
            if (token.getRevokedAt().isBefore(now.minus(REUSE_GRACE))) {
                // An old, already-rotated token came back: assume theft and kill the whole session family.
                log.warn("AUTH_REFRESH_REUSE_DETECTED user={} family revoked", token.getUserId());
                refreshTokens.revokeFamily(token.getFamilyId(), now);
            } else {
                log.debug("AUTH_REFRESH_REJECTED user={} reason=concurrent-rotation", token.getUserId());
            }
            throw unauthenticated();
        }
        if (token.getExpiresAt().isBefore(now)) {
            log.info("AUTH_REFRESH_REJECTED user={} reason=expired", token.getUserId());
            throw unauthenticated();
        }
        User user = users.findById(token.getUserId()).filter(User::isEnabled).orElseThrow(() -> {
            log.info("AUTH_REFRESH_REJECTED user={} reason=gone-or-disabled", token.getUserId());
            return unauthenticated();
        });
        token.revoke(now);
        log.debug("AUTH_REFRESH_OK user={}", user.getId());
        return newSession(user, token.getFamilyId());
    }

    /** Revokes the session family of the presented refresh token. */
    @Transactional
    public void logout(String presentedToken) {
        if (presentedToken == null) {
            return;
        }
        refreshTokens.findByTokenHash(hash(presentedToken)).ifPresent(t -> {
            refreshTokens.revokeFamily(t.getFamilyId(), Instant.now());
            log.info("AUTH_LOGOUT user={}", t.getUserId());
            users.findById(t.getUserId()).ifPresent(u -> audit.record(Actor.user(u.getId(), u.getDisplayName()),
                    "LOGOUT", "USER", u.getId(), u.getDisplayName(), null, null, List.of()));
        });
    }

    /** Loads an enabled user or fails with {@code UNAUTHENTICATED}. */
    @Transactional(readOnly = true)
    public User currentUser(UUID id) {
        return users.findById(id).filter(User::isEnabled).orElseThrow(AuthService::unauthenticated);
    }

    /** Changes the display name. */
    @Transactional
    public User updateProfile(UUID id, String displayName) {
        User user = currentUser(id);
        String old = user.getDisplayName();
        user.setDisplayName(displayName.trim());
        log.info("PROFILE_UPDATED user={}", id);
        audit.record("PROFILE_UPDATED", "USER", id, user.getDisplayName(), null, null,
                List.of(Change.of("NAME", old, user.getDisplayName())));
        return user;
    }

    /** Changes the password and signs out every other device; the caller gets a fresh session. */
    @Transactional
    public Session changePassword(UUID id, String current, String next) {
        User user = currentUser(id);
        if (!passwordEncoder.matches(current, user.getPasswordHash())) {
            log.warn("PASSWORD_CHANGE_REJECTED user={} reason=wrong-current", id);
            throw new ApiException(HttpStatus.FORBIDDEN, "WRONG_PASSWORD", "Current password is wrong");
        }
        if (next.equalsIgnoreCase(user.getEmail())) {
            throw ApiException.badRequest("PASSWORD_WEAK", "Password must not equal the e-mail address");
        }
        user.setPasswordHash(passwordEncoder.encode(next));
        refreshTokens.revokeAllForUser(id, Instant.now());
        log.info("PASSWORD_CHANGED user={}", id);
        audit.record("PASSWORD_CHANGED", "USER", id, user.getDisplayName(), null, null, List.of());
        return newSession(user, UUID.randomUUID());
    }

    /** Nightly removal of long-expired refresh tokens. */
    @Scheduled(cron = "0 17 3 * * *")
    @Transactional
    void purgeExpiredTokens() {
        int removed = refreshTokens.deleteExpired(Instant.now().minus(Duration.ofDays(1)));
        log.info("JOB_PURGE_REFRESH_TOKENS removed={}", removed);
    }

    /** Creates a refresh token for the user (also used when an admin creates accounts). */
    private Session newSession(User user, UUID familyId) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String refresh = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expires = Instant.now().plus(props.security().refreshTokenTtl());
        refreshTokens.save(new RefreshToken(user.getId(), familyId, hash(refresh), expires));
        return new Session(user, jwt.issueAccessToken(user), refresh);
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    /** SHA-256 hex digest, used to store tokens without keeping them in clear. */
    static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static ApiException invalidCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid e-mail or password");
    }

    private static ApiException unauthenticated() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Not authenticated");
    }
}
